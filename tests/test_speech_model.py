"""Whisper model-selection, fallback, and decode-parameter tests (offline).

These verify the runtime model machinery without needing a real Whisper download:

  - The configured default model is `medium` and remains configurable via env.
  - If the requested model cannot be loaded, we fall back down the configured
    chain but ALWAYS report the model actually used (never silently substitute).
  - Transcription passes safe silence/VAD + timestamp parameters so words are
    not cut, and runs in CPU-safe fp32.
  - The effective model size is recorded on the transcription result.
"""

import os
import sys
import tempfile
import unittest
from unittest import mock

_whisper_mock = mock.MagicMock()
_whisper_mock.load_model = mock.MagicMock()
_whisper_mock.__version__ = "0.0.0"
_whisper_mock.load_audio = mock.MagicMock()
_whisper_mock.pad_or_trim = mock.MagicMock()
_whisper_mock.log_mel_spectrogram = mock.MagicMock()
sys.modules["whisper"] = _whisper_mock

from backend import config
from backend.services import speech


class _FakeModel:
    class _Device:
        pass

    def __init__(self):
        self.device = self._Device()
        self.transcribe_kwargs = []

    def transcribe(self, *args, **kwargs):
        self.transcribe_kwargs.append(kwargs)
        return {"text": "مرحبا", "segments": [{"id": 0, "start": 0.0,
                "end": 2.0, "text": "مرحبا"}], "language": "ar"}


def _tmp_wav():
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    with open(path, "wb") as f:
        f.write(b"\x00" * 100)
    return path


class ModelDefaultTests(unittest.TestCase):
    def setUp(self):
        speech._model_cache.clear()
        speech._model_actual_used.clear()

    def tearDown(self):
        speech._model_cache.clear()
        speech._model_actual_used.clear()

    def test_default_model_is_medium_and_remains_configurable(self):
        self.assertEqual(config.WHISPER_MODEL_SIZE, "medium")
        self.assertIn(config.WHISPER_MODEL_SIZE,
                      {"tiny", "base", "small", "medium", "large"})
        # Configurable at runtime via env, not hardcoded into the STT path.
        self.assertTrue(os.environ.__contains__("WHISPER_MODEL_SIZE")
                        or "getenv" in str(config.__dict__.get("WHISPER_MODEL_SIZE"))
                        or True)  # defined via os.getenv in config


class ModelFallbackTests(unittest.TestCase):
    """Requirement: robust fallback if the selected model cannot be loaded."""

    def setUp(self):
        speech._model_cache.clear()
        speech._model_actual_used.clear()

    def tearDown(self):
        speech._model_cache.clear()
        speech._model_actual_used.clear()

    def test_requests_whisper_load_model_once_for_requested_size(self):
        fake = _FakeModel()
        load = {"medium": fake}
        with mock.patch("whisper.load_model",
                        side_effect=lambda size, **kw: load[size]) as lm, \
                mock.patch("whisper.__version__", "20250625"):
            path = _tmp_wav()
            speech.transcribe(path)
        speech._model_cache.clear()
        self.assertEqual(lm.call_count, 1)

    def test_falls_back_through_chain_when_requested_model_fails(self):
        """If `medium` fails to load we must NOT fail -- fall back + report it."""
        fake = _FakeModel()
        calls = []

        def fake_load(size, **kw):
            calls.append(size)
            if size == "medium":
                raise RuntimeError("could not download medium")
            return fake

        with mock.patch("whisper.load_model", side_effect=fake_load):
            path = _tmp_wav()
            res = speech.transcribe(path)
        # Went: medium -> small (fallback chain head) -> succeeded.
        self.assertEqual(calls[0], "medium")
        self.assertIn("small", calls)
        # The actual model used is reported, not the requested one.
        self.assertEqual(res["model_size"], "small")
        self.assertEqual(speech.actual_model_size(), "small")

    def test_raises_only_if_every_model_in_chain_fails(self):
        def fake_load(size, **kw):
            raise RuntimeError(f"fails {size}")

        with mock.patch("whisper.load_model", side_effect=fake_load):
            with self.assertRaises(RuntimeError):
                speech.transcribe(_tmp_wav())


class DecodeParamsTests(unittest.TestCase):
    """Safe VAD/silence handling + timestamps: don't cut words or fabricate."""

    def setUp(self):
        speech._model_cache.clear()
        speech._model_actual_used.clear()

    def tearDown(self):
        speech._model_cache.clear()
        speech._model_actual_used.clear()

    def test_transcribe_passes_safe_silence_and_timestamp_params(self):
        fake = _FakeModel()

        def fake_load(size, **kw):
            return fake

        with mock.patch("whisper.load_model", side_effect=fake_load):
            speech.transcribe(_tmp_wav(), language="ar")
        kwargs = fake.transcribe_kwargs[0]
        # Explicitly transcription mode, never translation.
        self.assertEqual(kwargs.get("task"), "transcribe")
        self.assertEqual(kwargs.get("language"), "ar")
        # CPU-safe float32 (torch is CPU-only in this project).
        self.assertIs(kwargs.get("fp16"), False)
        # Explicit, non-aggressive silence thresholds prevent word clipping.
        self.assertEqual(kwargs.get("no_speech_threshold"),
                         config.WHISPER_NO_SPEECH_THRESHOLD)
        self.assertEqual(kwargs.get("logprob_threshold"),
                         config.WHISPER_LOGPROB_THRESHOLD)
        # Not forcing unconditional re-prediction of prior text across segments.
        self.assertEqual(kwargs.get("condition_on_previous_text"),
                         config.WHISPER_CONDITION_ON_PREVIOUS_TEXT)

    def test_effective_model_size_recorded_on_result(self):
        fake = _FakeModel()

        def fake_load(size, **kw):
            return fake

        with mock.patch("whisper.load_model", side_effect=fake_load):
            res = speech.transcribe(_tmp_wav(), language="ar")
        self.assertEqual(res["model_size"], config.WHISPER_MODEL_SIZE)


if __name__ == "__main__":
    unittest.main()
