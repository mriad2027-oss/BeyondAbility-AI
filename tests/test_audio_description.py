"""Audio Description: synchronized narration cues + Visual Understanding tie-in.

The no-fabrication guarantee here is critical: a cue is ONLY exposed when the
pipeline actually produced a real narration audio file. Events the teacher
already spoke, or events whose TTS step failed, never become fake "cues".
"""
import json
import unittest
from pathlib import Path

from backend import config
from backend.services import audio_description
from tests import _fixtures

try:
    from fastapi.testclient import TestClient
    from backend.main import app
    _tc = TestClient(app)
    HAS_TC = True
except Exception:  # pragma: no cover - import fallback
    _tc = None
    HAS_TC = False


def _real_file() -> Path:
    p = config.OUTPUTS_DIR / "ad_test_narration.wav"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"RIFF-sample")
    return p


class TestBuildSynchronizedCues(unittest.TestCase):
    def setUp(self):
        self.narration = _real_file()

    def tearDown(self):
        try:
            self.narration.unlink()
        except OSError:
            pass

    def _event(self, **overrides):
        base = {
            "segment_id": "seg_001",
            "start": 0.0,
            "end": 4.0,
            "play_start": 4.0,
            "description": "A stack diagram shows three elements.",
            "transcript": "Loops repeat a block of code.",
            "should_describe": True,
            "priority": "high",
            "confidence": 0.9,
            "source_refs": {"transcript_segments": ["seg_001"], "visual_events": ["event_001"]},
            "narration_audio_path": str(self.narration),
        }
        base.update(overrides)
        return base

    def test_cue_only_when_narration_audio_exists(self):
        # A should_describe event WITHOUT a real audio file must NOT become a cue.
        ev = self._event(narration_audio_path="/nope/missing.wav")
        cues, summary = audio_description.build_synchronized_cues("job", [ev], [])
        self.assertEqual(summary["cues"], 0)
        self.assertEqual(summary["narratable_but_no_audio"], 1)
        self.assertEqual(cues, [])

    def test_un_described_event_never_becomes_cue(self):
        # Even with an audio path, should_describe=False (spoken by teacher) => no cue.
        ev = self._event(should_describe=False, description="")
        cues, summary = audio_description.build_synchronized_cues("job", [ev], [])
        self.assertEqual(cues, [])
        self.assertEqual(summary["narratable_but_no_audio"], 0)

    def test_cue_merges_visual_understanding_by_overlap(self):
        understanding = [{
            "event_id": "event_001", "start": 0.0, "end": 4.0,
            "visual_type": "diagram", "complement_level": "COMPLEMENTARY",
            "trust": {"trust": "VERIFIED"},
            "accessibility_description": {"short": "s", "standard": "std"},
        }]
        ev = self._event()
        cues, summary = audio_description.build_synchronized_cues("job", [ev], understanding)
        self.assertEqual(len(cues), 1)
        cue = cues[0]
        self.assertEqual(cue["visual_type"], "diagram")
        self.assertEqual(cue["complement_level"], "COMPLEMENTARY")
        self.assertTrue(cue["verified"])
        self.assertEqual(cue["accessibility_description"], "std")

    def test_cue_exposes_real_audio_url_and_filename(self):
        ev = self._event()
        cues, _ = audio_description.build_synchronized_cues("job", [ev], [])
        self.assertEqual(cues[0]["audio_filename"], self.narration.name)
        self.assertIn(self.narration.name, cues[0]["audio_url"])

    def test_summary_counts(self):
        evs = [
            self._event(),
            self._event(segment_id="seg_missing", narration_audio_path="/x.wav"),
            self._event(segment_id="seg_narrated", start=10, end=14,
                        narration_audio_path=str(_real_file())),
        ]
        cues, summary = audio_description.build_synchronized_cues("job", evs, [])
        self.assertEqual(summary["cues"], 2)
        self.assertEqual(summary["narratable_but_no_audio"], 1)

    def test_file_url_only_serves_outputs_subtree(self):
        self.assertEqual(audio_description.file_url("C:/outside/secret.wav"), "")
        rel = str(self.narration.resolve().relative_to(config.OUTPUTS_DIR.resolve()))
        self.assertTrue(audio_description.file_url(str(self.narration)).startswith("/files/outputs/"))


@unittest.skipUnless(HAS_TC, "TestClient unavailable")
class TestAudioDescriptionEndpoint(unittest.TestCase):
    def test_missing_job_is_404(self):
        r = _tc.get("/lectures/does_not_exist_xyz/audio-description")
        self.assertEqual(r.status_code, 404)

    def test_endpoint_honest_unavailable_without_cues(self):
        job_id, _ = _fixtures.register_lecture()
        try:
            body = _tc.get(f"/lectures/{job_id}/audio-description").json()
            # No narration files exist for the fixture => honest, no fabricated cues.
            self.assertFalse(body["available"])
            self.assertEqual(body["cues"], [])
            self.assertTrue(body["reason"])
        finally:
            _fixtures.remove_lecture(job_id)

    def test_endpoint_exposes_cue_and_public_audio_url(self):
        job_id, job = _fixtures.register_lecture()
        real = None
        try:
            # Simulate a real narration asset on disk for one event.
            real = _real_file()
            events = job["result"]["accessibility_events"]
            for ev in events:
                ev["narration_audio_path"] = str(real)
            from backend import storage as _storage
            _storage._job_path(job_id).write_text(json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8")

            body = _tc.get(f"/lectures/{job_id}/audio-description").json()
            self.assertTrue(body["available"])
            self.assertGreaterEqual(len(body["cues"]), 1)
            self.assertTrue(body["cues"][0]["audio_url"].startswith("/files/outputs/"))
            self.assertEqual(body["source"], "pipeline")
        finally:
            _fixtures.remove_lecture(job_id)
            if real is not None:
                try:
                    real.unlink()
                except OSError:
                    pass

    def test_every_exposed_cue_url_maps_to_a_served_wav_on_disk(self):
        # The frontend plays narration by de-relativizing cue["audio_url"] against
        # the API host. For real audible playback (no silent 404) every exposed URL
        # must resolve to an existing, non-empty WAV under OUTPUTS_DIR.
        job_id, job = _fixtures.register_lecture()
        real = None
        try:
            real = _real_file()
            events = job["result"]["accessibility_events"]
            for ev in events:
                ev["narration_audio_path"] = str(real)
            from backend import storage as _storage
            _storage._job_path(job_id).write_text(json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8")

            body = _tc.get(f"/lectures/{job_id}/audio-description").json()
            self.assertTrue(body["available"])
            self.assertGreaterEqual(len(body["cues"]), 1)
            for cue in body["cues"]:
                rel = cue["audio_url"][len("/files/outputs/"):]
                f = (config.OUTPUTS_DIR / rel).resolve()
                self.assertTrue(f.is_file(), f"no file for {cue['audio_url']}")
                self.assertGreater(f.stat().st_size, 0, f"empty file for {cue['audio_url']}")
        finally:
            _fixtures.remove_lecture(job_id)
            if real is not None:
                try:
                    real.unlink()
                except OSError:
                    pass
