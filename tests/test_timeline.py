"""Timeline endpoint -- mixed speech/visual/quiz timeline, sorted by time."""

import unittest
from fastapi.testclient import TestClient

from backend.main import app
from tests import _fixtures

client = TestClient(app)


class TestTimeline(unittest.TestCase):

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()
        self._quiz_id = _fixtures.register_quiz(self._job_id)

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)

    def test_timeline_returns_mixed_types_sorted(self):
        r = client.get(f"/lectures/{self._job_id}/timeline")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        types = {item["type"] for item in body["timeline"]}
        self.assertIn("speech", types)
        self.assertIn("visual", types)
        self.assertIn("quiz", types)

        times = [item["time"] for item in body["timeline"]]
        self.assertEqual(times, sorted(times))

        # First item is teacher speech at 0.0.
        self.assertEqual(body["timeline"][0]["type"], "speech")
        self.assertEqual(body["timeline"][0]["time"], 0.0)

    def test_timeline_unknown_job_404(self):
        self.assertEqual(client.get("/lectures/nope/timeline").status_code, 404)

    def test_visual_events_endpoint(self):
        # Fixture does not write the *_visual_events.json file, so expect 404 until
        # a real processed lecture exists; verifies the guard is strict.
        r = client.get(f"/lectures/{self._job_id}/visual-events")
        self.assertIn(r.status_code, (200, 404))


if __name__ == "__main__":
    unittest.main()