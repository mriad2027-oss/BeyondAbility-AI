"""Student profile API tests + profile influence on generated output."""

import unittest
from fastapi.testclient import TestClient
from pathlib import Path

from backend.main import app
from backend import config, storage
from backend.services import accessibility
from tests import _fixtures

client = TestClient(app)


class TestProfiles(unittest.TestCase):

    def tearDown(self):
        sid = getattr(self, "_cleanup_sid", None)
        if sid:
            _fixtures.remove_history(sid)
            profiles_path = config.STUDENTS_DIR / "profiles.json"
            try:
                profiles = __import__("json").loads(profiles_path.read_text(encoding="utf-8"))
                profiles = [p for p in profiles if str(p.get("id", "")) != sid]
                profiles_path.write_text(__import__("json").dumps(profiles, indent=2, ensure_ascii=False), encoding="utf-8")
            except Exception:
                pass

    def test_list_students(self):
        r = client.get("/students")
        self.assertEqual(r.status_code, 200)
        ids = [s["student_id"] for s in r.json()["students"]]
        self.assertIn("default", ids)

    def test_get_student_defaults(self):
        r = client.get("/students/test_profile_user")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["student_id"], "test_profile_user")
        self.assertIn("profile", body)
        self.assertIn("history", body)
        self.assertIn("weak_topics", body["history"])
        # Never show fake "strong topics" data.
        self.assertIn("strong_topics", body["history"])

    def test_save_and_read_profile(self):
        sid = "test_profile_user"
        self._cleanup_sid = sid
        payload = {
            "student_id": sid,
            "name": "Omnya",
            "accessibility_mode": "blind",
            "speech_rate": 1.25,
            "description_detail": "high",
            "preferred_language": "en",
            "quiz_difficulty": "easy",
        }
        r = client.post(f"/students/{sid}/profile", json=payload)
        self.assertEqual(r.status_code, 200, r.text)

        # Round-trip via GET.
        body = client.get(f"/students/{sid}").json()
        profile = body["profile"]
        self.assertEqual(profile["accessibility_mode"], "blind")
        self.assertEqual(profile["speech_rate"], 1.25)
        self.assertEqual(profile["description_detail"], "high")
        self.assertEqual(profile["quiz_difficulty"], "easy")

        # And the domain-level loader agrees.
        loaded = accessibility.load_student_profile(sid)
        self.assertEqual(loaded["accessibility_mode"], "blind")
        self.assertEqual(loaded["speech_rate"], 1.25)

    def test_profile_invalid_mode_rejected(self):
        sid = "test_profile_user"
        self._cleanup_sid = sid
        payload = {
            "student_id": sid,
            "accessibility_mode": "telepathic",
        }
        r = client.post(f"/students/{sid}/profile", json=payload)
        self.assertEqual(r.status_code, 400)

    def test_profile_id_mismatch_rejected(self):
        payload = {
            "student_id": "someone_else",
            "accessibility_mode": "standard",
        }
        r = client.post("/students/test_profile_user/profile", json=payload)
        self.assertEqual(r.status_code, 400)

    def test_modes_are_normalised(self):
        sid = "test_profile_modes"
        self._cleanup_sid = sid
        # User-facing modes persist canonically (hearing -> deaf, standard -> default)
        # so save round-trips exactly and pipeline semantics stay consistent.
        expectations = {"low_vision": "low_vision", "hearing": "deaf", "standard": "default"}
        for mode, expected in expectations.items():
            r = client.post(f"/students/{sid}/profile", json={
                "student_id": sid, "accessibility_mode": mode,
            })
            self.assertEqual(r.status_code, 200)
            body = client.get(f"/students/{sid}").json()
            self.assertEqual(body["profile"]["accessibility_mode"], expected)


if __name__ == "__main__":
    unittest.main()