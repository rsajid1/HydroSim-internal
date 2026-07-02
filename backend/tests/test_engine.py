"""Unit tests for the deterministic grey-box growth and stress engine (Issue #9).

Covers issue #9's testing criteria:
- Ideal env (targets) → stress == 0 and compute_growth_rate == 1.0.
- Extreme env → high stress and growth rate near 0.
- Monotonicity: increasing one field's deviation never decreases stress.
- predict_yield decreases as stress rises and is bounded 0-100.
- Determinism: identical inputs → identical outputs.
- Parity: compute_stress / classify reproduce the generator's original
  calculate_stress values exactly for known inputs.
"""
import pytest

from app.sim.engine import (
    CROP_PROFILES,
    classify,
    compute_growth_rate,
    compute_stress,
    optimal_targets,
    predict_yield,
)

# Crop target dicts used as the "ideal" baseline throughout these tests.
_LETTUCE_TARGETS = CROP_PROFILES["lettuce"]["targets"]
_TOMATO_TARGETS = CROP_PROFILES["tomato"]["targets"]


# ---------------------------------------------------------------------------
# Ideal environment
# ---------------------------------------------------------------------------

def test_ideal_env_lettuce_stress_zero():
    assert compute_stress(_LETTUCE_TARGETS, "lettuce") == 0


def test_ideal_env_lettuce_growth_rate_one():
    rate = compute_growth_rate(_LETTUCE_TARGETS, "lettuce")
    assert rate == pytest.approx(1.0)


def test_ideal_env_tomato_stress_zero():
    assert compute_stress(_TOMATO_TARGETS, "tomato") == 0


def test_ideal_env_tomato_growth_rate_one():
    assert compute_growth_rate(_TOMATO_TARGETS, "tomato") == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Extreme environment
# ---------------------------------------------------------------------------

def test_extreme_env_high_stress():
    extreme = {
        "ph": 4.0,
        "ec": 0.5,
        "air_temperature_c": 40.0,
        "water_temperature_c": 32.0,
        "humidity_percent": 25.0,
        "co2_ppm": 1200.0,
        "water_level_percent": 20.0,
        "light_hours": 8.0,
    }
    assert compute_stress(extreme, "lettuce") > 70


def test_extreme_env_low_growth_rate():
    extreme = {
        "ph": 4.0,
        "ec": 0.5,
        "air_temperature_c": 40.0,
        "water_temperature_c": 32.0,
        "humidity_percent": 25.0,
        "co2_ppm": 1200.0,
        "water_level_percent": 20.0,
        "light_hours": 8.0,
    }
    assert compute_growth_rate(extreme, "lettuce") < 0.3


# ---------------------------------------------------------------------------
# Monotonicity
# ---------------------------------------------------------------------------

def test_stress_monotonicity_increasing_ph_deviation():
    """Increasing pH deviation from target must never decrease stress."""
    base = dict(_LETTUCE_TARGETS)
    prev_stress = compute_stress(base, "lettuce")
    for delta in (0.2, 0.5, 1.0, 1.5, 2.0):
        env = dict(base)
        env["ph"] = base["ph"] + delta
        stress = compute_stress(env, "lettuce")
        assert stress >= prev_stress, f"Stress decreased at delta={delta}"
        prev_stress = stress


def test_stress_monotonicity_increasing_temperature_deviation():
    base = dict(_LETTUCE_TARGETS)
    prev_stress = compute_stress(base, "lettuce")
    for delta in (1.0, 3.0, 5.0, 8.0, 12.0):
        env = dict(base)
        env["air_temperature_c"] = base["air_temperature_c"] + delta
        stress = compute_stress(env, "lettuce")
        assert stress >= prev_stress, f"Stress decreased at delta={delta}"
        prev_stress = stress


# ---------------------------------------------------------------------------
# predict_yield
# ---------------------------------------------------------------------------

def test_predict_yield_at_zero_stress():
    assert predict_yield(0) == 100


def test_predict_yield_at_max_stress():
    # 100 - round(100 * 1.15) = 100 - 115 = -15 → clamped to 0
    assert predict_yield(100) == 0


def test_predict_yield_decreases_as_stress_rises():
    stresses = [0, 10, 25, 50, 75, 100]
    yields = [predict_yield(s) for s in stresses]
    for i in range(len(yields) - 1):
        assert yields[i] >= yields[i + 1], (
            f"Yield did not decrease: stress {stresses[i]} → {stresses[i + 1]}, "
            f"yields {yields[i]} → {yields[i + 1]}"
        )


def test_predict_yield_bounded_0_100():
    for stress in (0, 10, 25, 50, 75, 87, 100):
        y = predict_yield(stress)
        assert 0 <= y <= 100, f"predict_yield({stress}) = {y} out of bounds"


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------

def test_compute_stress_deterministic():
    env = {
        "ph": 6.5,
        "ec": 1.5,
        "air_temperature_c": 22.0,
        "water_temperature_c": 20.0,
        "humidity_percent": 65.0,
        "co2_ppm": 850.0,
        "water_level_percent": 80.0,
        "light_hours": 14.0,
    }
    assert compute_stress(env, "lettuce") == compute_stress(env, "lettuce")


def test_compute_growth_rate_deterministic():
    env = dict(_LETTUCE_TARGETS)
    assert compute_growth_rate(env, "lettuce") == compute_growth_rate(env, "lettuce")


# ---------------------------------------------------------------------------
# Parity — reproduce the generator's original calculate_stress formula
# ---------------------------------------------------------------------------

def test_parity_known_stress_ph_only_deviation():
    """pH 1.0 above target with all other fields at target → stress == 18.

    Hand-calculation: diff_ratio = |7.0 - 6.0| / 1.0 = 1.0, capped at 1.0,
    weight = 18.0 → total = 18.0 → round(18.0) = 18.
    All other fields at target contribute 0.
    """
    env = dict(_LETTUCE_TARGETS)
    env["ph"] = _LETTUCE_TARGETS["ph"] + 1.0
    assert compute_stress(env, "lettuce") == 18


def test_parity_classify_low_stable():
    assert classify(0) == ("low", "stable")
    assert classify(29) == ("low", "stable")


def test_parity_classify_medium_warning():
    assert classify(30) == ("medium", "warning")
    assert classify(59) == ("medium", "warning")


def test_parity_classify_high_critical():
    assert classify(60) == ("high", "critical")
    assert classify(100) == ("high", "critical")


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_missing_env_fields_are_skipped():
    """Partial env dict is valid — missing fields contribute 0 stress."""
    partial = {"ph": 6.0}  # only pH at target
    assert compute_stress(partial, "lettuce") == 0


def test_crop_alias_tomatoes_resolves():
    """'tomatoes' alias must resolve to the same targets as 'tomato'."""
    assert optimal_targets("tomatoes") == _TOMATO_TARGETS


def test_stage_param_accepted_and_ignored_v1():
    """stage keyword is accepted but has no effect in v1."""
    base = compute_stress(_LETTUCE_TARGETS, "lettuce")
    staged = compute_stress(_LETTUCE_TARGETS, "lettuce", stage="seedling")
    assert base == staged


def test_unknown_crop_raises_value_error():
    with pytest.raises(ValueError, match="Unknown crop"):
        optimal_targets("herbs")
