"""Accessibility-specific endpoints: 'What am I missing?' + per-mode representation."""

import json
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.main import app
from backend import config, storage
from tests import _fixtures

client = TestClient(app)


class TestAccessibility(unittest.TestCase):

    def setUp(self):
        self._job_id, self._job = _fixtures.register_lecture()
        # Materialise the accessibility JSON on disk so per-mode routes can serve it.
        stem = Path(self._job["video_path"]).stem
        self._acc_file = config.OUTPUTS_DIR / f"{stem}_accessibility_blind.json"
        payload = {
            "lecture_id": self._job_id,
            "mode": "blind",
            "accessibility_events": self._job["result"]["accessibility_events"],
        }
        self._acc_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)
        try:
            self._acc_file.unlink()
        except OSError:
            pass

    def test_missing_returns_grounded_items(self):
        r = client.get(f"/lectures/{self._job_id}/missing")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("summary", body)
        self.assertEqual(len(body["items"]), 2)
        item = body["items"][0]
        for key in ("timestamp_start", "timestamp_end", "what_you_hear",
                    "what_you_might_miss", "why_it_matters", "confidence"):
            self.assertIn(key, item)
        # Drops items that should not be described.
        for item in body["items"]:
            self.assertTrue(item["what_you_might_miss"])

    def test_accessibility_by_mode(self):
        r = client.get(f"/lectures/{self._job_id}/accessibility", params={"mode": "blind"})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["mode"], "blind")
        self.assertGreaterEqual(len(body["accessibility_events"]), 1)

    def test_accessibility_graceful_when_absent(self):
        job_id, _ = _fixtures.register_lecture()
        try:
            r = client.get(f"/lectures/{job_id}/accessibility", params={"mode": "hearing"})
            self.assertEqual(r.status_code, 404)
        finally:
            _fixtures.remove_lecture(job_id)

    def test_unknown_job_404(self):
        self.assertEqual(client.get("/lectures/nope/missing").status_code, 404)

    def test_transcript_endpoint(self):
        r = client.get(f"/lectures/{self._job_id}/transcript")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(len(body["segments"]), 2)
        self.assertIn("variable", body["transcript_text"])


if __name__ == "__main__":
    unittest.main()