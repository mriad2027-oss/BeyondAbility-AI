"""Learning Gap Detection + Explain-Missing-Concept
(Intelligent Multimodal Learning Engine, features #3 and #4).

Learning gaps are computed strictly from grounded evidence -- never by guessing
what a student "probably" knows.

Two kinds of gap are surfaced:

  * Lecture-level modality gaps: concepts whose *knowledge-graph status* shows
    they are only weakly (or not at all) taught across the speech + visual
    modalities, e.g. a concept that is UNKNOWN, or a concept that is carried
    only by unverified on-screen content with no spoken explanation.

  * Student-level mastery gaps: concepts the student has actually answered
    incorrectly (aggregated from their quiz attempts), which are then resolved
    back to the lecture's real evidence moments so the learner knows *where* to
    re-study.

`explain_missing_concept` explains a concept using only the real lecture
artifacts that mention it, honestly reporting when no covering evidence exists.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from backend import config, storage
from backend.services import knowledge_graph as kg
from backend.services import concept_mapping as cm
from backend.services import progress as progress_svc
from backend.services import lecture_data


def _fmt_clock(seconds) -> str:
    try:
        seconds = max(0.0, float(seconds))
        mm, ss = divmod(int(seconds), 60)
        return f"{mm:02d}:{ss:02d}"
    except (TypeError, ValueError):
        return ""


# ---------------------------------------------------------------------------
# Lecture-level modality gaps (from the knowledge graph)
# ---------------------------------------------------------------------------

def _gap_for(concept: dict, job_id: str) -> dict | None:
    """Return a lecture-level gap object for a concept, or None if covered."""
    status = concept.get("status")
    label = concept.get("label")
    kinds: list[str] = []
    reason: list[str] = []

    if status == kg.STATUS_ASSESSED and not concept.get("speech_count") \
            and not concept.get("visual_count"):
        kinds.append("assessed_but_not_explained")
        reason.append("The quiz assesses this concept, but no lecture speech or "
                      "readable on-screen evidence explains it.")
    elif status == kg.STATUS_UNKNOWN:
        kinds.append("unknown")
        reason.append("No lecture evidence could be found that explains or shows "
                      "this concept.")
    elif status == kg.STATUS_MISSING_EXPLANATION:
        kinds.append("missing_explanation")
        reason.append("This concept is referenced but not explained by grounded evidence.")
    elif status == kg.STATUS_VISUALLY_SHOWN and not concept.get("assessed"):
        # Strictly, VISUALLY_SHOWN means only unverified/OCR-shown, no speech.
        if not concept.get("speech_count"):
            kinds.append("visual_only")
            reason.append("The concept appears in on-screen content but is not "
                          "explained in speech; a screen reader may miss it.")
    else:
        return None

    # Where exactly is the related evidence, if any?
    refs = []
    for ev in concept.get("visual") or []:
        refs.append({
            "kind": "visual", "event_id": ev.get("event_id"),
            "timestamp": ev.get("timestamp"), "ts": ev.get("ts"),
            "snippet": ev.get("snippet"),
        })
    for a in concept.get("assessment") or []:
        refs.append({
            "kind": "assessment", "question": a.get("question"),
            "timestamp": a.get("timestamp"), "ts": _fmt_clock(a.get("timestamp")),
        })

    return {
        "concept_id": concept.get("concept_id"),
        "concept": label,
        "status": status,
        "source": concept.get("source"),
        "assessed": concept.get("assessed"),
        "kinds": kinds,
        "reason": reason,
        "speech_count": concept.get("speech_count", 0),
        "visual_count": concept.get("visual_count", 0),
        "assessment_count": concept.get("assessment_count", 0),
        "related_evidence": refs,
        "timestamp": concept.get("first_timestamp"),
    }


def lecture_gaps(job_id: str) -> dict:
    """Detect lecture-level modality / explanation gaps for one lecture."""
    job = storage.get_job(job_id)
    graph = kg.build_graph(job)
    gaps = [g for g in (_gap_for(c, job_id) for c in graph["concepts"]) if g]

    # Only an "assessment" gap is truly critical if the concept is assessed.
    critical = [g for g in gaps if "assessed_but_not_explained" in g["kinds"]
                or "unknown" in g["kinds"] or "missing_explanation" in g["kinds"]]
    gaps.sort(key=lambda g: (0 if g["assessed"] else 1,
                             -len(g["kinds"])))

    return {
        "lecture_id": job_id,
        "concepts_reviewed": len(graph["concepts"]),
        "gap_count": len(gaps),
        "critical_gap_count": len(critical),
        "gaps": gaps,
        "coverage": {
            "concepts_total": len(graph["concepts"]),
            "concepts_covered": len(graph["concepts"]) - len(gaps),
            "assessed_and_explained": sum(
                1 for c in graph["concepts"]
                if c["assessed"] and (c["speech_count"] or c["visual_count"])),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "based_on_history": False,
    }


# ---------------------------------------------------------------------------
# Student-level mastery gaps (from real quiz attempts)
# ---------------------------------------------------------------------------

def student_gaps(student_id: str, job_id: str | None = None,
                 history: dict | None = None) -> dict:
    """Gaps from the student's actual quiz results.

    Weak concepts (answered wrong at least once) are resolved to their real
    lecture evidence moments so each gap carries a concrete "where to restudy".
    """
    history = history or progress_svc._load_history(student_id)
    attempts = [a for a in history.get("attempts", []) if isinstance(a, dict)]
    if not attempts:
        return {
            "student_id": student_id,
            "gap_count": 0,
            "based_on_history": True,
            "gaps": [],
            "note": "Not enough learning history yet to detect mastery gaps. "
                    "Complete a quiz to build your profile.",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    stats = progress_svc._topic_stats(attempts)
    weak = sorted(
        (t for t, s in stats.items() if s["wrong"]),
        key=lambda t: (stats[t]["wrong"] - stats[t]["correct"]),
    )

    gaps: list[dict] = []
    for topic in weak[:8]:
        s = stats[topic]
        # Resolve to a real evidence moment via the most recent missed attempt.
        quiz_id = None
        for a in reversed(attempts):
            if any(str(q.get("concept")) == topic and not q.get("correct")
                   for q in a.get("questions", [])):
                quiz_id = a.get("quiz_id")
                break
        ts, source = None, "no matching attempt"
        if quiz_id:
            ts, source = progress_svc._resolve_timestamp(quiz_id, topic)

        missed = []
        for a in attempts:
            for q in a.get("questions", []):
                if str(q.get("concept")) == topic and not q.get("correct"):
                    text = str(q.get("question", "")).strip()
                    if text and text not in [m["question"] for m in missed]:
                        missed.append({"question": text})
        gaps.append({
            "concept": topic,
            "concept_id": kg._slug(topic),
            "correct": s["correct"],
            "total": s["total"],
            "accuracy": round(s["correct"] / s["total"], 2),
            "wrong": s["wrong"],
            "type": "weak_topic",
            "recommended_evidence": {"timestamp": round(ts, 2) if ts is not None else None,
                                     "ts": _fmt_clock(ts) if ts is not None else None,
                                     "source": source},
            "missed_questions": missed,
            "quiz_id": quiz_id,
        })

    gaps.sort(key=lambda g: g["wrong"] - g["correct"])
    return {
        "student_id": student_id,
        "gap_count": len(gaps),
        "based_on_history": True,
        "gaps": gaps,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Explain a (possibly missing / weakly covered) concept
# ---------------------------------------------------------------------------

def explain_missing_concept(concept: str, job_id: str) -> dict:
    """Honestly explain a concept from the lecture's real evidence.

    Gathers the concept's speech moments, visual events and assessment
    references, then returns a grounded verdict:
      - fully covered when strong speech (and verified visual) exist,
      - partially covered when only one modality carries it,
      - not covered when no grounded evidence mentions it at all.
    """
    job = storage.get_job(job_id)
    data = kg._load(job)
    segments = data["segments"]
    events = data["events"]
    analysis = data["analysis"]

    speech = kg.map_concept_to_speech(concept, segments)
    visual = kg.map_concept_to_visual(concept, events, analysis)
    assessed = concept.lower() in {str(c.get("concept", "")).lower()
                                   for c in kg._load_quiz(job_id)}
    status, reasons = kg.concept_status(concept, speech, visual, assessed)

    verified = [v for v in visual if v.get("trust") == "VERIFIED"]
    unverified = [v for v in visual if v.get("trust") != "VERIFIED"]

    # Groups a coherent spoken explanation: contiguous segments about this concept.
    spoken = []
    if speech:
        spoken = [{
            "segment_id": s["segment_id"], "timestamp": s["timestamp"],
            "ts": s["ts"], "start": s["start"], "end": s["end"],
            "snippet": s["snippet"],
        } for s in speech]

    shown = []
    for v in verified:
        shown.append({"event_id": v["event_id"], "timestamp": v["timestamp"],
                      "ts": v["ts"], "snippet": v["snippet"],
                      "visual_type": v.get("visual_type")})
    for v in unverified:
        shown.append({"event_id": v["event_id"], "timestamp": v["timestamp"],
                      "ts": v["ts"], "snippet": v["snippet"],
                      "visual_type": v.get("visual_type"),
                      "unverified": True})

    if status == kg.STATUS_EXPLAINED or status == kg.STATUS_PARTIALLY_EXPLAINED:
        headline = (f"'{concept}' is explained in this lecture's spoken "
                    "transcript" + (" and shown on screen." if verified else "."))
    elif status == kg.STATUS_VISUALLY_SHOWN:
        headline = (f"'{concept}' appears on screen but is not explained in "
                    "speech; it is shown, not taught aloud.")
    elif status == kg.STATUS_ASSESSED:
        headline = (f"'{concept}' is assessed by a quiz question, but the "
                    "lecture evidence does not explain it in speech.")
    else:
        headline = (f"No lecture evidence was found that explains or shows "
                    f"'{concept}'.")

    return {
        "concept": concept,
        "concept_id": kg._slug(concept),
        "lecture_id": job_id,
        "status": status,
        "headline": headline,
        "covered": status in (kg.STATUS_EXPLAINED, kg.STATUS_PARTIALLY_EXPLAINED),
        "partial": status in (kg.STATUS_VISUALLY_SHOWN,),
        "not_covered": status in (kg.STATUS_ASSESSED, kg.STATUS_UNKNOWN,
                                  kg.STATUS_MISSING_EXPLANATION),
        "reasons": reasons,
        "spoken": spoken,
        "shown": shown,
        "assessed": assessed,
        "closest_covered": _closest_covered_concepts(concept, job),
    }


def _closest_covered_concepts(concept: str, job: dict) -> list[dict]:
    """Concepts the lecturer *did* explain, to point a struggling learner at."""
    graph = kg.build_graph(job)
    out = []
    for c in graph["concepts"]:
        if c["label"].lower() == concept.lower():
            continue
        if c["status"] in (kg.STATUS_EXPLAINED, kg.STATUS_PARTIALLY_EXPLAINED):
            out.append({
                "concept": c["label"],
                "concept_id": c["concept_id"],
                "status": c["status"],
                "timestamp": c.get("first_timestamp"),
                "ts": _fmt_clock(c.get("first_timestamp")),
            })
    return out[:5]
