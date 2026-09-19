"""Arabic speech-to-text regression tests.

Verifies (without requiring a real Whisper model download, which would be slow
and environment-dependent) that:

  - Arabic is treated as a first-class language: confidently-detected Arabic is
    forced to the "ar" language code.
  - The pipeline always uses transcription mode (task="transcribe"), never
    translation, so Arabic speech is never turned into English.
  - Provided Arabic text/segments round-trip unchanged (no translation /
    transliteration / fabrication) and keep valid timestamps.
  - Empty/unclear audio produces no fabricated text.
  - Existing English behaviour (language=None, task="transcribe") still works.

The real Arabic lecture is verified separately by re-running the pipeline
against the actual uploaded audio (see the run book / report).
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

from backend.services import speech
from backend import config


class _FakeModel:
    """Minimal stand-in for a Whisper model so tests are fast and offline."""

    class _Device:
        pass

    def __init__(self, detect_probs, transcribe_result):
        self.device = self._Device()
        self._detect = detect_probs
        self._transcribe = transcribe_result
        self.transcribe_kwargs = []

    def detect_language(self, mel):
        # Whisper returns (language_token, {lang: prob}).
        return max(self._detect, key=self._detect.get), dict(self._detect)

    def transcribe(self, *args, **kwargs):
        self.transcribe_kwargs.append(kwargs)
        res = dict(self._transcribe)
        res["language"] = res.get("language") or kwargs.get("language")
        return res


_TMP_FILES = []


def _tmp_wav(name="probe.wav"):
    """Create a real (empty) file so the path-exists guard passes."""
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    with open(path, "wb") as f:
        f.write(b"\x00" * 100)
    _TMP_FILES.append(path)
    return path


def tearDownModule():
    for p in _TMP_FILES:
        try:
            os.remove(p)
        except OSError:
            pass


def _make_transcribe_result(arabic_text, segments=None):
    segs = segments or [
        {"id": 0, "start": 0.0, "end": 4.0, "text": arabic_text},
    ]
    return {"text": arabic_text, "segments": segs, "language": "ar"}


class ResolveLanguageTests(unittest.TestCase):
    """The language-forcing decision is deterministic and Arabic-first."""

    def test_confident_arabic_forces_ar(self):
        detected = {"language": "ar", "confidence": 0.9,
                    "probabilities": {"ar": 0.9, "en": 0.08}}
        self.assertEqual(speech.resolve_language(detected), "ar")

    def test_low_confidence_arabic_does_not_force(self):
        detected = {"language": "en", "confidence": 0.6,
                    "probabilities": {"en": 0.6, "ar": 0.4}}
        self.assertIsNone(speech.resolve_language(detected))

    def test_english_not_forced_keeps_existing_behavior(self):
        detected = {"language": "en", "confidence": 0.99,
                    "probabilities": {"en": 0.99}}
        self.assertIsNone(speech.resolve_language(detected))

    def test_none_detected_is_safe(self):
        self.assertIsNone(speech.resolve_language(None))


class TranscribeModeTests(unittest.TestCase):
    """Transcription (never translation) + correct language passing."""

    def _patch(self, result, detect_probs=None):
        fake = _FakeModel(detect_probs or {"ar": 0.9, "en": 0.08}, result)
        patcher = mock.patch.object(speech, "_load_model", return_value=fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return fake

    def test_arabic_transcribed_with_task_transcribe_not_translate(self):
        txt = "شباب لو انت داخل على مادة البرمجة"
        fake = self._patch(_make_transcribe_result(txt))
        out = speech.transcribe(_tmp_wav(), language="ar")
        kwargs = fake.transcribe_kwargs[0]
        # Explicitly transcription mode, NOT translation.
        self.assertEqual(kwargs.get("task"), "transcribe")
        self.assertEqual(kwargs.get("language"), "ar")
        # Arabic text preserved verbatim (not translated/transliterated).
        self.assertEqual(out["text"], txt)
        self.assertEqual(out["language"], "ar")

    def test_default_language_none_keeps_english_behavior(self):
        txt = "Welcome to the world of computer science."
        fake = self._patch(_make_transcribe_result(txt))
        out = speech.transcribe(_tmp_wav())
        kwargs = fake.transcribe_kwargs[0]
        self.assertIsNone(kwargs.get("language"))
        self.assertEqual(kwargs.get("task"), "transcribe")
        self.assertEqual(out["text"], txt)

    def test_segments_have_valid_increasing_timestamps(self):
        segs = [
            {"id": 0, "start": 0.0, "end": 4.0, "text": "أول"},
            {"id": 1, "start": 4.0, "end": 8.0, "text": "ثاني"},
        ]
        fake = self._patch({"text": "أول ثاني", "segments": segs, "language": "ar"})
        out = speech.transcribe(_tmp_wav(),
                                language="ar",
                                model_size=None)
        segs_out = out["segments"]
        self.assertEqual(len(segs_out), 2)
        for s in segs_out:
            self.assertGreaterEqual(s["end"], s["start"])
        self.assertEqual(segs_out[1]["start"], segs_out[0]["end"])


class DetectLanguageHelpersTests(unittest.TestCase):
    def test_detect_result_is_arabic_first_class(self):
        detect_probs = {"ar": 0.9, "en": 0.07, "fr": 0.01}
        fake = _FakeModel(detect_probs, _make_transcribe_result(""))
        with mock.patch.object(speech, "_load_model", return_value=fake), \
             mock.patch.object(speech, "_load_mel", return_value=object()):
            det = speech.detect_language(_tmp_wav())
        self.assertEqual(det["language"], "ar")
        self.assertGreaterEqual(det["confidence"], 0.5)


class NoFabricationTests(unittest.TestCase):
    """Empty/unclear audio must not produce fabricated text."""

    def test_empty_audio_produces_empty_text_not_guessed(self):
        fake = _FakeModel({}, {"text": "", "segments": [], "language": "ar"})
        with mock.patch.object(speech, "_load_model", return_value=fake):
            out = speech.transcribe(_tmp_wav(), language="ar")
        self.assertEqual(out["text"].strip(), "")
        self.assertEqual(out["segments"], [])

    def test_transcribe_missing_audio_raises(self):
        with self.assertRaises(FileNotFoundError):
            speech.transcribe("/tmp/does_not_exist_xyz.wav")
        with self.assertRaises(FileNotFoundError):
            speech.detect_language("/tmp/does_not_exist_xyz.wav")


if __name__ == "__main__":
    unittest.main()
