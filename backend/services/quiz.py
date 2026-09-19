"""
Quiz service: load quizzes, score submitted answers, and produce the
{question, correct} breakdown that llm.generate_quiz_feedback() expects.
Supports semantic grading for short answers, concept weakness tracking,
adaptive difficulty levels, and tutoring recommendations.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from backend import config


def load_quiz(quiz_id: str) -> list[dict]:
    path = config.QUIZZES_DIR / f"{quiz_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Quiz not found: {quiz_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def list_quizzes() -> list[str]:
    return [p.stem for p in config.QUIZZES_DIR.glob("*.json")]


def concept_id(concept: str) -> str:
    """Stable URL-safe concept id (mirrors the knowledge-graph slugger)."""
    s = re.sub(r"[^a-z0-9_\u0600-\u06ff]+", "_", str(concept).strip().lower()).strip("_")
    return s or "general"


def lecture_id_from_quiz(quiz_id: str) -> str | None:
    """Derive the originating lecture job id from a '<job>_quiz' id."""
    if isinstance(quiz_id, str) and quiz_id.endswith("_quiz"):
        return quiz_id[: -len("_quiz")]
    return quiz_id if isinstance(quiz_id, str) else None


def normalize_arabic(text: str) -> str:
    """Normalize Arabic characters to handle common spelling variations."""
    # Remove diacritics (harakat)
    text = re.sub(r'[\u064B-\u0652]', '', text)
    # Normalize Alef
    text = re.sub(r'[إأآ]', 'ا', text)
    # Normalize Tah-Marbuta
    text = re.sub(r'ة', 'ه', text)
    # Normalize Yeh
    text = re.sub(r'ى', 'ي', text)
    # Clean whitespace and lowercase
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text


def evaluate_short_answer_semantic(question: str, student_answer: str, correct_answer: str) -> dict:
    """
    Grade a short answer semantically using LLM, falling back to Jaccard word-overlap.
    """
    student_clean = student_answer.strip()
    is_arabic = any('\u0600' <= c <= '\u06FF' for c in question + student_answer + correct_answer)

    if not student_clean:
        return {
            "correct": False,
            "score": 0.0,
            "feedback": "لم يتم تقديم إجابة." if is_arabic else "No answer provided.",
            "matched_concepts": [],
            "missing_concepts": [correct_answer]
        }

    # 1. Direct normalized match check
    norm_student = normalize_arabic(student_clean)
    norm_correct = normalize_arabic(correct_answer)
    if norm_correct in norm_student or norm_student in norm_correct:
        return {
            "correct": True,
            "score": 1.0,
            "feedback": "إجابة صحيحة ومطابقة للمفهوم!" if is_arabic else "Correct answer, conceptual match!",
            "matched_concepts": [correct_answer],
            "missing_concepts": []
        }

    # 2. Compute basic fallback metrics
    stopwords = {"a", "an", "the", "that", "this", "over", "is", "are", "in", "on", "at", "to", "for", "of", "with", "من", "في", "على", "عن", "ان", "هذا", "هذه"}
    words_student = {w for w in norm_student.split() if w not in stopwords}
    words_correct = {w for w in norm_correct.split() if w not in stopwords}
    if not words_student:
        words_student = set(norm_student.split())
    if not words_correct:
        words_correct = set(norm_correct.split())

    intersection = words_student.intersection(words_correct)
    union = words_student.union(words_correct)
    jaccard = len(intersection) / len(union) if union else 0.0
    recall = len(intersection) / len(words_correct) if words_correct else 0.0

    is_ok = jaccard >= 0.28 or (recall >= 0.4 and len(intersection) >= 2)
    fallback_feedback = (
        "إجابة مقبولة ومفهومة." if is_ok else "الإجابة غير مكتملة أو تفتقد المفهوم الأساسي."
    ) if is_arabic else (
        "Conceptually acceptable answer." if is_ok else "The answer is incomplete or missing the core concept."
    )

    fallback_json = json.dumps({
        "correct": is_ok,
        "score": 1.0 if is_ok else round(jaccard, 2),
        "feedback": fallback_feedback,
        "matched_concepts": list(intersection) if is_ok else [],
        "missing_concepts": list(words_correct - words_student)
    }, ensure_ascii=False)

    # 3. Call LLM for semantic grading
    system_prompt = (
        "You are an educational grader. Your job is to semantically grade a student's short answer "
        "against the correct reference answer.\n"
        "Rules:\n"
        "1. Do NOT require exact word matching.\n"
        "2. Grade correct (true) if the student explains the concept correctly, even with different phrasing.\n"
        "3. Output ONLY a raw JSON object (no markdown backticks) matching this schema:\n"
        "{\n"
        '  "correct": true | false,\n'
        '  "score": float (between 0.0 and 1.0),\n'
        '  "feedback": "natural language feedback in Arabic/English matching the language used by student",\n'
        '  "matched_concepts": ["concept1", ...],\n'
        '  "missing_concepts": ["concept2", ...]\n'
        "}"
    )
    user_prompt = (
        f"Question: {question}\n"
        f"Student Answer: {student_answer}\n"
        f"Correct Reference: {correct_answer}\n"
        "Grade the response now."
    )

    from backend.services import llm
    response = llm.call_llm(system_prompt, user_prompt, fallback_json)

    try:
        from backend.services.vision import clean_json_response
        return clean_json_response(response)
    except Exception:
        return json.loads(fallback_json)


def grade_quiz(quiz_id: str, answers: dict[str, str], student_id: str = "default", lesson_title: str | None = None) -> dict:
    """
    Grade quiz answers, tracking concepts, difficulty levels, and generating feedback.
    """
    quiz = load_quiz(quiz_id)
    results = []
    total_score = 0.0

    for i, item in enumerate(quiz):
        key = str(i)
        chosen = answers.get(key, answers.get(i, ""))
        qtype = item.get("type", "multiple_choice")
        concept = item.get("concept", "general")

        options = item.get("options") or []
        chosen_str = str(chosen).strip()
        if options and chosen_str.isdigit() and 0 <= int(chosen_str) < len(options):
            resolved_chosen = options[int(chosen_str)]
        else:
            resolved_chosen = chosen_str

        answer_str = str(item.get("answer", "")).strip()
        if options and answer_str.isdigit() and 0 <= int(answer_str) < len(options):
            resolved_answer = options[int(answer_str)]
        else:
            resolved_answer = answer_str

        if qtype == "short_answer":
            eval_res = evaluate_short_answer_semantic(item["question"], resolved_chosen, resolved_answer)
            is_correct = eval_res.get("correct", False)
            score = eval_res.get("score", 0.0)
            feedback = eval_res.get("feedback", "")
            matched = eval_res.get("matched_concepts", [])
            missing = eval_res.get("missing_concepts", [])
        else:
            # multiple_choice or true_false
            is_correct = resolved_chosen.lower() == resolved_answer.lower()
            score = 1.0 if is_correct else 0.0
            is_arabic = any('\u0600' <= c <= '\u06FF' for c in item["question"])
            feedback = (
                "إجابة صحيحة!" if is_correct else f"إجابة خاطئة. الإجابة الصحيحة هي: {resolved_answer}"
            ) if is_arabic else (
                "Correct answer!" if is_correct else f"Incorrect. Correct answer is: {resolved_answer}"
            )
            matched = [resolved_answer] if is_correct else []
            missing = [] if is_correct else [resolved_answer]

        if is_correct:
            total_score += score

        _lecture_id = lecture_id_from_quiz(quiz_id)
        results.append({
            "question": item["question"],
            "type": qtype,
            "chosen": resolved_chosen,
            "answer": resolved_answer,
            "correct": is_correct,
            "score": score,
            "feedback": feedback,
            "concept": concept,
            "concept_id": concept_id(concept),
            "lecture_id": _lecture_id,
            "matched_concepts": matched,
            "missing_concepts": missing
        })

    total = len(quiz)
    score_percent = round((total_score / total) * 100, 1) if total else 0.0

    # Concept-based Weak Topic Detection
    concept_scores = {}
    for r in results:
        concept = r["concept"]
        if concept not in concept_scores:
            concept_scores[concept] = {"correct": 0.0, "total": 0}
        concept_scores[concept]["correct"] += 1.0 if r["correct"] else 0.0
        concept_scores[concept]["total"] += 1

    weak_topics = []
    for concept, stats in concept_scores.items():
        concept_score = stats["correct"] / stats["total"]
        if concept_score < 0.7:
            weak_topics.append({
                "topic": concept,
                "score": round(concept_score, 2)
            })

    # Difficulty Adaptation & History Tracking
    history_dir = Path("data/students")
    history_dir.mkdir(parents=True, exist_ok=True)
    history_path = history_dir / f"{student_id}_history.json"
    
    current_level = "medium"
    history_data = {
        "current_level": "medium",
        "previous_scores": [],
        "weak_topics": [],
        "strong_topics": [],
        "attempts": [],
        "recent_activity": [],
    }
    if history_path.exists():
        try:
            history_data = json.loads(history_path.read_text(encoding="utf-8"))
            if not isinstance(history_data, dict):
                history_data = {}
            history_data.setdefault("previous_scores", [])
            history_data.setdefault("weak_topics", [])
            history_data.setdefault("attempts", [])
            history_data.setdefault("recent_activity", [])
            current_level = history_data.get("current_level", "medium")
        except Exception:
            pass

    # Adjust difficulty for the next quiz attempt
    if score_percent >= 80.0:
        next_level = "hard" if current_level == "medium" else "hard"
    elif score_percent < 50.0:
        next_level = "easy" if current_level == "medium" else "easy"
    else:
        next_level = current_level

    history_data["current_level"] = next_level
    history_data["previous_scores"] = history_data.get("previous_scores", []) + [score_percent]
    history_data["weak_topics"] = weak_topics
    # Rich per-attempt record (feeds the Learning Progress screen truthfully).
    attempt = {
        "quiz_id": quiz_id,
        "lesson_title": lesson_title or quiz_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "score_percent": score_percent,
        "correct_count": round(total_score, 1),
        "total": total,
        "questions": [
            {
                "question": r["question"],
                "concept": r["concept"],
                "concept_id": r["concept_id"],
                "lecture_id": r["lecture_id"],
                "type": r["type"],
                "correct": r["correct"],
            }
            for r in results
        ],
    }
    history_data.setdefault("attempts", []).append(attempt)
    history_data.setdefault("recent_activity", []).append({
        "type": "quiz",
        "quiz_id": quiz_id,
        "title": lesson_title or quiz_id,
        "score_percent": score_percent,
        "timestamp": attempt["timestamp"],
    })
    # Trim activity, keep useful summary only.
    history_data["recent_activity"] = history_data["recent_activity"][-10:]
    history_path.write_text(json.dumps(history_data, indent=2, ensure_ascii=False), encoding="utf-8")

    # Generate Learning Recommendations
    is_ar = any('\u0600' <= c <= '\u06FF' for r in results for c in r["question"])
    if score_percent >= 80.0:
        recommendation = (
            "أداؤك ممتاز! لقد استوعبت مفاهيم الدرس بشكل رائع. يمكنك التقدم للدرس التالي."
            if is_ar else
            "Excellent performance! You've mastered the concepts. You are ready for the next lesson."
        )
    elif weak_topics:
        topics_str = ", ".join([wt["topic"] for wt in weak_topics])
        recommendation = (
            f"مستوى جيد، ولكن يُنصح بمراجعة المواضيع التالية لتقوية فهمك: {topics_str}"
            if is_ar else
            f"Good effort, but it is recommended to review the following topics: {topics_str}"
        )
    else:
        recommendation = (
            "يُنصح بمراجعة الدرس مرة أخرى لزيادة التثبيت البرمجي."
            if is_ar else
            "It is recommended to review the lesson once more to reinforce your understanding."
        )

    return {
        "score_percent": score_percent,
        "correct_count": round(total_score, 1),
        "total": total,
        "results": results,
        "weak_topics": weak_topics,
        "current_difficulty": current_level,
        "next_difficulty": next_level,
        "recommendation": recommendation
    }
