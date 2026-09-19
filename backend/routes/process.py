import json
import logging
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from backend import config, storage
from backend.models.schemas import ProcessRequest, AskRequest, SystemStatusResponse
from backend.services.pipeline import run_pipeline
from backend.services import video, quiz as quiz_service, accessibility, visual_companion, evidence, lecture_data
from backend.services.ask import ask_video
from backend.services import audio_description

logger = logging.getLogger("eduaccess")

router = APIRouter()


def _require_job(job_id: str) -> dict:
    if not storage.job_exists(job_id):
        raise HTTPException(status_code=404, detail="job_id not found. Upload a video first.")
    return storage.get_job(job_id)


def _load_segments(job: dict, result: dict) -> list[dict]:
    return lecture_data.load_segments(job, result)


def _load_visual_events(job: dict, result: dict) -> list[dict]:
    return lecture_data.load_visual_events(job, result)


def _load_analysis(job: dict, result: dict, events: list[dict]) -> list[dict]:
    """Return the grounded Visual Companion analysis, loading from disk or
    (for lectures processed before this feature) computing it on the fly."""
    analysis = result.get("visual_analysis")
    if not analysis:
        stem = Path(job.get("video_path", "")).stem
        analysis_file = config.OUTPUTS_DIR / f"{stem}_visual_analysis.json"
        if analysis_file.exists():
            try:
                analysis = json.loads(analysis_file.read_text(encoding="utf-8")).get("events", [])
            except Exception:
                analysis = []
    if not analysis and events:
        result_segments = lecture_data.load_segments(job, result)
        metadata = result.get("video_metadata") or {}
        analysis = visual_companion.analyze_visual_events(events, result_segments, metadata, job.get("job_id", ""))
    return analysis or []


def _load_understanding(job: dict, result: dict) -> list[dict]:
    return lecture_data.load_visual_understanding(job, result)


@router.post("/process")
async def process_video(req: ProcessRequest, background_tasks: BackgroundTasks):
    """Kick off the accessibility pipeline for a previously uploaded job."""
    job = _require_job(req.job_id)

    deps = video.check_system_dependencies()
    if not deps["ffmpeg"]:
        raise HTTPException(status_code=400, detail="FFmpeg is not installed or is not available on PATH.")

    storage.update_job(req.job_id, status="queued", mode=req.mode,
                       student_id=req.student_id, progress=10, current_stage="uploaded", error=None)

    background_tasks.add_task(
        run_pipeline,
        req.job_id,
        job["video_path"],
        req.mode,
        req.student_id,
        req.accessibility_mode,
    )

    return {"job_id": req.job_id, "status": "queued"}


@router.get("/result/{job_id}")
@router.get("/api/v1/jobs/{job_id}")
@router.get("/api/v1/lectures/{job_id}")
async def get_result(job_id: str):
    """Poll this to check job status / get the final result once status == 'done'."""
    _require_job(job_id)
    return storage.get_job(job_id)


# ---------------------------------------------------------------------------
# Lecture catalogue (also powers DEMO MODE: open an already processed lecture)
# ---------------------------------------------------------------------------
def _lecture_record(job: dict) -> dict:
    job_id = job.get("job_id", "")
    video_path = job.get("video_path", "")
    stem = Path(video_path).stem if video_path else ""
    result = job.get("result") or {}
    ext = "mp3" if config.TTS_PROVIDER == "openai" else "wav"
    meta = result.get("video_metadata") or {}
    acc_glob = list(config.OUTPUTS_DIR.glob(f"{stem}_accessibility_*.json")) if stem else []
    quiz_path = config.QUIZZES_DIR / f"{job_id}_quiz.json"

    # Gather per-stage transparency status for the UI's ✓ / ⚠ display.
    stage_status = result.get("stage_status") or {}

    return {
        "job_id": job_id,
        "filename": job.get("filename", Path(video_path).name if video_path else job_id),
        "status": job.get("status"),
        "progress": job.get("progress", 0),
        "current_stage": job.get("current_stage"),
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "duration": meta.get("duration"),
        "student_id": (result.get("accessibility_profile") or {}).get("id"),
        "assets": {
            "video": bool(video_path and Path(video_path).exists()),
            "transcript": bool(result.get("transcript_path") or (stem and (config.OUTPUTS_DIR / f"{stem}_transcript.txt").exists())),
            "srt": bool(result.get("srt_path") or (stem and (config.OUTPUTS_DIR / f"{stem}.srt").exists())),
            "captions": bool(stem and (config.OUTPUTS_DIR / f"{stem}.vtt").exists()),
            "visual_events": bool(stem and (config.OUTPUTS_DIR / f"{stem}_visual_events.json").exists()),
            "accessibility": bool(acc_glob),
            "narration": bool(result.get("narration_audio_path") or (stem and (config.OUTPUTS_DIR / f"{stem}_narration.{ext}").exists())),
            "quiz": quiz_path.exists(),
        },
        "stage_status": stage_status,
        "has_result": bool(result),
        "cached": bool(result.get("cached")),
    }


@router.get("/lectures")
async def list_lectures():
    """List all previously processed lectures. Used by demo mode and the player."""
    records = []
    for job in storage.list_jobs():
        rec = _lecture_record(job)
        # Only expose jobs that have anything to show.
        if job.get("status") == "done" or job.get("status") == "partial":
            records.append(rec)
    return {"lectures": records}


@router.get("/lectures/{job_id}/timeline")
async def get_lecture_timeline(job_id: str):
    job = _require_job(job_id)

    result = job.get("result", {})
    segments = result.get("segments", [])
    events = result.get("visual_events", [])

    if not segments and not events:
        # Try loading from output files for already-processed lectures.
        stem = Path(job.get("video_path", "")).stem
        events_file = config.OUTPUTS_DIR / f"{stem}_visual_events.json"
        if events_file.exists():
            try:
                events = json.loads(events_file.read_text(encoding="utf-8")).get("events", [])
            except Exception:
                events = []

    timeline = []

    for seg in segments:
        timeline.append({
            "time": float(seg.get("start", 0.0)),
            "duration": round(max(0.0, float(seg.get("end", 0.0)) - float(seg.get("start", 0.0))), 2),
            "type": "speech",
            "title": "Teacher Speech",
            "description": seg.get("text", "").strip(),
            "confidence": 1.0,
            "source_ref": str(seg.get("id", "")),
        })

    analysis_by_id = {a.get("event_id"): a for a in _load_analysis(job, result, events)}
    understanding_by_id = {u.get("event_id"): u for u in _load_understanding(job, result)}
    for ev in events:
        ana = analysis_by_id.get(ev.get("event_id"))
        und = understanding_by_id.get(ev.get("event_id")) or {}
        timeline.append({
            "time": float(ev.get("start", 0.0)),
            "duration": (ana or {}).get("duration") or round(max(0.0, float(ev.get("end", 0.0)) - float(ev.get("start", 0.0))), 2),
            "type": "visual",
            "title": f"Visual: {str(und.get('visual_type') or ev.get('type', 'other')).capitalize()}",
            "description": ev.get("description", "").strip(),
            "confidence": float(ev.get("confidence", 1.0)),
            "source_ref": ev.get("event_id", ""),
            "source": (ana or {}).get("source", "vision"),
            "importance": (ana or {}).get("importance", None),
            "visual_complement_score": (ana or {}).get("visual_complement_score"),
            "trust": (ana or {}).get("trust"),
            "ocr_text": (ana or {}).get("ocr_text", ""),
            "visual_type": und.get("visual_type"),
            "complement_level": und.get("complement_level"),
        })

    # Quiz questions aligned by source refs.
    try:
        quiz_data = quiz_service.load_quiz(f"{job_id}_quiz")
        for idx, q in enumerate(quiz_data):
            q_time = 0.0
            refs = q.get("source_refs", {})
            if refs.get("transcript_segments") and segments:
                first_seg_id = refs["transcript_segments"][0]
                for i, seg in enumerate(segments):
                    if str(seg.get("id")) == str(first_seg_id) or first_seg_id == i:
                        q_time = float(seg.get("start", 0.0))
                        break
            elif refs.get("visual_events") and events:
                first_ev_id = refs["visual_events"][0]
                for ev in events:
                    if str(ev.get("event_id")) == str(first_ev_id):
                        q_time = float(ev.get("start", 0.0))
                        break
            timeline.append({
                "time": q_time,
                "type": "quiz",
                "title": f"Concept Assessment: {str(q.get('concept', 'general')).capitalize()}",
                "description": f"Question {idx+1}: {q.get('question')}",
                "confidence": 1.0,
                "source_ref": "",
            })
    except Exception:
        pass

    timeline.sort(key=lambda item: item["time"])

    return {"job_id": job_id, "timeline": timeline}


@router.get("/lectures/{job_id}/accessibility")
async def get_lecture_accessibility(job_id: str, mode: str = Query("blind")):
    job = _require_job(job_id)
    video_path = job.get("video_path", "")
    stem = Path(video_path).stem

    acc_path = config.OUTPUTS_DIR / f"{stem}_accessibility_{accessibility.normalize_mode(mode)}.json"
    if not acc_path.exists():
        files = list(config.OUTPUTS_DIR.glob(f"{stem}_accessibility_*.json"))
        if files:
            acc_path = files[0]
        else:
            raise HTTPException(status_code=404, detail="Accessibility representation not found")

    try:
        return json.loads(acc_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read accessibility content: {e}")


@router.get("/lectures/{job_id}/missing")
async def get_lecture_missing(job_id: str, mode: str = Query("blind")):
    """'What am I missing?' -- visual information not covered by speech.

    Grounded, temporal, profile-aware (Feature #2 / #7). Items carry the
    source event, timestamps, complement score and a trust level so the UI
    never presents unreadable content as a fact.
    """
    job = _require_job(job_id)
    result = job.get("result") or {}
    mode = accessibility.normalize_mode(mode)

    segments = _load_segments(job, result)
    events = _load_visual_events(job, result)
    analysis = _load_analysis(job, result, events)

    if not events:
        # Hearing-only lectures legitimately have no visual companion items.
        # Keep the old accessibility-event fallback for backward compatibility.
        acc_events = result.get("accessibility_events") or []
        if not acc_events:
            stem = Path(job.get("video_path", "")).stem
            acc_files = list(config.OUTPUTS_DIR.glob(f"{stem}_accessibility_*.json"))
            if acc_files:
                try:
                    acc_events = json.loads(acc_files[0].read_text(encoding="utf-8")).get("accessibility_events", [])
                except Exception:
                    acc_events = []
        items = []
        for ev in acc_events:
            if not ev.get("should_describe") or not ev.get("description"):
                continue
            items.append({
                "timestamp": round(float(ev.get("start", 0.0)), 2),
                "timestamp_start": round(float(ev.get("start", 0.0)), 2),
                "timestamp_end": round(float(ev.get("end", 0.0)), 2),
                "what_you_hear": (ev.get("transcript") or "").strip() or "(silence in this segment)",
                "missing_information": ev.get("description", ""),
                "what_you_might_miss": ev.get("description", ""),
                "why_it_matters": ev.get("reason", "") or "Visual detail not fully explained by speech.",
                "source_event": (ev.get("source_refs") or {}).get("visual_events", [""])[0],
                "source_type": "visual",
                "confidence": round(float(ev.get("confidence", 0.0)), 3),
                "trust": {"trust": evidence.TRUST_VERIFIED, "confidence": float(ev.get("confidence", 0.0)),
                          "reason": "Grounded in a detected visual event."},
            })
        return {
            "job_id": job_id,
            "summary": {
                "text": ("Visual details from this lecture that are not fully explained by "
                         "the teacher's speech."),
                "statuses": [],
                "status_counts": {},
                "actionable_count": 0,
                "overall_coverage_ratio": 0.0,
                "overall_evidence_trust": {
                    "trust": evidence.TRUST_UNAVAILABLE,
                    "reason": "No per-event visual analysis exists for this lecture "
                              "(legacy accessibility events were used).",
                    "records": 0,
                },
            },
            "profile_mode": mode,
            "items": items,
        }

    items = visual_companion.build_missing_items(segments, events, analysis, mode, lecture_id=job_id)

    # Enrich each missing item with the evidence-grounded complement level and
    # visual type from the visual-understanding records (additive, honest).
    understanding_by_id = {u.get("event_id"): u for u in _load_understanding(job, result)}
    for item in items:
        und = understanding_by_id.get(item.get("event_id")) or {}
        item["complement_level"] = und.get("complement_level")
        item["visual_type"] = und.get("visual_type")

    # P2: per-event audio-vs-visual classification and counts behind the scene,
    # so the summary tells a learner *how* each moment reaches them.
    statuses = visual_companion.classify_missing_info(events, segments, analysis)
    status_counts: dict[str, int] = {}
    for s in statuses:
        status_counts[s["status"]] = status_counts.get(s["status"], 0) + 1
    overall_coverage = round(
        sum(s["coverage"] for s in statuses) / len(statuses), 3) if statuses else 0.0
    overall_trust = evidence.verify_claim(visual_companion.build_evidence_records(analysis))

    actionable = (status_counts.get(visual_companion.STATUS_MISSING, 0)
                  + status_counts.get(visual_companion.STATUS_PARTIALLY_MISSING, 0))
    if items:
        summary_text = ("Visual details from this lecture that are not fully explained by "
                        "the teacher's speech.")
    elif not statuses:
        summary_text = ("No additional visual information could be verified for this lecture.")
    elif actionable:
        summary_text = ("Visual information that may not reach every learner was identified, "
                        "but it could not be grounded as verifiable at this time.")
    else:
        unread = status_counts.get(visual_companion.STATUS_UNAVAILABLE, 0)
        redundant = status_counts.get(visual_companion.STATUS_REDUNDANT, 0)
        summary_text = (
            "Additional visual information could not be verified in this lecture's screen "
            f"content. {unread} on-screen event(s) could not be read or verified, and "
            f"{redundant} were already explained by the speech.")

    return {
        "job_id": job_id,
        "summary": {
            "text": summary_text,
            "statuses": statuses,
            "status_counts": status_counts,
            "actionable_count": actionable,
            "overall_coverage_ratio": overall_coverage,
            "overall_evidence_trust": overall_trust,
        },
        "profile_mode": mode,
        "items": items,
    }


@router.get("/lectures/{job_id}/visual-events")
async def get_lecture_visual_events(job_id: str):
    job = _require_job(job_id)
    video_path = job.get("video_path", "")
    stem = Path(video_path).stem

    events_path = config.OUTPUTS_DIR / f"{stem}_visual_events.json"
    if not events_path.exists():
        raise HTTPException(status_code=404, detail="Visual events not found")

    try:
        payload = json.loads(events_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read visual events: {e}")

    result = job.get("result") or {}
    analysis = _load_analysis(job, result, payload.get("events", []))
    understanding = _load_understanding(job, result)

    return {
        "job_id": job_id,
        "events": payload.get("events", []),
        "analysis": analysis,
        "understanding": understanding,
    }


@router.get("/lectures/{job_id}/visual-understanding")
async def get_lecture_visual_understanding(job_id: str):
    """Evidence-grounded structured visual understanding for every visual event.

    Each record is additive and keyed by `event_id` so the frontend can merge it
    with the raw event / Visual Companion analysis. Records are never fabricated:
    unreadable content is marked UNAVAILABLE with honest limitations.
    """
    job = _require_job(job_id)
    result = job.get("result") or {}
    video_path = job.get("video_path", "")
    stem = Path(video_path).stem

    events = _load_visual_events(job, result)
    understanding = _load_understanding(job, result)

    # Honor fallback chain: understanding file -> on-the-fly build (never invent).
    if not understanding and events:
        segments = _load_segments(job, result)
        metadata = result.get("video_metadata") or {}
        from backend.services import visual_understanding
        understanding = visual_understanding.build_visual_understanding(
            events, segments, metadata, job_id)
        # Persist so subsequent requests are served from disk (atomic, honest).
        try:
            config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
            (config.OUTPUTS_DIR / f"{stem}_visual_understanding.json").write_text(
                json.dumps({"job_id": job_id, "records": understanding},
                           ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    return {
        "job_id": job_id,
        "records": understanding,
    }


@router.get("/lectures/{job_id}/audio-description")
async def get_lecture_audio_description(job_id: str):
    """Synchronized Audio Description: one cue per narrated accessibility event.

    A cue is only exposed when the pipeline actually created a narration audio
    file. Events the teacher already spoke (should_describe=False) or events
    where TTS failed are never fabricated into cues.

    Each cue merges in the Visual Understanding record for its time window so
    the frontend can show the grounded type / complement / verified flag next to
    the narration, a live link between accessibility and vision.
    """
    job = _require_job(job_id)
    result = job.get("result") or {}
    video_path = job.get("video_path", "")
    stem = Path(video_path).stem

    # Accessibility events are always taken from the live pipeline result
    # (authoritative, may already carry narration_audio_path after TTS).
    acc_events = result.get("accessibility_events") or []

    # Fallback: if result is missing events (legacy lecture), load from disk.
    if not acc_events:
        try:
            from backend.services import accessibility as acc_svc
            mode_name = acc_svc.normalize_mode(
                (job.get("result") or {}).get("accessibility_profile", {})
                .get("accessibility_mode"))
            acc_path = config.OUTPUTS_DIR / f"{stem}_accessibility_{mode_name}.json"
            if acc_path.exists():
                raw = json.loads(acc_path.read_text(encoding="utf-8"))
                acc_events = raw.get("accessibility_events") or []
        except Exception:
            acc_events = []

    understanding = _load_understanding(job, result)

    cues, summary = audio_description.build_synchronized_cues(
        job_id, acc_events, understanding)

    available = bool(cues)
    reason = "" if available else (
        "This lecture has no narrated visual descriptions yet."
        if acc_events and not any(e.get("should_describe") for e in acc_events)
        else "Audio descriptions were not generated for this lecture."
    )

    return {
        "job_id": job_id,
        "available": available,
        "source": "pipeline" if available else "none",
        "cues": cues,
        "summary": summary,
        "reason": reason,
    }


@router.get("/lectures/{job_id}/evidence")
async def get_lecture_evidence(job_id: str):
    """Transparency endpoint: every visual event as an evidence record (Feature #7)."""
    job = _require_job(job_id)
    result = job.get("result") or {}
    events = _load_visual_events(job, result)
    analysis = _load_analysis(job, result, events)
    if not analysis:
        return {"job_id": job_id, "evidence": [], "overall_trust": {"trust": evidence.TRUST_UNAVAILABLE,
                "reason": "No visual analysis is available for this lecture.", "records": 0}}

    records = visual_companion.build_evidence_records(analysis)
    overall = evidence.verify_claim(records)
    return {"job_id": job_id, "evidence": records, "overall_trust": overall}


@router.get("/lectures/{job_id}/transcript")
async def get_lecture_transcript(job_id: str):
    job = _require_job(job_id)
    result = job.get("result", {})
    segments = result.get("segments", [])
    if not segments:
        stem = Path(job.get("video_path", "")).stem
        seg_file = config.OUTPUTS_DIR / f"{stem}_segments.json"
        if seg_file.exists():
            try:
                segments = json.loads(seg_file.read_text(encoding="utf-8")).get("segments", [])
            except Exception:
                segments = []
        transcript_path = config.OUTPUTS_DIR / f"{stem}_transcript.txt"
        text = ""
        if transcript_path.exists():
            try:
                text = transcript_path.read_text(encoding="utf-8").strip()
            except Exception:
                text = ""
    else:
        text = result.get("transcript_text", "")
    return {
        "transcript_text": text,
        "segments": segments,
    }


@router.post("/ask")
@router.post("/api/v1/ask")
async def ask_question(req: AskRequest):
    if not req.question.strip():
        return {
            "answer": "Please ask a specific question about the lecture.",
            "timestamps": [],
            "source_refs": {"transcript_segments": [], "visual_events": []},
            "evidence": [],
            "trust": evidence.TRUST_UNAVAILABLE,
            "trust_reason": "No supporting evidence is available for this claim.",
            "evidence_records": 0,
        }
    return ask_video(req.job_id, req.question)


@router.get("/system/status", response_model=SystemStatusResponse)
async def get_system_status():
    deps = video.check_system_dependencies()
    from backend.services import vision
    return {
        "status": "ok",
        "dependencies": deps,
        "whisper_model": config.WHISPER_MODEL_SIZE,
        "tts_provider": config.TTS_PROVIDER,
        "vision_provider": vision._pick_provider(),
    }