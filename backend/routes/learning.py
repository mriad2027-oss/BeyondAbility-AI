"""Intelligent Multimodal Learning Engine -- API routes.

Exposes the evidence-grounded additions of the intelligent engine, all computed
live from stored lecture evidence and student history (never fabricated):

    GET /lectures/{job_id}/knowledge-graph        feature #1
    GET /lectures/{job_id}/concepts               feature #2 (concept mapping)
    GET /lectures/{job_id}/learning-gaps          feature #3
    GET /lectures/{job_id}/concepts/{c}/explain   feature #4 (explain missing)
    GET /students/{sid}/learning-agent            feature #5 (personal agent)
    GET /students/{sid}/learning-insights         feature #7 (learning insights)
    GET /students/{sid}/next-action               feature #7 (next best action)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend import storage
from backend.services import knowledge_graph as kg
from backend.services import concept_mapping as cm
from backend.services import learning_gaps as gaps
from backend.services import learning_agent as agent

router = APIRouter()


def _require_job(job_id: str) -> dict:
    if not storage.job_exists(job_id):
        raise HTTPException(status_code=404,
                            detail="job_id not found. Upload a video first.")
    return storage.get_job(job_id)


@router.get("/lectures/{job_id}/knowledge-graph")
async def get_knowledge_graph(job_id: str):
    """Lecture Knowledge Graph: concepts mapped to speech + visual + quiz evidence."""
    _require_job(job_id)
    return kg.get_knowledge_graph(job_id)


@router.get("/lectures/{job_id}/concepts")
async def get_concepts(job_id: str):
    """Canonical concept <-> speech <-> visual mapping for a lecture."""
    _require_job(job_id)
    return cm.all_evidence_mappings(job_id)


@router.get("/lectures/{job_id}/learning-gaps")
async def get_lecture_gaps(job_id: str):
    """Lecture-level modality / explanation coverage gaps."""
    _require_job(job_id)
    return gaps.lecture_gaps(job_id)


@router.get("/lectures/{job_id}/concepts/{concept:path}/explain")
async def explain_concept(job_id: str, concept: str):
    """Explain a concept using only the lecture's real evidence."""
    _require_job(job_id)
    if not concept.strip():
        raise HTTPException(status_code=400, detail="concept is required")
    return gaps.explain_missing_concept(concept.strip(), job_id)


@router.get("/lectures/{job_id}/students/{student_id}/learning-gaps")
async def get_student_lecture_gaps(job_id: str, student_id: str):
    """Student-level mastery gaps, resolved back to this lecture's evidence."""
    _require_job(job_id)
    return gaps.student_gaps(student_id, job_id)


@router.get("/students/{student_id}/learning-agent")
async def get_learning_agent(student_id: str):
    """Personal Learning Agent view (real profile + history + recommendations)."""
    return agent.build_personal_agent(student_id)


@router.get("/students/{student_id}/learning-insights")
async def get_learning_insights(student_id: str):
    """Learning insights derived from real quiz history (agent summary)."""
    view = agent.build_personal_agent(student_id)
    return {
        "student_id": student_id,
        "has_history": view["has_history"],
        "insights": view["insights"],
        "recommended_actions": view["recommended_actions"],
        "generated_at": view["generated_at"],
    }


@router.get("/students/{student_id}/next-action")
async def get_next_action(student_id: str):
    """Next Best Action resolved to a real lecture + evidence timestamp."""
    return agent.next_action(student_id)


@router.get("/learning-agent")
async def get_default_learning_agent():
    """Personal Learning Agent for the default student (convenience)."""
    return agent.build_personal_agent("default")


@router.get("/learning-insights")
async def get_default_learning_insights():
    return get_learning_insights("default")


@router.get("/next-action")
async def get_default_next_action():
    return agent.next_action("default")
