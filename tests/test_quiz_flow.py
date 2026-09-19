"""Quiz API flow: list, sanitized fetch, graded submission, adaptive reinforcement."""

import json
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.main import app
from backend import config
from tests import _fixtures

client = TestClient(app)


class TestQuizFlow(unittest.TestCase):

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()
        self._quiz_id = _fixtures.register_quiz(self._job_id)
        self._student = f"itest_quiz_{self._job_id[:6]}"

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)
        _fixtures.remove_history(self._student)
        _fixtures.remove_profile(self._student)

    def test_list_quizzes_contains_fixture(self):
        quizzes = client.get("/quizzes").json()["quizzes"]
        self.assertIn(self._quiz_id, quizzes)

    def test_get_quiz_does_not_leak_answers(self):
        r = client.get(f"/quizzes/{self._quiz_id}")
        self.assertEqual(r.status_code, 200)
        for q in r.json()["questions"]:
            self.assertNotIn("answer", q)
            self.assertIn("question", q)
            self.assertIn("options", q)

    def test_get_unknown_quiz_404(self):
        self.assertEqual(client.get("/quizzes/zzz_nope").status_code, 404)

    def test_submit_unknown_quiz_404(self):
        r = client.post("/quizzes/submit", json={
            "quiz_id": "zzz_nope", "answers": {}, "student_id": self._student,
        })
        self.assertEqual(r.status_code, 404)

    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_submit_grades_and_persists_history(self, _mock):
        answers = {
            "0": "Stores data",        # correct (index 0)
            "1": "False",              # wrong
        }
        r = client.post("/quizzes/submit", json={
            "quiz_id": self._quiz_id,
            "answers": answers,
            "student_id": self._student,
            "lesson_title": "Python Basics",
        })
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["score_percent"], 50.0)
        self.assertEqual(body["correct_count"], 1)
        self.assertEqual(body["total"], 2)
        self.assertIn("weak_topics", body)
        self.assertIn("recommendation", body)
        self.assertTrue(any(t["topic"] == "loops" and t["score"] < 0.7 for t in body["weak_topics"]))

        # History file persisted + student API enriches it.
        hist_path = config.STUDENTS_DIR / f"{self._student}_history.json"
        self.assertTrue(hist_path.exists())
        history = json.loads(hist_path.read_text(encoding="utf-8"))
        self.assertEqual(len(history["attempts"]), 1)
        self.assertIn("Python Basics", [l["title"] for l in history["recent_activity"]])

        student = client.get(f"/students/{self._student}").json()
        self.assertEqual(len(student["history"]["attempts"]), 1)

    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_full_marks_triggers_harder_difficulty(self, _mock):
        earlier = client.post(f"/students/{self._student}/profile", json={
            "student_id": self._student, "accessibility_mode": "standard", "quiz_difficulty": "adaptive",
        })
        self.assertEqual(earlier.status_code, 200)

        answers = {"0": "Stores data", "1": "True"}
        body = client.post("/quizzes/submit", json={
            "quiz_id": self._quiz_id, "answers": answers,
            "student_id": self._student, "lesson_title": "Python Basics",
        }).json()
        self.assertEqual(body["score_percent"], 100.0)
        self.assertEqual(body["correct_count"], 2)
        self.assertEqual(body["next_difficulty"], "hard")


if __name__ == "__main__":
    unittest.main()