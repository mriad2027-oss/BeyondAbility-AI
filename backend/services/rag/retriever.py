"""Hybrid Retriever & QA Engine for EduAccess AI RAG System.

Combines semantic similarity and lexical keyword matching to retrieve top-k chunks,
enforcing strict token budgeting and repeat-question caching.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any

from backend import config
from backend.services.ai.gemma_service import get_gemma_service
from backend.services.rag.vector_store import get_vector_store
from backend.services.ask import content_words

logger = logging.getLogger("eduaccess.ai.rag.retriever")

# In-memory QA response cache to optimize tokens and eliminate repeat calls
_qa_response_cache: dict[str, dict[str, Any]] = {}


class LectureRetriever:
    """Retrieves relevant lecture chunks and generates grounded answers."""

    def __init__(self, job_id: str, video_stem: str):
        self.job_id = job_id
        self.video_stem = video_stem
        self.vector_store = get_vector_store(job_id, video_stem)
        self.gemma = get_gemma_service()

    def retrieve(self, query: str, top_k: int | None = None) -> list[dict[str, Any]]:
        """Perform hybrid retrieval (semantic + lexical overlap)."""
        limit = top_k or config.MAX_RAG_CHUNKS

        # 1. Semantic search
        semantic_results = self.vector_store.search(query, top_k=limit * 2)
        q_words = content_words(query)

        scored_chunks: list[tuple[dict[str, Any], float]] = []
        seen_ids = set()

        for chunk, sem_score in semantic_results:
            cid = chunk.get("chunk_id")
            if cid in seen_ids:
                continue
            seen_ids.add(cid)

            # 2. Lexical boost
            chunk_words = content_words(chunk.get("text", ""))
            overlap = len(q_words.intersection(chunk_words))
            lex_score = min(overlap * 0.15, 0.45)

            total_score = sem_score + lex_score
            scored_chunks.append((chunk, total_score))

        # Also search purely lexical if semantic missed key exact keywords
        if len(scored_chunks) < limit:
            for chunk in self.vector_store.chunks:
                cid = chunk.get("chunk_id")
                if cid in seen_ids:
                    continue
                chunk_words = content_words(chunk.get("text", ""))
                overlap = len(q_words.intersection(chunk_words))
                if overlap > 0:
                    score = overlap * 0.2
                    scored_chunks.append((chunk, score))
                    seen_ids.add(cid)

        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        top = [item[0] for item in scored_chunks[:limit]]
        return top

    def answer_question(self, question: str, timestamp_hint: float | None = None) -> dict[str, Any]:
        """Answer a student's question grounded strictly in retrieved chunks."""
        clean_q = question.strip()
        if not clean_q:
            return {"answer": "Please provide a question about the lecture.", "evidence": [], "cached": False}

        # 1. Check response cache
        cache_key = hashlib.sha256(f"{self.job_id}:{clean_q.lower()}".encode("utf-8")).hexdigest()
        if cache_key in _qa_response_cache:
            logger.info(f"RAG Cache HIT for '{clean_q[:40]}...'")
            cached = dict(_qa_response_cache[cache_key])
            cached["cached"] = True
            return cached

        # 2. Retrieve bounded evidence
        retrieved = self.retrieve(clean_q, top_k=config.MAX_RAG_CHUNKS)

        if not retrieved:
            ans = "I could not find verified evidence in this lecture to answer that question."
            result = {
                "answer": ans,
                "evidence": [],
                "trust": "UNAVAILABLE",
                "cached": False,
            }
            _qa_response_cache[cache_key] = result
            return result

        # 3. Format bounded context (never exceeding MAX_CONTEXT_CHARS)
        context_blocks = []
        total_chars = 0
        max_chars = config.MAX_CONTEXT_CHARS

        for chunk in retrieved:
            block = f"{chunk.get('timestamp_label', '')} {chunk.get('text', '')}"
            if total_chars + len(block) > max_chars:
                break
            context_blocks.append(block)
            total_chars += len(block)

        context_str = "\n---\n".join(context_blocks)

        prompt = (
            f"Lecture Evidence:\n{context_str}\n\n"
            f"Question: {clean_q}\n"
        )
        if timestamp_hint is not None:
            prompt += f"(Student is currently at lecture time {timestamp_hint:.1f}s)\n"

        prompt += "\nProvide a clear, accurate, and concise answer citing the evidence timestamps where helpful."

        # 4. Generate answer with Gemma
        answer_text = self.gemma.generate(prompt, max_new_tokens=350)

        # 5. Format evidence provenance
        evidence_list = [
            {
                "chunk_id": c.get("chunk_id"),
                "source_type": c.get("source_type"),
                "timestamp_label": c.get("timestamp_label"),
                "start": c.get("start"),
                "end": c.get("end"),
                "snippet": c.get("text", "")[:150],
            }
            for c in retrieved[:4]
        ]

        result = {
            "answer": answer_text,
            "evidence": evidence_list,
            "trust": "SUPPORTED" if retrieved else "UNAVAILABLE",
            "cached": False,
        }

        # Cache response
        _qa_response_cache[cache_key] = result
        return result


_retrievers: dict[str, LectureRetriever] = {}

def get_retriever(job_id: str, video_stem: str) -> LectureRetriever:
    key = f"{job_id}:{video_stem}"
    if key not in _retrievers:
        _retrievers[key] = LectureRetriever(job_id, video_stem)
    return _retrievers[key]
