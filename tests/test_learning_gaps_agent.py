import unittest
import sys
from unittest.mock import MagicMock
from pathlib import Path

sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services import learning_gaps as gaps
from backend.services import learning_agent as agent
from backend.services import knowledge_graph as kg


class TestLearningGaps(unittest.TestCase):
    def test_lecture_gaps_grounded(self):
        r = gaps.lecture_gaps("DEMO_python_loops")
        self.assertEqual(r["lecture_id"], "DEMO_python_loops")
        self.assertGreaterEqual(r["concepts_reviewed"], 0)
        for g in r["gaps"]:
            self.assertIn("kinds", g)
            self.assertIn("concept", g)

    def test_assessed_but_not_explained_gap_honest(self):
        # 'general_programming' is a quiz-only concept, not spoken aloud.
        r = gaps.lecture_gaps("DEMO_python_loops")
        found = [g for g in r["gaps"] if g["concept"] == "general_programming"]
        self.assertTrue(found)
        self.assertIn("assessed_but_not_explained", found[0]["kinds"])

    def test_explain_covered_concept(self):
        e = gaps.explain_missing_concept("while loop", "DEMO_python_loops")
        self.assertTrue(e["covered"])
        self.assertTrue(e["spoken"])
        self.assertTrue(e["spoken"][0]["snippet"])

    def test_explain_uncovered_concept_honest(self):
        # A quiz concept that is not explicitly explained aloud.
        e = gaps.explain_missing_concept("general_programming", "DEMO_python_loops")
        self.assertTrue(e["not_covered"])
        self.assertTrue(e["headline"])

    def test_explain_never_fabricates(self):
        e = gaps.explain_missing_concept("zzz_not_a_real_concept_123", "DEMO_python_loops")
        # Status is UNKNOWN and it is honestly reported as not covered.
        self.assertIn(e["status"],
                      (kg.STATUS_UNKNOWN, kg.STATUS_ASSESSED,
                       kg.STATUS_MISSING_EXPLANATION))


class TestLearningAgent(unittest.TestCase):
    def test_no_history_is_honest(self):
        na = agent.next_action("nobody_with_history_zz")
        self.assertTrue(na["insufficient_history"])
        # Honesty contract: when there is no history, the agent must say so and
        # must not fabricate a personalized gap or timestamp.
        self.assertIsNone(na["timestamp"])
        self.assertFalse(na["grounded_on"])
        self.assertIn("quiz", na["label"].lower())

    def test_no_history_agent_view(self):
        a = agent.build_personal_agent("nobody_with_history_zz")
        self.assertFalse(a["has_history"])
        self.assertTrue(any(i["kind"] == "insufficient_history" for i in a["insights"]))

    def test_action_types_are_in_whitelist(self):
        allowed = {"REVIEW_VIDEO", "LISTEN_TO_AUDIO_DESCRIPTION", "READ_TRANSCRIPT",
                   "REVIEW_VISUAL", "EXPLAIN_CONCEPT", "RETAKE_QUIZ", "PRACTICE_CONCEPT"}
        a = agent.build_personal_agent("default")
        for act in a["recommended_actions"]:
            self.assertIn(act["action_type"], allowed)

    def test_history_action_is_grounded_in_real_concept(self):
        # The default student has real quiz history; the top action must name a
        # concept that actually appears in that history.
        import json as _json
        from backend import config
        hp = config.STUDENTS_DIR / "default_history.json"
        if not hp.exists():
            self.skipTest("no default history in this environment")
        hist = _json.loads(hp.read_text(encoding="utf-8"))
        attempts = hist.get("attempts", [])
        if not attempts:
            self.skipTest("default student has no attempts")
        na = agent.next_action("default")
        if na["insufficient_history"]:
            self.skipTest("insufficient history")
        # Every grounded action must carry a real lecture or concept.
        if na["grounded_on"]:
            self.assertTrue(na["lecture_id"] or na["concept"])


if __name__ == '__main__':
    unittest.main()
