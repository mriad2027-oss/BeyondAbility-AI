import unittest
from unittest.mock import patch, MagicMock
import json
import sys
from pathlib import Path

# Mocking before imports
sys.modules['pytesseract'] = MagicMock()
sys.modules['PIL'] = MagicMock()

from backend.services import quiz

class TestQuizGrading(unittest.TestCase):

    def test_normalize_arabic(self):
        self.assertEqual(quiz.normalize_arabic("الْقَلَمُ"), "القلم")
        self.assertEqual(quiz.normalize_arabic("إستخدام المكتبات"), "استخدام المكتبات")
        self.assertEqual(quiz.normalize_arabic("دالة برمجية جديدة"), "داله برمجيه جديده")

    @patch('backend.services.llm.call_llm')
    def test_evaluate_short_answer_semantic_correct(self, mock_call_llm):
        # Setup mock grader response for semantically correct answer
        mock_call_llm.return_value = json.dumps({
            "correct": True,
            "score": 1.0,
            "feedback": "Correct explanation!",
            "matched_concepts": ["variables"],
            "missing_concepts": []
        })

        res = quiz.evaluate_short_answer_semantic(
            question="What is a variable?",
            student_answer="A name referencing a stored value",
            correct_answer="A container for storing data values"
        )
        self.assertTrue(res["correct"])
        self.assertEqual(res["score"], 1.0)
        self.assertEqual(res["feedback"], "Correct explanation!")

    def test_evaluate_short_answer_fallback_jaccard(self):
        # Should match when there is high word overlap
        res = quiz.evaluate_short_answer_semantic(
            question="Explain LIFO in stacks.",
            student_answer="Last In First Out",
            correct_answer="Last In First Out principle"
        )
        self.assertTrue(res["correct"])

    @patch('backend.services.quiz.load_quiz')
    def test_grade_quiz_and_adapt_difficulty(self, mock_load):
        # Setup mock quiz with different types
        mock_load.return_value = [
            {
                "question": "What is range(5)?",
                "type": "multiple_choice",
                "options": ["0,1,2,3,4", "1,2,3,4,5"],
                "answer": "0,1,2,3,4",
                "concept": "ranges"
            },
            {
                "question": "Is Python compiled?",
                "type": "true_false",
                "options": ["True", "False"],
                "answer": "False",
                "concept": "compilation"
            }
        ]

        answers = {
            "0": "0,1,2,3,4",
            "1": "False"
        }

        # Clear history if exists
        history_path = Path("data/students/test_student_history.json")
        if history_path.exists():
            history_path.unlink()

        # Grade
        graded = quiz.grade_quiz("lesson1", answers, student_id="test_student")
        
        self.assertEqual(graded["score_percent"], 100.0)
        self.assertEqual(graded["correct_count"], 2)
        self.assertEqual(graded["next_difficulty"], "hard") # Adapted from medium to hard

        # Check history file
        self.assertTrue(history_path.exists())
        history_data = json.loads(history_path.read_text(encoding="utf-8"))
        self.assertEqual(history_data["current_level"], "hard")
        
        # Cleanup
        if history_path.exists():
            history_path.unlink()

if __name__ == '__main__':
    unittest.main()
