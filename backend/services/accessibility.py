"""Accessibility intelligence: grounded, profile-aware audio/vision fusion.

All functions are deterministic and offline-safe.  They accept the legacy Person 3
visual-event shape and add metadata rather than changing it.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable

from backend import config

MODES = {"blind", "low_vision", "deaf", "hard_of_hearing", "cognitive_support", "default"}
_MODE_ALIASES = {
    "visual": "blind", "vision": "blind", "hearing": "deaf", "cognitive": "cognitive_support",
    "none": "default", "general": "default", "": "default",
}
_TYPE_BASE = {"code": .90, "diagram": .85, "chart": .85, "table": .80,
              "whiteboard": .75, "interface": .70, "demonstration": .65,
              "slide": .60, "formula": .85, "person": .40, "scene": .30, "other": .25}
_EDUCATIONAL_WORDS = {
    "code", "variable", "loop", "for", "while", "function", "class", "array", "list", "stack",
    "queue", "diagram", "chart", "table", "formula", "equation", "example", "definition",
    "متغير", "حلقة", "دالة", "مصفوفة", "مكدس", "طابور", "مثال", "معادلة",
}


def _text(value) -> str:
    return str(value or "").strip()


def normalize_mode(mode: str | None) -> str:
    value = _text(mode).lower().replace("-", "_").replace(" ", "_")
    value = _MODE_ALIASES.get(value, value)
    return value if value in MODES else "default"


def get_default_profile(student_id: str = "default") -> dict:
    return {"id": str(student_id or "default"), "accessibility_need": "none", "preferred_output": "both",
            "accessibility_mode": "default", "speech_rate": 1.0, "description_detail": "medium",
            "quiz_difficulty": "adaptive", "language": "auto"}


def load_student_profile(student_id: str = "default") -> dict:
    """Load both the original profile schema and the newer additive schema."""
    default = get_default_profile(student_id)
    if not student_id:
        return default
    path = config.STUDENTS_DIR / "profiles.json"
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        records = raw if isinstance(raw, list) else raw.get("profiles", [])
        for record in records:
            if str(record.get("id", record.get("student_id", ""))) != str(student_id):
                continue
            profile = {**default, **record}
            mode = record.get("accessibility_mode") or record.get("mode")
            if not mode:
                mode = _MODE_ALIASES.get(_text(record.get("accessibility_need")).lower(), "default")
            profile["accessibility_mode"] = normalize_mode(mode)
            profile["id"] = str(profile.get("id", student_id))
            profile["speech_rate"] = max(.5, min(2.0, float(profile.get("speech_rate", 1.0))))
            return profile
    except (OSError, ValueError, TypeError):
        pass
    return default


def calculate_visual_importance(event: dict, previous_event: dict | None = None) -> float:
    """Transparent 0..1 importance heuristic: education, novelty, confidence, silence."""
    kind = _text(event.get("type", "other")).lower()
    confidence = max(0.0, min(1.0, float(event.get("confidence", 1.0) or 0.0)))
    description = _text(event.get("description"))
    transcript = _text(event.get("transcript_context"))
    base = _TYPE_BASE.get(kind, .25)
    educational = 0.10 if any(word in (description + " " + transcript).lower() for word in _EDUCATIONAL_WORDS) else 0.0
    silent_bonus = .08 if not transcript else 0.0
    novelty = .12 if previous_event is None or _text(previous_event.get("description")) != description else -.18
    score = (base + educational + silent_bonus + novelty) * (.65 + .35 * confidence)
    return round(max(0.0, min(1.0, score)), 2)


def _priority(score: float) -> str:
    return "critical" if score >= .85 else "high" if score >= .65 else "medium" if score >= .4 else "low"


def should_describe_event(event: dict, mode: str = "default", previous_event: dict | None = None) -> dict:
    score = calculate_visual_importance(event, previous_event)
    mode = normalize_mode(mode)
    kind = _text(event.get("type", "other")).lower()
    speech = _text(event.get("transcript_context"))
    repeated = previous_event is not None and _text(previous_event.get("description")) == _text(event.get("description"))
    visual_types = {"code", "diagram", "chart", "table", "formula", "whiteboard", "interface", "slide"}
    if repeated:
        return {"should_describe": False, "reason": "Repeated visual event; no new information", "priority": "low", "importance": score}
    if mode in {"deaf", "hard_of_hearing"}:
        keep = kind in visual_types and not speech and score >= .5
        reason = "Silent educational visual context adds value to captions" if keep else "Captions already provide the spoken information"
    elif mode == "cognitive_support":
        keep = score >= .58
        reason = "High-value visual concept selected for concise cognitive support" if keep else "Minor visual detail skipped"
    elif mode == "low_vision":
        keep = kind in visual_types or score >= .55
        reason = "Educational text/layout/highlight prioritized for low vision" if keep else "Low-value visual detail skipped"
    else:
        keep = kind in visual_types or score >= .48
        reason = "Important visual information not safely covered by speech" if keep else "Visual information is minor or overlaps speech"
    return {"should_describe": bool(keep), "reason": reason, "priority": _priority(score), "importance": score}


def _overlap(a: str, b: str) -> bool:
    aw = {w for w in re.findall(r"[\w\u0600-\u06ff]+", a.lower()) if len(w) > 2}
    bw = {w for w in re.findall(r"[\w\u0600-\u06ff]+", b.lower()) if len(w) > 2}
    return bool(aw and bw and len(aw & bw) / max(1, min(len(aw), len(bw))) >= .72)


def _safe_description(event: dict, mode: str, previous_description: str = "") -> str:
    """Return factual, grounded description; never infer identities or unreadable details."""
    from backend.services import audio_description
    description = _text(event.get("description"))
    if not description or "unavailable" in description.lower() or "no readable" in description.lower():
        return "The visual information is unclear." if mode in {"blind", "low_vision"} else ""
    if previous_description and _overlap(description, previous_description):
        return ""
    
    # Use factual Audio Description formatter
    formatted = audio_description.format_factual_audio_description(event, mode=mode)
    if previous_description and _overlap(formatted, previous_description):
        return ""
    return formatted


def normalize_visual_events(events: Iterable[dict], job_id: str = "") -> list[dict]:
    normalized = []
    for i, raw in enumerate(events or []):
        event = dict(raw)
        start = float(event.get("start", event.get("timestamp", 0.0)) or 0.0)
        end = float(event.get("end", start) or start)
        event.setdefault("start", start); event.setdefault("end", max(start, end))
        event.setdefault("timestamp", start)
        event.setdefault("event_id", f"event_{i+1:03d}")
        event.setdefault("confidence", 1.0)
        event.setdefault("source_frames", [])
        event.setdefault("transcript_context", "")
        event.setdefault("description", "")
        event["source_refs"] = {"visual_events": [event["event_id"]], "transcript_segments": event.get("transcript_segments", [])}
        normalized.append(event)
    return sorted(normalized, key=lambda e: (e["start"], e["end"]))


def _segment_refs(segment: dict, index: int) -> list[str]:
    return [str(segment.get("id", f"seg_{index+1:03d}"))]


def _event_for_segment(events: list[dict], segment: dict) -> dict | None:
    mid = (float(segment.get("start", 0)) + float(segment.get("end", 0))) / 2
    overlapping = [e for e in events if e["start"] < float(segment.get("end", 0)) and e["end"] > float(segment.get("start", 0))]
    return overlapping[0] if overlapping else (min(events, key=lambda e: abs(e["start"] - mid)) if events else None)


def estimate_speech_duration(text: str, rate: float = 1.0) -> float:
    """Estimate how long it takes to speak the text based on average reading speed."""
    words = len(text.split())
    # 150 words per minute = 2.5 words per second
    wps = 2.5 * rate
    return words / wps if wps > 0 else 0.0


def build_accessibility_segments(segments: list[dict], events: list[dict], profile: dict | None = None) -> list[dict]:
    profile = profile or get_default_profile()
    mode = normalize_mode(profile.get("accessibility_mode"))
    speech_rate = float(profile.get("speech_rate", 1.0) or 1.0)
    events = normalize_visual_events(events)
    output = []
    previous_event = None
    previous_description = ""
    
    for index, segment in enumerate(segments or []):
        event = _event_for_segment(events, segment)
        if not event:
            continue
            
        # Look ahead for next event context
        next_event = None
        if event in events:
            idx = events.index(event)
            if idx + 1 < len(events):
                next_event = events[idx + 1]
        next_event_desc = next_event.get("description", "") if next_event else ""

        decision = should_describe_event(event, mode, previous_event)
        
        speech_start, speech_end = float(segment.get("start", 0)), float(segment.get("end", 0))
        next_speech_start = float(segments[index + 1].get("start", speech_end)) if index + 1 < len(segments) else speech_end + 10.0
        available_pause = next_speech_start - speech_end
        
        visual = ""
        interrupts_speech = False
        
        if decision["should_describe"]:
            from backend.services import llm
            visual = llm.generate_personalized_description(event, _text(segment.get("text")), mode, previous_description, next_event_desc)
            
            if visual and _overlap(visual, _text(segment.get("text"))):
                visual = ""
                decision = {**decision, "should_describe": False, "reason": "Visual wording overlaps the teacher transcript"}
            
            if visual:
                est_duration = estimate_speech_duration(visual, speech_rate)
                if est_duration > available_pause:
                    if decision["priority"] in ("critical", "high"):
                        interrupts_speech = True
                    elif decision["priority"] == "medium":
                        if est_duration > available_pause * 2.0:
                            visual = ""
                            decision = {**decision, "should_describe": False, "reason": "Skipped to avoid major interruption of teacher speech (medium priority)"}
                        else:
                            interrupts_speech = True
                    else:
                        visual = ""
                        decision = {**decision, "should_describe": False, "reason": "Skipped to avoid interrupting teacher speech (low priority)"}

        play_start = speech_end if visual else speech_end
        
        item = {
            "segment_id": str(segment.get("id", f"seg_{index+1:03d}")),
            "start": speech_start, "end": speech_end,
            "play_start": round(play_start, 3), "transcript": _text(segment.get("text")),
            "description": visual, "should_describe": bool(visual),
            "priority": decision["priority"], "importance": decision["importance"],
            "reason": decision["reason"], "confidence": float(event.get("confidence", 1.0) or 0.0),
            "interrupts_speech": interrupts_speech,
            "source_refs": {"transcript_segments": _segment_refs(segment, index), "visual_events": [event["event_id"]]},
            "source": ["visual_event", "transcript"],
        }
        output.append(item)
        if visual: previous_description = visual
        previous_event = event
    return output


def captions_from_segments(segments: list[dict]) -> list[dict]:
    return [{"id": str(s.get("id", i + 1)), "start": float(s.get("start", 0)), "end": float(s.get("end", 0)), "text": _text(s.get("text"))}
            for i, s in enumerate(segments or [])]


def captions_vtt(captions: list[dict]) -> str:
    def stamp(value):
        value = max(0.0, float(value)); h, rem = divmod(value, 3600); m, sec = divmod(rem, 60)
        return f"{int(h):02d}:{int(m):02d}:{sec:06.3f}"
    return "WEBVTT\n\n" + "\n\n".join(f"{c['id']}\n{stamp(c['start'])} --> {stamp(c['end'])}\n{c['text']}" for c in captions)


def quality_score(segments: list[dict], events: list[dict]) -> int:
    if not segments and not events: return 0
    described = [s for s in segments if s.get("description")]
    grounded = sum(bool(s.get("source_refs")) for s in described) / max(1, len(described))
    confidence = sum(float(s.get("confidence", 0)) for s in described) / max(1, len(described))
    redundancy = len(described) - len({s.get("description") for s in described})
    clarity = sum(1 for s in described if 3 <= len(s.get("description", "").split()) <= 45) / max(1, len(described))
    value = sum(float(s.get("importance", 0)) for s in described) / max(1, len(described))
    score = 100 * (.30 * grounded + .20 * confidence + .20 * clarity + .30 * value) - min(20, redundancy * 5)
    return int(round(max(0, min(100, score))))


def build_accessibility_content(job_id: str, transcript: str, segments: list[dict], events: list[dict], profile: dict | None = None, quiz_reference: str | None = None) -> dict:
    profile = profile or get_default_profile()
    normalized = normalize_visual_events(events, job_id)
    access = build_accessibility_segments(segments, normalized, profile)
    concepts = sorted({w.lower() for e in normalized for w in _EDUCATIONAL_WORDS if w.lower() in _text(e.get("description")).lower() + _text(e.get("transcript_context")).lower()})
    important = [s for s in access if s.get("should_describe")]
    durations = sum(max(0.0, s["end"] - s["start"]) for s in important)
    return {
        "schema_version": "person4.v1", "job_id": job_id, "accessibility_profile": profile,
        "language": "ar" if any("\u0600" <= c <= "\u06ff" for c in transcript) else "en",
        "summary": _text(transcript)[:500], "learning_objectives": concepts[:10],
        "important_concepts": concepts, "visual_events": normalized, "accessibility_events": access,
        "captions": captions_from_segments(segments), "quiz_reference": quiz_reference,
        "quality_score": quality_score(access, normalized),
        "metrics": {"visual_events_detected": len(normalized), "descriptions_generated": len(important),
                    "redundant_descriptions_removed": max(0, len(access) - len(important)),
                    "important_visual_events_preserved": len(important),
                    "estimated_visual_information_coverage": round(min(1.0, durations / max(1.0, sum(max(0, float(s.get("end", 0))-float(s.get("start", 0))) for s in segments))), 2)},
    }
