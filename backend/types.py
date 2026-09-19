"""Data contracts and types for EduAccess AI.

Provides typed dataclasses for lectures, events, disparities, and evidence records
used across scoring, analysis, and verification pipelines.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass
class TranscriptSegment:
    id: str | int = ""
    start: float = 0.0
    end: float = 0.0
    text: str = ""


@dataclass
class Transcript:
    text: str = ""
    segments: list[dict | TranscriptSegment] = field(default_factory=list)
    language: str = "auto"


@dataclass
class AccessibilityEvent:
    segment_id: str | int = ""
    event_id: str = ""
    start: float = 0.0
    end: float = 0.0
    play_start: float = 0.0
    timestamp_start: float = 0.0
    timestamp_end: float = 0.0
    transcript: str = ""
    description: str = ""
    title: str = ""
    visual_type: str = "scene"
    type: str = "scene"
    should_describe: bool = False
    priority: str = "medium"
    importance: float = 0.5
    reason: str = ""
    confidence: float = 1.0
    status: str = "unresolved"
    coverage_ratio: float = 0.0
    narration_audio_path: Optional[str] = None
    interrupts_speech: bool = False
    source_refs: dict = field(default_factory=dict)
    source: list = field(default_factory=list)


@dataclass
class AccessibilityDifference:
    timestamp: float = 0.0
    timestamp_start: float = 0.0
    timestamp_end: float = 0.0
    type: str = "VISUAL_NOT_SPOKEN"
    category: str = "VISUAL_NOT_SPOKEN"
    severity: str = "MEDIUM"
    start: float = 0.0
    end: float = 0.0
    ts: str = "00:00"
    title: str = ""
    description: str = ""
    visual_evidence: str = ""
    speech_overlap: float = 0.0
    status: str = "unresolved"
    coverage_ratio: float = 0.0
    evidence: dict = field(default_factory=dict)
    fix_recommendation: str = ""


@dataclass
class EvidenceRecord:
    source_type: str = ""
    source_reference: str = ""
    timestamp: float = 0.0
    trust: str = "VERIFIED"
    excerpt: str = ""
    reason: str = ""
    confidence: float = 1.0


@dataclass
class Lecture:
    job_id: str = ""
    video_path: str = ""
    filename: str = ""
    transcript: Optional[Transcript] = None
    visual_events: list[dict | Any] = field(default_factory=list)
    ocr_events: list[dict | Any] = field(default_factory=list)
    accessibility_events: list[AccessibilityEvent] = field(default_factory=list)
    differences: list[AccessibilityDifference] = field(default_factory=list)
    evidence: list[EvidenceRecord] = field(default_factory=list)
    video_metadata: dict = field(default_factory=dict)
    status: str = "done"
    result: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)
