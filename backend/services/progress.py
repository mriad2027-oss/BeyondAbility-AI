"""Smart Learning Progress (Priority 4, Feature #6).

Computes a learner progress view strictly from the per-student history file
that quiz grading persists -- attempts, per-question correctness, concepts,
difficulty and timestamps. It never fabricates analytics: strong/weak topics
come from real question results, "repeatedly missed" from questions missed in
2+ attempts, and the suggested next action resolves the weakest concept back to
a real timestamp in the lecture's stored evidence when possible.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from backend import config, storage
from backend.services import accessibility, lecture_data


def _load_history(student_id: str) -> dict:
    default = {
        "current_level": "medium", "previous_scores": [], "weak_topics": [],
        "strong_topics": [], "attempts": [], "recent_activity": [],
    }
    path = config.STUDENTS_DIR / f"{student_id}_history.json"
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                default.update(raw)
        except (OSError, ValueError):
            pass
    return default


def _fmt_clock(seconds) -> str:
    try:
        seconds = max(0.0, float(seconds))
        mm, ss = divmod(int(seconds), 60)
        return f"{mm:02d}:{ss:02d}"
    except (TypeError, ValueError):
        return ""


def _topic_stats(attempts: list[dict]) -> dict[str, dict]:
    """Aggregate real per-question results into per-concept stats."""
    stats: dict[str, dict] = {}
    for attempt in attempts or []:
        for q in (attempt.get("questions") or []):
            concept = str(q.get("concept") or "general")
            s = stats.setdefault(concept, {"correct": 0, "total": 0, "wrong": 0})
            s["total"] += 1
            if q.get("correct"):
                s["correct"] += 1
            else:
                s["wrong"] += 1
    return stats


def _resolve_timestamp(quiz_id: str, concept: str | None) -> tuple[float | None, str]:
    """Map a quiz question's references to a real evidence timestamp.

    quiz_id is normally '<job_id>_quiz'; we read the quiz JSON, find the first
    question of this concept (or the quiz's first question), then resolve its
    segment/event refs through the lecture data loaders. Returns
    (timestamp|None, evidence_label).
    """
    try:
        quiz = json.loads((config.QUIZZES_DIR / f"{quiz_id}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None, "quiz file unavailable"

    if not isinstance(quiz, list) or not quiz:
        return None, "quiz file empty"

    target = next((q for q in quiz if concept and str(q.get("concept")) == concept), quiz[0])
    refs = target.get("source_refs") or {}

    job_id = quiz_id
    if job_id.endswith("_quiz"):
        job_id = job_id[: -len("_quiz")]
    try:
        job = storage.get_job(job_id)
    except Exception:
        return None, "no lecture job for this quiz"

    result = job.get("result") or {}
    segments = lecture_data.load_segments(job, result)
    events = lecture_data.load_visual_events(job, result)

    for seg_ref in refs.get("transcript_segments", []):
        for seg in segments:
            if str(seg.get("id")) == str(seg_ref):
                return float(seg.get("start", 0.0)), f"segment {seg_ref}"
    for ev_ref in refs.get("visual_events", []):
        for ev in events:
            if str(ev.get("event_id")) == str(ev_ref):
                return float(ev.get("start", 0.0)), f"visual event {ev_ref}"
    # Index fallback for legacy numeric refs.
    try:
        idx = refs.get("transcript_segments", [None])[0]
        if isinstance(idx, int) and 0 <= idx < len(segments):
            return float(segments[idx].get("start", 0.0)), f"segment {idx}"
    except (TypeError, IndexError):
        pass
    return None, "no resolvable refs"


def build_progress(student_id: str) -> dict:
    """Learner progress view computed from stored history only."""
    history = _load_history(student_id)
    attempts = [a for a in history.get("attempts", []) if isinstance(a, dict)]
    scores = [s for s in history.get("previous_scores", []) if isinstance(s, (int, float))]
    stats = _topic_stats(attempts)

    strong = [t for t, s in sorted(stats.items())
              if s["total"] and (s["correct"] / s["total"]) >= 0.7]

    def _missed_questions(concept: str) -> list[str]:
        out: list[str] = []
        for a in attempts:
            for q in a.get("questions", []):
                if str(q.get("concept")) == concept and not q.get("correct"):
                    text = str(q.get("question", "")).strip()
                    if text and text not in out:
                        out.append(text)
        return out[:6]

    needs_review = [{
        "topic": t,
        "score": round(s["correct"] / s["total"], 2),
        "correct": s["correct"], "total": s["total"],
        "missed_questions": _missed_questions(t),
    } for t, s in sorted(stats.items()) if s["wrong"]]
    needs_review.sort(key=lambda x: x["score"])

    # Repeatedly missed questions: same question text wrong in 2+ attempts.
    missed_counts: dict[tuple, dict] = {}
    for a in attempts:
        seen: set[str] = set()
        for q in a.get("questions", []):
            text = str(q.get("question", "")).strip()
            if not text or text in seen:
                continue
            seen.add(text)
            entry = missed_counts.setdefault((text, str(q.get("concept"))),
                                             {"times_missed": 0, "times_seen": 0})
            entry["times_seen"] += 1
            if not q.get("correct"):
                entry["times_missed"] += 1
    repeatedly_missed = [
        {"question": text, "concept": concept, "times_missed": info["times_missed"],
         "times_seen": info["times_seen"]}
        for (text, concept), info in missed_counts.items()
        if info["times_missed"] >= 2
    ]

    # Lecture history: each distinct quiz appears once with rollups.
    lecture_map: dict[str, dict] = {}
    for a in attempts:
        qid = str(a.get("quiz_id", ""))
        entry = lecture_map.setdefault(qid, {
            "quiz_id": qid,
            "lecture": a.get("lesson_title") or qid,
            "attempts": 0, "last_score": None, "best_score": None,
            "total_questions": 0, "answered_questions": 0,
            "first_attempt": a.get("timestamp"), "last_attempt": a.get("timestamp"),
        })
        entry["attempts"] += 1
        entry["total_questions"] += len(a.get("questions") or [])
        entry["answered_questions"] += len(a.get("questions") or [])
        first = entry["first_attempt"]
        if not first and a.get("timestamp"):
            entry["first_attempt"] = a.get("timestamp")
        entry["last_attempt"] = a.get("timestamp") or entry["last_attempt"]
        sc = a.get("score_percent")
        if isinstance(sc, (int, float)):
            entry["last_score"] = sc
            entry["best_score"] = sc if entry["best_score"] is None else max(entry["best_score"], sc)
    lecture_history = sorted(lecture_map.values(), key=lambda x: -x["attempts"])
    for entry in lecture_history:
        entry["title"] = entry["lecture"]
        entry["last_score_percent"] = entry["last_score"]

    # Next action: grounded in the weakest concept's evidence when possible.
    profile = accessibility.load_student_profile(student_id)
    next_action = {"text": "", "grounded_on": None, "timestamp": None, "source": ""}
    if not attempts:
        next_action = {
            "text": "Complete a quiz for a processed lecture to build your progress history.",
            "grounded_on": True,
            "timestamp": None,
            "source": "no history yet",
        }
    elif needs_review:
        weakest = needs_review[0]
        # Most recent attempt that missed this topic -> its quiz.
        target_quiz = None
        for a in reversed(attempts):
            if any(str(q.get("concept")) == weakest["topic"] and not q.get("correct")
                   for q in a.get("questions", [])):
                target_quiz = a.get("quiz_id")
                break
        if target_quiz:
            ts, source = _resolve_timestamp(target_quiz, weakest["topic"])
        else:
            ts, source = None, "no matching attempt"
        if ts is not None:
            next_action = {
                "text": (f"Review the {weakest['topic']} material around {_fmt_clock(ts)} "
                         f"and retry the quiz."),
                "grounded_on": True,
                "timestamp": round(ts, 2),
                "source": source,
            }
        else:
            next_action = {
                "text": (f"Review the {weakest['topic']} concept (revision quiz available) and "
                         "retry the quiz. The evidence moment could not be pinned in this lecture."),
                "grounded_on": False,
                "timestamp": None,
                "source": source,
            }
    else:
        next_action = {
            "text": ("You have mastered every assessed concept. Try the next lecture or a "
                     "harder difficulty to keep improving."),
            "grounded_on": True,
            "timestamp": None,
            "source": "all assessed concepts at mastery",
        }
    next_action["suggested"] = next_action["text"]
    next_action["fallback"] = next_action["text"] if not next_action["grounded_on"] else ""

    return {
        "student_id": student_id,
        "summary": {
            "attempts": len(attempts),
            "lectures_attempted": len(attempts),
            "completed_lectures": len(scores) or len(lecture_map),
            "average_score": round(sum(scores) / len(scores), 1) if scores else 0.0,
            "current_difficulty": history.get("current_level", "medium"),
            "accessibility_mode": profile.get("accessibility_mode", "default"),
            "strong_topics": strong,
            "based_on_history": True,
        },
        "strong_topics": [
            {"topic": t, "score": round(stats[t]["correct"] / stats[t]["total"] * 100, 1)}
            for t in strong
        ],
        "needs_review": needs_review,
        "repeatedly_missed": repeatedly_missed,
        "lecture_history": lecture_history,
        "score_history": scores,
        "next_action": next_action,
    }


def record_progress_view(student_id: str, mode_query: str | None = None) -> dict:
    """Small wrapper used by the route: honours an optional mode override."""
    payload = build_progress(student_id)
    if mode_query:
        payload["summary"]["accessibility_mode"] = accessibility.normalize_mode(mode_query)
    payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    return payload