"""Run explicit, server-side Hugging Face cloud smoke checks.

Never prints HF_TOKEN.  It reports an exact text result for Gemma and only
declares VoxCPM successful when the cloud response is non-empty playable audio.
"""
from __future__ import annotations

import sys
import time

from backend.services.ai.gemma_service import GemmaService
from backend.services.ai.hf_client import HFClientError
from backend.services.ai.voxcpm_service import VoxCPMService


def main() -> int:
    gemma = GemmaService()
    started = time.monotonic()
    try:
        result = gemma.generate_cloud("Explain Python loops in one short sentence.", max_new_tokens=64)
        print(f"GEMMA PASS provider=huggingface model={gemma.model_id} latency_s={time.monotonic()-started:.2f}")
        print(f"GEMMA RESULT {result}")
    except HFClientError as exc:
        print(f"GEMMA FAIL model={gemma.model_id} error={exc}")

    vox = VoxCPMService()
    started = time.monotonic()
    try:
        if not vox.is_cloud_ready():
            raise HFClientError("HF_TOKEN or the VoxCPM cloud provider is not configured.")
        response = vox.hf_client.post_sync(vox.model_id, {"inputs": "Welcome to EduAccess AI."}, endpoint_override=vox.endpoint_override, timeout=60)
        if not isinstance(response, (bytes, bytearray)) or not vox._is_playable_audio(bytes(response)):
            raise HFClientError("The provider response was not playable audio for this model/task.")
        print(f"VOXCPM PASS provider=huggingface model={vox.model_id} bytes={len(response)} latency_s={time.monotonic()-started:.2f}")
    except HFClientError as exc:
        print(f"VOXCPM FAIL model={vox.model_id} error={exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
