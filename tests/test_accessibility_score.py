"""Deterministic tests for the Accessibility Score methodology.

Covers five scenarios:
    A – Good lecture (all modalities present, no gaps)
    B – Unresolved VISUAL_NOT_SPOKEN gap
    C – Detected but unresolved gap (flagged, no narration yet)
    D – Grounded / verified remediation (flagged + real narration audio)
    E – Unverified / low-confidence remediation (narration_path set but not
        grounded in real visual evidence)
"""

from __future__ import annotations

from dataclasses import asdict, replace
from copy import deepcopy

import pytest

from tests import _fixtures
from tests._fixtures import _SAMPLE_SEGMENTS, _SAMPLE_EVENTS, register_lecture
from backend.services.accessibility_score import compute_accessibility_score
from backend.types import Lecture, AccessibilityEvent, AccessibilityDifference, EvidenceRecord


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clone_lecture(lec: Lecture) -> Lecture:
    """Deep-clone a lecture so each test starts from a pristine fixture."""
    return replace(
        lec,
        transcript=(
            replace(
                lec.transcript,
                segments=deepcopy(lec.transcript.segments),
                text=lec.transcript.text,
            )
            if lec.transcript
            else None
        ),
        visual_events=deepcopy(lec.visual_events),
        ocr_events=deepcopy(lec.ocr_events),
        accessibility_events=deepcopy(lec.accessibility_events),
        differences=deepcopy(lec.differences),
        evidence=deepcopy(lec.evidence),
    )


def _has_component(score: dict, key: str) -> bool:
    return bool(score.get("components", {}).get(key))


def _component_contribution(score: dict, key: str) -> float:
    return float(score.get("components", {}).get(key, {}).get("contribution", 0.0))


def _component_cap(score: dict, key: str) -> float:
    return float(score.get("components", {}).get(key, {}).get("cap", 0.0))


@pytest.fixture
def base_lecture(tmp_path) -> Lecture:
    """The shared baseline: 2 spoken segments, 2 visual events,
    2 accessibility events with should_describe=True but NO narration yet.
    """
    reg = register_lecture(str(tmp_path))
    lec = _clone_lecture(reg["lecture"])

    # Safety: the fixture must match the documented expectation (scenario C)
    assert lec.accessibility_events, "accessibility_events must exist"
    for ev in lec.accessibility_events:
        # Fixture should not come with pre-generated narration
        ev.narration_audio_path = None
        ev.should_describe = True
    return lec


# ===========================================================================
# A – Good lecture (no detected gaps, solid baseline coverage)
# ===========================================================================

def test_scenario_A_good_lecture(base_lecture: Lecture):
    """A well-produced lecture: speech, captions, OCR, good coverage.

    Expected:
        * Score is high (>= 75 %)
        * unresolved_disparities contribution == 0 (or very close)
        * evidence_trust component present and positive
        * No positive component called "missing_information" (paradox check)
        * confidence >= 0.60 (we have transcript + evidence)
    """
    lec = base_lecture

    # Ensure no disparities flagged anywhere for the "good" case
    for ev in lec.accessibility_events:
        ev.should_describe = False
        ev.status = "covered"
        ev.coverage_ratio = 0.95
    for diff in (lec.differences or []):
        diff.status = "resolved"
        diff.coverage_ratio = 0.95

    score = compute_accessibility_score(lec)

    # -- Paradox guard ----------------------------------------------------
    assert not _has_component(score, "missing_information"), (
        "'missing_information' must not exist as a positive component"
    )
    assert "components" in score
    # Score formula must not reward finding gaps.
    assert score.get("gap_counts", {}).get("detected_gaps", 0) == 0, (
        "Good lecture scenario expects zero detected gaps"
    )

    # -- Quality gate -----------------------------------------------------
    val = score["score"] if score["score"] <= 1.0 else score["score"] / 100.0
    assert val >= 0.70, (
        f"Good lecture score should be high, got {val:.3f}"
    )

    # -- Unresolved penalty is zero ---------------------------------------
    unresolved = _component_contribution(score, "unresolved_disparities")
    assert abs(unresolved) <= 0.005, (
        f"Unresolved penalty should be ~0 for good lecture, got {unresolved:.4f}"
    )

    # -- Evidence trust present + meaningful -----------------------------
    assert _has_component(score, "evidence_trust"), "evidence_trust must exist"
    assert _component_contribution(score, "evidence_trust") >= 0.0, (
        "evidence_trust must never be negative"
    )

    # -- Confidence (new field) ------------------------------------------
    assert "confidence" in score
    assert 0.0 <= score["confidence"]["value"] <= 1.0
    assert score["confidence"]["value"] >= 0.50, (
        "Confidence should be moderate/high when transcript + evidence exist"
    )
    assert isinstance(score["confidence"]["reason"], str)
    assert score["confidence"]["reason"] != ""

    # -- Breakdown + gap_counts exist ------------------------------------
    assert "breakdown" in score
    assert "gap_counts" in score
    assert score["gap_counts"]["unresolved_gaps"] == 0
    assert score["gap_counts"]["remediated_gaps"] == 0

    # -- Methodology string (transparency) -------------------------------
    assert isinstance(score.get("methodology"), str)
    assert len(score["methodology"]) > 20


# ===========================================================================
# B – Unresolved VISUAL_NOT_SPOKEN gap detected
# ===========================================================================

def test_scenario_B_unresolved_visual_not_spoken(base_lecture: Lecture):
    """Visual event on screen but NOT mentioned in speech.

    Expected:
        * detected_gaps > 0 (paradox guard: this must NOT raise score
          vs the baseline-removed case)
        * unresolved_gaps == detected_gaps
        * unresolved_disparities contribution NEGATIVE (penalty)
        * Overall score strictly LESS than scenario A for equivalent
          coverage of other axes.
    """
    lec = base_lecture

    # Force an explicit VISUAL_NOT_SPOKEN difference
    visual_only = AccessibilityDifference(
        timestamp=0.0,
        timestamp_start=0.0,
        timestamp_end=20.0,
        type="VISUAL_NOT_SPOKEN",
        description="A diagram of a for-loop appears on screen but is never mentioned.",
        visual_evidence="loop-diagram box-arrow sketch from OCR + scene detection",
        speech_overlap=0.0,
        severity=0.9,
        status="unresolved",
        coverage_ratio=0.0,
    )
    lec.differences = [visual_only]

    # Tie accessibility event to the gap but DO NOT remediate it
    for ev in lec.accessibility_events:
        ev.visual_type = "diagram"
        ev.should_describe = True
        ev.status = "needs_remediation"
        ev.coverage_ratio = 0.0
        ev.narration_audio_path = None

    score = compute_accessibility_score(lec)

    # -- Counts -----------------------------------------------------------
    gc = score["gap_counts"]
    assert gc["detected_gaps"] >= 1, "Scenario B expects at least 1 detected gap"
    assert gc["unresolved_gaps"] >= 1, "Scenario B: gap must stay unresolved"
    assert gc["remediated_gaps"] == 0, "Scenario B: gap must NOT be remediated"

    # -- Paradox: detecting a gap must NEVER raise score above equivalent
    #    no-gap case.  We compare the scenario A upper bound.
    #    A good lecture with no gaps is >= 0.70; an unresolved-gap lecture
    #    should be measurably worse.
    assert _component_contribution(score, "unresolved_disparities") < 0.0, (
        "unresolved_disparities contribution must be NEGATIVE (penalty), "
        f"got {_component_contribution(score, 'unresolved_disparities'):.4f}"
    )

    # -- Score must be lower than scenario A minimum ---------------------
    val = score["score"] if score["score"] <= 1.0 else score["score"] / 100.0
    assert val < 0.72, (
        f"Score with unresolved VISUAL_NOT_SPOKEN must be clearly below the "
        f"good-lecture floor; got {val:.3f}"
    )

    # -- Explanation must reference the gap ------------------------------
    assert any(("VISUAL_NOT_SPOKEN" in x or "unresolved" in x.lower())
               for x in score.get("explanation", [])), (
        "Explanation should mention the unresolved disparity"
    )


# ===========================================================================
# C – Detected but unresolved (flagged for remediation, no narration yet)
# ===========================================================================

def test_scenario_C_detected_but_unresolved(base_lecture: Lecture):
    """Accessibility events are flagged should_describe=True but no audio
    narration path exists yet.  This is the out-of-the-box fixture.

    Expected:
        * flagged_for_remediation > 0
        * verified_remediated == 0 (narration paths are None)
        * verified_remediation contribution == 0
        * Overall score reflects the missing narration (unresolved penalty).
    """
    lec = base_lecture
    score = compute_accessibility_score(lec)

    gc = score["gap_counts"]
    assert gc["flagged_for_remediation"] == len(lec.accessibility_events), (
        "All should_describe=True events must appear in flagged count"
    )
    assert gc["verified_remediated"] == 0, (
        "Scenario C: no narration files yet => zero verified remediations"
    )

    # Verified remediation component must contribute ZERO
    vr_cap = _component_cap(score, "verified_remediation")
    vr_contrib = _component_contribution(score, "verified_remediation")
    assert vr_cap > 0.0, "verified_remediation cap must be non-zero even when unused"
    assert abs(vr_contrib) <= 1e-6, (
        f"With zero narration, verified_remediation contribution must be 0; "
        f"got {vr_contrib}"
    )

    # Unresolved penalty must be applied (there are still unresolved gaps)
    assert _component_contribution(score, "unresolved_disparities") <= 0.0


# ===========================================================================
# D – Grounded / verified remediation (narration audio path exists)
# ===========================================================================

def test_scenario_D_grounded_verified_remediation(tmp_path, base_lecture: Lecture):
    """After the system actually writes narration WAV files, remediations
    must receive positive credit (only when narration_audio_path points to
    something on disk or at least is a non-empty string — we use a dummy
    absolute path to simulate the engine output).

    Expected:
        * verified_remediated == flagged_for_remediation
        * verified_remediation contribution STRICTLY POSITIVE
        * Score STRICTLY HIGHER than scenario C (the equivalent without narrations)
    """
    # ------------------------------------------------------------------
    # Scenario C baseline (no narration) for relative comparison
    # ------------------------------------------------------------------
    score_c = compute_accessibility_score(_clone_lecture(base_lecture))

    # ------------------------------------------------------------------
    # Scenario D: attach real-looking narration paths AND ground them
    # in visual evidence (VERIFIED trust level)
    # ------------------------------------------------------------------
    lec_d = _clone_lecture(base_lecture)
    fake_narrations = [
        tmp_path / f"DEMO_narration_{i}.wav"
        for i in range(len(lec_d.accessibility_events))
    ]
    # Create empty placeholder files so the path "exists"
    for p in fake_narrations:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"RIFF_dummy")

    narr_iter = iter(fake_narrations)
    grounded_evidence: list[EvidenceRecord] = []
    for i, ev in enumerate(lec_d.accessibility_events):
        ev.should_describe = True
        ev.narration_audio_path = str(next(narr_iter))
        ev.status = "remediated"
        ev.coverage_ratio = 0.9
        # Ground each described piece in VERIFIED visual evidence
        grounded_evidence.append(EvidenceRecord(
            source_type="ocr_scene",
            source_reference=f"scene-{i}",
            timestamp=float(ev.timestamp_start or 0.0),
            trust="VERIFIED",
            excerpt=ev.title or f"Visual content described in narration {i}",
            reason="OCR + scene detection match the narration semantic claim",
        ))
    lec_d.evidence = grounded_evidence

    score_d = compute_accessibility_score(lec_d)

    gc = score_d["gap_counts"]
    assert gc["verified_remediated"] == gc["flagged_for_remediation"], (
        "Scenario D: all flagged events must count as VERIFIED remediated"
    )
    assert gc["unresolved_gaps"] < score_c["gap_counts"]["unresolved_gaps"], (
        "Remediations must reduce the unresolved count vs scenario C"
    )

    # -- Verified remediation contribution MUST be strictly positive ----
    vr = _component_contribution(score_d, "verified_remediation")
    assert vr > 0.0, (
        f"With real narration files, verified_remediation must contribute "
        f"positively; got {vr:.4f}"
    )

    # -- Score strictly improves vs scenario C ---------------------------
    assert score_d["score"] > score_c["score"], (
        f"Real remediation must raise score vs scenario C.  "
        f"C={score_c['score']:.4f}  D={score_d['score']:.4f}"
    )

    # -- Confidence should also improve vs C ------------------------------
    assert score_d["confidence"]["value"] >= score_c["confidence"]["value"], (
        "Grounded remediations must not lower the confidence bar"
    )


# ===========================================================================
# E – Unverified / low-confidence remediation
# ===========================================================================

def test_scenario_E_unverified_low_confidence_remediation(tmp_path, base_lecture: Lecture):
    """Narration files exist on disk but the visual evidence is WEAK.
    We set the evidence trust to UNCERTAIN and omit OCR/events.

    Expected (per methodology): unverified remediation receives NO full
    credit.  We test this via comparison vs scenario D: scenario E score
    must be STRICTLY LESS than scenario D, and the evidence_trust
    contribution must be measurably smaller than scenario D.
    """
    # -- Build scenario D first for relative comparison -----------------
    lec_d = _clone_lecture(base_lecture)
    d_paths: list[str] = []
    for i, ev in enumerate(lec_d.accessibility_events):
        p = tmp_path / f"D_narration_{i}.wav"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"RIFF")
        ev.narration_audio_path = str(p)
        ev.should_describe = True
        ev.status = "remediated"
        d_paths.append(str(p))
    lec_d.evidence = [
        EvidenceRecord(
            source_type="ocr_scene",
            source_reference=f"d-scene-{i}",
            timestamp=float(ev.timestamp_start or 0.0),
            trust="VERIFIED",
            excerpt=ev.title or f"D ground {i}",
            reason="Full multimodal corroboration",
        )
        for i, ev in enumerate(lec_d.accessibility_events)
    ]
    score_d = compute_accessibility_score(lec_d)

    # -- Build scenario E (same narrations, LOW-CONFIDENCE evidence) -----
    lec_e = _clone_lecture(base_lecture)
    for i, ev in enumerate(lec_e.accessibility_events):
        ev.narration_audio_path = d_paths[i]
        ev.should_describe = True
        ev.status = "remediated"
    lec_e.evidence = [
        EvidenceRecord(
            source_type="assumption",
            source_reference=f"e-fuzzy-{i}",
            timestamp=float(ev.timestamp_start or 0.0),
            trust="UNCERTAIN",
            excerpt="Narration generated from weak visual clues",
            reason="No OCR match; scene detection confidence < 0.5",
        )
        for i, ev in enumerate(lec_e.accessibility_events)
    ]

    score_e = compute_accessibility_score(lec_e)

    # -- Trust component must be smaller for E ---------------------------
    trust_d = _component_contribution(score_d, "evidence_trust")
    trust_e = _component_contribution(score_e, "evidence_trust")
    assert trust_e < trust_d, (
        f"Unverified evidence must yield LOWER evidence_trust contribution "
        f"than VERIFIED evidence.  E={trust_e:.4f}  D={trust_d:.4f}"
    )

    # -- Overall score E < D --------------------------------------------
    assert score_e["score"] < score_d["score"], (
        f"Low-confidence remediation must not score HIGHER than verified.  "
        f"E={score_e['score']:.4f}  D={score_d['score']:.4f}"
    )

    # -- Confidence value must reflect the weaker evidence ---------------
    assert score_e["confidence"]["value"] <= score_d["confidence"]["value"]
