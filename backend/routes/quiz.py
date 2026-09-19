from fastapi import APIRouter, HTTPException

from backend.models.schemas import QuizAnswerSubmission
from backend.services import quiz as quiz_service
from backend.services import llm

router = APIRouter()


@router.get("/quizzes")
async def list_quizzes():
    return {"quizzes": quiz_service.list_quizzes()}


@router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str):
    try:
        items = quiz_service.load_quiz(quiz_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Quiz not found")
    # Don't leak answers to the client, but include type for UI rendering
    sanitized = [
        {"question": q["question"], "options": q["options"], "type": q.get("type", "multiple_choice")}
        for q in items
    ]
    return {"quiz_id": quiz_id, "questions": sanitized}


@router.post("/quizzes/submit")
async def submit_quiz(submission: QuizAnswerSubmission):
    try:
        graded = quiz_service.grade_quiz(
            submission.quiz_id, submission.answers,
            student_id=submission.student_id,
            lesson_title=submission.lesson_title,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Quiz not found")

    feedback = llm.generate_quiz_feedback(submission.lesson_title, graded["results"])
    graded["feedback"] = feedback
    return graded
