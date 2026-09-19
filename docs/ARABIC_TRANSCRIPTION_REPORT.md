# Arabic Speech Recognition / Transcription — Fix Report (v2.4.0)

Audit date 2026-08-31 (UTC). This report documents the real production bug where a
newly uploaded **Arabic** lecture produced garbled, largely unintelligible captions,
and the fix that now produces readable, accurately-worded Arabic — transcribed from
the **real uploaded narration**, never manually edited, hardcoded, fabricated,
translated or transliterated.

---

## 1. Root cause

The Speech-to-Text system uses **OpenAI Whisper** locally (`openai-whisper 20250625`,
`openai-whisper` pip package). The failure chain was:

1. **Model too small.** `backend/config.py` defaulted `WHISPER_MODEL_SIZE` to `base`.
   The `base` model is inadequate for low-quality, dialectal Arabic audio from a
   screen recording. It **hallucinates non-word garble** instead of transcribing
   readable Arabic.
2. **Language detection was automatic but the model fidelity failed.** Whisper
   *did* correctly detect `ar` (Arabic) — the bug was not detection, and the system
   was **not** translating to English (output was already Arabic, just unintelligible).
3. **No explicit language forcing.** `speech.transcribe()` called
   `model.transcribe(path)` with no `language` or `task` parameter, leaving Arabic
   to whatever the small model could muster, and never *forcing* the Arabic code.

**Proof of garble** (the real lecture `b359a5e9acdc`, stored transcript at the time):
> `نوانتنا سنوى مكلمة وداخل عامات المرمقة تخلينا قولك حاجة من البداية...`

This is Arabic-shaped gibberish — the `base` model's hallucination, not the teacher.

---

## 2. What was NOT the problem (checked and ruled out)

| Suspect | Finding |
|---|---|
| Translation mode | ❌ Not it — Whisper always used `task="transcribe"`, never `translate` |
| Language detection | ❌ Not it — Whisper detected `ar` correctly |
| Audio preprocessing | ❌ Extraction already produced mono 16 kHz PCM WAV from the real narration |
| Timestamps | ❌ Were tied to the real video timeline — the text was wrong, not the timing |

---

## 3. Exact files changed

| File | Change |
|---|---|
| `backend/config.py` | Default `WHISPER_MODEL_SIZE` `base` → **`small`**; added `LANGUAGE_FORCE_THRESHOLD` (0.5) |
| `backend/services/speech.py` | Added `detect_language()` (returns `{language, confidence, probabilities}`); added `resolve_language()` (Arabic-first forcing); `transcribe()` now accepts `language=` and always uses `task="transcribe"` (transcription mode, never translation); records effective `language` on the result |
| `backend/services/pipeline.py` | Transcribe stage now calls `detect_language()` → `resolve_language()` → `transcribe(language=...)`; stores `stt_language` on the result and persists it in `segments.json` |
| `frontend/next-app/app/lectures/[jobId]/page.tsx` | Transcript segment text now renders with `dir="auto"` so Arabic spans compute **RTL** (English stays LTR) |
| `tests/test_speech_arabic.py` | **New** — 10 Arabic STT regression tests |
| `tests/test_integration.py` | Updated to mock new `speech.detect_language` / `speech.resolve_language` pipeline deps |

---

## 4. STT model / provider used

- **Provider:** local OpenAI **Whisper** (`openai-whisper`), fully offline, no API key.
- **Model:** now **`small`** by default (configurable via `WHISPER_MODEL_SIZE`).
  `base` was demonstrably too small for Arabic; `small` is the minimum that yields
  readable Arabic on this audio, and also improves English.

## 5. How Arabic language handling was fixed

1. **Arabic is first-class and forced when confidently detected.** The pipeline now
   runs Whisper's language classifier; when Arabic is the top language with
   probability ≥ 0.5, `resolve_language()` returns `"ar"` and it is passed
   explicitly to `transcribe(language="ar")`.
2. **Transcription mode, never translation.** `transcribe()` always calls
   `model.transcribe(..., task="transcribe")` — Arabic audio is transcribed **as
   Arabic**, never translated to English, never transliterated.
3. **Bigger, more accurate model** for low-quality dialectal audio.
4. **Timestamps from the same real audio** — Whisper emits segment `start`/`end` on
   the real narration; unchanged and valid.
5. **No fabricated text.** If audio is empty/unclear, Whisper returns empty — never
   guessed words (kept the evidence-first honesty rule).
6. **Preprocessing verified correct** — the uploaded video's narration is already
   extracted to mono 16 kHz PCM WAV (Whisper's expected input); no aggressive noise
   reduction that could destroy speech was added.
7. **RTL UI** — Arabic captions render right-to-left (`dir="auto"` computes `rtl` for
   Arabic segments); English behavior unchanged.

---

## 6. Confirm on the REAL Arabic lecture

Real lecture: **`b359a5e9acdc`** (`Recording 2026-08-31 194308.mp4`), 90.6 s,
uploaded in-app. Its cached outputs were backed up, the derived transcript/cache
cleared, and the pipeline re-run on the **real uploaded audio** with the fixed STT.

**Before (base):** `نوانتنا سنوى مكلمة وداخل عامات المرمقة...` (garbled)

**After (small + language="ar"):**
> `شباب لو انت تنسانوية بكالوريا وداخل على مادة البرمجة فخليني قول لك حاجة من البداية متى يلقش البرمجة متى تصعبها...`

Readable Arabic, Egyptian dialect, matching the teacher's spoken content about
programming / CS / web / AI for beginners.

**Verification output:** `stt_language=ar`, `n_segments=10`, segment timestamps
valid & sequential (0→7→15→27→34→43→54→63→75→82→89), `has_arabic=True`,
`arabic_char_count=1008`, `contains_reading_phrase=True`, `old_garbled_absent=True`.

### Downstream features all re-verified on the real Arabic lecture (live API + browser)
| Feature | Result |
|---|---|
| **Captions & Transcript** | Readable Arabic across 10 timestamped segments; `segments.json` carries `language="ar"` |
| **Visual Timeline speech events** | Speech descriptions carry the corrected Arabic |
| **Ask the Video** | Arabic question → `status=SUPPORTED`, `trust=VERIFIED`, answer cites the corrected Arabic segment at t=0.0 |
| **Learning Gaps** | Honest gaps derived from corrected transcript (2 `assessed_but_not_explained`, 1 `visual_only`) |
| **Knowledge Graph** | Concepts/evidence grounded in the corrected transcript + OCR |
| **Quiz generation** | Regenerated from the corrected transcript (2 questions) |
| **Personal Learning Agent** | Works; `EXPLAIN_CONCEPT` grounded on real history/evidence |

---

## 7. Tests — before / after

| Suite | Before | After |
|---|---|---|
| Full backend suite | 223 passed | **233 passed** |
| New Arabic STT tests | — | **+10** (`tests/test_speech_arabic.py`) |

New Arabic tests cover: both of the required Arabic-not-translated + Arabic-language
passed/detected behaviors, Arabic text preserved verbatim (not translated /
transliterated / fabricated), valid sequential timestamps, and empty/unclear audio →
no fabricated text. Existing English transcription behavior still passes (covered by
the full suite + integration test updated for the new pipeline deps).

### Build / typecheck / E2E
- `python -m pytest -q` → **233 passed** in ~21 s
- `npx tsc --noEmit` → **exit 0** (clean)
- `npm run build` (Next.js 15.5.24) → **success, 17 routes**
- **Arabic E2E** (headless Chrome, live backend + fresh-build frontend) → **8/8 PASS**, 0 console errors (readable Arabic shown, old garble absent, `dir="auto"` segments **compute `rtl`**)
- **Regression E2E** (`final_e2e.cjs`) → dashboard/evidence-first/ask-jump/missing/report all pass, 0 errors
- **AD E2E** (`ad_e2e3.cjs`) → narration plays/pauses/resumes, 0 errors (Audio Description fix intact)
- **Intelligence E2E** (`intelligence_e2e.cjs`) → **16/16** PASS, 0 errors

---

## 8. Honest limitations

1. **`small` is accurate but not perfect.** Some dialectal words are still
   approximated (e.g. some vowels/words slightly off) — Whisper `small` is a
   reasonable accuracy/timing trade-off. For near-perfect Arabic, a `medium`/`large`
   model or a longer/multilingual ASR would be needed (configurable via
   `WHISPER_MODEL_SIZE`, no code change).
2. **Screen recordings with background audio** (app alerts, music) can still lower
   accuracy; we deliberately added **no** aggressive noise filtering so we never
   remove speech information.
3. **Dialect coverage**: the lecture is Egyptian-sounding dialectal Arabic; Whisper
   handles it but MSA-focused output can differ from colloquial.
4. **Language forcing threshold (0.5)** is a heuristic; short clips that are not
   confidently Arabic are left to Whisper's own auto-detection (English unchanged).
5. **No manual text editing** was done — the Arabic is exactly what the STT model
   produced from the real audio, preserving the evidence-first no-fabrication rule.
