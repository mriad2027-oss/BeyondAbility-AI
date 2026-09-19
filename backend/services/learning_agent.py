"""Personal Learning Agent + Next Best Action
(Intelligent Multimodal Learning Engine, feature #5).

The agent reasons **only over real, stored data** -- the student's profile and
their graded quiz attempts -- and turns that into grounded, actionable study
recommendations. It never claims facts about what a student knows that the
history file does not support.

Every recommended action carries:

    action_type : one of REVIEW_VIDEO / LISTEN_TO_AUDIO_DESCRIPTION /
                  READ_TRANSCRIPT / REVIEW_VISUAL / EXPLAIN_CONCEPT /
                  RETAKE_QUIZ / PRACTICE_CONCEPT
    lecture_id / concept / timestamp(ts) -- a real place to act, when knowable
    reasoning   : the real evidence (accuracy, trend, access need) behind it
    grounded_on : whether the action pins a concrete lecture moment

When the learner has no quiz history yet, the agent is honest about it instead
of inventing a fictional profile.
"""
from __future__ import annotations

from datetime import datetime, timezone

from backend import config, storage
from backend.services import progress as progress_svc
from backend.services import accessibility, knowledge_graph as kg


ACTION = {
    "REVIEW_VIDEO": "REVIEW_VIDEO",
    "LISTEN": "LISTEN_TO_AUDIO_DESCRIPTION",
    "READ_TRANSCRIPT": "READ_TRANSCRIPT",
    "REVIEW_VISUAL": "REVIEW_VISUAL",
    "EXPLAIN_CONCEPT": "EXPLAIN_CONCEPT",
    "RETAKE_QUIZ": "RETAKE_QUIZ",
    "PRACTICE_CONCEPT": "PRACTICE_CONCEPT",
}

# preferred action per accessibility need (audio-first for blind, captions for
# deaf, both for low vision).
_ACCESS_PREFERENCE = {
    "blind": ACTION["LISTEN"],
    "low_vision": ACTION["REVIEW_VISUAL"],
    "deaf": ACTION["READ_TRANSCRIPT"],
    "default": ACTION["REVIEW_VIDEO"],
}


def _fmt_clock(seconds):
    try:
        seconds = max(0.0, float(seconds))
        mm, ss = divmod(int(seconds), 60)
        return f"{mm:02d}:{ss:02d}"
    except (TypeError, ValueError):
        return ""


def _audio_available(job: dict) -> bool:
    """True when the lecture has a real audio file to listen to."""
    try:
        stem = job.get("video_path", "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        stem = stem.rsplit(".", 1)[0] if "." in stem else stem
        for ext in (".wav", ".mp3", ".ogg"):
            if (config.AUDIO_DIR / f"{stem}{ext}").exists():
                return True
    except Exception:
        return False
    return False


def _weakest_concept(attempts: list[dict]) -> dict | None:
    """Real weakest concept: most answers wrong across the student's attempts."""
    stats = progress_svc._topic_stats(attempts)
    wrong = {t: (s["wrong"] - s["correct"]) for t, s in stats.items() if s["wrong"]}
    if not wrong:
        return None
    topic = max(wrong, key=lambda t: wrong[t])
    s = stats[topic]
    return {"topic": topic, "accuracy": round(s["correct"] / s["total"], 2),
            "correct": s["correct"], "total": s["total"], "wrong": s["wrong"]}


def _trend(previous_scores: list) -> str:
    """Honest trend from the real score history (last 2-3 entries)."""
    scores = [s for s in previous_scores if isinstance(s, (int, float))]
    if len(scores) < 2:
        return "new" if len(scores) == 1 else "none"
    recent = scores[-3:]
    if recent[-1] < recent[0]:
        return "declining"
    if recent[-1] > recent[0]:
        return "improving"
    return "flat"


def _explained_in_speech(job: dict, concept: str) -> bool:
    """Whether a concept is actually explained aloud in the lecture transcript."""
    try:
        data = kg._load(job)
        speech = kg.map_concept_to_speech(concept, data["segments"])
        return bool(speech)
    except Exception:
        return False


def _resolve_for(weakest: dict, lecture: dict, quiz_id: str | None, job: dict):
    """Resolve the weakest concept to a real, evidence-backed study moment."""
    ts, source = progress_svc._resolve_timestamp(quiz_id, weakest["topic"]) \
        if quiz_id else (None, "no quiz attempt with source refs")
    explained = _explained_in_speech(job, weakest["topic"]) if job else False
    return {
        "concept": weakest["topic"],
        "concept_id": kg._slug(weakest["topic"]),
        "accuracy": weakest["accuracy"],
        "lecture_id": lecture,
        "timestamp": round(ts, 2) if ts is not None else None,
        "ts": _fmt_clock(ts) if ts is not None else None,
        "source": source,
        "explained_in_speech": explained,
    }


def build_personal_agent(student_id: str) -> dict:
    """Full Personal Learning Agent view for a student, from real data only."""
    history = progress_svc._load_history(student_id)
    profile = accessibility.load_student_profile(student_id)
    attempts = [a for a in history.get("attempts", []) if isinstance(a, dict)]
    scores = history.get("previous_scores") or []
    has_history = len(attempts) > 0

    access = profile.get("accessibility_mode", "default")
    need = profile.get("accessibility_need", "none")

    insights: list[dict] = []

    if not has_history:
        insights.append({
            "kind": "insufficient_history",
            "text": "Not enough learning history yet to personalize recommendations. "
                    "Complete a quiz for a processed lecture to build your learning profile.",
        })
    else:
        # 1) mastery summary (from real per-question results)
        stats = progress_svc._topic_stats(attempts)
        mastered = [t for t, s in stats.items()
                    if s["total"] and (s["correct"] / s["total"]) >= 0.7]
        needs_work = sorted(
            (t for t, s in stats.items() if s["wrong"]),
            key=lambda t: stats[t]["wrong"] - stats[t]["correct"])
        insights.append({
            "kind": "mastery",
            "text": (f"You have mastered {len(mastered)} concept(s) and have "
                     f"{len(needs_work)} concept(s) that need more work, based on "
                     "your quiz results."),
            "mastered": mastered,
            "needs_work": needs_work,
        })
        # 2) trend (real score history)
        trend = _trend(scores)
        if trend != "none":
            words = {"improving": "Your recent scores are improving.",
                     "declining": "Your recent scores are slipping.",
                     "flat": "Your recent scores are holding steady."}
            insights.append({"kind": "trend", "text": words[trend], "trend": trend})
        # 3) access-aware note
        if need != "none":
            pref = _ACCESS_PREFERENCE.get(access, ACTION["REVIEW_VIDEO"])
            insights.append({
                "kind": "accessibility",
                "text": (f"Your accessibility preference ({access}) is factored into "
                         "every recommended action."),
                "preferred_action": pref,
            })

    recommended: list[dict] = []
    if not has_history:
        recommended.append({
            "action_type": ACTION["PRACTICE_CONCEPT"],
            "label": "Complete your first quiz",
            "reasoning": "No graded attempts exist yet, so the next step is to "
                         "complete a quiz and begin building your learning profile.",
            "lecture_id": None, "concept": None, "timestamp": None, "ts": None,
            "grounded_on": False, "priority": 1,
        })
    else:
        weakest = _weakest_concept(attempts)
        # Most recent quiz the student touched.
        quiz_id = attempts[-1].get("quiz_id")
        lecture = attempts[-1].get("lesson_title") or quiz_id
        job = None
        if quiz_id and quiz_id.endswith("_quiz"):
            try:
                job = storage.get_job(quiz_id[: -len("_quiz")])
            except Exception:
                job = None

        if weakest and job is not None:
            r = _resolve_for(weakest, lecture, quiz_id, job)
            access = profile.get("accessibility_mode", "default")
            preferred = _ACCESS_PREFERENCE.get(access, ACTION["REVIEW_VIDEO"])

            if not r["explained_in_speech"]:
                # Visual-only / missing -> explain it (the honest corrective action).
                recommended.append({
                    "action_type": ACTION["EXPLAIN_CONCEPT"],
                    "label": f"Explain '{r['concept']}' from the lecture evidence",
                    "reasoning": (f"'{r['concept']}' is a weak area (accuracy "
                                  f"{int(r['accuracy'] * 100)}%) and is not spoken "
                                  "aloud in the transcript, so a clear spoken "
                                  "explanation targets the gap directly."),
                    **r, "grounded_on": r["timestamp"] is not None, "priority": 1,
                })
            elif preferred == ACTION["REVIEW_VISUAL"]:
                recommended.append({
                    "action_type": ACTION["REVIEW_VISUAL"],
                    "label": f"Review the on-screen visuals for '{r['concept']}'",
                    "reasoning": (f"'{r['concept']}' is weak (accuracy "
                                  f"{int(r['accuracy'] * 100)}%) and your low-vision "
                                  "preference favors screen visuals."),
                    **r, "grounded_on": r["timestamp"] is not None, "priority": 1,
                })
            else:
                recommended.append({
                    "action_type": ACTION["REVIEW_VIDEO"],
                    "label": f"Review '{r['concept']}' around {r['ts'] or 'start'}",
                    "reasoning": (f"'{r['concept']}' is your weakest area (accuracy "
                                  f"{int(r['accuracy'] * 100)}%); re-watching the "
                                  "moment that teaches it reinforces it."),
                    **r, "grounded_on": r["timestamp"] is not None, "priority": 1,
                })
            # secondary: retake quiz when a quiz exists for this lecture
            recommended.append({
                "action_type": ACTION["RETAKE_QUIZ"],
                "label": f"Retake the '{lecture}' quiz",
                "reasoning": "Retesting consolidates the weak concept after review.",
                "lecture_id": lecture, "concept": r["concept"],
                "concept_id": r["concept_id"],
                "timestamp": None, "ts": None,
                "grounded_on": False, "priority": 2,
            })
            if _audio_available(job) and r["timestamp"] is not None:
                recommended.append({
                    "action_type": ACTION["LISTEN"],
                    "label": f"Listen to the audio description near {r['ts']}",
                    "reasoning": "Reinforce by listening to the narrated lecture "
                                 "at this moment.",
                    "lecture_id": lecture, "concept": r["concept"],
                    "concept_id": r["concept_id"],
                    "timestamp": r["timestamp"], "ts": r["ts"],
                    "grounded_on": True, "priority": 3,
                })
            recommended.append({
                "action_type": ACTION["READ_TRANSCRIPT"],
                "label": "Read the transcript for this lecture",
                "reasoning": "Reading the transcript is always available and helps "
                             "re-ground the weak concept in its spoken context.",
                "lecture_id": lecture, "concept": r["concept"],
                "concept_id": r["concept_id"],
                "timestamp": None, "ts": None,
                "grounded_on": False, "priority": 4,
            })
        elif weakest:
            # We know the weak concept but could not attach to a lecture job.
            recommended.append({
                "action_type": ACTION["EXPLAIN_CONCEPT"],
                "label": f"Explain '{weakest['topic']}'",
                "reasoning": (f"'{weakest['topic']}' is a weak concept (accuracy "
                              f"{int(weakest['accuracy'] * 100)}%) that could not "
                              "be pinned to a lecture job in your history."),
                "concept": weakest["topic"], "concept_id": kg._slug(weakest["topic"]),
                "lecture_id": None, "timestamp": None, "ts": None,
                "grounded_on": False, "priority": 1,
            })
        else:
            recommended.append({
                "action_type": ACTION["REVIEW_VIDEO"],
                "label": "You have mastered all assessed concepts",
                "reasoning": "Every assessed concept is at mastery from your quiz "
                             "history -- advance to a new lecture or a harder "
                             "difficulty.",
                "lecture_id": None, "concept": None, "timestamp": None, "ts": None,
                "grounded_on": False, "priority": 1,
            })

    return {
        "student_id": student_id,
        "profile": profile,
        "has_history": has_history,
        "insights": insights,
        "recommended_actions": recommended,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def next_action(student_id: str) -> dict:
    """Return the single best next best action (Personal Learning Agent core)."""
    agent = build_personal_agent(student_id)
    if not agent["recommended_actions"]:
        return {
            "student_id": student_id,
            "action_type": None,
            "label": "Not enough learning history yet.",
            "reasoning": "Complete a quiz for a processed lecture to begin "
                         "personalized recommendations.",
            "grounded_on": False,
            "insufficient_history": True,
        }
    best = agent["recommended_actions"][0]
    return {
        "student_id": student_id,
        "action_type": best["action_type"],
        "label": best["label"],
        "reasoning": best["reasoning"],
        "lecture_id": best.get("lecture_id"),
        "concept": best.get("concept"),
        "concept_id": best.get("concept_id"),
        "timestamp": best.get("timestamp"),
        "ts": best.get("ts"),
        "grounded_on": best.get("grounded_on", False),
        "insufficient_history": not agent["has_history"],
    }
