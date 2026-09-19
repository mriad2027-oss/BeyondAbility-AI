"""Reusable trust / no-fabrication layer (Feature #4 + #7).

Every AI-generated visual claim must be classified before it is shown:

    VERIFIED    - grounded in available evidence (readable OCR text or a
                  confident description derived directly from the frame).
    UNCERTAIN   - plausible but cannot be fully confirmed (low detection
                  confidence, or the description uses hedging language).
    UNAVAILABLE - the visual content cannot be established at all
                  (unreadable frame, empty/absent visual analysis).

The layer also builds the lightweight per-answer evidence records used by
Ask-the-Video and the transparency endpoints:

    {
      "source_type": "visual" | "transcript" | "ocr" | "combined",
      "event_id": "event_08",
      "segment_id": "seg_042",
      "timestamp": 84.4,
      "confidence": 0.9,
      "trust": "VERIFIED"
    }

Nothing here invents facts: uncertainty is surfaced, not converted into
certainty.
"""
from __future__ import annotations

TRUST_VERIFIED = "VERIFIED"
TRUST_UNCERTAIN = "UNCERTAIN"
TRUST_UNAVAILABLE = "UNAVAILABLE"

_TRUST_RANK = {TRUST_VERIFIED: 2, TRUST_UNCERTAIN: 1, TRUST_UNAVAILABLE: 0}

_UNAVAILABLE_MARKERS = (
    "no readable on-screen text",
    "unavailable visual analysis",
    "visual analysis unavailable",
    "visual description unavailable",
)

_HEDGE_PHRASES = (
    "appears to",
    "appears that",
    "it appears",
    "seems to",
    "seems that",
    "possibly",
    "may be",
    "might be",
    "cannot be confirmed",
    "partially visible",
    "unclear",
)


def _text(value) -> str:
    return str(value or "").strip()


def to_confidence(value, default: float = 1.0) -> float:
    try:
        conf = max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        conf = default
    return round(conf, 3)


def extract_ocr_text(description: str) -> tuple[str, bool]:
    """Return (visible_text, readable) parsed from an OCR-derived description.

    readable=False means the OCR genuinely found no readable on-screen text;
    the returned text is then empty (never invented).
    """
    description = _text(description)
    if not description:
        return "", False
    if "no readable on-screen text" in description.lower():
        return "", False
    marker = "OCR-only output: On-screen text detected:"
    if marker in description:
        text = description.split(marker, 1)[1].strip()
        return text, bool(text.strip())
    return "", bool(description)


def _has_unavailable_marker(description: str) -> bool:
    if not description:
        return False
    lowered = description.lower()
    return any(marker in lowered for marker in _UNAVAILABLE_MARKERS)


def _is_hedged(description: str) -> bool:
    lowered = description.lower()
    return any(phrase in lowered for phrase in _HEDGE_PHRASES)


def trust_for_event(event: dict) -> dict:
    """Classify how trustworthy the visual claim carried by an event is.

    Returns {"trust": VERIFIED|UNCERTAIN|UNAVAILABLE,
             "confidence": float, "reason": str}.
    """
    description = _text(event.get("description"))
    confidence = to_confidence(event.get("confidence"), default=1.0)

    if not description:
        return {
            "trust": TRUST_UNAVAILABLE,
            "confidence": confidence,
            "reason": "No visual description is available for this event.",
        }
    if _has_unavailable_marker(description):
        reason = ("The on-screen content could not be established from the available "
                  "frame (e.g. no readable text was detected).")
        return {"trust": TRUST_UNAVAILABLE, "confidence": confidence, "reason": reason}

    if confidence < 0.55:
        return {
            "trust": TRUST_UNCERTAIN,
            "confidence": confidence,
            "reason": "The visual was detected with low confidence, so details may not be exact.",
        }
    if _is_hedged(description):
        return {
            "trust": TRUST_UNCERTAIN,
            "confidence": confidence,
            "reason": "The description itself uses uncertain language and cannot be fully confirmed.",
        }
    return {
        "trust": TRUST_VERIFIED,
        "confidence": confidence,
        "reason": "The claim is grounded in detected on-screen evidence.",
    }


def build_evidence(*, source_type: str, event_id: str | None = None,
                   segment_id: str | None = None, timestamp: float | None = None,
                   confidence: float = 1.0) -> dict:
    """Build a lightweight evidence record (Feature #7 evidence model)."""
    record = {
        "source_type": source_type,
        "timestamp": None if timestamp is None else round(float(timestamp), 2),
        "confidence": to_confidence(confidence, default=1.0),
        "trust": TRUST_VERIFIED,
    }
    if event_id is not None:
        record["event_id"] = str(event_id)
    if segment_id is not None:
        record["segment_id"] = str(segment_id)
    trust = trust_for_event({"description": "", "confidence": confidence})
    if trust["trust"] != TRUST_VERIFIED:
        record["trust"] = trust["trust"]
    return record


def verify_claim(evidence: list[dict]) -> dict:
    """Aggregate a set of evidence records into one overall claim status.

    The worst (least trustworthy) individual record governs the whole claim,
    so a claim is never presented as fully verified if any part of it is
    uncertain or unavailable.
    """
    if not evidence:
        return {
            "trust": TRUST_UNAVAILABLE,
            "reason": "No supporting evidence is available for this claim.",
            "records": 0,
        }
    rank = min(_TRUST_RANK.get(e.get("trust", TRUST_UNAVAILABLE), 0) for e in evidence)
    trust = next((t for t, r in _TRUST_RANK.items() if r == rank), TRUST_UNAVAILABLE)
    reasons = [e.get("source_type") for e in evidence]
    return {
        "trust": trust,
        "reason": f"Composite status of {len(evidence)} evidence record(s): {', '.join(str(r) for r in reasons)}.",
        "records": len(evidence),
    }


def trust_badge(trust: str) -> str:
    """Frontend helper: stable label for a trust level."""
    return str(trust or TRUST_UNAVAILABLE).upper()


# ---------------------------------------------------------------------------
# Feature P4 #4: "Why should I trust this?" -- structured, record-grounded
# ---------------------------------------------------------------------------

def _fmt_clock(seconds) -> str:
    try:
        seconds = max(0.0, float(seconds))
        mm, ss = divmod(int(seconds), 60)
        return f"{mm:02d}:{ss:02d}"
    except (TypeError, ValueError):
        return ""


def explain_trust(evidence_records: list[dict], *, conflict: dict | None = None,
                  status: str = "") -> list[str]:
    """Build the 'WHY THIS ANSWER?' trail from actual evidence records.

    Every line corresponds to a real record (source type, id, timestamp) or an
    aggregate fact (sources agree / overridden by weaker trust / conflict
    surfaced). Nothing is fabricated; unavailable evidence produces explicit
    warning lines instead of silence.
    """
    records = [r for r in (evidence_records or []) if isinstance(r, dict)]
    lines: list[str] = []
    seen: set[tuple] = set()

    trust_rank = {TRUST_VERIFIED: 2, TRUST_UNCERTAIN: 1, TRUST_UNAVAILABLE: 0}
    if not records:
        lines.append("No supporting evidence is attached to this claim.")
        return lines

    has_transcript = any(str(r.get("source_type")) in ("transcript", "combined") for r in records)
    has_visual = any(str(r.get("source_type")) in ("visual", "ocr", "combined") for r in records)
    any_timestamp = any(r.get("timestamp") is not None for r in records)

    if has_transcript:
        lines.append("Supporting source: speech transcript")
    if has_visual:
        lines.append("Supporting source: visual evidence (OCR / screen content)")

    if any_timestamp:
        ts = sorted({float(r["timestamp"]) for r in records if r.get("timestamp") is not None})
        lines.append("Evidence timestamps: " + ", ".join(f"{_fmt_clock(t)} ({t}s)" for t in ts[:5]))

    # Per-record trail: source, id, timestamp, type, trust.
    for r in records:
        key = (str(r.get("source_type")), str(r.get("event_id") or r.get("segment_id") or ""))
        if key in seen:
            continue
        seen.add(key)
        ts = _fmt_clock(r.get("timestamp")) if r.get("timestamp") is not None else ""
        badge = "✓" if str(r.get("trust")) == TRUST_VERIFIED else "⚠"
        kind = str(r.get("source_type")).upper()
        rid = (r.get("event_id") or r.get("segment_id")
               or r.get("event_ref") or r.get("segment_ref") or "?")
        line = f"{badge} {kind} evidence — {ts} ({rid}) — trust {str(r.get('trust'))}"
        lines.append(line)

    speaks = [r for r in records if str(r.get("source_type")) == "transcript"]
    visual = [r for r in records if str(r.get("source_type")) in ("visual", "ocr")]
    worst_trust = min((trust_rank.get(str(r.get("trust")), 0) for r in records), default=0)

    if speaks and visual:
        lines.append("Multiple source types reach this claim, and their timestamps align - "
                     "sources agree.")
    elif worst_trust == trust_rank[TRUST_UNAVAILABLE]:
        trust_label_ = next((t for t, r in trust_rank.items() if r == 0), TRUST_UNAVAILABLE)
        lines.append(f"⚠ Evidence could not be verified (trust {trust_label_}); the answer "
                     "reports exactly what is known and no more.")

    if conflict and conflict.get("flag"):
        lines.append("⚠ Speech and on-screen evidence conflict - both sources are shown "
                     "instead of picking one.")

    if records and worst_trust < trust_rank[TRUST_VERIFIED]:
        if not (conflict and conflict.get("flag")):
            weak = [r for r in records if trust_rank.get(str(r.get("trust")), 0) < trust_rank[TRUST_VERIFIED]]
            lines.append(f"⚠ {len(weak)} record(s) carry less-than-verified trust; the composite "
                         "claim is capped at that level (never overstated).")

    return lines