import unittest
from unittest.mock import patch, MagicMock
import json
import sys
from pathlib import Path

# Mocking before imports
sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services import accessibility

class TestStudentProfiles(unittest.TestCase):

    def test_load_student_profile_fallback(self):
        # Fallback profile when student_id not found
        profile = accessibility.load_student_profile("non_existent_id")
        self.assertEqual(profile["id"], "non_existent_id")
        self.assertEqual(profile["accessibility_mode"], "default")
        self.assertEqual(profile["speech_rate"], 1.0)
        self.assertEqual(profile["quiz_difficulty"], "adaptive")

    def test_load_student_profile_success(self):
        # We check the structure loaded matches profile.json or fallback defaults
        # Profile ID 001 exists in data/students/profiles.json
        profile = accessibility.load_student_profile("001")
        self.assertEqual(profile["id"], "001")
        self.assertEqual(profile["accessibility_mode"], "blind") # mapped from 'visual' accessibility_need
        self.assertEqual(profile["preferred_output"], "audio")

if __name__ == '__main__':
    unittest.main()
