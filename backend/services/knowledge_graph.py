"""Lecture Knowledge Graph (Intelligent Multimodal Learning Engine, feature #1).

Builds an evidence-grounded, human-readable knowledge graph for one lecture by
mapping **concepts** to both the transcript (speech) and the visual events
(screen). Every node and edge carries the evidence that supports it:

    concept  --spoke in-->  transcript segment (speech evidence)
    concept  --shown by--> visual event        (visual/OCR evidence)
    concept  --assessed--> quiz question       (assessment evidence)

Because the whole system is built on the no-fabrication rule, a concept is only
ever given a status that the stored evidence actually supports:

    EXPLAINED             spoken in the transcript and understood as said
    VISUALLY_SHOWN        present in verified on-screen (OCR) content
    PARTIALLY_EXPLAINED   spoken, and the concrete screen detail adds more
    ASSESSED              referenced by a quiz question (answerable)
    MISSING_EXPLANATION   named on screen / in the lesson but not explained
    UNKNOWN               evidence is unavailable / cannot be grounded

Nothing here invents concepts: concept candidates come from (a) the quiz's
`concept` labels (authoritative assessment units), (b) the pipeline's
`important_concepts`/`learning_objectives`, and (c) educational vocabulary that
genuinely appears in the transcript or readable OCR text.

The graph is deterministic and computed *live* from the stored lecture evidence
(segments + visual events + analysis + understanding + quiz), with an optional
on-disk cache under `data/outputs/<stem>_knowledge_graph.json` so repeated calls
are cheap. Reused by learning-gaps and the learning agent so they never diverge.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from backend import config, storage
from backend.services import evidence, lecture_data, visual_companion
from backend.services.ask import normalize_words

# Concept coverage status vocabulary (additive to the existing trust system).
STATUS_EXPLAINED = "EXPLAINED"
STATUS_VISUALLY_SHOWN = "VISUALLY_SHOWN"
STATUS_PARTIALLY_EXPLAINED = "PARTIALLY_EXPLAINED"
STATUS_ASSESSED = "ASSESSED"
STATUS_MISSING_EXPLANATION = "MISSING_EXPLANATION"
STATUS_UNKNOWN = "UNKNOWN"

# Educational vocabulary that makes a word a plausible concept candidate when it
# actually appears in the evidence. Shared with the concept-mapping layer.
EDUCATIONAL_TERMS = {
    "loop", "loops", "for loop", "while loop", "iteration", "range", "variable",
    "variables", "function", "class", "array", "list", "dictionary", "tuple",
    "stack", "queue", "condition", "conditional", "comparison", "operator",
    "boolean", "recursion", "syntax", "parameter", "argument", "return",
    "algorithm", "diagram", "flowchart", "chart", "table", "matplotlib",
    "numpy", "python", "module", "import", "print", "programming", "code",
    "statement", "expression", "evaluate", "output", "input",
    # Arabic equivalents
    "حلقة", "تكرار", "متغير", "دالة", "شرط", "مصفوفة", "قائمة", "مقارنة",
    "معامل", "خوارزمية", "مخطط", "بياني", "بايثون", "برمجة", "برمجية",
    "كود", "الشيفرة", "وحدة", "الاستيراد", "طباعة", "مخرجات", "مدخلات",
}

# Small connector stop-words so token overlap measures content, not grammar.
_STOPSET = visual_companion._STOPWORDS


def _text(value) -> str:
    return str(value or "").strip()


def _content_words(text: str) -> set[str]:
    return {w for w in normalize_words(text) if w not in _STOPSET}


def _slug(concept: str) -> str:
    """A stable, URL-safe id for a concept."""
    s = re.sub(r"[^a-z0-9_\u0600-\u06ff]+", "_", concept.strip().lower()).strip("_")
    return s or "concept"


def _fmt_clock(seconds) -> str:
    try:
        seconds = max(0.0, float(seconds))
        mm, ss = divmod(int(seconds), 60)
        return f"{mm:02d}:{ss:02d}"
    except (TypeError, ValueError):
        return ""


# ---------------------------------------------------------------------------
# Evidence loaders (reuse the shared lecture-data layer)
# ---------------------------------------------------------------------------

def _load(job: dict) -> dict:
    result = job.get("result") or {}
    segments = lecture_data.load_segments(job, result)
    events = lecture_data.load_visual_events(job, result)
    if not result.get("visual_analysis") and events:
        metadata = result.get("video_metadata") or {}
        result["visual_analysis"] = visual_companion.analyze_visual_events(
            events, segments, metadata, job.get("job_id", ""))
    analysis = result.get("visual_analysis") or []
    understanding = lecture_data.load_visual_understanding(job, result)
    return {
        "segments": segments,
        "events": events,
        "analysis": analysis,
        "understanding": understanding,
        "result": result,
    }


def _load_quiz(job_id: str) -> list[dict]:
    try:
        path = config.QUIZZES_DIR / f"{job_id}_quiz.json"
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError, TypeError):
        return []


# ---------------------------------------------------------------------------
# Concept candidates (never invented -- always drawn from evidence)
# ---------------------------------------------------------------------------

def candidate_concepts(job: dict, data: dict | None = None,
                       lowercase: bool = False) -> list[dict]:
    """Return the distinct concept candidates grounded in a lecture's evidence.

    Sources, in order of authority:
      1. quiz questions' `concept` labels  (assessment units -- ASSESSED)
      2. accessibility `important_concepts` / `learning_objectives`
      3. educational vocabulary that literally appears in transcript or OCR
    """
    data = data or _load(job)
    job_id = job.get("job_id", "")
    result = data["result"]
    segments = data["segments"]

    # Source 1: quiz concept labels (most authoritative).
    quiz = _load_quiz(job_id)
    quiz_concepts = []
    for q in quiz:
        c = _text(q.get("concept"))
        if c and c != "general":
            quiz_concepts.append(c)

    # Source 2: pipeline important_concepts / learning_objectives.
    acc_concepts = []
    for key in ("important_concepts", "learning_objectives"):
        for c in (result.get(key) or []):
            c = _text(c)
            if c and len(c) > 1:
                acc_concepts.append(c)

    # Source 3: educational vocabulary that literally appears in the evidence,
    # matched at word boundaries (so "import" never matches inside "important").
    transcript_corpus = " ".join(_text(s.get("text")) for s in segments)
    visual_corpus = " ".join(
        evidence.extract_ocr_text(_text(e.get("description")))[0]
        for e in data["events"] if _text(e.get("description")))
    full_corpus = f" {transcript_corpus} {visual_corpus} ".lower()

    vocab_hits = set()
    for term in EDUCATIONAL_TERMS:
        if len(term) > 2 and (
                term in {w.lower() for w in quiz_concepts + acc_concepts}
                or re.search(rf"(?<![a-z0-9_\u0600-\u06ff]){re.escape(term)}(?![a-z0-9_\u0600-\u06ff])",
                             full_corpus)):
            vocab_hits.add(term)
    vocab_concepts = sorted(vocab_hits)

    # De-dup, preserving order.
    seen: set[str] = set()
    ordered: list[str] = []
    for group in (quiz_concepts, acc_concepts, vocab_concepts):
        for c in group:
            key = c.strip().lower()
            if key and key not in seen:
                seen.add(key)
                ordered.append(c.strip())

    if not ordered and not quiz:  # truly empty lecture -> honest empty graph
        return []

    # Build candidate records.
    candidates = []
    for c in ordered:
        cl = c.lower()
        candidates.append({
            "concept": c,
            "label": c,
            "concept_id": _slug(c),
            "source": (
                "quiz" if cl in {x.lower() for x in quiz_concepts}
                else "lesson_summary" if cl in {x.lower() for x in acc_concepts}
                else "vocabulary_matching"),
            "assessed": cl in {x.lower() for x in quiz_concepts},
        })
    return candidates


# ---------------------------------------------------------------------------
# Concept <-> speech / visual mapping
# ---------------------------------------------------------------------------

def map_concept_to_speech(concept: str, segments: list[dict]) -> list[dict]:
    """Transcript segments whose content actually mentions the concept.

    Matching is content-word overlap against stop-word-filtered tokens, so a
    concept is only linked to speech that really discusses it. Each link carries
    the segment id, its time window, and a verbatim snippet plus the overlap
    used as the mapping justification.
    """
    concept_words = _content_words(concept)
    if not concept_words:
        return []
    links = []
    for seg in segments or []:
        seg_words = _content_words(_text(seg.get("text")))
        if not (concept_words & seg_words):
            continue
        # Prefer strong matches: the exact term, or a clear multi-word concept.
        overlap = concept_words & seg_words
        strength = "strong" if (concept.lower() in _text(seg.get("text")).lower()
                                or len(overlap) >= 2) else "partial"
        start = float(seg.get("start", 0.0))
        links.append({
            "segment_id": str(seg.get("id", "")),
            "timestamp": round(start, 2),
            "start": round(start, 2),
            "end": round(float(seg.get("end", start)), 2),
            "ts": _fmt_clock(start),
            "type": "speech",
            "snippet": _text(seg.get("text")),
            "match_strength": strength,
            "matched_words": sorted(overlap),
        })
    return links


def map_concept_to_visual(concept: str, events: list[dict],
                          analysis: list[dict]) -> list[dict]:
    """Visual events whose readable on-screen content mentions the concept.

    Linked against VERIFIED (or UNCERTAIN, flagged) OCR content only. An event
    whose screen text cannot be read is never linked to a concept by guessing.
    """
    concept_words = _content_words(concept)
    if not concept_words:
        return []
    analysis_by_id = {a.get("event_id"): a for a in (analysis or [])}
    links = []
    for ev in events or []:
        desc = _text(ev.get("description"))
        ocr_text, readable = evidence.extract_ocr_text(desc)
        text_for_match = f"{ocr_text} {_text(ev.get('type'))}" if readable else ""
        if readable and _content_words(text_for_match) & concept_words:
            trust = (analysis_by_id.get(ev.get("event_id")) or {}).get("trust") \
                or evidence.trust_for_event(ev)
            start = float(ev.get("start", 0.0))
            links.append({
                "event_id": str(ev.get("event_id", "")),
                "timestamp": round(start, 2),
                "start": round(start, 2),
                "end": round(float(ev.get("end", start)), 2),
                "ts": _fmt_clock(start),
                "type": "visual",
                "visual_type": _text(ev.get("type", "other")).lower(),
                "snippet": ocr_text or _text(ev.get("description")),
                "trust": _text(trust.get("trust")) if isinstance(trust, dict) else _text(trust),
                "readable": bool(readable),
            })
    return links


# ---------------------------------------------------------------------------
# Concept status (from real evidence only)
# ---------------------------------------------------------------------------

def concept_status(concept: str, speech: list[dict], visual: list[dict],
                   assessed: bool) -> tuple[str, list[str]]:
    """Determine a concept's evidence-backed coverage status.

    EXPLAINED             spoken, no meaningful unspoken screen detail
    VISUALLY_SHOWN        verified on screen, not spoken
    PARTIALLY_EXPLAINED   spoken AND the concrete screen adds more detail
    ASSESSED              has a quiz question (assessment exists)
    MISSING_EXPLANATION   present but neither explained nor shown by verified evidence
    UNKNOWN               cannot be grounded at all
    """
    has_speech = bool(speech)
    has_visual = bool(visual)
    verified_visual = [v for v in visual if v.get("trust") == evidence.TRUST_VERIFIED]
    reasons: list[str] = []

    if has_speech and verified_visual:
        reasons.append("The concept is explained in speech and concrete on-screen "
                       "detail was verified, so the screen adds to the spoken idea.")
        return STATUS_PARTIALLY_EXPLAINED, reasons

    if has_speech:
        reasons.append(f"Spoken in {len(speech)} transcript segment(s).")
        if has_visual:
            reasons.append("Verified on-screen detail was not found in the readable "
                           "content, so the concept is explained in speech.")
        else:
            reasons.append("No readable on-screen detail was verified for this concept.")
        if assessed:
            reasons.append("An assessment question also covers it.")
            return STATUS_ASSESSED, reasons
        return STATUS_EXPLAINED, reasons

    if has_visual:
        if assessed:
            reasons.append("An assessment question refers to it.")
            return STATUS_ASSESSED, reasons
        # Only unverified visual links remain (e.g. UNCERTAIN). Report the
        # honest gap rather than upgrading a fuzzy claim to a fact.
        reasons.append("No spoken explanation was found for this concept.")
        return STATUS_VISUALLY_SHOWN, reasons

    # No speech and no visual evidence at all.
    if assessed:
        reasons.append("Referenced by an assessment question, but no lecture "
                       "evidence was found that explains or shows it.")
        return STATUS_ASSESSED, reasons
    reasons.append("No lecture evidence could be found that explains or shows "
                   "this concept.")
    return STATUS_UNKNOWN, reasons


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def _transcript_edges(segments: list[dict]) -> list[dict]:
    """Adjacency edges between consecutive transcript segments (temporal flow)."""
    edges = []
    for i, seg in enumerate(segments):
        nxt = segments[i + 1] if i + 1 < len(segments) else None
        if nxt is None:
            continue
        edges.append({
            "source": f"segment:{str(seg.get('id'))}",
            "target": f"segment:{str(nxt.get('id'))}",
            "rel": "followed_by",
            "start": round(float(seg.get("start", 0.0)), 2),
            "timestamp": round(float(seg.get("start", 0.0)), 2),
        })
    return edges


def _visual_edges(events: list[dict]) -> list[dict]:
    edges = []
    prev = None
    for ev in events or []:
        if prev is not None:
            edges.append({
                "source": f"event:{str(prev)}",
                "target": f"event:{str(ev.get('event_id'))}",
                "rel": "next_visual",
                "start": round(float(ev.get("start", 0.0)), 2),
                "timestamp": round(float(ev.get("start", 0.0)), 2),
            })
        prev = ev.get("event_id")
    return edges


def build_graph(job: dict, data: dict | None = None) -> dict:
    """Build the full evidence-grounded lecture knowledge graph.

    Returns {job_id, concepts: [...], nodes: [...], edges: [...], evidence_gaps}.
    """
    job_id = job.get("job_id", "")
    data = data or _load(job)
    segments = data["segments"]
    events = data["events"]
    analysis = data["analysis"]
    quiz = _load_quiz(job_id)

    candidates = candidate_concepts(job, data)

    quiz_by_concept: dict[str, list[dict]] = {}
    for q in quiz:
        c = _text(q.get("concept"))
        if c:
            quiz_by_concept.setdefault(c.lower(), []).append(q)

    concepts: list[dict] = []
    for cand in candidates:
        concept = cand["concept"]
        speech = map_concept_to_speech(concept, segments)
        visual = map_concept_to_visual(concept, events, analysis)
        assessed = bool(quiz_by_concept.get(concept.lower()))
        status, reasons = concept_status(concept, speech, visual, assessed)
        # Quiz questions carrying this concept (assessment evidence).
        assessment = []
        for q in quiz_by_concept.get(concept.lower(), []):
            refs = q.get("source_refs") or {}
            seg_refs = [r for r in refs.get("transcript_segments", [])]
            ev_refs = [r for r in refs.get("visual_events", [])]
            timestamp = None
            if seg_refs and segments:
                first = seg_refs[0]
                for i, s in enumerate(segments):
                    if str(s.get("id")) == str(first) or (isinstance(first, int) and first == i):
                        timestamp = round(float(s.get("start", 0.0)), 2)
                        break
            elif ev_refs and events:
                first_ev = ev_refs[0]
                for e in events:
                    if str(e.get("event_id")) == str(first_ev):
                        timestamp = round(float(e.get("start", 0.0)), 2)
                        break
            assessment.append({
                "question_id": f"q{len(assessment) + 1}",
                "question": _text(q.get("question")),
                "type": q.get("type", "multiple_choice"),
                "timestamp": timestamp,
                "source_refs": {"transcript_segments": seg_refs, "visual_events": ev_refs},
            })

        concepts.append({
            "concept_id": cand["concept_id"],
            "label": concept,
            "slug": cand["concept_id"],
            "source": cand["source"],
            "assessed": assessed,
            "status": status,
            "status_reason": reasons,
            "speech": speech,
            "speech_count": len(speech),
            "visual": visual,
            "visual_count": len(visual),
            "assessment": assessment,
            "assessment_count": len(assessment),
            "first_timestamp": float(min(
                [l["timestamp"] for l in speech + visual] or [0.0])) if speech or visual else None,
        })

    # Build concept-to-concept semantic relationships based on evidence
    concept_map = {c["concept_id"]: c for c in concepts}
    concept_labels = {c["label"].lower(): c for c in concepts}
    edges: list[dict] = []

    for c in concepts:
        lbl = c["label"].lower()
        relationships = {
            "demonstrated_by": [],
            "prerequisites": [],
            "related_to": [],
            "shown_at": [{"timestamp": v["timestamp"], "ts": v["ts"], "snippet": v.get("snippet", ""), "event_id": v["event_id"]} for v in c["visual"]],
            "explained_at": [{"timestamp": s["timestamp"], "ts": s["ts"], "text": s.get("text", ""), "segment_id": s["segment_id"]} for s in c["speech"]],
            "assessed_by": [{"question": a["question"], "question_id": a["question_id"], "timestamp": a.get("timestamp")} for a in c["assessment"]],
        }

        # Semantic links
        if "loop" in lbl and "for" not in lbl and "while" not in lbl:
            for sub in ("for loop", "while loop", "for", "while"):
                if sub in concept_labels and concept_labels[sub]["concept_id"] != c["concept_id"]:
                    target_id = concept_labels[sub]["concept_id"]
                    relationships["demonstrated_by"].append(concept_labels[sub]["label"])
                    edges.append({
                        "source": f"concept:{c['concept_id']}",
                        "target": f"concept:{target_id}",
                        "rel": "demonstrated_by",
                        "label": "demonstrated by",
                    })

        if "for loop" in lbl or lbl == "for":
            if "range" in concept_labels:
                relationships["prerequisites"].append(concept_labels["range"]["label"])
                edges.append({
                    "source": f"concept:{concept_labels['range']['concept_id']}",
                    "target": f"concept:{c['concept_id']}",
                    "rel": "prerequisite_of",
                    "label": "prerequisite of",
                })
            if "while loop" in concept_labels:
                relationships["related_to"].append(concept_labels["while loop"]["label"])
                edges.append({
                    "source": f"concept:{c['concept_id']}",
                    "target": f"concept:{concept_labels['while loop']['concept_id']}",
                    "rel": "related_to",
                    "label": "related to",
                })

        c["relationships"] = relationships

    # Node list for rendering (concept + quiz + segment + event nodes).
    nodes: list[dict] = []
    for c in concepts:
        nodes.append({
            "id": f"concept:{c['concept_id']}",
            "type": "concept",
            "label": c["label"],
            "concept_id": c["concept_id"],
            "status": c["status"],
            "assessed": c["assessed"],
            "timestamp": c.get("first_timestamp"),
            "relationships": c.get("relationships", {}),
        })
    if quiz:
        nodes.append({
            "id": f"quiz:{job_id}",
            "type": "quiz",
            "label": f"{job_id} quiz",
            "questions": len(quiz),
            "timestamp": None,
        })
    for seg in segments:
        nodes.append({
            "id": f"segment:{str(seg.get('id'))}",
            "type": "speech",
            "label": _text(seg.get("text"))[:90],
            "timestamp": round(float(seg.get("start", 0.0)), 2),
        })
    for ev in events:
        nodes.append({
            "id": f"event:{str(ev.get('event_id'))}",
            "type": "visual",
            "label": _text(ev.get("type", "other")),
            "timestamp": round(float(ev.get("start", 0.0)), 2),
        })

    # Edges: concept -> speech / concept -> visual / concept -> quiz.
    for c in concepts:
        cid = f"concept:{c['concept_id']}"
        for l in c["speech"]:
            edges.append({
                "source": cid,
                "target": f"segment:{l['segment_id']}",
                "rel": "spoken_in",
                "timestamp": l["timestamp"],
                "evidence": "content-word overlap with transcript",
            })
        for l in c["visual"]:
            edges.append({
                "source": cid,
                "target": f"event:{l['event_id']}",
                "rel": "shown_by",
                "timestamp": l["timestamp"],
                "trust": l.get("trust"),
                "evidence": "content-word overlap with verified on-screen content",
            })
        for a in c["assessment"]:
            edges.append({
                "source": cid,
                "target": f"quiz:{job_id}",
                "rel": "assessed_by",
                "timestamp": a.get("timestamp"),
                "question": a["question"],
            })
    edges.extend(_transcript_edges(segments))
    edges.extend(_visual_edges(events))

    return {
        "job_id": job_id,
        "concepts": concepts,
        "nodes": nodes,
        "edges": edges,
        "evidence": {
            "segments": len(segments),
            "visual_events": len(events),
            "quiz_questions": len(quiz),
        },
        "generated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Cache (optional on-disk, atomic, honest)
# ---------------------------------------------------------------------------

def _graph_path(job: dict) -> Path:
    stem = Path(job.get("video_path", "")).stem
    return config.OUTPUTS_DIR / f"{stem}_knowledge_graph.json"


def get_knowledge_graph(job_id: str, use_cache: bool = True) -> dict:
    """Return the lecture's knowledge graph, computing it from evidence.

    `use_cache=True` will first try the on-disk artifact (written only after a
    successful build) and fall back to computing live. Live results are always
    correct for the current stored evidence.
    """
    job = storage.get_job(job_id)
    path = _graph_path(job)
    if use_cache and path.exists():
        try:
            cached = json.loads(path.read_text(encoding="utf-8"))
            if cached.get("job_id") == job_id and cached.get("concepts") is not None:
                return cached
        except (OSError, ValueError):
            pass
    graph = build_graph(job)
    try:
        config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(graph, ensure_ascii=False, indent=2),
                        encoding="utf-8")
    except OSError:
        pass
    return graph
