# Learning Gap Detection — Evidence Report (v2.3.0)

Audit date 2026-08-31 (UTC). Part of the **Intelligent Multimodal Learning Engine**
upgrade. Every gap reported here is derived strictly from real evidence — the
knowledge graph's honest per-concept status, and the student's real stored quiz
attempts — never from assumptions about what the lecturer "should" have taught.

## 1. What it is

`backend/services/learning_gaps.py` exposes two levels of gap analysis:

### 1a. Lecture-level gaps — `GET /lectures/{job_id}/learning-gaps`
Learned from the knowledge graph (shared primitives with concept mapping, so they
cannot disagree). A gap is a concept whose coverage falls short in some modality:

| Gap kind | Meaning |
|---|---|
| `assessed_but_not_explained` (critical) | a real quiz concept with **no** spoken speech and **no** readable visual evidence for its exact label |
| `visual_only` | shown on screen but with no spoken speech matching that label (a viewer who can't see may miss it) |
| `spoken_only` | spoken but with no verified on-screen material (a viewer who can't hear may miss it) |
| `unverified_visual` | has a visual event whose text could not be OCR-verified (honestly reported) |

### 1b. Student-level gaps — `GET /lectures/{job_id}/students/{sid}/learning-gaps`
Computed from the student's **real graded quiz attempts** (`_topic_stats`):
concepts where the student scored below the mastery threshold, each resolved back
to a real evidence timestamp (`_resolve_timestamp`) so the gap links to a real
moment in the lecture you can jump to.

## 2. Explain-missing-concept — `GET /lectures/{job_id}/concepts/{concept}/explain`

Gathers only real evidence for the requested concept and returns an honest verdict:

- `covered` — spoken and/or verified visual evidence exists;
- `partial` — some evidence exists but a modality is missing;
- `not_covered` — no real evidence found (does **not** invent any).

It also returns the **closest covered concepts** the lecturer DID explain, so a
learner has a real, evidence-grounded place to look instead of a fabricated answer.

## 3. Grounded example (DEMO_python_loops)

### Lecture gaps — verified this session
`GET /lectures/DEMO_python_loops/learning-gaps` → **5 gaps**:

- **2 critical** (`assessed_but_not_explained`): `general_programming` and
  `loops_indexing` — quiz concept labels that are never stated verbatim in speech
  or OCR. Honest: the lecture covers the general topic, but its exact labels are
  not spoken aloud.
- **3** `visual_only`: `output`, `print`, `syntax` — shown on screen, but not the
  exact spoken labels.

### Explain a covered concept
`GET /lectures/DEMO_python_loops/concepts/while%20loop/explain` → `covered`
(5 spoken + 4 verified visual evidence records).

### Explain an uncovevered / nonsense concept
A nonsense concept returns `not_covered` / `UNKNOWN` with **no fabricated
evidence** — asserting the system's honesty boundary.

## 4. Evidence & verification

- **Tests** (`tests/test_learning_gaps_agent.py`, 6) assert the gap kinds, the
  honest `not_covered` path, and that a nonsense concept never fabricates evidence.
- **Browser E2E** (headless Chrome): `/learning-gaps` renders the lecture gaps, the
  critical assessed-but-not-explained gap, and a **review-at** link that deep-links
  to a real timestamp. **0 console errors.**

## 5. It never fabricates

The report trumpets honesty: a concept is only ever reported missing when there is
no real evidence for its exact label. When the lecture genuinely covers a topic
under a different label, that is surfaced as "assessed but not explained for this
exact label" — never as a silent claim that nothing was taught.
