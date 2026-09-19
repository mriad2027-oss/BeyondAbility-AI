"""
Observability helpers.

Every pipeline stage reports (job_id, stage, duration, success/failure,
fallback used) to both the Python logging system and the job's JSON log so
that judges and developers can see exactly what happened, transparently.
"""

import logging
import time
from datetime import datetime, timezone

from backend import storage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("eduaccess")


class StageTimer:
    """Context manager that records per-stage timing and outcome."""

    def __init__(self, job_id: str, stage: str, stages: dict | None = None, result: dict | None = None):
        self.job_id = job_id
        self.stage = stage
        self.stages = stages if stages is not None else {}
        self.result = result
        self.start = time.monotonic()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        seconds = round(time.monotonic() - self.start, 2)
        if exc_type is not None:
            record_stage(self.job_id, self.stage, ok=False, seconds=seconds, note=str(exc)[:500])
            return False
        if self.stage not in self.stages:
            self.stages[self.stage] = {
                "status": "completed",
                "fallback": "none",
                "seconds": seconds,
            }
            record_stage(self.job_id, self.stage, ok=True, seconds=seconds)
        return True

    def mark(self, status: str = "completed", fallback: str | None = None, note: str | None = None):
        """Record the stage result without an exception."""
        seconds = round(time.monotonic() - self.start, 2)
        self.stages[self.stage] = {
            "status": status,
            "fallback": fallback or "none",
            "seconds": seconds,
            "note": note,
        }
        record_stage(self.job_id, self.stage, ok=status in ("completed", "partial", "cached"),
                     seconds=seconds, fallback=fallback, note=note)


def record_stage(job_id: str, stage: str, ok: bool = True, seconds: float = 0.0,
                 fallback: str | None = None, note: str | None = None) -> None:
    """Log a stage event to stdout logs and the job JSON log."""
    fb = f" | fallback={fallback}" if fallback else ""
    note_txt = f" | {note}" if note else ""
    logger.info("job=%s stage=%s ok=%s seconds=%.2f%s%s", job_id, stage, ok, seconds, fb, note_txt)
    try:
        storage.append_log(job_id, "info" if ok else "warning", message=note or f"{stage}: {'ok' if ok else 'failed'}")
    except Exception:
        pass  # never let logging break the pipeline


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()