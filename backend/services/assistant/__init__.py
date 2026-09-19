"""EduAccess AI Assistant Engine.
Context-aware educational assistant with whitelisted tool invocation and streaming responses.
"""
from backend.services.assistant.tools import execute_tool, ASSISTANT_TOOL_DEFINITIONS
from backend.services.assistant.orchestrator import AssistantOrchestrator, get_assistant_orchestrator
