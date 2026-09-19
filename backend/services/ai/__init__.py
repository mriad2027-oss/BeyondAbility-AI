"""EduAccess AI Centralized AI Gateway.
Centralizes all external AI reasoning (Gemma), voice (VoxCPM), embeddings, and ASR.
"""
from backend.services.ai.hf_client import HFClient, get_hf_client, HFClientError
