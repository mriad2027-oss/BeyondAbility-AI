"""Centralized Vision Service for EduAccess AI.

Analyzes selected video frames for educational content (code, diagrams, slides, charts):
- Routes to Gemma Vision / Hugging Face Vision when configured
- Falls back gracefully to Tesseract OCR when offline
"""
from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any

from backend import config
from backend.services.ai.hf_client import get_hf_client
from backend.services import vision as local_vision

logger = logging.getLogger("eduaccess.ai.vision")


class VisionService:
    """Centralized Vision Understanding Service."""

    def __init__(self):
        self.hf_client = get_hf_client()

    def describe_frame(self, frame_path: str, transcript_context: str = "") -> dict[str, Any]:
        """Analyze a frame and return {type, description, confidence}."""
        # Delegates to the established vision provider selector (OCR / API)
        return local_vision.describe_frame(frame_path, transcript_context=transcript_context)


_vision_instance: VisionService | None = None

def get_vision_service() -> VisionService:
    global _vision_instance
    if _vision_instance is None:
        _vision_instance = VisionService()
    return _vision_instance
