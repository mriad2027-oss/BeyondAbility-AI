""""What am I missing?" + evidence endpoints -- API contract and honesty gates."""

import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services import evidence
from tests import _fixtures

client = TestClient(app)


class TestMissingEndpoint(unittest.TestCase):

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)

    def test_missing_returns_grounded_items(self):
        r = client.get(f"/lectures/{self._job_id}/missing")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertGreaterEqual(len(body["items"]), 1)
        item = body["items"][0]
        for key in ("timestamp", "timestamp_start", "timestamp_end",
                    "what_you_hear", "missing_information", "what_you_might_miss",
                    "why_it_matters", "source_event", "trust"):
            self.assertIn(key, item)
        self.assertIn("visual_complement_score", item)

    def test_missing_profile_mode_is_admitted(self):
        r = client.get(f"/lectures/{self._job_id}/missing", params={"mode": "deaf"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["profile_mode"], "deaf")

    def test_missing_unknown_job_404(self):
        self.assertEqual(client.get("/lectures/nope/missing").status_code, 404)


class TestEvidenceEndpoint(unittest.TestCase):

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)

    def test_evidence_records_and_composite_trust(self):
        r = client.get(f"/lectures/{self._job_id}/evidence")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(isinstance(body.get("evidence"), list))
        self.assertIn(body.get("overall_trust", {}).get("trust"),
                      (evidence.TRUST_VERIFIED, evidence.TRUST_UNCERTAIN, evidence.TRUST_UNAVAILABLE))

    def test_evidence_unknown_job_404(self):
        self.assertEqual(client.get("/lectures/nope/evidence").status_code, 404)


class TestMissingBackwardCompatibility(unittest.TestCase):
    """Hearing-only lectures (no visual events) keep the accessibility fallback."""

    def test_fallback_when_no_visual_events(self):
        from backend import storage
        from copy import deepcopy
        job_id, blueprint = _fixtures.register_lecture()
        try:
            job = storage.get_job(job_id)
            result = deepcopy(job["result"])
            result["visual_events"] = []
            job["result"] = result
            from backend import config
            import json, uuid
            path = storage._job_path(job_id)
            path.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")
            r = client.get(f"/lectures/{job_id}/missing")
            self.assertEqual(r.status_code, 200)
            # Fallback surfaces old-style accessibility events, still honest.
            self.assertTrue(isinstance(r.json()["items"], list))
        finally:
            _fixtures.remove_lecture(job_id)


if __name__ == "__main__":
    unittest.main()