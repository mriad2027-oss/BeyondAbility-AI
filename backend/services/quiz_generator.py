import json
import logging
from pathlib import Path
from backend import config
from backend.services import llm
from backend.services.vision import clean_json_response

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_PROMPT = (
    "You are an expert curriculum designer. Your task is to generate an educational quiz "
    "grounded strictly in the provided lecture transcript and visual events.\n\n"
    "Follow these strict design rules:\n"
    "1. Generate between 5 and 10 high-quality questions.\n"
    "2. Support three types of questions:\n"
    "   - 'multiple_choice': 3-4 options, one correct answer.\n"
    "   - 'true_false': options MUST be ['صح', 'خطأ'] (for Arabic) or ['True', 'False'] (for English) based on video language, one correct answer.\n"
    "   - 'short_answer': no options (empty list), answer is a short conceptual response.\n"
    "3. Align each question with a specific topic or concept (e.g. 'loops', 'variables', 'arrays') for tracking weak areas.\n"
    "4. Ground every question strictly in the lecture content. Do NOT require outside knowledge.\n"
    "5. Include visual questions if appropriate, reference the exact visual details shown in visual events.\n"
    "6. Include 'source_refs' linking to segment indices/IDs or visual event indices/IDs for provenance.\n"
    "7. Output ONLY a raw JSON array matching this schema (no markdown backticks, no explanations):\n"
    "[\n"
    "  {\n"
    '    "question": "question text",\n'
    '    "type": "multiple_choice" | "true_false" | "short_answer",\n'
    '    "options": ["option1", "option2", ...],\n'
    '    "answer": "correct option text or expected answer description",\n'
    '    "concept": "concept_name",\n'
    '    "source_refs": {\n'
    '      "transcript_segments": [segment_indices],\n'
    '      "visual_events": [event_indices]\n'
    '    }\n'
    "  }\n"
    "]"
)


def generate_quiz(job_id: str, transcript_text: str, visual_events: list[dict], concepts: list[str] | None = None) -> list[dict]:
    """
    Generate an educational quiz grounded in the transcript and visual events using Gemma.
    Saves to data/quizzes/{job_id}_quiz.json.
    """
    from backend.services.ai.gemma_service import get_gemma_service

    fallback_quiz = _generate_fallback_quiz(transcript_text)
    gemma = get_gemma_service()
    quiz_data = None

    if gemma.is_cloud_ready():
        try:
            result = gemma.generate_quiz(
                transcript_text=transcript_text,
                visual_events=visual_events,
                concepts=concepts,
            )
            if isinstance(result, list) and len(result) > 0:
                quiz_data = result
            else:
                logger.warning("Gemma quiz generation returned invalid or empty result; trying call_llm.")
        except Exception as e:
            logger.warning(f"Gemma quiz generation failed ({e}); trying call_llm.")

    if quiz_data is None:
        user_prompt = (
            f"Lecture Transcript:\n{transcript_text}\n\n"
            f"Visual Events:\n{json.dumps(visual_events, indent=2, ensure_ascii=False)}\n\n"
            "Generate the quiz JSON matching the requested schema."
        )
        response = llm.call_llm(QUIZ_SYSTEM_PROMPT, user_prompt, "")
        try:
            result = clean_json_response(response)
            if isinstance(result, list) and len(result) > 0:
                quiz_data = result
            else:
                raise ValueError("LLM did not return a JSON array or returned empty.")
        except Exception as e:
            logger.warning(f"Failed to parse LLM quiz generation, falling back: {e}")
            quiz_data = fallback_quiz

    # Save to file
    out_dir = Path("data/quizzes")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{job_id}_quiz.json"
    out_path.write_text(json.dumps(quiz_data, indent=2, ensure_ascii=False), encoding="utf-8")

    return quiz_data


def _generate_fallback_quiz(transcript_text: str) -> list[dict]:
    """Generates a fallback quiz dynamically using transcript keywords."""
    text = transcript_text.lower()
    quiz = []
    
    if "متغير" in text or "variable" in text:
        quiz.append({
            "question": "ما هو دور المتغير (Variable) في البرمجة؟" if "متغير" in text else "What is the purpose of a variable in programming?",
            "type": "multiple_choice",
            "options": [
                "تخزين البيانات وقيم البرامج" if "متغير" in text else "Storing data and program values",
                "حذف الملفات من القرص" if "متغير" in text else "Deleting files from disk",
                "تكرار الكود لعدد محدد من المرات" if "متغير" in text else "Repeating code a specific number of times"
            ],
            "answer": "تخزين البيانات وقيم البرامج" if "متغير" in text else "Storing data and program values",
            "concept": "variables",
            "source_refs": {"transcript_segments": [0], "visual_events": []}
        })
        
    if "تكرار" in text or "loop" in text or "for" in text:
        quiz.append({
            "question": "ما هي الفائدة الأساسية من حلقة التكرار (Loop)؟" if "تكرار" in text else "What is the main benefit of a loop?",
            "type": "multiple_choice",
            "options": [
                "تشغيل الكود مرة واحدة فقط" if "تكرار" in text else "Running code only once",
                "تكرار تنفيذ مجموعة من التعليمات البرمجية" if "تكرار" in text else "Repeating execution of a block of code",
                "إنشاء دالة جديدة" if "تكرار" in text else "Creating a new function"
            ],
            "answer": "تكرار تنفيذ مجموعة من التعليمات البرمجية" if "تكرار" in text else "Repeating execution of a block of code",
            "concept": "loops",
            "source_refs": {"transcript_segments": [0], "visual_events": []}
        })

    # Add a conceptual short answer question
    quiz.append({
        "question": "وضح المفهوم البرمجي الأساسي الذي تم شرحه في هذا الدرس باختصار." if "متغير" in text or "تكرار" in text else "Briefly explain the main programming concept explained in this lesson.",
        "type": "short_answer",
        "options": [],
        "answer": "البرمجة واستخدام المتغيرات أو الحلقات البرمجية" if "متغير" in text or "تكرار" in text else "Programming and variables or loops structures",
        "concept": "general_programming",
        "source_refs": {"transcript_segments": [0], "visual_events": []}
    })
    
    # Add a True/False question
    quiz.append({
        "question": "هل تبدأ الحلقات التكرارية دائماً بالقيمة 1 في بايثون؟" if "بايثون" in text or "python" in text else "Do loops always start at 1 in Python?",
        "type": "true_false",
        "options": ["صح", "خطأ"] if "بايثون" in text or "python" in text else ["True", "False"],
        "answer": "خطأ" if "بايثون" in text or "python" in text else "False",
        "concept": "loops_indexing",
        "source_refs": {"transcript_segments": [0], "visual_events": []}
    })

    return quiz
