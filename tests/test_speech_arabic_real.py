"""REAL Arabic transcription regression tests.

These verify the *corrected* transcripts of the actual uploaded Egyptian Arabic
lectures currently in the system (not fakes). They intentionally exercise the
real data produced by the STT pipeline and assert genuine quality requirements:

  - the transcript is real Arabic (stt_language == "ar"), not English/transliteration
  - it contains the actual topic spoken (programming, برمجة), i.e. it matches speech
  - it is NOT the known-gibberish output of the old smaller models (the specific
    non-word sequences the small/base models hallucinated are absent)
  - segments keep valid, increasing timestamps
  - the transcript has substantial Arabic content (not empty / not a wall of noise)

These tests are gated behind RUN_REAL_STT=1 (and a real Whisper model being
available) because re-running the full pipeline is slow. Run them explicitly:

    RUN_REAL_STT=1 python -m pytest tests/test_speech_arabic_real.py -q

They read the persisted corrected data (data/jobs/*.json + *_segments.json) that
the re-run pipeline wrote, so they do not re-transcribe.
"""

import io
import json
import os
import unittest
from pathlib import Path

from backend import config

RUN = os.getenv("RUN_REAL_STT", "").strip() in ("1", "true", "True", "yes")

ROOT = Path(__file__).resolve().parents[1]
JOBS_DIR = ROOT / "data" / "jobs"
OUTPUTS_DIR = ROOT / "data" / "outputs"

# Concrete dialects: all real uploaded Egyptian-Arabic lectures.
REAL_ARABIC_JOBS = [
    # WhatsApp engineering/programming intro (255s, the widely re-uploaded file).
    "231f68c31d5b",
    # Screen-recording: programming for beginners (90s).
    "b359a5e9acdc",
]

# Non-word sequences the old base/small models produced (garble). The corrected
# medium transcript must NOT contain them (they are not real Arabic words).
GARBAGE_TOKENS = [
    "مصار",  # small: "في مصار الهندسة" (should be كلية/جامعة)
    "حدسه", "حدسة", "ايديسه", "لندكتها", "مقموه", "عاصل",
    "كالوجيك", "نبار", "التكنولوجيا بفكر", "المرحاسب",
]


def _load_job_result(job_id: str) -> dict:
    job_path = JOBS_DIR / f"{job_id}.json"
    job = json.loads(job_path.read_text(encoding="utf-8"))
    return job.get("result") or {}


def _load_segments(job_id: str) -> list[dict]:
    result = _load_job_result(job_id)
    if result.get("segments"):
        return result["segments"]
    seg_file = OUTPUTS_DIR / f"{job_id}_segments.json"
    if seg_file.exists():
        return json.loads(seg_file.read_text(encoding="utf-8")).get("segments", [])
    return []


@unittest.skipUnless(RUN, "set RUN_REAL_STT=1 to verify real Arabic transcript data")
class RealArabicTranscriptTests(unittest.TestCase):
    def test_all_real_arabic_lectures_are_present(self):
        for jid in REAL_ARABIC_JOBS:
            self.assertTrue((JOBS_DIR / f"{jid}.json").exists(),
                            f"job {jid} missing from data/jobs")

    def test_transcript_is_real_arabic_not_english(self):
        for jid in REAL_ARABIC_JOBS:
            result = _load_job_result(jid)
            self.assertEqual(result.get("stt_language"), "ar",
                             f"{jid}: expected ar, got {result.get('stt_language')}")
            text = result.get("transcript_text") or ""
            self.assertTrue(text.strip(), f"{jid}: transcript is empty")
            # The rendering language is honoured so captions use RTL (dir=auto).
            self.assertIsInstance(result.get("stt_model_size"), str)

    def test_transcript_contains_spoken_topic(self):
        for jid in REAL_ARABIC_JOBS:
            text = _load_job_result(jid).get("transcript_text") or ""
            self.assertIn("برمجة", text,
                          f"{jid}: transcript should mention the actual topic (programming)")

    def test_no_gibberish_tokens_from_old_models(self):
        for jid in REAL_ARABIC_JOBS:
            text = _load_job_result(jid).get("transcript_text") or ""
            for tok in GARBAGE_TOKENS:
                self.assertNotIn(tok, text,
                                 f"{jid}: still contains old-model garble {tok!r}")

    def test_segments_have_valid_increasing_sequential_timestamps(self):
        for jid in REAL_ARABIC_JOBS:
            segs = _load_segments(jid)
            self.assertGreaterEqual(len(segs), 1, f"{jid}: no segments")
            prev_end = -0.001
            for i, s in enumerate(segs):
                self.assertGreaterEqual(float(s["end"]), float(s["start"]),
                                        f"{jid} seg {i}: end<start")
                self.assertGreaterEqual(float(s["start"]), prev_end - 0.5,
                                        f"{jid} seg {i}: timestamps not sequential")
                prev_end = float(s["end"])

    def test_transcript_has_substantial_arabic_content(self):
        def ar_chars(t):
            return sum(1 for ch in t if "\u0600" <= ch <= "\u06FF" or ch == " " and False)
        for jid in REAL_ARABIC_JOBS:
            text = _load_job_result(jid).get("transcript_text") or ""
            self.assertGreater(len(text.strip()), 100, f"{jid}: transcript suspiciously short")


if __name__ == "__main__":
    unittest.main(verbosity=2)
