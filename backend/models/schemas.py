from typing import Optional
from pydantic import BaseModel


class ProcessRequest(BaseModel):
    job_id: str
    mode: str = "both"  # "hearing" | "visual" | "both"
    student_id: Optional[str] = "default"
    accessibility_mode: Optional[str] = None


class QuizAnswerSubmission(BaseModel):
    quiz_id: str
    answers: dict[str, str]  # {"0": "0, 1, 2, 3, 4", ...}
    lesson_title: Optional[str] = "Lesson"
    student_id: Optional[str] = "default"


class StudentProfile(BaseModel):
    id: str
    accessibility_need: str  # "visual" | "hearing" | "none"
    preferred_output: str    # "audio" | "captions" | "both"


class StudentProfileUpdate(BaseModel):
    student_id: str
    name: Optional[str] = ""
    accessibility_mode: str  # "blind" | "low_vision" | "hearing" | "standard"
    speech_rate: float = 1.0
    description_detail: str = "medium"  # "low" | "medium" | "high"
    preferred_language: str = "en"      # "en" | "ar"
    quiz_difficulty: str = "adaptive"   # "easy" | "medium" | "hard" | "adaptive"


class AskRequest(BaseModel):
    job_id: str
    question: str


class SystemStatusResponse(BaseModel):
    status: str
    dependencies: dict[str, bool] = {}
    whisper_model: str = ""
    tts_provider: str = ""
    vision_provider: str = ""


class LectureSummary(BaseModel):
    job_id: str
    filename: str = ""
    status: str = ""
    progress: int = 0
    current_stage: str = ""
    created_at: Optional[str] = None
    duration: Optional[float] = None
    assets: dict = {}

