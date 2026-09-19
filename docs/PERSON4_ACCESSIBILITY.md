# Person 4 Layer: Accessibility Intelligence & Adaptive Learning

EduAccess AI's accessibility layer translates visual events and spoken audio into a cohesive, personalized, non-disruptive, and educational accessibility stream tailored to each student's needs.

---

## 1. Architecture Overview

```
                 [ Transcript Segments ] ────┐
                                             ├─► [ build_accessibility_segments ]
                 [ Visual Events (P3) ] ─────┘                   │
                                                                 ▼
                                                  [ should_describe_event ]
                                                                 │
                                         ┌───────────────────────┴───────────────────────┐
                                         ▼ (should_describe=True)                        ▼ (should_describe=False)
                           [ generate_personalized_description ]                         [ Skip / Log Reason ]
                                         │
                                         ▼
                           [ mix_narration_audio ] (ffmpeg amix)
                                         │
                                         ▼
                             [ Timed Narration WAV/MP3 ]
```

The pipeline runs as follows:
1. **Fusion & Filtering:** Spoken transcripts are aligned with visual events to calculate a **visual importance score** (heuristics based on category, educational terminology match, visual confidence, and novelty).
2. **Personalized Accessibility Mapping:** The filtered visual events are sent to the LLM (or a deterministic template fallback) to generate description text tailored specifically to the student's accessibility needs (e.g., blind vs. low-vision).
3. **Speech Overlap Prevention:** The duration of the description is estimated and compared to the speaker's silence gaps. High/critical priority descriptions can overlap speech if needed, while lower priority descriptions are skipped or deferred.
4. **Synchronized Timeline Mixing:** Individual audio segments are generated via TTS (pyttsx3 offline or OpenAI online) and mixed into a single timeline WAV file using FFmpeg's `adelay` and `amix`.
5. **Auto Quiz & Grading:** An educational quiz is generated based on transcript and visual events, and submissions are graded semantically.

---

## 2. Accessibility Modes

* **`blind` (mapped from "visual"):** Prioritizes spatial structures, layout controls, code listings, diagrams, charts, and key textual information.
* **`low_vision`:** Focuses on layout emphasis, high-contrast details, zoom-worthy elements, and visual structure.
* **`cognitive_support`:** Simplifies vocabulary, shortens sentences, bubbles important concepts to the front, and removes verbose details.
* **`deaf` / `hard_of_hearing`:** Captions contain the main speech while visual event filtering highlights silent demonstrations and visual transitions that add context.
* **`default` (mapped from "none" / "general"):** Balanced settings with default fallbacks.

---

## 3. Visual/Audio Fusion & Importance Scoring

Visual event importance is calculated via `calculate_visual_importance()`:
* **Base Value:** Depends on type (`code` = 0.90, `diagram` = 0.85, `scene` = 0.30, etc.).
* **Educational Boost:** +0.10 if description/context contains terms like `loop`, `variable`, `stack`, `متغير`, etc.
* **Silence Bonus:** +0.08 if there is no overlapping transcript.
* **Novelty Factor:** +0.12 if different from previous event; -0.18 if redundant/identical.
* **Confidence Scaling:** Scaled by `(0.65 + 0.35 * confidence)`.

If the score passes the mode's threshold (e.g., `>= 0.48` for blind), it is described. Otherwise, it is skipped as redundant or low-value.

---

## 4. Auto Quiz Generation

Quizzes are generated under `backend/services/quiz_generator.py` using a structured system prompt or keyword-based fallback:
* **MCQ:** Multiple-choice questions with 3-4 options.
* **True/False:** True/False questions (uses Arabic `صح`/`خطأ` if language is Arabic).
* **Short Answer:** Open conceptual questions.

Every question contains a `concept` tag (e.g., `"variables"`) and `source_refs` back to transcript segments and visual events.

---

## 5. Short Answer Semantic Grading

Short answer questions are evaluated in `backend/services/quiz.py` under `evaluate_short_answer_semantic`:
1. **Direct Match:** Arabic-normalized equivalence check (strips diacritics/harakat, standardizes letters like Alef `إأآ` -> `ا`, Tah-Marbuta `ة` -> `ه`, Yeh `ى` -> `ي`).
2. **Jaccard Word Overlap Fallback:** Measures overlap between student and correct answers. If Jaccard index `>= 0.35`, the answer is accepted.
3. **Semantic AI Grader:** The LLM evaluates conceptual correctness rather than strict word matching and returns a structured feedback JSON.

---

## 6. Adaptive Learning Engine

* **Weak Topic Detection:** Performance is aggregated by `concept`. Topics with scores `< 70%` are flagged as weak topics.
* **Adaptive Quiz Difficulty:**
  * Score `>= 80%` ➔ Increases next difficulty to `hard`.
  * Score `< 50%` ➔ Lowers next difficulty to `easy`.
  * Otherwise ➔ Maintains current difficulty level.
* **Tutor Recommendations:** Grounded recommendations are generated based on weak concepts and performance metrics.

---

## 7. Accessibility-Aware TTS

The TTS normalization in `backend/services/tts.py` translates mathematical and code notations into natural speech:
* `x >= 10` ➔ `x is greater than or equal to 10` (or `x أكبر من أو يساوي 10`).
* `name = "Omnya"` ➔ `name equals Omnya` (or `اسم المتغير يساوي أومنيا`).

---

## 8. Configuration (`.env`)

* `WHISPER_MODEL_SIZE`: Whisper model size (`tiny`, `base`, `small`, etc.).
* `VISION_PROVIDER` / `LLM_PROVIDER`: `auto`, `openai`, `anthropic`, or `ocr`/`template`.
* `TTS_PROVIDER`: `pyttsx3` or `openai`.
* `FRAME_MIN_INTERVAL` / `SCENE_CHANGE_THRESHOLD`: Timing and difference configurations for OpenCV.

---

## 9. API Endpoints

* `POST /upload` - Upload video.
* `POST /process` - Run accessibility pipeline with student profile.
* `GET /result/{job_id}` - Fetch processing results.
* `GET /quizzes` - List available quizzes.
* `GET /quizzes/{quiz_id}` - Fetch quiz questions.
* `POST /quizzes/submit` - Submit answers for grading, adaptive feedback, and recommendations.

---

## 10. Data Formats

### Accessibility Content Output
```json
{
  "schema_version": "person4.v1",
  "job_id": "...",
  "accessibility_profile": {},
  "language": "en" | "ar",
  "summary": "...",
  "important_concepts": ["variables", "loops"],
  "accessibility_events": [
    {
      "segment_id": "seg_001",
      "start": 0.0,
      "end": 4.0,
      "play_start": 4.0,
      "transcript": "...",
      "description": "...",
      "should_describe": true,
      "priority": "high",
      "importance": 0.72,
      "reason": "...",
      "confidence": 0.9,
      "interrupts_speech": false,
      "source_refs": {
        "transcript_segments": ["seg_001"],
        "visual_events": ["event_001"]
      }
    }
  ],
  "captions": [],
  "quality_score": 85,
  "metrics": {}
}
```

---

## 11. Testing and Verification

Run tests:
```bash
python -m pytest
```
Unit tests cover:
1. Student profile loading and fallback modes.
2. Heuristics for visual event importance scoring.
3. Decision policies on redundant description suppression.
4. Auto-generated quiz schemas, MCQs, and T/F.
5. Arabic-normalized direct match and semantic grader.
6. Weak topic extraction and difficulty adjustment logic.

---

## 12. Competition Demo Workflow

1. Select **"deaf"** or **"blind"** profile in the sidebar.
2. Upload video in the **"Process a Lesson"** tab and process it.
3. Observe **"WHAT THE BLIND STUDENT HEARS"** (audio narration track playing during silence gaps) versus **"WHAT THE AI ADDS"** (synchronized timelines, detailed descriptions, and metrics panel).
4. Take the auto-generated quiz in the **"Take a Quiz"** tab, input varying answers, and inspect the semantic feedback, weak topic detection, and difficulty adjustment.
