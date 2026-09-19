"""Priority 4 analytics + transparency routes (Features #2 #3 #5 #10 #11).

All additive: new GET endpoints only, built strictly from stored evidence.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend import storage
from backend.services import evidence, lecture_data, visual_companion
from backend.services import accessibility_score

router = APIRouter()


def _require_job(job_id: str) -> dict:
    if not storage.job_exists(job_id):
        raise HTTPException(status_code=404, detail="job_id not found. Upload a video first.")
    return storage.get_job(job_id)


def _load_analysis(job: dict, events: list[dict]) -> list[dict]:
    result = job.get("result") or {}
    analysis = result.get("visual_analysis") or []
    if not analysis and events:
        metadata = result.get("video_metadata") or {}
        analysis = visual_companion.analyze_visual_events(events,
                                                          lecture_data.load_segments(job, result),
                                                          metadata, job.get("job_id", ""))
    return analysis or []


@router.get("/lectures/{job_id}/accessibility-score")
async def get_accessibility_score(job_id: str):
    """Transparent Accessibility Coverage Score (Feature #1)."""
    job = _require_job(job_id)
    return accessibility_score.compute_accessibility_score(job)


@router.get("/lectures/{job_id}/health-score")
async def get_lecture_health_score(job_id: str):
    """Multimodal Lecture Health Score (Phase 8 Competition Differentiator)."""
    job = _require_job(job_id)
    return accessibility_score.compute_lecture_health_score(job)


@router.get("/lectures/{job_id}/differences")
async def get_accessibility_differences(job_id: str):
    """Accessibility Difference Engine: Speech vs Visuals mismatch detection."""
    from backend.services import accessibility_engine, lecture_data, visual_companion
    job = _require_job(job_id)
    result = job.get("result") or {}
    segments = lecture_data.load_segments(job, result)
    events = lecture_data.load_visual_events(job, result)
    analysis = result.get("visual_analysis") or []
    if not analysis and events:
        meta = result.get("video_metadata") or {}
        analysis = visual_companion.analyze_visual_events(events, segments, meta, job_id)
    return {
        "job_id": job_id,
        "differences": accessibility_engine.detect_accessibility_differences(segments, events, analysis),
    }


@router.get("/lectures/{job_id}/debt")
async def get_accessibility_debt(job_id: str):
    """Accessibility Debt: 0-100 debt metric and itemized remediation backlog."""
    from backend.services import accessibility_engine
    job = _require_job(job_id)
    return accessibility_engine.calculate_accessibility_debt(job)


@router.get("/lectures/{job_id}/timeline-matrix")
async def get_timeline_matrix(job_id: str):
    """Modal Accessibility Matrix Timeline (Speech, Visual, OCR, Description, Quiz)."""
    from backend.services import accessibility_engine
    job = _require_job(job_id)
    return {
        "job_id": job_id,
        "timeline": accessibility_engine.generate_accessibility_timeline(job),
    }


@router.get("/lectures/{job_id}/simulator")
async def get_accessibility_simulator(job_id: str, mode: str = Query("blind")):
    """Accessibility Simulator for 5 learner personas (blind, low-vision, deaf, cognitive, standard)."""
    from backend.services import accessibility_engine
    job = _require_job(job_id)
    return accessibility_engine.simulate_learner_experience(job, mode=mode)


@router.post("/lectures/{job_id}/make-accessible")
async def make_video_accessible(job_id: str):
    """One-click complete accessible lecture bundle generator."""
    from backend.services import accessibility_engine
    _require_job(job_id)
    return accessibility_engine.make_video_accessible(job_id)


@router.get("/lectures/{job_id}/report")
async def get_accessibility_report(job_id: str):
    """'Lecture Accessibility Report' card payload (Feature #2)."""
    job = _require_job(job_id)
    return accessibility_score.build_lecture_report(job)


@router.get("/lectures/{job_id}/presentation")
async def get_presentation(job_id: str, mode: str = Query("default")):
    """Profile-specific presentation guidance (Feature #3).

    Never reprocesses the video: it only tells the UI what to emphasize for a
    given accessibility need.
    """
    _require_job(job_id)
    return accessibility_score.presentation_for(mode)


@router.get("/lectures/{job_id}/metrics")
async def get_lecture_metrics(job_id: str):
    """Real, dynamically-computed demo metrics (Feature #11)."""
    job = _require_job(job_id)
    return accessibility_score.build_metrics(job)


@router.get("/lectures/{job_id}/replay")
async def get_moment_replay(job_id: str, timestamp: float = Query(..., ge=0.0)):
    """Visual moment replay metadata (Feature #5).

    Returns the visual event around the given timestamp plus the overlapping
    transcript, OCR text, trust, why-it-matters and the exact seek point --
    all from stored frames/events (no fake screenshots).
    """
    job = _require_job(job_id)
    result = job.get("result") or {}
    segments = lecture_data.load_segments(job, result)
    events = lecture_data.load_visual_events(job, result)
    analysis = _load_analysis(job, events)

    if not events:
        raise HTTPException(status_code=404,
                            detail="This lecture has no visual events to replay.")

    best = None
    best_score = float("inf")
    for ev in events:
        start = float(ev.get("start", 0.0))
        end = float(ev.get("end", start))
        if start <= timestamp <= end:
            best, best_score = ev, 0.0
            break
        dist = min(abs(start - timestamp), abs(end - timestamp))
        if dist < best_score:
            best, best_score = ev, dist
    if best is None or best_score > 10.0:
        raise HTTPException(status_code=404,
                            detail="No visual moment is close enough to that timestamp to replay.")

    event_id = str(best.get("event_id", ""))
    ana = next((a for a in analysis if str(a.get("event_id")) == event_id), None) or {}

    overlap_text = ana.get("overlapping_transcript") or str(best.get("transcript_context") or "")
    overlap_segs = [s for s in segments
                    if float(s.get("start", 0.0)) < float(best.get("end", best.get("start", 0.0)))
                    and float(s.get("end", 0.0)) > float(best.get("start", 0.0))]
    ocr_text = ana.get("ocr_text", "")
    readable = bool(ana.get("readable"))
    if not ocr_text:
        ocr_text, readable = evidence.extract_ocr_text(str(best.get("description") or ""))
    trust = ana.get("trust") or evidence.trust_for_event(best)
    frames = best.get("source_frames") or ana.get("source_frames") or []

    start = float(best.get("start", timestamp))
    end = float(best.get("end", start))

    return {
        "job_id": job_id,
        "moment": {
            "timestamp": round(start, 2),
            "end": round(end, 2),
            "event_id": event_id,
            "type": str(best.get("type", "other")).lower(),
            "seek_to": round(start, 2),
        },
        "visual_event": best,
        "analysis": ana,
        "transcript_context": {
            "text": overlap_text,
            "segments": [{"id": str(s.get("id")), "start": round(float(s.get("start", 0.0)), 2),
                          "end": round(float(s.get("end", 0.0)), 2), "text": str(s.get("text", ""))}
                         for s in overlap_segs],
        },
        "ocr_text": ocr_text,
        "readable": readable,
        "trust": trust,
        "why_it_matters": visual_companion.why_it_matters_for(best, ana),
        "what_you_might_miss": visual_companion.describe_missing_content(best, ana),
        "source_frames": frames if isinstance(frames, list) else [frames],
    }


# Canonical transparency stage list (Feature #10 pipeline transparency).
_CANONICAL_STAGES = [
    ("UPLOAD", None),
    ("AUDIO EXTRACTION", "extract_audio"),
    ("SPEECH TRANSCRIPTION", "transcribe"),
    ("SCENE DETECTION", "analyze_video"),
    ("VISUAL ANALYSIS", "visual_event_analysis"),
    ("EVIDENCE GROUNDING", "visual_event_analysis"),
    ("VISUAL UNDERSTANDING", "visual_understanding"),
    ("ACCESSIBILITY ANALYSIS", "accessibility"),
    ("MISSING INFORMATION", "missing_information_analysis"),
    ("QUIZ GENERATION", "quiz"),
]


def _stage_counts(job: dict, name: str) -> dict:
    val = job.get("result") or {}
    if name == "SPEECH TRANSCRIPTION":
        return {"segments": len(lecture_data.load_segments(job, val))}
    if name in ("VISUAL ANALYSIS", "EVIDENCE GROUNDING"):
        events = lecture_data.load_visual_events(job, val)
        return {"visual_events": len(events),
                "analysis_records": len(_load_analysis(job, events))}
    if name == "VISUAL UNDERSTANDING":
        return {"records": len(lecture_data.load_visual_understanding(job, val))}
    if name == "MISSING INFORMATION":
        statuses = val.get("missing_information_analysis") or []
        return {"classified_events": len(statuses)}
    if name == "QUIZ GENERATION":
        try:
            from backend.services.quiz import load_quiz
            return {"questions": len(load_quiz(f"{job.get('job_id')}_quiz"))}
        except Exception:
            return {"questions": 0}
    if name == "ACCESSIBILITY ANALYSIS":
        acc = val.get("accessibility_events") or []
        return {"segments": len(acc), "described": sum(1 for a in acc if a.get("should_describe"))}
    return {}


@router.get("/lectures/{job_id}/pipeline-status")
async def get_pipeline_status(job_id: str):
    """The real processing pipeline in canonical order (Feature #10).

    Statuses mirror the persisted stage ledger exactly; a missing stage is
    reported as skipped or pending -- never faked as completed.
    """
    job = _require_job(job_id)
    result = job.get("result") or {}
    stage_status = result.get("stage_status") or {}
    job_status = job.get("status", "unknown")

    stages = []
    seen_mapped: set[str] = set()
    for name, key in _CANONICAL_STAGES:
        info = stage_status.get(key) if key else None
        if key:
            seen_mapped.add(key)
        if not key:
            status = "completed"  # upload existed for a job to be tracked at all
            fallback, note, seconds = None, "Video upload recorded.", None
            cached_flag = False
        elif info:
            status = str(info.get("status", "completed"))
            seconds = info.get("seconds")
            fallback = info.get("fallback")
            note = info.get("note")
            cached_flag = status == "cached"
        elif job_status in ("done", "partial"):
            # Honest availability detection for pre-feature jobs: some stages
            # can be recomputed on the fly from stored evidence, others cannot.
            events = lecture_data.load_visual_events(job, result)
            if name == "MISSING INFORMATION" and events:
                status = "completed"
                fallback = None
                note = "Recomputed on the fly from stored visual events."
                seconds = None
                cached_flag = False
            elif name == "VISUAL UNDERSTANDING" and events:
                records = lecture_data.load_visual_understanding(job, result)
                status = "completed" if records else "skipped"
                fallback = None
                note = ("Recomputed on the fly from stored visual events."
                        if records else
                        "No visual understanding records exist for this lecture.")
                seconds = None
                cached_flag = bool(records)
            else:
                status = "skipped"
                fallback = None
                note = "Stage not present in this run (e.g. hearing-only mode or older job)."
                seconds = None
                cached_flag = False
        else:
            status = "pending"
            fallback = None
            note = "Stage not reached yet."
            seconds = None
            cached_flag = False
        stages.append({
            "name": name,
            "status": status,
            "cached": bool(cached_flag),
            "seconds": None if seconds is None else round(float(seconds), 2),
            "fallback": fallback,
            "note": note,
            "counts": _stage_counts(job, name),
        })

    # Any ledger entry not present in the canonical list is still surfaced.
    for key, info in stage_status.items():
        if key.startswith("_") or key in seen_mapped:
            continue
        stages.append({
            "name": key.replace("_", " ").upper(),
            "status": str(info.get("status", "completed")),
            "cached": str(info.get("status")) == "cached",
            "seconds": None if info.get("seconds") is None else round(float(info.get("seconds")), 2),
            "fallback": info.get("fallback"),
            "note": info.get("note"),
            "counts": {},
        })

    ready = job_status in ("done", "partial")
    stages.append({
        "name": "READY",
        "status": "completed" if ready else (job_status if job_status in ("failed",) else "pending"),
        "cached": bool(result.get("cached")),
        "seconds": None,
        "fallback": None,
        "note": ("The lecture is ready to explore." if ready else
                 f"Job status is '{job_status}'."),
        "counts": {},
    })

    return {"job_id": job_id, "job_status": job_status, "ready": ready, "stages": stages}


@router.get("/lectures/{job_id}/copilot")
async def get_copilot_briefing(job_id: str,
                               timestamp: float = Query(0.0, ge=0.0, alias="t"),
                               student_id: str = Query("default", alias="student_id"),
                               mode: str = Query("default", alias="mode")):
    """Live multimodal Accessibility Copilot context for playback at timestamp `t`."""
    _require_job(job_id)
    from backend.services import copilot
    return copilot.get_copilot_context(job_id, timestamp, student_id=student_id, mode=mode)