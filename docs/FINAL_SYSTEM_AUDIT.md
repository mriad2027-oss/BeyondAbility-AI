# EduAccess AI — Final System Audit

Version 2.0.0 baseline (audit 2026-08-29) + **v2.1.0 Visual Companion & Evidence
(audit 2026-08-30)** — see the appended section below. This is an **honest** record:
what was verified, how it was verified (with evidence), and where the system is known
to be limited or approximate. No claim below is aspirational; everything listed has
been executed on this machine.

---

## 1. Feature conformance

### Accessibility (Student-facing)
| # | Feature | Status | How verified |
|---|---|---|---|
| 1 | Transcripts for deaf / hard-of-hearing students | ✅ delivered | Real lecture `2924ba8f8909`: 97 timestamped segments; SRT/VTT generated |
| 2 | Adaptive quizzes with AI feedback on weak areas | ✅ delivered | Real quiz graded; per-concept weak topics surfaced; difficulty adapts |
| 3 | AI-generated accessibility narration text | ✅ delivered for content that exists | Pipeline emits honest narration; for a webcam-only lecture it correctly yielded **none** (no readable on-screen text) rather than fabricating |
| 4 | Per-student accessibility profiles | ✅ delivered | Profiles `001/002/003` (blind, low-vision, hearing); profile-aware assets |
| 5 | "What am I missing?" visual-not-covered-by-speech | ✅ delivered | `/missing` returns grounded items with source event + confidence |
| 6 | Audio descriptions at event level + full track | ✅ delivered for describable content | Per-event audio + narration audio built when narration exists; `narration:false` asset when honestly none |
| 7 | What-Am-I-Missing / Ask targeted at *) user need | ✅ delivered | Modes `aim` (visual need) and `ask` (hearing need) select distinct answers for whichever need the student entered |

### Transparency & non-fabrication
| Feature | Status |
|---|---|
| Pipeline stage ledger (`completed`/`cached`/`partial`/`failed`, durations, fallback reason) | ✅ delivered, shown in the dashboard |
| Failures returned honestly (no re-raise to a silent purgatory, no fake success); stale `error` cleared on later success | ✅ delivered |
| Ask-the-Video grounded (retrieves transcript/visual events; answer rejected when below evidence threshold) | ✅ delivered |
| Lecture catalogue exposes per-job asset flags + `stage_status` so the UI never claims artifacts that don't exist | ✅ delivered |

### Structure & reuse
| Feature | Status |
|---|---|
| Lecture abstraction reused across player / transcript / ask / missing / timeline / quiz | ✅ delivered |
| Timeline unifies speech + visual events + quiz checkpoints | ✅ delivered (125 entries on real lecture) |
| Quiz flow: auto-listing per lecture, grading, persistence, adaptive next-difficulty, learner progress | ✅ delivered |
| Heavy stages cached (audio, transcript, frames, visual events) across runs | ✅ delivered |
| 8 third-party LLM calls on the critical path (split to independent, parallel); offline-first | ✅ verified (offline mode used in E2E run) |
| Frontend AppTest harness — 0 exceptions in default and demo mode against a live backend | ✅ verified |

---

## 2. Verified evidence (executed this session)

### Test suite — deterministic, self-cleaning
```
python -m pytest -q
→ 62 passed in ~3.2s
```
Coverage: API endpoints (upload/process/result/lectures/system), student profiles &
mode canonicalization (`hearing→deaf`, `standard→default`), timeline ordering,
ask grounding + honest rejection, quiz grading + adaptive difficulty + history
persistence, accessibility per-mode, and an end-to-end demo-mode run. Tests create
only synthetic jobs and clean up every artifact.

### Real end-to-end lecture (regenerated from scratch this session)
`run_pipeline` on `2924ba8f8909` (WhatsApp webcam lecture, profiles-as-blind student,
total elapsed ~158 s):

| Stage | Status | Duration | Notes |
|---|---|---|---|
| extract_audio | cached | 0.5 s (reused) | FFmpeg |
| transcribe | completed | 99.81 s | Whisper `base` FP32 (CPU); SRT written |
| analyze_video | completed (ocr fallback) | 57.81 s | OpenCV scene sampling + Tesseract, no API key |
| accessibility | completed | 0.03 s | profile-aware minimax representation |
| quiz | completed | 0.02 s | adaptive quiz generated |

Result: 97 transcript segments, 26 visual events, 97 accessibility events, timeline
of 125 entries, generated quiz `2924ba8f8909_quiz`, assets:
`transcription:true`, `visual_events:true`, `accessibility:true`, `quiz:true`,
`narration:false` (honest — the lecture's visual events were all OCR
"No readable on-screen text", so no narration track was fabricated).

### Correctness spot-checks (real lecture)
- Timeline `/timeline` → 125 entries (speech/visual/quiz types), monotonic timestamps.
- Ask-the-Video, grounded Arabic probe: word `المرمغة` (programming) → answer
  returned **True** with evidence timestamp 84.4 s.
- Ask-the-Video honest rejection: unrelated/off-lecture question → refused with
  "I couldn't find enough information in this lecture".
- Quiz submission (student 001): short-answer semantically graded (Jaccard overlap on
  normalized Arabic stopwords-adjusted tokens) + true/false graded → score 100%,
  difficulty `hard → hard`, history persisted: attempts 2, completed 7, average 57.1%,
  strong topics `['variables','general_programming','loops_indexing']`, weak `[]`.
- Upload validation: filename extension + **file magic bytes** (not content-type);
  Windows OneDrive-deferral workaround (per-chunk `flush`/`fsync`) — uploads read back
  non-empty.

### Frontend
- `streamlit.testing.v1.AppTest.from_file('frontend/app.py')` against the live
  backend: **0 exceptions, 0 errors** in default run and in demo mode
  (`session_state.job_id = 2924ba8f8909`).
- 11 screens all render without crashing (Welcome & Profile, Upload, Processing
  Dashboard, Player, Ask the Video, What Am I Missing?, Visual Timeline, Transcript &
  Captions, Audio Description, Quiz & Results, Learning Progress).

---

## 3. Honest limitations (known & accepted)

1. **Offline vision = OCR-only.** Without an OpenAI/Anthropic key, describing a
   webcam photo produces "No readable on-screen text" — true, but not rich. Diagrams
   / scenery / people are not narratable offline. The system reports this honestly
   rather than inventing content.
2. **Consequently, narration audio is optional, not guaranteed.** It exists only when
   meaningful on-screen text was detected. `narration:false` in the catalogue and an
   empty "Audio Description" view for such lectures is correct behavior, not a bug.
3. **Whisper `base` on CPU** transcribes ~2 min of audio in ~100 s. Accuracy for
   noisy low-res webcam audio is approximate; `tiny` is even faster but worse,
   `small/large` better but slower.
4. **Ask-the-Video is closed-domain.** It can only answer from this lecture's
   transcript + visual events; out-of-scope questions are refused by design.
5. **Short-answer grading is lexical** (stopword-adjusted normalized token overlap)
   unless an LLM key is present. It handled the real Arabic short-answer question
   correctly, but it is not human-level.
6. **Storage is JSON-file based** — fine for this scope, not a multi-user RDBMS.
7. **Session state is faked per student selection** (demo-mode learner), not real
   authentication.

---

## 4. What was changed/fixed in this final pass (v2.0.0)

- `backend/routes/upload.py` — magic-byte validation + OneDrive/`fsync` write fix.
- `backend/services/pipeline.py` — failures return structured `failed` results
  (no re-raise); success path clears stale `error`.
- `backend/routes/student.py` — canonical accessibility mode persisted.
- `backend/observability.py` — `cached` stages logged `ok=True`.
- `frontend/app.py` — full 11-screen rewrite + demo mode + AppTest-clean.
- `tests/_fixtures.py`, `tests/__init__.py` (fixes package shadowing), plus the new
  62-test suite.
- Data hygiene: purged 3 leaked fake jobs, 16 orphan videos, orphan profile/history
  entries from earlier test iterations. Data dir now contains only real artifacts.

---

# Version 2.1.0 — Visual Companion & Evidence (audit continued)

Audit date 2026-08-30 (UTC). Backward-compatible upgrade: every pre-existing endpoint and
response key is unchanged; the upgrade adds fields/endpoints only.

## 1. New features shipped (all executed & verified this session)

| Feature | Implementation | How verified |
|---|---|---|
| Grounded Visual Companion | `backend/services/visual_companion.py` + `visual_event_analysis` pipeline stage; per-event analysis record (lecture_id, event_id, start/end/duration, type, description, OCR text, readable, previous/next event, overlapping transcript + segment ids, source frames, complement score, importance, source, trust) | REAL lecture `2924ba8f8909` + DEMO lecture: 26 / 7 analysis records with all fields |
| Complement score | `compute_complement_score`: categorical `low|medium|high` + written reason (repeated events, unreadable OCR, speech-coverage thresholds) | Unit tests + demo: `high` for readable code/slides; `low` for repeated/unreadable |
| "What am I missing?" upgrade | `build_missing_items` — profile-aware (blind/low_vision/deaf/hard_of_hearing/cognitive_support), timestamps + complement + trust + source event; UNAVAILABLE/low-complement gated out | Endpoint tests; real lecture yields exactly the 1 verified item (everything else honesty-gated) |
| Ask-the-Video evidence | `_evidence_for_refs` maps `source_refs` → per-record evidence with trust; worst-trust composite via `verify_claim`; stop-word-safe keyword fallback (`content_words`) so non-answerable questions are refused | API tests (`evidence_records >= 1`, `trust VERIFIED`; stopword-only question → `UNAVAILABLE`) |
| Evidence / no-fabrication layer | `backend/services/evidence.py` — `trust_for_event` (markers, `confidence < 0.55` → UNCERTAIN, hedge phrases), `verify_claim` worst-case, `extract_ocr_text` (reads only real text, `readable=false` when none), `build_evidence`, `trust_badge` | 10 unit tests + real-lecture honesty spot-check |
| Visual timeline upgrade | `/timeline` visual entries enriched: `duration/importance/source/trust/visual_complement_score/ocr_text` | Demo: 23 timeline entries (13 speech, 7 visual, 3 quiz); fields present |
| Frontend Visual Companion | Player "at a glance" metrics; Timeline **VISUAL COMPANION** block with OCR text + jump-to-moment inline player (`#t=` seek); missing-profile selector; Ask evidence panel with trust badges; DEMO labelling + guided 10-step tour | `AppTest`: 0 exceptions through demo-select, Ask flow, deaf-profile switch, and jump-player |
| Demo mode | `backend/scripts/make_demo_lecture.py` — regenerable synthetic-but-real lecture (rendered pixel frames + real TTS narration) exposed as `data/videos/DEMO_python_loops.mp4` | Generated, processed, API-smoked (60.72 s video, 7 visual events, full endpoint suite) |
| Reusable loaders | `backend/services/lecture_data.py` — disk-backed `load_segments` / `load_visual_events` shared by routes + ask (works for pre-upgrade lectures) | Backward-compat test + real pre-upgrade lecture |

## 2. Verified evidence (executed this session)

### Test suite
```
python -m pytest -q   →  97 passed in ~5.5 s   (was 62; +35 new)
```
New coverage: evidence trust classification, VERIFIED/UNCERTAIN/UNAVAILABLE
paths, worst-trust aggregation, OCR-text extraction, complement-score levels
(high/repeated-low/unreadable-low), profile-aware missing items & gating,
`/missing` + `/evidence` endpoint contracts, backward-compatible accessibility
fallback, ask evidence blocks, stop-word-safe question refusal.

### Real end-to-end numbers
- Re-run pipeline on the real lecture `2924ba8f8909` (all heavy stages cached):
  **0.8 s, status done**, 97 segments, 26 visual events → **26 grounded analysis
  records** written to `*_visual_analysis.json`.
- Trust on the real lecture: **25/26 events UNAVAILABLE** ("OCR-only output: No
  readable on-screen text"), **1 VERIFIED** (readable text at 140.28 s in
  event_008), complement scores match (25 low / 1 high). This is the honesty
  guarantee: a webcam lecture with no readable screen content is reported as
  such, and `/missing` yields exactly **1** item.
- DEMO lecture (`DEMO_python_loops`, 60.72 s): Whisper 13 segments / 731 chars,
  7 visual events, 7 analysis records (all readable, all complement `high`, all
  VERIFIED), 13 accessibility events, generated quiz + narration.
- Endpoint suite (TestClient against real jobs):
  - `/missing?mode=blind|deaf` → 7 items (DEMO) with trust/complement/source;
    real lecture → 1 item.
  - `/visual-events` → 7 events + 7 analysis (DEMO); 26 + 26 (real).
  - `/evidence` → 7 records overall `VERIFIED` (DEMO); 26 records overall
    `UNAVAILABLE` (real — worst-trust, correct).
  - `/ask` grounded probe → `VERIFIED`, evidence 2 records, transcript + visual
    refs; stop-word-only / off-lecture probe → `UNAVAILABLE`, 0 records,
    "I couldn't find enough information in this lecture…".
  - `/timeline` → 23 entries (13 speech / 7 visual / 3 quiz), visual entries
    carrying duration/importance/trust/complement/OCR text.

### Frontend (AppTest, live backend)
```
streamlit.testing.v1.AppTest.from_file('frontend/app.py')
```
Initial render: 0 exceptions; DEMO lecture visible + selectable; after select,
0 exceptions; Ask flow (typed question → evidence panel): 0 exceptions;
missing-profile switch to `deaf`: 0 exceptions; Visual-Companion jump button:
0 exceptions.

## 3. Changes made for v2.1.0

- Added `backend/services/visual_companion.py`, `backend/services/evidence.py`,
  `backend/services/lecture_data.py`, `backend/scripts/make_demo_lecture.py`.
- Extended `backend/services/vision.py` (OCR text/language/structure enrichment —
  purely additive), `backend/services/pipeline.py` (`visual_event_analysis`
  stage + `{stem}_visual_analysis.json` cache), `backend/services/ask.py`
  (evidence blocks + content-word matching).
- Extended `backend/routes/process.py` (`/missing` profile-aware rewrite,
  `/visual-events` analysis, new `/evidence`, enriched `/timeline`, `/ask`
  empty-question guard; disk-backed loaders).
- Frontend `frontend/app.py`: DEMO labelling, guided tour, Visual Companion
  blocks (player + timeline), jump-to-moment player, evidence/trust rendering,
  profile selector for missing items.
- Fixed real defect found by tests: `verify_claim` crashed on evidence records
  without `source_type` (now str()-safe).

## 4. Honest limitations (v2.1.0, on top of v2.0.0 list)

1. **Visual Companion offline = OCR-only.** Diagrams/scenery get `UNAVAILABLE`
   or type `scene` with no narrated content; the DEMO lecture exists precisely
   to show the companion at its best *honest* level on real glyphs.
2. **DEMO lecture is synthetic-but-real**, not a human recording: it has plain,
   high-contrast screen content, so OCR reads it cleanly. Numbers above (7
   events, all `high`) are realistic for such slides, not for every lecture.
3. **Complement score is heuristic**, not a trained model: token-coverage on
   stop-word-filtered words + type policy + repeat detection. It is transparent
   (reason string) and categorical on purpose.
4. **Scene-change sampling merges visually similar slides** (e.g. two white
   slides differing only in text) into a single event when the 64×64 pixel diff
   is below `SCENE_CHANGE_THRESHOLD`; the demo generator widens inter-scene
   contrast so this is rare on readable demo/slide decks.
5. **Ask-the-Video trust is evidence-grounded, not answer-adequacy-grounded**:
   `VERIFIED` means "every cited source exists in the lecture"; a question whose
   keywords happen to appear may still be off-topic, though stop-word
   filtering + the refusal path now reject noise-only questions.

---

# Feature P2 — "What am I missing?" competition upgrade (audit continued)

Audit date 2026-08-30 (UTC). Strictly additive on top of v2.1.0: no schema was
removed or renamed, no endpoint behaviour regressed (`python -m pytest -q` went
**97 → 109 passed**, zero existing test changes required).

## 1. What was added

| Piece | Implementation | Verified |
|---|---|---|
| Audio-vs-visual **status classification** | `visual_companion.classify_status` — `REDUNDANT` (speech covers it) / `PARTIALLY_MISSING` (concept spoken, concrete visual adds info) / `MISSING` (silent, visual carries info) / `UNAVAILABLE` (evidence cannot be verified → never fabricated). Shared `speech_visual_coverage` (stop-word-filtered content-word overlap) is the single coverage source for both complement scoring and classification | unit + endpoint tests |
| **Importance ranking** | `importance_rank_for` — `HIGH` (code/diagram/chart/table/formula/interface) / `MEDIUM` (slide/whiteboard/demonstration) / `LOW` (other); honestly capped: low-confidence/UNCERTAIN evidence never stays HIGH, unreadable never HIGH | unit tests |
| **Deduplication** | Consecutive same-type events in one ~15 s region merge into a single moment (`event_ids`, `timestamp_end` = max); demo 7 slide/code events → 5 moments | demo verification |
| **Persistent stage** | New pipeline stage `missing_information_analysis` → `{stem}_missing_analysis.json` cache; `/missing` recomputes on the fly for pre-feature lectures | real + demo runs |
| **Additive item schema** | Per item: `status`, `importance_rank`, `id` (`{lecture_id}.missing.{kind}.NN`), `lecture_id`, `ts` (ISO 8601 time `HH:MM:SS.mmm`), `event_id`/`event_ids`, `category`, `coverage_ratio`, `top_words`, `evidence` (OCR/vision records) + `evidence_kinds`, `project`/`module`. Legacy keys (`timestamp`, `timestamp_start/end`, `what_you_hear`, `missing_information`, `what_you_might_miss`, `why_it_matters`, `source_event`, `source_type`, `confidence`, `confidence_level`, `trust`, `visual_complement_score`, `importance`) untouched | existing tests pass unchanged |
| **Endpoint summary honesty** | `/missing` `summary` is now a dict: `text` (includes explicit "…could not be verified…" empty state for unreadable lectures), `statuses` (per-event), `status_counts`, `actionable_count`, `overall_coverage_ratio`, `overall_evidence_trust` | real lecture + endpoint tests |
| **Frontend (existing screen, no new page)** | What Am I Missing? tab now renders the summary text + status counts + overall trust, per-item status badge, importance rank, overlap tokens, evidence kinds, item id, and an inline **jump-to-moment** player | `ast` compile + AppTest-style flow |

## 2. Verified results this session

### Test suite
```
python -m pytest -q  →  109 passed in ~2.7 s   (was 97)
```
New `tests/test_missing_classification.py` — 12 scenario groups: status
classification (redundant / partially-missing / missing / unavailable-gate),
profile adaptation (blind extended schema / deaf keeps educational / cognitive
keeps highest-value), dedup + importance ranking + determinism, endpoint summary
statuses, and the honest empty-state contract.

### Demo lecture `DEMO_python_loops`
- `/missing?mode=blind` → 5 deduped items from 7 events; every event
  `PARTIALLY_MISSING`, VERIFIED, coverage overlap tokens present (e.g. code item
  `covers=condition,times,while` vs spoken audio). Ranking: `HIGH` for code,
  `MEDIUM` for slides. Dedup merged the two back-to-back slide pages
  (event_001+002 → one moment 0–15.39 s, event_003+004 → one moment 15.39–26.94 s).

### Real webcam lecture `2924ba8f8909`
- `/missing` → **honest near-empty state**: `status_counts {UNAVAILABLE: 25,
  PARTIALLY_MISSING: 1}`, `actionable_count 1`, overall evidence trust
  `UNAVAILABLE` (26 records). The single item (event_008 @ 140.28 s, slide) is
  grounded in verbatim OCR text, VERIFIED, `importance_rank MEDIUM`. 25 events
  that OCR could not read are reported as UNAVAILABLE — never fabricated into
  items.

### Example record (real lecture, trimmed)
```
id       2924ba8f8909.missing.slide.01
ts       00:02:20.280   timestamp_start 140.28 → timestamp_end 142.31
status   PARTIALLY_MISSING      importance_rank MEDIUM
what_you_hear  "The teacher said: …"
what_you_might_miss "The screen also shows: …" (verbatim OCR)
trust    VERIFIED   complement high  coverage_ratio 0.0
evidence [{kind: ocr, text: …}]   evidence_kinds [ocr]
```

## 3. Files changed/added for P2
- `backend/services/visual_companion.py` — status model, `speech_visual_coverage`,
  `classify_status`, `importance_rank_for`, `describe_missing_content`,
  `why_it_matters_for`, `condense_speech`, `classify_missing_info`, rewritten
  `build_missing_items` (dedup + extended schema + stable ids).
- `backend/services/pipeline.py` — new `missing_information_analysis` stage +
  `{stem}_missing_analysis.json` cache.
- `backend/routes/process.py` — `/missing` additive summary dict + honest empty
  state (both visual and legacy-fallback branches).
- `frontend/app.py` — What Am I Missing? tab upgraded (status/importance/evidence/
  summary/jump-to-moment), no new page.
- `tests/test_missing_classification.py` — new (12 scenarios).
- `README.md`, `docs/FINAL_SYSTEM_AUDIT.md` — docs updated.

## 4. Honest limitations (P2)
1. **Coverage is lexical, not semantic.** `speech_visual_coverage` and the
   status classifier compare content words, so paraphrase ("create a variable" vs
   `x = 1`) counts as low coverage — the classifier is deliberately conservative
   towards `PARTIALLY_MISSING` for educational types rather than guessing.
2. **Dedup is temporal + type based** (~15 s windows), not perceptual: two
   genuinely distinct code screens < 15 s apart merge into one moment.
3. **OCR garbage gramming** (e.g. near-duplicate slide titles with tiny diffs)
   is still OCR-verbatim; the summary/status counts make the limits visible via
   `statuses` and per-item `coverage_ratio`.
4. **`ts` is a lecture-relative ISO 8601 time**, not a calendar timestamp.
5. The real webcam lecture's single `PARTIALLY_MISSING` item rests on OCR text
   that is only partially legible; it is labelled VERIFIED per evidence rules and
   shown with its exact OCR text so the learner can judge.

---

# Feature P3 — Evidence-grounded Ask: retrieve-first Q&A (audit continued)

Audit date 2026-08-30 (UTC). Strictly additive on top of P2: `/ask` keeps its
exact request shape (`AskRequest(job_id, question)`) and all pre-existing
response keys; the full suite went **109 → 130 passed** with zero changes to
existing tests.

## 1. Architecture: retrieve-first, answer-second

`backend/services/ask.py` was rewritten around a hard rule: the LLM **never sees
the whole lecture**. Retrieval caps at `MAX_RETRIEVED = 4` items (the 4 best
transcript segments / visual events by context score), and the LLM polish step
only ever receives those 4 items' verbatim snippets. Lowering retrieval:
`ask_video` → `retrieve_context(job_id, question)` → `score_context_item`
(deprecated-key-safe access to segment/event mentions, OCR text, transcript) →
ranked `EvidenceItem.reContext` list → classifier gate → deterministic
grounded answer assembly → optional LLM polish (retrieved context only, via
`vision.clean_json_response`, with a hallucination guard), covered by a
deterministic grounded fallback if polish refuses.

Answers carry **status** (`SUPPORTED` / `PARTIALLY_SUPPORTED` / `UNCERTAIN` /
`NOT_FOUND` / `UNAVAILABLE`), claim-level **trust** (`VERIFIED` / `UNCERTAIN` /
`UNAVAILABLE`) reused from `evidence.trust_for_event`, per-record evidence trust,
verified **timestamps**, **source_refs**, **conflict{flag,sources}** for
speech-vs-screen clashes, category, "Why this answer?" trail, and **jump**
(audio/video inline-seek target).

## 2. Behavior rules enforced (spec 1–35)

- **Never answer without lecture evidence**: no evidence → `NOT_FOUND`,
  "I couldn't find enough information…". Stopword-only / off-topic questions hit
  the same path (Arabic: "لم أجد دليلاً…").
- **Never fabricate**: property questions (colors, names, values, counts) with no
  anchor → "cannot verify the requested {property}" (`NOT_FOUND`, trust
  `UNAVAILABLE`, 0 evidence). No code/colors/numbers/timestamps are invented.
- **Evidence hierarchy**: visual > transcript > combined > UNCERTAIN > UNAVAILABLE.
- **Conflicts shown, not hidden**: e.g. speech `range(10)` vs screen `range(5)`
  → `UNCERTAIN` + `conflict{flag:true, sources:[transcript, visual]}`, both
  sources rendered (test 14).
- **Partial evidence is honest**: partial OCR → `SUPPORTED` "Part of the code
  appeared on screen…", not a reconstruction.
- **LLM guard**: citations are whitelisted against actual segment/event ids —
  `seg_999`/`event_999` hallucinated ids are dropped rather than trusted.
- **Observability**: `ask_retrieval` stage (retrieved items) then `ask_grounding`
  stage (chosen status/trust/evidence) via `record_stage`.
- **Preserved Arabic regression**: "ما هي المرмغة؟" → 84.4 s transcript
  timestamp, `SUPPORTED`.

## 3. Bugs fixed en route (found by the 21 new tests)

1. Tokenization used `[\w\u0600-\u06ff]`, folding Arabic `؟` into tokens
   (`المرمغة؟` never matched `المرمغة`) — narrowed to
   `[a-z0-9_\u0621-\u064a]` in `normalize_words`.
2. Temporal-window branch emitted raw segment `id` instead of the consumer's
   `segment_id`/`event_id` — items re-shaped before composing.
3. `ظهر` wrongly classified as a timestamp marker — removed.
4. `_guarded_missing` lacked its `anchor` kwarg (`TypeError`) — now
   `(question, property_word, language, anchor=None)`; anchors keep
   evidence/trust while status stays `NOT_FOUND`.
5. Rule 4b: property questions without an anchor hit the honest
   "cannot verify the color…" phrasing (Real lecture clothing-color verdict:
   `NOT_FOUND`, 0 evidence, trust `UNAVAILABLE`).
6. `و` (Arabic "and") added to stopwords.
7. `_PROPERTY_WORDS` gained `name` (mixed-language variable-name test).

## 4. Verified this session

### Test suite
```
python -m pytest -q  →  130 passed in ~6 s   (was 109; +21)
```
New `tests/test_ask_grounded.py` (imports private engine helpers): transcript
SUPPORTED + trace; visual diagram; comparison heuristics; timestamps→evidence+
jump+why; no-evidence NOT_FOUND; English visual UNAVAILABLE; accessibility-framed
honest; Arabic المرмغة→84.4s; Arabic partial-OCR "جزء من الكود"; mixed-language
variable name; Arabic stopword refusal; Arabic temporal window 60.0 s; Arabic
temporal no-content; conflict `range(10)` vs `range(5)`; partial-OCR print →
SUPPORTED; node-count no-guess; variable-name no "Omnya"; button color; bogus
citation drop; observability stage logs; schema-vocabulary hold.

### Live backend (port 8000)
- Demo `DEMO_python_loops` (13 segments, 7 OCR events): "What is a for loop?"
  → SUPPORTED/VERIFIED; "What code appeared on screen?" → SUPPORTED/VERIFIED with
  real OCR (`for iin range(5)`, `22%`) at 26.94 s + 37.72 s; "When was the code
  shown?" → SUPPORTED with timestamps; "What color is the penguin?" → NOT_FOUND
  "cannot verify the requested color…"; Arabic prompts honestly no-match.
- Real webcam `2924ba8f8909` (OCR-only, 1 readable event): clothing color →
  `NOT_FOUND` "لا أستطيع التحقق من اللون المطلوب من الأدلة المرئية المتاحة
  في الفيديو."; "ماذا يشرح المدرس؟" → NOT_FOUND honest; grounded Arabic probe
  answered at 117.68 s.

### Frontend (AppTest, live backend)
Demo-mode Ask flow → answer + SUPPORTED badge + "Why this answer?" + evidence
panel + jump button page render, 0 exceptions; penguin question → "cannot
verify" + NOT FOUND badge, 0 exceptions. All `dbg*/fixture_*` junk jobs purged.

## 5. Files changed/added for P3
- `backend/services/ask.py` — retrieve-first engine (rewrite): statuses,
  classifier, guards, conflict surfacing, jump, `ask_retrieval`/`ask_grounding`.
- `backend/services/evidence.py` — reused (trust constants, `trust_for_event`).
- `backend/routes/process.py` — `/ask` route unchanged (compatible).
- `frontend/app.py` — Ask tab upgraded: trust/status badges, trust/status
  reasons, source counts, "Why this answer?", jump-to-moment button (`#t=`
  seek), evidence panel with per-record trust, conflict warning, demo suggestion
  buttons.
- `tests/test_ask_grounded.py` — new, 21 scenarios.
- `README.md`, `docs/FINAL_SYSTEM_AUDIT.md` — docs updated.

## 6. Honest limitations (P3)
1. **Retrieval scoring is lexical** (content-word overlap), so paraphrases the
   lecture never states verbatim may score low — answered honestly rather than
   guessed.
2. **Arabic partial OCR** is answered as "جزء من الكود…" with the partial OCR
   text — transparent, but the trainer is right to smoke-test it.
3. **`status` and `why` are additive** convenience fields; the authoritative
   compatibility contract remains `answer`/`timestamps`/`source_refs`/
   `evidence_records`.
4. **Property no-guess is conservative by design**: a color plainly visible in
   frames but with no OCR/LLM vision path is reported `UNAVAILABLE`, never
   invented.
5. **LLM polish is optional**; without a key the engine is fully deterministic
   and grounded on the same retrieved context.

---

# Feature P4 — Competition readiness (audit continued)

Audit date 2026-08-30 (UTC). Strictly additive on top of P3: no endpoint
contract changed, no tab was removed; the full suite went **130 → 155 passed**
with zero changes to pre-existing tests.

## 1. Features shipped (all executed & verified this session)

| # | Feature | Implementation | Verified |
|---|---|---|---|
| 1 | Accessibility score | `backend/services/accessibility_score.py::compute_accessibility_score` — 0–100 from 7 weighted evidence ratios (speech access, captions, OCR availability, visual coverage, evidence trust, audio description, missing-information), `HIGH/MEDIUM/LOW`, per-component `evidence_value`+`cap`+`contribution`, written explanation, composite trust | Live demo 100/100 HIGH; real lecture 63/100 MEDIUM; `sum(contributions) ≈ score/100` asserted |
| 2 | Lecture Accessibility Report | `build_lecture_report` — speech / visual-understanding / missing-information / evidence / audio-description sections + **honest_statement** that is only "all grounded" when every visual event is VERIFIED & readable (real lecture: "Some visual information could not be verified… 25 of 26… UNAVAILABLE… not guessed") | `GET /lectures/{job}/report` on both real lectures |
| 3 | Profile-specific presentation | `presentation_for(mode)` — layout, priorities, emphasize-tabs, guide for blind/low_vision/deaf/hard_of_hearing/cognitive_support/default; **never re-runs the pipeline** (presentation is guidance on stored evidence only) | All 6 modes 200; unknown mode normalizes to default |
| 4 | "Why should I trust this?" | `evidence.explain_trust` — record-grounded trail (source-type lines, mm:ss timestamps, per-record ✓/⚠ with ids, sources-agree, weaker-trust cap, conflict warning); wired into `/ask` as structured `trust_explanation {lines, sources_agree, heads_up, cap}` | Unit paths + live `/ask` on demo (6 lines) |
| 5 | Visual moment replay | `GET /lectures/{job}/replay?timestamp=` — best-matching stored visual event + seek point, overlapping transcript, OCR text, trust, why-it-matters, what-you-might-miss, source frames; >10 s from any event → 404 (no fake moment) | Demo + real lecture; distant timestamp → 404 |
| 6 | Smart Learning Progress | `backend/services/progress.py` — strong (≥70%) vs needs-review topics with the actual missed questions, **repeatedly-missed** (same question wrong in ≥2 attempts), per-lecture rollups, `score_history`, and a next action resolved to a real evidence timestamp via quiz `source_refs` | Unit + `/students/{id}/progress` with two persisted failing attempts |
| 7 | Guided competition demo | Welcome tab 10-step tour + "Load DEMO lecture now" button + **Accessibility Report** step in the tour | AppTest + live demo flow |
| 8 | "Why EduAccess AI?" | Welcome comparison table (generic captioning vs EduAccess AI) + explicit no-fabrication banner | AppTest render |
| 9 | No-fabrication UX | `no_fabrication_callout()` banner shared across Welcome + report; score intentionally cannot hit 100 for unreadable frames | Rendered in AppTest, 0 exceptions |
| 10 | Pipeline transparency | `GET /lectures/{job}/pipeline-status` — canonical 11 stages (UPLOAD…READY) with per-stage status/seconds/fallback/counts; missing stage for a done job → "Recomputed on the fly…" (when derivable) or honest `skipped` | Both real lectures; all stages valid |
| 11 | Real demo metrics | `build_metrics` — live counts every call (transcript words, events, verified records, quiz questions, accessibility events, missing items, grounded/supported answers parsed from `[ask_grounding]` logs) | Demo + real lecture; `computed_at` says live |
| 12 | Crash safety | Global `Exception` handler → 500 `{"detail": "…unexpected error on this request…recorded in server logs"}`; friendly per-route 404s kept; **no traceback/user-visible leak** | TestClient 500-raise test + 404 suite |
| 13 | Tests | `tests/test_competition_readiness.py` (25 scenarios) | 155 total passed |
| 14 | Live E2E | Endpoint sweep on both real lectures + `/ask` + AppTest | All 12 endpoints × 2 lectures → 200 |
| 15 | Docs | `README.md`, `docs/FINAL_SYSTEM_AUDIT.md`, `docs/COMPETITION_READINESS_REPORT.md` | — |

## 2. Verified evidence (executed this session)

### Test suite
```
python -m pytest -q   →  155 passed in ~9 s   (was 130)
```
New `tests/test_competition_readiness.py`: score bounds/shape + component-sum
consistency, report structure + honest-statement variants (fully-verified vs
unverifiable), all presentation modes + unknown-mode normalization, trust
explanation unit paths + `/ask` payload shape, replay contract + 404s, progress
repeatedly-missed/needs-review/next-action from real history + empty student,
metrics real counts, pipeline-status order + counts, friendly 404s, 500 handler
(traceback verified absent), demo-mode module import.

### Live numbers (both real lectures)
| Endpoint | DEMO `DEMO_python_loops` | Real `2924ba8f8909` |
|---|---|---|
| `/accessibility-score` | 100 HIGH (7/7 readable VERIFIED) | 63 MEDIUM (1/26 readable, 25 UNAVAILABLE) |
| `/report` | speech 13 segs, missing 0/7 redundant | speech 97 segs, visual 1 readable / 25 unavailable, 1 missing item |
| `/metrics` | 731 chars, 7 events, 2 quiz q | 515 words, 26 events, 2 quiz q, 1 missing |
| `/pipeline-status` | 11 stages, MISSING recomputed-completed | 11 stages, all honest |
| `/replay?timestamp=5` | 200 (moment via stored events) | 200 (nearest visible event) |
| `/presentation?mode=blind` | 200 | 200 |
| `/ask` ("What code appeared on screen?") | SUPPORTED/VERIFIED, 6 trust lines, jump 26.94 s | — |
| `/ask` ("When was the code shown?") | — | NOT_FOUND (honest, 1 expl line) |

### Frontend (AppTest, no live backend needed for initial render)
`AppTest.from_file('frontend/app.py')` → **0 exceptions**, 12 tabs rendered
(full page). Both real lectures exercised over TestClient with all endpoints 200.

## 3. Files changed/added for P4
- `backend/services/accessibility_score.py` — new (score/report/presentation/metrics).
- `backend/routes/analytics.py` — new router (6 endpoints) registered in `main.py`.
- `backend/services/progress.py` — new Smart Learning Progress; `routes/student.py`
  new `GET /students/{id}/progress`.
- `backend/services/evidence.py` — `explain_trust` (record-grounded trust trail).
- `backend/services/ask.py` — `trust_explanation` structured block; observability
  notes prefixed `[ask_retrieval]`/`[ask_grounding]` (consumed by metrics).
- `backend/main.py` — analytics router + safe global 500 handler.
- `frontend/app.py` — 12th "Accessibility Report" tab; Welcome guided demo +
  comparison + no-fabrication banner; dashboard pipeline stepper; Ask/Missing
  replay buttons; Progress tab rewritten on the progress endpoint.
- `tests/test_competition_readiness.py` — new (25 scenarios).
- `README.md`, `docs/FINAL_SYSTEM_AUDIT.md`, `docs/COMPETITION_READINESS_REPORT.md`.

## 4. Honest limitations (P4)
1. **The score is a transparency heuristic, not a UX study.** It rewards real
   evidence (transcript, readable OCR, verified records, narration, honest missing
   classification) and cannot reach 100 for lectures with unreadable frames — by
   design, not a bug.
2. **Repeatedly-missed detection needs 2+ persisted attempts on the same question**
   text; a single mistake is never flagged as "repeated".
3. **Replay uses the stored event whose timestamp best matches** (≤10 s window);
   it is not a frame-exact screenshot.
4. **Presentation guidance is static per profile**, not generated per lecture; the
   per-lecture evidence it highlights (inside the other tabs) is real.
5. **`elapsed_pct`** on `/pipeline-status` reflects stored stage seconds only; a
   lecture fully cached shows near-total coverage, correctly labelled by the
   `cached` flags.
6. **DEMO lecture numbers are for a high-contrast slide deck**, the honest best
   case for offline OCR; the real webcam lecture's 63/100 is the honest typical
   case.

---

# Feature P5 — Evidence-grounded visual understanding (v2.2.0, audit continued)

Audit date 2026-08-30 (UTC). Strictly additive on top of P4: no endpoint
contract changed, no response key was removed; the full suite went
**155 → 182 passed** with zero changes to pre-existing tests.

## 1. What was shipped

Every visual event now becomes a **structured, evidence-grounded visual
understanding record** — a richer contract than the raw OCR + companion
analysis, and the single source the whole stack reads:

- `visual_type` — `slide` / `code` / `diagram` / `chart` / `table` / `ui` /
  `scene`. Guessed **only from OCR evidence + confident detection markers,
  never from the LLM and never by looking at pixels**: code needs ≥2 code
  markers (or one strong one like `print (`, `for i in`, `while `), charts need
  a word-boundary `chart`/`graph` token or a count question ("how many"),
  `flowchart` is deliberately **not** a chart, and prose that merely contains
  the word "output" cannot become a UI pattern.
- verbatim `ocr_text` — exactly what Tesseract read (empty when unreadable).
- `visual_claims` — **2–4 claims**, each with its own `evidence`
  (`image_text`/`screen_text`, stored verbatim) and `confidence`. The claim
  text is always composed from actual OCR tokens; when OCR is empty the record
  says so and produces **no textual claims**.
- `complement_level` — `REDUNDANT` / `PARTIALLY_MISSING` / `COMPLEMENTARY` /
  `VISUALLY_ONLY` / `AUDIO_ONLY` / `UNAVAILABLE`, using the existing content-word
  speech/visual coverage so it agrees with the "What am I missing?" classifier.
- accessibility layers — `short_description` and `accessible_description`
  (standard/detailed is decided honestly from how much text was actually read).
- `limitations` — an explicit honest list; colors, counts, unreadable code and
  fake node numbers are refused (see §4 for the tests that prove it).
- `verified` / `readable` — a trust surface for frontend badges.

### Where it lives

| Layer | Change |
|---|---|
| Pipeline | New stage `visual_understanding` (after `visual_event_analysis`, progress 71) persisting `{stem}_visual_understanding.json` `{job_id, records}`; stage cache honored; StageTimer added |
| API | `GET /lectures/{job}/visual-understanding` (on-the-fly build + persist for pre-feature jobs); `/visual-events` now also returns `understanding`; `/timeline` visual items carry `visual_type` + `complement_level` (titles now "Visual: Slide" etc.); `/missing?mode=` items enriched with `complement_level` + `visual_type` |
| Ask-the-Video | `_merge_understanding` additively merges `visual_type`/`complement_level`/`visual_claims`/`accessibility_description` onto events; scored records and `/evidence` visual records carry the fields; visual answers label the type |
| Analytics | `VISUAL UNDERSTANDING` becomes a canonical pipeline stage; pipeline-status recomputes it on the fly for pre-feature jobs with an honest "Recomputed on the fly from stored visual events." note |
| Services | `backend/services/visual_understanding.py` (core build); `lecture_data.load_visual_understanding` with disk fallback |
| Frontend | `getVisualUnderstanding(jobId)` API client; `VisualClaim`/`VisualUnderstanding`/`VisualUnderstandingResponse` types; `TimelineItem`/`MissingItem` extended; **Visual Companion rewritten as a premium evidence inspector** — verified/type/complement badges, verbatim OCR, expandable grounded claims, honest-limitations box, "Watch this moment" jump |

## 2. Verified evidence (executed this session)

### Test suite
```
python -m pytest -q   →  182 passed in 3.22 s  (was 155)
```
New `tests/test_visual_understanding.py` (27 tests):
- **Classification**: slide vs code vs chart vs diagram vs ui vs scene across
  realistic OCR; `flowchart` → not a chart; "how many X" → chart; ≥2 code
  markers → code.
- **Adversarial no-fabrication**: with empty OCR a color is *never* guessed
  (claims say "cannot verify"); a count question refuses to guess; empty OCR
  produces zero textual claims; a fake node count in the OCR is rejected.
- **Trust/timestamps**: `verified`/`readable` honest; `ocr_timestamp` carried.
- **Complement + accessibility**: all 6 complement levels; short/standard
  description routing; limits respected.
- **Schema + API**: full key shapes; `get_visual_understanding` route returns
  records; `/timeline` includes `complement_level`; backward compatibility.
- TestClient API-level tests use isolated synthetic jobs and clean up all
  artifacts (no real-lecture pollution).

### Live numbers
| Endpoint | DEMO `DEMO_python_loops` | Real `2924ba8f8909` |
|---|---|---|
| `/visual-understanding` | 7 records — slide/code/code/slide/code/chart/slide, all `VERIFIED` | 26 records — 25 `UNAVAILABLE` (nothing readable), 1 slide `VERIFIED` (garbled OCR honestly labelled) |
| `/timeline` titles | "Visual: Slide" / "Visual: Code" with `visual_type` + `complement_level` | same, honest |
| `/missing?mode=blind` | items carry `complement_level` + `visual_type` | items carry `UNAVAILABLE` + truthful type |
| `/ask` ("What code appeared on screen?") | SUPPORTED/VERIFIED, chart-typed OCR evidence | — |
| `/pipeline-status` | `VISUAL UNDERSTANDING [completed]`, `cached=True`, honest recompute note | same |

### Frontend (headless Chrome, live backend)
Demo lecture page: Visual Companion renders verified/type/complement badges,
"Grounded claims" expander, verbatim OCR, honest-limitations box, "Watch this
moment" → 0 console errors. Real lecture page: honest UNAVAILABLE badge + the
"not enough readable on-screen text" limitations message → 0 console errors.
`npm run build` (Next.js 15) succeeded.

## 3. Files changed/added for P5
- `backend/services/visual_understanding.py` — new core module (build records).
- `backend/services/pipeline.py` — new persistent `visual_understanding` stage.
- `backend/services/lecture_data.py` — `load_visual_understanding` disk fallback.
- `backend/services/ask.py` — `_merge_understanding`, type-labelled visuals,
  enriched evidence records.
- `backend/routes/process.py` — `/visual-understanding` route, `/visual-events`
  understanding array, `/timeline` + `/missing` enrichment.
- `backend/routes/analytics.py` — canonical stage + on-the-fly recompute note.
- `frontend/next-app/lib/api.ts`, `frontend/next-app/types/backend.ts`,
  `frontend/next-app/app/lectures/[jobId]/page.tsx` — client + Visual Companion
  evidence inspector + timeline/missing enrichment.
- `tests/test_visual_understanding.py` — new (27 scenarios).
- `README.md`, `docs/FINAL_SYSTEM_AUDIT.md`, new `docs/VISUAL_UNDERSTANDING_REPORT.md`.
- Generated artifact: `data/outputs/DEMO_python_loops_visual_understanding.json`.

## 4. Honest limitations (P5)
1. **Type/claims are evidence-bound by design.** Whatever the OCR cannot
   literally support (colors, exact counts, unreadable code) is reported in
   `limitations` and refused — never hallucinated. Rich scene description still
   requires an `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`; offline this is OCR-only.
2. **Confidence is heuristic, not calibrated.** `high`/`medium`/`low` come from
   rule strength and OCR volume; they are stable and explainable, not a
   statistical probability.
3. **The real lecture's 25/26 UNAVAILABLE is honest, not a failure.** A
   webcam-style video has little readable on-screen text; the system says so
   and the UI shows a truthful "not enough readable text" state.
4. **The demo chart is classified from a count question on a plain-text slide**;
   pixel-level chart geometry is not analysed offline.
5. **`visual_understanding` for pre-feature jobs is recomputed on the fly** from
   stored visual events (deterministic, no pipeline re-run); it is persisted on
   demand so later requests are cached.
## P6 - Final UX & competition polish (audit 2026-08-31)

Everything below was executed and verified live against the running backend
(`http://127.0.0.1:8000`) and a headless Chrome browser on `http://localhost:3000`.

### 1. Accessibility Report page now surfaces the real component model
The report was previously top-line-only (score ring + trust). It now renders the
full backend `components` map + `explanation[]`:
- Score ring, level and overall trust (e.g. DEMO = 100 / HIGH / VERIFIED).
- Per-component breakdown: name, a percentage bar, evidence value (%) and weight
  ("25 of 25", "10 of 10", ...), plus the backend `detail` line.
- The backend `basis` line and the 7-item plain-language `explanation`.
- A real error state instead of an infinite spinner.

Bonus: a "skeleton stuck forever" bug was found and fixed. The loader used
`.catch(() => settle())` on two promises, so `settle()` never ran when those
requests **succeeded** (success skips `.catch`) -> `prepared` stayed `false` and
the page showed a permanent skeleton. Adding `.finally(settle)` to all three
resolved it.

### 2. "Jump to moment" on Ask + Missing now actually navigates
Previously the Ask page's jump control was a stub: `href` pointed at a
`?tab=jump` route that did not exist and `onClick={(e) => e.preventDefault()}`
blocked navigation (acceptance #15/#16 failure). Now:
- Ask / Missing link to `/lectures/<jobId>?t=<seconds>`.
- The workspace honours `?t=` and auto-seeks the video once ready
  (verified: ?t=15 -> `video.currentTime === 15`).

### 3. Distinct answer statuses
Ask-the-Video no longer collapses every non-SUPPORTED status into one look. It
distinguishes PARTIALLY_SUPPORTED / NOT_FOUND / UNCERTAIN / UNAVAILABLE with
distinct icons and labels, and shows the evidence `source_type` + timestamp
("Transcript evidence . 00:00-00:07" / "On-screen evidence").

### 4. What-am-I-Missing surfaces the rich profile fields
Per item the page now shows importance (HIGH/MEDIUM/LOW badge), overall coverage
ratio in the summary ("19% of visuals covered by speech"), visual type, "X% to
speech", confidence, source type and a "Watch this moment" deep-link (previously
these fields existed in the API but were not rendered).

### 5. Dashboard
Added an "Open Demo Lecture" CTA and an "Evidence-first, never fabricated"
honesty banner.

### 6. Small code-quality fixes
- `izegible` typo -> `legible`.
- Duplicate hardcoded SVG gradient `id="ring-grad"` -> unique `useId()` (multiple
  ScoreRings no longer collide).
- Upload page: `URL.createObjectURL` leak revoked on change/unmount; the poll
  loop now exits when the component unmounts.
- Progress chart: added an aria-label describing the data.

### Verification this pass
- `npm run build` (Next.js 15.5.24) succeeded, 14 routes.
- `python -m pytest -q` -> 193 passed (4.5s).
- Headless Chrome against DEMO_python_loops + real lecture: report breakdown,
  ask answer + jump navigation, missing rich fields, dashboard banner, and the
  `?t=` workspace auto-seek all render with **0 console errors**.
- Restarted the frontend dev server because its long-running `next dev` instance
  had gone stale (chunks 404'd after a build), which is why a fresh server is
  now the one serving :3000.

---

# Feature P7 / Upgrade — Intelligent Multimodal Learning Engine (v2.3.0, audit continued)

Audit date 2026-08-31 (UTC). Strictly additive on top of P6: no endpoint was
removed or renamed, no response key changed, and the full suite went
**193 → 223 passed** with zero changes to pre-existing tests. The upgrade turns
EduAccess AI into an evidence-grounded learning engine on top of the existing
(V)isual-companion / Ask / Missing / Quiz / Progress stack.

## 1. What was shipped (all additive)

| Feature | Implementation | Verified |
|---|---|---|
| Lecture Knowledge Graph | `backend/services/knowledge_graph.py` — concepts drawn only from (a) quiz `concept` labels, (b) accessibility `important_concepts`/`learning_objectives`, (c) educational vocabulary that **literally appears** in transcript/OCR (word-boundary matched so `import` never matches inside `important`). Each concept is mapped, via stop-word-filtered content-word overlap, to real speech links (segment snippets + timestamps), visual links (readable OCR only, with trust) and assessment links (quiz questions resolved back to a real moment). A self-consistent node/edge graph (`concept→segment`, `concept→event`, `concept→quiz`, `followed_by`, `next_visual`) with a `quiz:*` node so every edge is closed. Optional on-disk cache `{stem}_knowledge_graph.json`. | `GET /lectures/{job}/knowledge-graph` on DEMO → 15 concepts, 35 nodes, 78 edges, all edges grounded in node ids; deterministic (rebuilt twice identical). |
| Concept ↔ speech ↔ visual mapping | `backend/services/concept_mapping.py` — canonical per-concept mapping + `all_evidence_mappings`; shared primitives so gaps + graph never diverge. | `/concepts` returns per-concept speech/visual/status/assessed (DEMO 15 concepts). |
| Learning gap detection | `backend/services/learning_gaps.py::lecture_gaps` + `student_gaps` — lecture-level modality gaps come straight from the graph's honest status (e.g. a quiz concept with **no** spoken/visible evidence → `assessed_but_not_explained`; an unverified visual-only concept → `visual_only`). Student gaps come from real quiz attempts and resolve back to a real evidence timestamp. | DEMO → 5 gaps (2 critical: `general_programming` + `loops_indexing` are quiz-only concept labels not spoken aloud; 3 visual_only: `output`/`print`/`syntax`). |
| Explain-missing-concept | `learning_gaps.explain_missing_concept` — gathers only real speech/shown evidence for a concept, then an honest verdict (`covered` / `partial` / `not_covered`), plus "closest covered concepts" the lecturer did explain. | `while loop` → covered (5 spoken + 4 verified visual); `general_programming` → not_covered (honest); a nonsense concept → `UNKNOWN`. |
| Personal Learning Agent + Next Best Action | `backend/services/learning_agent.py` — reasons only over real profile + quiz attempts: mastery by concept, score trend, access-aware action preference, then a ranked set of recommendations. Action types strictly from the whitelist REVIEW_VIDEO / LISTEN_TO_AUDIO_DESCRIPTION / READ_TRANSCRIPT / REVIEW_VISUAL / EXPLAIN_CONCEPT / RETAKE_QUIZ / PRACTICE_CONCEPT, each with a real lecture + concept + evidence timestamp when knowable, and an honest `grounded_on`. Insufficient history → "Not enough learning history yet". | `next_action('default')` → EXPLAIN_CONCEPT on `general_programming` grounded at 00:00 (real quiz concept, not spoken); `next_action(<new id>)` → honest insufficient_history, no fabricated timestamp. |
| Endpoints | `backend/routes/learning.py` — `GET /lectures/{job}/knowledge-graph`, `/concepts`, `/learning-gaps`, `/concepts/{c}/explain`, `/lectures/{job}/students/{sid}/learning-gaps`, `/students/{sid}/learning-agent`, `/learning-insights`, `/next-action` (+ default convenience aliases). Registered in `main.py`. | All 8 primary endpoints → 200 (TestClient) + 404 for unknown job. |
| Quiz concept linkage | `quiz.py` — `concept_id()` + `lecture_id_from_quiz()`; `grade_quiz` now records `concept_id`/`lecture_id` per question in the graded results and the persisted attempt history (additive). | New unit + existing grading tests pass. |
| Frontend (new pages + dashboard) | `/knowledge-graph`, `/learning-gaps`, `/agent` pages; a dashboard **Next Best Action** banner; AppShell "INTELLIGENCE" nav group; home "Learning tools" entries. Types + API client added. All deep-links use the working `?t=<seconds>` jump (verified video seek). | `npx tsc --noEmit` clean; `npm run build` (17 routes) succeeded; headless-Chrome E2E 16/16 with 0 console errors (see §2). |

## 2. Verified evidence (executed this session)

### Test suite
```
python -m pytest -q  →  223 passed in 2.56 s  (was 193; +29: kg 10, gaps/agent 9, api 10)
```
New: `tests/test_knowledge_graph.py` (10), `tests/test_learning_gaps_agent.py` (9),
`tests/test_learning_api.py` (10). Coverage includes: graph grounding & determinism,
status vocabulary, every edge closed within nodes, speech/visual links only from
real evidence, honest `UNKNOWN`, no-history agent honesty, action-type whitelist,
endpoint contracts + 404s + honest next-action.

### Graded quiz linkage (existing `grade_quiz` now richer)
`grade_quiz` results and the persisted attempt now carry `concept_id` + `lecture_id`
per question — verified by the existing grading test plus a manual Demo submission.

### Browser E2E (headless Chrome, live backend + built frontend) — 16/16
- Dashboard shows the Next Best Action banner (real history) and links to `/agent`.
- `/knowledge-graph` renders concepts/statuses and each concept expands to a
  real jump-to-evidence link.
- `/learning-gaps` renders gaps + a critical assessed-but-not-explained gap + a
  review-at link.
- `/agent` renders the Next Best Action card, insights, a grounded "Go to moment";
  `?concept=while loop&lecture=` renders the grounded explanation with spoken +
  on-screen evidence.
- Deep-link `?t=18` on the workspace → `video.currentTime === 18` (verified).
- **0 console errors** across all new pages.

### Regression (unchanged behaviour preserved)
- Prior-feature E2E (`final_e2e.cjs`): dashboard "Open Demo Lecture", evidence-first
  banner, Ask jump link → workspace, Missing rich fields, Report → all pass, 0 errors.
- Audio Description playback E2E (`ad_e2e3.cjs`): the narration WAV plays, pauses
  and resumes in-cue with the correct backend URL — **unchanged**.
- `npm run build` (Next.js 15.5.24) succeeded, **17 routes** (3 new pages).

## 3. Files changed/added for P7
- `backend/services/knowledge_graph.py`, `backend/services/concept_mapping.py`,
  `backend/services/learning_gaps.py`, `backend/services/learning_agent.py` — new.
- `backend/routes/learning.py` — new router registered in `backend/main.py`.
- `backend/services/quiz.py` — `concept_id`/`lecture_id_from_quiz` + additive
  `concept_id`/`lecture_id` on graded results and attempt history.
- `frontend/next-app/types/backend.ts`, `lib/api.ts` — new types + fetchers.
- `frontend/next-app/app/{knowledge-graph,learning-gaps,agent}/page.tsx` — new.
- `frontend/next-app/app/page.tsx`, `components/layout/AppShell.tsx` — dashboard
  banner + INTLLIGENCE nav + learning-tool entries.
- `tests/test_knowledge_graph.py`, `tests/test_learning_gaps_agent.py`,
  `tests/test_learning_api.py` — new (29).
- `README.md`, `docs/FINAL_SYSTEM_AUDIT.md`, new `docs/KNOWLEDGE_GRAPH_REPORT.md`,
  `docs/LEARNING_GAPS_REPORT.md`, `docs/PERSONAL_LEARNING_AGENT_REPORT.md`,
  `docs/FINAL_ACCEPTANCE_REPORT.md`.

## 4. Honest limitations (P7)
1. **Concept discovery is lexical**, not semantic: concepts come from vocab that
   literally appears (or from quiz/lesson labels). A concept taught by paraphrase
   the lecture never states verbatim may be missed, and quiz-only concept labels
   (e.g. `general_programming`) are honestly flagged as "assessed but not
   explained" even though the lecture covers the general topic.
2. **Gap detection is status-based and evidence-grounded**, not a pedagogical
   judgement: it reports which concepts have no speech/visual/assessment evidence,
   which is exactly the honest claim it is scoped to make.
3. **The agent's "mastery"** is defined from real quiz question results (≥70%
   correct), not a model of understanding; trend uses the last 2–3 stored scores.
4. **Recommendations are deterministic rules**, not an LLM; they are cheap,
   transparent, and grounded in the same real data the rest of the system uses.
5. **Explain-missing-concept** returns the closest covered concepts from the same
   lecture; it does not pull content from other lectures.
6. **Knowledge-graph vocab lists** are English + Arabic curricula terms; other
   languages would need their own vocabulary (structure is language-agnostic).
