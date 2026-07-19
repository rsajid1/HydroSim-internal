"""Unit tests for the deterministic grey-box growth and stress engine (Issue #9).

Covers issue #9's testing criteria:
- Ideal env (targets) → stress == 0 and compute_growth_rate == 1.0.
- Extreme env → high stress and growth rate near 0.
- Monotonicity: increasing one field's deviation never decreases stress.
- predict_yield decreases as stress rises and is bounded 0-100.
- Determinism: identical inputs → identical outputs.
- Parity: compute_stress / classify reproduce the generator's original
  calculate_stress values exactly for known inputs.
- Normalisation: a partial reading (the 5 fields the UI sends) still spans the
  full 0-100 stress range, while the all-8-field path stays byte-identical.
"""
import pytest

from app.sim.engine import (
    CROP_PROFILES,
    HEALTH_STRESS_NEUTRAL,
    STRESS_WEIGHTS,
    classify,
    compute_growth_rate,
    compute_stress,
    health_rate,
    health_stress,
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


# ---------------------------------------------------------------------------
# Normalisation over supplied fields
# ---------------------------------------------------------------------------

# The five fields the dashboard actually sends (see app/routers/sim.py).
# Their combined weight is 66 of the 100 available.
_UI_FIELDS = ("ph", "ec", "air_temperature_c", "humidity_percent", "co2_ppm")

# Every UI field at or beyond its tolerance → each contributes its full weight.
_UI_SATURATED = {
    "ph": 4.0,              # |4.0 - 6.0| / 1.0   = 2.0 → capped at 1.0
    "ec": 3.5,              # |3.5 - 1.2| / 1.0   = 2.3 → capped at 1.0
    "air_temperature_c": 40.0,   # |40 - 20| / 8  = 2.5 → capped at 1.0
    "humidity_percent": 100.0,   # |100 - 60| / 30 = 1.3 → capped at 1.0
    "co2_ppm": 300.0,       # |300 - 800| / 500   = 1.0 exactly
}


def test_ui_subset_saturated_reaches_full_stress():
    """The 5 UI fields at max deviation must reach 100, not the raw weight sum of 66.

    Regression test for the stress cap: before normalisation the score could
    never exceed 66, so the dashboard could not render a dying plant.
    """
    assert compute_stress(_UI_SATURATED, "lettuce") == 100


def test_ui_subset_saturated_yields_zero_harvest():
    """A fully stressed UI env must drive harvest quality to 0 (previously ~24)."""
    stress = compute_stress(_UI_SATURATED, "lettuce")
    assert predict_yield(stress) == 0


def test_ui_subset_saturated_growth_rate_zero():
    assert compute_growth_rate(_UI_SATURATED, "lettuce") == pytest.approx(0.0)


def test_ui_subset_at_target_zero_stress():
    at_target = {field: _LETTUCE_TARGETS[field] for field in _UI_FIELDS}
    assert compute_stress(at_target, "lettuce") == 0


def test_empty_env_returns_zero_without_dividing_by_zero():
    """No supplied fields → no evidence of stress, and no ZeroDivisionError."""
    assert compute_stress({}, "lettuce") == 0


def test_subset_and_full_env_agree_at_equal_relative_deviation():
    """Stress depends on relative deviation, not on how many fields were sent.

    Every supplied field sits at exactly half its tolerance, so both the 5-field
    and 8-field readings must score 50 despite carrying different total weight.
    """
    half_ui = {
        "ph": 6.5,                  # +0.5 of 1.0 tolerance
        "ec": 1.7,                  # +0.5 of 1.0
        "air_temperature_c": 24.0,  # +4 of 8
        "humidity_percent": 75.0,   # +15 of 30
        "co2_ppm": 1050.0,          # +250 of 500
    }
    half_full = dict(half_ui)
    half_full.update({
        "water_temperature_c": 22.0,   # +3 of 6
        "water_level_percent": 60.0,   # -25 of 50
        "light_hours": 17.0,           # +3 of 6
    })
    assert compute_stress(half_ui, "lettuce") == 50
    assert compute_stress(half_full, "lettuce") == 50


def test_full_env_unchanged_by_normalisation():
    """STRESS_WEIGHTS sums to 100, so the all-8-field path must not shift.

    This is the generator-parity guard: the seeded CSV depends on this formula.
    """
    assert sum(STRESS_WEIGHTS.values()) == 100.0
    env = dict(_LETTUCE_TARGETS)
    env["ph"] = _LETTUCE_TARGETS["ph"] + 1.0
    assert compute_stress(env, "lettuce") == 18


# ---------------------------------------------------------------------------
# System differentiation — DWC buffers deviations vs the NFT baseline
# ---------------------------------------------------------------------------

# One field off target so there is stress to modulate.
_OFF_TARGET = dict(_LETTUCE_TARGETS)
_OFF_TARGET["ph"] = _LETTUCE_TARGETS["ph"] + 0.8


def test_dwc_is_more_forgiving_than_nft():
    assert compute_stress(_OFF_TARGET, "lettuce", system="dwc") < \
        compute_stress(_OFF_TARGET, "lettuce", system="nft")


def test_nft_equals_baseline_no_system():
    # NFT is the 1.0 baseline, so passing it must match omitting system entirely.
    assert compute_stress(_OFF_TARGET, "lettuce", system="nft") == \
        compute_stress(_OFF_TARGET, "lettuce")


def test_unknown_system_falls_back_to_baseline():
    assert compute_stress(_OFF_TARGET, "lettuce", system="aeroponics") == \
        compute_stress(_OFF_TARGET, "lettuce")
    assert compute_stress(_OFF_TARGET, "lettuce", system=None) == \
        compute_stress(_OFF_TARGET, "lettuce")


def test_system_is_case_insensitive():
    assert compute_stress(_OFF_TARGET, "lettuce", system="DWC") == \
        compute_stress(_OFF_TARGET, "lettuce", system="dwc")


def test_growth_rate_inherits_system_buffering():
    # Same off-target env grows faster under DWC (less stress) than NFT.
    assert compute_growth_rate(_OFF_TARGET, "lettuce", system="dwc") > \
        compute_growth_rate(_OFF_TARGET, "lettuce", system="nft")


# ---------------------------------------------------------------------------
# Health (vigor) dynamics — the stateful "memory" layer
# ---------------------------------------------------------------------------

def test_health_recovers_when_unstressed():
    assert health_rate(0.0) > 0.0


def test_health_declines_under_stress():
    assert health_rate(100.0) < 0.0


def test_health_neutral_point_is_zero():
    assert health_rate(HEALTH_STRESS_NEUTRAL) == pytest.approx(0.0)


def test_health_decay_is_faster_than_recovery():
    """The asymmetry is what makes stress 'stick' — worst decay outpaces best recovery."""
    assert abs(health_rate(100.0)) > abs(health_rate(0.0))


def test_health_rate_monotonic_in_stress():
    """More stress is never better for health."""
    rates = [health_rate(s) for s in range(0, 101, 10)]
    assert rates == sorted(rates, reverse=True)


def test_health_decay_accelerates_with_severity():
    """Decay is convex (quadratic), so mild stress is tolerated and damage accelerates:
    the drop over a high-stress interval exceeds the drop over an equal low-stress one."""
    low = health_rate(50) - health_rate(30)
    high = health_rate(70) - health_rate(50)
    assert high < low  # more negative at the high end


def test_mild_stress_barely_decays():
    """A slightly-off plant (just above neutral) should decline far slower than linearly —
    well under a tenth of the worst-case rate."""
    assert abs(health_rate(30)) < 0.1 * abs(health_rate(100))


# --- Liebig's law of the minimum: a single catastrophic field drives health ---

def test_field_past_tolerance_raises_health_stress_above_aggregate():
    # pH 8 (2x its tolerance) — aggregate stress dilutes it to ~27, but health_stress lifts it.
    env = dict(_LETTUCE_TARGETS)
    env["ph"] = 8.0
    assert health_stress(env, "lettuce") > compute_stress(env, "lettuce")


def test_field_within_tolerance_leaves_health_stress_at_aggregate():
    # pH 6.7 is inside tolerance (ratio 0.7) — no Liebig boost, health_stress == aggregate.
    env = dict(_LETTUCE_TARGETS)
    env["ph"] = 6.7
    assert health_stress(env, "lettuce") == compute_stress(env, "lettuce")


def test_worse_single_field_gives_more_health_stress():
    # The further past tolerance, the more health-stress (pH 8 worse than pH 7.5).
    e75 = dict(_LETTUCE_TARGETS); e75["ph"] = 7.5
    e80 = dict(_LETTUCE_TARGETS); e80["ph"] = 8.0
    assert health_stress(e80, "lettuce") > health_stress(e75, "lettuce")
