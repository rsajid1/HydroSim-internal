"""Calibration invariants for the grey-box engine — the regression guard.

These sweep the whole UI input grid and assert agronomic sanity properties that must
hold no matter how the constants are tuned. They exist so a future change to a target,
tolerance, weight, or health constant that produces nonsense behaviour fails CI here,
instead of surfacing live one case at a time.

Not a validation against real data (there is none for our systems) — a consistency and
plausibility guard. Calls the engine functions directly (no server needed).
"""
import pytest

from app.sim.engine import (
    CROP_PROFILES,
    HEALTH_DECAY_PER_HOUR,
    HEALTH_RECOVERY_PER_HOUR,
    compute_growth_rate,
    compute_stress,
    health_rate,
    health_stress,
    optimal_targets,
    predict_yield,
)

# The five fields the UI actually sends, with their slider ranges (min, max).
UI_FIELDS = {
    "ph": (4.0, 8.0),
    "ec": (0.5, 4.0),
    "air_temperature_c": (10.0, 40.0),
    "humidity_percent": (0.0, 100.0),
    "co2_ppm": (300.0, 1200.0),
}
CROPS = ("lettuce", "tomato")
SYSTEMS = ("nft", "dwc")
SIM_HOURS_PER_TICK = 6  # mirrors the frontend; used only to phrase death times in sim-days


def _ideal_env(crop):
    """All five UI fields exactly on this crop's target."""
    t = optimal_targets(crop)
    return {f: t[f] for f in UI_FIELDS}


def _sim_days_to_death(env, crop, system):
    """None if the plant heals/holds; else sim-days from full health to 0 at this constant rate."""
    rate = health_rate(health_stress(env, crop, system=system))
    if rate >= 0:
        return None
    return (1.0 / abs(rate)) / 24.0


def _sweep_points(lo, hi, target, n=9):
    """A spread of values across [lo, hi] that always includes the endpoints and the target."""
    pts = {lo, hi, target}
    for i in range(n):
        pts.add(lo + (hi - lo) * i / (n - 1))
    return sorted(pts)


# ---------------------------------------------------------------------------
# I1 — ideal conditions are perfect, for every crop x system
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("crop", CROPS)
@pytest.mark.parametrize("system", SYSTEMS)
def test_ideal_is_perfect(crop, system):
    env = _ideal_env(crop)
    stress = compute_stress(env, crop, system=system)
    assert stress == 0
    assert predict_yield(stress) == 100
    assert compute_growth_rate(env, crop, system=system) == 1.0
    assert health_rate(health_stress(env, crop, system=system)) >= 0  # never decays when ideal


# ---------------------------------------------------------------------------
# I2 — stress is monotonic: moving any field away from target never lowers stress
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("crop", CROPS)
@pytest.mark.parametrize("field", UI_FIELDS)
def test_stress_monotonic_away_from_target(crop, field):
    lo, hi = UI_FIELDS[field]
    target = optimal_targets(crop)[field]
    base = _ideal_env(crop)
    # Below target: as value decreases, stress must not decrease.
    below = [v for v in _sweep_points(lo, hi, target) if v <= target]
    s = [compute_stress({**base, field: v}, crop) for v in sorted(below, reverse=True)]
    assert s == sorted(s), f"{crop}/{field} below-target not monotonic: {list(zip(sorted(below, reverse=True), s))}"
    # Above target: as value increases, stress must not decrease.
    above = [v for v in _sweep_points(lo, hi, target) if v >= target]
    s = [compute_stress({**base, field: v}, crop) for v in sorted(above)]
    assert s == sorted(s), f"{crop}/{field} above-target not monotonic: {list(zip(sorted(above), s))}"


# ---------------------------------------------------------------------------
# I3 — every output stays within its declared bounds across the whole grid
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("crop", CROPS)
@pytest.mark.parametrize("system", SYSTEMS)
def test_outputs_bounded_across_grid(crop, system):
    base = _ideal_env(crop)
    for field, (lo, hi) in UI_FIELDS.items():
        target = optimal_targets(crop)[field]
        for v in _sweep_points(lo, hi, target):
            env = {**base, field: v}
            stress = compute_stress(env, crop, system=system)
            assert 0 <= stress <= 100
            assert 0 <= predict_yield(stress) <= 100
            assert 0.0 <= compute_growth_rate(env, crop, system=system) <= 1.0
            rate = health_rate(health_stress(env, crop, system=system))
            assert -HEALTH_DECAY_PER_HOUR - 1e-9 <= rate <= HEALTH_RECOVERY_PER_HOUR + 1e-9


# ---------------------------------------------------------------------------
# I4 — life/death ordering: ideal never dies, all-wrecked dies fast,
#      and NO single field ever dies faster than a floor (the EC-4.0 guard)
# ---------------------------------------------------------------------------

def _all_wrecked_env(crop):
    """Push every UI field to its worse extreme relative to target."""
    t = optimal_targets(crop)
    env = {}
    for f, (lo, hi) in UI_FIELDS.items():
        env[f] = lo if abs(lo - t[f]) >= abs(hi - t[f]) else hi
    return env


@pytest.mark.parametrize("crop", CROPS)
@pytest.mark.parametrize("system", SYSTEMS)
def test_ideal_never_dies(crop, system):
    assert _sim_days_to_death(_ideal_env(crop), crop, system) is None


@pytest.mark.parametrize("crop", CROPS)
@pytest.mark.parametrize("system", SYSTEMS)
def test_all_wrecked_dies_fast(crop, system):
    days = _sim_days_to_death(_all_wrecked_env(crop), crop, system)
    assert days is not None and days <= 4.0


@pytest.mark.parametrize("crop", CROPS)
@pytest.mark.parametrize("field", UI_FIELDS)
def test_no_single_field_kills_faster_than_floor(crop, field):
    """A single field at any slider value must never kill faster than ~5 sim-days — no single
    parameter should be as lethal as an entirely-wrecked environment. This is the guard that
    would have caught EC 4.0 dying in 3 days."""
    lo, hi = UI_FIELDS[field]
    target = optimal_targets(crop)[field]
    base = _ideal_env(crop)
    for v in _sweep_points(lo, hi, target, n=15):
        days = _sim_days_to_death({**base, field: v}, crop, "nft")
        if days is not None:
            assert days >= 5.0, f"{crop}/{field}={v} dies in {days:.1f}d (< 5d floor)"


# ---------------------------------------------------------------------------
# I5 — DWC is never harsher than NFT (buffering), everywhere on the grid
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("crop", CROPS)
@pytest.mark.parametrize("field", UI_FIELDS)
def test_dwc_never_harsher_than_nft(crop, field):
    lo, hi = UI_FIELDS[field]
    target = optimal_targets(crop)[field]
    base = _ideal_env(crop)
    for v in _sweep_points(lo, hi, target):
        env = {**base, field: v}
        assert compute_stress(env, crop, system="dwc") <= compute_stress(env, crop, system="nft")
        # DWC health rate is >= NFT's (decays no faster).
        assert health_rate(health_stress(env, crop, system="dwc")) >= \
            health_rate(health_stress(env, crop, system="nft"))


# ---------------------------------------------------------------------------
# I6 — single-field worst extremes land in a consistent band (no outliers)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("crop", CROPS)
def test_single_field_extremes_are_never_disproportionately_lethal(crop):
    """No single field pushed to its worst extreme may kill faster than the ~5 sim-day floor —
    a lone bad parameter must never be as deadly as a fully-wrecked environment. Dying slowly
    (or not at all) is fine; a field being too gentle is not a defect."""
    t = optimal_targets(crop)
    base = _ideal_env(crop)
    for field, (lo, hi) in UI_FIELDS.items():
        worst = lo if abs(lo - t[field]) >= abs(hi - t[field]) else hi
        days = _sim_days_to_death({**base, field: worst}, crop, "nft")
        if days is not None:
            assert days >= 5.0, f"{crop}/{field}={worst} dies in {days:.1f}d (< 5d floor)"
