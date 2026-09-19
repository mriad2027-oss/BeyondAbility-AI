"""Lecture Vector Store for EduAccess AI RAG System.

Stores and indexes multimodal lecture chunks for high-speed, bounded retrieval.
Persists index artifacts to `data/outputs/<stem>_rag_index.json` to prevent
recomputing embeddings repeatedly.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from backend import config
from backend.services.ai.embeddings_service import get_embeddings_service

logger = logging.getLogger("eduaccess.ai.rag.store")


class LectureVectorStore:
    """Index and storage for a lecture's multimodal chunks."""

    def __init__(self, job_id: str, video_stem: str):
        self.job_id = job_id
        self.video_stem = video_stem
        self.index_path = config.OUTPUTS_DIR / f"{video_stem}_rag_index.json"
        self.chunks: list[dict[str, Any]] = []
        self.embeddings: list[list[float]] = []
        self.embedder = get_embeddings_service()
        self._load_existing()

    def _load_existing(self) -> bool:
        if self.index_path.exists():
            try:
                data = json.loads(self.index_path.read_text(encoding="utf-8"))
                self.chunks = data.get("chunks", [])
                self.embeddings = data.get("embeddings", [])
                if self.chunks and len(self.chunks) == len(self.embeddings):
                    logger.debug(f"Loaded existing RAG index for {self.video_stem} ({len(self.chunks)} chunks).")
                    return True
            except Exception as e:
                logger.warning(f"Failed to read existing RAG index: {e}")
        return False

    def build_and_save(self, chunks: list[dict[str, Any]]) -> None:
        """Compute embeddings for chunks and persist to disk."""
        if not chunks:
            self.chunks = []
            self.embeddings = []
            return

        self.chunks = chunks
        texts = [c["text"] for c in chunks]
        self.embeddings = self.embedder.embed_batch(texts)

        payload = {
            "job_id": self.job_id,
            "video_stem": self.video_stem,
            "total_chunks": len(self.chunks),
            "chunks": self.chunks,
            "embeddings": self.embeddings,
        }
        self.index_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(f"Persisted RAG index for {self.video_stem} ({len(chunks)} chunks) to {self.index_path.name}.")

    def search(self, query: str, top_k: int = 5, min_score: float = 0.15) -> list[tuple[dict[str, Any], float]]:
        """Semantic search returning top matching chunks with similarity scores."""
        if not self.chunks or not self.embeddings:
            return []

        query_vec = self.embedder.embed_text(query)
        scored: list[tuple[dict[str, Any], float]] = []

        for chunk, emb in zip(self.chunks, self.embeddings):
            score = self.embedder.cosine_similarity(query_vec, emb)
            if score >= min_score:
                scored.append((chunk, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]


# Registry of in-memory vector stores
_stores: dict[str, LectureVectorStore] = {}

def get_vector_store(job_id: str, video_stem: str) -> LectureVectorStore:
    key = f"{job_id}:{video_stem}"
    if key not in _stores:
        _stores[key] = LectureVectorStore(job_id, video_stem)
    return _stores[key]
