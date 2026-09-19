# Lecture Knowledge Graph — Evidence Report (v2.3.0)

Audit date 2026-08-31 (UTC). Part of the **Intelligent Multimodal Learning Engine**
upgrade. All concepts, links, statuses and timestamps in this report are **grounded
in real, stored evidence** (transcript segments, OCR-verified visual events, and
real quiz questions) — never invented. The no-fabrication rule that governs the
rest of the system is applied identically here.

## 1. What it is

`GET /lectures/{job_id}/knowledge-graph` (implemented in
`backend/services/knowledge_graph.py`) builds a lecture-level knowledge graph:

- **Concept nodes** — the lecturer's concepts.
- **Segment nodes** — real speech spans (with the verbatim snippet + timestamp).
- **Event nodes** — real on-screen visual events (readable OCR only, with evidence).
- **Quiz node** — a single assessment node holding every real graded question.
- **Edges** — `concept → segment` (spoken), `concept → event` (shown), `concept → quiz`
  (assessed), plus temporal `followed_by` between segments and a `next_visual`
  chain so the graph is a connected, traversable whole.

Every edge is **closed** — the `to` node id always resolves — so no edge dangles.

## 2. How concepts are discovered (lexical, evidence-grounded)

A concept enters the graph **only** if it is supported by real evidence, drawn from
three sources, in priority order:

1. **Quiz `concept` labels** — the exact labels the author attached to real
   questions (e.g. `loops`, `loops_indexing`, `general_programming`).
2. **Accessibility lesson metadata** — the `important_concepts` / `learning_objectives`
   recorded at processing time.
3. **Educational vocabulary that literally appears** in the transcript or OCR —
   matched with word boundaries so, e.g., `import` never matches inside `important`,
   `print` is a real code token on screen, etc.

What this deliberately does **not** do: guess concepts that were only ever
paraphrased, and never equated to a taught label. This is the honest upper bound
of the lexical approach (limitation #1 in the system audit).

## 3. Status model (honest)

Each concept carries a computed `status` telling you exactly what evidence exists:

| Status | Meaning |
|---|---|
| `VERIFIED` | spoken **and** shown (or spoken + assessed) with real evidence |
| `PARTIALLY_EXPLAINED` | spoken or shown, but not fully covered |
| `assessed_but_not_explained` | a quiz concept with **no** spoken/visual evidence for its exact label |
| `visual_only` / `spoken_only` | evidence in one modality only, the other unverified |
| `UNAVAILABLE` | no real evidence found (never fabricated content) |

A trust flag (`VERIFIED` / `UNCERTAIN` / `UNAVAILABLE`) is attached per evidence
link, reusing the same `TRUST_*` vocabulary as the rest of the system.

## 4. Concept ↔ speech ↔ visual mapping

`GET /lectures/{job_id}/concepts` returns, per concept, the canonical mapping:
spoken snippets (with verbatim text + timestamp), readable on-screen evidence
(with OCR text + trust), the computed `status`, and whether the concept is
`assessed` by a real question. Speech/visual links come only from stop-word-filtered
content-word overlap between the concept and real evidence — matching is reusable
across graph, gaps and agent, so they can never disagree.

## 5. Grounded example (DEMO_python_loops)

`GET /lectures/DEMO_python_loops/knowledge-graph` returns (verified this session):

- **15 concepts**, **35 nodes**, **78 edges**, all edges closed within the node set.
- Rebuilt twice → **identical** (deterministic; no random state).
- The quiz node `quiz:*` exists and all `concept → quiz` edges resolve to it.
- e.g. the concept label `while loop` maps to **5 real spoken snippets** and
  **4 visual events verified readable** → status `VERIFIED`.
- Conversely, the quiz-only labels `general_programming` and `loops_indexing` have
  no matching verbatim speech/OCR for that exact label → status
  `assessed_but_not_explained` (honest — the lecture covers the topic, but never
  states that label aloud).

## 6. Evidence & verification

- **Tests** (`tests/test_knowledge_graph.py`, 13) assert: concepts only from
  allowed sources; every edge closed; status vocabulary; speech/visual links only
  from real evidence; determinism; honest `UNKNOWN` for a nonsense concept.
- **Browser E2E** (headless Chrome, live backend + built frontend): `/knowledge-graph`
  renders the 15 concepts and their statuses, and each concept expands to a real
  **jump-to-evidence** link (deep-link `?t=<s>` verified to seek the video).
- **0 console errors** on the page.

## 7. Limitations

1. Lexical, not semantic discovery (see §2) — paraphrase-only concepts can be missed,
   and quiz-only labels are honestly flagged rather than silently "explained".
2. Vocabulary lists are English + Arabic curricula terms; other languages need their
   own vocabulary lists (structure is language-agnostic).
3. The graph describes **what evidence exists**, not a pedagogical ranking of
   importance — ranking is out of scope by design.
