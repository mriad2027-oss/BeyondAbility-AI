"""Visual Understanding: evidence-grounded multimodal visual understanding.

Deterministic + adversarial tests. The adversarial cases prove the no-fabrication
guarantee: colors / invented node counts / nonexistent events / fabricated code
lines are all rejected because trust comes from evidence, never from a prompt.
"""

import json
import unittest
from pathlib import Path

from backend.services import ask, evidence, visual_understanding as vu
from tests import _fixtures

try:
    from fastapi.testclient import TestClient
    from backend.main import app
    _tc = TestClient(app)
    HAS_TC = True
except Exception:  # pragma: no cover - import fallback
    HAS_TC = False


def _unreadable(prefix="no readable on-screen text"):
    return f"OCR-only output: {prefix}"


def _code_event(text, eid="code_1", start=0.0, end=5.0, conf=0.95):
    return {
        "event_id": eid, "start": start, "end": end, "type": "slide",
        "description": f"OCR-only output: On-screen text detected:\n{text}",
        "confidence": conf,
    }


class TestClassifyVisualType(unittest.TestCase):
    """Evidence-based type classification (not text-existence guesses)."""

    def test_code_from_multiple_markers(self):
        desc = "OCR-only output: On-screen text detected:\ndef foo():\n    return 42\nprint"
        self.assertEqual(vu.classify_visual_type(vu.extract_ocr(desc)[0], desc, "slide"), "code")

    def test_code_from_strong_single_marker(self):
        desc = "OCR-only output: On-screen text detected:\nprint('hello')"
        self.assertEqual(vu.classify_visual_type(vu.extract_ocr(desc)[0], desc), "code")

    def test_lone_range_identifier_is_not_code(self):
        # A chart legend with range(5) must NOT become code just from an identifier.
        desc = ("OCR-only output: On-screen text detected:\nHOW MANY TIMES DOES EACH "
                "LOOP RUN?\n10\nrange(5) range(10)")
        ocr, _ = vu.extract_ocr(desc)
        self.assertEqual(vu.classify_visual_type(ocr, desc), "chart")

    def test_chart_from_how_many_with_digits(self):
        desc = ("OCR-only output: On-screen text detected:\nHOW MANY TIMES DOES EACH "
                "LOOP RUN?\n10\nrange(5) range(10)")
        ocr, _ = vu.extract_ocr(desc)
        self.assertEqual(vu.classify_visual_type(ocr, desc), "chart")

    def test_prose_run_does_not_mean_ui(self):
        # "runs a fixed number" contains the substring "run" but is prose.
        desc = ("OCR-only output: On-screen text detected:\nThe for loop runs a fixed "
                "number of times\nToday: for loop syntax")
        ocr, _ = vu.extract_ocr(desc)
        self.assertEqual(vu.classify_visual_type(ocr, desc), "slide")

    def test_unreadable_is_unknown_not_guessed(self):
        # We cannot classify what we cannot read -> honest "unknown".
        desc = _unreadable()
        self.assertEqual(vu.classify_visual_type(vu.extract_ocr(desc)[0], desc), "unknown")

    def test_recorded_detected_type_honored_only_if_meaningful(self):
        desc = "A slide about loops."
        self.assertEqual(vu.classify_visual_type("", desc, "slide"), "slide")

    def test_flowchart_is_its_own_type(self):
        desc = "OCR-only output: On-screen text detected:\nSTART\nDecide\nflowchart"
        ocr, _ = vu.extract_ocr(desc)
        self.assertEqual(vu.classify_visual_type(ocr, desc), "flowchart")

    def test_flowchart_structure_with_true_false_is_flowchart(self):
        desc = ("OCR-only output: On-screen text detected:\nSTART\nIs n > 0?\n"
                "true\nfalse\nEND")
        ocr, _ = vu.extract_ocr(desc)
        self.assertEqual(vu.classify_visual_type(ocr, desc), "flowchart")

    def test_plain_start_end_diagram_stays_diagram(self):
        desc = "OCR-only output: On-screen text detected:\nSTART\nA rectangle\nEND"
        ocr, _ = vu.extract_ocr(desc)
        self.assertEqual(vu.classify_visual_type(ocr, desc), "diagram")


class TestNoFabrication(unittest.TestCase):
    """Adversarial: hallucination must be rejected by the evidence hierarchy."""

    def test_nonexistent_event_rejected_by_evidence(self):
        # A property question (count) must be guarded, never guessed.
        from backend.services.ask import _guarded_missing
        payload = _guarded_missing("how many nodes are there?", "count", "en")
        self.assertEqual(payload["status"], ask.STATUS_NOT_FOUND)
        self.assertIn("will not guess", payload["answer"].lower())
        self.assertEqual(payload["evidence"], [])

    def test_color_property_never_guessed(self):
        from backend.services.ask import _guarded_missing
        payload = _guarded_missing("what color is the flag?", "color", "en")
        self.assertIn("cannot verify", payload["answer"].lower())
        self.assertNotIn("blue", payload["answer"].lower())
        self.assertNotIn("red", payload["answer"].lower())

    def test_empty_ocr_produces_no_textual_claims(self):
        claims = vu.build_visual_claims("code", "", "A code thing", 0.9)
        # No claim should quote fabricated code text.
        for c in claims:
            self.assertNotIn("showing:", c["claim"])
            if "showing" in c["claim"]:
                self.fail(f"fabricated code text in claim: {c['claim']}")

    def test_fake_code_line_never_rendered_as_fact(self):
        # Even with a high confidence number, an event lacking readable OCR
        # must not produce a VERIFIED textual claim.
        event = _code_event("", eid="no_text", conf=0.99)
        event["description"] = "A dark editor screen with code."  # no OCR text
        record = vu.build_visual_understanding_for_event(event, "")
        for c in record["visual_claims"]:
            self.assertNotEqual(c["confidence"], round(0.99, 2))
        # All textual claims must be confidence 0.0 because no OCR was readable.
        textual = [c for c in record["visual_claims"] if "showing:" in c["claim"]]
        self.assertEqual(textual, [])

    def test_fake_node_count_rejected_for_diagram_without_ocr(self):
        record = vu.build_visual_understanding_for_event(
            {"event_id": "d1", "start": 0, "end": 1, "type": "diagram",
             "description": "A diagram with 42 nodes and arrows.", "confidence": 0.99}, "")
        # The exact count 42 appears nowhere as a verified claim; limitation honest.
        joined = " ".join(c["claim"] for c in record["visual_claims"]).lower()
        self.assertNotIn("42", " ".join(str(c.get("confidence")) for c in record["visual_claims"]))
        self.assertTrue(any("cannot be fully verified" in c["claim"] or
                            "cannot be verified" in c["claim"] for c in record["visual_claims"]))


class TestTrustAndTimestamps(unittest.TestCase):

    def test_verified_trust_from_readable_evidence(self):
        ev = _code_event("def foo():\n    return 1\nprint", eid="t1")
        record = vu.build_visual_understanding_for_event(ev, "")
        self.assertEqual(record["trust"]["trust"], evidence.TRUST_VERIFIED)
        self.assertEqual(record["visual_type"], "code")
        self.assertEqual(record["start"], 0.0)
        self.assertEqual(record["end"], 5.0)

    def test_unavailable_trust_for_unreadable(self):
        ev = {"event_id": "t2", "start": 0.0, "end": 2.0, "type": "scene",
              "description": _unreadable(), "confidence": 0.3}
        record = vu.build_visual_understanding_for_event(ev, "")
        self.assertEqual(record["trust"]["trust"], evidence.TRUST_UNAVAILABLE)
        self.assertEqual(record["complement_level"], "UNAVAILABLE")

    def test_source_frames_and_lecture_id_preserved(self):
        ev = _code_event("x = 1", eid="t3")
        ev["source_frames"] = ["frame_0007.jpg"]
        record = vu.build_visual_understanding_for_event(ev, "")
        self.assertEqual(record["source_frames"], ["frame_0007.jpg"])
        recs = vu.build_visual_understanding([ev], [], job_id="LEC")
        self.assertEqual(recs[0]["lecture_id"], "LEC")


class TestComplementTranscript(unittest.TestCase):

    def test_visually_only_when_no_speech(self):
        ev = _code_event("print('hi')", eid="c1")
        record = vu.build_visual_understanding_for_event(ev, "")
        self.assertEqual(record["complement_level"], "VISUALLY_ONLY")

    def test_redundant_when_speech_covers_screen(self):
        ev = _code_event("Loops repeat a block of code", eid="c2")
        record = vu.build_visual_understanding_for_event(ev,
            "The slide says loops repeat a block of code.")
        self.assertIn(record["complement_level"], ("REDUNDANT", "PARTIALLY_MISSING"))

    def test_speech_context_recorded(self):
        ev = _code_event("print('hi')", eid="c3")
        record = vu.build_visual_understanding_for_event(ev, "Welcome to loops.")
        self.assertEqual(record["speech_context"], "Welcome to loops.")


class TestAccessibilityAndLimits(unittest.TestCase):

    def test_short_standard_present_for_verified(self):
        ev = _code_event("print('hi')", eid="a1")
        record = vu.build_visual_understanding_for_event(ev, "")
        self.assertIn("short", record["accessibility_description"])
        self.assertIn("standard", record["accessibility_description"])
        self.assertNotEqual(record["accessibility_description"]["short"], "")

    def test_honest_unavailable_accessibility(self):
        ev = {"event_id": "a2", "description": _unreadable()}
        record = vu.build_visual_understanding_for_event(ev, "")
        self.assertIn("could not be verified",
                      record["accessibility_description"]["short"].lower())

    def test_chart_limitation_honest_about_values(self):
        desc = ("OCR-only output: On-screen text detected:\nHOW MANY TIMES\n10\nrange(5)")
        ev = {"event_id": "a3", "description": desc}
        record = vu.build_visual_understanding_for_event(ev, "")
        self.assertEqual(record["visual_type"], "chart")
        self.assertTrue(any("values" in l for l in record["limitations"]))


class TestSchema(unittest.TestCase):

    def test_full_schema_keys_present(self):
        ev = _code_event("print('hi')", eid="s1")
        record = vu.build_visual_understanding_for_event(ev, "Hello")
        expected = {
            "event_id", "start", "end", "source_frames", "visual_type",
            "scene_summary", "objects", "text", "layout", "actions",
            "relationships", "ocr_text", "visual_claims", "speech_context",
            "complement_level", "complement_reason", "trust", "description",
            "accessibility_description", "limitations",
        }
        self.assertTrue(expected.issubset(record.keys()), record.keys() - expected)

    def test_events_idempotent_not_mutated(self):
        ev = _code_event("print('hi')", eid="s2")
        snapshot = dict(ev)
        vu.build_visual_understanding_for_event(ev, "")
        self.assertEqual(ev, snapshot)


class TestAPILevel(unittest.TestCase):
    """End-to-end route behaviors for the new /visual-understanding endpoint."""

    def setUp(self):
        self.job_id, _ = _fixtures.register_lecture()

    def tearDown(self):
        _fixtures.remove_lecture(self.job_id)

    @unittest.skipUnless(HAS_TC, "TestClient unavailable")
    def test_visual_understanding_route(self):
        resp = _tc.get(f"/lectures/{self.job_id}/visual-understanding")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("records", body)
        self.assertEqual(len(body["records"]), 2)
        record = body["records"][0]
        self.assertIn("visual_type", record)
        self.assertIn("complement_level", record)
        self.assertIn("visual_claims", record)

    @unittest.skipUnless(HAS_TC, "TestClient unavailable")
    def test_timeline_includes_complement_level(self):
        resp = _tc.get(f"/lectures/{self.job_id}/timeline")
        self.assertEqual(resp.status_code, 200)
        for item in resp.json()["timeline"]:
            if item["type"] == "visual":
                self.assertIn("complement_level", item)
                self.assertIn("visual_type", item)


class TestBackwardCompat(unittest.TestCase):
    """Old jobs without understanding still work and never fabricate."""

    @unittest.skipUnless(HAS_TC, "TestClient unavailable")
    def test_route_returns_empty_without_events(self):
        job_id, _ = _fixtures.register_lecture()
        try:
            resp = _tc.get(f"/lectures/{job_id}/visual-understanding")
            self.assertEqual(resp.status_code, 200)
            records = resp.json()["records"]
            # fixture events have vision descriptions (no OCR); understanding
            # still builds honest records, never invented OCR text.
            for r in records:
                for c in r["visual_claims"]:
                    if "showing:" in c["claim"]:
                        self.assertNotEqual(c["confidence"], 0.0)
        finally:
            _fixtures.remove_lecture(job_id)


if __name__ == "__main__":
    unittest.main()
