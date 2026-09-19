"""API surface tests: upload validation, job lifecycle, health, system status."""

import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app
from backend import config, storage
from tests import _fixtures

client = TestClient(app)

_FAKE_VIDEO_BYTES = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"0" * 128


class TestApi(unittest.TestCase):

    def setUp(self):
        self._created_jobs = []

    def tearDown(self):
        for job_id in self._created_jobs:
            _fixtures.remove_job(job_id)
        for p in list(config.VIDEOS_DIR.glob("test_upload_*.mp4")):
            try:
                p.unlink()
            except OSError:
                pass

    def test_root(self):
        r = client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("service", r.json())

    def test_health(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")

    def test_system_status(self):
        r = client.get("/system/status")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("dependencies", body)
        self.assertIn("ffmpeg", body["dependencies"])
        self.assertIn("whisper_model", body)

    def test_upload_rejects_bad_extension(self):
        r = client.post("/upload", files={"file": ("notes.txt", b"hello")})
        self.assertEqual(r.status_code, 415)

    def test_upload_rejects_empty_file(self):
        r = client.post("/upload", files={"file": ("clip.mp4", b"")})
        self.assertEqual(r.status_code, 400)

    def test_upload_rejects_non_video_magic(self):
        r = client.post("/upload", files={"file": ("evil.mp4", b"<script>alert(1)</script>")})
        self.assertEqual(r.status_code, 400)

    def test_upload_accepts_video_and_creates_job(self):
        r = client.post("/upload", files={"file": ("test_upload_1.mp4", _FAKE_VIDEO_BYTES)})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertIn("job_id", body)
        self.assertTrue(storage.job_exists(body["job_id"]))
        self._created_jobs.append(body["job_id"])
        # The stored filename must be sanitised (no path traversal).
        job = storage.get_job(body["job_id"])
        self.assertNotIn("..", job["video_path"])

    def test_process_unknown_job_404(self):
        r = client.post("/process", json={"job_id": "does_not_exist", "mode": "both"})
        self.assertEqual(r.status_code, 404)

    def test_result_unknown_job_404(self):
        r = client.get("/result/does_not_exist")
        self.assertEqual(r.status_code, 404)

    @patch("backend.routes.process.run_pipeline")
    def test_process_queues_and_completes(self, mock_pipeline):
        upload = client.post("/upload", files={"file": ("test_upload_2.mp4", _FAKE_VIDEO_BYTES)}).json()
        job_id = upload["job_id"]
        self._created_jobs.append(job_id)

        def fake_pipeline(job_id, video_path, mode, student_id, accessibility_mode):
            storage.update_job(job_id, status="done", progress=100, current_stage="completed",
                               result={"transcript_text": "hello", "segments": []})
            return {}

        mock_pipeline.side_effect = fake_pipeline
        r = client.post("/process", json={"job_id": job_id, "mode": "both", "student_id": "default"})
        self.assertEqual(r.status_code, 200)
        poll = client.get(f"/result/{job_id}").json()
        self.assertEqual(poll["status"], "done")

    def test_real_pipeline_failure_is_honest(self):
        """A bogus video should end in 'failed' with an error -- never fake success."""
        r = client.post("/upload", files={"file": ("broken.mp4", b"\x00\x00\x00\x18ftypmp42notreallyvideo")})
        self.assertEqual(r.status_code, 200)
        job_id = r.json()["job_id"]
        self._created_jobs.append(job_id)

        r2 = client.post("/process", json={"job_id": job_id, "mode": "hearing"})
        self.assertEqual(r2.status_code, 200)
        job = client.get(f"/result/{job_id}").json()
        self.assertEqual(job["status"], "failed")
        self.assertTrue(job.get("error"))


if __name__ == "__main__":
    unittest.main()