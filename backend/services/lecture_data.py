"""Shared lecture-data loaders (grounding layer).

Both the HTTP routes and the Ask-the-Video service need transcript segments and
visual events. A lecture's `result` blob may omit them (jobs persisted before a
feature shipped), so every loader falls back to the on-disk artifacts written by
the pipeline (*_segments.json, *_visual_events.json). This keeps Ask-the-Video
and "What am I missing?" grounded for *any* job, old or new.
"""
from __future__ import annotations

import json
from pathlib import Path

from backend import config


def _stem(job: dict) -> str:
    return Path(job.get("video_path", "")).stem


def load_segments(job: dict, result: dict) -> list[dict]:
    segments = (result or {}).get("segments") or (result or {}).get("transcript", {}).get("segments", [])
    if not segments:
        seg_file = config.OUTPUTS_DIR / f"{_stem(job)}_segments.json"
        if seg_file.exists():
            try:
                segments = json.loads(seg_file.read_text(encoding="utf-8")).get("segments", [])
            except Exception:
                segments = []
    return segments or []


def load_visual_events(job: dict, result: dict) -> list[dict]:
    events = (result or {}).get("visual_events") or (result or {}).get("events", [])
    if not events:
        events_file = config.OUTPUTS_DIR / f"{_stem(job)}_visual_events.json"
        if events_file.exists():
            try:
                events = json.loads(events_file.read_text(encoding="utf-8")).get("events", [])
            except Exception:
                events = []
    return events or []


def load_visual_understanding(job: dict, result: dict) -> list[dict]:
    """Load the evidence-grounded visual understanding records.

    Falls back to the on-disk *_visual_understanding.json artifact so newer
    API consumers work for older jobs too (honest: empty list when absent).
    """
    records = (result or {}).get("visual_understanding", [])
    if not records:
        vu_file = config.OUTPUTS_DIR / f"{_stem(job)}_visual_understanding.json"
        if vu_file.exists():
            try:
                loaded = json.loads(vu_file.read_text(encoding="utf-8"))
                records = loaded.get("records", []) if isinstance(loaded, dict) else loaded
            except Exception:
                records = []
    return records or []