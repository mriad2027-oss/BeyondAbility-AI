"""P3 'Ask the Video' -- evidence-grounded Q&A scenarios.

Covers: transcript grounding, visual grounding, Arabic + mixed-language,
partial OCR honesty, property questions (never guess), speech-vs-screen
conflicts, temporal windowing, comparison answers, observability stages,
and adversarial no-fabrication guards (hallucinated citations, node counts,
variable names, button colors).
"""

import json
import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import config, storage
from backend.main import app
from tests import _fixtures

client = TestClient(app)

_ALLOWED_STATUS = {"SUPPORTED", "PARTIALLY_SUPPORTED", "UNCERTAIN", "NOT_FOUND", "UNAVAILABLE"}
_ALLOWED_TRUST = {"VERIFIED", "UNCERTAIN", "UNAVAILABLE"}


def _write_job(job_id: str, segments: list[dict], events: list[dict]) -> str:
    """Write a completed synthetic lecture job with custom content."""
    video_path = str(config.VIDEOS_DIR / f"grounded_video_{uuid.uuid4().hex[:6]}.mp4")
    result = {
        "transcript_text": " " + " ".join(s["text"] for s in segments),
        "segments": segments,
        "visual_events": events,
        "captions": [{"id": s["id"], "start": s["start"], "end": s["end"], "text": s["text"]}
                     for s in segments],
        "video_metadata": {"duration": max((e.get("end", 0) for e in events), default=0)},
        "stage_status": {
            "extract_audio": {"status": "completed"}, "transcribe": {"status": "completed"},
            "analyze_video": {"status": "completed"}, "accessibility": {"status": "completed"},
            "quiz": {"status": "completed"},
        },
    }
    job = {
        "job_id": job_id,
        "video_path": video_path,
        "filename": "grounded_sample.mp4",
        "status": "done",
        "progress": 100,
        "current_stage": "completed",
        "error": None,
        "logs": [],
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    path = storage._job_path(job_id)
    path.write_text(json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8")
    return job_id


_ARABIC_SEGMENTS = [
    {"id": "seg_a1", "start": 10.0, "end": 14.0, "text": "هذا هو مثال الكود على الشاشة."},
    {"id": "seg_a2", "start": 60.0, "end": 64.0, "text": "هنا نرى مثال الدوال."},
    {"id": "seg_a3", "start": 84.4, "end": 89.4, "text": "في هذا الدرس نتعلم المرمغة وأساسياتها."},
]

_ARABIC_EVENTS = [
    {
        "event_id": "event_a1",
        "start": 10.0,
        "end": 14.0,
        "type": "كود",
        "description": "OCR-only output: On-screen text detected: i = 0\n i = i + 1 …",
        "transcript_context": "هذا هو مثال الكود على الشاشة.",
        "confidence": 0.9,
        "source_frames": [],
    },
]

_CONFLICT_SEGMENTS = [
    {"id": "seg_b1", "start": 30.0, "end": 34.0, "text": "We use range(10) for the loop here."},
    {"id": "seg_b2", "start": 40.0, "end": 44.0, "text": "This code prints a counter."},
]

_CONFLICT_EVENTS = [
    {
        "event_id": "event_b1",
        "start": 30.0,
        "end": 34.0,
        "type": "code",
        "description": "OCR-only output: On-screen text detected: range(5)",
        "transcript_context": "We use range(10) for the loop here.",
        "confidence": 0.95,
        "source_frames": [],
    },
    {
        "event_id": "event_b2",
        "start": 40.0,
        "end": 44.0,
        "type": "code",
        "description": "OCR-only output: On-screen text detected: for i in range(10):\n print(i) …",
        "transcript_context": "This code prints a counter.",
        "confidence": 0.95,
        "source_frames": [],
    },
]


def _ask(job_id: str, question: str) -> dict:
    r = client.post("/ask", json={"job_id": job_id, "question": question})
    assert r.status_code == 200, r.text
    return r.json()


class TestP3GroundedQA(unittest.TestCase):
    """Scenario coverage for the evidence-grounded Ask-the-Video engine."""

    def setUp(self):
        self._job_id, _ = _fixtures.register_lecture()
        self._a_job = _write_job(f"ar_{uuid.uuid4().hex[:8]}", _ARABIC_SEGMENTS, _ARABIC_EVENTS)
        self._c_job = _write_job(f"cf_{uuid.uuid4().hex[:8]}", _CONFLICT_SEGMENTS, _CONFLICT_EVENTS)

    def tearDown(self):
        for jid in (self._job_id, self._a_job, self._c_job):
            _fixtures.remove_lecture(jid)
            path = storage._job_path(jid)
            if path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass

    # -- 1) Transcript grounding + status/trust/timestamps/jump ------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_transcript_grounded_supported(self, _mock):
        body = _ask(self._job_id, "What are loops?")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertEqual(body["trust"], "VERIFIED")
        self.assertIn("Loops repeat a block of code.", body["answer"])
        self.assertIn(4.5, body["timestamps"])
        self.assertGreaterEqual(body["evidence_records"], 1)
        self.assertEqual(body["evidence"][0]["source_type"], "transcript")
        self.assertEqual(body["evidence"][0]["timestamp"], 4.5)
        self.assertIsNotNone(body.get("jump"))
        self.assertEqual(body["jump"]["timestamp"], 4.5)
        self.assertTrue(body.get("why"))

    # -- 2) Visual (diagram) grounding -------------------------------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_visual_diagram_grounded(self, _mock):
        body = _ask(self._job_id, "What does the stack diagram show?")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertIn("stack diagram", body["answer"])
        self.assertIn("event_002", body["source_refs"]["visual_events"])
        self.assertTrue(any(r["source_type"] == "visual" for r in body["evidence"]))
        self.assertIn(4.5, body["timestamps"])

    # -- 3) Comparison: two verified visual examples ------------------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_comparison_two_visual_examples(self, _mock):
        body = _ask(self._job_id, "Compare the stack diagram with the code editor.")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertIn("Two documented examples appeared", body["answer"])
        self.assertEqual(len(body["source_refs"]["visual_events"]), 2)
        self.assertLessEqual({0.0, 4.5} - set(body["timestamps"]), set())
        self.assertEqual(body["category"], "comparison")

    # -- 4) Timestamps propagate into evidence + jump + 'why' --------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_timestamps_propagate_into_evidence_and_why(self, _mock):
        body = _ask(self._job_id, "When does loops appear?")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertIn(4.5, body["timestamps"])
        self.assertEqual(body["jump"]["timestamp"], 4.5)
        self.assertTrue(any("Timestamps verified" in w for w in body["why"]))

    # -- 5) Honest NOT_FOUND for a question with no evidence ----------------
    def test_no_evidence_is_honest_not_found(self):
        body = _ask(self._job_id, "How is a quasar formed?")
        self.assertEqual(body["status"], "NOT_FOUND")
        self.assertIn("couldn't find enough information", body["answer"])
        self.assertEqual(body["timestamps"], [])
        self.assertEqual(body["evidence_records"], 0)
        self.assertIn(body["trust"], ("UNAVAILABLE", "UNCERTAIN"))

    # -- 6) English visual UNAVAILABLE (no verifiable visual evidence) ------
    def test_english_visual_unavailable(self):
        body = _ask(self._job_id, "What is shown on the display at 99 seconds?")
        self.assertEqual(body["status"], "UNAVAILABLE")
        self.assertIn("visual content needed", body["answer"])
        self.assertEqual(body["evidence_records"], 0)
        self.assertEqual(body["trust"], "UNAVAILABLE")

    # -- 7) Accessibility-framed question with no content -> NOT_FOUND ------
    def test_accessibility_question_honest(self):
        body = _ask(self._job_id, "Is there audio description for this lecture?")
        self.assertIn(body["status"], ("NOT_FOUND", "UNAVAILABLE"))
        self.assertEqual(body["evidence_records"], 0)

    # -- 8) Arabic: المرمغة grounded at its exact 84.4s moment ------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_arabic_egyptian_grounds_to_84_4(self, _mock):
        body = _ask(self._a_job, "ما هي المرمغة؟")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertIn("المرمغة", body["answer"])
        self.assertIn(84.4, body["timestamps"])
        self.assertIn("seg_a3", body["source_refs"]["transcript_segments"])

    # -- 9) Arabic: visual code question, partial OCR honesty ---------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_arabic_code_partial_ocr_honest(self, _mock):
        body = _ask(self._a_job, "ما الكود الذي ظهر على الشاشة؟")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertIn("جزء من الكود", body["answer"])
        self.assertIn(10.0, body["timestamps"])
        self.assertEqual(body["category"], "code")
        self.assertIn("event_a1", body["source_refs"]["visual_events"])
        visual_rec = next(r for r in body["evidence"] if r.get("source_type") == "visual")
        self.assertIn("i =", visual_rec.get("snippet", ""))

    # -- 10) Mixed-language question answered from Arabic evidence ----------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_mixed_english_arabic_question(self, _mock):
        body = _ask(self._a_job, "What is المرمغة?")
        self.assertIn("المرمغة", body["answer"])
        self.assertIn(84.4, body["timestamps"])
        self.assertEqual(body["status"], "SUPPORTED")

    # -- 11) Arabic: stop-word-only question never crashes/guesses ----------
    def test_arabic_stopwords_only_is_honest(self):
        body = _ask(self._a_job, "لماذا هذا التي؟")
        self.assertEqual(body["status"], "NOT_FOUND")
        self.assertIn("لم أجد دليلاً", body["answer"])
        self.assertEqual(body["evidence_records"], 0)

    # -- 12) Arabic: temporal windowing 'في الدقيقة 1' -> 60.0s -------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_arabic_temporal_window(self, _mock):
        body = _ask(self._a_job, "ماذا شرح المدرس في الدقيقة 1؟")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertIn(60.0, body["timestamps"])
        self.assertIn("الدوال", body["answer"])

    # -- 13) Arabic temporal out-of-range -> honest no-content answer --------
    def test_arabic_temporal_no_content(self):
        body = _ask(self._a_job, "متى ظهر المحتوى عند الدقيقة 15؟")
        self.assertEqual(body["status"], "NOT_FOUND")
        self.assertIn("لم أجد محتوى موثقاً", body["answer"])
        self.assertEqual(body["timestamps"], [])

    # -- 14) Conflict: speech range(10) vs screen range(5) shown ------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_conflict_shown_not_hidden(self, _mock):
        body = _ask(self._c_job, "What range() do we use in the loop?")
        self.assertEqual(body["status"], "UNCERTAIN")
        self.assertIn("range(10)", body["answer"])
        self.assertIn("range(5)", body["answer"])
        self.assertTrue(body["conflict"]["flag"])
        self.assertIn("transcript", body["conflict"]["sources"])
        self.assertIn("visual", body["conflict"]["sources"])
        self.assertGreaterEqual(body["evidence_records"], 2)

    # -- 15) English partial OCR honesty (readable, not full) ---------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_partial_ocr_honesty(self, _mock):
        body = _ask(self._c_job, "What code with print appeared on screen?")
        self.assertEqual(body["status"], "SUPPORTED")
        self.assertIn("Part of the code appeared on screen", body["answer"])
        self.assertIn(40.0, body["timestamps"])

    # -- 16) Property: node count never guessed from description ------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_node_count_not_guessed(self, _mock):
        body = _ask(self._job_id, "How many nodes are in the stack diagram?")
        self.assertEqual(body["status"], "NOT_FOUND")
        self.assertIn("not available", body["answer"])
        self.assertNotIn("three", body["answer"])
        self.assertFalse(any(c.isdigit() for c in body["answer"]))
        self.assertGreaterEqual(body["evidence_records"], 1)
        self.assertEqual(body["trust"], "VERIFIED")

    # -- 17) Property: variable name kept honest (no invented value) --------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_variable_name_not_guessed(self, _mock):
        body = _ask(self._job_id, "What is the variable name?")
        self.assertEqual(body["status"], "NOT_FOUND")
        self.assertIn("(name)", body["answer"])
        self.assertNotIn("Omnya", body["answer"])
        self.assertIn(0.0, body["timestamps"])
        self.assertIn("seg_001", body["source_refs"]["transcript_segments"])

    # -- 18) Property: button color never invented --------------------------
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: None)
    def test_button_color_not_guessed(self, _mock):
        body = _ask(self._job_id, "What color is the button?")
        self.assertEqual(body["status"], "NOT_FOUND")
        self.assertIn("cannot verify the requested color", body["answer"])
        for color_word in ("blue", "red", "green", "black", "orange"):
            self.assertNotIn(color_word, body["answer"].lower())
        self.assertEqual(body["trust"], "UNAVAILABLE")

    # -- 19) Hallucinated LLM citations are dropped (deterministic fallback) --
    @patch("backend.services.llm.call_llm", side_effect=lambda *_a, **_k: json.dumps({
        "answer": "The secret value is 42.",
        "timestamps": [1],
        "source_refs": {"transcript_segments": ["seg_999"], "visual_events": ["event_999"]},
    }))
    def test_llm_cannot_inject_hallucinated_citations(self, _mock):
        body = _ask(self._job_id, "What are loops?")
        self.assertNotIn("42", body["answer"])
        self.assertEqual(body["source_refs"], {"transcript_segments": ["seg_002"],
                                               "visual_events": []})
        self.assertTrue(body["why"])

    # -- 20) Observability: ask_retrieval + ask_grounding recorded ----------
    def test_observability_records_ask_stages(self):
        _ask(self._a_job, "ما هي المرمغة؟")
        job = storage.get_job(self._a_job)
        messages = [str(entry.get("message", "")) for entry in job.get("logs", [])]
        self.assertTrue(any("retrieved=" in m for m in messages))
        self.assertTrue(any("trust=VERIFIED" in m and "status=SUPPORTED" in m for m in messages))

    # -- 21) Response schema sanity: status + trust live in allowed vocab ----
    def test_schema_vocabulary_holds(self):
        for question in ("What are loops?",
                         "ما هي المرمغة؟",
                         "What color is the button?",
                         "How is a quasar formed?"):
            jid = self._a_job if "المرمغة" in question else self._job_id
            body = _ask(jid, question)
            self.assertIn(body.get("status"), _ALLOWED_STATUS)
            self.assertIn(body.get("trust"), _ALLOWED_TRUST)
            self.assertIn("answer", body)
            self.assertIn("source_refs", body)
            self.assertIn("evidence", body)


if __name__ == "__main__":
    unittest.main()