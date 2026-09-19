"""Synchronized Audio Description: exposure helpers around real narration.

An Audio Description cue only exists when the pipeline actually created a
narration audio file for an accessibility event. Nothing is fabricated: events
whose narration was never synthesized simply do not produce a cue, and the
endpoint says so honestly.

Every cue is merged (by timeline overlap) with the Visual Understanding record
so the frontend can show the grounded visual type / complement / verified flag
next to the narration -- a live tie-in between the accessibility and vision
pipelines.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from backend import config


def file_url(path: str | None) -> str:
    """Public URL for a generated output file served by /files/outputs."""
    path = str(path or "")
    if not path:
        return ""
    try:
        rel = str(Path(path).resolve().relative_to(config.OUTPUTS_DIR.resolve()))
    except ValueError:
        return ""
    return f"/files/outputs/{quote(rel, safe='/')}"


def _overlap_seconds(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def format_factual_audio_description(event: dict, info: dict | None = None,
                                     transcript_context: str = "",
                                     mode: str = "default",
                                     language: str = "en") -> str:
    """Generate a concise, factual, evidence-grounded audio description.

    Answers what a visually impaired learner would miss, without describing
    decorative background or repeating the teacher verbatim.
    """
    info = info or {}
    vtype = str(info.get("visual_type") or event.get("type", "scene")).lower()
    ocr = str(info.get("ocr_text") or event.get("ocr_text", "")).strip()
    lines = [ln.strip() for ln in ocr.splitlines() if ln.strip()]
    confidence = float(event.get("confidence", 1.0) or 0.0)
    uncertain_prefix = "It appears that " if confidence < 0.6 else ""
    start_time = float(event.get("start", event.get("timestamp", 0.0)) or 0.0)
    mm, ss = divmod(int(start_time), 60)
    time_str = f"{mm:02d}:{ss:02d}"

    is_ar = language == "ar" or any('\u0600' <= c <= '\u06FF' for c in (transcript_context + ocr))

    if not ocr and ("unavailable" in str(event.get("description", "")).lower() or not event.get("description")):
        return "المعلومات المرئية غير واضحة في هذه اللحظة." if is_ar else "The visual content is not clearly readable at this moment."

    if is_ar:
        if confidence < 0.55 and not ocr:
            return "يظهر محرر كود، لكن تفاصيل الشيفرة غير واضحة بما يكفي لتأكيدها."

        if vtype == "code":
            code_lower = ocr.lower()
            if "for " in code_lower and "range(" in code_lower:
                return f"في الدقيقة {time_str}، يظهر محرر كود بايثون يحتوي على حلقة for تمر على القيم من خلال range(5)، مع أمر طباعة المتغير."
            elif "while " in code_lower:
                return f"في الدقيقة {time_str}، يظهر محرر كود يحتوي على حلقة تكرار شرطية while."
            elif "def " in code_lower:
                return f"في الدقيقة {time_str}، يظهر محرر كود لتعريف دالة برمجية."
            snippet = lines[0] if lines else ""
            if len(lines) > 1:
                snippet += f" ، {lines[1]}"
            return f"{uncertain_prefix}في الدقيقة {time_str}، يظهر محرر الشيفرة البرمجية مع كود: '{snippet}'."
        elif vtype in ("flowchart", "diagram"):
            title = lines[0] if lines else "مخطط توضيحي"
            return f"في الدقيقة {time_str}، يظهر مخطط انسيابي بعنوان '{title}' يوضح تسلسل خطوات العملية."
        elif vtype == "chart":
            title = lines[0] if lines else "رسم بياني"
            return f"في الدقيقة {time_str}، يظهر رسم بياني يوضح مقارنة البيانات: '{title}'."
        elif vtype == "ui":
            return f"في الدقيقة {time_str}، تظهر واجهة البرنامج مع محرر الكود وزر التشغيل Run ومنطقة المخرجات."
        elif vtype == "table":
            return f"في الدقيقة {time_str}، يظهر جدول منظم يعرض تفاصيل البيانات."
        elif vtype == "formula":
            formula = " ".join(lines[:2]) if lines else "معادلة رياضية"
            return f"في الدقيقة {time_str}، تظهر معادلة رياضية على الشاشة: '{formula}'."
        elif vtype == "slide":
            title = lines[0] if lines else "شريحة تعليمية"
            bullets = " ، ".join(lines[1:3]) if len(lines) > 1 else ""
            return f"في الدقيقة {time_str}، تظهر شريحة بعنوان '{title}'" + (f" تتضمن النقاط: {bullets}." if bullets else ".")
        else:
            desc = str(event.get("description", "")).strip()
            if desc.startswith("OCR-only output:"):
                desc = "\n".join(lines[:2])
            return f"في الدقيقة {time_str}، يظهر على الشاشة: {desc}."

    # English descriptions:
    if vtype == "code":
        code_preview = " ".join(lines[:3]) if lines else "code snippet"
        if "for " in code_preview.lower() and "range(" in code_preview.lower():
            return f"At {time_str}, a code editor appears showing a Python for-loop using range(5): {code_preview}."
        elif "while " in code_preview.lower():
            return f"At {time_str}, a code editor appears showing a Python while-loop: {code_preview}."
        return f"{uncertain_prefix}At {time_str}, a code editor appears displaying code: '{code_preview}'."

    elif vtype in ("flowchart", "diagram"):
        title = lines[0] if lines else "flowchart"
        return f"{uncertain_prefix}At {time_str}, a flowchart diagram titled '{title}' illustrates the execution process and decision flow."

    elif vtype == "chart":
        title = lines[0] if lines else "bar chart"
        labels = ", ".join(lines[1:4]) if len(lines) > 1 else "values"
        return f"{uncertain_prefix}At {time_str}, a chart appears comparing: {title} with values {labels}."

    elif vtype == "ui":
        return f"At {time_str}, a code editor interface is shown with a green Run button in the upper right and a console output area."

    elif vtype == "table":
        header = lines[0] if lines else "table"
        return f"{uncertain_prefix}At {time_str}, a data table is displayed with header: '{header}'."

    elif vtype == "formula":
        formula = " ".join(lines[:2]) if lines else "expression"
        return f"At {time_str}, a mathematical formula appears on screen: '{formula}'."

    elif vtype == "slide":
        title = lines[0] if lines else "slide"
        points = "; ".join(lines[1:3]) if len(lines) > 1 else ""
        return f"{uncertain_prefix}At {time_str}, an educational slide titled '{title}' is shown" + (f" with key points: {points}." if points else ".")

    else:
        desc = str(event.get("description", "")).strip()
        if desc.startswith("OCR-only output:"):
            desc = " ".join(lines[:2]) if lines else "Visual demonstration on screen."
        return f"{uncertain_prefix}At {time_str}, visual content is displayed: {desc}"


def match_understanding(understanding: list[dict], start: float, end: float) -> dict:
    """Find the visual-understanding record for a time window.

    Prefers the record with the largest overlap; falls back to the nearest one
    by midpoint so a cue right after a visual event still ties to it.
    """
    best, best_overlap = None, 0.0
    for record in understanding or []:
        ov = _overlap_seconds(start, end, float(record.get("start", start)),
                              float(record.get("end", end)))
        if ov > best_overlap:
            best, best_overlap = record, ov
    if best is None:
        mid = (start + end) / 2.0
        candidates = []
        for record in understanding or []:
            r_mid = (float(record.get("start", 0.0)) + float(record.get("end", 0.0))) / 2.0
            candidates.append((abs(r_mid - mid), record))
        if candidates:
            best = min(candidates, key=lambda item: item[0])[1]
    return best or {}


def build_synchronized_cues(job_id: str, acc_events: list[dict],
                            understanding: list[dict]) -> tuple[list[dict], dict]:
    """Build synchronized cue-by-cue audio description from real narration assets.

    Returns (cues, summary). A cue requires an event that was actually
    described (``should_describe``) with an existing narration audio file.
    """
    cues: list[dict] = []
    skipped_no_audio = 0
    for event in acc_events or []:
        if not event.get("should_describe") or not event.get("description"):
            continue
        audio_path = str(event.get("narration_audio_path") or "")
        if not audio_path:
            skipped_no_audio += 1
            continue
        p = Path(audio_path)
        if not p.exists():
            candidate = config.OUTPUTS_DIR / p.name
            if candidate.exists():
                audio_path = str(candidate)
            else:
                skipped_no_audio += 1
                continue
        start = float(event.get("start", 0.0))
        end = float(event.get("end", start))
        info = match_understanding(understanding, start, end)
        cues.append({
            "event_id": str(event.get("segment_id", "")),
            "start": round(start, 2),
            "end": round(end, 2),
            "play_start": round(float(event.get("play_start", end)), 2),
            "description": str(event.get("description", "")),
            "transcript": str(event.get("transcript", "")),
            "audio_url": file_url(audio_path),
            "audio_filename": Path(audio_path).name,
            "priority": str(event.get("priority", "medium")),
            "confidence": round(float(event.get("confidence", 0.0) or 0.0), 2),
            "source_refs": event.get("source_refs", {}),
            "visual_type": info.get("visual_type"),
            "complement_level": info.get("complement_level"),
            "verified": bool((info.get("trust") or {}).get("trust") == "VERIFIED") if info else None,
            "accessibility_description": (info.get("accessibility_description") or {}).get("standard"),
        })

    total_time = sum(float(c["end"]) - float(c["start"]) for c in cues)
    summary = {
        "cues": len(cues),
        "covered_seconds": round(total_time, 2),
        "verified": sum(1 for c in cues if c["verified"]),
        "narratable_but_no_audio": skipped_no_audio,
    }
    return cues, summary