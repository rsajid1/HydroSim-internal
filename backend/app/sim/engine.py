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
# Note on tomato air_temperature_c: the generator and this file use 25.0 to keep
# the seeded CSV byte-identical.  The dashboard (CROPS[].optimal) and _OPTIMALS in
# sim.py currently show 26.0 — that discrepancy is reconciled when the predict
# endpoint is wired to this engine (next task).
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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def optimal_targets(crop: str, stage: str | None = None) -> dict[str, float]:
    """Return the per-crop optimal environment targets.

    ``stage`` is accepted for forward-compat with issue #5 (stage-specific bands);
    v1 ignores it and returns crop-level targets.

    Raises ``ValueError`` for unknown crops.
    """
    normalized = normalize_crop(crop)
    if normalized not in CROP_PROFILES:
        raise ValueError(f"Unknown crop '{crop}'")
    return CROP_PROFILES[normalized]["targets"]


def compute_stress(
    env: dict[str, float],
    crop: str,
    stage: str | None = None,
) -> float:
    """Weighted normalised-deviation stress score in [0, 100].

    Reproduces the generator's ``calculate_stress`` formula exactly when all
    eight fields are present.  Fields absent from ``env`` are silently skipped
    so callers can pass a partial sensor reading (e.g. the UI sends only
    ph / ec / air_temperature_c / humidity_percent / co2_ppm).
    """
    targets = optimal_targets(crop, stage)
    total = 0.0
    for field, weight in STRESS_WEIGHTS.items():
        if field not in env:
            continue
        diff_ratio = abs(env[field] - targets[field]) / TOLERANCES[field]
        total += min(1.0, diff_ratio) * weight
    return round(max(0.0, min(100.0, total)))


def compute_growth_rate(
    env: dict[str, float],
    crop: str,
    stage: str | None = None,
) -> float:
    """Per-tick growth multiplier in [0, 1].

    Returns 1.0 under ideal conditions and approaches 0.0 under severe stress.
    Simple and transparent — tweakable by non-ML experts (issue #9).
    """
    return max(0.0, 1.0 - compute_stress(env, crop, stage) / 100.0)


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
