"""Accessibility Copilot Service (Competition Differentiation Feature).

Provides a continuous, intelligent copilot that tells the learner at any playback timestamp `t`:
  - What is happening right now (speech + visual sync)
  - What educational visual content appears on screen
  - What visual information they might miss (unspoken code, diagrams, charts)
  - Active concepts and knowledge graph links
  - Next recommended action tailored to accessibility needs
"""
from __future__ import annotations

from pathlib import Path
from backend import storage, config
from backend.services import accessibility, lecture_data, audio_description, evidence


def _fmt_ts(seconds: float) -> str:
    seconds = max(0.0, float(seconds or 0.0))
    mm, ss = divmod(int(seconds), 60)
    return f"{mm:02d}:{ss:02d}"


def get_copilot_context(job_id: str, timestamp: float,
                        student_id: str = "default",
                        mode: str = "default") -> dict:
    """Generate real-time multimodal copilot briefing for playback at timestamp `t`."""
    if not storage.job_exists(job_id):
        return {
            "available": False,
            "reason": f"Lecture '{job_id}' is not processed or not found.",
            "timestamp": timestamp,
        }
    job = storage.get_job(job_id)
    if not job or not job.get("result"):
        return {
            "available": False,
            "reason": f"Lecture '{job_id}' is not processed or not found.",
            "timestamp": timestamp,
        }

    result = job["result"]
    segments = lecture_data.load_segments(job, result)
    events = lecture_data.load_visual_events(job, result)
    understanding = lecture_data.load_visual_understanding(job, result)
    profile = accessibility.load_student_profile(student_id)
    if mode and mode != "default":
        profile["accessibility_mode"] = accessibility.normalize_mode(mode)
    access_mode = profile.get("accessibility_mode", "default")

    # 1. Active speech segment at timestamp
    active_seg = None
    for s in segments:
        if float(s.get("start", 0)) <= timestamp <= float(s.get("end", 0)):
            active_seg = s
            break
    if not active_seg and segments:
        # Nearest segment within 3s
        candidates = [s for s in segments if abs(float(s.get("start", 0)) - timestamp) <= 3.0]
        if candidates:
            active_seg = candidates[0]

    # 2. Active visual event at timestamp
    active_ev = None
    for e in events:
        if float(e.get("start", 0)) <= timestamp <= float(e.get("end", 0)):
            active_ev = e
            break
    if not active_ev and events:
        candidates = [e for e in events if abs(float(e.get("start", 0)) - timestamp) <= 4.0]
        if candidates:
            active_ev = candidates[0]

    # 3. Match visual understanding record
    info = audio_description.match_understanding(understanding, timestamp - 1.0, timestamp + 1.0)

    # 4. Synthesize current situation
    vtype = str(info.get("visual_type") or (active_ev.get("type") if active_ev else "scene")).lower()
    ocr = str(info.get("ocr_text") or (active_ev.get("ocr_text") if active_ev else "")).strip()
    speech_text = str(active_seg.get("text", "")).strip() if active_seg else ""

    # 5. Determine missed visual info
    missed_info = ""
    if ocr and vtype == "code":
        missed_info = f"Code block visible on screen: {ocr[:120]}"
    elif ocr and vtype in ("diagram", "flowchart"):
        missed_info = f"Flowchart/diagram structure visible: {ocr[:100]}"
    elif ocr and vtype == "chart":
        missed_info = f"Chart data values visible: {ocr[:100]}"
    elif ocr:
        missed_info = f"On-screen text: {ocr[:100]}"

    # 6. Build Audio description cue if available
    ad_text = ""
    if active_ev:
        ad_text = audio_description.format_factual_audio_description(
            active_ev, info=info, transcript_context=speech_text, mode=access_mode
        )

    # 7. Copilot briefing summary
    time_str = _fmt_ts(timestamp)
    if speech_text and ocr:
        briefing = f"At {time_str}, the teacher explains: \"{speech_text[:100]}\" while the screen displays a {vtype}."
    elif speech_text:
        briefing = f"At {time_str}, the teacher is speaking: \"{speech_text[:120]}\"."
    elif ocr:
        briefing = f"At {time_str}, a {vtype} is visible on screen showing: '{ocr[:100]}'."
    else:
        briefing = f"At {time_str}, continuous lecture playback."

    return {
        "available": True,
        "job_id": job_id,
        "timestamp": round(timestamp, 2),
        "ts": time_str,
        "accessibility_mode": access_mode,
        "briefing": briefing,
        "current_speech": speech_text or "(No speech at this second)",
        "current_visual": {
            "type": vtype,
            "ocr_text": ocr,
            "description": active_ev.get("description", "") if active_ev else "",
            "verified": bool((info.get("trust") or {}).get("trust") == evidence.TRUST_VERIFIED),
        },
        "audio_description": ad_text,
        "potential_missed_info": missed_info or "Speech and visual content are currently aligned.",
        "active_segment_id": str(active_seg.get("id")) if active_seg else None,
        "active_event_id": str(active_ev.get("event_id")) if active_ev else None,
    }
