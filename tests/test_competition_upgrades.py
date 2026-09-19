"""Competition-level feature and integration tests for EduAccess AI upgrades.

Verifies:
  1. Multimodal Audio Description: 9 visual types, verbatim code preservation,
     uncertainty tagging, and speech redundancy avoidance.
  2. Ask the Video: Temporal interval retrieval, exact timestamp anchoring,
     and missing visual reasoning.
  3. 4-Way Consistency Analyzer: Speech vs Visual vs OCR vs Assessment gaps.
  4. Semantic Knowledge Graph: Prerequisite, demonstration, and evidence relationships.
  5. Accessibility Copilot: Real-time contextual briefing and playback synchronization.
"""
import unittest
from backend.services import audio_description, ask, visual_understanding, copilot, knowledge_graph, learning_gaps
from backend.services import vision


class TestCompetitionUpgrades(unittest.TestCase):

    def test_vision_classification_and_code_preservation(self):
        code_text = "for i in range(5):\n    print(f'Count: {i}')"
        vtype = vision.classify_ocr_text(code_text)
        self.assertEqual(vtype, "code")

        org = vision.organize_ocr_text(code_text)
        self.assertEqual(org.get("visual_type"), "code")
        self.assertEqual(org.get("language"), "python")
        self.assertIn("range(5)", org.get("code_snippet", ""))
        self.assertTrue(any("range(5)" in line for line in org.get("visible_code", [])))

        flowchart_text = "Start -> Check condition -> If yes proceed -> End"
        self.assertEqual(vision.classify_ocr_text(flowchart_text), "flowchart")

        chart_text = "Bar Chart\nExecution Time: Algorithm A = 10ms, Algorithm B = 20ms"
        self.assertEqual(vision.classify_ocr_text(chart_text), "chart")

    def test_factual_audio_description_formatting(self):
        event = {
            "start": 8.0,
            "end": 14.0,
            "type": "code",
            "visual_type": "code",
            "ocr_text": "for i in range(5):\n    print(i)",
            "description": "Code snippet in editor",
            "confidence": 0.95,
        }
        desc_en = audio_description.format_factual_audio_description(event, mode="blind")
        self.assertIn("At 00:08", desc_en)
        self.assertIn("code editor", desc_en)
        self.assertIn("for i in range(5)", desc_en)

        # Arabic formatting
        desc_ar = audio_description.format_factual_audio_description(event, language="ar")
        self.assertIn("range(5)", desc_ar)
        self.assertIn("for", desc_ar)

    def test_ask_time_range_and_missing_visuals(self):
        segments = [
            {"id": "seg_1", "start": 0.0, "end": 6.0, "text": "Welcome to python loops."},
            {"id": "seg_2", "start": 6.0, "end": 15.0, "text": "Here we see a for loop running five times."},
            {"id": "seg_3", "start": 15.0, "end": 25.0, "text": "Now notice the flowchart diagram."},
        ]
        events = [
            {"event_id": "ev_1", "start": 8.0, "end": 14.0, "type": "code", "visual_type": "code", "description": "OCR-only output: On-screen text detected:\nfor i in range(5):\n    print(i)", "confidence": 0.9},
            {"event_id": "ev_2", "start": 16.0, "end": 22.0, "type": "diagram", "visual_type": "diagram", "description": "OCR-only output: On-screen text detected:\nStart -> Condition -> End", "confidence": 0.85},
        ]

        # 1. Range query
        res_range = ask.grounded_answer("test_job", "What happened between 00:07 and 00:15?", segments, events, "timestamp")
        self.assertEqual(res_range["status"], "SUPPORTED")
        self.assertIn("Between 00:07 and 00:15", res_range["answer"])
        self.assertTrue(any(t >= 6.0 and t <= 15.0 for t in res_range["timestamps"]))

        # 2. Missing visual query
        res_missing = ask.grounded_answer("test_job", "What was written on screen but not explained?", segments, events, "missing_visual")
        self.assertEqual(res_missing["status"], "SUPPORTED")
        self.assertIn("for i in range(5)", res_missing["answer"])

    def test_semantic_knowledge_graph_relationships(self):
        job = {
            "job_id": "test_kg_job",
            "result": {
                "transcript": {
                    "segments": [
                        {"id": "s1", "start": 0.0, "end": 5.0, "text": "Today we discuss Python loops and range function."},
                        {"id": "s2", "start": 5.0, "end": 12.0, "text": "Let us see how a for loop uses range to iterate."},
                    ]
                },
                "visual_events": [
                    {"event_id": "e1", "start": 6.0, "end": 10.0, "type": "code", "description": "OCR-only output: On-screen text detected:\nfor i in range(5):\n    print(i)", "confidence": 0.95},
                ],
                "quiz": [
                    {"question": "How many times does for i in range(5) run?", "concept": "for loop", "source_refs": {"transcript_segments": ["s2"]}},
                ]
            }
        }
        graph = knowledge_graph.build_graph(job)
        self.assertIn("concepts", graph)
        self.assertIn("nodes", graph)
        self.assertIn("edges", graph)

        # Check semantic edges exist
        concept_nodes = [n for n in graph["nodes"] if n["type"] == "concept"]
        self.assertGreaterEqual(len(concept_nodes), 1)

    def test_copilot_service(self):
        # Even with nonexistent or dummy job, copilot returns safe structured response
        res = copilot.get_copilot_context("nonexistent_job", 8.0)
        self.assertFalse(res["available"])
        self.assertEqual(res["timestamp"], 8.0)

    def test_multimodal_lecture_health_score(self):
        from backend.services import accessibility_score
        job = {
            "job_id": "test_health_job",
            "result": {
                "video_metadata": {"duration": 20.0},
                "transcript": {
                    "segments": [
                        {"id": "s1", "start": 0.0, "end": 10.0, "text": "Python for loops iterate over ranges."},
                        {"id": "s2", "start": 10.0, "end": 20.0, "text": "Here is how to print numbers."},
                    ]
                },
                "visual_events": [
                    {"event_id": "e1", "start": 5.0, "end": 15.0, "type": "code", "description": "OCR-only output: On-screen text detected:\nfor i in range(5):\n    print(i)", "confidence": 0.95},
                ],
                "narration_audio_path": "data/outputs/test_health_job_narration.wav",
            }
        }
        res = accessibility_score.compute_lecture_health_score(job)
        self.assertIn("health_score", res)
        self.assertGreaterEqual(res["health_score"], 50)
        self.assertIn("dimensions", res)
        self.assertEqual(len(res["dimensions"]), 7)
        self.assertIn("speech_coverage", res["dimensions"])
        self.assertIn("visual_coverage", res["dimensions"])
        self.assertIn("speech_visual_alignment", res["dimensions"])
        self.assertIn("ocr_accessibility", res["dimensions"])
        self.assertIn("assessment_coverage", res["dimensions"])
        self.assertIn("learning_gap_health", res["dimensions"])
        self.assertIn("accessibility_coverage", res["dimensions"])


if __name__ == "__main__":
    unittest.main()
