"""Visual Understanding -- evidence-grounded multimodal visual understanding.

The visual subsystem is upgraded from plain OCR + scene detection into an
EVIDENCE-BASED structured understanding of what is happening on screen, written
for a blind / low-vision learner.

For every meaningful visual event we produce a structured record that explains:

    WHAT is on screen (type + scene summary)
    WHAT text/details are readable (OCR, verbatim only)
    WHAT changed (scene summary / source frames)
    CLAIMS (each grounded in evidence, with confidence)
    COMPLEMENT LEVEL (how the screen adds to what the teacher says)
    TRUST (VERIFIED / UNCERTAIN / UNAVAILABLE, from evidence, never from the
          fact that a model generated text)
    ACCESSIBILITY DESCRIPTION (short / standard layers)
    LIMITATIONS (honest -- never fabricate what is unreadable)

NO-FABRICATION GUARANTEE
------------------------
* Only OCR-detected characters are quoted as text.
* Visual types are classified from OCR + layout signals, never guessed just
  because punctuation/numbers exist.
* A claim is only ever as strong as its evidence. If color / numbers / labels /
  relationships cannot be established they are reported as unavailable.
* trust comes from `evidence.trust_for_event` -- an LLM/description never makes
  something VERIFIED on its own; readable OCR + confident detection does.
* If the visual content cannot be verified, we return an honest UNAVAILABLE /
  limitation instead of a plausible guess.

This module is deterministic and offline-safe (no network required).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from backend.services import evidence, visual_companion as vc

# Supported visual types.
VISUAL_TYPES = {
    "slide", "code", "diagram", "flowchart", "chart", "table", "ui", "image",
    "scene", "whiteboard", "document", "animation", "unknown", "other",
}
# Legacy type strings that map onto the canonical set used by analysis.
_LEGACY_TYPE_ALIASES = {
    "interface": "ui",
    "formula": "document",
    "person": "scene",
    "demonstration": "scene",
}

# Candidate markers (verbatim lower-case substrings) used to *help* classify --
# never the sole reason to call something a chart/code.
_CODE_MARKERS = (
    "def ", "class ", "import ", "print(", "for ", "while ", "range(",
    "return ", "if ", "elif ", "else:", "try:", "lambda ", "self.", "input(",
    "len(", "#include", "public static", "function ", "console.log", "=>",
    "let ", "const ",
)
_SLIDE_MARKERS = ("slide", "lesson", "objectives", "today", "welcome",
                  "summary", "introduction", "overview")

# Reuse the visual companion content-word coverage for complement scoring.
_speech_visual_coverage = vc.speech_visual_coverage


def _text(value) -> str:
    return str(value or "").strip()


# ---------------------------------------------------------------------------
# Evidence extraction
# ---------------------------------------------------------------------------

def extract_ocr(description: str) -> tuple[str, bool]:
    """Return (ocr_text, readable) parsed honestly from an event description.

    Delegates to `evidence.extract_ocr_text`, which never invents text and
    returns readable=False when the OCR genuinely found nothing.
    """
    desc = _text(description)
    ocr, readable = evidence.extract_ocr_text(desc)
    return ocr.strip(), bool(ocr.strip()) and readable


def _ocr_lines(ocr_text: str) -> list[str]:
    return [ln for ln in (ocr_text or "").splitlines() if ln.strip()]


# ---------------------------------------------------------------------------
# Evidence-based visual type classification (upgrade over classify_ocr_text)
# ---------------------------------------------------------------------------

def classify_visual_type(ocr_text: str, description: str = "",
                         detected_type: str = "") -> str:
    """Classify a visual event type from OCR text + layout signals.

    Rules (no fabrication):
      * If OCR is empty/unreadable and no description: -> unknown. We cannot
        classify what we cannot read, so we say so instead of guessing.
      * Flowchart: an explicit "flowchart" marker or flowchart structure words
        (nodes + true/false flow) -> flowchart (distinct from a flat diagram).
      * Code: multiple code markers present (or a strong single one like a
        `print(` or `range(` call) strongly indicate code. We require at least
        one unambiguous code signal so punctuation/numbers alone never produce
        "code".
      * Chart: a chart title word ("chart", "graph", "DIAGRAM") or multiple
        numeric labels on their own lines with value labels -> chart.
      * Table / diagram / ui / slide / document / whiteboard via markers.
      * Otherwise fall back to the detected type if in the canonical set.

    The heuristic is intentionally conservative: an unrecognisable slide stays
    "slide"; unreadable content stays "unknown".
    """
    # When the description is itself OCR-only output, the meaningful text is
    # entirely in `ocr_text`; mixing the raw description back in would let the
    # "OCR-only output:" header (e.g. "output:") pollute the type detection.
    desc = _text(description)
    if desc.lower().startswith("ocr-only"):
        desc = ""
    raw = f"{desc}\n{_text(ocr_text)}"
    low = raw.lower()
    has_digit = bool(re.search(r"[0-9]", low))

    # Unreadable: OCR-only with no readable text -> unknown (honest).
    if (not ocr_text) and _text(description).lower().startswith("ocr-only"):
        return "unknown"

    # Flowchart: explicit marker or a structural flow ("start ... end" plus a
    # true/false branch) WITHOUT chart markers (a flowchart is not a chart).
    if "flowchart" in low or (
            ("start" in low and "end" in low)
            and any(w in low for w in ("true", "false", "condition", "decision", "yes", "no"))):
        return "flowchart"

    # Chart: a chart/graph keyword (as a whole word, so "flowchart" is NOT a
    # chart), or a "how many" headline combined with digits.
    if re.search(r"\b(?:chart|graph)\b", low):
        return "chart"
    if has_digit and "how many" in low:
        return "chart"

    # Code: requires multiple distinct markers (or a strong single structural
    # signal like a 'print (' call). A lone identifier like range(5) in a chart
    # legend is NOT enough to call something code.
    code_hits = [m for m in _CODE_MARKERS if m in low]
    if len(code_hits) >= 2:
        return "code"
    if any(m in low for m in ("print(", "print (", "def ", "for i in", "while ")):
        return "code"

    # Diagram: explicit diagram marker or a start...end flow box that did not
    # qualify as a full flowchart (no true/false branch wording).
    if "diagram" in low or ("start" in low and "end" in low):
        return "diagram"

    if "table" in low or ("column" in low and "row" in low):
        return "table"

    # UI: editor / button / run / console / interface words -- matched as whole
    # words so prose like "the loop runs" never becomes an interface.
    for m in ("editor", "button", "console", "interface", "click", "output:"):
        if m in low:
            return "ui"
    if re.search(r"\brun\b", low):
        return "ui"

    if "whiteboard" in low:
        return "whiteboard"
    if any(w in low for w in ("document", "pdf", "page ")):
        return "document"

    # Slide vs generic: several slide-y words -> slide.
    slide_hits = sum(1 for m in _SLIDE_MARKERS if m in low)
    if slide_hits >= 1:
        return "slide"

    # Respect a previously detected canonical type only if it is meaningful.
    base = _LEGACY_TYPE_ALIASES.get(_text(detected_type).lower(),
                                    _text(detected_type).lower())
    if base in VISUAL_TYPES and base not in ("other", "scene", "image", "unknown"):
        return base
    if ocr_text and len(low) >= 40:
        return "document"
    return "unknown"


# ---------------------------------------------------------------------------
# Structured, honest text / object extraction
# ---------------------------------------------------------------------------

def _split_first_ocr_line(ocr_text: str) -> tuple[str, list[str]]:
    lines = _ocr_lines(ocr_text)
    if not lines:
        return "", []
    return lines[0], lines[1:]


def _extract_code_language(ocr_text: str) -> str:
    from backend.services import vision
    return vision.detect_code_language(ocr_text)


def structured_text_fields(visual_type: str, ocr_text: str,
                           description: str) -> dict:
    """Build `text`/`objects`/`layout` from evidence only (never fabricated).

    Returns a dict with honest, per-type extraction. Fields are left empty
    when the underlying evidence does not support them.
    """
    lines = _ocr_lines(ocr_text)
    first, rest = _split_first_ocr_line(ocr_text)
    desc = _text(description)

    result: dict = {"text": [], "objects": [], "layout": "", "actions": [],
                    "relationships": []}

    if visual_type == "code":
        if lines:
            result["text"] = lines[:8]
            result["objects"] = ["code block"]
            result["layout"] = "A code block is the main on-screen content."
        if any("output" in ln.lower() for ln in lines):
            result["actions"].append("Program output is visible on screen.")
    elif visual_type == "slide":
        if first:
            result["text"] = lines[:8]
            result["objects"] = ["slide"]
            result["layout"] = "Title and supporting text appear on the slide."
    elif visual_type in ("chart", "table", "diagram"):
        if lines:
            result["text"] = lines[:8]
            result["objects"] = [visual_type]
            result["layout"] = (f"A {visual_type} is the main on-screen content.")
    elif visual_type == "ui":
        if lines:
            result["text"] = lines[:8]
            result["objects"] = ["interface"]
        if any(w in (desc + " " + ocr_text).lower()
               for w in ("run", "button", "click", "press")):
            result["actions"].append("An interactive control is visible on screen.")
    elif visual_type in ("document", "whiteboard", "image", "scene", "other"):
        if lines:
            result["text"] = lines[:8]
            result["objects"] = [visual_type]
        else:
            result["objects"] = []

    # Never claim a layout/objects relationship that we cannot verify.
    if visual_type == "diagram":
        if any(w in (desc + " " + ocr_text).lower()
               for w in ("arrow", "arrow", "flowchart", "→", "left to right",
                         "condition", "start", "end")):
            result["relationships"] = [
                "The diagram shows connected elements, but exact labels cannot "
                "all be verified."]
        else:
            result["relationships"] = [
                "The diagram structure is visible, but its relationships cannot "
                "be fully verified."]
    elif visual_type == "chart":
        result["relationships"] = [
            "Exact plotted values could not be verified" if not lines else
            "Value labels are partially readable; change/trajectory is not "
            "fully verified."]

    return result


# ---------------------------------------------------------------------------
# Visual claims (each grounded in a piece of evidence)
# ---------------------------------------------------------------------------

def _confidence_label(conf: float) -> str:
    if conf >= 0.85:
        return "high"
    if conf >= 0.6:
        return "medium"
    return "low"


def build_visual_claims(visual_type: str, ocr_text: str, description: str,
                        confidence: float) -> list[dict]:
    """Produce grounded, per-claim evidence records.

    Every claim carries its own evidence string and confidence. Claims are
    only created when the corresponding evidence actually exists. When OCR is
    empty, NO textual claims are fabricated.
    """
    claims: list[dict] = []
    lines = _ocr_lines(ocr_text)
    conf = evidence.to_confidence(confidence, default=1.0)
    readable = bool(lines)

    if visual_type == "code":
        if lines:
            shown = " ".join(lines[:4])
            claims.append({
                "claim": (f"A code example is visible showing: '{shown}'."),
                "evidence": "OCR detected the visible code.",
                "confidence": round(conf, 2),
            })
            if any("output" in ln.lower() for ln in lines):
                claims.append({
                    "claim": "Program output is visible alongside the code.",
                    "evidence": "OCR detected an output region.",
                    "confidence": round(conf, 2),
                })
        else:
            claims.append({
                "claim": "A code area may be present, but the code is not "
                         "readable.",
                "evidence": "No readable text was detected.",
                "confidence": 0.0,
            })
    elif visual_type == "slide":
        if lines:
            title = lines[0]
            claims.append({
                "claim": f"An educational slide is visible with the title "
                         f"'{title}'.",
                "evidence": "OCR read the first line of the slide.",
                "confidence": round(conf, 2),
            })
        else:
            claims.append({
                "claim": "The slide content cannot be verified.",
                "evidence": "No readable on-screen text was detected.",
                "confidence": 0.0,
            })
    elif visual_type == "chart":
        claims.append({
            "claim": "A chart is visible." ,
            "evidence": "Chart-related content was detected (" +
                        ("OCR values" if lines else "layout signals only") + ").",
            "confidence": round(conf, 2),
        })
        if lines:
            claims.append({
                "claim": "Labels are partially readable, but exact values "
                         "cannot be fully verified.",
                "evidence": "OCR read some labels.",
                "confidence": round(min(conf, 0.5), 2),
            })
    elif visual_type == "diagram":
        claims.append({
            "claim": "A diagram is visible.",
            "evidence": "Diagram-related content was detected (" +
                        ("OCR labels" if lines else "layout signals only") + ").",
            "confidence": round(conf, 2),
        })
        if not lines:
            claims[-1]["claim"] = ("A diagram structure is visible, but its "
                                   "labels cannot be verified.")
    elif visual_type == "flowchart":
        claims.append({
            "claim": "A flowchart is visible.",
            "evidence": "Flowchart structure was detected (" +
                        ("OCR labels" if lines else "layout signals only") + ").",
            "confidence": round(conf, 2),
        })
        if lines:
            claims.append({
                "claim": "The flowchart's nodes carry text, but the exact flow "
                         "order between them cannot be fully verified.",
                "evidence": "OCR read node labels, not the arrows.",
                "confidence": round(min(conf, 0.5), 2),
            })
        else:
            claims[-1]["claim"] = ("A flowchart structure is visible, but its "
                                   "node labels cannot be verified.")
    elif visual_type in ("table", "ui", "document", "whiteboard", "image",
                         "scene", "unknown", "other"):
        if lines:
            claims.append({
                "claim": (f"{visual_type.capitalize()} content is visible with "
                          "some readable text."),
                "evidence": "OCR read text on screen.",
                "confidence": round(conf, 2),
            })
        else:
            claims.append({
                "claim": f"{visual_type.capitalize()} content could not be "
                         "verified.",
                "evidence": "No readable on-screen text was detected.",
                "confidence": 0.0,
            })

    # Honest non-text limitation appended when no text is readable.
    if not readable:
        claims.append({
            "claim": "Text on screen is not readable from the available frame.",
            "evidence": "OCR returned no recognisable string.",
            "confidence": 0.0,
        })
    return claims


# ---------------------------------------------------------------------------
# Complement level (screen vs speech)
# ---------------------------------------------------------------------------

def complement_level(visual_type: str, ocr_text: str, description: str,
                     overlap_transcript: str, trust: str,
                     complement_score: dict | None = None,
                     confidence: float = 1.0) -> str:
    """Classify how the screen adds to speech.

    Returns one of:
      UNAVAILABLE      - visual evidence cannot be verified
      AUDIO_ONLY       - speech is present but the screen adds no readable info
      VISUALLY_ONLY    - the screen carries info with no overlapping speech
      REDUNDANT        - speech already communicates the visual content
      PARTIALLY_MISSING - concept spoken, concrete visual adds material detail
      COMPLEMENTARY    - the screen adds material detail not spoken
    """
    if _text(trust).upper() == evidence.TRUST_UNAVAILABLE:
        return "UNAVAILABLE"
    readable = bool(_ocr_lines(ocr_text))
    spoken = bool(_text(overlap_transcript).strip())

    if not readable and not spoken:
        return "UNAVAILABLE"
    if not readable:
        return "AUDIO_ONLY" if spoken else "UNAVAILABLE"
    if not spoken:
        return "VISUALLY_ONLY"

    coverage = _speech_visual_coverage(description, ocr_text, overlap_transcript)
    if coverage >= 0.7:
        return "REDUNDANT"
    if coverage >= 0.35:
        return "PARTIALLY_MISSING"
    return "COMPLEMENTARY"


# ---------------------------------------------------------------------------
# Accessibility descriptions
# ---------------------------------------------------------------------------

def build_accessibility_descriptions(visual_type: str, ocr_text: str,
                                     description: str, overlap_transcript: str,
                                     trust: str, start: float,
                                     complement: str) -> dict:
    """SHORT + STANDARD accessibility descriptions grounded in evidence.

    These answer: what is on screen, what is important, where, what changed,
    why it matters to the lesson, what is not spoken. Nothing is invented.
    """
    readable = bool(_ocr_lines(ocr_text))
    t = _text(trust).upper()
    lines = _ocr_lines(ocr_text)

    if t == evidence.TRUST_UNAVAILABLE or not readable:
        short = "Visual content could not be verified for this moment."
        standard = ("The on-screen content could not be reliably read or "
                    "verified from the available frame, so no visual details "
                    "are stated as fact.")
        return {"short": short, "standard": standard}

    type_label = visual_type.replace("_", " ").capitalize() if visual_type else "Visual"
    snippet = " ".join(lines[:2]) if lines else ""

    if visual_type == "code":
        short = (f"A {type_label} example is visible on screen."
                 if snippet.startswith(("for ", "while ", "def ", "import ", "count =")) or not snippet
                 else f"Code is visible on screen.")
        standard = (
            f"At {round(start, 2):.0f}s, {type_label.lower()} content is shown. "
            f"Near the top of the visible text: \"{snippet}\". "
            + ("The exact code appears only on screen and is not fully spoken."
               if complement in ("COMPLEMENTARY", "VISUALLY_ONLY",
                                 "PARTIALLY_MISSING") else
               "The teacher explains the visible content verbally."))
    elif visual_type == "chart":
        short = "A chart is visible on screen."
        standard = (
            f"At {round(start, 2):.0f}s a chart is shown. "
            + ("Some labels are readable, but exact values cannot be fully "
               "verified." if readable else
               "The chart appears, but its exact values cannot be verified."))
    elif visual_type == "diagram":
        short = "A diagram is visible on screen."
        standard = (
            f"At {round(start, 2):.0f}s a diagram is shown with connected "
            f"elements. Exact labels cannot be fully verified.")
    elif visual_type == "flowchart":
        short = "A flowchart is visible on screen."
        standard = (
            f"At {round(start, 2):.0f}s a flowchart is shown. "
            + ("Readable node labels include: \"{snippet}\". The flow order "
               "between nodes cannot be fully verified." if readable else
               "The flowchart appears, but its node labels cannot be verified."))
    elif visual_type == "slide":
        short = f"An educational slide is visible."
        standard = (
            f"At {round(start, 2):.0f}s a slide is shown. "
            f"Readable text includes: \"{snippet}\".")
    elif visual_type == "ui":
        short = "A software interface is visible on screen."
        standard = (
            f"At {round(start, 2):.0f}s a software interface is shown with "
            f"readable controls: \"{snippet}\".")
    else:
        short = f"{type_label} content is visible on screen."
        standard = (
            f"At {round(start, 2):.0f}s, {type_label.lower()} content is shown. "
            + (f"Readable text: \"{snippet}\"." if readable else
               "The content could not be read clearly."))

    return {"short": short, "standard": standard}


# ---------------------------------------------------------------------------
# Honest limitations
# ---------------------------------------------------------------------------

def build_limitations(visual_type: str, ocr_text: str, description: str,
                      trust: str) -> list[str]:
    """Honest list of what could NOT be verified. Never a plausible guess."""
    limits: list[str] = []
    readable = bool(_ocr_lines(ocr_text))
    t = _text(trust).upper()

    if t == evidence.TRUST_UNAVAILABLE:
        limits.append("The visual content could not be reliably analyzed.")
    if not readable:
        limits.append("No readable on-screen text could be recognised, so "
                      "specific code, labels or values are not stated.")
    if visual_type == "chart":
        limits.append("The exact numerical values and trend of the chart "
                      "cannot be fully verified.")
    if visual_type == "diagram":
        limits.append("The diagram's labels and relationships cannot be fully "
                      "verified.")
    if visual_type == "flowchart":
        limits.append("The flowchart's node labels and flow order cannot be "
                      "fully verified.")
    if visual_type == "ui":
        limits.append("Color and clickability could not be verified from the "
                      "available evidence.")
    if not limits and visual_type in ("slide", "document", "table", "whiteboard",
                                      "image", "scene", "unknown", "other"):
        limits.append("Details beyond the readable text could not be verified.")
    return limits


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

def build_visual_understanding_for_event(event: dict, overlap_transcript: str,
                                         metadata: dict | None = None) -> dict:
    """Build the full structured visual understanding record for one event.

    Purely additive: never mutates the input event. Deterministic & offline.
    """
    start = float(event.get("start", 0.0))
    end = float(event.get("end", start))
    description = _text(event.get("description"))
    confidence = evidence.to_confidence(event.get("confidence"), default=1.0)

    ocr_text, _ = extract_ocr(description)
    detected_type = _text(event.get("type", "other")).lower()
    vtype = classify_visual_type(ocr_text, description, detected_type)

    # Trust comes from evidence only (never from the description's existence).
    trust_obj = evidence.trust_for_event(event)
    trust = _text(trust_obj.get("trust"))

    complement_score = vc.compute_complement_score(event, overlap_transcript)
    comp_level = complement_level(vtype, ocr_text, description,
                                  overlap_transcript, trust,
                                  complement_score, confidence)

    structured = structured_text_fields(vtype, ocr_text, description)
    claims = build_visual_claims(vtype, ocr_text, description, confidence)

    acc = build_accessibility_descriptions(vtype, ocr_text, description,
                                           overlap_transcript, trust, start,
                                           comp_level)
    limitations = build_limitations(vtype, ocr_text, description, trust)

    return {
        "event_id": str(event.get("event_id", "")),
        "start": round(start, 2),
        "end": round(end, 2),
        "source_frames": event.get("source_frames", []),
        "visual_type": vtype,
        "scene_summary": vc.describe_missing_content(event) if event.get("description") else "",
        "objects": structured["objects"],
        "text": structured["text"],
        "layout": structured["layout"],
        "actions": structured["actions"],
        "relationships": structured["relationships"],
        "ocr_text": ocr_text,
        "visual_claims": claims,
        "speech_context": _text(overlap_transcript),
        "complement_level": comp_level,
        "complement_reason": _text(complement_score.get("reason")),
        "trust": trust_obj,
        "description": description,
        "accessibility_description": acc,
        "limitations": limitations,
    }


def build_visual_understanding(events: list[dict],
                               segments: list[dict] | None = None,
                               metadata: dict | None = None,
                               job_id: str = "") -> list[dict]:
    """Build structured visual understanding for every visual event.

    Keyed to the same event_ids as the visual events/analysis so callers and
    the frontend can merge unambiguously. Deterministic order.
    """
    records: list[dict] = []
    for ev in events or []:
        overlap_text, _segids = vc.overlapping_transcript(segments or [], ev)
        record = build_visual_understanding_for_event(ev, overlap_text, metadata)
        record.setdefault("lecture_id", job_id)
        records.append(record)
    return records


# Re-exported for convenience / parity with the vision service helpers.
detect_language = _extract_code_language
