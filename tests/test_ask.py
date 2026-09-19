"""'Ask the Video' -- grounded Q&A with deterministic keyword fallback."""

import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app
from tests import _fixtures

client = TestClient(app)


class TestAskTheVideo(unittest.TestCase):

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)

    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_keyword_fallback_anchors_answer(self, _mock):
        r = client.post("/ask", json={"job_id": self._job_id, "question": "What are loops?"})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("answer", body)
        self.assertIn("Loops repeat a block of code.", body["answer"])
        self.assertIn(4.5, body["timestamps"])

    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_answer_carries_evidence_and_verified_trust(self, _mock):
        r = client.post("/ask", json={"job_id": self._job_id, "question": "What are loops?"})
        body = r.json()
        self.assertGreaterEqual(body.get("evidence_records"), 1)
        self.assertEqual(body.get("trust"), "VERIFIED")
        self.assertTrue(body.get("evidence"))
        record = body["evidence"][0]
        self.assertIn("source_type", record)
        self.assertIn("trust", record)

    @patch("backend.services.llm.call_llm",
           side_effect=lambda *_a, **_k: '{"answer": "Loops repeat code.", "timestamps": [4.5], '
                                         '"source_refs": {"transcript_segments": ["seg_002"], "visual_events": ["event_002"]}}')
    def test_llm_answer_maps_to_evidence(self, _mock):
        r = client.post("/ask", json={"job_id": self._job_id, "question": "What are loops?"})
        body = r.json()
        self.assertGreaterEqual(body.get("evidence_records"), 1)
        self.assertEqual(body["evidence"][0]["segment_id"], "seg_002")

    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: "invalid json here")
    def test_llm_garbage_falls_back_to_keyword(self, _mock):
        r = client.post("/ask", json={"job_id": self._job_id, "question": "variable"})
        body = r.json()
        self.assertIn("variable", body["answer"].lower())
        self.assertTrue(body["source_refs"]["transcript_segments"])

    def test_unanswerable_question_is_honest(self):
        r = client.post("/ask", json={"job_id": self._job_id, "question": "quantum chromodynamics"})
        body = r.json()
        self.assertIn("couldn't find enough information", body["answer"])
        self.assertEqual(body["timestamps"], [])
        self.assertEqual(body.get("evidence_records"), 0)
        self.assertIn(body.get("trust"), ("UNAVAILABLE", "UNCERTAIN"))

    def test_stopword_only_question_is_unanswerable(self):
        r = client.post("/ask", json={"job_id": self._job_id,
                                                      "question": "What is the upload date of this video by the registrar?"})
        body = r.json()
        self.assertIn("couldn't find enough information", body["answer"])
        self.assertEqual(body.get("evidence_records"), 0)

    def test_empty_question_prompt(self):
        r = client.post("/ask", json={"job_id": self._job_id, "question": "   "})
        self.assertEqual(r.status_code, 200)
        self.assertIn("Please ask a specific question", r.json()["answer"])

    def test_unknown_lecture(self):
        r = client.post("/ask", json={"job_id": "nope", "question": "anything"})
        body = r.json()
        self.assertEqual(body["answer"], "Lecture not found.")


if __name__ == "__main__":
    unittest.main()