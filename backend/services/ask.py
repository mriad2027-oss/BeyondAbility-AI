import json
import re
import time
from pathlib import Path

from backend import config, storage
from backend.observability import record_stage
from backend.services import llm, evidence, lecture_data

QA_STOPWORDS = {
    "the", "and", "what", "which", "why", "how", "when", "where", "who", "whose",
    "does", "do", "did", "is", "are", "was", "were", "be", "been", "being",
    "at", "in", "on", "of", "to", "for", "with", "from", "by", "this", "that",
    "these", "those", "you", "your", "please", "tell", "me", "about", "can",
    "could", "would", "should", "will", "his", "her", "its", "their",
    "them", "they", "then", "than", "there", "here", "not", "no", "all", "any",
    "each", "some", "more", "most",
    "علي", "هذا", "هذه", "ذلك", "التي", "الذي", "منها", "فيها", "لان", "لكن",
    "بين", "عند", "كان", "هي", "هو", "نحن", "ان", "في", "من", "على", "الى",
    "ما", "هل", "أين", "متى", "لماذا", "كيف", "ماذا", "أن", "إلى", "عن",
    "فين", "ايه", "اي", "اللي", "اللي", "ال", "لي", "فيها", "عشان", "الوقت",
    "بخصوص", "خصوص", "الشهادة", "بتاع", "بتاع",
}

# P3: answer status vocabulary (additive to the existing trust system).
STATUS_SUPPORTED = "SUPPORTED"              # directly grounded in verified evidence
STATUS_PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"  # grounded but the detail asked for is partial/absent
STATUS_UNCERTAIN = "UNCERTAIN"              # evidence exists but is ambiguous
STATUS_NOT_FOUND = "NOT_FOUND"              # no evidence for the question
STATUS_UNAVAILABLE = "UNAVAILABLE"          # the needed evidence cannot be verified

MAX_RETRIEVED = 4  # never send the entire lecture to the LLM (Feature P3, §27).

# ---------------------------------------------------------------------------
# Normalization (Arabic-safe, technical-token safe)
# ---------------------------------------------------------------------------

def _contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06ff]", text or ""))


def normalize_words(text: str) -> set[str]:
    # Explicit word alphabet (Latin + Arabic letters + digits + underscore).
    # Arabic punctuation (؟ ،) lives inside \u0600-\u06ff, so we enumerate the
    # actual letter range to keep 'المرمغة' and 'المرمغة؟' from diverging.
    words = re.findall(r"[a-z0-9_\u0621-\u064a]+", text.lower())
    # filter short stop words
    return {w for w in words if len(w) > 2}


def _strip_ar_article(word: str) -> str:
    """Strip a leading Arabic definite article 'ال' (safe for technical tokens)."""
    if word.startswith("ال") and len(word) > 4:
        return word[2:]
    return word


def content_words(text: str) -> set[str]:
    """Question keywords: stop words never decide a match (no-fabrication).

    Arabic definite articles are normalized safely so 'الكود' matches 'كود';
    technical tokens (python, for, while, range, api, sql, fastapi) are intact.
    """
    return {_strip_ar_article(w) for w in normalize_words(text) if w not in QA_STOPWORDS}


# ---------------------------------------------------------------------------
# Question understanding
# ---------------------------------------------------------------------------
_QUESTION_MARKERS = {
    "missing_visual": (("not explained", "unexplained", "written but not", "visual information did i miss", "did i miss", "what did i miss", "ما الذي فاتني", "ما كتب ولم يشرح", "لم يشرحه", "غير مشروح", "بدون شرح"), ("miss", "unexplained", "فاتني")),
    "code": (("code", "coding", "الكود", "كود", "الاكواد", "أكواد", "الشيفرة", "برمجي", "للبرمجة"), ("code", "كود", "شيفرة")),
    "diagram": (("diagram", "مخطط", "رسم", "الرسم", "الرسمة", "رسمة", "المخطط", "مخططا", "flowchart"), ("diagram", "مخطط", "رسم", "شكل")),
    "chart": (("chart", "graph", "رسم بياني", "البياني", "بيانات", "الرسم البياني", "مبيان"), ("chart", "graph", "بياني")),
    "slide": (("slide", "slides", "شريحة", "الشرائح", "الشريحة", "عرض"), ("slide", "شريحة")),
    "interface": (("interface", "ui", "button", "buttons", "زر", "الازرار", "الأزرار", "الزر", "واجهة", "الواجهة", "قائمة", "click"), ("button", "interface", "زر", "واجهة", "ui")),
    "action": (("clicked", "pressed", "switched", "opened", "closed", "ضغط", "نقر", "فعل", "حرك", "نزل", "عمل", "enter"), ("click", "press", "ضغط", "نقر")),
    "timestamp": (("when", "which time", "what time", "at minute", "at what point", "متى", "فين", "أي وقت", "اى وقت", "الدقيقة", "دقيقة", "عندما", "بعد", "قبل", "بعدها", "بعدين", "بعد ما"), ("when", "time", "minute", "متى", "فين", "دقيقة", "الدقيقة")),
    "visual": (("screen", "on screen", "shown", "shows", "visible", "visually", "appears", "the display", "الشاشة", "شاشة", "ظاهر", "يظهر", "الظاهر", "المعروض", "عرض", "بصري", "بصريا", "المرئي"), ("screen", "visual", "shown", "display", "الشاشة", "شاشة", "ظاهر")),
    "concept": (("what is", "what's", "define", "explain", "concept", "meaning", "يعني", "ماهو", "ماهي", "ما هو", "تعريف", "معنى", "فهم"), ("define", "explain", "meaning", "concept", "يعني", "معنى", "تعريف")),
    "comparison": (("difference", "differences", "compare", "versus", "between", "فرق", "الفرق", "مقارنة", "بينهم", "مقارنة بين", "ولا"), ("difference", "compare", "فرق", "مقارنة")),
    "accessibility": (("description", "narrate", "narration", "audio", "وصف", "الوصف", "أعمى", "كفيف", "مكفوفين", "سمعي"), ("description", "narration", "وصف")),
}

# Property questions ask for a specific detail (color, count, value...). If the
# evidence does not contain that detail, the system must NOT guess (P3, §26).
_PROPERTY_WORDS = {
    "color", "colour", "لون", "اللون", "الون",
    "how many", "count", "كم", "كم عدد", "عدد", "العدد", "how much",
    "value", "values", "قيمة", "القيمة", "رقم", "الرقم", "اسم", "الاسم",
    "name",
}


def classify_question(question: str) -> str:
    """Classify the question into a useful retrieval category (P3, §5)."""
    q = " " + question.strip().lower() + " "
    # Type-specific markers first (so "ما الكود الذي ظهر؟" is code, not visual).
    for cat in ("missing_visual", "comparison", "timestamp", "code", "diagram", "chart",
                "slide", "interface", "action", "visual", "accessibility", "concept"):
        markers, _needle = _QUESTION_MARKERS[cat]
        for marker in markers:
            if marker in q:
                return cat
    return "transcript"


def _property_question(question: str) -> bool:
    q = " " + question.strip().lower() + " "
    return any(w in q for w in _PROPERTY_WORDS)


def _extract_technical_values(text: str) -> set[str]:
    """Extract call patterns like range(5), print(i) for conflict detection."""
    values = set()
    for m in re.finditer(r"([A-Za-z_]\w*)\s*\(\s*([^)]*?)\s*\)", text or ""):
        name = m.group(1)
        args = re.sub(r"\s+", "", m.group(2))
        if name.lower() in ("range", "print", "for", "len", "set", "input"):
            values.add(f"{name}({args})")
    return values


def _target_time_or_range(question: str) -> tuple[float | None, float | None, bool]:
    """Parse timestamps (e.g. 00:08, at 8s) or time ranges (between 00:10 and 00:20).

    Returns (start_sec, end_sec, is_range).
    """
    q = question.strip().lower()
    
    # 1. Range patterns: between MM:SS and MM:SS or between Xs and Ys
    range_pats = [
        r"(?:between|from|بين|من)\s*(\d+):(\d+)\s*(?:and|to|و|إلى|الى)\s*(\d+):(\d+)",
        r"(?:between|from|بين|من)\s*(\d+)\s*(?:s|sec|seconds|ثانية)?\s*(?:and|to|و|إلى|الى)\s*(\d+)\s*(?:s|sec|seconds|ثانية)?",
    ]
    for pat in range_pats:
        m = re.search(pat, q)
        if m:
            groups = m.groups()
            if len(groups) == 4:
                t1 = float(int(groups[0]) * 60 + int(groups[1]))
                t2 = float(int(groups[2]) * 60 + int(groups[3]))
                return min(t1, t2), max(t1, t2), True
            elif len(groups) == 2:
                t1 = float(groups[0])
                t2 = float(groups[1])
                return min(t1, t2), max(t1, t2), True

    # 2. Single timestamp patterns: MM:SS, minute X, or Xs
    minute_patterns = [
        r"(?:الدقيقة|دقيقة|minute|minutes|at)\s*(\d+)\s*:\s*(\d+)",
        r"(?:الدقيقة|دقيقة|minute|minutes)\s*(\d+)",
        r"(?:at|in|عند|في)?\s*(\d+)\s*:\s*(\d+)",
        r"(?:at|عند|في)\s*(\d+)\s*(?:s|sec|seconds|ثانية)",
    ]
    for pat in minute_patterns:
        m = re.search(pat, q)
        if m:
            groups = m.groups()
            if len(groups) == 2 and groups[1] is not None:
                sec = float(int(groups[0]) * 60 + int(groups[1]))
                return sec, sec, False
            elif len(groups) >= 1 and groups[0] is not None:
                val = int(groups[0])
                if "minute" in pat or "دقيقة" in pat or "الدقيقة" in pat:
                    sec = float(val * 60)
                else:
                    sec = float(val)
                return sec, sec, False

    return None, None, False


def _target_minute(question: str) -> float | None:
    t1, _, _ = _target_time_or_range(question)
    return t1


# ---------------------------------------------------------------------------
# Retrieval (P3, §6, §7)
# ---------------------------------------------------------------------------

def _text(value) -> str:
    return str(value or "").strip()


def retrieve_segments(question: str, segments: list[dict], limit: int = MAX_RETRIEVED) -> list[dict]:
    q_words = content_words(question)
    scored = []
    for seg in segments:
        seg_words = content_words(_text(seg.get("text")))
        overlap = q_words.intersection(seg_words)
        if not overlap:
            continue
        # Rare words beat common ones mildly: score per-token.
        score = len(overlap) + 0.1 * len(seg_words.intersection(q_words))
        scored.append({
            "score": round(score, 3),
            "segment_id": str(seg.get("id", "")),
            "start": float(seg.get("start", 0.0)),
            "end": float(seg.get("end", float(seg.get("start", 0.0)))),
            "text": _text(seg.get("text")),
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def retrieve_events(question: str, events: list[dict], category: str, limit: int = MAX_RETRIEVED) -> list[dict]:
    q_words = content_words(question)
    scored = []
    for ev in events:
        desc = _text(ev.get("description"))
        ocr_text, readable = evidence.extract_ocr_text(desc)
        ev_text = f"{desc} {ocr_text} {_text(ev.get('type'))}"
        ev_words = content_words(ev_text)
        overlap = q_words.intersection(ev_words)
        if not overlap:
            continue
        score = len(overlap)
        # Category affinity: a code question prefers code events, etc.
        kind = _text(ev.get("type")).lower()
        if category == "code" and kind == "code":
            score += 1.0
        elif category == "diagram" and kind == "diagram":
            score += 1.0
        elif category in ("visual", "slide") and kind in ("slide", "diagram", "interface"):
            score += 0.5
        scored.append({
            "score": round(score, 3),
            "event_id": str(ev.get("event_id", "")),
            "start": float(ev.get("start", 0.0)),
            "end": float(ev.get("end", float(ev.get("start", 0.0)))),
            "type": kind,
            "description": desc,
            "ocr_text": ocr_text,
            "readable": readable,
            "trust": evidence.trust_for_event(ev),
            "visual_type": ev.get("visual_type"),
            "complement_level": ev.get("complement_level"),
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def _times_overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> bool:
    return a_start < b_end and b_start < a_end


def _find_in_window(target: float, segments: list[dict], events: list[dict], window: float = 5.0) -> tuple[list, list]:
    in_segs = [s for s in segments if abs(float(s.get("start", 0.0)) - target) <= window]
    in_evs = [e for e in events if abs(float(e.get("start", 0.0)) - target) <= window]
    return in_segs, in_evs


# ---------------------------------------------------------------------------
# Answer + evidence builders
# ---------------------------------------------------------------------------

def _format_ts(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    mm, ss = divmod(int(seconds), 60)
    return f"{mm:02d}:{ss:02d}"


def _record_types(records: list[dict]) -> tuple[str, ...]:
    return tuple(sorted({r.get("source_type", "") for r in records}))


def _evidence_for_refs(segments: list[dict], events: list[dict], source_refs: dict) -> dict:
    """Map source_refs (segment/event IDs) to transparent evidence records.

    Each record exposes the source type, the referenced ID, the start/end
    timestamps, a verbatim snippet, confidence and a trust level. A claim is
    only ever as trustworthy as its weakest record (verify_claim).
    """
    seg_by_id = {str(s.get("id", i)): s for i, s in enumerate(segments or [])}
    seg_by_index = {str(i): s for i, s in enumerate(segments or [])}
    ev_by_id = {}
    for i, e in enumerate(events or []):
        ev_by_id[str(e.get("event_id", i))] = e
        ev_by_id[str(i)] = e

    records: list[dict] = []
    for ref in (source_refs or {}).get("transcript_segments", []):
        seg = seg_by_id.get(str(ref)) or seg_by_index.get(str(ref))
        if seg:
            records.append({
                "source_type": "transcript",
                "segment_id": str(seg.get("id", ref)),
                "timestamp": round(float(seg.get("start", 0.0)), 2),
                "end_timestamp": round(float(seg.get("end", float(seg.get("start", 0.0)))), 2),
                "confidence": 1.0,
                "trust": evidence.TRUST_VERIFIED,
                "text_hint": str(seg.get("text", ""))[:160],
                "snippet": str(seg.get("text", ""))[:160],
            })
        else:
            records.append({
                "source_type": "transcript", "segment_ref": str(ref),
                "timestamp": None, "end_timestamp": None, "confidence": 0.0,
                "trust": evidence.TRUST_UNCERTAIN,
                "note": "Referenced transcript segment was not found in this lecture.",
            })

    for ref in (source_refs or {}).get("visual_events", []):
        ev = ev_by_id.get(str(ref))
        if ev:
            event_trust = evidence.trust_for_event(ev)
            ocr_text, readable = evidence.extract_ocr_text(_text(ev.get("description")))
            snippet = ocr_text if (readable and ocr_text) else _text(ev.get("description"))
            records.append({
                "source_type": "visual",
                "event_id": str(ev.get("event_id", ref)),
                "timestamp": round(float(ev.get("start", 0.0)), 2),
                "end_timestamp": round(float(ev.get("end", float(ev.get("start", 0.0)))), 2),
                "confidence": float(evidence.to_confidence(ev.get("confidence"), default=1.0)),
                "trust": event_trust.get("trust", evidence.TRUST_UNAVAILABLE),
                "text_hint": snippet[:160],
                "snippet": snippet[:160],
                "visual_type": ev.get("visual_type"),
                "complement_level": ev.get("complement_level"),
            })
        else:
            records.append({
                "source_type": "visual", "event_ref": str(ref),
                "timestamp": None, "end_timestamp": None, "confidence": 0.0,
                "trust": evidence.TRUST_UNCERTAIN,
                "note": "Referenced visual event was not found in this lecture.",
            })

    overall = evidence.verify_claim(records)
    return {
        "evidence": records,
        "trust": overall.get("trust", evidence.TRUST_UNAVAILABLE),
        "trust_reason": overall.get("reason", ""),
        "evidence_records": overall.get("records", 0),
    }


def _jump_for(records: list[dict]) -> dict | None:
    """Pick the earliest evidence record for jump-to-moment."""
    with_ts = [r for r in records if r.get("timestamp") is not None]
    if not with_ts:
        return None
    best = sorted(with_ts, key=lambda r: (float(r.get("timestamp", 0)),
                                          -evidence._TRUST_RANK.get(str(r.get("trust")), 0)))[0]
    source_id = best.get("event_id") or best.get("segment_id") or best.get("event_ref") or best.get("segment_ref") or ""
    return {
        "timestamp": float(best["timestamp"]),
        "end_timestamp": float(best.get("end_timestamp") or best["timestamp"]),
        "source_type": best.get("source_type", ""),
        "source_id": source_id,
        "label": f"Jump to moment ({_format_ts(best['timestamp'])})",
    }


def _why(answer_kind: str, evidence_records: list[dict], category: str, conflict: bool) -> list[str]:
    lines = []
    has_tx = any(r.get("source_type") == "transcript" for r in evidence_records)
    has_vi = any(r.get("source_type") == "visual" for r in evidence_records)
    if has_tx:
        lines.append("Supported by transcript evidence")
    if has_vi:
        lines.append("Supported by visual event evidence")
    if evidence_records:
        lines.append("Timestamps verified against the lecture data")
    lines.append("No unsupported details added")
    if conflict:
        lines.append("Conflict between speech and on-screen content is shown, not hidden")
    return lines


def _empty_answer(message: str, status: str = STATUS_NOT_FOUND) -> dict:
    return {
        "answer": message,
        "timestamps": [],
        "source_refs": {"transcript_segments": [], "visual_events": []},
        "evidence": [],
        "trust": evidence.TRUST_UNAVAILABLE,
        "trust_reason": "No supporting evidence is available for this claim.",
        "evidence_records": 0,
        "status": status,
        "status_reason": ("No supporting evidence in this lecture answers the question."
                          if status == STATUS_NOT_FOUND else "No supporting evidence is available for this claim."),
        "category": "unknown",
        "why": [],
        "conflict": {"flag": False},
    }


def _guarded_missing(question: str, property_word: str, language: str,
                     anchor: dict | None = None) -> dict:
    """Answer for a property question when the detail is absent (never guess).

    When a verified anchor (segment/event) exists, we keep its evidence in the
    record but mark the specific detail as NOT_FOUND.
    """
    anchor = anchor or {}
    property_word = property_word or "detail"
    if language == "ar":
        if property_word in ("لون", "اللون", "color", "colour"):
            answer = "لا أستطيع التحقق من اللون المطلوب من الأدلة المرئية المتاحة في الفيديو."
        else:
            answer = (f"المعلومة المطلوبة ({property_word}) غير متاحة في الأدلة الموثوقة لهذا "
                      "الفيديو، ولا أستطيع تخمينها.")
    else:
        if property_word in ("color", "colour", "لون", "اللون"):
            answer = ("I cannot verify the requested color from the available visual evidence "
                      "in the video.")
        else:
            answer = (f"The requested detail ({property_word}) is not available in the verified "
                      "evidence of this lecture, and I will not guess it.")
    payload = {
        "answer": answer,
        "timestamps": sorted(list(set(float(r["timestamp"]) for r in anchor.get("evidence", [])
                                       if r.get("timestamp") is not None))),
        "source_refs": {
            "transcript_segments": [r["segment_id"] for r in anchor.get("evidence", [])
                                    if r.get("source_type") == "transcript"],
            "visual_events": [r["event_id"] for r in anchor.get("evidence", [])
                              if r.get("source_type") == "visual"],
        },
        "evidence": anchor.get("evidence", []),
        "trust": anchor.get("trust", evidence.TRUST_UNAVAILABLE),
        "trust_reason": "The requested detail is not present in the verified evidence.",
        "evidence_records": anchor.get("evidence_records", 0),
        "status": STATUS_NOT_FOUND,
        "status_reason": ("Evidence exists in the lecture, but the specific requested detail "
                          "was not found in it."),
        "category": "unknown",
        "why": ["No unsupported details added",
                "The requested detail is honestly reported as unavailable"],
        "conflict": {"flag": False},
    }
    payload["jump"] = _jump_for(payload["evidence"])
    return payload


def keyword_fallback(question: str, segments: list[dict], events: list[dict]) -> dict:
    # Kept for backward compatibility: deterministic, stop-word-safe keyword QA.
    q_words = content_words(question)
    if not q_words:
        return _empty_answer("I couldn't find enough information in this lecture to answer that.")

    matched_segs = []
    matched_events = []
    for seg in segments:
        seg_words = content_words(seg.get("text", ""))
        overlap = q_words.intersection(seg_words)
        if overlap:
            matched_segs.append((len(overlap), seg))
    for ev in events:
        ev_words = content_words(ev.get("description", "") + " " + ev.get("type", ""))
        overlap = q_words.intersection(ev_words)
        if overlap:
            matched_events.append((len(overlap), ev))

    matched_segs.sort(key=lambda x: x[0], reverse=True)
    matched_events.sort(key=lambda x: x[0], reverse=True)

    answer_parts = []
    timestamps = []
    seg_ids = []
    event_ids = []

    if matched_segs:
        score, seg = matched_segs[0]
        t = round(float(seg.get("start", 0.0)), 2)
        answer_parts.append(f"At {t}s, the lecture mentions: \"{seg.get('text', '').strip()}\".")
        timestamps.append(t)
        seg_ids.append(str(seg.get("id", "seg_001")))

    if matched_events:
        score, ev = matched_events[0]
        t = round(float(ev.get("start", 0.0)), 2)
        desc = ev.get("description", "").strip()
        if desc.startswith("OCR-only output:"):
            desc = desc.replace("OCR-only output:", "").strip()
        answer_parts.append(f"Visually, around {t}s: {desc}")
        timestamps.append(t)
        event_ids.append(str(ev.get("event_id", "event_001")))

    if not answer_parts:
        return _empty_answer("I couldn't find enough information in this lecture to answer that.")

    payload = {
        "answer": " ".join(answer_parts),
        "timestamps": sorted(list(set(timestamps))),
        "source_refs": {
            "transcript_segments": seg_ids,
            "visual_events": event_ids
        }
    }
    payload.update(_evidence_for_refs(segments, events, payload["source_refs"]))
    return payload


# ---------------------------------------------------------------------------
# Conflict handling (P3, §14)
# ---------------------------------------------------------------------------

def _detect_conflict(best_seg: dict | None, best_ev: dict | None) -> dict:
    """Detect speech-vs-screen contradictions (e.g. range(10) vs range(5))."""
    if not best_seg or not best_ev:
        return {"flag": False}
    seg_text = best_seg.get("text", "")
    ev_snippet = f"{best_ev.get('description', '')} {best_ev.get('ocr_text', '')}"
    seg_values = _extract_technical_values(seg_text)
    ev_values = _extract_technical_values(ev_snippet)
    if not seg_values or not ev_values:
        return {"flag": False}
    # Same function name, different arguments -> conflict.
    seg_by_name = {v.split("(")[0]: v for v in seg_values}
    ev_by_name = {v.split("(")[0]: v for v in ev_values}
    for name in seg_by_name.keys() & ev_by_name.keys():
        if seg_by_name[name] != ev_by_name[name]:
            return {
                "flag": True,
                "transcript": seg_by_name[name],
                "visual": ev_by_name[name],
                "note": "Different values appear in the spoken transcript and on screen.",
            }
    return {"flag": False}


# ---------------------------------------------------------------------------
# Grounded deterministic answer engine (no LLM needed for integrity)
# ---------------------------------------------------------------------------

def grounded_answer(job_id: str, question: str, segments: list[dict], events: list[dict],
                    category: str) -> dict:
    """Deterministic evidence-grounded answer. Never guesses.

    This is the source of truth for status/trust/evidence/timestamps; an LLM
    may later polish the prose, but only against the same retrieved evidence.
    """
    language = "ar" if _contains_arabic(question) else "en"

    want_property = _property_question(question)
    if want_property:
        property_word = next((w for w in _PROPERTY_WORDS if w in question.lower()), "detail")

def _compose_time_range(job_id: str, question: str, segments: list[dict], events: list[dict],
                        t_start: float, t_end: float, language: str) -> dict:
    """Compose a chronological answer for an interval query (e.g. between 00:10 and 00:20)."""
    in_segs = [s for s in segments if float(s.get("start", 0)) < t_end and float(s.get("end", 0)) > t_start]
    in_evs = [e for e in events if float(e.get("start", 0)) < t_end and float(e.get("end", 0)) > t_start]
    
    if not in_segs and not in_evs:
        msg = ("لم يتم العثور على محتوى موثق في هذه الفترة الزمنية."
               if language == "ar" else
               f"No documented content was found between {_format_ts(t_start)} and {_format_ts(t_end)}.")
        return _empty_answer(msg, status=STATUS_NOT_FOUND)

    source_refs = {
        "transcript_segments": [str(s.get("id", f"seg_{i}")) for i, s in enumerate(in_segs)],
        "visual_events": [str(e.get("event_id", f"ev_{i}")) for i, e in enumerate(in_evs)],
    }
    
    parts_ar = [f"بين {_format_ts(t_start)} و {_format_ts(t_end)}:"]
    parts_en = [f"Between {_format_ts(t_start)} and {_format_ts(t_end)}:"]
    timestamps = []

    for s in in_segs:
        st = round(float(s.get("start", 0)), 2)
        timestamps.append(st)
        parts_ar.append(f"قال المدرس عند الثانية {st}: “{s.get('text', '')}”.")
        parts_en.append(f"At {st}s, the teacher explains: \"{s.get('text', '')}\".")

    for e in in_evs:
        et = round(float(e.get("start", 0)), 2)
        timestamps.append(et)
        ocr, readable = evidence.extract_ocr_text(_text(e.get("description")))
        snippet = ocr if readable else _text(e.get("description"))
        vtype = e.get("visual_type") or e.get("type", "visual")
        parts_ar.append(f"مرئياً عند الثانية {et} ({vtype}): {snippet}")
        parts_en.append(f"On screen at {et}s ({vtype}): {snippet}")

    answer = " ".join(parts_ar) if language == "ar" else " ".join(parts_en)
    payload = {
        "answer": answer,
        "timestamps": sorted(list(set(timestamps))),
        "source_refs": source_refs,
    }
    payload.update(_evidence_for_refs(segments, events, source_refs))
    payload["status"] = STATUS_SUPPORTED
    payload["status_reason"] = "Supported by timeline evidence across speech and video."
    payload["category"] = "timestamp"
    payload["why"] = _why("timestamp", payload["evidence"], "timestamp", False)
    payload["conflict"] = {"flag": False}
    payload["jump"] = _jump_for(payload["evidence"])
    return payload


def _compose_missing_visuals(job_id: str, question: str, segments: list[dict], events: list[dict],
                             language: str) -> dict:
    """Compose an answer identifying visual details shown on screen but not explained aloud."""
    unspoken_events = []
    for ev in events:
        desc = _text(ev.get("description"))
        ocr, readable = evidence.extract_ocr_text(desc)
        comp = ev.get("complement_level") or ""
        # Check if visual adds meaningful unspoken detail
        if readable and ocr and (comp in ("VISUALLY_ONLY", "COMPLEMENTARY", "PARTIALLY_MISSING") or not ev.get("transcript_context")):
            unspoken_events.append((ev, ocr))
        elif readable and ocr:
            # Check content word overlap with all speech
            ev_words = content_words(ocr)
            seg_words = set().union(*(content_words(s.get("text", "")) for s in segments))
            unspoken_words = ev_words - seg_words
            if len(unspoken_words) >= 2:
                unspoken_events.append((ev, ocr))

    if not unspoken_events:
        msg = ("جميع المعلومات المرئية المقروءة تم شرحها صوتياً بواسطة المدرس."
               if language == "ar" else
               "All readable visual content on screen was explained verbally by the teacher.")
        return _empty_answer(msg, status=STATUS_SUPPORTED)

    source_refs = {"transcript_segments": [], "visual_events": [e[0]["event_id"] for e in unspoken_events[:4]]}
    parts_ar = ["المعلومات المرئية التي ظهرت على الشاشة ولم يتم شرحها صوتياً بالكامل:"]
    parts_en = ["The following visual information appeared on screen but was not fully explained aloud:"]
    timestamps = []

    for ev, ocr in unspoken_events[:4]:
        t = round(float(ev.get("start", 0)), 2)
        timestamps.append(t)
        vtype = ev.get("visual_type") or ev.get("type", "visual")
        lines = [ln.strip() for ln in ocr.splitlines() if ln.strip()]
        snippet = " | ".join(lines[:3])
        parts_ar.append(f"- عند الثانية {t} ({vtype}): ظهر '{snippet}'.")
        parts_en.append(f"- At {t}s ({vtype}): '{snippet}' is visible on screen.")

    answer = "\n".join(parts_ar) if language == "ar" else "\n".join(parts_en)
    payload = {
        "answer": answer,
        "timestamps": sorted(list(set(timestamps))),
        "source_refs": source_refs,
    }
    payload.update(_evidence_for_refs(segments, events, source_refs))
    payload["status"] = STATUS_SUPPORTED
    payload["status_reason"] = "Visual-to-speech consistency analysis detected unspoken visual details."
    payload["category"] = "missing_visual"
    payload["why"] = ["Supported by visual OCR evidence", "Compared against spoken transcript"]
    payload["conflict"] = {"flag": False}
    payload["jump"] = _jump_for(payload["evidence"])
    return payload


def grounded_answer(job_id: str, question: str, segments: list[dict], events: list[dict],
                    category: str) -> dict:
    """Deterministic evidence-grounded answer. Never guesses.

    This is the source of truth for status/trust/evidence/timestamps; an LLM
    may later polish the prose, but only against the same retrieved evidence.
    """
    language = "ar" if _contains_arabic(question) else "en"

    want_property = _property_question(question)
    if want_property:
        property_word = next((w for w in _PROPERTY_WORDS if w in question.lower()), "detail")

    # 1) Time ranges (e.g. between 00:10 and 00:20).
    t_start, t_end, is_range = _target_time_or_range(question)
    if is_range and t_start is not None and t_end is not None:
        return _compose_time_range(job_id, question, segments, events, t_start, t_end, language)

    # 2) Missing visual content query (e.g. what was written but not explained).
    if category == "missing_visual" or any(p in question.lower() for p in ("not explained", "did i miss", "what did i miss", "فاتني", "لم يشرح")):
        return _compose_missing_visuals(job_id, question, segments, events, language)

    # 3) Specific temporal anchor (e.g. at 00:08, at 8s, at minute 2).
    if t_start is not None:
        in_segs, in_evs = _find_in_window(t_start, segments, events, window=4.0)
        if in_evs or in_segs:
            # Re-shape window hits into the retrieval form the composers expect.
            ev = None
            if in_evs:
                best_match_ev = in_evs[0]
                ev_desc = str(best_match_ev.get("description", ""))
                ocr_text, readable = evidence.extract_ocr_text(ev_desc)
                ev = {
                    "event_id": str(best_match_ev.get("event_id", "")),
                    "start": float(best_match_ev.get("start", 0.0)),
                    "end": float(best_match_ev.get("end", float(best_match_ev.get("start", 0.0)))),
                    "type": str(best_match_ev.get("type", "")).lower(),
                    "description": ev_desc,
                    "ocr_text": ocr_text, "readable": readable,
                    "trust": evidence.trust_for_event(best_match_ev),
                    "visual_type": best_match_ev.get("visual_type"),
                }
            seg = None
            if in_segs:
                seg = {
                    "segment_id": str(in_segs[0].get("id", "")),
                    "start": float(in_segs[0].get("start", 0.0)),
                    "end": float(in_segs[0].get("end", float(in_segs[0].get("start", 0.0)))),
                    "text": str(in_segs[0].get("text", "")),
                }
            return _compose(job_id, question, segments, events, category, seg, ev, language)
        elif category == "timestamp":
            return _empty_answer(
                "لم أجد محتوى موثقاً عند هذه النقطة الزمنية في الفيديو."
                if language == "ar" else
                "I couldn't find any documented content at that point in the lecture.",
                status=STATUS_NOT_FOUND)

    # 4) Regular retrieval.
    best_segs = retrieve_segments(question, segments)
    best_evs = retrieve_events(question, events, category)
    best_seg = best_segs[0] if best_segs else None
    best_ev = best_evs[0] if best_evs else None

    if category == "timestamp":
        return _compose(job_id, question, segments, events, category, best_seg, best_ev, language)

    # 5) Visual questions need a visual anchor when no transcript covers them.
    if category in ("visual", "code", "diagram", "chart", "slide", "interface", "action"):
        if not best_seg and not best_ev:
            if want_property:
                return _guarded_missing(question, property_word, language)
            return _visual_unavailable(question, category, language)

    # 6) Comparison questions.
    if category == "comparison":
        return _compose_comparison(job_id, question, segments, events, best_segs, best_evs, language)

    # 6b) Property questions with NO anchor at all: never guess the detail,
    #     even when the category is not visual (e.g. clothing-color questions).
    if want_property and not best_seg and not best_ev:
        return _guarded_missing(question, property_word, language)

    # 7) Property questions with a verified anchor but no detail -> guarded.
    if want_property and (best_seg or best_ev):
        found_detail = False
        if best_ev and best_ev.get("readable") and best_ev.get("ocr_text"):
            detail_needles = ("color", "لون", "number", "count", "عدد", "blue",
                              "red", "green", "black", "اسم", "name")
            found_detail = any(w in best_ev["ocr_text"].lower() for w in detail_needles)
        if not found_detail:
            refs = {"transcript_segments": [], "visual_events": []}
            if best_seg:
                refs["transcript_segments"].append(best_seg["segment_id"])
            if best_ev:
                refs["visual_events"].append(best_ev["event_id"])
            anchor = _evidence_for_refs(segments, events, refs)
            return _guarded_missing(question, property_word, language, anchor=anchor)

    # 8) Conflict: speech vs screen within the same window.
    conflict = _detect_conflict(best_seg, best_ev)
    if conflict["flag"] and best_seg and best_ev and _times_overlap(
            best_seg["start"], best_seg["end"], best_ev["start"], best_ev["end"]):
        return _compose_conflict(job_id, question, segments, events, best_seg, best_ev, conflict, language)

    # 9) Default grounded answer.
    return _compose(job_id, question, segments, events, category, best_seg, best_ev, language)


def _visual_unavailable(question: str, category: str, language: str) -> dict:
    if language == "ar":
        answer = "لا أستطيع التحقق من هذه المعلومة من الأدلة المرئية المتاحة في الفيديو."
    else:
        answer = "The visual content needed for this question is not available to verify in this video."
    return {
        "answer": answer,
        "timestamps": [],
        "source_refs": {"transcript_segments": [], "visual_events": []},
        "evidence": [],
        "trust": evidence.TRUST_UNAVAILABLE,
        "trust_reason": "No verifiable visual evidence matched this question.",
        "evidence_records": 0,
        "status": STATUS_UNAVAILABLE,
        "status_reason": ("The required visual content could not be verified from the lecture's "
                          "visual evidence (e.g. unreadable or absent on-screen content)."),
        "category": category,
        "why": ["No visual evidence could be verified", "No unsupported details added"],
        "conflict": {"flag": False},
    }


def _compose(job_id, question, segments, events, category, best_seg, best_ev, language) -> dict:
    language = "ar" if _contains_arabic(question) else "en"
    source_refs = {"transcript_segments": [], "visual_events": []}
    parts_ar: list[str] = []
    parts_en: list[str] = []
    timestamps: list[float] = []

    if best_seg:
        t = round(float(best_seg["start"]), 2)
        source_refs["transcript_segments"].append(best_seg["segment_id"])
        parts_ar.append(f"في الثانية {t} شرح المدرس: “{best_seg['text']}”.")
        parts_en.append(f"At {t}s, the lecture mentions: \"{best_seg['text']}\".")
        timestamps.append(t)

    if best_ev:
        t = round(float(best_ev["start"]), 2)
        source_refs["visual_events"].append(best_ev["event_id"])
        timestamps.append(t)
        snippet = best_ev.get("ocr_text") if (best_ev.get("readable") and best_ev.get("ocr_text")) \
            else best_ev.get("description", "")
        if not snippet:
            snippet = "(on-screen content could not be read)"
        if category == "code":
            if best_ev.get("readable") and best_ev.get("ocr_text") and _is_partial_ocr(best_ev["ocr_text"]):
                parts_ar.append(f"ظهر على الشاشة جزء من الكود، لكن النص الكامل غير متاح."
                                if language == "ar" else
                                "Part of the code appeared on screen, but the full text is not available.")
                parts_en.append("Part of the code appeared on screen, but the full text is not available.")
            elif best_ev.get("readable") and best_ev.get("ocr_text"):
                parts_ar.append(f"ظهر على الشاشة الكود: {best_ev['ocr_text']}")
                parts_en.append(f"On screen, the code appeared: {best_ev['ocr_text']}")
            else:
                parts_ar.append(f"ظهر على الشاشة مثال {best_ev.get('type') or 'code'}، لكن النص غير مقروء "
                                "بالكامل.")
                parts_en.append(f"A {best_ev.get('type') or 'code'} example appeared on screen, but its "
                                "text is not fully readable.")
        elif category in ("visual", "slide", "diagram", "chart", "interface", "action"):
            vtype = best_ev.get("visual_type") or best_ev.get("type") or "visual"
            parts_ar.append(f"على الشاشة عند الثانية {t} ({vtype}): {snippet}")
            parts_en.append(f"Visually, around {t}s ({vtype}): {snippet}")
        else:
            parts_ar.append(f"على الشاشة عند الثانية {t}: {snippet}")
            parts_en.append(f"Visually, around {t}s: {snippet}")

    if not best_seg and not best_ev:
        return _visual_unavailable(question, category, language) if category in (
            "visual", "code", "diagram", "chart", "slide", "interface", "action") \
            else _empty_answer(
                "لم أجد دليلاً موثوقاً في الفيديو يجيب عن هذا السؤال (I couldn't find enough "
                "information in this lecture's evidence to answer that).",
                status=STATUS_NOT_FOUND)

    answer = " ".join(parts_ar) if language == "ar" else " ".join(parts_en)
    payload = {
        "answer": answer,
        "timestamps": sorted(list(set(timestamps))),
        "source_refs": source_refs,
    }
    payload.update(_evidence_for_refs(segments, events, source_refs))
    status, status_reason = _status_for(payload["evidence"], category, best_ev, language)
    payload["status"] = status
    payload["status_reason"] = status_reason
    payload["category"] = category
    payload["why"] = _why(category, payload["evidence"], category, False)
    payload["conflict"] = {"flag": False}
    payload["jump"] = _jump_for(payload["evidence"])
    return payload


def _is_partial_ocr(ocr_text: str) -> bool:
    stripped = (ocr_text or "").rstrip()
    return bool(re.search(r"[….]{3,}$", stripped)) or "…" in stripped or "partial" in stripped.lower()


def _status_for(records: list[dict], category: str, best_ev: dict | None, language: str) -> tuple[str, str]:
    """Map composite trust + evidence state to the additive answer status."""
    trust = evidence.verify_claim(records).get("trust", evidence.TRUST_UNAVAILABLE)
    if trust == evidence.TRUST_VERIFIED:
        status = STATUS_SUPPORTED
        reason = "The answer is directly supported by verified lecture evidence."
    elif trust == evidence.TRUST_UNCERTAIN:
        status = STATUS_UNCERTAIN
        reason = "The evidence exists but could not be fully confirmed."
    elif trust == evidence.TRUST_UNAVAILABLE:
        if best_ev and best_ev.get("readable"):
            status = STATUS_PARTIALLY_SUPPORTED
            reason = "The evidence is partially readable; the full detail cannot be confirmed."
        else:
            status = STATUS_UNAVAILABLE
            reason = "The needed evidence is not verifiable from this lecture."
    else:
        status = STATUS_NOT_FOUND
        reason = "No evidence matched the question."
    return status, reason


def _compose_conflict(job_id, question, segments, events, best_seg, best_ev, conflict, language) -> dict:
    source_refs = {
        "transcript_segments": [best_seg["segment_id"]],
        "visual_events": [best_ev["event_id"]],
    }
    if language == "ar":
        answer = (f"يوجد تعارض بين الكلام المنطوق والمحتوى الظاهر على الشاشة. قال المدرس "
                  f"“{conflict['transcript']}” على الشاشة، بينما يُظهر المحتوى المرئي "
                  f"“{conflict['visual']}”.")
    else:
        answer = (f"There is a conflict between the spoken transcript and the on-screen content. "
                  f"The teacher says “{conflict['transcript']}”, while the verified visual content "
                  f"shows “{conflict['visual']}”.")
    payload = {
        "answer": answer,
        "timestamps": sorted({round(float(best_seg["start"]), 2), round(float(best_ev["start"]), 2)}),
        "source_refs": source_refs,
    }
    payload.update(_evidence_for_refs(segments, events, source_refs))
    payload["status"] = STATUS_UNCERTAIN
    payload["status_reason"] = "Speech and on-screen evidence conflict; both sources are shown."
    payload["category"] = "comparison"
    payload["why"] = _why("conflict", payload["evidence"], "comparison", True)
    payload["conflict"] = {**conflict, "sources": sorted({r["source_type"] for r in payload["evidence"]})}
    payload["jump"] = _jump_for(payload["evidence"])
    return payload


def _compose_comparison(job_id, question, segments, events, best_segs, best_evs, language) -> dict:
    """Comparison answer showing both verified examples (never invented)."""
    source_refs = {"transcript_segments": [], "visual_events": []}
    evs = best_evs[:2]
    segs = best_segs[:2]
    items: list[tuple[str, float, str]] = []
    for ev in evs:
        snippet = ev.get("ocr_text") if (ev.get("readable") and ev.get("ocr_text")) else ev.get("description", "")
        source_refs["visual_events"].append(ev["event_id"])
        items.append((ev["event_id"], round(float(ev["start"]), 2), snippet))
    if not evs:
        for seg in segs:
            source_refs["transcript_segments"].append(seg["segment_id"])
            items.append((seg["segment_id"], round(float(seg["start"]), 2), seg["text"]))
    if len(items) < 2:
        return _empty_answer(
            "لم أجد مثالين موثقين في الفيديو للمقارنة بينهما."
            if language == "ar" else
            "I couldn't find two documented examples in the lecture to compare.",
            status=STATUS_NOT_FOUND)
    timestamps = [t for _, t, _ in items]
    if language == "ar":
        bits = [f"({i + 1}) عند الثانية {t}: “{s}”" for i, (_, t, s) in enumerate(items)]
        answer = "ظهر مثالان موثقان: " + " ؛ ".join(bits) + "."
    else:
        bits = [f"({i + 1}) at {t}s: \"{s}\"" for i, (_, t, s) in enumerate(items)]
        answer = "Two documented examples appeared: " + " ; ".join(bits) + "."
    payload = {
        "answer": answer,
        "timestamps": sorted(timestamps),
        "source_refs": source_refs,
    }
    payload.update(_evidence_for_refs(segments, events, source_refs))
    payload["status"] = STATUS_SUPPORTED
    payload["status_reason"] = "Both examples are directly supported by verified evidence."
    payload["category"] = "comparison"
    payload["why"] = _why("comparison", payload["evidence"], "comparison", False)
    payload["conflict"] = {"flag": False}
    payload["jump"] = _jump_for(payload["evidence"])
    return payload


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

ASK_SYSTEM_PROMPT = (
    "You are an expert educational tutor answering about a processed lecture. "
    "You are given ONLY the retrieved evidence (top transcript segments and "
    "visual events) and a question. Rules:\n"
    "1. Answer only what the provided evidence supports. Do NOT use outside knowledge.\n"
    "2. Never invent code, values, colors, numbers, or timestamps.\n"
    "3. If the evidence cannot answer: respond \"I couldn't find enough information "
    "in this lecture's evidence to answer that.\"\n"
    "4. Return ONLY a raw JSON object (no markdown) with schema:\n"
    '{"answer": "grounded answer", "timestamps": [floats], '
    '"source_refs": {"transcript_segments": [ids], "visual_events": [ids]}}\n'
    "Only reference IDs that are actually in the provided evidence."
)


def _build_llm_context(segments: list[dict], events: list[dict]) -> str:
    lines = ["TRANSCRIPT SEGMENTS (retrieved):"]
    for seg in segments:
        lines.append(f"- ID: {seg.get('segment_id')}, Time: {seg['start']}-{seg['end']}s, "
                     f"Text: \"{seg.get('text')}\"")
    lines.append("\nVISUAL EVENTS (retrieved):")
    for ev in events:
        snippet = ev.get("ocr_text") if (ev.get("readable") and ev.get("ocr_text")) \
            else ev.get("description", "")
        lines.append(f"- ID: {ev.get('event_id')}, Time: {ev['start']}-{ev['end']}s, "
                     f"Type: {ev.get('type')}, Content: \"{snippet}\"")
    return "\n".join(lines)


def _merge_understanding(events: list[dict], understanding: list[dict]) -> list[dict]:
    """Additively merge visual-understanding fields onto each visual event.

    Never mutates the originals. Adds `visual_type`, `complement_level`,
    `visual_claims` and `accessibility_description` (short/standard) so Ask's
    evidence and prose can reference the structured, grounded understanding.
    """
    by_id = {str(u.get("event_id")): u for u in (understanding or [])}
    merged = []
    for ev in events or []:
        ev = dict(ev)
        und = by_id.get(str(ev.get("event_id"))) or {}
        if und:
            ev["visual_type"] = und.get("visual_type")
            ev["complement_level"] = und.get("complement_level")
            ev["visual_claims"] = und.get("visual_claims", [])
            ev["accessibility_description"] = und.get("accessibility_description")
        merged.append(ev)
    return merged


def ask_video(job_id: str, question: str) -> dict:
    """
    Evidence-grounded Ask-the-Video (Feature P3).

    Flow: retrieve relevant evidence first -> deterministic grounded answer ->
    optional LLM prose on the *retrieved* context only -> evidence block with
    per-source trust, timestamps, jump data and "why this answer". No video
    reprocessing, no whole-lecture LLM context, nothing fabricated.
    """
    if not storage.job_exists(job_id):
        return _empty_answer("Lecture not found.")

    job = storage.get_job(job_id)
    result = job.get("result", {})
    segments = lecture_data.load_segments(job, result)
    events = lecture_data.load_visual_events(job, result)
    understanding = lecture_data.load_visual_understanding(job, result)
    # Enrich the visual events with the structured understanding (additive).
    events = _merge_understanding(events, understanding)
    category = classify_question(question)

    # Deterministic, fully grounded answer (also the LLM fallback).
    t_start = time.monotonic()
    grounded = grounded_answer(job_id, question, segments, events, category)
    retrieval_ms = round((time.monotonic() - t_start) * 1000, 1)

    # Retrieval statistics for observability.
    retrieved_segs = retrieve_segments(question, segments)
    retrieved_evs = retrieve_events(question, events, category)
    retrieval_count = len(retrieved_segs) + len(retrieved_evs)

    # Optional LLM polish ONLY on retrieved context (perf + no-fabrication).
    if grounded.get("source_refs", {}).get("transcript_segments") or \
            grounded.get("source_refs", {}).get("visual_events"):
        context_text = _build_llm_context(retrieved_segs, retrieved_evs)
        user_prompt = (f"RETRIEVED LECTURE EVIDENCE:\n{context_text}\n\n"
                       f"STUDENT QUESTION:\n{question}\n\n"
                       "Generate the grounded response JSON now.")
        fallback_str = json.dumps(grounded, ensure_ascii=False)
        response = llm.call_llm(ASK_SYSTEM_PROMPT, user_prompt, fallback_str)
        try:
            from backend.services.vision import clean_json_response
            data = clean_json_response(response)
            if "answer" not in data:
                raise ValueError("Invalid ask response format")
            data.setdefault("source_refs", {"transcript_segments": [], "visual_events": []})
            data["source_refs"].setdefault("transcript_segments", [])
            data["source_refs"].setdefault("visual_events", [])
            # Grounding guard: never surface citations the lecture does not contain.
            valid_seg_ids = {str(s.get("id")) for s in segments} | {str(i) for i in range(len(segments))}
            valid_event_ids = {str(e.get("event_id")) for e in events} | {str(i) for i in range(len(events))}
            data["source_refs"]["transcript_segments"] = [
                r for r in data["source_refs"]["transcript_segments"] if str(r) in valid_seg_ids
            ]
            data["source_refs"]["visual_events"] = [
                r for r in data["source_refs"]["visual_events"] if str(r) in valid_event_ids
            ]
            evidence_block = _evidence_for_refs(segments, events, data["source_refs"])
            if not evidence_block["evidence"]:
                data = grounded
            else:
                data.update(evidence_block)
                data["status"] = grounded["status"] if grounded.get("status") else STATUS_SUPPORTED
                data["status_reason"] = grounded.get("status_reason", "")
                data["category"] = category
                data["why"] = grounded.get("why", [])
                data["conflict"] = {"flag": False}
                data["jump"] = _jump_for(data["evidence"])
            grounded = data
        except Exception:
            grounded = json.loads(fallback_str)
    else:
        grounded = json.loads(json.dumps(grounded, ensure_ascii=False))

    final_trust = grounded.get("trust", evidence.TRUST_UNAVAILABLE)
    record_stage(job_id, "ask_retrieval", ok=True, seconds=retrieval_ms / 1000,
                 note=f"[ask_retrieval] query='{question[:40]}' retrieved={retrieval_count} category={category}")
    record_stage(job_id, "ask_grounding", ok=True, seconds=0.0,
                 note=f"[ask_grounding] evidence={grounded.get('evidence_records', 0)} trust={final_trust} "
                      f"status={grounded.get('status', '')} category={category}")

    # P4 #4: structured, record-grounded "Why should I trust this?" trail.
    _explain_lines = evidence.explain_trust(
        grounded.get("evidence", []),
        conflict=grounded.get("conflict"),
        status=grounded.get("status", ""),
    )
    grounded["trust_explanation"] = {
        "lines": _explain_lines,
        "sources_agree": any("sources agree" in line for line in _explain_lines),
        "heads_up": next((line[2:] for line in _explain_lines
                          if line.startswith("⚠ ")), ""),
        "cap": next((line[2:] for line in _explain_lines
                     if line.startswith("⚠ ") and "capped" in line), ""),
    }
    return grounded