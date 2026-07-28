"""Simulation prediction routes.

``POST /api/sim/predict`` returns a yield/stress prediction for the current
environment state, computed live by ``app.sim.engine``. A trained ML model can
replace the yield computation later without changing this request/response
contract. The synthetic dataset is consulted only for ``cycle_length_days``.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.sim.engine import (
    STRESS_WEIGHTS,
    TOLERANCES,
    classify,
    compute_growth_rate,
    compute_stress,
    health_rate,
    health_stress,
    optimal_targets,
    predict_yield,
    stage_for_progress,
)
from app.sim.dataset import cycle_length_days
from app.utils.logger import logger_setup

router = APIRouter(prefix="/api/sim", tags=["simulation"])
log = logger_setup()

# The five environment fields the UI sends. Ranked in the explanation and checked for
# saturation. label -> (request attr, human unit). All five have STRESS_WEIGHTS / TOLERANCES
# entries in the engine, so the explanation can weight them the same way compute_stress does.
_DRIVERS = (
    ("pH", "ph", ""),
    ("EC", "ec", ""),
    ("Temp", "air_temperature_c", "°C"),
    ("Humidity", "humidity_percent", "%"),
    ("CO₂", "co2_ppm", " ppm"),
)

# Severity orderings so the router can floor a value without knowing the labels inline.
_STATUS_ORDER = ("stable", "warning", "critical")
_RISK_ORDER = ("low", "medium", "high")


def _at_least(current: str, floor: str, order: tuple[str, ...]) -> str:
    """Return whichever of ``current`` / ``floor`` is more severe in ``order``."""
    return current if order.index(current) >= order.index(floor) else floor


class PredictRequest(BaseModel):
    crop_type: str
    system_type: str = "nft"   # nft (baseline) | dwc (buffered); unknown -> nft
    growth_stage: str | None = None
    growth_percent: float | None = None
    ph: float = 6.0
    ec: float = 1.2
    air_temperature_c: float = 20.0
    humidity_percent: float = 60.0
    co2_ppm: float = 400.0


class PredictResponse(BaseModel):
    harvest_quality: float = Field(..., description="Estimated harvest quality, 0-100 %")
    stress_factor: float = Field(..., description="Estimated stress, 0-100")
    growth_rate: float = Field(..., description="Growth speed multiplier, 0-1 (1 = unstressed)")
    health_rate: float = Field(
        ..., description="Signed per-sim-hour change in plant health; caller integrates + clamps to 0-1"
    )
    cycle_days: float = Field(..., description="Full grow-cycle length for the crop, in days")
    estimated_days_to_harvest: float
    risk_level: str
    status: str
    explanation: str
    growth_stage: str | None = Field(
        None, description="Resolved growth stage the targets were scored against (stage-aware optima)"
    )
    optimal: dict[str, float] = Field(
        default_factory=dict, description="Stage-aware optimal targets for the UI-scored fields"
    )
    source: str = "engine"


def _ranked_drivers(req: PredictRequest, stage: str | None = None) -> list[dict]:
    """Each UI field scored by its weighted, normalized stress contribution, worst first.

    ``saturation`` is ``min(1, |value - target| / tolerance)`` — 1.0 means the field is as
    far off as it can be. ``contribution`` weights that by ``STRESS_WEIGHTS``, so the top
    entry is the field actually driving the stress score, not just the largest raw deviation
    across mismatched units (which is what the old raw-diff ranking compared).
    """
    optimal = optimal_targets(req.crop_type, stage)   # stage-aware; engine is the single source of truth
    drivers = []
    for label, col, unit in _DRIVERS:
        target = optimal.get(col)
        if target is None:
            continue
        value = getattr(req, col)
        diff = abs(value - target)
        saturation = min(1.0, diff / TOLERANCES[col])
        drivers.append({
            "label": label, "unit": unit, "value": value, "target": target,
            "diff": diff, "saturation": saturation,
            "contribution": saturation * STRESS_WEIGHTS[col],
        })
    drivers.sort(key=lambda d: d["contribution"], reverse=True)
    return drivers


def _build_explanation(drivers: list[dict], risk_level: str) -> str:
    """One-line summary naming the largest *weighted* stress contributor."""
    risk_suffix = f" risk: {risk_level}." if risk_level else ""
    top = drivers[0] if drivers else None
    if top is None or top["contribution"] < 0.5:
        return f"All inputs near optimal — minimal stress;{risk_suffix}"
    maxed = " (maxed out)" if top["saturation"] >= 1.0 else ""
    direction = "above" if top["value"] > top["target"] else "below"
    return (
        f"{top['label']} {top['value']:.1f}{top['unit']} is {top['diff']:.1f}{top['unit']} "
        f"{direction} optimal{maxed} — main stress driver;{risk_suffix}"
    )


@router.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest) -> PredictResponse:
    """Return a yield/stress prediction for the current environment state."""
    # Validate the crop against the engine (unknown crop -> 404, preserving the old message).
    try:
        optimal_targets(req.crop_type)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"No prediction data for crop '{req.crop_type}'",
        ) from exc

    env = {
        "ph": req.ph,
        "ec": req.ec,
        "air_temperature_c": req.air_temperature_c,
        "humidity_percent": req.humidity_percent,
        "co2_ppm": req.co2_ppm,
    }
    
    # Score against stage-aware optima.
    stage = stage_for_progress(req.crop_type, req.growth_percent) or req.growth_stage
    targets = optimal_targets(req.crop_type, stage)

    # system_type scales tolerances (DWC buffers vs NFT); growth/health/yield inherit this stress.
    stress = compute_stress(env, req.crop_type, stage=stage, system=req.system_type)
    harvest_quality = predict_yield(stress)              # clamp(100 - 1.15*stress, 0, 100)
    risk_level, status = classify(stress)
    
    # Engine owns the formula (don't re-derive 1 - stress/100 here).
    growth_rate = compute_growth_rate(env, req.crop_type, stage=stage, system=req.system_type)
    
    # Liebig health_stress: one field past tolerance dominates survival. Frontend integrates the rate.
    hrate = health_rate(health_stress(env, req.crop_type, stage=stage, system=req.system_type))

    # If aggregate stress is below classify()'s threshold (e.g. pH alone caps ~27 < 30). Floor status/risk rather than report "stable".
    drivers = _ranked_drivers(req, stage)
    if any(d["saturation"] >= 1.0 for d in drivers):
        status = _at_least(status, "warning", _STATUS_ORDER)
        risk_level = _at_least(risk_level, "medium", _RISK_ORDER)

    # Time-to-harvest uses the CSV cycle length (reference input, not the live yield source).
    # Dataset missing -> 503.
    try:
        cycle = cycle_length_days(req.crop_type)
    except FileNotFoundError as exc:
        log.error("sim_predict_dataset_missing", error=str(exc))
        raise HTTPException(status_code=503, detail="Prediction dataset is unavailable") from exc

    if req.growth_percent is not None:
        remaining = cycle * (1 - max(0.0, min(100.0, req.growth_percent)) / 100.0)
    else:
        remaining = cycle

    response = PredictResponse(
        harvest_quality=round(harvest_quality, 1),
        stress_factor=round(stress, 1),
        growth_rate=round(growth_rate, 4),
        health_rate=round(hrate, 6),
        cycle_days=cycle,
        estimated_days_to_harvest=round(max(0.0, remaining), 1),
        risk_level=risk_level,
        status=status,
        explanation=_build_explanation(drivers, risk_level),
        growth_stage=stage,
        optimal={col: targets[col] for _, col, _ in _DRIVERS if col in targets},
        source="engine",
    )
    log.info(
        "sim_predict",
        crop=req.crop_type,
        system=req.system_type,
        stage=stage,
        harvest_quality=response.harvest_quality,
        stress_factor=response.stress_factor,
        risk=risk_level,
    )
    return response
