import unittest
import sys
from unittest.mock import MagicMock
from pathlib import Path

# Mocking before imports for offline CI safety.
sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services import knowledge_graph as kg
from backend.services import concept_mapping as cm


class TestKnowledgeGraph(unittest.TestCase):
    """Knowledge graph must be built entirely from real lecture evidence."""

    @classmethod
    def setUpClass(cls):
        cls.graph = kg.get_knowledge_graph("DEMO_python_loops", use_cache=False)

    def test_graph_has_concepts_and_nodes(self):
        self.assertTrue(self.graph["concepts"])
        self.assertTrue(self.graph["nodes"])
        self.assertTrue(self.graph["edges"])

    def test_every_node_and_edge_grounded(self):
        ids = {n["id"] for n in self.graph["nodes"]}
        for e in self.graph["edges"]:
            self.assertIn(e["source"], ids)
            self.assertIn(e["target"], ids)

    def test_concepts_carry_speech_visual_assessed_fields(self):
        for c in self.graph["concepts"]:
            for field in ("concept_id", "label", "source", "status",
                          "speech_count", "visual_count", "assessment_count"):
                self.assertIn(field, c)
            self.assertIsInstance(c["status"], str)
            self.assertIn(c["status"], {
                kg.STATUS_EXPLAINED, kg.STATUS_VISUALLY_SHOWN,
                kg.STATUS_PARTIALLY_EXPLAINED, kg.STATUS_ASSESSED,
                kg.STATUS_MISSING_EXPLANATION, kg.STATUS_UNKNOWN})

    def test_quiz_concepts_are_assessed(self):
        assessed = {c["label"] for c in self.graph["concepts"] if c["assessed"]}
        self.assertIn("loops", assessed)
        self.assertIn("general_programming", assessed)

    def test_speech_links_have_real_snippets_and_timestamps(self):
        for c in self.graph["concepts"]:
            for s in c["speech"]:
                self.assertTrue(s["snippet"])
                self.assertIn("timestamp", s)
                self.assertIn("segment_id", s)

    def test_visual_links_only_from_readable_content(self):
        for c in self.graph["concepts"]:
            for v in c["visual"]:
                self.assertIn("trust", v)
                self.assertIn("event_id", v)

    def test_graph_is_deterministic(self):
        again = kg.get_knowledge_graph("DEMO_python_loops", use_cache=False)
        self.assertEqual(
            [(c["label"], c["status"]) for c in self.graph["concepts"]],
            [(c["label"], c["status"]) for c in again["concepts"]],
        )


class TestConceptMapping(unittest.TestCase):
    def test_mapping_grounded(self):
        from backend import storage
        job = storage.get_job("DEMO_python_loops")
        m = cm.map_concept_to_evidence("for loop", job, cm._graph_data(job))
        self.assertTrue(m["has_speech"])
        # All speech links point at real transcript text.
        for s in m["speech"]:
            self.assertTrue(s["snippet"])

    def test_all_evidence_mappings(self):
        allm = cm.all_evidence_mappings("DEMO_python_loops")
        self.assertTrue(allm["concepts"])
        for c in allm["concepts"]:
            self.assertIn("status", c)
            self.assertIn("assessed", c)

    def test_explain_mapping_honest_for_missing(self):
        self.assertEqual(cm.explain_mapping(
            {"speech": [], "visual": []}),
            ["No lecture evidence was found that teaches this concept."])


if __name__ == '__main__':
    unittest.main()
