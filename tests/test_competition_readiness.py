"""P4 'Competition Readiness' -- transparency, explainability and safety.

Covers: accessibility score + explainable components (#1), lecture report with
honest statements (#2), profile-specific presentation (#3), record-grounded
trust explanation (#4), visual moment replay (#5), smart learning progress
(mechanism + endpoint) (#6), pipeline transparency (#10), real demo metrics
(#11), and crash safety (#12). Every assertion targets *real stored evidence*,
never fabricated numbers.
"""

import json
import unittest
import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from backend import config, storage
from backend.main import app
from backend.services import evidence
from tests import _fixtures

client = TestClient(app)

_ALLOWED_TRUST = {"VERIFIED", "UNCERTAIN", "UNAVAILABLE"}


def _new_student() -> str:
    return f"p4_{uuid.uuid4().hex[:8]}"


def _add_visual_analysis(job: dict, readable: dict | None = None) -> dict:
    """Attach a visual_analysis ledger so analysis is grounded (not recomputed)."""
    result = job.setdefault("result", {})
    seen = 0
    result["visual_analysis"] = []
    for ev in result.get("visual_events", []):
        if readable is not None:
            result["visual_analysis"].append({
                "event_id": ev["event_id"],
                "readable": readable.get("readable", True),
                "trust": dict(readable),
                "ocr_text": "x = 5" if readable.get("readable") else "",
                "description": "Readable slide content.",
                "overlapping_transcript": "Loops repeat a block of code.",
                "source_frames": ["frame_0001.jpg"],
            })
            seen += 1
    return job


class AccessibilityScoreTests(unittest.TestCase):
    def setUp(self):
        self.job_id, self.job = _fixtures.register_lecture()
        self.files = [self.job_id]

    def tearDown(self):
        for job_id in self.files:
            _fixtures.remove_lecture(job_id)

    def test_score_endpoint_bounds_and_shape(self):
        data = client.get(f"/lectures/{self.job_id}/accessibility-score").json()
        self.assertIn(data["level"], {"HIGH", "MEDIUM", "LOW"})
        self.assertIsInstance(data["score"], int)
        self.assertTrue(0 <= data["score"] <= 100, data["score"])
        self.assertTrue(data["components"], "no components")
        for name, comp in data["components"].items():
            self.assertIn("contribution", comp, name)
            self.assertIn("evidence_value", comp, name)
            self.assertIn("cap", comp, name)
            if comp.get("effect") == "penalty":
                pass
            else:
                self.assertGreaterEqual(comp["contribution"], 0.0)
        self.assertTrue(data["explanation"], "score must be explainable")
        self.assertIn(str(data["trust"]["trust"]), _ALLOWED_TRUST)
        self.assertIn("evidence", data["basis"].lower())

    def test_score_match_components_sum(self):
        data = client.get(f"/lectures/{self.job_id}/accessibility-score").json()
        total_contrib = round(sum(c["contribution"] for c in data["components"].values()), 2)
        self.assertLessEqual(abs(total_contrib - data["score"] / 100.0), 0.02)


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.job_id, _ = _fixtures.register_lecture()
        self.files = [self.job_id]

    def tearDown(self):
        for job_id in self.files:
            _fixtures.remove_lecture(job_id)

    def test_report_structure_and_honesty(self):
        data = client.get(f"/lectures/{self.job_id}/report").json()
        for section in ("speech", "visual_understanding", "missing_information",
                        "evidence", "audio_description", "accessibility_score"):
            self.assertIn(section, data)
        self.assertEqual(data["speech"]["transcript_segments"], 2)
        self.assertEqual(data["visual_understanding"]["total"], 2)
        self.assertEqual(data["visual_understanding"]["analyzed"], 2)
        self.assertTrue(data["honest_statement"])
        self.assertEqual(data["evidence"]["verified"] + data["evidence"]["uncertain"]
                         + data["evidence"]["unavailable"],
                         data["visual_understanding"]["total"])
        self.assertEqual(data["missing_information"]["redundant"]
                         + data["missing_information"]["missing"]
                         + data["missing_information"]["unavailable"],
                         data["missing_information"]["total"])

    def test_report_honest_statement_for_unverified_content(self):
        """Lectures with unreadable on-screen events must say so explicitly."""
        job_id, _ = _fixtures.register_lecture()
        self.files.append(job_id)
        job = storage.get_job(job_id)
        _add_visual_analysis(job, readable={"trust": "UNAVAILABLE", "readable": False})
        storage._job_path(job_id).write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")
        data = client.get(f"/lectures/{job_id}/report").json()
        self.assertIn("could not be verified", data["honest_statement"])
        self.assertEqual(data["visual_understanding"]["unavailable"], 2)

    def test_report_grounded_statement_when_fully_verified(self):
        job_id, _ = _fixtures.register_lecture()
        self.files.append(job_id)
        job = storage.get_job(job_id)
        _add_visual_analysis(job, readable={"trust": "VERIFIED", "readable": True})
        storage._job_path(job_id).write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")
        data = client.get(f"/lectures/{job_id}/report").json()
        self.assertIn("grounded", data["honest_statement"].lower())
        self.assertEqual(data["visual_understanding"]["unavailable"], 0)


class PresentationTests(unittest.TestCase):
    def setUp(self):
        self.job_id, _ = _fixtures.register_lecture()
        self.files = [self.job_id]

    def tearDown(self):
        for job_id in self.files:
            _fixtures.remove_lecture(job_id)

    def test_all_supported_modes(self):
        for mode in ("blind", "low_vision", "deaf", "hard_of_hearing",
                     "cognitive_support", "default"):
            r = client.get(f"/lectures/{self.job_id}/presentation", params={"mode": mode})
            self.assertEqual(r.status_code, 200, mode)
            d = r.json()
            self.assertEqual(d["mode"], mode)
            self.assertTrue(d["priorities"])
            self.assertTrue(d["emphasize_tabs"])

    def test_unknown_mode_normalizes_to_default(self):
        d = client.get(f"/lectures/{self.job_id}/presentation", params={"mode": "weird"}).json()
        self.assertEqual(d["mode"], "default")


class TrustExplanationTests(unittest.TestCase):
    def test_unit_explain_trust(self):
        verified = [
            {"source_type": "transcript", "segment_id": "seg_001", "timestamp": 1.0,
             "trust": "VERIFIED"},
            {"source_type": "ocr", "event_id": "event_001", "timestamp": 1.5,
             "trust": "VERIFIED"},
        ]
        lines = evidence.explain_trust(verified, conflict=None, status="SUPPORTED")
        self.assertTrue(any("speech transcript" in l for l in lines))
        self.assertTrue(any("visual evidence" in l for l in lines))
        self.assertTrue(any("sources agree" in l for l in lines))
        self.assertTrue(any(l.startswith("✓") for l in lines))

    def test_unit_explain_trust_unavailable(self):
        lines = evidence.explain_trust(
            [{"source_type": "visual", "event_id": "event_001", "timestamp": 2.0,
              "trust": "UNAVAILABLE"}],
            conflict=None, status="UNCERTAIN",
        )
        self.assertTrue(any("could not be verified" in l for l in lines))
        self.assertTrue(any(l.startswith("⚠") for l in lines))

    def test_unit_explain_trust_conflict(self):
        lines = evidence.explain_trust(
            [{"source_type": "transcript", "segment_id": "seg_001", "trust": "VERIFIED"},
             {"source_type": "visual", "event_id": "event_001", "trust": "VERIFIED"}],
            conflict={"flag": True}, status="PARTIALLY_SUPPORTED",
        )
        self.assertTrue(any("conflict" in l.lower() for l in lines))

    def test_explain_trust_never_fabricates(self):
        lines = evidence.explain_trust([], conflict=None, status="NOT_FOUND")
        self.assertEqual(lines, ["No supporting evidence is attached to this claim."])

    def test_ask_carries_trust_explanation(self):
        """The /ask payload must include the structured explanation block."""
        job_id, _ = _fixtures.register_lecture()
        quiz_id = _fixtures.register_quiz(job_id)
        try:
            r = client.post("/ask", json={"job_id": job_id, "question": "What does a variable do?"})
            self.assertEqual(r.status_code, 200, r.text[:200])
            answer = r.json()
            exp = answer.get("trust_explanation")
            self.assertIsInstance(exp, dict)
            self.assertIsInstance(exp.get("lines"), list)
            self.assertTrue(exp["lines"], "no explanation lines for a grounded claim")
        finally:
            _fixtures.remove_lecture(job_id)


class ReplayTests(unittest.TestCase):
    def setUp(self):
        self.job_id, _ = _fixtures.register_lecture()
        self.files = [self.job_id]

    def tearDown(self):
        for job_id in self.files:
            _fixtures.remove_lecture(job_id)

    def test_replay_returns_stored_evidence(self):
        r = client.get(f"/lectures/{self.job_id}/replay", params={"timestamp": 3.0})
        self.assertEqual(r.status_code, 200, r.text[:200])
        d = r.json()
        self.assertEqual(d["moment"]["event_id"], "event_001")
        self.assertEqual(d["moment"]["type"], "code")
        self.assertEqual(d["transcript_context"]["text"], "Now we create a Python variable.")
        self.assertIn("source_frames", d)
        self.assertEqual(d["moment"]["seek_to"], d["moment"]["timestamp"])

    def test_replay_unknown_job_is_404(self):
        r = client.get("/lectures/does_not_exist/replay", params={"timestamp": 1.0})
        self.assertEqual(r.status_code, 404)
        self.assertIn("not found", r.json()["detail"].lower())

    def test_replay_distant_timestamp_is_404(self):
        r = client.get(f"/lectures/{self.job_id}/replay", params={"timestamp": 9999.0})
        self.assertEqual(r.status_code, 404)
        self.assertIn("close", r.json()["detail"].lower())


class ProgressTests(unittest.TestCase):
    def setUp(self):
        self.student = _new_student()
        self.job_id, _ = _fixtures.register_lecture()
        self.quiz_id = _fixtures.register_quiz(self.job_id)
        self.files = [self.job_id]
        _fixtures.remove_history(self.student)

    def tearDown(self):
        for job_id in self.files:
            _fixtures.remove_lecture(job_id)
        _fixtures.remove_history(self.student)

    def _write_history(self):
        ts = datetime.now(timezone.utc).isoformat()
        history = {
            "current_level": "medium",
            "previous_scores": [50, 50],
            "weak_topics": [],
            "strong_topics": [],
            "attempts": [
                {"quiz_id": self.quiz_id, "lesson_title": "Variables lecture",
                 "score_percent": 50, "timestamp": ts, "questions": [
                     {"concept": "variables", "question": "What does a Python variable do?",
                      "correct": False},
                     {"concept": "loops", "question": "Loops repeat a block of code?",
                      "correct": True},
                 ]},
                {"quiz_id": self.quiz_id, "lesson_title": "Variables lecture",
                 "score_percent": 50, "timestamp": ts, "questions": [
                     {"concept": "variables", "question": "What does a Python variable do?",
                      "correct": False},
                     {"concept": "loops", "question": "Loops repeat a block of code?",
                      "correct": True},
                 ]},
            ],
        }
        path = config.STUDENTS_DIR / f"{self.student}_history.json"
        path.write_text(json.dumps(history, ensure_ascii=False), encoding="utf-8")

    def test_progress_from_real_history(self):
        self._write_history()
        d = client.get(f"/students/{self.student}/progress").json()
        self.assertEqual(d["summary"]["attempts"], 2)
        self.assertEqual(d["summary"]["average_score"], 50.0)
        needs = {t["topic"]: t for t in d["needs_review"]}
        self.assertIn("variables", needs)
        self.assertEqual(needs["variables"]["correct"], 0)
        self.assertIn("What does a Python variable do?", needs["variables"]["missed_questions"])
        strong = {t["topic"] for t in d["strong_topics"]}
        self.assertIn("loops", strong)
        missed = [m["question"] for m in d["repeatedly_missed"]]
        self.assertIn("What does a Python variable do?", missed)
        self.assertEqual(d["score_history"], [50, 50])
        self.assertEqual(len(d["lecture_history"]), 1)
        self.assertTrue(d["next_action"]["suggested"])

    def test_progress_empty_student(self):
        d = client.get(f"/students/{self.student}/progress").json()
        self.assertEqual(d["summary"]["attempts"], 0)
        self.assertFalse(d["repeatedly_missed"])
        self.assertIn("Complete a quiz", d["next_action"]["text"])


class MetricsAndPipelineTests(unittest.TestCase):
    def setUp(self):
        self.job_id, _ = _fixtures.register_lecture()
        self.files = [self.job_id]
        _fixtures.register_quiz(self.job_id)

    def tearDown(self):
        for job_id in self.files:
            _fixtures.remove_lecture(job_id)

    def test_metrics_are_real_counts(self):
        d = client.get(f"/lectures/{self.job_id}/metrics").json()
        self.assertEqual(d["video_duration_seconds"], 9.0)
        self.assertEqual(d["transcript_segments"], 2)
        self.assertGreater(d["transcript_words"], 0)
        self.assertEqual(d["visual_events"], 2)
        self.assertEqual(d["quiz_questions"], 2)
        self.assertEqual(d["accessibility_events"], 2)
        self.assertIn("live", d["computed_at"].lower())

    def test_pipeline_status_canonical_order(self):
        d = client.get(f"/lectures/{self.job_id}/pipeline-status").json()
        self.assertEqual(d["job_status"], "done")
        self.assertTrue(d["ready"])
        names = [s["name"] for s in d["stages"]]
        self.assertIn("UPLOAD", names)
        self.assertIn("SPEECH TRANSCRIPTION", names)
        self.assertIn("VISUAL ANALYSIS", names)
        self.assertIn("MISSING INFORMATION", names)
        self.assertIn("READY", names)
        for s in d["stages"]:
            self.assertIn(s["status"],
                          {"completed", "cached", "running", "pending", "skipped", "failed"})
        pct = d.get("elapsed_pct")
        if pct is not None:
            self.assertTrue(0 <= pct <= 100)

    def test_pipeline_status_counts(self):
        d = client.get(f"/lectures/{self.job_id}/pipeline-status").json()
        speech = next(s for s in d["stages"] if s["name"] == "SPEECH TRANSCRIPTION")
        self.assertEqual(speech["counts"]["segments"], 2)
        quiz = next(s for s in d["stages"] if s["name"] == "QUIZ GENERATION")
        self.assertEqual(quiz["counts"]["questions"], 2)


class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.job_id, _ = _fixtures.register_lecture()
        self.files = [self.job_id]

    def tearDown(self):
        for job_id in self.files:
            _fixtures.remove_lecture(job_id)

    def test_404_is_friendly_json(self):
        for path in ("/lectures/nope/score", "/lectures/nope/report",
                     "/lectures/nope/metrics", "/lectures/nope/presentation",
                     "/lectures/nope/replay?timestamp=0"):
            r = client.get(path)
            self.assertEqual(r.status_code, 404, path)
            self.assertNotIn("Traceback", r.text)

    def test_404_unknown_student_progress_is_empty_not_error(self):
        # No student store exists; progress for an unknown student is an
        # honest empty history (200), never a fabricated 'learner'.
        r = client.get("/students/nope/progress")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["summary"]["attempts"], 0)

    def test_500_handler_never_leaks_traceback(self):
        safe_client = TestClient(app, raise_server_exceptions=False)

        @app.get("/__test__crash")
        async def _crash():
            raise ValueError("boom")

        try:
            r = safe_client.get("/__test__crash")
            self.assertEqual(r.status_code, 500)
            body = r.json()
            self.assertIn("unexpected error", body["detail"])
            self.assertNotIn("boom", r.text)
            self.assertNotIn("Traceback", r.text)
        finally:
            app.routes[:] = [route for route in app.routes
                             if getattr(route, "path", None) != "/__test__crash"]

    def test_global_handler_preserves_friendly_details(self):
        r = client.get("/lectures/not_there/report")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["detail"], "job_id not found. Upload a video first.")


class DemoModeTests(unittest.TestCase):
    def test_demo_script_importable(self):
        """The demo lecture generator must remain a runnable, importable module."""
        import backend.scripts.make_demo_lecture as demo
        self.assertTrue(any(callable(getattr(demo, name))
                            for name in ("build", "render_scene", "generate_audio")))
        self.assertTrue(callable(demo.build))


if __name__ == "__main__":
    unittest.main()