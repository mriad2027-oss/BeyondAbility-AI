import unittest
from unittest.mock import patch, MagicMock
import json
import numpy as np

# Mocking modules before importing backend services to avoid environment errors during import
import sys
sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services import video, vision, pipeline, llm


class TestVisualPipeline(unittest.TestCase):

    @patch('cv2.VideoCapture')
    def test_get_video_metadata_success(self, mock_vc):
        instance = mock_vc.return_value
        instance.isOpened.return_value = True
        instance.get.side_effect = lambda prop: {
            5: 30.0, # CAP_PROP_FPS
            7: 300,  # CAP_PROP_FRAME_COUNT
            3: 640,  # CAP_PROP_FRAME_WIDTH
            4: 480   # CAP_PROP_FRAME_HEIGHT
        }.get(prop, 0.0)

        with patch('backend.services.video.Path.exists', return_value=True):
            meta = video.get_video_metadata("dummy_video.mp4")
            self.assertEqual(meta["duration"], 10.0)
            self.assertEqual(meta["fps"], 30.0)
            self.assertEqual(meta["width"], 640)
            self.assertEqual(meta["height"], 480)
            self.assertEqual(meta["frame_count"], 300)

    @patch('shutil.which')
    def test_check_system_dependencies(self, mock_which):
        # Both exist
        mock_which.side_effect = lambda cmd: "/usr/bin/" + cmd
        deps = video.check_system_dependencies()
        self.assertTrue(deps["ffmpeg"])
        self.assertTrue(deps["tesseract"])

        # ffmpeg missing
        mock_which.side_effect = lambda cmd: None if cmd == "ffmpeg" else "/usr/bin/tesseract"
        deps = video.check_system_dependencies()
        self.assertFalse(deps["ffmpeg"])
        self.assertTrue(deps["tesseract"])

    def test_calculate_frame_difference(self):
        frame1 = np.zeros((100, 100, 3), dtype=np.uint8)
        frame2 = np.ones((100, 100, 3), dtype=np.uint8) * 10
        
        diff = video.calculate_frame_difference(frame1, frame2)
        self.assertAlmostEqual(diff, 10.0, places=1)

    @patch('cv2.VideoCapture')
    @patch('cv2.imwrite')
    @patch('backend.services.video.calculate_frame_difference')
    def test_extract_frames_scene_change(self, mock_diff, mock_write, mock_vc):
        instance = mock_vc.return_value
        instance.isOpened.return_value = True
        instance.get.return_value = 10.0 # FPS
        
        frame_mock = np.zeros((10, 10, 3), dtype=np.uint8)
        instance.read.side_effect = [
            (True, frame_mock),
            (True, frame_mock),
            (True, frame_mock),
            (False, None)
        ]
        
        # First frame always saved.
        # Second candidate: diff = 2.0 (below threshold 5.0) -> skip
        # Third candidate: diff = 6.0 (above threshold 5.0) -> save
        mock_diff.side_effect = [2.0, 6.0]
        
        with patch('backend.services.video.Path.exists', return_value=True):
            frames = video.extract_frames("dummy.mp4", interval_seconds=0.05, scene_threshold=5.0)
            
            self.assertEqual(len(frames), 2)
            self.assertEqual(frames[0]["timestamp"], 0.0)
            self.assertEqual(frames[1]["timestamp"], 0.2)

    def test_classify_ocr_text(self):
        self.assertEqual(vision.classify_ocr_text("def binary_search(arr):"), "code")
        self.assertEqual(vision.classify_ocr_text("Slide Title: Introduction"), "slide")
        self.assertEqual(vision.classify_ocr_text(""), "scene")

    @patch('pytesseract.image_to_string')
    @patch('PIL.Image.open')
    def test_describe_with_ocr(self, mock_image_open, mock_ocr):
        mock_ocr.return_value = "def my_func():\n   print(5)"
        res = vision._describe_with_ocr("dummy.jpg")
        self.assertIn("OCR-only output", res["description"])
        self.assertEqual(res["type"], "code")
        self.assertEqual(res["confidence"], 0.7)

        mock_ocr.return_value = ""
        res = vision._describe_with_ocr("dummy.jpg")
        self.assertIn("No readable on-screen text", res["description"])
        self.assertEqual(res["type"], "scene")

    def test_clean_json_response(self):
        raw = "```json\n{\n  \"type\": \"code\",\n  \"description\": \"Arabic text\",\n  \"confidence\": 0.95\n}\n```"
        data = vision.clean_json_response(raw)
        self.assertEqual(data["type"], "code")
        self.assertEqual(data["confidence"], 0.95)

    def test_template_accessibility_description_duplicate(self):
        desc1 = llm._template_accessibility_description("Teacher says hello.", "Visual description of slide.", "Visual description of slide.")
        self.assertEqual(desc1, "Teacher says hello.")

        desc2 = llm._template_accessibility_description("Teacher says hello.", "Visual description of slide.", "Different slide.")
        self.assertEqual(desc2, "Teacher says hello. Meanwhile, on screen: Visual description of slide.")

    def test_find_event_for_time(self):
        events = [
            {"start": 0.0, "end": 5.0, "description": "event1"},
            {"start": 5.0, "end": 10.0, "description": "event2"}
        ]
        ev = pipeline._find_event_for_time(events, 2.5)
        self.assertEqual(ev["description"], "event1")
        
        ev_fallback = pipeline._find_event_for_time(events, 12.0)
        self.assertEqual(ev_fallback["description"], "event2")


if __name__ == '__main__':
    unittest.main()
