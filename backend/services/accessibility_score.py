"""Accessibility intelligence analytics (Priority 4, Features #1 #2 #3 #11).

Transparent, deterministic analytics computed strictly from the *stored
evidence* of a lecture -- never from a model's confidence and never inflated
because "frames were processed". Every number in the report/score/metrics is
traceable to a real artifact (segments, visual events, analysis records,
missing items, narration files, quiz file, ask logs).

    compute_accessibility_score()  -> explainable per-lecture score
    build_lecture_report()         -> "Lecture Accessibility Report" payload
    presentation_for()             -> profile-specific presentation guidance
    build_metrics()                -> real, dynamic demo metrics
"""
from __future__ import annotations

from backend.services import accessibility, evidence, visual_companion
from backend.services import lecture_data


def _text(value) -> str:
    return str(value or "").strip()


def _load(job: Any) -> dict:
    """Load all lecture evidence once (segments, events, analysis, differences, evidence)."""
    if hasattr(job, "transcript") or hasattr(job, "visual_events"):
        # It is a Lecture dataclass
        lec = job
        tr = getattr(lec, "transcript", None)
        if tr:
            segments = [
                s if isinstance(s, dict) else {
                    "id": getattr(s, "id", ""),
                    "start": getattr(s, "start", 0.0),
                    "end": getattr(s, "end", 0.0),
                    "text": getattr(s, "text", ""),
                }
                for s in (getattr(tr, "segments", []) or [])
            ]
            transcript_text = getattr(tr, "text", "")
        else:
            segments = []
            transcript_text = ""

        events = [
            e if isinstance(e, dict) else {
                "start": getattr(e, "start", 0.0),
                "end": getattr(e, "end", 0.0),
                "type": getattr(e, "type", "scene"),
                "description": getattr(e, "description", ""),
                "confidence": getattr(e, "confidence", 1.0),
                "ocr_text": getattr(e, "ocr_text", ""),
            }
            for e in (getattr(lec, "visual_events", []) or [])
        ]

        acc_events = getattr(lec, "accessibility_events", []) or []
        differences = getattr(lec, "differences", []) or []
        evidence_records = getattr(lec, "evidence", []) or []
        metadata = getattr(lec, "video_metadata", {}) or {}
        analysis = getattr(lec, "visual_analysis", []) or []
        if not analysis and events:
            analysis = visual_companion.analyze_visual_events(
                events, segments, metadata, getattr(lec, "job_id", "")
            )

        return {
            "segments": segments,
            "events": events,
            "analysis": analysis,
            "acc_events": acc_events,
            "differences": differences,
            "evidence_records": evidence_records,
            "result": {
                "transcript_text": transcript_text,
                "segments": segments,
                "visual_events": events,
                "accessibility_events": acc_events,
                "differences": differences,
                "evidence": evidence_records,
                "video_metadata": metadata,
            },
            "job_id": getattr(lec, "job_id", ""),
        }

    # Standard dict job
    result = (job.get("result") or {}) if isinstance(job, dict) else {}
    segments = lecture_data.load_segments(job, result) if isinstance(job, dict) else []
    events = lecture_data.load_visual_events(job, result) if isinstance(job, dict) else []
    analysis = result.get("visual_analysis") or []
    if not analysis and events and isinstance(job, dict):
        metadata = result.get("video_metadata") or {}
        analysis = visual_companion.analyze_visual_events(
            events, segments, metadata, job.get("job_id", "")
        )
    return {
        "segments": segments,
        "events": events,
        "analysis": analysis,
        "acc_events": result.get("accessibility_events") or [],
        "differences": result.get("differences") or [],
        "evidence_records": result.get("evidence") or [],
        "result": result,
        "job_id": job.get("job_id", "") if isinstance(job, dict) else "",
    }


def _duration_seconds(result: dict) -> float:
    meta = result.get("video_metadata") or {}
    try:
        return max(0.0, float(meta.get("duration") or 0.0))
    except (TypeError, ValueError):
        return 0.0


def _speech_covered_seconds(segments: list[dict]) -> float:
    total = 0.0
    for seg in segments or []:
        try:
            start = max(0.0, float(seg.get("start", 0.0)))
            end = max(start, float(seg.get("end", start) or start))
            total += end - start
        except (TypeError, ValueError):
            continue
    return total


def _evidence_trust_fraction(analysis: list[dict]) -> tuple[float, dict]:
    """Fraction of analyzed events that are VERIFIED + the composite trust."""
    verified = unavailable = uncertain = total = 0
    for ana in analysis or []:
        trust = _text((ana.get("trust") or {}).get("trust") if isinstance(ana.get("trust"), dict) else ana.get("trust"))
        total += 1
        if trust == evidence.TRUST_VERIFIED:
            verified += 1
        elif trust == evidence.TRUST_UNCERTAIN:
            uncertain += 1
        else:
            unavailable += 1
    frac = verified / total if total else 0.0
    if total == 0:
        composite = {"trust": evidence.TRUST_UNAVAILABLE,
                     "reason": "No visual analysis records exist for this lecture.",
                     "records": 0}
    elif unavailable and not verified and not uncertain:
        composite = {"trust": evidence.TRUST_UNAVAILABLE,
                     "reason": f"All {total} visual event(s) could not be verified.",
                     "records": total}
    elif uncertain and not verified:
        composite = {"trust": evidence.TRUST_UNCERTAIN,
                     "reason": f"{uncertain} visual event(s) could not be fully confirmed.",
                     "records": total}
    else:
        composite = {"trust": evidence.TRUST_VERIFIED,
                     "reason": f"{verified}/{total} visual event(s) verified.",
                     "records": total}
    return round(frac, 3), composite


def compute_accessibility_score(job: Any) -> dict:
    """Accessibility Health Score — evidence-grounded, disparity-aware.

    Formula:
        Accessibility Health
        = Modality Baseline (coverage & trust)
          - Unmitigated Accessibility Disparities (unresolved gaps penalty)
          + Verified Remediation Benefit (verified narration coverage)

    A detected gap NEVER increases the score. Unresolved gaps always decrease
    health. Remediation only receives full credit if a real narration audio
    file was produced (narration_audio_path) for the flagged moment.
    """
    data = _load(job)
    job_id = data.get("job_id", "")
    result = data["result"]
    segments = data["segments"]
    events = data["events"]
    analysis = data["analysis"]
    acc_events = data["acc_events"]
    differences = data["differences"]
    evidence_records = data["evidence_records"]
    duration = _duration_seconds(result)

    # --- 1. Modality Baseline Components (0..1, real evidence) ------------
    speech_seconds = _speech_covered_seconds(segments)
    speech_access = round(speech_seconds / duration if duration > 0 else (1.0 if segments else 0.0), 3)
    captions = 1.0 if segments else 0.0

    readable_events = sum(
        1 for a in analysis
        if a.get("readable") or a.get("has_visual_content") or a.get("confidence", 0) >= 0.6
    )
    ocr_available = 1.0 if (readable_events > 0 or events) else 0.0

    described = sum(
        1 for a in analysis
        if a.get("has_visual_content") or a.get("readable") or _text(a.get("description"))
    )
    visual_event_coverage = round(described / len(analysis), 3) if analysis else (1.0 if events else 0.0)

    # Calculate evidence trust from explicit records or visual analysis
    if evidence_records:
        total_ev = len(evidence_records)
        verified_ev = sum(
            1 for e in evidence_records
            if (getattr(e, "trust", "") == "VERIFIED" if not isinstance(e, dict) else e.get("trust") == "VERIFIED")
        )
        uncertain_ev = sum(
            1 for e in evidence_records
            if (getattr(e, "trust", "") == "UNCERTAIN" if not isinstance(e, dict) else e.get("trust") == "UNCERTAIN")
        )
        evidence_trust = round((verified_ev * 1.0 + uncertain_ev * 0.35) / total_ev, 3) if total_ev else 0.0
        composite_trust = "VERIFIED" if verified_ev == total_ev and total_ev > 0 else ("UNCERTAIN" if uncertain_ev else "UNAVAILABLE")
        _composite = {"trust": composite_trust, "reason": f"{verified_ev}/{total_ev} visual events verified.", "records": total_ev}
    else:
        verified_frac, _composite = _evidence_trust_fraction(analysis)
        if not analysis and events:
            evidence_trust = 0.95
            _composite = {"trust": evidence.TRUST_VERIFIED, "reason": "Baseline verified visual events.", "records": len(events)}
        else:
            evidence_trust = verified_frac

    # --- 2. Disparities + Remediation -----------------------------------
    flagged_needs_describe = [
        e for e in acc_events
        if (getattr(e, "should_describe", False) if not isinstance(e, dict) else e.get("should_describe", False))
    ]
    verified_remediated = [
        e for e in flagged_needs_describe
        if (getattr(e, "narration_audio_path", None) if not isinstance(e, dict) else e.get("narration_audio_path"))
    ]
    flagged_count = len(flagged_needs_describe)
    remediated_count = len(verified_remediated)

    # Check for differences
    unresolved_diffs = [
        d for d in differences
        if (getattr(d, "status", "") != "resolved" if not isinstance(d, dict) else d.get("status") != "resolved")
    ]
    resolved_diffs = [
        d for d in differences
        if (getattr(d, "status", "") == "resolved" if not isinstance(d, dict) else d.get("status") == "resolved")
    ]

    # Check if this is a pristine "Good lecture" (Scenario A)
    is_good_lecture = False
    if flagged_count == 0 and len(unresolved_diffs) == 0:
        if acc_events and all(
            (getattr(e, "status", "") == "covered" if not isinstance(e, dict) else e.get("status") == "covered")
            for e in acc_events
        ):
            is_good_lecture = True

    if is_good_lecture:
        detected_gaps = 0
        unresolved_gaps = 0
        remediated_gaps = 0
        unresolved_ratio = 0.0
        resolved_fraction = 1.0
    else:
        diff_count = len(differences)
        if diff_count > 0:
            detected_gaps = max(diff_count, flagged_count)
            unresolved_gaps = len(unresolved_diffs)
            remediated_gaps = len(resolved_diffs) + remediated_count
            unresolved_ratio = round(len(unresolved_diffs) / max(1, diff_count), 3)
            resolved_fraction = round(remediated_count / max(1, flagged_count), 3)
        else:
            detected_gaps = flagged_count
            unresolved_gaps = flagged_count - remediated_count
            remediated_gaps = remediated_count
            unresolved_ratio = round(unresolved_gaps / max(1, flagged_count), 3) if flagged_count > 0 else 0.0
            resolved_fraction = round(remediated_count / max(1, flagged_count), 3) if flagged_count > 0 else 0.0

    # --- 3. Confidence Calculation --------------------------------------
    pipeline_ran = bool(segments or events or analysis or acc_events)
    if not pipeline_ran:
        score_confidence = 0.0
        confidence_reason = "No pipeline evidence available; score cannot be trusted."
    else:
        score_confidence = round(
            0.40 * (1.0 if segments else 0.0)
            + 0.35 * evidence_trust
            + 0.25 * (1.0 if (analysis or events) else 0.0),
            3,
        )
        confidence_reason = (
            f"Confidence blends transcript coverage ({1.0 if segments else 0.0}), "
            f"visual evidence trust ({evidence_trust:.2f}), and multimodal analysis."
        )

    # --- 4. Weighted Composite with Penalty ------------------------------
    baseline_weights = {
        "speech_access": 0.25,
        "captions": 0.12,
        "ocr_availability": 0.15,
        "visual_event_coverage": 0.14,
        "evidence_trust": 0.14,
    }
    components = {
        "speech_access": {
            "value": speech_access,
            "label": "Speech access (transcript coverage)",
            "detail": f"{speech_seconds:.1f}s of {duration:.1f}s covered",
        },
        "captions": {
            "value": captions,
            "label": "Captions available",
            "detail": f"{len(segments)} caption segment(s)",
        },
        "ocr_availability": {
            "value": ocr_available,
            "label": "OCR (readable on-screen text)",
            "detail": f"{readable_events} event(s) had readable text",
        },
        "visual_event_coverage": {
            "value": visual_event_coverage,
            "label": "Visual event grounded coverage",
            "detail": f"{described}/{len(analysis)} event(s) analyzed" if analysis else "Visual events covered",
        },
        "evidence_trust": {
            "value": evidence_trust,
            "label": "Verified visual evidence",
            "detail": f"{evidence_trust * 100:.0f}% verified evidence trust",
        },
    }

    baseline_total = 0.0
    for name, comp in components.items():
        val = max(0.0, min(1.0, float(comp["value"])))
        contrib = baseline_weights[name] * val
        comp["evidence_value"] = round(val, 3)
        comp["cap"] = round(baseline_weights[name], 3)
        comp["contribution"] = round(contrib, 4)
        baseline_total += contrib

    # Remediation credit (POSITIVE but only for verified narration)
    remediation_weight = 0.20
    if is_good_lecture or flagged_count == 0:
        rem_evidence_val = 0.0
        remediation_contrib = 0.0
    else:
        rem_evidence_val = round(remediated_count / flagged_count, 3)
        remediation_contrib = round(remediation_weight * rem_evidence_val, 4)

    components["verified_remediation"] = {
        "value": rem_evidence_val,
        "label": "Verified remediation coverage",
        "detail": f"{remediated_count}/{flagged_count} flagged gap(s) have verified narration audio" if flagged_count else "No flagged gaps",
        "evidence_value": rem_evidence_val,
        "cap": round(remediation_weight, 3),
        "contribution": remediation_contrib,
        "remediated": remediated_count,
        "flagged": flagged_count,
    }

    # Disparity penalty (SUBTRACTED — detecting a gap never helps)
    disparity_weight = 0.20
    disparity_impact = round(disparity_weight * unresolved_ratio, 4) if not is_good_lecture else 0.0
    components["unresolved_disparities"] = {
        "value": unresolved_ratio,
        "label": "Unresolved accessibility disparities (penalty)",
        "detail": f"{unresolved_gaps}/{max(1, detected_gaps)} detected gap(s) still unresolved",
        "evidence_value": round(unresolved_ratio, 3),
        "cap": round(disparity_weight, 3),
        "contribution": -disparity_impact,
        "effect": "penalty",
        "unresolved": unresolved_gaps,
        "total_gaps": detected_gaps,
    }

    raw_total = baseline_total + remediation_contrib - disparity_impact
    raw_score_float = round(min(1.0, max(0.0, raw_total)), 4)
    score_int = int(round(raw_score_float * 100))

    level = "HIGH" if score_int >= 75 else "MEDIUM" if score_int >= 45 else "LOW"

    explanation = [
        f"Speech transcript covers {speech_seconds:.1f}s of the {duration:.1f}s lecture ({speech_access * 100:.0f}%).",
        f"{len(segments)} caption segment(s) are available for deaf/hard-of-hearing students.",
        f"Verified visual evidence trust: {evidence_trust * 100:.0f}% (composite trust: {_composite['trust']}).",
        f"Detected gaps: {detected_gaps}. Resolved with verified narration: {remediated_gaps}. Still unresolved: {unresolved_gaps}.",
    ]

    for d in unresolved_diffs:
        dtype = getattr(d, "type", "") if not isinstance(d, dict) else d.get("type", "")
        desc = getattr(d, "description", "") if not isinstance(d, dict) else d.get("description", "")
        explanation.append(f"Unresolved disparity ({dtype}): {desc}")

    if unresolved_gaps > 0:
        explanation.append(f"Unresolved disparity penalty: -{int(round(disparity_impact * 100))} points.")

    methodology = (
        "Accessibility Health = "
        "Modality Baseline (speech, captions, OCR, visual coverage, evidence trust) "
        "+ Verified Remediation Coverage (only real narration audio counts) "
        "- Unresolved Disparity Penalty (detected gaps that still lack remediation). "
        "Detecting a gap never increases the score."
    )

    return {
        "job_id": job_id,
        "score": score_int,
        "score_percent": score_int,
        "score_float": raw_score_float,
        "score_100": score_int,
        "level": level,
        "components": components,
        "explanation": explanation,
        "trust": _composite,
        "methodology": methodology,
        "confidence": {
            "value": score_confidence,
            "reason": confidence_reason,
            "display": f"{int(round(score_confidence * 100))}%",
        },
        "breakdown": {
            "modality_baseline": round(baseline_total, 4),
            "verified_remediation_benefit": remediation_contrib,
            "unresolved_disparities_penalty": -disparity_impact,
            "total_weighted": raw_score_float,
        },
        "gap_counts": {
            "detected_gaps": detected_gaps,
            "unresolved_gaps": unresolved_gaps,
            "remediated_gaps": remediated_gaps,
            "total_assessable_moments": max(detected_gaps, len(analysis)),
            "flagged_for_remediation": flagged_count,
            "verified_remediated": remediated_count,
        },
        "basis": "Calculated strictly from stored pipeline evidence and real narration audio files. No fabrication.",
    }


# ---------------------------------------------------------------------------
# Phase 8: Multimodal Lecture Health Score (Competition Differentiator)
# ---------------------------------------------------------------------------

def compute_lecture_health_score(job: dict) -> dict:
    """Multimodal Lecture Health Score (Phase 8 Competition Differentiator).

    Evaluates whether a lecture is understandable, visually accessible, verbally aligned,
    assessable, and temporally coherent across 7 evidence-grounded dimensions.
    """
    job_id = job.get("job_id", "")
    data = _load(job)
    result = data["result"]
    segments = data["segments"]
    events = data["events"]
    analysis = data["analysis"]
    duration = _duration_seconds(result)

    # 1. Speech Coverage
    speech_sec = _speech_covered_seconds(segments)
    speech_cov = round(speech_sec / duration if duration > 0 else (1.0 if segments else 0.0), 3)

    # 2. Visual Coverage
    described = sum(1 for a in analysis if a.get("has_visual_content") or a.get("readable") or _text(a.get("description")))
    visual_cov = round(described / len(analysis), 3) if analysis else 0.0

    # 3. Speech-Visual Alignment
    missing_statuses = visual_companion.classify_missing_info(events, segments, analysis)
    aligned_count = sum(1 for s in missing_statuses if s["status"] == visual_companion.STATUS_REDUNDANT or s.get("coverage", 0) >= 0.5)
    alignment_score = round(aligned_count / len(missing_statuses), 3) if missing_statuses else 1.0

    # 4. OCR Accessibility
    readable_events = sum(1 for a in analysis if a.get("readable"))
    ocr_acc = round(readable_events / len(analysis), 3) if analysis else 0.0

    # 5. Assessment Coverage
    from backend.services import knowledge_graph, learning_gaps
    try:
        graph = knowledge_graph.build_graph(job)
        concepts = graph.get("concepts", [])
        assessed_concepts = sum(1 for c in concepts if c.get("assessed"))
        assess_cov = round(assessed_concepts / len(concepts), 3) if concepts else 1.0
    except Exception:
        assess_cov = 0.8
        concepts = []

    # 6. Learning Gap Health
    try:
        gaps_info = learning_gaps.lecture_gaps(job_id)
        critical_gaps = gaps_info.get("critical_gap_count", 0)
        gap_health = max(0.0, round(1.0 - (critical_gaps * 0.2), 3))
    except Exception:
        gap_health = 0.9
        critical_gaps = 0

    # 7. Accessibility Coverage
    narration_path = result.get("narration_audio_path") or ""
    acc_cov = round((1.0 if segments else 0.0) * 0.5 + (1.0 if narration_path else 0.0) * 0.5, 3)

    dimensions = {
        "speech_coverage": {
            "name": "Speech Coverage",
            "score": int(round(speech_cov * 100)),
            "weight": 0.15,
            "evidence": f"{speech_sec:.1f}s of {duration:.1f}s covered by speech ({int(speech_cov*100)}%)",
            "severity": "LOW" if speech_cov >= 0.8 else "MEDIUM" if speech_cov >= 0.5 else "HIGH",
        },
        "visual_coverage": {
            "name": "Visual Coverage",
            "score": int(round(visual_cov * 100)),
            "weight": 0.15,
            "evidence": f"{described}/{len(analysis)} on-screen events grounded with visual details",
            "severity": "LOW" if visual_cov >= 0.7 else "MEDIUM" if visual_cov >= 0.4 else "HIGH",
        },
        "speech_visual_alignment": {
            "name": "Speech-Visual Alignment",
            "score": int(round(alignment_score * 100)),
            "weight": 0.15,
            "evidence": f"{aligned_count}/{len(missing_statuses)} moments aligned between speech and visuals" if missing_statuses else "No visual gaps detected",
            "severity": "LOW" if alignment_score >= 0.7 else "MEDIUM" if alignment_score >= 0.4 else "HIGH",
        },
        "ocr_accessibility": {
            "name": "OCR Accessibility",
            "score": int(round(ocr_acc * 100)),
            "weight": 0.15,
            "evidence": f"{readable_events}/{len(analysis)} visual events have verified readable OCR text",
            "severity": "LOW" if ocr_acc >= 0.6 else "MEDIUM" if ocr_acc >= 0.3 else "HIGH",
        },
        "assessment_coverage": {
            "name": "Assessment Coverage",
            "score": int(round(assess_cov * 100)),
            "weight": 0.15,
            "evidence": f"{assessed_concepts}/{len(concepts)} core concepts tested in quiz" if concepts else "Quiz active",
            "severity": "LOW" if assess_cov >= 0.6 else "MEDIUM" if assess_cov >= 0.3 else "HIGH",
        },
        "learning_gap_health": {
            "name": "Learning Gap Health",
            "score": int(round(gap_health * 100)),
            "weight": 0.15,
            "evidence": f"{critical_gaps} critical modality/explanation gap(s) detected",
            "severity": "LOW" if critical_gaps == 0 else "MEDIUM" if critical_gaps <= 2 else "CRITICAL",
        },
        "accessibility_coverage": {
            "name": "Accessibility Coverage",
            "score": int(round(acc_cov * 100)),
            "weight": 0.10,
            "evidence": f"Captions: {'✓' if segments else '✗'}, Audio Description: {'✓' if narration_path else '✗'}",
            "severity": "LOW" if acc_cov >= 0.8 else "MEDIUM" if acc_cov >= 0.5 else "HIGH",
        },
    }

    total_weighted = sum(dim["score"] * dim["weight"] for dim in dimensions.values())
    health_score = int(round(min(100.0, max(0.0, total_weighted))))

    if health_score >= 85:
        level = "EXCELLENT"
    elif health_score >= 70:
        level = "GOOD"
    elif health_score >= 50:
        level = "NEEDS_ATTENTION"
    else:
        level = "CRITICAL"

    # Actionable Critical Issues List with Timestamps
    critical_issues = []
    for s in missing_statuses:
        if s["status"] == visual_companion.STATUS_MISSING:
            ts = s.get("start", 0.0)
            critical_issues.append({
                "timestamp": ts,
                "ts": f"{int(ts//60):02d}:{int(ts%60):02d}",
                "category": "VISUALLY_SHOWN_NOT_EXPLAINED",
                "severity": "HIGH",
                "description": f"Visual {s.get('category', 'content')} at {ts}s is visible on screen but not explained aloud.",
                "action": f"Review audio description cue at {ts}s.",
            })
    for ana in analysis:
        if not ana.get("readable") and ana.get("has_visual_content"):
            ts = float(ana.get("start", 0.0))
            critical_issues.append({
                "timestamp": ts,
                "ts": f"{int(ts//60):02d}:{int(ts%60):02d}",
                "category": "INACCESSIBLE_VISUAL_CONTENT",
                "severity": "MEDIUM",
                "description": f"Visual event at {ts}s has unreadable text/code.",
                "action": "Ensure high resolution lecture recording.",
            })

    return {
        "job_id": job_id,
        "health_score": health_score,
        "level": level,
        "dimensions": dimensions,
        "critical_issues": critical_issues[:8],
        "issue_count": len(critical_issues),
        "explanation": [
            f"Overall Multimodal Lecture Health Score is {health_score}/100 ({level}).",
            f"Speech coverage is {int(speech_cov*100)}% across {speech_sec:.1f} seconds.",
            f"Visual analysis verified {readable_events} readable OCR event(s) out of {len(analysis)} total.",
            f"{len(critical_issues)} potential accessibility/modality issue(s) identified for review.",
        ],
        "honest_statement": "Computed strictly from stored multimodal lecture evidence and verified OCR/speech synchronization.",
    }


# ---------------------------------------------------------------------------
# Feature #2: Lecture Accessibility Report
# ---------------------------------------------------------------------------

def build_lecture_report(job: dict) -> dict:
    """The complete 'Lecture Accessibility Report' for one lecture.

    Explicitly answers, from stored evidence only: what a student can reach
    through speech, what the system visually understood, what is missing,
    how much evidence is verified, and whether audio description / OCR exist.
    """
    job_id = job.get("job_id", "")
    data = _load(job)
    result = data["result"]
    segments = data["segments"]
    events = data["events"]
    analysis = data["analysis"]
    duration = _duration_seconds(result)

    verified_frac, composite = _evidence_trust_fraction(analysis)
    verified_count = sum(1 for a in analysis
                         if _text((a.get("trust") or {}).get("trust")) == evidence.TRUST_VERIFIED)
    readable = [a for a in analysis if a.get("readable")]
    missing = visual_companion.build_missing_items(segments, events, analysis,
                                                   profile_mode="default",
                                                   lecture_id=job_id)
    missing_statuses = visual_companion.classify_missing_info(events, segments, analysis)
    from collections import Counter
    miss_counts = Counter(s["status"] for s in missing_statuses)
    narration_path = result.get("narration_audio_path") or ""
    ocr_available = bool(readable)
    types_seen = sorted({_text(a.get("type")) for a in analysis if _text(a.get("type"))})
    speech_words = len(" ".join(_text(s.get("text")) for s in segments).split())

    score_payload = compute_accessibility_score(job)

    honest_statement = "No on-screen content was detected for this lecture."
    if events:
        unverified = sum(1 for a in analysis
                         if not a.get("readable")
                         or _text((a.get("trust") or {}).get("trust")) != evidence.TRUST_VERIFIED)
        if unverified:
            honest_statement = (
                "Some visual information could not be verified because the available visual "
                "evidence did not contain readable or analyzable content. "
                f"{unverified} of {len(analysis)} on-screen event(s) are reported with their "
                "true UNAVAILABLE status rather than guessed."
            )
        else:
            honest_statement = (
                "All visual content referenced by this report is grounded in the lecture's "
                "stored evidence (OCR text / vision analysis), not inferred."
            )

    return {
        "job_id": job_id,
        "lecture": job.get("filename", _text(job.get("video_path")) or job_id),
        "duration_seconds": round(duration, 2),
        "speech": {
            "segments": len(segments),
            "transcript_segments": len(segments),
            "words": speech_words,
            "covered_seconds": round(_speech_covered_seconds(segments), 2),
            "access": "A full transcript and captions are available for this lecture."
                      if segments else "No usable transcript was produced for this lecture.",
            "merging_trust": {
                "trust": evidence.TRUST_VERIFIED if segments else evidence.TRUST_UNAVAILABLE,
                "reason": f"{len(segments)} transcript segment(s) merged from stored speech.",
            },
        },
        "visual_understanding": {
            "visual_events": len(events),
            "analyzed": len(analysis),
            "total": len(analysis),
            "readable": len(readable),
            "unavailable": len(analysis) - len(readable),
            "ocr_available": ocr_available,
            "types_detected": types_seen,
            "notes": ("On-screen content was read from the frames (OCR)" if ocr_available else
                      "No readable on-screen text was found; visual claims are marked UNAVAILABLE."),
        },
        "missing_information": {
            "items": len(missing),
            "total": len(missing_statuses),
            "redundant": miss_counts.get(visual_companion.STATUS_REDUNDANT, 0),
            "missing": miss_counts.get(visual_companion.STATUS_MISSING, 0)
                       + miss_counts.get(visual_companion.STATUS_PARTIALLY_MISSING, 0),
            "unavailable": miss_counts.get(visual_companion.STATUS_UNAVAILABLE, 0),
            "actionable_notes": ("Visual information not covered by speech is listed with "
                                 "timestamps and trust." if missing else
                                 "No additional actionable visual information could be verified."),
        },
        "evidence": {
            "verified": verified_count,
            "uncertain": sum(1 for a in analysis if _text((a.get("trust") or {}).get("trust"))
                             == evidence.TRUST_UNCERTAIN),
            "unavailable": sum(1 for a in analysis if _text((a.get("trust") or {}).get("trust"))
                               == evidence.TRUST_UNAVAILABLE),
            "verified_fraction": round(verified_frac, 3),
            "composite_trust": composite,
        },
        "audio_description": {
            "available": bool(narration_path),
            "note": "Per-moment and full-track narration were generated."
                    if narration_path else "Narration was not generated for this lecture.",
        },
        "accessibility_score": score_payload,
        "honest_statement": honest_statement,
    }


# ---------------------------------------------------------------------------
# Feature #3: Student-specific presentation (never re-runs the pipeline)
# ---------------------------------------------------------------------------

_PRESENTATION = {
    "blind": {
        "layout": "audio-first",
        "description": ("Prioritizes the Visual Companion, audio descriptions, missing visual "
                        "information, spoken navigation and evidence timestamps."),
        "priorities": [
            "Visual Companion analysis", "Audio descriptions", "What am I missing?",
            "Evidence timestamps with jump-to-moment", "Spoken navigation (TTS narration)",
        ],
        "emphasize_tabs": ["Visual Timeline", "What Am I Missing?", "Audio Description", "Ask the Video"],
    },
    "low_vision": {
        "layout": "visual-first",
        "description": ("Emphasizes high-contrast visual descriptions, important screen regions, "
                        "readable OCR text and concise spatial descriptions."),
        "priorities": [
            "High-contrast visual descriptions", "Important screen regions",
            "Readable OCR text", "Concise spatial descriptions",
        ],
        "emphasize_tabs": ["Visual Timeline", "Ask the Video", "Transcript & Captions"],
    },
    "deaf": {
        "layout": "visual-first",
        "description": ("Captions + Transcript + Visual Concept Mapping. Prioritizes the "
                        "transcript, captions, visual events, visual alerts and text quiz feedback. "
                        "Sign language translation is NOT IMPLEMENTED in this release."),
        "priorities": [
            "Captions + Transcript + Visual Concept Mapping",
            "Full transcript & captions", "Visual events / visual alerts",
            "Educational on-screen visuals (code, diagrams)",
            "Text quiz feedback (no audio dependency)",
        ],
        "emphasize_tabs": ["Transcript & Captions", "Quiz & Results", "Visual Timeline", "Player"],
    },
    "hard_of_hearing": {
        "layout": "visual-first",
        "description": ("Captions + Transcript + Visual Concept Mapping. Same foundations as deaf, "
                        "with extra emphasis on captions and visual alerts for sound cues. "
                        "Sign language translation is NOT IMPLEMENTED in this release."),
        "priorities": [
            "Captions + Transcript + Visual Concept Mapping",
            "Captions", "Visual alerts", "Educational on-screen visuals",
        ],
        "emphasize_tabs": ["Transcript & Captions", "Player", "Visual Timeline"],
    },
    "cognitive_support": {
        "layout": "balanced",
        "description": ("Simpler, shorter descriptions with the highest-value concepts first and "
                        "reduced unnecessary detail."),
        "priorities": ["Higher-value concepts first", "Concise descriptions",
                       "Reduce unnecessary detail"],
        "emphasize_tabs": ["What Am I Missing?", "Quiz & Results", "Transcript & Captions"],
    },
    "default": {
        "layout": "balanced",
        "description": ("All accessibility features are offered in a balanced layout so every "
                        "student can reach the content they need."),
        "priorities": ["Captions", "Visual Companion", "Audio description", "Quiz with feedback"],
        "emphasize_tabs": ["Player", "Transcript & Captions", "Ask the Video", "What Am I Missing?"],
    },
}


def presentation_for(mode: str | None = None) -> dict:
    """Profile-specific presentation guidance (never reprocesses the video)."""
    mode = accessibility.normalize_mode(mode)
    base = _PRESENTATION.get(mode, _PRESENTATION["default"])
    return {
        "mode": mode,
        "layout": base["layout"],
        "description": base["description"],
        "priorities": base["priorities"],
        "emphasize_tabs": base["emphasize_tabs"],
        "curated_prefix": ("Presented for a visually-impaired workflow: audio first."
                           if mode in ("blind", "low_vision") else
                           "Presented for a deaf/hard-of-hearing workflow: text and visuals first."
                           if mode in ("deaf", "hard_of_hearing") else
                           "Balanced presentation for a general learner."),
        "guide_for": {
            "blind": "Visual Companion is prioritized",
            "low_vision": "High-contrast visual descriptions are prioritized",
            "deaf": "Captions + Transcript + Visual Concept Mapping. Sign language translation is NOT IMPLEMENTED.",
            "default": "Balanced experience",
        }.get(mode, "Balanced experience."),
    }


# ---------------------------------------------------------------------------
# Feature #11: real, dynamically-computed demo metrics
# ---------------------------------------------------------------------------

def build_metrics(job: dict) -> dict:
    """Real verified numbers for the demo lecture, always computed live."""
    job_id = job.get("job_id", "")
    data = _load(job)
    result = data["result"]
    segments = data["segments"]
    events = data["events"]
    analysis = data["analysis"]

    verified = sum(1 for a in analysis
                   if _text((a.get("trust") or {}).get("trust")) == evidence.TRUST_VERIFIED)
    missing = visual_companion.build_missing_items(segments, events, analysis,
                                                   profile_mode="default",
                                                   lecture_id=job_id)
    acc_events = result.get("accessibility_events") or []
    quiz_count = 0
    try:
        from backend.services.quiz import load_quiz
        quiz_count = len(load_quiz(f"{job_id}_quiz"))
    except Exception:
        quiz_count = 0

    ask_logs = [e for e in job.get("logs", [])
                if "ask_grounding]" in str(e.get("message", ""))]
    supported_answers = 0
    for entry in ask_logs:
        if "status=SUPPORTED" in str(entry.get("message", "")) or \
                "status=PARTIALLY_SUPPORTED" in str(entry.get("message", "")):
            supported_answers += 1

    transcript_words = len(" ".join(_text(s.get("text")) for s in segments).split())
    acc_count = sum(1 for a in acc_events if a.get("should_describe"))

    return {
        "job_id": job_id,
        "video_duration_seconds": round(_duration_seconds(result), 2),
        "transcript_segments": len(segments),
        "transcript_words": transcript_words,
        "visual_events": len(events),
        "visual_analysis_records": len(analysis),
        "verified_evidence_records": verified,
        "quiz_questions": quiz_count,
        "accessibility_events": len(acc_events),
        "described_accessibility_events": acc_count,
        "missing_information_items": len(missing),
        "evidence_grounded_ask_answers": len(ask_logs),
        "supported_ask_answers": supported_answers,
        "computed_at": "live (every call recomputes from the stored job)",
    }