# EduAccess AI — Complete Repository & Project Structure Inventory

## Executive Overview
EduAccess AI is positioned as **"The Accessibility Compiler for Education"**, converting educational video lectures into multi-modal accessible learning twins (captions, synchronized audio descriptions, visual understanding, grounded Q&A, knowledge graphs, and personalized learning adaptations).

This inventory details every folder, active service, deprecated asset, and data artifact present in the codebase.

---

## 1. Top-Level Directory Structure

```
EduAccess-AI/
├── .env.example                     # Environment template (HF tokens, Whisper model, vision/TTS providers)
├── .gitignore                       # Git ignore configuration
├── README.md                        # Project documentation and feature overview
├── requirements.txt                 # Backend Python dependencies
├── backend/                         # FastAPI application, AI services, RAG, knowledge graph, storage
│   ├── config.py                    # Central configuration and environment loader
│   ├── main.py                      # FastAPI entrypoint and static mounts
│   ├── observability.py             # Pipeline StageTimer and stage logging
│   ├── storage.py                   # File-based job storage and metadata management
│   ├── models/                      # Pydantic data schemas
│   │   └── schemas.py               # Request/response validation models
│   ├── routes/                      # API route handlers
│   │   ├── analytics.py             # Accessibility score, debt, health, differences, simulator, copilot
│   │   ├── assistant.py             # Global Assistant (chat, stream SSE, tools)
│   │   ├── learning.py              # Knowledge graph, concept mapping, learning gaps, agent
│   │   ├── process.py               # Video processing, results, timeline, missing, AD, evidence, transcript, ask
│   │   ├── quiz.py                  # Quiz retrieval and grading submission
│   │   ├── student.py               # Student profiles, history, and progress
│   │   └── upload.py                # Video upload, chunking, and content-hash caching
│   ├── services/                    # Core business logic and algorithmic modules
│   │   ├── accessibility.py         # Accessibility profile adaptation and minimax representation
│   │   ├── accessibility_engine.py  # Difference engine, debt calculator, timeline matrix, simulator
│   │   ├── accessibility_score.py   # Deterministic coverage scoring, lecture health, reports, metrics
│   │   ├── ask.py                   # Grounded Ask-the-Video Q&A with evidence verification
│   │   ├── audio_description.py     # Synchronized audio description cue builder and factual describer
│   │   ├── concept_mapping.py       # Concept to speech/visual evidence alignment
│   │   ├── copilot.py               # Real-time copilot context generator
│   │   ├── evidence.py              # Evidence verification, trust levels (VERIFIED/UNCERTAIN/UNAVAILABLE)
│   │   ├── knowledge_graph.py       # Knowledge graph construction from transcript, OCR, and concepts
│   │   ├── learning_agent.py        # Personalized learning agent and next-best-action generator
│   │   ├── learning_gaps.py         # Cross-modal explanation gap detector
│   │   ├── lecture_data.py          # Unified data loader for lecture artifacts
│   │   ├── llm.py                   # Multi-provider LLM gateway (Gemma, OpenAI, Anthropic, offline template)
│   │   ├── pipeline.py              # Main multi-stage processing pipeline orchestrator
│   │   ├── progress.py              # Student learning progress rollup
│   │   ├── quiz.py                  # Quiz grading with semantic matching and student history tracking
│   │   ├── quiz_generator.py        # Grounded quiz generation via Gemma / offline fallback
│   │   ├── speech.py                # Speech-to-text via OpenAI Whisper (Arabic-first, forced language)
│   │   ├── tts.py                   # Local text-to-speech fallback (pyttsx3/OpenAI) and audio mixing
│   │   ├── video.py                 # Video audio extraction, metadata probe, frame extraction (OpenCV)
│   │   ├── vision.py                # Vision description router (HF/Gemma/OpenAI/Anthropic/Tesseract OCR)
│   │   ├── visual_companion.py      # Visual event analyzer and "What am I missing?" builder
│   │   ├── visual_understanding.py  # Structured visual classification (code, diagram, flowchart, chart, etc.)
│   │   ├── ai/                      # Centralized Hugging Face Cloud AI Services
│   │   │   ├── asr_service.py       # Automatic Speech Recognition cloud gateway
│   │   │   ├── embeddings_service.py# Text embeddings service for semantic search
│   │   │   ├── gemma_service.py     # Gemma reasoning, summarization, AD text, quiz generator
│   │   │   ├── hf_client.py         # HTTP client for Hugging Face Inference API / router
│   │   │   ├── vision_service.py    # Cloud Vision model integration
│   │   │   └── voxcpm_service.py    # VoxCPM cloud text-to-speech with hash caching
│   │   ├── assistant/               # Global Assistant Agent
│   │   │   ├── orchestrator.py      # Conversational orchestrator, context binder, tool dispatcher
│   │   │   └── tools.py             # Safe whitelisted UI navigation and player tools
│   │   └── rag/                     # Multimodal Retrieval Augmented Generation
│   │       ├── chunker.py           # Multi-source chunking (speech, visual events, OCR, concepts)
│   │       ├── retriever.py         # Grounded evidence retriever with token budgeting
│   │       └── vector_store.py      # Lightweight cosine-similarity vector store
│   └── scripts/                     # Utility scripts
│       ├── make_demo_lecture.py     # Script to generate synthetic demo lecture fixtures
│       └── smoke_hf_cloud.py        # Hugging Face Cloud connectivity verification script
├── frontend/                        # Frontend UI implementations
│   ├── app.py                       # [DEPRECATED / LEGACY] Streamlit prototype (1,486 lines)
│   └── next-app/                    # [ACTIVE] Next.js 15.5 App Router Web Application
│       ├── package.json             # Next 15, React 19, TailwindCSS, Recharts, Lucide-React
│       ├── tailwind.config.ts       # Design tokens, color palette, animations
│       ├── app/                     # App Router pages and layouts
│       │   ├── layout.tsx           # Root layout with Inter font and AppShell
│       │   ├── page.tsx             # Home dashboard with lecture selector, score cards, pillars
│       │   ├── agent/page.tsx       # Personal Learning Agent & concept explanation
│       │   ├── ask/page.tsx         # Dedicated grounded Q&A with evidence timeline
│       │   ├── audio/page.tsx       # Dedicated Audio Description listening station
│       │   ├── knowledge-graph/page.tsx # Interactive Knowledge Graph visualization
│       │   ├── learning-gaps/page.tsx   # Cross-modal learning gap analysis
│       │   ├── lectures/page.tsx    # Processed lecture library catalog
│       │   ├── lectures/[jobId]/page.tsx# Comprehensive Lecture Workspace (Video, AD sync, OCR, Missing, Ask)
│       │   ├── missing/page.tsx     # "What am I missing?" visual gap inspector
│       │   ├── progress/page.tsx    # Student mastery analytics and Next Best Action
│       │   ├── quiz/page.tsx        # Interactive adaptive quiz and real-time grading
│       │   ├── report/page.tsx      # Comprehensive Lecture Accessibility Report
│       │   ├── settings/page.tsx    # Student profile and accessibility preferences
│       │   ├── timeline/page.tsx    # Modal visual & speech timeline
│       │   └── upload/page.tsx      # Video drag-and-drop upload and real-time pipeline status
│       ├── components/              # Reusable UI and domain components
│       │   ├── accessibility/       # AccessibilityToolbar (contrast, text size, screen reader mode)
│       │   ├── assistant/           # GlobalAssistant (floating chat, speech rec, voice output)
│       │   ├── layout/              # AppShell, Navigation Sidebar, RTL toggles
│       │   ├── lecture/             # LecturePicker, TrustLegend, WorkspaceProvider
│       │   ├── ui/                  # Badge, Button, Card, Loading, ScoreRing, TrustBadge
│       │   └── video/               # VideoPlayer (custom controls, WebVTT captions, seek API)
│       ├── lib/                     # Client utilities
│       │   ├── api.ts               # Complete typed backend API client with SSE streaming
│       │   └── format.ts            # Timestamp formatting, duration, trust helpers
│       └── types/                   # TypeScript type definitions
│           └── backend.ts           # Strict typings matching all FastAPI backend schemas
├── data/                            # Persistent file-based data storage
│   ├── audio/                       # Extracted audio WAV files
│   ├── demo/                        # Pre-packaged demo data and script fixtures
│   ├── frames/                      # Sampled keyframes extracted from videos
│   ├── hashes/                      # Content-addressable SHA-256 cache files for instant deduplication
│   ├── jobs/                        # Per-job JSON state files (status, progress, result)
│   ├── logs/                        # Server and stage execution logs
│   ├── outputs/                     # Generated transcripts, SRTs, VTTs, JSON analysis, narration audio
│   ├── quizzes/                     # Generated quiz JSON files
│   ├── students/                    # Student profile configs and history JSON files
│   └── videos/                      # Uploaded video files
├── docs/                            # Architectural documentation & technical audit reports
└── tests/                           # Pytest comprehensive test suite (308 unit and integration tests)
```

---

## 2. Directory Assessment: Keep, Rebuild, Merge, or Deprecate

| Directory / File | Status | Technical Role | Recommendation |
|---|---|---|---|
| `backend/main.py`, `backend/config.py` | Active | Core API configuration & routing | **KEEP & REFACTOR**: Streamline route grouping under compiler architecture. |
| `backend/services/ai/*` | Active | Centralized Hugging Face Cloud Inference (Gemma, VoxCPM) | **KEEP**: Centralized AI gateway with graceful fallbacks. |
| `backend/services/accessibility_engine.py` | Active | Multimodal difference detection, debt, simulator | **KEEP**: Core algorithmic foundation for the Accessibility Compiler. |
| `backend/services/visual_understanding.py` | Active | Structured visual classification (code, chart, formula) | **KEEP**: Core visual intelligence parser. |
| `backend/services/ask.py` | Active | Grounded Q&A with trust scoring | **KEEP**: High-quality evidence retrieval and strict hallucination prevention. |
| `backend/services/pipeline.py` | Active | Pipeline orchestrator | **REBUILD**: Refactor into a clean 9-stage Accessibility Compiler pipeline. |
| `frontend/app.py` | Deprecated | Legacy Streamlit frontend (1,486 lines) | **DEPRECATE / REMOVE**: Next.js 15 is the superior production interface. |
| `frontend/next-app/app/lectures/[jobId]/page.tsx` | Active | Monolithic workspace page (1,298 lines) | **REBUILD / MODULARIZE**: Split into dedicated compiler & studio tabs/components. |
| `frontend/next-app/app/*` (12 routes) | Active | Distributed standalone pages | **MERGE**: Consolidate fragmented routes into 4-5 focused macro-views. |
