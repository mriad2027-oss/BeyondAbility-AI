import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from backend import config
from backend.models.schemas import StudentProfileUpdate
from backend.services import accessibility

router = APIRouter()

VALID_MODES = {"blind", "low_vision", "hearing", "standard"}


def _load_history(student_id: str) -> dict:
    default = {
        "current_level": "medium",
        "previous_scores": [],
        "weak_topics": [],
        "strong_topics": [],
        "attempts": [],
        "completed_lectures": 0,
        "average_score": 0.0,
        "recent_activity": [],
    }
    history_path = config.STUDENTS_DIR / f"{student_id}_history.json"
    if history_path.exists():
        try:
            raw = json.loads(history_path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                default.update(raw)
        except Exception:
            pass

    scores = [s for s in default.get("previous_scores", []) if isinstance(s, (int, float))]
    if scores:
        default["completed_lectures"] = len(scores)
        default["average_score"] = round(sum(scores) / len(scores), 1)
    return default


@router.get("/students")
async def list_students():
    """List all known students (from profiles.json plus sane defaults)."""
    profiles_path = config.STUDENTS_DIR / "profiles.json"
    records = []
    if profiles_path.exists():
        try:
            raw = json.loads(profiles_path.read_text(encoding="utf-8"))
            records = raw if isinstance(raw, list) else raw.get("profiles", [])
        except Exception:
            records = []
    students = []
    for rec in records:
        sid = str(rec.get("id", rec.get("student_id", "")))
        if not sid:
            continue
        profile = accessibility.load_student_profile(sid)
        students.append({
            "student_id": sid,
            "name": rec.get("name") or sid,
            "accessibility_mode": profile.get("accessibility_mode", "standard"),
        })
    # Always include the default student.
    if "default" not in [s["student_id"] for s in students]:
        students.append({"student_id": "default", "name": "Default Student", "accessibility_mode": "standard"})
    return {"students": students}


def _normalize_history(history: dict, profile: dict) -> dict:
    history = dict(history)
    scores = [s for s in history.get("previous_scores", []) if isinstance(s, (int, float))]
    weak = history.get("weak_topics", []) or []
    attempts = history.get("attempts", []) or []
    history["completed_lectures"] = len(scores)
    history["average_score"] = round(sum(scores) / len(scores), 1) if scores else 0.0
    # Strong topics: any topic answered correctly in >= 70% of its questions.
    topic_stats = {}
    for attempt in attempts:
        for q in attempt.get("questions", []):
            concept = q.get("concept", "general")
            stats = topic_stats.setdefault(concept, {"correct": 0, "total": 0})
            stats["correct"] += 1 if q.get("correct") else 0
            stats["total"] += 1
    strong = [t for t, s in topic_stats.items() if (s["correct"] / max(1, s["total"])) >= 0.7]
    weak_names = {str(w.get("topic")) for w in weak}
    strong = [t for t in strong if t not in weak_names]
    history["strong_topics"] = strong
    history["recent_activity"] = (history.get("recent_activity") or [])[-10:]
    return history


@router.get("/students/{student_id}")
async def get_student(student_id: str):
    profile = accessibility.load_student_profile(student_id)
    history = _normalize_history(_load_history(student_id), profile)
    return {"student_id": student_id, "profile": profile, "history": history}


@router.get("/students/{student_id}/progress")
async def get_student_progress(student_id: str, mode: str | None = None):
    """Smart Learning Progress (Priority 4 Feature #6).

    Computed strictly from the student's stored history: strong/weak topics,
    repeatedly-missed questions, per-lecture rollups, and a next action that is
    resolved back to a real evidence timestamp where possible. Never fabricated.
    """
    from backend.services.progress import record_progress_view
    return record_progress_view(student_id, mode)


def _upsert_profile(student_id: str, submission: StudentProfileUpdate) -> dict:
    if student_id != submission.student_id:
        raise HTTPException(status_code=400, detail="Student ID mismatch")
    if submission.accessibility_mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Accessibility mode must be one of {sorted(VALID_MODES)}")

    path = config.STUDENTS_DIR / "profiles.json"
    profiles = []
    if path.exists():
        try:
            profiles = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(profiles, list):
                profiles = []
        except Exception:
            profiles = []

    # Persist the canonical accessibility mode so save round-trips exactly with
    # what accessibility.load_student_profile() returns (e.g. upfront
    # "hearing"/"standard" are stored as the canonical "deaf"/"default").
    mode = accessibility.normalize_mode(submission.accessibility_mode)
    if mode == "blind":
        need, preferred = "visual", "audio"
    elif mode == "low_vision":
        need, preferred = "visual", "both"
    elif mode == "deaf":
        need, preferred = "hearing", "captions"
    else:
        need, preferred = "none", "both"

    updated_record = {
        "id": student_id,
        "student_id": student_id,
        "name": submission.name or student_id,
        "accessibility_need": need,
        "preferred_output": preferred,
        "accessibility_mode": mode,
        "speech_rate": submission.speech_rate,
        "description_detail": submission.description_detail,
        "language": submission.preferred_language,
        "preferred_language": submission.preferred_language,
        "quiz_difficulty": submission.quiz_difficulty,
    }

    found = False
    for i, p in enumerate(profiles):
        p_id = str(p.get("id", p.get("student_id", "")))
        if p_id == student_id:
            profiles[i] = {**p, **updated_record}
            found = True
            break
    if not found:
        profiles.append(updated_record)

    path.write_text(json.dumps(profiles, indent=2, ensure_ascii=False), encoding="utf-8")
    return updated_record


@router.post("/students/{student_id}/profile")
async def save_profile(student_id: str, submission: StudentProfileUpdate):
    profile = _upsert_profile(student_id, submission)
    return {"status": "success", "profile": profile}