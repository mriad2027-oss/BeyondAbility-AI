import hashlib
import json
import os
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from backend import config, storage

router = APIRouter()


def _safe_extension(filename: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in config.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Supported: {sorted(config.ALLOWED_VIDEO_EXTENSIONS)}",
        )
    return suffix


@router.post("/upload")
@router.post("/api/v1/upload")
@router.post("/api/v1/lectures/upload")
async def upload_video(file: UploadFile = File(...)):
    """Save an uploaded video, compute SHA-256 content hash, and create a job."""
    _safe_extension(file.filename or "")

    job_id = storage.new_job_id()
    original_name = Path(file.filename or f"video{Path(next(iter(config.ALLOWED_VIDEO_EXTENSIONS))).suffix}").name
    safe_name = f"{job_id}_{original_name}"
    dest_path = config.VIDEOS_DIR / safe_name

    size = 0
    hasher = hashlib.sha256()
    chunk_size = 1024 * 1024
    with open(dest_path, "wb") as f:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            size += len(chunk)
            hasher.update(chunk)
            if size > config.MAX_UPLOAD_BYTES:
                f.close()
                dest_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large (max 512 MB).")
            f.write(chunk)
            f.flush()
        f.flush()
        os.fsync(f.fileno())

    if size == 0:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    video_hash = hasher.hexdigest()

    # Integrity / media prefix validation
    try:
        with open(dest_path, "rb") as f:
            head = f.read(16)
        looks_like_video = (
            head.startswith(b"\x00\x00\x00")
            or head[:4] in (b"ftyp", b"RIFF", b"\x1aE\xdf\xa3", b"OggS")
        )
        if not looks_like_video:
            dest_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Uploaded file does not look like a video.")
    except OSError:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Could not inspect uploaded file.")

    # Check if this exact content hash was previously processed
    existing_job_id = None
    hash_file = config.HASHES_DIR / f"{video_hash}.json"
    if hash_file.exists():
        try:
            hash_record = json.loads(hash_file.read_text(encoding="utf-8"))
            candidate_id = hash_record.get("job_id")
            if candidate_id and storage.job_exists(candidate_id):
                cand_job = storage.get_job(candidate_id)
                if cand_job.get("status") == "done":
                    existing_job_id = candidate_id
        except Exception:
            pass

    storage.create_job(job_id, {
        "video_path": str(dest_path),
        "filename": original_name,
        "content_hash": video_hash,
        "reused_from_job": existing_job_id,
        "pipeline_version": config.PIPELINE_VERSION,
    })

    return {
        "job_id": job_id,
        "filename": original_name,
        "size_bytes": size,
        "content_hash": video_hash,
        "reused_from": existing_job_id,
    }