"""
Central configuration for EduAccess AI.

All settings are read from environment variables (or a .env file in the
project root). Nothing here requires paid APIs to run -- every service has
a free/offline fallback so the whole pipeline works out of the box, and
gets *better* automatically once you add API keys.
"""

import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Load a .env file if present (create one from .env.example)
load_dotenv()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
VIDEOS_DIR = DATA_DIR / "videos"
AUDIO_DIR = DATA_DIR / "audio"
FRAMES_DIR = DATA_DIR / "frames"
OUTPUTS_DIR = DATA_DIR / "outputs"
STUDENTS_DIR = DATA_DIR / "students"
QUIZZES_DIR = DATA_DIR / "quizzes"
JOBS_DIR = DATA_DIR / "jobs"  # per-job state (json)
LOG_DIR = DATA_DIR / "logs"
HASHES_DIR = DATA_DIR / "hashes"  # content-addressed video cache

for d in [VIDEOS_DIR, AUDIO_DIR, FRAMES_DIR, OUTPUTS_DIR, STUDENTS_DIR, QUIZZES_DIR, JOBS_DIR, LOG_DIR, HASHES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Binary discovery (Tesseract is frequently installed but missing from PATH)
# ---------------------------------------------------------------------------
TESSERACT_CANDIDATE_PATHS = [
    "C:/Program Files/Tesseract-OCR/tesseract.exe",
    "C:/Program Files (x86)/Tesseract-OCR/tesseract.exe",
    str(Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Tesseract-OCR" / "tesseract.exe"),
    str(Path(os.environ.get("LOCALAPPDATA", "")) / "Tesseract-OCR" / "tesseract.exe"),
]


def find_tesseract() -> str | None:
    """Return a usable tesseract binary path, or None."""
    on_path = shutil.which("tesseract")
    if on_path:
        return on_path
    for candidate in TESSERACT_CANDIDATE_PATHS:
        if candidate and Path(candidate).exists():
            return candidate
    return None

# ---------------------------------------------------------------------------
# Speech-to-text (Whisper)
# ---------------------------------------------------------------------------
# tiny / base / small / medium / large -- bigger = more accurate but slower.
# Dialectal Egyptian Arabic (esp. from low-quality screen/WhatsApp recordings) is
# demanding; `small` still returns garbled/latinised word forms ("مصار", "حدسة").
# The default is now `medium`, which yields substantially more readable Arabic.
# Override with WHISPER_MODEL_SIZE (e.g. "large" for maximum accuracy). It stays
# configurable and is never baked into the runtime path.
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "medium")

# Ordered fallback chain if the requested model cannot be downloaded/loaded at
# runtime. We never silently fall back to a different model -- the model actually
# used is recorded and reported. Override with WHISPER_MODEL_FALLBACK (comma list).
def _fallback_list():
    raw = os.getenv("WHISPER_MODEL_FALLBACK", "small,base,tiny")
    return [m.strip() for m in raw.split(",") if m.strip()]

# Minimum Whisper language-classifier probability (0..1) before we force the
# explicit language code for a strongly-detected language (Arabic is first-class).
LANGUAGE_FORCE_THRESHOLD = float(os.getenv("LANGUAGE_FORCE_THRESHOLD", "0.5"))

# Whisper decoding controls. We keep silence/VAD handling safe so words are not
# cut: low no-speech threshold keeps very short speech, and we never trim the
# extracted WAV. These are tunable and do not fabricate content.
WHISPER_NO_SPEECH_THRESHOLD = float(os.getenv("WHISPER_NO_SPEECH_THRESHOLD", "0.6"))
WHISPER_LOGPROB_THRESHOLD = float(os.getenv("WHISPER_LOGPROB_THRESHOLD", "-1.0"))
WHISPER_CONDITION_ON_PREVIOUS_TEXT = os.getenv("WHISPER_CONDITION_ON_PREVIOUS_TEXT", "1") not in ("0", "false", "False")

# ---------------------------------------------------------------------------
# Hugging Face Cloud & Centralized AI Configuration
# ---------------------------------------------------------------------------
HF_TOKEN = os.getenv("HF_TOKEN", "")
HF_GEMMA_MODEL = os.getenv("HF_GEMMA_MODEL", "google/gemma-3-4b-it")
HF_VOXCPM_MODEL = os.getenv("HF_VOXCPM_MODEL", "voxcpm/voxcpm-base")
HF_PROVIDER = os.getenv("HF_PROVIDER", "auto")
HF_GEMMA_ENDPOINT = os.getenv("HF_GEMMA_ENDPOINT", "")
HF_VOXCPM_ENDPOINT = os.getenv("HF_VOXCPM_ENDPOINT", "")

# RAG & Context limits (Token optimization)
MAX_RAG_CHUNKS = int(os.getenv("MAX_RAG_CHUNKS", "5"))
MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "12000"))
MAX_CHAT_HISTORY = int(os.getenv("MAX_CHAT_HISTORY", "6"))

# Pipeline versioning
PIPELINE_VERSION = "2.0"

# ---------------------------------------------------------------------------
# Vision (frame -> description of on-screen content)
# ---------------------------------------------------------------------------
# "hf"       -> Hugging Face Vision / Gemma Vision
# "openai"   -> uses OPENAI_API_KEY, model gpt-4o-mini (or VISION_MODEL)
# "anthropic"-> uses ANTHROPIC_API_KEY, model claude-sonnet-4-6 (or VISION_MODEL)
# "ocr"      -> fully offline, uses Tesseract OCR to read on-screen text (default fallback)
VISION_PROVIDER = os.getenv("VISION_PROVIDER", "auto")  # auto = use HF/API key if present, else OCR
VISION_MODEL = os.getenv("VISION_MODEL", "")

# ---------------------------------------------------------------------------
# LLM (combine transcript + visual info -> accessibility description / feedback)
# ---------------------------------------------------------------------------
# "gemma" | "hf" | "openai" | "anthropic" | "template" (offline, rule-based fallback)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto")
LLM_MODEL = os.getenv("LLM_MODEL", "")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

DEFAULT_OPENAI_TEXT_MODEL = "gpt-4o-mini"
DEFAULT_OPENAI_VISION_MODEL = "gpt-4o-mini"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"

# ---------------------------------------------------------------------------
# Text-to-speech
# ---------------------------------------------------------------------------
# "voxcpm" | "pyttsx3" (offline, default) | "openai" (needs OPENAI_API_KEY)
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "auto")

# ---------------------------------------------------------------------------
# Frame sampling
# ---------------------------------------------------------------------------
FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "5"))
FRAME_MIN_INTERVAL = float(os.getenv("FRAME_MIN_INTERVAL", "2.0"))
SCENE_CHANGE_THRESHOLD = float(os.getenv("SCENE_CHANGE_THRESHOLD", "5.0"))

# ---------------------------------------------------------------------------
# Upload validation (security)
# ---------------------------------------------------------------------------
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(512 * 1024 * 1024)))  # 512 MB
VIDEO_CONTENT_TYPES = {
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
    "video/webm", "application/octet-stream",
}


def resolve_provider(configured: str, has_key: bool, key_name: str) -> str:
    """Resolve an 'auto' provider setting to a concrete provider name."""
    if configured != "auto":
        return configured
    return key_name if has_key else "offline"
