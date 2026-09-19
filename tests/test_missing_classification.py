""""What am I missing?" -- competition-grade classification (Feature P2).

Twelve scenario checks covering the audio-vs-visual status model, importance
ranking, deduplication of long-duration on-screen content, endpoint summary
honesty, profile adaptation, and the no-fabrication rule.
"""

import json
import unittest
from copy import deepcopy
from fastapi.testclient import TestClient

from backend.main import app
from backend import config, storage
from backend.services import evidence, visual_companion as vc
from tests import _fixtures

client = TestClient(app)

SEGS = _fixtures._SAMPLE_SEGMENTS
EVENTS = _fixtures._SAMPLE_EVENTS

UNREADABLE_EVENT = {
    "event_id": "event_unreadable",
    "start": 12.0,
    "end": 16.0,
    "type": "code",
    "description": "OCR-only output: no readable on-screen text",
    "confidence": 0.4,
}

REDUNDANT_EVENT = {
    "event_id": "event_redundant",
    "start": 4.5,
    "end": 9.0,
    "type": "code",
    "description": "Loops repeat a block of code.",
    "confidence": 0.9,
}

SILENT_FORMULA = {
    "event_id": "event_silent",
    "start": 100.0,
    "end": 104.0,
    "type": "formula",
    "description": "The formula reads: E = m c squared.",
    "confidence": 0.9,
}


def _analyze(events, segments=None):
    return vc.analyze_visual_events(events, segments or SEGS, {"duration": 9.0}, "fixture")


class TestStatusClassification(unittest.TestCase):
    """Scenarios 1-4: the four statuses and the no-fabrication gate."""

    def test_redundant_when_speech_covers_visual(self):
        status = vc.classify_status(REDUNDANT_EVENT, overlap_transcript="Loops repeat a block of code.")
        self.assertEqual(status, vc.STATUS_REDUNDANT)
        # Redundant events are never surfaced as actionable claims.
        items = vc.build_missing_items(SEGS, [REDUNDANT_EVENT], _analyze([REDUNDANT_EVENT]), "default", "L1")
        self.assertEqual(items, [])

    def test_partially_missing_for_educational_visual(self):
        for event in EVENTS:
            self.assertEqual(vc.classify_status(event, overlap_transcript=event["transcript_context"]),
                             vc.STATUS_PARTIALLY_MISSING)
        items = vc.build_missing_items(SEGS, EVENTS, _analyze(EVENTS), "default", "L1")
        self.assertEqual(len(items), 2)
        self.assertEqual({i["status"] for i in items}, {vc.STATUS_PARTIALLY_MISSING})

    def test_missing_when_silent_but_visual_present(self):
        status = vc.classify_status(SILENT_FORMULA, overlap_transcript="")
        self.assertEqual(status, vc.STATUS_MISSING)
        items = vc.build_missing_items(SEGS, [SILENT_FORMULA], _analyze([SILENT_FORMULA]), "default", "L1")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["status"], vc.STATUS_MISSING)
        self.assertEqual(items[0]["what_you_hear"], "(silence in this segment)")
        self.assertEqual(items[0]["importance_rank"], "HIGH")

    def test_unavailable_is_gated_out(self):
        self.assertEqual(vc.classify_status(UNREADABLE_EVENT),
                         vc.STATUS_UNAVAILABLE)
        combined = EVENTS + [UNREADABLE_EVENT]
        items = vc.build_missing_items(SEGS, combined, _analyze(combined), "default", "L1")
        self.assertNotIn("event_unreadable", [i["source_event"] for i in items])
        for item in items:
            self.assertNotEqual(item["status"], vc.STATUS_UNAVAILABLE)


class TestProfileAdaptationAndShape(unittest.TestCase):
    """Scenarios 5-7: blind/deaf/cognitive profile behavior + additive schema."""

    def test_blind_keeps_meaningful_events_with_extended_schema(self):
        items = vc.build_missing_items(SEGS, EVENTS, _analyze(EVENTS), "blind", "L1")
        self.assertEqual(len(items), 2)
        item = items[0]
        for key in ("timestamp", "timestamp_start", "timestamp_end", "ts", "what_you_hear",
                    "missing_information", "what_you_might_miss", "why_it_matters", "source_event",
                    "event_id", "event_ids", "source_type", "category", "confidence",
                    "confidence_level", "trust", "visual_complement_score", "importance",
                    "importance_rank", "status", "coverage_ratio", "top_words", "evidence",
                    "evidence_kinds", "id", "lecture_id", "project", "module"):
            self.assertIn(key, item)
        self.assertTrue(item["what_you_might_miss"])
        self.assertTrue(item["why_it_matters"])
        self.assertEqual(item["lecture_id"], "L1")
        self.assertTrue(".missing." in item["id"])
        self.assertTrue(item["ts"].count(":") == 2 and item["ts"].count(".") == 1)
        self.assertRegex(item["ts"], r"^\d{2}:\d{2}:\d{2}\.\d{3}$")
        self.assertEqual(item["trust"]["trust"], evidence.TRUST_VERIFIED)

    def test_deaf_keeps_educational_visuals(self):
        items = vc.build_missing_items(SEGS, EVENTS, _analyze(EVENTS), "deaf", "L1")
        self.assertTrue(items)
        self.assertTrue({i["category"] for i in items})

    def test_cognitive_keeps_highest_value_concepts(self):
        code_ev = {"event_id": "ev_code", "start": 0.0, "end": 4.0, "type": "code",
                   "description": "A code editor shows x = 1.", "confidence": 0.9}
        slide_ev = {"event_id": "ev_slide", "start": 4.5, "end": 9.0, "type": "slide",
                    "description": "A slide shows the agenda.", "confidence": 0.8}
        analysis = [
            {"event_id": "ev_code", "overlapping_transcript": "", "importance": 0.9,
             "visual_complement_score": {"score": "high", "reason": "code content not spoken"}},
            {"event_id": "ev_slide", "overlapping_transcript": "", "importance": 0.3,
             "visual_complement_score": {"score": "medium", "reason": "slide detail"}},
        ]
        cognitive = vc.build_missing_items(SEGS, [code_ev, slide_ev], analysis, "cognitive_support", "L1")
        self.assertEqual([i["source_event"] for i in cognitive], ["ev_code"])
        blind = vc.build_missing_items(SEGS, [code_ev, slide_ev], analysis, "blind", "L1")
        self.assertEqual({i["source_event"] for i in blind}, {"ev_code", "ev_slide"})


class TestDedupAndRanking(unittest.TestCase):
    """Scenarios 8-10: deduplication, importance ranking, determinism."""

    def test_dedup_same_kind_same_region_is_one_moment(self):
        events = [
            {"event_id": "code_a", "start": 20.0, "end": 24.0, "type": "code",
             "description": "Loops repeat a block of code.", "confidence": 0.9},
            {"event_id": "code_b", "start": 25.0, "end": 29.0, "type": "code",
             "description": "Loops repeat a block of code.", "confidence": 0.8},
            {"event_id": "dia_c", "start": 22.0, "end": 26.0, "type": "diagram",
             "description": "A stack diagram shows three elements.", "confidence": 0.9},
        ]
        items = vc.build_missing_items(SEGS, events, _analyze(events), "default", "L1")
        self.assertEqual(len(items), 2)  # code merged, diagram separate
        merged = next(i for i in items if i["category"] == "code")
        self.assertEqual(sorted(merged["event_ids"]), ["code_a", "code_b"])
        self.assertEqual(merged["timestamp_start"], 20.0)
        self.assertEqual(merged["timestamp_end"], 29.0)
        self.assertTrue(merged["source_event"] in {"code_a", "code_b"})

    def test_importance_rank(self):
        cases = [
            ({"type": "code", "description": "A code editor shows x = 1.", "confidence": 0.9}, "HIGH"),
            ({"type": "diagram", "description": "A stack diagram shows three elements.", "confidence": 0.6}, "HIGH"),
            ({"type": "other", "description": "A blurry object appears.", "confidence": 0.95}, "LOW"),
            ({"type": "code", "description": "A code editor shows x = 2.", "confidence": 0.4}, "MEDIUM"),
        ]
        for event, expected in cases:
            with self.subTest(event=event["type"], expected=expected):
                self.assertEqual(vc.importance_rank_for(event), expected)

    def test_classification_is_deterministic(self):
        first = vc.classify_missing_info(EVENTS, SEGS, _analyze(EVENTS))
        second = vc.classify_missing_info(EVENTS, SEGS, _analyze(EVENTS))
        self.assertEqual(first, second)
        self.assertEqual([s["status"] for s in first], [vc.STATUS_PARTIALLY_MISSING] * 2)
        all_valid = {vc.STATUS_UNAVAILABLE, vc.STATUS_REDUNDANT,
                     vc.STATUS_PARTIALLY_MISSING, vc.STATUS_MISSING}
        self.assertTrue({s["status"] for s in first} <= all_valid)


class TestEndpointContract(unittest.TestCase):
    """Scenarios 11-12: /missing summary honesty for verifiable and empty lectures."""

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()

    def tearDown(self):
        _fixtures.remove_lecture(self._job_id)

    def test_endpoint_summary_reports_statuses(self):
        r = client.get(f"/lectures/{self._job_id}/missing")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        summary = body["summary"]
        self.assertIn("status_counts", summary)
        self.assertGreaterEqual(summary["status_counts"].get(vc.STATUS_PARTIALLY_MISSING, 0), 2)
        self.assertGreater(summary["actionable_count"], 0)
        self.assertIn("overall_coverage_ratio", summary)
        self.assertIn("overall_evidence_trust", summary)
        for item in body["items"]:
            self.assertIn(item["status"], (vc.STATUS_PARTIALLY_MISSING, vc.STATUS_MISSING))
            self.assertIn("id", item)
            self.assertEqual(item["lecture_id"], self._job_id)

    def test_honest_empty_state_when_nothing_verifiable(self):
        job = storage.get_job(self._job_id)
        result = deepcopy(job["result"])
        result["visual_events"] = [UNREADABLE_EVENT, REDUNDANT_EVENT]
        job["result"] = result
        storage._job_path(self._job_id).write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")

        r = client.get(f"/lectures/{self._job_id}/missing")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["items"], [])
        counts = body["summary"]["status_counts"]
        self.assertGreaterEqual(counts.get(vc.STATUS_UNAVAILABLE, 0), 1)
        self.assertGreaterEqual(counts.get(vc.STATUS_REDUNDANT, 0), 1)
        self.assertIn("could not be verified", body["summary"]["text"])
        self.assertEqual(body["summary"]["actionable_count"], 0)


if __name__ == "__main__":
    unittest.main()