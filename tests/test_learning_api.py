"""Tests for the Intelligent Multimodal Learning Engine API endpoints."""

import unittest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

DEMO = "DEMO_python_loops"


class TestLearningApi(unittest.TestCase):
    def test_knowledge_graph_endpoint(self):
        r = client.get(f"/lectures/{DEMO}/knowledge-graph")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("concepts", body)
        self.assertIn("nodes", body)
        self.assertIn("edges", body)

    def test_concepts_endpoint(self):
        r = client.get(f"/lectures/{DEMO}/concepts")
        self.assertEqual(r.status_code, 200)
        self.assertIn("concepts", r.json())

    def test_learning_gaps_endpoint(self):
        r = client.get(f"/lectures/{DEMO}/learning-gaps")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("gaps", body)
        self.assertIn("concepts_reviewed", body)

    def test_explain_concept_endpoint(self):
        r = client.get(f"/lectures/{DEMO}/concepts/while%20loop/explain")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("covered", body)
        self.assertIn("headline", body)
        self.assertIn("spoken", body)

    def test_learning_agent_endpoint(self):
        r = client.get("/students/default/learning-agent")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("has_history", body)
        self.assertIn("insights", body)
        self.assertIn("recommended_actions", body)

    def test_next_action_endpoint(self):
        r = client.get("/students/default/next-action")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("action_type", body)
        self.assertIn("grounded_on", body)

    def test_learning_insights_endpoint(self):
        r = client.get("/students/default/learning-insights")
        self.assertEqual(r.status_code, 200)
        self.assertIn("insights", r.json())

    def test_student_lecture_gaps_endpoint(self):
        r = client.get(f"/lectures/{DEMO}/students/default/learning-gaps")
        self.assertEqual(r.status_code, 200)
        self.assertIn("gaps", r.json())

    def test_unknown_lecture_404(self):
        for path in (f"/lectures/nope/knowledge-graph", f"/lectures/nope/learning-gaps",
                     f"/lectures/nope/concepts/loop/explain"):
            r = client.get(path)
            self.assertEqual(r.status_code, 404)

    def test_next_action_no_history_is_honest(self):
        r = client.get("/students/never_even_had_history/next-action")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["insufficient_history"])
        self.assertIsNone(body["timestamp"])


if __name__ == "__main__":
    unittest.main()
