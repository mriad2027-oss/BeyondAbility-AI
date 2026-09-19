"""Assistant Orchestrator for EduAccess AI.

Coordinates context assembly, deterministic action matching, RAG retrieval,
and Gemma generation for the global AI assistant.
"""
from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator

from backend import config, storage
from backend.services.ai.gemma_service import get_gemma_service
from backend.services.assistant.tools import execute_tool, ASSISTANT_TOOL_DEFINITIONS
from backend.services.rag import get_retriever

logger = logging.getLogger("eduaccess.ai.assistant.orchestrator")


class AssistantOrchestrator:
    """Orchestrator for the floating global assistant."""

    def __init__(self):
        self.gemma = get_gemma_service()

    def _match_deterministic_action(self, user_msg: str) -> dict[str, Any] | None:
        """Fast deterministic route for simple UI commands (Token Optimization)."""
        msg = user_msg.lower().strip()

        # Captions
        if any(p in msg for p in ("turn on caption", "enable caption", "show caption", "شغل الترجمة", "فعل الترجمة")):
            return {"action": "toggle_captions", "enabled": True, "message": "Captions have been enabled."}
        if any(p in msg for p in ("turn off caption", "disable caption", "hide caption", "اوقف الترجمة", "الغاء الترجمة")):
            return {"action": "toggle_captions", "enabled": False, "message": "Captions have been disabled."}

        # Audio descriptions
        if any(p in msg for p in ("turn on audio desc", "enable audio desc", "start narration", "شغل الوصف الصوتي")):
            return {"action": "toggle_audio_description", "enabled": True, "message": "Spoken audio descriptions turned on."}
        if any(p in msg for p in ("turn off audio desc", "disable audio desc", "stop narration", "اوقف الوصف الصوتي")):
            return {"action": "toggle_audio_description", "enabled": False, "message": "Spoken audio descriptions turned off."}

        # Open quiz
        if any(p in msg for p in ("open quiz", "take quiz", "start quiz", "show quiz", "give me a quiz", "افتح الاختبار", "بدء الاختبار")):
            return {"action": "open_quiz", "message": "Opening the lecture quiz."}

        if "next question" in msg:
            return {"action": "next_quiz_question", "message": "Moving to the next quiz question."}
        if any(p in msg for p in ("increase font", "larger text", "make text bigger")):
            return {"action": "font_size", "delta": 1, "message": "Increasing text size."}
        if any(p in msg for p in ("decrease font", "smaller text", "make text smaller")):
            return {"action": "font_size", "delta": -1, "message": "Decreasing text size."}

        return None

    def chat(
        self,
        message: str,
        context: dict[str, Any],
        history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """Process an assistant message, returning response text and any triggered action."""
        clean_msg = message.strip()
        if not clean_msg:
            return {"reply": "How can I help you with your lecture today?", "action": None}

        # 1. Check deterministic action
        det_action = self._match_deterministic_action(clean_msg)
        if det_action:
            return {
                "reply": det_action["message"],
                "action": det_action.get("action"),
                "action_payload": det_action,
                "evidence": [],
            }

        # 2. Extract context
        lecture_id = context.get("lecture_id") or ""
        timestamp = float(context.get("timestamp") or 0.0)

        current_segment = execute_tool("get_current_segment", {}, context)
        current_visual = execute_tool("get_current_visual_event", {}, context)

        # 3. Handle immediate "What is on screen / what am I looking at"
        lower_msg = clean_msg.lower()
        if any(k in lower_msg for k in ("what am i looking at", "what is on screen", "what is shown", "ماذا يظهر", "ما المعروض")):
            vtype = current_visual.get("type", "scene")
            vdesc = current_visual.get("description", "Standard lecture video.")
            ocr = current_visual.get("ocr_text", "")
            time_str = f"{int(timestamp//60):02d}:{int(timestamp%60):02d}"

            reply = f"At [{time_str}], you are looking at a {vtype}. {vdesc}"
            if ocr:
                reply += f"\nOn-screen text: {ocr[:120]}"
            return {
                "reply": reply,
                "action": None,
                "evidence": [{"time": time_str, "type": vtype, "snippet": vdesc}],
            }

        # 4. Multimodal RAG query via Gemma
        rag_context = ""
        evidence_list = []
        if lecture_id and storage.job_exists(lecture_id):
            job = storage.get_job(lecture_id)
            from pathlib import Path
            stem = Path(job.get("video_path", "")).stem or lecture_id
            retriever = get_retriever(lecture_id, stem)
            chunks = retriever.retrieve(clean_msg, top_k=config.MAX_RAG_CHUNKS)
            if chunks:
                rag_context = "\n---\n".join(f"{c.get('timestamp_label', '')}: {c.get('text', '')}" for c in chunks)
                evidence_list = [
                    {"time": c.get("timestamp_label"), "snippet": c.get("text", "")[:120]}
                    for c in chunks[:3]
                ]

        # 5. Formulate prompt for Gemma
        system_prompt = (
            "You are EduAccess AI, a helpful, accessible learning assistant.\n"
            "Answer the student's question accurately using the provided lecture context.\n"
            "Be clear, concise, and educational. When relevant, cite the timestamp.\n"
        )
        user_prompt = f"Student Question: {clean_msg}\n\n"
        if rag_context:
            user_prompt += f"Relevant Lecture Evidence:\n{rag_context}\n\n"
        if current_segment.get("text"):
            user_prompt += f"Current Speech ({int(timestamp//60):02d}:{int(timestamp%60):02d}): {current_segment.get('text')}\n"
        if current_visual.get("description"):
            user_prompt += f"Current Visual ({current_visual.get('type')}): {current_visual.get('description')}\n"

        if not rag_context:
            return {
                "reply": "I could not find lecture evidence for that question. Please ask about the selected lecture or choose a lecture first.",
                "action": None,
                "evidence": [],
                "provider": "none",
            }
        try:
            reply = self.gemma.generate_cloud(user_prompt, system_prompt=system_prompt, history=history, max_new_tokens=300)
            provider = "huggingface/gemma"
        except Exception as exc:
            logger.warning("Learner-facing Gemma call failed: %s", exc)
            return {
                "reply": f"I could not reach Gemma on Hugging Face: {exc}. No substitute answer was generated.",
                "action": None,
                "evidence": evidence_list,
                "provider": "unavailable",
            }

        return {
            "reply": reply,
            "action": None,
            "evidence": evidence_list,
            "provider": provider,
        }

    async def stream_chat(
        self,
        message: str,
        context: dict[str, Any],
        history: list[dict[str, str]] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream assistant response tokens via SSE."""
        # For simple deterministic actions, emit immediately
        det_action = self._match_deterministic_action(message)
        if det_action:
            yield json.dumps({"token": det_action["message"], "action": det_action.get("action"), "action_payload": det_action, "done": True})
            return

        lecture_id = context.get("lecture_id") or ""
        timestamp = float(context.get("timestamp") or 0.0)

        # Retrieve RAG context
        rag_context = ""
        if lecture_id and storage.job_exists(lecture_id):
            job = storage.get_job(lecture_id)
            from pathlib import Path
            stem = Path(job.get("video_path", "")).stem or lecture_id
            retriever = get_retriever(lecture_id, stem)
            chunks = retriever.retrieve(message, top_k=config.MAX_RAG_CHUNKS)
            if chunks:
                rag_context = "\n---\n".join(f"{c.get('timestamp_label', '')}: {c.get('text', '')}" for c in chunks)

        system_prompt = (
            "You are EduAccess AI, a helpful, accessible learning assistant.\n"
            "Answer the student's question accurately using the provided lecture context.\n"
            "Be clear, concise, and educational. When relevant, cite the timestamp.\n"
        )
        user_prompt = f"Student Question: {message}\n\n"
        if rag_context:
            user_prompt += f"Relevant Lecture Evidence:\n{rag_context}\n\n"

        async for token in self.gemma.stream_chat(user_prompt, system_prompt=system_prompt, history=history):
            yield json.dumps({"token": token, "done": False})

        yield json.dumps({"token": "", "done": True})


_orchestrator: AssistantOrchestrator | None = None

def get_assistant_orchestrator() -> AssistantOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AssistantOrchestrator()
    return _orchestrator
