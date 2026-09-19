"""End-to-end / demo-mode flow through the public API against a fixture lecture."""

import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app
from tests import _fixtures

client = TestClient(app)


class TestEndToEnd(unittest.TestCase):

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()
        self._quiz_id = _fixtures.register_quiz(self._job_id)
        self._student = f"itest_e2e_{self._job_id[:6]}"

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)
        _fixtures.remove_history(self._student)
        _fixtures.remove_profile(self._student)

    def test_full_demo_flow(self):
        # DEMO MODE: browse an already-processed lecture...
        lectures = client.get("/lectures").json()["lectures"]
        rec = next((l for l in lectures if l["job_id"] == self._job_id), None)
        self.assertIsNotNone(rec)
        self.assertEqual(rec["status"], "done")
        self.assertTrue(rec["assets"]["quiz"])

        # ...read the transcript...
        t = client.get(f"/lectures/{self._job_id}/transcript").json()
        self.assertGreaterEqual(len(t["segments"]), 1)

        # ...review the timeline...
        tl = client.get(f"/lectures/{self._job_id}/timeline").json()["timeline"]
        self.assertGreaterEqual(len(tl), 4)

        # ...ask a question...
        @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
        def _ask(_mock_call_llm):
            return client.post("/ask", json={"job_id": self._job_id, "question": "variable"}).json()
        answer = _ask()
        self.assertIn("answer", answer)
        self.assertTrue(answer["source_refs"]["transcript_segments"])

        # ...take the quiz...
        quiz = client.get(f"/quizzes/{self._quiz_id}").json()["questions"]
        self.assertEqual(len(quiz), 2)
        answers = {"0": quiz[0]["options"][0], "1": quiz[1]["options"][0]}

        # ...submit and get adaptive reinforcement --
        submit = client.post("/quizzes/submit", json={
            "quiz_id": self._quiz_id, "answers": answers,
            "student_id": self._student, "lesson_title": "Python Basics",
        }).json()
        self.assertEqual(submit["total"], 2)
        self.assertIn("next_difficulty", submit)

        # ...and the student dashboard reflects the session.
        student = client.get(f"/students/{self._student}").json()
        self.assertEqual(len(student["history"]["attempts"]), 1)


if __name__ == "__main__":
    unittest.main()