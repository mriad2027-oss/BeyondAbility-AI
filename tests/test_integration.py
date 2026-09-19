import unittest
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path
import json

# Mocking before imports
sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services.pipeline import run_pipeline
from backend import storage, config
from backend.services import quiz

class TestIntegrationPipeline(unittest.TestCase):

    @patch('backend.services.ai.hf_client.HFClient.is_configured', new_callable=MagicMock(return_value=False))
    @patch('backend.services.pipeline._load_existing_events')
    @patch('backend.services.video.check_system_dependencies')
    @patch('backend.services.video.get_video_metadata')
    @patch('backend.services.video.extract_audio')
    @patch('backend.services.video.extract_frames')
    @patch('backend.services.speech.resolve_language')
    @patch('backend.services.speech.detect_language')
    @patch('backend.services.speech.transcribe')
    @patch('backend.services.speech.save_transcript')
    @patch('backend.services.speech.save_srt')
    @patch('backend.services.tts.text_to_speech')
    @patch('backend.services.tts.mix_narration_audio')
    @patch('backend.services.llm._call_llm')
    def test_end_to_end_pipeline(self, mock_llm_call, mock_mix, mock_tts, 
                                 mock_save_srt, mock_save_transcript, mock_transcribe,
                                 mock_detect_lang, mock_resolve_lang,
                                 mock_extract_frames, mock_extract_audio, 
                                 mock_get_metadata, mock_check_deps, mock_load_events,
                                 mock_hf_configured):
        
        # All of this uses Arabic audio; language detection sees Arabic and
        # forces "ar" (first-class handling, never translation).
        mock_detect_lang.return_value = {
            "language": "ar", "confidence": 0.9,
            "probabilities": {"ar": 0.9, "en": 0.08},
        }
        mock_resolve_lang.return_value = "ar"

        # Mock dependencies & metadata
        mock_load_events.return_value = [
            {
                "start": 0.0,
                "end": 4.0,
                "type": "slide",
                "description": "Intro screen showing python course.",
                "transcript_context": "",
                "confidence": 0.9,
                "source_frames": ["frame_0000.jpg"]
            },
            {
                "start": 4.0,
                "end": 8.0,
                "type": "code",
                "description": "Code editor showing variable assignment.",
                "transcript_context": "",
                "confidence": 0.9,
                "source_frames": ["frame_0001.jpg"]
            }
        ]
        mock_check_deps.return_value = {"ffmpeg": True, "tesseract": True}
        mock_get_metadata.return_value = {
            "duration": 10.0,
            "fps": 30.0,
            "width": 640,
            "height": 480,
            "frame_count": 300
        }
        mock_extract_audio.return_value = "dummy.wav"
        mock_extract_frames.return_value = [
            {"path": "frame_0000.jpg", "timestamp": 0.0},
            {"path": "frame_0001.jpg", "timestamp": 5.0}
        ]

        # Mock transcribing
        mock_transcribe.return_value = {
            "text": "مرحباً بكم في درس اليوم حول المتغيرات.",
            "segments": [
                {"id": 0, "start": 0.0, "end": 4.0, "text": "مرحباً بكم في درس اليوم"},
                {"id": 1, "start": 4.0, "end": 8.0, "text": "حول المتغيرات في لغة بايثون"}
            ]
        }
        mock_save_transcript.return_value = "dummy_transcript.txt"
        mock_save_srt.return_value = "dummy.srt"

        # Grader mock responses in order of call_llm / _call_llm invocations:
        mock_llm_call.side_effect = [
            # 1. Personalized description for event 1 (OCR fallback)
            "Intro screen",
            # 2. Personalized description for event 2 (OCR fallback)
            "Code showing x = 10",
            # 3. Quiz generation response (from generate_quiz)
            json.dumps([
                {
                    "concept": "variables",
                    "question": "ما هي الفائدة من المتغيرات؟",
                    "type": "multiple_choice",
                    "options": ["تخزين البيانات", "حذف الملفات"],
                    "answer": "تخزين البيانات",
                    "source_refs": {"transcript_segments": [0, 1], "visual_events": []}
                },
                {
                    "concept": "variables",
                    "question": "وضح مفهوم المتغير في سطر واحد.",
                    "type": "short_answer",
                    "options": [],
                    "answer": "مساحة تخزينية في الذاكرة",
                    "source_refs": {"transcript_segments": [1], "visual_events": []}
                }
            ]),
            # 4. Grader response (from evaluate_short_answer_semantic)
            json.dumps({
                "correct": True,
                "score": 1.0,
                "feedback": "إجابة صحيحة وممتازة!",
                "matched_concepts": ["variables"],
                "missing_concepts": []
            })
        ]

        # 2. Run realistic pipeline
        job_id = "test_integration_job"
        # Use a unique fake video stem so tests NEVER overwrite real lecture
        # outputs (previously this test clobbered the production assets for
        # the real 2924ba8f8909 lecture).
        stem = f"itest_{job_id}"
        video_path = f"data/videos/{stem}.mp4"
        student_id = "itest_student"
        
        # Prepare storage
        if storage.job_exists(job_id):
            try:
                storage._job_path(job_id).unlink()
            except OSError:
                pass
        storage.create_job(job_id, {"video_path": video_path, "filename": Path(video_path).name})

        # Run pipeline
        res = run_pipeline(job_id, video_path, mode="both", student_id=student_id)

        # Verify pipeline execution outputs
        self.assertIn("transcript_text", res)
        self.assertIn("accessibility_events", res)
        self.assertIn("accessibility_metrics", res)
        
        # Check generated output files (default profile => mode 'default')
        self.assertTrue(Path(config.OUTPUTS_DIR / f"{stem}_accessibility_default.json").exists())
        self.assertTrue(Path(config.OUTPUTS_DIR / f"{stem}_captions.json").exists())
        
        # Verify auto-generated quiz is saved
        quiz_path = config.QUIZZES_DIR / f"{job_id}_quiz.json"
        self.assertTrue(quiz_path.exists())

        # 3. Quiz submission and grading
        answers = {
            "0": "تخزين البيانات",
            "1": "مساحة تخزين في الذاكرة"
        }
        graded = quiz.grade_quiz(f"{job_id}_quiz", answers, student_id=student_id)
        
        # Validate evaluation
        self.assertEqual(graded["score_percent"], 100.0)
        self.assertEqual(graded["results"][0]["correct"], True)
        self.assertEqual(graded["results"][1]["correct"], True)

        # Cleanup -- every artifact this test created must be removed.
        for pattern in [f"{stem}_accessibility_default.json", f"{stem}_captions.json",
                        f"{stem}_transcript.txt", f"{stem}.srt", f"{stem}.vtt",
                        f"{stem}_segments.json", f"{stem}_visual_events.json"]:
            p = config.OUTPUTS_DIR / pattern
            if p.exists():
                try:
                    p.unlink()
                except OSError:
                    pass
        if quiz_path.exists():
            try:
                quiz_path.unlink()
            except OSError:
                pass
        if storage.job_exists(job_id):
            try:
                storage._job_path(job_id).unlink()
            except OSError:
                pass
        hist = Path(f"data/students/{student_id}_history.json")
        if hist.exists():
            try:
                hist.unlink()
            except OSError:
                pass

if __name__ == '__main__':
    unittest.main()
