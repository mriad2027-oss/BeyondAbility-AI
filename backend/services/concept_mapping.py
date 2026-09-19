"""Concept <-> speech <-> visual mapping (Intelligent Multimodal Learning Engine,
feature #2).

Canonical, evidence-grounded mapping between a lecture's concepts and the two
modalities that carry them:

    concept  --spoken_in-->  transcript segments (speech evidence)
    concept  --shown_by-->   visual events (verified on-screen / OCR evidence)

This is a thin, additive layer that reuses the mapping primitives from
`knowledge_graph` so that the learning-gaps detector, the explain-missing-concept
path and the knowledge-graph endpoint all agree on *how a concept is taught*.
Every mapped reference is backed by a real artifact (segment id / event id with
a timestamp, snippet and trust). A concept is only mapped to a modality where
its evidence actually exists.
"""
from __future__ import annotations

import json
from pathlib import Path

from backend import config, storage
from backend.services import knowledge_graph as kg


def _text(value) -> str:
    return str(value or "").strip()


def _graph_data(job: dict) -> dict:
    return kg._load(job)


def map_concept_to_evidence(concept: str, job: dict | None = None,
                            data: dict | None = None) -> dict:
    """Map a single concept to its speech + visual evidence in a lecture.

    Returns a canonical mapping record:
        {
          "concept": "loop", "concept_id": "...",
          "speech": [...], "visual": [...],
          "has_speech": bool, "has_visual": bool,
          "verified_visual": bool,
          "first_timestamp": float|null
        }
    """
    if job is None and data is None:
        return {"concept": concept, "concept_id": kg._slug(concept),
                "speech": [], "visual": [], "has_speech": False,
                "has_visual": False, "verified_visual": False,
                "first_timestamp": None}
    data = data or _graph_data(job)
    segments = data["segments"]
    events = data["events"]
    analysis = data["analysis"]

    speech = kg.map_concept_to_speech(concept, segments)
    visual = kg.map_concept_to_visual(concept, events, analysis)
    verified_visual = [v for v in visual if v.get("trust") == "VERIFIED"]

    timestamps = [l["timestamp"] for l in speech + visual if l.get("timestamp") is not None]
    return {
        "concept": concept,
        "concept_id": kg._slug(concept),
        "speech": speech,
        "visual": visual,
        "has_speech": bool(speech),
        "has_visual": bool(visual),
        "verified_visual": bool(verified_visual),
        "first_timestamp": round(min(timestamps), 2) if timestamps else None,
    }


def all_evidence_mappings(job_id: str) -> dict:
    """Return the mapping for every concept in a lecture's knowledge graph.

    Convenience for the /concepts and /learning-gaps endpoints: pulls the graph
    (live), then maps each concept to its speech/visual evidence.
    """
    job = storage.get_job(job_id)
    graph = kg.build_graph(job)
    data = _graph_data(job)
    mappings = []
    for cand in graph["concepts"]:
        m = map_concept_to_evidence(cand["label"], job, data)
        m["status"] = cand["status"]
        m["assessed"] = cand["assessed"]
        m["source"] = cand["source"]
        m["assessment_count"] = cand["assessment_count"]
        mappings.append(m)
    return {"job_id": job_id, "concepts": mappings}


def explain_mapping(mapping: dict) -> list[str]:
    """Human-readable 'how is this concept taught' summary from real evidence."""
    lines = []
    speech = mapping.get("speech") or []
    visual = mapping.get("visual") or []
    if speech:
        lines.append(f"Taught in speech across {len(speech)} moment(s) "
                     f"(earliest at {_fmt(speech[0].get('timestamp'))}).")
    if visual:
        verified = sum(1 for v in visual if v.get("trust") == "VERIFIED")
        lines.append(f"Shown on screen across {len(visual)} visual moment(s) "
                     f"({verified} verified).")
    if not speech and not visual:
        lines.append("No lecture evidence was found that teaches this concept.")
    return lines


def _fmt(seconds) -> str:
    try:
        seconds = max(0.0, float(seconds))
        mm, ss = divmod(int(seconds), 60)
        return f"{mm:02d}:{ss:02d}"
    except (TypeError, ValueError):
        return ""
