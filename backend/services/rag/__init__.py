"""EduAccess AI Multimodal RAG Engine.
Handles chunking, embedding, vector storage, and bounded retrieval for lecture Q&A.
"""
from backend.services.rag.chunker import chunk_lecture_data
from backend.services.rag.vector_store import LectureVectorStore, get_vector_store
from backend.services.rag.retriever import LectureRetriever, get_retriever
