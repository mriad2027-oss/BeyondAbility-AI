# P5 — Evidence-grounded Visual Understanding (v2.2.0)

**Session:** 2026-08-30 (UTC) · **Test suite:** 155 → 182 passed · **Additive only**:
no endpoint contract changed, no response key removed, zero pre-existing tests edited.

## 1. What changed conceptually

The visual subsystem was upgraded from plain OCR + scene detection into an
**evidence-based structured understanding of what happens on screen**, written
for a blind / low-vision learner. Every meaningful visual event now yields a
single record that answers:

- **WHAT** is on screen — `visual_type` + `objects` + a scene summary
- **WHAT text is readable** — verbatim `ocr_text` (only what Tesseract read)
- **WHAT changed** — source frames / scene summary
- **CLAIMS** — 2–4 grounded claims, each with its own `evidence` + `confidence`
- **COMPLEMENT LEVEL** — how the screen adds to what the teacher says
- **TRUST** — `VERIFIED` / `UNCERTAIN` / `UNAVAILABLE`, from evidence only
- **ACCESSIBILITY** — short + standard description layers
- **LIMITATIONS** — an explicit, honest list of what could *not* be verified

The module is **deterministic and offline-safe** (`backend/services/visual_understanding.py`);
rich scene description still improves when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
is present, but nothing in this feature requires one.

## 2. No-fabrication guarantees (enforced, not aspirational)

1. **Only OCR-detected characters are quoted as text.** A claim is never stronger
   than its evidence.
2. **`visual_type` is classified from OCR + layout signals, never guessed** just
   because punctuation/numbers exist. `flowchart` is deliberately *not* a chart;
   prose that merely contains the word "output" cannot become a UI pattern;
   `run` is matched as a whole word so "the loop runs" never becomes an interface.
3. **Empty OCR ⇒ no textual claims.** With nothing readable the record says so
   (`confidence: 0.0`, "No readable on-screen text was detected") and never
   invents colors, counts, labels or code.
4. **Trust comes from `evidence.trust_for_event`.** An LLM/description alone can
   never make something `VERIFIED`; readable OCR + confident detection does.
5. **If content cannot be verified we return an honest `UNAVAILABLE`/limitation
   instead of a plausible guess.** The real webcam lecture's 25/26 UNAVAILABLE
   records are the system being honest, not failing.

## 3. Record schema (`/lectures/{job_id}/visual-understanding`

Each record:

```json
{
  "event_id":              "ev-0001..., keyed to the visual events/analysis so everything merges",
  "start": 26.94, "end": 31.5,
  "source_frames":         [".../frames/ev-0001_000026.jpg"],
  "visual_type":           "code | slide | diagram | chart | table | ui | document | whiteboard | image | scene | animation | other",
  "scene_summary":         "short ground-truth scene note (empty when nothing readable)",
  "objects":               ["code block"] | ["slide"] | ["chart"] | [] ,
  "text":                  ["up to 8 verbatim OCR lines"],
  "layout":                "honest layout sentence, only when supportable",
  "actions":               ["Program output is visible on screen."] ,
  "relationships":         ["honest relationship caveat for diagram/chart"],
  "ocr_text":              "verbatim OCR text (empty when unreadable)",
  "visual_claims": [
     {"claim": "A code example is visible showing: 'count = count + 1 ...'",
      "evidence": "OCR detected the visible code.",
      "confidence": 0.91}                                      // high ≥.85 / medium ≥.6 / low
  ],
  "speech_context":        "overlapping transcript text, verbatim",
  "complement_level":      "REDUNDANT | PARTIALLY_MISSING | COMPLEMENTARY | VISUALLY_ONLY | AUDIO_ONLY | UNAVAILABLE",
  "complement_reason":     "reuses visual-companion content-word coverage",
  "trust":                 {"trust": "VERIFIED|UNCERTAIN|UNAVAILABLE", "confidence": ..., "sources": [...]},
  "description":           "original event description",
  "accessibility_description": {
      "short":    "A code example is visible on screen.",
      "standard": "At 27s, code content is shown. Near the top of the visible text: \"count = 0 ...\" ..."
  },
  "limitations":           ["honest caveats — never a plausible guess"]
}
```

## 4. Visual type classification (evidence rules)

Ordered, short-circuits:

| Rule | Yields |
|---|---|
| OCR empty AND description is OCR-only | `scene` (unreadable, honest) |
| `\b(chart|graph)\b` as a whole word (so "flowchart" is not a chart) | `chart` |
| digits present AND "how many" headline | `chart` |
| ≥2 distinct code markers OR one strong structural signal (`print(`, `def `, `for i in`, `while `) | `code` |
| flowchart/diagram words + confirming structure | `diagram` |
| "table" or column+row | `table` |
| editor/button/console/interface/click/output: whole-word `run` | `ui` |
| whiteboard | `whiteboard` |
| document/pdf | `document` |
| ≥1 slide marker (slide/lesson/objectives/today/welcome/summary/introduction/overview) | `slide` |
| canonical detected type that is meaningful | that type |
| readable text otherwise | `document` |
| nothing readable | `scene` |

Legacy aliases: `interface → ui`, `formula → document`, `person/demonstration → scene`.

## 5. Complement levels

`UNAVAILABLE` (trust unverifiable) → `AUDIO_ONLY` (speech, no readable screen) →
`VISUALLY_ONLY` (screen, no speech) → `REDUNDANT` (speech already covers it) →
`PARTIALLY_MISSING` (concept spoken, visual adds material detail) →
`COMPLEMENTARY` (screen adds detail not spoken). Reuses
`visual_companion.speech_visual_coverage` so it always agrees with the
"What am I missing?" classifier.

## 6. Integration points

| Layer | Where it is used |
|---|---|
| Pipeline | Stage `visual_understanding` (after `visual_event_analysis`); persists `{stem}_visual_understanding.json`; cache honored; shown in `/pipeline-status` (12 canonical stages) |
| API | `GET /lectures/{job}/visual-understanding`; `/visual-events` → `understanding` array; `/timeline` visual items → `visual_type` + `complement_level` (titles "Visual: Slide" etc.); `/missing?mode=` items → `complement_level` + `visual_type`; `/ask` merges understanding into events (`_merge_understanding`) and labels visual answers by type |
| Analytics | `VISUAL UNDERSTANDING` canonical stage with records count; pre-feature jobs recomputed on the fly with an honest "Recomputed on the fly from stored visual events." note |
| Frontend | `lib/api.ts` `getVisualUnderstanding`; Visual Companion rewritten as an evidence inspector: verification/type/complement badges, verbatim OCR, expandable "Grounded claims", detail row with speech context, amber "honest limitations" box, "Watch this moment" jump |
| Backward compatibility | Old jobs without understanding get it **on demand** (deterministic rebuild from stored visual events) or an honest `UNAVAILABLE` if derivable evidence is missing |

## 7. Verified numbers (live, this session)

| Measure | DEMO `DEMO_python_loops` | Real `2924ba8f8909` |
|---|---|---|
| Records | 7: slide/code/code/slide/code/chart/slide | 26: 25 UNAVAILABLE + 1 slide VERIFIED (garbled OCR, honestly labelled) |
| Trust | 7/7 VERIFIED | 1/26 VERIFIED |
| `/pipeline-status` | `VISUAL UNDERSTANDING [completed]`, cached, honest recompute note | same |
| Frontend | headless Chrome: badges/claims/OCR/limitations/watch-moment render, 0 console errors | honest UNAVAILABLE state, 0 console errors |

`python -m pytest -q` → **182 passed in 3.22 s**. `npm run build` (Next.js 15) succeeded.

## 8. Files changed / added

- `backend/services/visual_understanding.py` — new core module (evidence, types, claims, complement, accessibility, limitations, builder).
- `backend/services/pipeline.py` — new persistent stage.
- `backend/services/lecture_data.py` — `load_visual_understanding` disk fallback.
- `backend/services/ask.py` — `_merge_understanding`, type-labelled visual answers, enriched evidence.
- `backend/routes/process.py` — `/visual-understanding` route, `/visual-events` understanding, `/timeline` + `/missing` enrichment.
- `backend/routes/analytics.py` — canonical stage + recompute note.
- `frontend/next-app/lib/api.ts`, `types/backend.ts`, `app/lectures/[jobId]/page.tsx` — client + Visual Companion evidence inspector.
- `tests/test_visual_understanding.py` — 27 tests (classification + adversarial no-fabrication + complement + accessibility + schema + API routes + backward compat).
- `README.md`, `docs/FINAL_SYSTEM_AUDIT.md`, this report.
- Generated artifact: `data/outputs/DEMO_python_loops_visual_understanding.json`.

## 9. Honest limitations

1. Type/claims are **evidence-bound by design**; whatever OCR cannot literally
   support is listed in `limitations`, never hallucinated.
2. Confidence is **heuristic, not calibrated** (`high` ≥0.85 / `medium` ≥0.6 /
   `low`), stable and explainable, not a probability.
3. Offline, a webcam-style video legitimately yields mostly UNAVAILABLE records;
   the UI says so instead of pretending.
4. Chart geometry is not analysed; "how many" + digits / chart word classification
   is about readable labels.
5. For pre-feature jobs the record is recomputed on the fly from stored visual
   events (deterministic, no pipeline re-run) and persisted on first request.