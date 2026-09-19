"""Evidence / trust / no-fabrication layer (Feature #4 + #7)."""

import unittest

from backend.services import evidence

OCR_EVENT = {
    "event_id": "event_001",
    "start": 0.0,
    "end": 4.0,
    "type": "code",
    "description": "OCR-only output: On-screen text detected:\nfor i in range(5):\n    print(i)",
    "confidence": 0.95,
}


class TestTrustForEvent(unittest.TestCase):

    def test_verified_when_grounded_and_confident(self):
        out = evidence.trust_for_event(OCR_EVENT)
        self.assertEqual(out["trust"], evidence.TRUST_VERIFIED)
        self.assertEqual(out["confidence"], 0.95)

    def test_unavailable_when_description_missing(self):
        out = evidence.trust_for_event({})
        self.assertEqual(out["trust"], evidence.TRUST_UNAVAILABLE)

    def test_unavailable_when_no_readable_text(self):
        ev = dict(OCR_EVENT, description="OCR-only output: no readable on-screen text")
        self.assertEqual(evidence.trust_for_event(ev)["trust"], evidence.TRUST_UNAVAILABLE)

    def test_unavailable_when_visual_analysis_unavailable_marker(self):
        ev = dict(OCR_EVENT, description="Visual analysis unavailable for this lecture.")
        self.assertEqual(evidence.trust_for_event(ev)["trust"], evidence.TRUST_UNAVAILABLE)

    def test_uncertain_when_low_confidence(self):
        ev = dict(OCR_EVENT, confidence=0.4)
        self.assertEqual(evidence.trust_for_event(ev)["trust"], evidence.TRUST_UNCERTAIN)

    def test_uncertain_when_hedged(self):
        ev = dict(OCR_EVENT, description="The screen appears to show a code editor.")
        self.assertEqual(evidence.trust_for_event(ev)["trust"], evidence.TRUST_UNCERTAIN)


class TestExtractOcrText(unittest.TestCase):

    def test_parses_ocr_only_text(self):
        text, readable = evidence.extract_ocr_text(OCR_EVENT["description"])
        self.assertTrue(readable)
        self.assertIn("for i in range(5)", text)

    def test_empty_when_unreadable(self):
        text, readable = evidence.extract_ocr_text("OCR-only output: no readable on-screen text")
        self.assertEqual(text, "")
        self.assertFalse(readable)

    def test_vision_description_counts_as_readable(self):
        text, readable = evidence.extract_ocr_text("A lecturer is drawing on a whiteboard.")
        self.assertEqual(text, "")
        self.assertTrue(readable)


class TestVerifyClaim(unittest.TestCase):

    def test_worst_trust_governs(self):
        records = [
            {"trust": evidence.TRUST_VERIFIED, "source_type": "transcript"},
            {"trust": evidence.TRUST_UNCERTAIN, "source_type": "visual"},
        ]
        out = evidence.verify_claim(records)
        self.assertEqual(out["trust"], evidence.TRUST_UNCERTAIN)
        self.assertEqual(out["records"], 2)

    def test_all_verified_is_verified(self):
        records = [{"trust": evidence.TRUST_VERIFIED} for _ in range(3)]
        self.assertEqual(evidence.verify_claim(records)["trust"], evidence.TRUST_VERIFIED)

    def test_unavailable_when_any_unavailable(self):
        records = [
            {"trust": evidence.TRUST_VERIFIED},
            {"trust": evidence.TRUST_UNAVAILABLE},
        ]
        self.assertEqual(evidence.verify_claim(records)["trust"], evidence.TRUST_UNAVAILABLE)

    def test_empty_evidence_unavailable(self):
        out = evidence.verify_claim([])
        self.assertEqual(out["trust"], evidence.TRUST_UNAVAILABLE)
        self.assertEqual(out["records"], 0)


class TestBuildEvidence(unittest.TestCase):

    def test_record_shape(self):
        rec = evidence.build_evidence(source_type="visual", event_id="event_01", timestamp=12.3)
        self.assertEqual(rec["source_type"], "visual")
        self.assertEqual(rec["event_id"], "event_01")
        self.assertEqual(rec["timestamp"], 12.3)
        self.assertIn("trust", rec)


if __name__ == "__main__":
    unittest.main()