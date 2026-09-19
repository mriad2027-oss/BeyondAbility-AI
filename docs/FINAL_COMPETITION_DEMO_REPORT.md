# EduAccess AI — Final Competition / Demo Report

**Version:** 2.2.x (final polish pass) · **Date:** 2026-08-31
**Verified against:** live backend `http://127.0.0.1:8000` + frontend `http://localhost:3000`
(headless Chrome), 193 pytest passing, `npm run build` (Next.js 15.5.24) success.

This report is evidence-first: every claim below was executed and observed on this
machine. Nothing is aspirational and nothing is fabricated.

---

## A. What the system does (30-second pitch)

EduAccess AI turns one educational video into a complete **accessible learning
experience** — transcripts + SRT/VTT captions (deaf / hard-of-hearing), a per-event
**Visual Companion** (what is on screen, grounded in real OCR), **audio descriptions**
(synchronised to narrated moments only), a **grounded Ask-the-Video** Q&A, a
**What-am-I-Missing?** profiler (blind / low-vision / deaf / cognitive), a visual
**timeline** with jump-to-moment, **adaptive quizzes** and a **learning-progress
dashboard** — all under one honest **trust / no-fabrication layer**.

---

## B. Evidence-first, never fabricated (the core differentiator)

Every score, answer and "missing" flag is computed **only from real pipeline evidence**:

| Layer | How the truth is enforced |
|---|---|
| Visual Companion | `visual_claims` each carry `evidence` + `confidence`; unreadable content goes into `limitations`, never asserted as fact |
| Trust levels | `VERIFIED` / `UNCERTAIN` / `UNAVAILABLE` — unreadable content is never presented as fact |
| Accessibility score | `components` map (speech_access, captions, ocr_availability, visual_event_coverage, evidence_trust, audio_description, missing_information) + `basis` = "Calculated only from real pipeline evidence, never from a fake processing percentage" |
| Audio description | cues are emitted **only** for moments that have a real narration asset; a webcam-only lecture honestly yields none |
| Ask-the-Video | answer rejected below evidence threshold; returns "Unavailable" for unverifiable questions rather than inventing |

**Live numbers verified this pass:**
- DEMO `DEMO_python_loops` accessibility-score = **100 / HIGH / VERIFIED** (7/7 visual events verified).
- Real lecture `2924ba8f8909` = **63 / MEDIUM / VERIFIED** — an honest result, not a fake 100%.
- Real lecture visual understanding: 26 records, **25 UNAVAILABLE** (webcam video has little readable on-screen text) — reported honestly.

---

## C. UX/UI diffs completed in this final pass (each live-verified)

1. **Accessibility Report page** now shows the real component model (score ring + level + trust,
   per-component percentage bar / evidence value / weight, backend explanation, and an error state).
2. **Ask-the-Video "Jump to moment" works.** The old control was a broken stub
   (`href` to a non-existent `?tab=jump` route + `preventDefault`). It now links to
   `/lectures/<jobId>?t=<s>` and the workspace auto-seeks the video (verified `?t=15 -> currentTime 15`).
3. **Distinct answer statuses** — PARTIALLY_SUPPORTED / NOT_FOUND / UNCERTAIN / UNAVAILABLE each
   render with a distinct icon + label, plus evidence `source_type` and timestamp.
4. **What-am-I-Missing** surfaces importance (HIGH/MEDIUM/LOW), coverage ratio, visual type,
   "X% covered by speech", confidence, source and a "Watch this moment" deep-link.
5. **Dashboard** adds an "Open Demo Lecture" CTA and an "Evidence-first, never fabricated" banner.
6. **Robustness fixes:** an unbounded loader bug on the report page (skeleton stuck forever) was
   found and fixed; `legible` typo corrected; unique SVG gradient id; upload-page object-URL leak +
   poll-not-stopped-on-unmount fixed; progress chart given an aria-label.

---

## D. Running it (three commands)

```bash
# 1. Backend (FastAPI, offline-first)
cd backend && uvicorn main:app --reload --port 8000
# 2. Frontend (Next.js)
cd frontend/next-app && npm run dev   # http://localhost:3000
# 3. Tests
python -m pytest -q                   # 193 passed
```

Demo lecture: `python backend/scripts/make_demo_lecture.py` (regenerable synthetic-but-real content).

---

## E. What was verified this pass (evidence)

| Check | Result |
|---|---|
| `python -m pytest -q` | 193 passed (4.5s) |
| `python -m compileall backend` | OK |
| `npm run build` | Success, 14 routes |
| Report breakdown (DEMO) | 100 / HIGH / VERIFIED + all 7 components + explanation |
| Ask "What is a for loop?" | VERIFIED, 2 evidence records, jump link navigates to `?t=0` |
| Missing (DEMO) | "19% covered by speech", importance, visual type, confidence |
| Workspace deep-link `?t=15` | video auto-seeks to 15s |
| Dashboard banner + Demo CTA | render |
| Console errors across all pages | 0 |

---

## F. Known honest limitations

- Visual `confidence` is a stable, explainable heuristic, not a calibrated probability.
- Rich scene description and narration quality improve with an `OPENAI_API_KEY` /
  `ANTHROPIC_API_KEY` in `.env` (offline fallback is OCR-only).
- The real webcam lecture is honestly 63/100 — the system does not inflate it.
- Offline pixel-level chart geometry is not analysed; charts are classified from readable text.

---

## G. Why it wins

- **Trusted, not gimmicky:** demonstrates a principled answer on an uncooperative, noisy real
  video (honest 63/100, 25/26 UNAVAILABLE) instead of cherry-picking a perfect demo.
- **End-to-end working:** one upload produces captions, visual understanding, audio description,
  grounded Q&A, quizzes and progress — all rendered in a polished, RTL-aware UI.
- **Offline-first + optional LLM upgrade:** works fully offline, gets better with a key.
- **Tested honestly:** 193 tests + live browser E2E with zero console errors.
