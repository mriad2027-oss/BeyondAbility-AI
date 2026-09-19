"""FastAPI Routes for EduAccess AI Global Assistant.

Provides:
- POST /api/v1/assistant/chat (Standard conversational endpoint)
- POST /api/v1/assistant/stream (SSE streaming token-by-token endpoint)
- GET  /api/v1/assistant/tools (List of safe whitelisted tools)
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.services.assistant.orchestrator import get_assistant_orchestrator
from backend.services.assistant.tools import ASSISTANT_TOOL_DEFINITIONS

router = APIRouter()


class AssistantChatRequest(BaseModel):
    message: str = Field(..., description="User message to the assistant")
    context: dict[str, Any] = Field(default_factory=dict, description="Active context: lecture_id, timestamp, segment, etc.")
    history: list[dict[str, str]] = Field(default_factory=list, description="Short rolling conversation turns")


@router.post("/api/v1/assistant/chat")
@router.post("/assistant/chat")
async def assistant_chat(req: AssistantChatRequest):
    """Process an assistant question and return response with any triggered action."""
    orchestrator = get_assistant_orchestrator()
    response = orchestrator.chat(req.message, req.context, history=req.history)
    return response


@router.post("/api/v1/assistant/stream")
@router.post("/assistant/stream")
async def assistant_stream(req: AssistantChatRequest):
    """Stream assistant response tokens via Server-Sent Events (SSE)."""
    orchestrator = get_assistant_orchestrator()

    async def event_generator():
        async for chunk in orchestrator.stream_chat(req.message, req.context, history=req.history):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/v1/assistant/tools")
@router.get("/assistant/tools")
async def get_assistant_tools():
    """Return whitelisted tools supported by the global assistant."""
    return {"tools": ASSISTANT_TOOL_DEFINITIONS}
