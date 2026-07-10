"""Simulation prediction routes.

``POST /api/sim/predict`` returns a yield/stress prediction for the current
environment state, computed live by ``app.sim.engine``. A trained ML model can
replace the yield computation later without changing this request/response
contract. The synthetic dataset is consulted only for ``cycle_length_days``.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.sim.engine import (
    classify,
    compute_growth_rate,
    compute_stress,
    health_rate,
    optimal_targets,
    predict_yield,
)
from app.sim.dataset import cycle_length_days
from app.utils.logger import logger_setup

router = APIRouter(prefix="/api/sim", tags=["simulation"])
log = logger_setup()

# Environment fields ranked in the explanation.
# label -> (request attr, human unit)
_DRIVERS = (
    ("pH", "ph", ""),
    ("Temp", "air_temperature_c", "°C"),
    ("Humidity", "humidity_percent", "%"),
)


class PredictRequest(BaseModel):
    crop_type: str
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
    source: str = "engine"


def _build_explanation(req: PredictRequest, risk_level: str) -> str:
    """One-line summary naming the largest deviation from the crop's optimal."""
    optimal = optimal_targets(req.crop_type)   # engine normalizes crop + is the single source of truth
    worst_label = None
    worst_unit = ""
    worst_value = 0.0
    worst_target = 0.0
    worst_diff = 0.0
    for label, col, unit in _DRIVERS:
        target = optimal.get(col)
        if target is None:
            continue
        value = getattr(req, col)
        diff = abs(value - target)
        if diff > worst_diff:
            worst_diff, worst_label, worst_unit, worst_value, worst_target = (
                diff, label, unit, value, target,
            )

    risk_suffix = f" risk: {risk_level}." if risk_level else ""
    if worst_label is None or worst_diff < 0.5:
        return f"All inputs near optimal — minimal stress;{risk_suffix}"
    direction = "above" if worst_value > worst_target else "below"
    return (
        f"{worst_label} {worst_value:.1f}{worst_unit} is {worst_diff:.1f}{worst_unit} "
        f"{direction} optimal — main stress driver;{risk_suffix}"
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
    stress = compute_stress(env, req.crop_type)          # 0–100, weighted normalized deviation
    harvest_quality = predict_yield(stress)              # clamp(100 - 1.15*stress, 0, 100)
    risk_level, status = classify(stress)
    # Ask the engine rather than re-deriving 1 - stress/100 here: one definition of the formula.
    growth_rate = compute_growth_rate(env, req.crop_type)
    # Per-hour health delta for this stress; the frontend integrates it over ticks (stateful "memory").
    hrate = health_rate(stress)

    # Time-to-harvest still uses the CSV-derived cycle length (kept as a reference input, not the
    # live yield source). Dataset missing -> 503, same as before.
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
        explanation=_build_explanation(req, risk_level),
        source="engine",
    )
    log.info(
        "sim_predict",
        crop=req.crop_type,
        harvest_quality=response.harvest_quality,
        stress_factor=response.stress_factor,
        risk=risk_level,
    )
    return response
