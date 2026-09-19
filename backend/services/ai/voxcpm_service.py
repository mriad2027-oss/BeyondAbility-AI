"""VoxCPM Voice & Speech Synthesis Service for EduAccess AI.

Provides centralized text-to-speech powered by VoxCPM on Hugging Face Cloud:
- Audio descriptions synthesis
- AI assistant voice output
- Tutor spoken explanations
- Audio caching: Generated audio is cached by text hash and event ID so identical
  phrases are never synthesized twice.
- Graceful offline fallback to local TTS (pyttsx3 / espeak).
"""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from backend import config
from backend.services.ai.hf_client import get_hf_client, HFClientError
from backend.services import tts as local_tts

logger = logging.getLogger("eduaccess.ai.voxcpm")

AUDIO_CACHE_DIR = config.OUTPUTS_DIR / "narration_cache"
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class VoxCPMService:
    """Service wrapping VoxCPM TTS model on Hugging Face Cloud with audio caching."""

    def __init__(self, model_id: str | None = None, endpoint_override: str | None = None):
        self.model_id = model_id or config.HF_VOXCPM_MODEL
        self.endpoint_override = endpoint_override or config.HF_VOXCPM_ENDPOINT
        self.hf_client = get_hf_client()
        self.last_provider = "unknown"

    def is_cloud_ready(self) -> bool:
        return self.hf_client.is_configured and config.TTS_PROVIDER in ("auto", "voxcpm", "hf")

    def _cache_path(self, text: str, voice_id: str = "default") -> Path:
        key = hashlib.sha256(f"{voice_id}:{text.strip()}".encode("utf-8")).hexdigest()[:16]
        return AUDIO_CACHE_DIR / f"voxcpm_{key}.wav"

    @staticmethod
    def _is_playable_audio(audio: bytes) -> bool:
        """Reject HTML/JSON error bodies and empty payloads before caching."""
        if len(audio) < 512:
            return False
        return audio[:4] == b"RIFF" or audio[:3] == b"ID3" or audio[:2] == b"\xff\xfb" or audio[:4] == b"OggS"

    def synthesize(
        self,
        text: str,
        output_path: str | Path | None = None,
        rate: float = 1.0,
        voice_id: str = "default",
    ) -> str:
        """Synthesize text into speech audio, checking cache first."""
        clean_text = text.strip()
        if not clean_text:
            raise ValueError("Cannot synthesize empty text.")

        dest = Path(output_path) if output_path else self._cache_path(clean_text, voice_id)
        dest.parent.mkdir(parents=True, exist_ok=True)

        # 1. Cache hit check
        cached_file = self._cache_path(clean_text, voice_id)
        if cached_file.exists() and cached_file.stat().st_size > 500:
            if dest != cached_file:
                import shutil
                shutil.copyfile(str(cached_file), str(dest))
            logger.debug(f"Reused cached VoxCPM audio for: '{clean_text[:40]}...'")
            self.last_provider = "cache/unknown-origin"
            return str(dest)

        # 2. Try Hugging Face Cloud inference if configured
        if self.is_cloud_ready():
            try:
                logger.info(f"Synthesizing via VoxCPM Cloud: '{clean_text[:40]}...'")
                payload = {"inputs": clean_text}
                audio_bytes = self.hf_client.post_sync(
                    self.model_id,
                    payload=payload,
                    endpoint_override=self.endpoint_override,
                    timeout=60.0,
                )
                if isinstance(audio_bytes, (bytes, bytearray)) and self._is_playable_audio(bytes(audio_bytes)):
                    dest.write_bytes(audio_bytes)
                    # Also persist to cache path
                    if dest != cached_file:
                        cached_file.write_bytes(audio_bytes)
                    self.last_provider = "huggingface/voxcpm"
                    return str(dest)
            except Exception as exc:
                logger.warning("VoxCPM cloud synthesis failed (%s); using explicitly labelled fallback TTS.", exc)

        # 3. Fallback to local synthesizer (pyttsx3 / espeak / OpenAI)
        logger.info(f"Synthesizing with local fallback TTS: '{clean_text[:40]}...'")
        generated = local_tts.text_to_speech(clean_text, str(dest), rate=rate)
        self.last_provider = "fallback/local-tts"
        if Path(generated).exists() and cached_file != dest and not cached_file.exists():
            import shutil
            shutil.copyfile(str(dest), str(cached_file))
        return str(dest)

    def synthesize_event_descriptions(
        self,
        accessibility_events: list[dict[str, Any]],
        video_stem: str,
        rate: float = 1.0,
    ) -> list[dict[str, Any]]:
        """Synthesize individual audio descriptions per event and attach audio paths."""
        event_audio_dir = config.OUTPUTS_DIR / f"{video_stem}_audio"
        event_audio_dir.mkdir(parents=True, exist_ok=True)

        updated_events = []
        for i, event in enumerate(accessibility_events):
            desc = event.get("description", "").strip()
            if not desc:
                updated_events.append(event)
                continue

            event_id = event.get("event_id", f"event_{i:03d}")
            out_file = event_audio_dir / f"{event_id}.wav"

            try:
                path = self.synthesize(desc, output_path=out_file, rate=rate)
                updated_events.append({
                    **event,
                    "narration_path": str(path),
                    # This field prevents the API/UI from claiming a local
                    # fallback is VoxCPM.  A cloud cache or successful request
                    # is the only source that may be labelled VoxCPM.
                    "tts_provider": self.last_provider,
                })
            except Exception as e:
                logger.warning(f"Failed to synthesize audio description for {event_id}: {e}")
                updated_events.append(event)

        return updated_events


# Global shared VoxCPM service instance
_voxcpm_instance: VoxCPMService | None = None

def get_voxcpm_service() -> VoxCPMService:
    global _voxcpm_instance
    if _voxcpm_instance is None:
        _voxcpm_instance = VoxCPMService()
    return _voxcpm_instance
