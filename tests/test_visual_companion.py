"""Visual Companion: grounding, complement score, and profile-aware missing items."""

import unittest

from backend.services import evidence, visual_companion as vc
from tests import _fixtures

SEGS = _fixtures._SAMPLE_SEGMENTS
EVENTS = _fixtures._SAMPLE_EVENTS

UNREADABLE_EVENT = {
    "event_id": "event_003",
    "start": 12.0,
    "end": 16.0,
    "type": "code",
    "description": "OCR-only output: no readable on-screen text",
    "confidence": 0.4,
}

REPEATED_CODE = {
    "event_id": "event_004",
    "start": 20.0,
    "end": 24.0,
    "type": "code",
    "description": "OCR-only output: On-screen text detected:\nx = 1",
    "confidence": 0.9,
}


class TestAnalyzeVisualEvents(unittest.TestCase):

    def setUp(self):
        self.analysis = vc.analyze_visual_events(EVENTS, SEGS, {"duration": 9.0}, "fixture")

    def test_additive_grounding_fields(self):
        ana = self.analysis[0]
        for key in ("lecture_id", "event_id", "start", "end", "type", "description",
                    "overlapping_transcript", "overlapping_segment_ids", "source_frames",
                    "visual_complement_score", "importance", "source", "trust"):
            self.assertIn(key, ana)
        self.assertEqual(ana["event_id"], "event_001")
        self.assertEqual(ana["overlapping_segment_ids"], ["seg_001"])

    def test_previous_next_links(self):
        self.assertIsNone(self.analysis[0]["previous_event_id"])
        self.assertEqual(self.analysis[0]["next_event_id"], "event_002")
        self.assertEqual(self.analysis[1]["previous_event_id"], "event_001")

    def test_consecutive_event_links(self):
        self.assertEqual(self.analysis[0]["next_event_id"], "event_002")


class TestComplementScore(unittest.TestCase):

    def test_high_for_educational_visual_not_covered_by_speech(self):
        ev = {"type": "diagram", "description": "A stack diagram shows three elements."}
        comp = vc.compute_complement_score(ev, overlap_transcript="Loops repeat a block of code.")
        self.assertEqual(comp["score"], "high")
        self.assertIn("diagram content", comp["reason"])

    def test_low_when_transcript_covers_everything(self):
        ev = {"type": "code", "description": "Loops repeat a block of code."}
        comp = vc.compute_complement_score(ev, overlap_transcript="Loops repeat a block of code.")
        self.assertEqual(comp["score"], "low")

    def test_low_for_repeated_event(self):
        first = vc.compute_complement_score(REPEATED_CODE, "")
        second = vc.compute_complement_score(REPEATED_CODE, "", previous_event=REPEATED_CODE)
        self.assertEqual(first["score"], "high")
        self.assertEqual(second["score"], "low")
        self.assertIn("already appeared", second["reason"])

    def test_low_when_unreadable(self):
        comp = vc.compute_complement_score(UNREADABLE_EVENT, "")
        self.assertEqual(comp["score"], "low")


class TestBuildMissingItems(unittest.TestCase):

    def setUp(self):
        self.analysis = vc.analyze_visual_events(EVENTS, SEGS, {"duration": 9.0}, "fixture")

    def test_blind_keeps_meaningful_events(self):
        items = vc.build_missing_items(SEGS, EVENTS, self.analysis, "blind")
        self.assertEqual(len(items), 2)
        item = items[0]
        self.assertIn("timestamp", item)
        self.assertIn("timestamp_start", item)
        self.assertIn("timestamp_end", item)
        self.assertIn("what_you_hear", item)
        self.assertIn("missing_information", item)
        self.assertIn("why_it_matters", item)
        self.assertIn("source_event", item)
        self.assertEqual(item["trust"]["trust"], evidence.TRUST_VERIFIED)

    def test_deaf_keeps_educational_visuals(self):
        items = vc.build_missing_items(SEGS, EVENTS, self.analysis, "deaf")
        kinds = {item["source_event"] for item in items}
        self.assertTrue(kinds)  # educational visuals still surfaced for captions users

    def test_unavailable_events_are_gated_out(self):
        combined = EVENTS + [UNREADABLE_EVENT]
        combined_analysis = vc.analyze_visual_events(combined, SEGS, {"duration": 9.0}, "fixture")
        items = vc.build_missing_items(SEGS, combined, combined_analysis, "blind")
        self.assertNotIn("event_003", [i["source_event"] for i in items])

    def test_sorted_by_timestamp(self):
        items = vc.build_missing_items(SEGS, EVENTS, self.analysis, "blind")
        times = [i["timestamp"] for i in items]
        self.assertEqual(times, sorted(times))


class TestEvidenceRecords(unittest.TestCase):

    def test_records_per_event(self):
        analysis = vc.analyze_visual_events(EVENTS, SEGS, {"duration": 9.0}, "fixture")
        records = vc.build_evidence_records(analysis)
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["source_type"], "visual")
        self.assertIn("trust", records[0])


if __name__ == "__main__":
    unittest.main()