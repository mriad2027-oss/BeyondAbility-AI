"""Shared fixtures for the EduAccess AI API-level tests.

These helpers create *synthetic* completed jobs in the JSON job store and a
matching quiz on disk, and always clean up after themselves.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from backend import config, storage

_SAMPLE_SEGMENTS = [
    {"id": "seg_001", "start": 0.0, "end": 4.0, "text": "Now we create a Python variable."},
    {"id": "seg_002", "start": 4.5, "end": 9.0, "text": "Loops repeat a block of code."},
]

_SAMPLE_EVENTS = [
    {
        "event_id": "event_001",
        "start": 0.0,
        "end": 4.0,
        "type": "code",
        "description": "A code editor shows the assignment: name equals Omnya.",
        "transcript_context": "Now we create a Python variable.",
        "confidence": 0.92,
        "source_frames": ["frame_0000.jpg"],
        "source_refs": {"visual_events": ["event_001"], "transcript_segments": ["seg_001"]},
    },
    {
        "event_id": "event_002",
        "start": 4.5,
        "end": 9.0,
        "type": "diagram",
        "description": "A stack diagram shows three elements, newest on top.",
        "transcript_context": "Loops repeat a block of code.",
        "confidence": 0.6,
        "source_frames": ["frame_0001.jpg"],
        "source_refs": {"visual_events": ["event_002"], "transcript_segments": ["seg_002"]},
    },
]


class LectureFixtureResult(tuple):
    """2-tuple (job_id, job) that also supports dict-like key access for tests."""

    def __new__(cls, job_id: str, job: dict):
        return super().__new__(cls, (job_id, job))

    def __getitem__(self, item):
        if isinstance(item, str):
            if item == "lecture":
                from backend.types import (
                    Lecture,
                    Transcript,
                    AccessibilityEvent,
                    AccessibilityDifference,
                    EvidenceRecord,
                )
                result = self[1].get("result") or {}
                transcript = Transcript(
                    text=result.get("transcript_text", ""),
                    segments=result.get("segments", []),
                )
                acc_events = [
                    AccessibilityEvent(
                        segment_id=e.get("segment_id", ""),
                        event_id=e.get("event_id", ""),
                        start=e.get("start", 0.0),
                        end=e.get("end", 0.0),
                        play_start=e.get("play_start", 0.0),
                        timestamp_start=e.get("start", 0.0),
                        timestamp_end=e.get("end", 0.0),
                        transcript=e.get("transcript", ""),
                        description=e.get("description", ""),
                        title=e.get("description", ""),
                        should_describe=e.get("should_describe", True),
                        priority=e.get("priority", "medium"),
                        importance=e.get("importance", 0.5),
                        reason=e.get("reason", ""),
                        confidence=e.get("confidence", 1.0),
                        status="unresolved",
                        coverage_ratio=0.0,
                        narration_audio_path=e.get("narration_audio_path"),
                        source_refs=e.get("source_refs", {}),
                    )
                    for e in result.get("accessibility_events", [])
                ]
                return Lecture(
                    job_id=self[0],
                    video_path=self[1].get("video_path", ""),
                    filename=self[1].get("filename", ""),
                    transcript=transcript,
                    visual_events=result.get("visual_events", []),
                    ocr_events=[],
                    accessibility_events=acc_events,
                    differences=[],
                    evidence=[],
                    video_metadata=result.get("video_metadata", {}),
                    result=result,
                )
            if item == "job_id":
                return self[0]
            if item == "job":
                return self[1]
            return self[1].get(item)
        return super().__getitem__(item)


def register_lecture(job_id: str | None = None) -> tuple[str, dict]:
    """Create a completed lecture job in storage. Returns (job_id, blueprint)."""
    job_id = job_id or f"fixture_{uuid.uuid4().hex[:10]}"
    stem = f"fixture_video_{uuid.uuid4().hex[:6]}"
    video_path = str(config.VIDEOS_DIR / f"{stem}.mp4")

    segment_events = []
    for seg, ev in zip(_SAMPLE_SEGMENTS, _SAMPLE_EVENTS):
        segment_events.append({
            "segment_id": seg["id"],
            "start": seg["start"], "end": seg["end"],
            "play_start": seg["end"],
            "transcript": seg["text"],
            "description": ev["description"],
            "should_describe": True,
            "priority": "high",
            "importance": 0.8,
            "reason": "Important visual information not safely covered by speech",
            "confidence": ev["confidence"],
            "interrupts_speech": False,
            "source_refs": {"transcript_segments": [seg["id"]], "visual_events": [ev["event_id"]]},
            "source": ["visual_event", "transcript"],
        })

    result = {
        "transcript_text": " Now we create a Python variable. Loops repeat a block of code.",
        "segments": _SAMPLE_SEGMENTS,
        "visual_events": _SAMPLE_EVENTS,
        "accessibility_events": segment_events,
        "captions": [{"id": "seg_001", "start": 0.0, "end": 4.0, "text": "Now we create a Python variable."}],
        "video_metadata": {"duration": 9.0},
        "accessibility_profile": {
            "id": "default", "accessibility_mode": "default", "speech_rate": 1.0,
            "description_detail": "medium", "quiz_difficulty": "adaptive",
        },
        "stage_status": {
            "extract_audio": {"status": "completed", "fallback": "none", "seconds": 0.4},
            "transcribe": {"status": "completed", "fallback": "none", "seconds": 2.1},
            "analyze_video": {"status": "completed", "fallback": "none", "seconds": 3.0},
            "accessibility": {"status": "completed", "fallback": "none", "seconds": 0.2},
            "quiz": {"status": "completed", "fallback": "none", "seconds": 0.3},
        },
    }

    job = {
        "job_id": job_id,
        "video_path": video_path,
        "filename": f"{stem}.mp4",
        "status": "done",
        "progress": 100,
        "current_stage": "completed",
        "error": None,
        "logs": [],
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    path = storage._job_path(job_id)
    path.write_text(json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8")
    return LectureFixtureResult(job_id, job)


def register_quiz(job_id: str) -> str:
    """Create a small quiz on disk tied to a job_id. Returns quiz_id."""
    quiz_id = f"{job_id}_quiz"
    quiz = [
        {
            "question": "What does a Python variable do?",
            "type": "multiple_choice",
            "options": ["Stores data", "Deletes files", "Loops code"],
            "answer": "Stores data",
            "concept": "variables",
            "source_refs": {"transcript_segments": ["seg_001"], "visual_events": ["event_001"]},
        },
        {
            "question": "Loops repeat a block of code. True or False?",
            "type": "true_false",
            "options": ["True", "False"],
            "answer": "True",
            "concept": "loops",
            "source_refs": {"transcript_segments": ["seg_002"], "visual_events": ["event_002"]},
        },
    ]
    path = config.QUIZZES_DIR / f"{quiz_id}.json"
    path.write_text(json.dumps(quiz, indent=2, ensure_ascii=False), encoding="utf-8")
    return quiz_id


def remove_lecture(job_id: str) -> None:
    path = storage._job_path(job_id)
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass
    quiz_path = config.QUIZZES_DIR / f"{job_id}_quiz.json"
    if quiz_path.exists():
        try:
            quiz_path.unlink()
        except OSError:
            pass


def remove_history(student_id: str) -> None:
    path = config.STUDENTS_DIR / f"{student_id}_history.json"
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass


def remove_profile(student_id: str) -> None:
    """Remove a test-created entry from profiles.json (leaves real students)."""
    profiles_path = config.STUDENTS_DIR / "profiles.json"
    if not profiles_path.exists():
        return
    try:
        profiles = json.loads(profiles_path.read_text(encoding="utf-8"))
        if not isinstance(profiles, list):
            return
        filtered = [p for p in profiles if str(p.get("id", p.get("student_id", ""))) != student_id]
        if len(filtered) != len(profiles):
            profiles_path.write_text(json.dumps(filtered, indent=2, ensure_ascii=False), encoding="utf-8")
    except (OSError, ValueError):
        pass


def remove_job(job_id: str) -> None:
    """Remove a job record plus its uploaded video and derived output artifacts."""
    try:
        job = storage.get_job(job_id)
    except Exception:
        job = {}
    video_path = job.get("video_path", "")
    stem = Path(video_path).stem if video_path else job_id
    candidates = [storage._job_path(job_id)]
    if video_path:
        candidates.append(Path(video_path))
    if stem:
        candidates += [p for p in config.OUTPUTS_DIR.glob(f"{stem}*") if p.is_file()]
        candidates += [p for p in config.FRAMES_DIR.glob(f"{stem}*") if p.is_file()]
        candidates.append(config.AUDIO_DIR / f"{stem}.wav")
        candidates.append(config.QUIZZES_DIR / f"{job_id}_quiz.json")
    for path in candidates:
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass