# EduAccess AI — Master Forensic Transformation & Rebuild Plan

## Strategic Vision: "The AI Accessibility Compiler for Education"

The transformation evolves EduAccess AI from a fragmented collection of 12 separate dashboard pages into **ONE unified, state-of-the-art Accessibility Compiler**.

```
Input Video (Speech + Visuals)
               ↓
    [ 1. Ingest & Content Hash ]
               ↓
    [ 2. Multimodal Extraction (Whisper + Vision OCR) ]
               ↓
    [ 3. Multimodal Temporal Alignment ]
               ↓
    [ 4. Accessibility Digital Twin ]
               ↓
    [ 5. Accessibility Difference & Gap Engine ]
               ↓
    [ 6. Compiler Adaptation Target (Blind / Deaf / Low-Vision / Cognitive) ]
               ↓
    [ 7. Codec Generation (Captions, Synchronized AD Audio, Screen Transcripts) ]
               ↓
    [ 8. Grounded Verification & Trust Gate ]
               ↓
    [ 9. Interactive Learning Studio & Copilot ]
```

---

## 1. Keep / Merge / Remove / Rebuild Matrix

| Component | Current State | Problems | Target State | Impact / Action | Priority |
|---|---|---|---|---|---|
| **Streamlit UI** (`frontend/app.py`) | 1,486 lines legacy script | Outdated, duplicated, causes confusion | **REMOVE** | Clean up root, standardizing on Next.js 15. | **P0** |
| **Monolithic Workspace** (`app/lectures/[jobId]/page.tsx`) | 1,298 lines single file | Heavy re-renders, complex layout bugs | **REBUILD** | Split into modular components: `VideoPlayer`, `AudioDescriptionDeck`, `VisualInspector`, `GroundedAsk`. | **P0** |
| **Fragmented Routes** (`/ask`, `/missing`, `/timeline`, `/audio`, `/knowledge-graph`, `/learning-gaps`, `/agent`, `/report`, `/quiz`, `/progress`) | 10 separate standalone pages | Creates disjointed LMS feel, poor UX | **MERGE** | Consolidate into **3 Core Destinations**: 1) Compiler Studio (`/workspace/[id]`), 2) Learning Intelligence (`/learning`), 3) Library (`/library`). | **P0** |
| **Sign Language Narrative** | Conceptually promised in docs | No EgSL model, dataset, or translation exists | **RESTRUCTURE** | Honestly label as *Research Frontier / Captions + Visual Concept Anchor for Deaf Learners*; remove misleading translation claims. | **P0** |
| **Accessibility Score Paradox** | Rewards missing info discovery positively | Can give 90% score to lecture with severe unresolved visual gaps | **REBUILD** | Formula adjusted: `Health = Base - Disparities + Remediations`. | **P1** |
| **Gemma & VoxCPM Cloud Gateway** | In `backend/services/ai/` | Robust client with retry & fallbacks | **KEEP & IMPROVE** | Standardize response schemas and prompt definitions. | **P1** |
| **Difference Engine & Simulator** | In `accessibility_engine.py` | Detects Speech vs Visual disparities | **KEEP & EXPAND** | Promote to core compiler stage. | **P1** |

---

## 2. Information Architecture Transformation (Target Routes)

Instead of 12 scattered routes, the target application organizes around **4 Powerful Views**:

1. **`/` — Command Center & Compiler Pipeline**:
   - Hero: Drop an educational video to compile accessibility.
   - Live compilation stage visualizer.
   - Quick load for pre-compiled demo lectures.
   - Global system health and dependency monitor.

2. **`/workspace/[jobId]` — The Accessibility Studio & Player**:
   - **Main Stage**: Video player with synchronized WebVTT captions.
   - **Audio Description Deck**: Live synchronized narration player with visual type badges.
   - **Visual Twin Inspector**: Real-time on-screen OCR, code structure, diagrams, and "What am I missing?".
   - **Grounded Copilot / Ask**: Multimodal Q&A with jump-to-timestamp evidence citations.
   - **Persona Simulator**: Instant toggle between Blind, Low-Vision, Deaf, Cognitive, and Standard experiences.

3. **`/learning` — Learning Intelligence & Knowledge Graph**:
   - Interactive Knowledge Graph mapped directly to video timestamps.
   - Speech vs. Screen Learning Gap detector.
   - Concept-grounded adaptive quiz with semantic grading.
   - Student Mastery profile and Next Best Action.

4. **`/settings` — Accessibility Preferences & Profiles**:
   - High-contrast, large text, screen-reader mode, reduced motion, speech rate, and language (English / Egyptian Arabic RTL).

---

## 3. Phase-by-Phase Execution Roadmap

### Phase A — Remove & Clean
- Remove legacy `frontend/app.py` (Streamlit).
- Remove obsolete scratch notes.
- Fix the 2 failing unit tests in `test_integration.py` and `test_quiz_generation.py`.

### Phase B — Compiler Backend Restructure
- Refactor `backend/services/pipeline.py` into a formal 9-stage compiler architecture.
- Adjust `compute_accessibility_score` to strictly penalize unmitigated accessibility disparities.
- Solidify multi-modal RAG and token budgeting.

### Phase C — Frontend Modularization & Component Polish
- Deconstruct `lectures/[jobId]/page.tsx` into clean, testable sub-components.
- Integrate the Persona Simulator directly into the playback toolbar.
- Enhance the Audio Description synchronization engine for zero-drift audio playback.

### Phase D — Design & Aesthetic Overhaul
- Implement rich, dark-mode glassmorphism accents, sleek typography (Inter + Outfit), smooth gradient badges, and micro-animations.
- Full right-to-left (RTL) Arabic verification with native typography.

### Phase E — Verification & Demo Polish
- Run full 308-test automated suite.
- Re-verify end-to-end processing of Arabic and English demonstration lectures.

---

## 4. Priority Matrix

| Priority | Task Description | Effort | Impact | Risk |
|---|---|:---:|:---:|:---:|
| **P0** | Consolidate 12 fragmented routes into unified Accessibility Studio | High | Critical | Low |
| **P0** | Deconstruct monolithic 1,298-line workspace into modular components | Medium | High | Low |
| **P0** | Fix 2 failing test assertions and deprecate legacy Streamlit code | Low | High | Low |
| **P1** | Fix Accessibility Scoring formula to penalize unresolved disparities | Low | High | Low |
| **P1** | Enhance Persona Simulator with live real-time simulation overlays | Medium | High | Low |
| **P2** | Polish Knowledge Graph visualization with interactive SVG node graph | Medium | Medium | Low |
| **P3** | Add exportable accessibility compliance PDF/JSON audit report download | Low | Medium | Low |

---

## 5. Exact Recommended 3–5 Minute Hackathon Demo Script

- **0:00 - 0:45 (The Problem & The Hook)**:
  - *"Educational videos are the #1 learning format today, but they are broken for disabled students. A blind student misses code written on the screen in silence. A deaf student misses explanations not shown on slides. Captions alone do not solve this."*
  - Introduce **EduAccess AI — The Accessibility Compiler for Education**.

- **0:45 - 1:45 (The Compilation & Difference Engine)**:
  - Drop a video into the Compiler.
  - Show the 9-stage compilation: Speech extracted → Visuals analyzed → Accessibility Twin built → Differences detected.
  - Highlight the **Accessibility Debt & Difference Engine**: *"At 00:14, code appeared in silence without speech explanation."*

- **1:45 - 2:45 (The Multimodal Accessible Experience)**:
  - Open the **Accessibility Studio**.
  - Toggle **Audio Description**: Video mutes original audio and plays clear, synthesized description precisely during the visual moment.
  - Toggle **"What am I Missing?"**: Shows the exact visual details never spoken by the teacher, with strict `VERIFIED` evidence trust.
  - Ask a question in Arabic: *"ما الكود المكتوب في الشاشة؟"* → Grounded answer with instant jump-to-timestamp.

- **2:45 - 3:45 (The Persona Simulator & Learning Intelligence)**:
  - Click **Persona Simulator**: Toggle *Blind Mode* → Interface adapts to audio-first screen reader view. Toggle *Deaf Mode* → High-visibility verbatim WebVTT captions + concept anchors.
  - Show **Knowledge Graph & Adaptive Quiz**: Show how mistakes in the quiz link directly back to the exact video timestamp for remediation.

- **3:45 - 4:15 (Trust, Zero-Fabrication & Impact)**:
  - Show the **Accessibility Health Report**: Every percentage is backed by verifiable counts of audio/visual/transcript segments.
  - Close with: *"EduAccess AI doesn't just add captions. It recompiles educational media so every student can learn."*
