import unittest
from unittest.mock import patch, MagicMock
import json
import sys

# Mocking before imports
sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services import accessibility, pipeline

class TestAccessibilityPipeline(unittest.TestCase):

    def test_normalize_visual_events(self):
        raw_events = [
            {"timestamp": 5.0, "type": "code", "description": "print(x)"},
            {"start": 10.0, "end": 15.0, "type": "slide", "description": "Slide 1"}
        ]
        norm = accessibility.normalize_visual_events(raw_events, "job123")
        self.assertEqual(len(norm), 2)
        self.assertEqual(norm[0]["start"], 5.0)
        self.assertEqual(norm[0]["end"], 5.0)
        self.assertEqual(norm[0]["event_id"], "event_001")
        self.assertEqual(norm[1]["start"], 10.0)
        self.assertEqual(norm[1]["end"], 15.0)
        self.assertEqual(norm[0]["source_refs"]["visual_events"], ["event_001"])

    def test_calculate_visual_importance(self):
        # Educational word matching
        event1 = {
            "type": "code",
            "confidence": 0.9,
            "description": "def binary_search(arr):",
            "transcript_context": "Let's code binary search"
        }
        score1 = accessibility.calculate_visual_importance(event1)
        self.assertGreater(score1, 0.5)

        # Repetitive visual event should have lower score
        event2 = {
            "type": "code",
            "confidence": 0.9,
            "description": "def binary_search(arr):",
            "transcript_context": "Let's code binary search"
        }
        score2 = accessibility.calculate_visual_importance(event2, previous_event=event1)
        self.assertLess(score2, score1)

    def test_should_describe_event(self):
        # High value visual event
        event = {
            "type": "code",
            "confidence": 0.95,
            "description": "x = 10",
            "transcript_context": ""
        }
        res = accessibility.should_describe_event(event, mode="blind")
        self.assertTrue(res["should_describe"])
        self.assertIn(res["priority"], ("high", "critical"))

        # Deaf mode should skip description if transcript covers it
        event_with_speech = {
            "type": "slide",
            "confidence": 0.9,
            "description": "Title",
            "transcript_context": "Title"
        }
        res_deaf = accessibility.should_describe_event(event_with_speech, mode="deaf")
        self.assertFalse(res_deaf["should_describe"])

    def test_estimate_speech_duration(self):
        self.assertAlmostEqual(accessibility.estimate_speech_duration("hello world", rate=1.0), 0.8) # 2 words / 2.5 wps = 0.8s
        self.assertAlmostEqual(accessibility.estimate_speech_duration("hello world", rate=2.0), 0.4) # 2 words / 5.0 wps = 0.4s

    def test_build_accessibility_segments_overlap_prevention(self):
        segments = [
            {"id": "seg_001", "start": 0.0, "end": 2.0, "text": "Hello students"},
            {"id": "seg_002", "start": 3.0, "end": 5.0, "text": "Today we learn variables"}
        ]
        # Event overlaps segment 1, description takes longer than available pause (1.0s between 2.0s and 3.0s)
        events = [
            {
                "start": 0.0,
                "end": 2.5,
                "type": "code",
                "confidence": 0.9,
                "description": "This is a very long visual description that takes many seconds to speak out loud."
            }
        ]
        
        # Priority low -> should be skipped to prevent overlap
        with patch('backend.services.accessibility.calculate_visual_importance', return_value=0.2):
            acc_segs = accessibility.build_accessibility_segments(segments, events, {"accessibility_mode": "blind", "speech_rate": 1.0})
            self.assertFalse(acc_segs[0]["should_describe"])

    def test_hallucination_protection(self):
        # Low confidence event should prepend "It appears that "
        event = {
            "type": "slide",
            "confidence": 0.3,
            "description": "A notebook"
        }
        desc = accessibility._safe_description(event, mode="blind")
        self.assertTrue(desc.startswith("It appears that "))

        # Unavailable descriptions should return default unclear visual notice
        event_unavail = {
            "type": "scene",
            "confidence": 0.0,
            "description": "Unavailable visual analysis"
        }
        desc_unavail = accessibility._safe_description(event_unavail, mode="blind")
        self.assertEqual(desc_unavail, "The visual information is unclear.")

    def test_json_serialization_and_backward_compatibility(self):
        segments = [{"id": "seg_001", "start": 0.0, "end": 2.0, "text": "Hello"}]
        events = [{"start": 0.0, "end": 2.0, "type": "slide", "description": "Slide"}]
        content = accessibility.build_accessibility_content("job123", "Hello", segments, events)
        
        # Verify keys exist
        self.assertEqual(content["job_id"], "job123")
        self.assertIn("captions", content)
        self.assertIn("quality_score", content)
        self.assertIn("metrics", content)
        
        # JSON serialize check
        serialized = json.dumps(content)
        self.assertTrue(isinstance(serialized, str))

if __name__ == '__main__':
    unittest.main()
