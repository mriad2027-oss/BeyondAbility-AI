"""Visual Companion (Features #1, #2, #5, #6).

For every visual event the system builds a *contextual* representation --
lecture id, timestamps, previous/next event, overlapping transcript, OCR text,
detected type and existing description -- so the "understanding" reasons about
the event, not a single isolated frame.

It then answers the three companion questions for a blind/low-vision learner:

    WHAT CHANGED?
    WHAT IS VISUALLY IMPORTANT?
    WHAT INFORMATION IS NOT ALREADY COVERED BY SPEECH?

Outputs (all deterministic, offline-safe, never fabricated):
  - enriched event analysis (grounding, complement score, trust, importance)
  - "What am I missing?" items grounded in events + timestamps
  - per-event evidence records for Ask-the-Video and transparency endpoints

The visual_complement_score is categorical (low | medium | high) with a written
reason -- we never invent numeric confidence that a model did not produce.
"""
from __future__ import annotations

import re

from backend.services import accessibility, evidence
from backend.services.ask import normalize_words

# "What am I missing?" status classification: how much of a visual event's
# information the spoken audio already communicates (Feature P2).
STATUS_UNAVAILABLE = "UNAVAILABLE"        # visual evidence cannot be verified
STATUS_REDUNDANT = "REDUNDANT"            # speech already communicates it
STATUS_PARTIALLY_MISSING = "PARTIALLY_MISSING"  # concept spoken, concrete visual adds info
STATUS_MISSING = "MISSING"                # visual info not communicated through speech

EDUCATIONAL_VISUAL_TYPES = {
    "code", "diagram", "chart", "table", "slide", "whiteboard",
    "interface", "formula", "demonstration",
}

# Small connective stop-word set so token overlap measures content, not grammar.
_STOPWORDS = {
    "the", "and", "that", "this", "with", "for", "are", "you", "your", "from",
    "have", "will", "what", "when", "where", "which", "there", "their", "they",
    "them", "all", "but", "not", "out", "his", "her", "was", "had", "how",
    "why", "can", "could", "would", "should", "into", "about", "than", "more",
    "show", "shows", "says", "said", "teacher", "teacher's", "علي", "هذا",
    "هذه", "ذلك", "التي", "الذي", "منها", "فيها", "لان", "لكن", "حسن", "بين",
    "عند", "كان", "هي", "هو", "نحن", "ان", "في", "من", "على", "الى",
}


def _content_words(text: str) -> set[str]:
    return {w for w in normalize_words(text) if w not in _STOPWORDS}


def speech_visual_coverage(description: str, ocr_text: str, overlap_transcript: str) -> float:
    """Fraction (0..1) of the visual content already present in the speech.

    Single source of truth for the audio-vs-visual comparison: the same
    stop-word-filtered content-word overlap is reused wherever a numeric
    coverage is needed (complement scoring and missing-status classification).
    """
    visual_tokens = _content_words(description + " " + ocr_text)
    if not visual_tokens:
        return 0.0
    overlap = visual_tokens & _content_words(overlap_transcript)
    return round(len(overlap) / len(visual_tokens), 3)


def _text(value) -> str:
    return str(value or "").strip()


def overlapping_transcript(segments: list[dict], event: dict) -> tuple[str, list[str]]:
    """Join transcript segments that overlap the event window.

    Returns (transcript_text, [segment_ids]).
    """
    start = float(event.get("start", 0.0))
    end = float(event.get("end", start))
    text_parts: list[str] = []
    seg_ids: list[str] = []
    for seg in segments or []:
        seg_start = float(seg.get("start", 0.0))
        seg_end = float(seg.get("end", seg_start))
        if seg_start < end and seg_end > start:
            text_parts.append(_text(seg.get("text")))
            seg_ids.append(str(seg.get("id", f"seg_{len(seg_ids) + 1:03d}")))
    return " ".join(p for p in text_parts if p), seg_ids


def compute_complement_score(event: dict, overlap_transcript: str = "",
                             previous_event: dict | None = None) -> dict:
    """Categorical visual_complement_score with a transparent, written reason.

    High   -> the screen carries concrete educational content (code, diagram,
              table, ...) that the spoken transcript does not fully describe.
    Medium -> partially useful: some new visual information, or content that
              overlaps spoken explanation.
    Low    -> adds little for a blind listener: the teacher already explains
              the visible content, or the visual content is not readable.
    """
    kind = _text(event.get("type", "other")).lower()
    description = _text(event.get("description"))
    ocr_text, readable = evidence.extract_ocr_text(description)
    confidence = float(evidence.to_confidence(event.get("confidence"), default=1.0))

    # 1. Nothing we can communicate -> low.
    if not description:
        return {"score": "low", "reason": "No visual description is available for this event."}
    if (description.lower().startswith("ocr-only") and not readable):
        return {"score": "low",
                "reason": "The on-screen content is not readable from the available frame, "
                          "so no visual complement can be communicated."}

    visual_tokens = _content_words(description + " " + ocr_text)
    if not visual_tokens:
        return {"score": "medium",
                "reason": "The visual description is too generic to compare against the speech."}

    speech_tokens = _content_words(overlap_transcript)
    overlap = visual_tokens & speech_tokens
    coverage = len(overlap) / len(visual_tokens)

    educational_type = kind in EDUCATIONAL_VISUAL_TYPES
    # Novelty against the previous event (a repeated slide adds nothing new).
    repeated = bool(previous_event) and \
        bool(_text(previous_event.get("description"))) and \
        _text(previous_event.get("description")) == description

    if repeated:
        return {"score": "low",
                "reason": "The same visual content already appeared in the previous event, so it adds nothing new."}

    if coverage >= 0.7:
        level = "low"
        reason = ("The spoken transcript already covers the visible content, so the "
                  "screen adds little for a listener.")
    elif educational_type and coverage < 0.35:
        level = "high"
        reason = (f"The screen shows {kind} content that the spoken transcript does not "
                  "fully describe (most visible details are not said aloud).")
    elif educational_type:
        level = "medium"
        reason = (f"The screen shows {kind} content that partly complements the spoken explanation.")
    elif coverage < 0.35:
        level = "medium"
        reason = "The visual event contains some details not fully covered by the speech."
    else:
        level = "low"
        reason = "The visible details closely match what is already being said."

    if confidence < 0.55:
        level = "medium" if level == "high" else level
        reason = reason + " Confidence in the detection is low, so treat details as uncertain."

    return {"score": level, "reason": reason}


def analyze_visual_events(events: list[dict], segments: list[dict] | None = None,
                          metadata: dict | None = None, job_id: str = "") -> list[dict]:
    """Build the contextual, grounded representation of every visual event.

    Purely additive: the original event dicts are never mutated; each analysis
    record adds grounding/complement/trust fields on top.
    """
    normalized = accessibility.normalize_visual_events(events, job_id)
    duration_total = float((metadata or {}).get("duration") or 0.0)
    analyzed: list[dict] = []
    for i, event in enumerate(normalized):
        previous_event = normalized[i - 1] if i > 0 else None
        next_event = normalized[i + 1] if i + 1 < len(normalized) else None
        start = float(event.get("start", 0.0))
        end = float(event.get("end", start))
        event_duration = max(0.0, end - start) if end > start else None
        if event_duration is None and duration_total and i + 1 < len(normalized):
            event_duration = max(0.0, float(normalized[i + 1].get("start", start)) - start)

        overlap_text, seg_ids = overlapping_transcript(segments or [], event)
        ocr_text, readable = evidence.extract_ocr_text(_text(event.get("description")))
        trust = evidence.trust_for_event(event)
        complement = compute_complement_score(event, overlap_text, previous_event)
        importance = accessibility.calculate_visual_importance(event, previous_event)

        analyzed.append({
            "lecture_id": job_id,
            "event_id": event.get("event_id", f"event_{i + 1:03d}"),
            "start": round(start, 2),
            "end": round(end, 2),
            "duration": None if event_duration is None else round(event_duration, 2),
            "type": _text(event.get("type", "other")).lower(),
            "description": _text(event.get("description")),
            "ocr_text": ocr_text,
            "readable": bool(readable or ocr_text),
            "has_visual_content": bool(ocr_text) or bool(_text(event.get("description"))),
            "previous_event_id": previous_event.get("event_id") if previous_event else None,
            "next_event_id": next_event.get("event_id") if next_event else None,
            "overlapping_transcript": overlap_text,
            "overlapping_segment_ids": seg_ids,
            "source_frames": event.get("source_frames", []),
            "transcript_context": _text(event.get("transcript_context")),
            "visual_complement_score": complement,
            "importance": importance,
            "source": "ocr" if _text(event.get("description")).startswith("OCR-only") else "vision",
            "trust": trust,
        })
    return analyzed


def _confidence_level(confidence: float) -> str:
    if confidence >= 0.85:
        return "high"
    if confidence >= 0.6:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# P2: "What am I missing?" -- competition-grade classification & ranking
# ---------------------------------------------------------------------------
_HIGH_RANK_TYPES = {"code", "diagram", "chart", "table", "formula", "interface"}
_MEDIUM_RANK_TYPES = {"slide", "whiteboard", "demonstration"}

_KIND_WHY = {
    "code": ("Reading the actual code connects the spoken explanation to how it is written "
             "in Python -- exact syntax, values, and structure -- which audio alone cannot convey."),
    "formula": ("The formula's exact symbols and structure are part of the meaning and are "
                "only visible on screen."),
    "chart": ("The chart's labels and the shape of the data add precise, quantified detail "
              "that the explanation does not speak aloud."),
    "diagram": ("The structure and the relationships between parts of the diagram are visible "
                "only on screen."),
    "table": ("The table rows and columns hold detail that is not read aloud."),
    "interface": ("Important controls, buttons, and actions on the interface were shown but not "
                  "fully verbalized."),
    "slide": ("Visible slide content reinforces or extends the speech with specifics a listener "
              "would otherwise miss."),
    "whiteboard": ("Readable formulas, drawings, or structure on the whiteboard carry part of "
                   "the lecture's explanation."),
    "demonstration": ("Actions performed on screen carry meaning that the speech alone does not "
                      "describe."),
}


def classify_status(event: dict, overlap_transcript: str = "",
                    complement: dict | None = None, trust: dict | None = None) -> str:
    """Classify how much of a visual event's information the speech communicates.

    Returns one of STATUS_UNAVAILABLE / STATUS_REDUNDANT / STATUS_PARTIALLY_MISSING /
    STATUS_MISSING. Missing and partially-missing are the actionable claims;
    redundant and unavailable are never turned into fabricated items.
    """
    trust = trust or evidence.trust_for_event(event)
    description = _text(event.get("description"))

    # Trust rule (no fabrication): unavailable evidence yields no claim at all.
    if _text(trust.get("trust")) == evidence.TRUST_UNAVAILABLE:
        return STATUS_UNAVAILABLE
    if not description:
        return STATUS_UNAVAILABLE
    ocr_text, readable = evidence.extract_ocr_text(description)
    if description.lower().startswith("ocr-only") and not readable:
        return STATUS_UNAVAILABLE

    complement = complement or compute_complement_score(event, overlap_transcript)
    if complement.get("score") == "low":
        # Either the speech already covers the content, or it adds nothing new.
        return STATUS_REDUNDANT

    coverage = speech_visual_coverage(description, ocr_text, overlap_transcript)
    if not _content_words(overlap_transcript):
        return STATUS_MISSING
    if coverage >= 0.7:
        return STATUS_REDUNDANT
    if coverage >= 0.35:
        return STATUS_PARTIALLY_MISSING
    # Low token overlap: for educational content the teacher often explains the
    # concept while the concrete example lives on screen -> partially missing.
    if _text(event.get("type", "other")).lower() in EDUCATIONAL_VISUAL_TYPES:
        return STATUS_PARTIALLY_MISSING
    return STATUS_MISSING


def importance_rank_for(event: dict, ana: dict | None = None, trust: dict | None = None) -> str:
    """HIGH / MEDIUM / LOW importance for a missing-information item.

    Ranking is type-driven first, then honestly capped: uncertain evidence never
    stays HIGH, and a visual that cannot be verified is never ranked HIGH simply
    for existing.
    """
    ana = ana or {}
    kind = _text(event.get("type", "other")).lower()
    if kind in _HIGH_RANK_TYPES:
        rank = "HIGH"
    elif kind in _MEDIUM_RANK_TYPES:
        rank = "MEDIUM"
    else:
        rank = "LOW"

    confidence = float(evidence.to_confidence(event.get("confidence"), default=1.0))
    if confidence < 0.55:
        rank = "MEDIUM" if rank == "HIGH" else rank

    trust = trust or evidence.trust_for_event(event)
    if _text(trust.get("trust")) == evidence.TRUST_UNCERTAIN:
        rank = "MEDIUM" if rank == "HIGH" else rank
    elif _text(trust.get("trust")) == evidence.TRUST_UNAVAILABLE:
        return "LOW"

    description = _text(event.get("description"))
    ocr_text, readable = evidence.extract_ocr_text(description)
    if (rank == "HIGH") and not (readable or ocr_text or _content_words(description)):
        rank = "MEDIUM"
    return rank


def condense_speech(text: str, cap: int = 200) -> str:
    """A short, verbatim summary of the spoken context (never paraphrased).

    Keeps whole sentences up to the cap at a word boundary; truncation is
    signalled with an ellipsis so the summary is never silently cut mid-word.
    """
    text = _text(text)
    if not text:
        return ""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    out: list[str] = []
    total = 0
    for sent in sentences:
        if total >= cap and out:
            break
        if total + len(sent) + 1 > cap and out:
            break
        out.append(sent)
        total += len(sent)
        if total >= cap:
            break
    if not out:
        out = [sentences[0]]
    joined = " ".join(out)
    if joined == text:
        return joined
    words = joined.split()
    cut: list[str] = []
    size = 0
    for w in words:
        if size + len(w) + (1 if cut else 0) > cap:
            break
        cut.append(w)
        size = len(" ".join(cut))
    return " ".join(cut) + "…"


def describe_missing_content(event: dict, ana: dict | None = None) -> str:
    """The 'what you are missing' text: what is on screen that speech missed.

    Grounded strictly in what the system could actually read: OCR text is quoted
    verbatim (code block for code), vision descriptions are used as produced.
    When only partial information is available it says so instead of inventing it.
    """
    ana = ana or {}
    kind = _text(event.get("type", "other")).lower()
    description = _text(event.get("description"))
    ocr_text, readable = evidence.extract_ocr_text(description)

    if readable and ocr_text:
        if kind == "code":
            return (f"The screen shows code that was not read aloud. "
                    f"OCR read from the screen: ```\n{ocr_text}\n```")
        return f"The screen also shows: {ocr_text}"
    if description:
        return _text(description)
    return (f"The screen appears to contain {kind} content, but the exact text is "
            f"not fully readable.")


def why_it_matters_for(event: dict, ana: dict | None = None) -> str:
    """Educational relevance of what the learner is missing (grounded in the event)."""
    ana = ana or {}
    kind = _text(event.get("type", "other")).lower()
    reason = _KIND_WHY.get(kind)
    if reason:
        return reason
    complement = ana.get("visual_complement_score") or {}
    if isinstance(complement, dict) and complement.get("reason"):
        return _text(complement.get("reason"))
    return f"Visual {kind} detail not fully explained by speech."


def classify_missing_info(events: list[dict], segments: list[dict] | None = None,
                          analysis: list[dict] | None = None) -> list[dict]:
    """Per-event audio-vs-visual classification (persisted / cached as one source
    of truth for the /missing endpoint and the missing_information_analysis stage).

    Deterministic and cheap: the /missing route recomputes this on the fly for
    lectures processed before this feature.
    """
    by_event_id = {a.get("event_id"): a for a in (analysis or [])}
    statuses: list[dict] = []
    for event in events or []:
        event_id = _text(event.get("event_id"))
        ana = by_event_id.get(event_id) or {}
        overlap = ana.get("overlapping_transcript") or _text(event.get("transcript_context"))
        complement = ana.get("visual_complement_score") or compute_complement_score(event, overlap)
        trust = ana.get("trust") or evidence.trust_for_event(event)
        description = _text(event.get("description"))
        ocr_text, _readable = evidence.extract_ocr_text(description)
        statuses.append({
            "event_id": event_id,
            "start": round(float(event.get("start", 0.0)), 2),
            "end": round(float(event.get("end", float(event.get("start", 0.0)))), 2),
            "status": classify_status(event, overlap, complement, trust),
            "coverage": speech_visual_coverage(description, ocr_text, overlap),
            "complement": complement.get("score"),
            "trust": _text(trust.get("trust")),
            "importance_rank": importance_rank_for(event, ana, trust),
            "category": _text(event.get("type", "other")).lower(),
        })
    return statuses


def build_missing_items(segments: list[dict], events: list[dict],
                        analysis: list[dict] | None = None,
                        profile_mode: str = "default",
                        lecture_id: str = "") -> list[dict]:
    """'What am I missing?' -- visual information present but absent from speech.

    Backward-compatible, additively extended item shape:
      timestamp / timestamp_start / timestamp_end / ts
      what_you_hear / missing_information / what_you_might_miss / why_it_matters
      source_event / event_id / event_ids / source_type / category
      confidence / confidence_level / trust / visual_complement_score
      importance / importance_rank / status / coverage / top_words
      evidence / evidence_kinds / id / lecture_id / project / module

    Classification (status) and ranking reuse classify_status /
    importance_rank_for so the endpoint and the analysis stage never diverge.
    Consecutive same-kind events inside one ~15s region are deduplicated: on
    screen for a long time is one moment, not several fabricated ones.
    """
    profile_mode = accessibility.normalize_mode(profile_mode)
    by_event_id = {a.get("event_id"): a for a in (analysis or [])}
    items: list[dict] = []
    for event in events or []:
        event_id = _text(event.get("event_id"))
        ana = by_event_id.get(event_id) or {}
        start = round(float(event.get("start", 0.0)), 2)
        end = round(float(event.get("end", start)), 2)
        description = _text(event.get("description"))
        overlap_text = (ana or {}).get("overlapping_transcript", _text(event.get("transcript_context")))
        complement = (ana or {}).get("visual_complement_score") or compute_complement_score(event, overlap_text)
        trust = (ana or {}).get("trust") or evidence.trust_for_event(event)
        confidence = float(event.get("confidence", 1.0))
        kind = _text(event.get("type", "other")).lower()
        speech = _text(overlap_text)

        # Trust/availability gate: never present unreadable content as facts.
        if not description or _text(trust.get("trust")) in (evidence.TRUST_UNAVAILABLE,):
            continue
        if complement.get("score") == "low":
            continue

        status = classify_status(event, overlap_text, complement, trust)
        importance_rank = importance_rank_for(event, ana, trust)
        ocr_text, readable = evidence.extract_ocr_text(description)
        coverage = speech_visual_coverage(description, ocr_text, overlap_text)

        # Profile adaptation (Feature #7): blind/low-vision want all meaningful
        # visual events; deaf/hard-of-hearing get the educational visuals that
        # captions cannot convey (screen layout, code, diagrams); cognitive
        # support keeps the highest-value concepts.
        comp_level = complement.get("score")
        if profile_mode in {"deaf", "hard_of_hearing"}:
            if kind not in EDUCATIONAL_VISUAL_TYPES or comp_level not in ("high", "medium"):
                continue
        elif profile_mode == "cognitive_support":
            if ana and float(ana["importance"]) < 0.4:
                continue

        if speech:
            what_you_hear = condense_speech(f"The teacher said: \u201c{speech}\u201d.")
            missing = (f"The teacher said: \u201c{speech}\u201d. "
                       f"The screen additionally shows: {description}")
        else:
            what_you_hear = "(silence in this segment)"
            missing = f"The screen shows: {description}"

        ev_record: list[dict] = []
        if readable and ocr_text:
            ev_record.append({"kind": "ocr", "text": ocr_text})
        if description and not description.lower().startswith("ocr-only"):
            ev_record.append({"kind": "vision", "text": description})
        evidence_kinds = sorted({e["kind"] for e in ev_record}) or ["vision"]
        top_words = sorted(_content_words(description + " " + ocr_text)
                           & _content_words(overlap_text))[:6]
        total_ms = int(round(start * 1000))
        hh, rem = divmod(total_ms, 3_600_000)
        mm, rem = divmod(rem, 60_000)
        ss, ms = divmod(rem, 1000)
        ts = f"{hh:02d}:{mm:02d}:{ss:02d}.{ms:03d}"

        items.append({
            "timestamp": start,
            "timestamp_start": start,
            "timestamp_end": end,
            "ts": ts,
            "what_you_hear": what_you_hear,
            "missing_information": missing,
            "what_you_might_miss": describe_missing_content(event, ana),
            "why_it_matters": why_it_matters_for(event, ana),
            "source_event": event_id,
            "event_id": event_id,
            "event_ids": [event_id],
            "source_type": "visual",
            "category": kind,
            "confidence": round(confidence, 3),
            "confidence_level": _confidence_level(confidence),
            "trust": trust,
            "visual_complement_score": complement,
            "importance": (ana or {}).get("importance", 0.0),
            "importance_rank": importance_rank,
            "status": status,
            "coverage_ratio": coverage,
            "top_words": top_words,
            "evidence": ev_record,
            "evidence_kinds": evidence_kinds,
            "project": "EduAccess",
            "module": "what-am-i-missing",
        })

    # Deterministic sort before dedup so merged items keep the earliest region.
    items.sort(key=lambda it: (it["timestamp"], _text(it.get("source_event"))))

    # Dedup: consecutive same-kind events in one ~15s window are one moment.
    seen: dict[tuple, dict] = {}
    deduped: list[dict] = []
    for it in items:
        window = int(float(it["timestamp_start"]) // 15)
        key = (_text(it.get("category")), _text(it.get("status")), window)
        prior = seen.get(key)
        if prior is None:
            seen[key] = it
            deduped.append(it)
            continue
        # Merge: same region, same kind/status -> same "screen moment".
        prior["event_ids"].extend(it.get("event_ids", [it.get("event_id")]))
        prior["timestamp_end"] = max(prior["timestamp_end"], it["timestamp_end"])
        prior["evidence_kinds"] = sorted(set(prior["evidence_kinds"]) | set(it["evidence_kinds"]))
        prior["evidence"] = prior["evidence"] or it["evidence"]
        if it.get("importance_rank") == "HIGH":
            prior["importance_rank"] = "HIGH"
        prior["confidence"] = round(min(prior["confidence"], it["confidence"]), 3)

    for i, it in enumerate(deduped):
        kind = _text(it.get("category"))
        it["id"] = f"{lecture_id}.missing.{kind}.{i + 1:02d}"
        it["lecture_id"] = lecture_id
        it["importance"] = round(float(it.get("importance") or 0.0), 3)
    return deduped


def build_evidence_records(analysis: list[dict]) -> list[dict]:
    """Per-event evidence records for the transparency endpoint."""
    records = []
    for ana in analysis or []:
        trust = ana.get("trust") or {}
        record = evidence.build_evidence(
            source_type="visual",
            event_id=ana.get("event_id"),
            timestamp=ana.get("start"),
            confidence=float((trust.get("confidence") or ana.get("importance") or 1.0)),
        )
        record["trust"] = _text(trust.get("trust")) or evidence.TRUST_UNAVAILABLE
        record["source_type"] = "ocr" if ana.get("source") == "ocr" else "visual"
        if ana.get("readable"):
            record["content_hint"] = _text(ana.get("ocr_text"))[:120] or _text(ana.get("description"))[:120]
        records.append(record)
    return records