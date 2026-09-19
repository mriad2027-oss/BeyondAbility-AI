# Personal Learning Agent — Evidence Report (v2.3.0)

Audit date 2026-08-31 (UTC). Part of the **Intelligent Multimodal Learning Engine**
upgrade. The agent reasons **only** over real, stored data — the student's profile,
their real graded quiz attempts, and the lecture's real evidence timeline. It never
invents a concept, a score, or a timestamp.

## 1. What it is

`backend/services/learning_agent.py` builds a per-student **Personal Learning Agent**
view plus a ranked **Next Best Action**, exposed via:

- `GET /students/{sid}/learning-agent`
- `GET /students/{sid}/next-action`
- `GET /students/{sid}/learning-insights`

## 2. Real inputs only

| Input | Source | Never fabricated |
|---|---|---|
| Mastery per concept | real quiz question results (≥70% correct → mastered) | a concept is only "weak" if real attempts show it |
| Score trend | the last 2–3 stored attempt scores | a trend is only computed from stored scores |
| Accessibility mode | the stored per-student profile | drives which actions are offered |
| Evidence timestamp | `_resolve_timestamp` over the real transcript/visual timeline | an action is only anchored to a moment that really exists |

## 3. Action types (whitelist)

Every recommended action is one of a fixed, closed set, each with a real target
(lecture + concept + evidence timestamp when knowable) and an honest `grounded_on`
field explaining what real data backs it:

`REVIEW_VIDEO` · `LISTEN_TO_AUDIO_DESCRIPTION` · `READ_TRANSCRIPT` ·
`REVIEW_VISUAL` · `EXPLAIN_CONCEPT` · `RETAKE_QUIZ` · `PRACTICE_CONCEPT`

The action set is **accessibility-aware**: e.g. a low-vision learner is steered to
audio/transcript-first actions rather than assuming they can rely on screen content.

## 4. The honest "not enough history" path

If a student has insufficient stored attempts, the agent returns
**"Not enough learning history yet"** with no fabricated Next Best Action and no
invented timestamp. It would rather tell the truth than guess.

## 5. Grounded example (DEMO_python_loops)

### A student with real history (`student_id = default`)
`GET /students/default/next-action` → **EXPLAIN_CONCEPT** on `general_programming`,
grounded at timestamp **00:00**, because that is a real quiz concept that the profile
history shows is weak and that the lecture never explains aloud (see the
Learning Gaps report). The `grounded_on` field names the exact real evidence.

### A brand-new student (no history)
`GET /students/<new-id>/next-action` → the honest insufficient-history message with
**no fabricated timestamp** (verified by unit test and API test).

## 6. Frontend

- `/agent` page renders the Next Best Action card, the agent's insights, the ranked
  recommended actions, and a **"Go to moment"** deep-link that jumps the video to the
  grounded evidence timestamp. A `?concept=&lecture=` variant shows the grounded
  explain-a-concept view with spoken + on-screen evidence.
- Dashboard (`app/page.tsx`) shows a **Next Best Action** banner for the active
  student, linking into `/agent`.

## 7. Evidence & verification

- **Tests** (`tests/test_learning_gaps_agent.py`) assert the whitelist, the honest
  no-history path, and that actions reference only real concepts/moments.
- **Browser E2E** (headless Chrome): `/agent` renders the next action, insights, a
  grounded "Go to moment", and `?concept=` shows the grounded explanation;
  **0 console errors**. Regression E2E (`final_e2e.cjs`, `ad_e2e3.cjs`) both pass.

## 8. Limitations

1. "Mastery" is a real quiz-score heuristic (≥70%), not a model of understanding.
   It is a transparent, data-honest proxy.
2. Recommendations are deterministic rules, not an LLM — cheap, explainable, and
   grounded in the same real data as the rest of the system.
