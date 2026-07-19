"""Deterministic grey-box growth and stress engine.

Single source of truth for crop profiles, stress weights, tolerances, hard limits,
and the stress / growth / yield formulae. Both the dataset generator
(``scripts/generate_synthetic_dataset.py``) and the prediction endpoint import
from here so the two cannot drift.

Issue #9 scope: module + tests + generator refactor only.  The ``/api/sim/predict``
endpoint is wired to these functions in the *next* task.
"""
from __future__ import annotations

from app.sim.dataset import normalize_crop


# ---------------------------------------------------------------------------
# Crop profiles
# ---------------------------------------------------------------------------

# Crop-specific target conditions and growth-stage day ranges.
# Verbatim from the generator script — this is now the canonical copy.
#
# This table is the single source of truth for optimal targets: the predict endpoint reads it
# via optimal_targets() (sim.py no longer keeps its own _OPTIMALS), and the dashboard's
# CROPS[].optimal (app/dashboard/SimulationProvider.tsx) mirrors these values. Tomato
# air_temperature_c is 25.0 here (kept to keep the seeded CSV byte-identical); the dashboard was
# reconciled from 26.0 -> 25.0 to match. Keep any future change to a target in sync across this
# table and the dashboard.
CROP_PROFILES: dict[str, dict] = {
    "lettuce": {
        "source_profile": "osu_hydroponics_lettuce_profile",
        "targets": {
            "ph": 6.0,
            "ec": 1.2,
            "air_temperature_c": 20.0,
            "water_temperature_c": 19.0,
            "humidity_percent": 60.0,
            "co2_ppm": 800.0,
            "water_level_percent": 85.0,
            "light_hours": 14.0,
        },
        "stages": {
            "seedling": (1, 10),
            "vegetative": (11, 35),
            "harvest_ready": (36, 45),
        },
        # Per-stage optimal overrides (reasoned agronomic estimates, issue #5). Only the
        # UI-scored fields that shift by stage are listed; every other field falls back to the
        # crop-level ``targets`` above via optimal_targets(). stage=None keeps crop-level.
        "stage_targets": {
            "seedling":      {"ph": 6.0, "ec": 0.8, "air_temperature_c": 20.0, "humidity_percent": 65.0, "co2_ppm": 700.0},
            "vegetative":    {"ph": 5.8, "ec": 1.2, "air_temperature_c": 20.0, "humidity_percent": 60.0, "co2_ppm": 800.0},
            "harvest_ready": {"ph": 5.8, "ec": 1.4, "air_temperature_c": 18.0, "humidity_percent": 60.0, "co2_ppm": 800.0},
        },
    },
    "tomato": {
        "source_profile": "purdue_greenhouse_tomato_profile",
        "targets": {
            "ph": 6.0,
            "ec": 2.5,
            "air_temperature_c": 25.0,
            "water_temperature_c": 22.0,
            "humidity_percent": 70.0,
            "co2_ppm": 900.0,
            "water_level_percent": 85.0,
            "light_hours": 16.0,
        },
        "stages": {
            "seedling": (1, 14),
            "vegetative": (15, 42),
            "flowering": (43, 65),
            "fruiting": (66, 95),
            "harvest_ready": (96, 120),
        },
        "stage_targets": {
            "seedling":      {"ph": 6.0, "ec": 2.0, "air_temperature_c": 25.0, "humidity_percent": 75.0, "co2_ppm": 800.0},
            "vegetative":    {"ph": 6.0, "ec": 2.5, "air_temperature_c": 24.0, "humidity_percent": 70.0, "co2_ppm": 1000.0},
            "flowering":     {"ph": 6.0, "ec": 3.0, "air_temperature_c": 23.0, "humidity_percent": 65.0, "co2_ppm": 1000.0},
            "fruiting":      {"ph": 5.8, "ec": 3.5, "air_temperature_c": 23.0, "humidity_percent": 65.0, "co2_ppm": 900.0},
            "harvest_ready": {"ph": 5.8, "ec": 3.5, "air_temperature_c": 22.0, "humidity_percent": 65.0, "co2_ppm": 800.0},
        },
    },
}

# ---------------------------------------------------------------------------
# Stress parameters
# ---------------------------------------------------------------------------

# Relative impact of each field on the stress score.
# Higher weights make deviations in that field count more.
STRESS_WEIGHTS: dict[str, float] = {
    "ph": 18.0,
    "ec": 16.0,
    "air_temperature_c": 14.0,
    "water_temperature_c": 10.0,
    "humidity_percent": 10.0,
    "co2_ppm": 8.0,
    "water_level_percent": 14.0,
    "light_hours": 10.0,
}

# Deviation from target that saturates a field's stress contribution.
# Example: 1.0 pH unit away from target reaches the full pH stress weight.
TOLERANCES: dict[str, float] = {
    "ph": 1.0,
    "ec": 1.0,
    "air_temperature_c": 8.0,
    "water_temperature_c": 6.0,
    "humidity_percent": 30.0,
    "co2_ppm": 500.0,
    "water_level_percent": 50.0,
    "light_hours": 6.0,
}

# Hard bounds that keep environmental values within plausible ranges.
LIMITS: dict[str, tuple[float, float]] = {
    "ph": (4.0, 8.0),
    "ec": (0.5, 4.0),
    "air_temperature_c": (10.0, 40.0),
    "water_temperature_c": (10.0, 32.0),
    "humidity_percent": (25.0, 100.0),
    "co2_ppm": (300.0, 1200.0),
    "water_level_percent": (20.0, 100.0),
    "light_hours": (8.0, 20.0),
}

# Per-system multiplier on TOLERANCES: how forgiving the root zone is to a deviation.
# DWC's large water reservoir buffers pH / EC / temperature swings, so the same deviation
# produces less stress than in NFT's thin, low-buffer film. NFT = 1.0 is the baseline (the
# tolerances above already reflect a continuous-flow water culture). The *direction* is
# agronomically sound; the exact 1.3 is a tunable engineering estimate (thesis limitation).
SYSTEM_TOLERANCE_FACTORS: dict[str, float] = {
    "nft": 1.0,
    "dwc": 1.3,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def optimal_targets(crop: str, stage: str | None = None) -> dict[str, float]:
    """Return the optimal environment targets for a crop, optionally stage-specific.

    Starts from the crop-level ``targets`` and, when ``stage`` names a known growth stage,
    overlays that stage's overrides from ``stage_targets`` (issue #5). ``stage=None`` — or an
    unrecognised stage — returns the crop-level targets unchanged, so stage-unaware callers
    (the dataset generator, the calibration tests) are unaffected.

    Raises ``ValueError`` for unknown crops.
    """
    normalized = normalize_crop(crop)
    if normalized not in CROP_PROFILES:
        raise ValueError(f"Unknown crop '{crop}'")
    profile = CROP_PROFILES[normalized]
    targets = dict(profile["targets"])
    if stage is not None:
        targets.update(profile.get("stage_targets", {}).get(stage, {}))
    return targets


def stage_for_progress(crop: str, growth_percent: float | None) -> str | None:
    """Map a 0-100 growth percent to the crop's stage name via the stage day-ranges.

    Lets the predict endpoint resolve the current stage from ``growth_percent`` alone, so the
    frontend contract need not carry a stage string. Returns ``None`` when progress is unknown
    or the crop is unrecognised, so callers fall back to crop-level targets.
    """
    if growth_percent is None:
        return None
    normalized = normalize_crop(crop)
    if normalized not in CROP_PROFILES:
        return None
    stages = CROP_PROFILES[normalized]["stages"]
    max_day = max(hi for _lo, hi in stages.values())
    day = max(0.0, min(100.0, growth_percent)) / 100.0 * max_day
    for name, (_lo, hi) in stages.items():
        if day <= hi:
            return name
    return next(reversed(stages))


def normalize_system(system: str | None) -> float:
    """Return the tolerance multiplier for a hydroponic system.

    Case-insensitive. Any unknown / missing value falls back to 1.0 (NFT baseline),
    so a stray system string can never raise — it just behaves as the reference system.
    """
    if system is None:
        return 1.0
    return SYSTEM_TOLERANCE_FACTORS.get(system.lower(), 1.0)


def compute_stress(
    env: dict[str, float],
    crop: str,
    stage: str | None = None,
    system: str | None = None,
) -> float:
    """Weighted normalised-deviation stress score in [0, 100].

    The score is rescaled by the weight actually supplied, so a partial sensor
    reading still spans the full 0-100 range.  Without this, a caller passing a
    subset of fields could never reach a high score: the UI sends only
    ph / ec / air_temperature_c / humidity_percent / co2_ppm, worth 66 of the
    100 available weight, capping stress at 66 and yield at ~24.

    ``STRESS_WEIGHTS`` sums to exactly 100, so when all eight fields are present
    the divisor is 100 and this reduces to the generator's ``calculate_stress``
    formula unchanged — the seeded CSV stays byte-identical.

    ``system`` scales the tolerances by ``SYSTEM_TOLERANCE_FACTORS`` (DWC's reservoir
    buffers deviations → less stress). ``system=None`` gives factor 1.0, so callers that
    omit it — including the dataset generator — are unaffected and the CSV stays identical.
    """
    targets = optimal_targets(crop, stage)
    factor = normalize_system(system)
    total = 0.0
    present_weight = 0.0
    for field, weight in STRESS_WEIGHTS.items():
        if field not in env:
            continue
        diff_ratio = abs(env[field] - targets[field]) / (TOLERANCES[field] * factor)
        total += min(1.0, diff_ratio) * weight
        present_weight += weight
    if present_weight == 0.0:
        return 0.0
    return round(max(0.0, min(100.0, total * 100.0 / present_weight)))


def compute_growth_rate(
    env: dict[str, float],
    crop: str,
    stage: str | None = None,
    system: str | None = None,
) -> float:
    """Per-tick growth multiplier in [0, 1].

    Returns 1.0 under ideal conditions and approaches 0.0 under severe stress.
    Simple and transparent — tweakable by non-ML experts (issue #9). ``system`` is
    forwarded to ``compute_stress`` so growth inherits the system's buffering.
    """
    return max(0.0, 1.0 - compute_stress(env, crop, stage, system) / 100.0)


# Health (vigor) dynamics — a stateful layer over the instantaneous stress score.
# The engine only produces a *rate*; the caller integrates it over ticks and clamps
# health to [0, 1], so the engine itself stays stateless. Rates are per simulated hour.
# Asymmetric by design: damage accrues faster than recovery, so sustained stress leaves
# a lasting deficit — this asymmetry is what makes the plant "remember".
# Neutral is below the ~27 a single saturated UI field produces (5 fields → present-weight 66),
# so one wrecked parameter (e.g. pH 8) declines health instead of sitting in the healing band.
HEALTH_STRESS_NEUTRAL = 15.0           # below this stress the plant heals, above it declines
HEALTH_DECAY_PER_HOUR = 1.0 / 72.0     # at max stress, full health lost in ~72 sim-hours (3 days)
HEALTH_RECOVERY_PER_HOUR = 1.0 / 360.0  # recovery ~5x slower than worst-case decay
# Extra health-stress per unit a single field is pushed PAST its tolerance (Liebig's law of the
# minimum: survival is limited by the worst factor, not the weighted average). e.g. pH 8 sits at
# 2x its tolerance -> excess 1.0 -> +40 health-stress on top of the (diluted) aggregate.
HEALTH_LIEBIG_SCALE = 40.0


def health_rate(stress_score: float) -> float:
    """Signed per-sim-hour change in plant health (vigor) for a stress score.

    Negative under stress (damage), positive under good conditions (recovery), zero at
    ``HEALTH_STRESS_NEUTRAL``. The caller integrates this over ticks and clamps health to
    [0, 1]; the engine stays stateless. Recovery is deliberately slower than decay, so a
    plant carries the memory of sustained stress and takes time to bounce back.

    Decay is **quadratic** in how far stress exceeds neutral: mild stress is largely
    tolerated (a slightly-off plant declines very slowly), while damage accelerates as
    conditions worsen, reaching full ``HEALTH_DECAY_PER_HOUR`` at stress 100. This matches
    how plants shrug off small deviations but fail quickly under severe ones — and avoids
    a mildly-suboptimal plant visibly wasting away.
    """
    if stress_score > HEALTH_STRESS_NEUTRAL:
        frac = (stress_score - HEALTH_STRESS_NEUTRAL) / (100.0 - HEALTH_STRESS_NEUTRAL)
        return -HEALTH_DECAY_PER_HOUR * frac * frac
    span = HEALTH_STRESS_NEUTRAL
    return HEALTH_RECOVERY_PER_HOUR * (HEALTH_STRESS_NEUTRAL - stress_score) / span


def health_stress(
    env: dict[str, float],
    crop: str,
    stage: str | None = None,
    system: str | None = None,
) -> float:
    """Effective stress for the HEALTH mechanic, applying Liebig's law of the minimum.

    ``compute_stress`` is a weighted average, which dilutes a single catastrophic field:
    pH 8 alone caps at ~27 because it is one of five inputs. But survival is limited by the
    *worst* factor — pH lockout is not offset by a perfect temperature. So on top of the
    aggregate we add ``HEALTH_LIEBIG_SCALE`` per unit that the worst field is pushed *past*
    its tolerance. Fields within tolerance (ratio <= 1) contribute nothing, so a mildly-off
    plant is unaffected and only a genuinely maxed-out parameter accelerates decline.
    """
    base = compute_stress(env, crop, stage, system)
    targets = optimal_targets(crop, stage)
    factor = normalize_system(system)
    worst_excess = 0.0
    for field in STRESS_WEIGHTS:
        if field not in env:
            continue
        ratio = abs(env[field] - targets[field]) / (TOLERANCES[field] * factor)
        # Clamp per-field excess to 1.0 (i.e. 2x tolerance). Otherwise a field whose tolerance is
        # narrow relative to its slider range (EC: tol 1.0, range 0.5-4.0) reaches a huge excess and
        # a single maxed field kills as fast as an all-wrecked plant. Capping makes every field's
        # worst case comparable and always less severe than a fully-wrecked environment.
        worst_excess = max(worst_excess, min(1.0, ratio - 1.0))
    return min(100.0, base + max(0.0, worst_excess) * HEALTH_LIEBIG_SCALE)


def predict_yield(stress: float) -> float:
    """Estimated harvest quality in [0, 100].

    Matches the generator's yield mapping exactly so the seeded CSV stays
    byte-identical: ``clamp(100 - round(stress * 1.15), 0, 100)``.
    """
    return max(0, min(100, 100 - round(stress * 1.15)))


def classify(stress_score: float) -> tuple[str, str]:
    """Return ``(risk_level, status)`` from a stress score.

    Moved verbatim from the generator script.
    """
    if stress_score >= 60:
        return "high", "critical"
    if stress_score >= 30:
        return "medium", "warning"
    return "low", "stable"
