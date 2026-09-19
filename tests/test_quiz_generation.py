import unittest
from unittest.mock import patch, MagicMock
import json
import sys
from pathlib import Path

# Mocking before imports
sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services import quiz_generator

class TestQuizGeneration(unittest.TestCase):

    def tearDown(self):
        artifact = Path("data/quizzes/job123_quiz.json")
        if artifact.exists():
            try:
                artifact.unlink()
            except OSError:
                pass

    @patch('backend.services.ai.gemma_service.GemmaService.is_cloud_ready', return_value=False)
    @patch('backend.services.llm.call_llm')
    def test_quiz_generation_schema(self, mock_call_llm, mock_cloud):
        # Setup mock response matching the target quiz JSON schema
        mock_response = json.dumps([
            {
                "question": "What keyword starts a for loop in Python?",
                "type": "multiple_choice",
                "options": ["for", "loop", "while"],
                "answer": "for",
                "concept": "loops",
                "source_refs": {
                    "transcript_segments": [1],
                    "visual_events": ["event_002"]
                }
            }
        ])
        mock_call_llm.return_value = mock_response

        # Execute
        quiz = quiz_generator.generate_quiz("job123", "We will write a for loop.", [{"start": 0.0, "end": 5.0, "type": "code"}])

        # Validate
        self.assertEqual(len(quiz), 1)
        self.assertEqual(quiz[0]["question"], "What keyword starts a for loop in Python?")
        self.assertEqual(quiz[0]["type"], "multiple_choice")
        self.assertEqual(quiz[0]["answer"], "for")
        self.assertEqual(quiz[0]["concept"], "loops")
        self.assertEqual(quiz[0]["source_refs"]["visual_events"], ["event_002"])

    def test_fallback_quiz_generation(self):
        # Test that fallback is triggered and outputs expected structure when LLM fails
        transcript = "This is a python lesson about variables and loops."
        fallback = quiz_generator._generate_fallback_quiz(transcript)
        
        self.assertGreater(len(fallback), 0)
        for q in fallback:
            self.assertIn("question", q)
            self.assertIn("type", q)
            self.assertIn("options", q)
            self.assertIn("answer", q)
            self.assertIn("concept", q)
            self.assertIn("source_refs", q)

if __name__ == '__main__':
    unittest.main()
