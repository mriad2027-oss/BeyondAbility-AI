"""Multimodal Chunker for EduAccess AI RAG System.

Splits lecture materials into compact, timestamped retrieval chunks:
1. Speech segments (grouped by time window)
2. Visual events (with OCR text, visual type, and descriptions)
3. Accessibility descriptions
4. Extracted concepts from the knowledge graph
"""
from __future__ import annotations

from typing import Any


def format_clock(seconds: float) -> str:
    s = max(0.0, float(seconds or 0.0))
    mm, ss = divmod(int(s), 60)
    return f"{mm:02d}:{ss:02d}"


def chunk_lecture_data(
    job_id: str,
    segments: list[dict[str, Any]],
    visual_events: list[dict[str, Any]],
    concepts: list[dict[str, Any]] | None = None,
    accessibility_events: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Build standardized, metadata-rich retrieval chunks from lecture artifacts."""
    chunks = []
    chunk_idx = 0

    # 1. Transcript chunks (group 2-3 short segments or ~30s windows)
    current_group: list[dict[str, Any]] = []
    group_start = 0.0

    for seg in segments:
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start + 2.0))

        if not current_group:
            group_start = start
            current_group.append(seg)
        elif len(current_group) < 3 and (end - group_start) < 25.0:
            current_group.append(seg)
        else:
            # Emit chunk
            group_end = float(current_group[-1].get("end", group_start + 5.0))
            combined_text = " ".join(str(s.get("text", "")).strip() for s in current_group)
            chunks.append({
                "chunk_id": f"{job_id}_sp_{chunk_idx:03d}",
                "job_id": job_id,
                "source_type": "speech",
                "start": group_start,
                "end": group_end,
                "timestamp_label": f"[{format_clock(group_start)} - {format_clock(group_end)}]",
                "text": f"Teacher said {format_clock(group_start)}: {combined_text}",
                "metadata": {"segment_ids": [str(s.get("id", "")) for s in current_group]},
            })
            chunk_idx += 1
            current_group = [seg]
            group_start = start

    if current_group:
        group_end = float(current_group[-1].get("end", group_start + 5.0))
        combined_text = " ".join(str(s.get("text", "")).strip() for s in current_group)
        chunks.append({
            "chunk_id": f"{job_id}_sp_{chunk_idx:03d}",
            "job_id": job_id,
            "source_type": "speech",
            "start": group_start,
            "end": group_end,
            "timestamp_label": f"[{format_clock(group_start)} - {format_clock(group_end)}]",
            "text": f"Teacher said {format_clock(group_start)}: {combined_text}",
            "metadata": {"segment_ids": [str(s.get("id", "")) for s in current_group]},
        })
        chunk_idx += 1

    # 2. Visual Event Chunks
    for ev in visual_events:
        start = float(ev.get("start", 0.0))
        end = float(ev.get("end", start + 3.0))
        vtype = str(ev.get("type", "scene")).lower()
        desc = str(ev.get("description", "")).strip()
        ocr = str(ev.get("ocr_text", "")).strip()

        event_text = f"On-screen visual at {format_clock(start)} ({vtype}): {desc}"
        if ocr and len(ocr) > 5:
            event_text += f"\nOn-screen text/code: {ocr}"

        chunks.append({
            "chunk_id": f"{job_id}_vis_{chunk_idx:03d}",
            "job_id": job_id,
            "source_type": "visual",
            "start": start,
            "end": end,
            "timestamp_label": f"[{format_clock(start)}]",
            "text": event_text,
            "metadata": {"event_id": ev.get("event_id", ""), "visual_type": vtype},
        })
        chunk_idx += 1

    # 3. Concept Chunks
    if concepts:
        for c in concepts:
            name = c.get("label") or c.get("concept_id", "")
            status = c.get("status", "")
            first_time = float(c.get("timestamp") or c.get("first_timestamp") or 0.0)
            reason = " ".join(c.get("status_reason", [])) if isinstance(c.get("status_reason"), list) else str(c.get("status_reason", ""))

            chunks.append({
                "chunk_id": f"{job_id}_concept_{chunk_idx:03d}",
                "job_id": job_id,
                "source_type": "concept",
                "start": first_time,
                "end": first_time + 10.0,
                "timestamp_label": f"[{format_clock(first_time)}]",
                "text": f"Concept '{name}' (status: {status}) introduced around {format_clock(first_time)}. {reason}",
                "metadata": {"concept": name, "status": status},
            })
            chunk_idx += 1

    # 4. Accessibility Description Chunks
    if accessibility_events:
        for acc in accessibility_events:
            desc = str(acc.get("description", "")).strip()
            if not desc:
                continue
            start = float(acc.get("start", 0.0))
            end = float(acc.get("end", start + 3.0))
            chunks.append({
                "chunk_id": f"{job_id}_acc_{chunk_idx:03d}",
                "job_id": job_id,
                "source_type": "accessibility",
                "start": start,
                "end": end,
                "timestamp_label": f"[{format_clock(start)}]",
                "text": f"Accessibility description at {format_clock(start)}: {desc}",
                "metadata": {"event_id": acc.get("event_id", "")},
            })
            chunk_idx += 1

    return chunks
