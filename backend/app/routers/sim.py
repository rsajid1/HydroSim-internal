"""Simulation prediction routes.

``POST /api/sim/predict`` returns an AI-style yield/stress prediction for the
current environment state. v1 is data-driven: it serves the precomputed
``predicted_yield_score`` / ``stress_score`` / ``risk_level`` from the local
synthetic dataset via a nearest-row lookup. A trained ML model can replace the
lookup later without changing this request/response contract.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.sim.dataset import cycle_length_days, normalize_crop, rows_for_crop
from app.utils.logger import logger_setup

router = APIRouter(prefix="/api/sim", tags=["simulation"])
log = logger_setup()

# Per-crop optimal targets — mirrors the CROPS[].optimal values in the dashboard
# (app/dashboard/page.tsx) so the explanation lines up with what the UI shows.
_OPTIMALS = {
    "lettuce": {"ph": 6.0, "air_temperature_c": 20.0, "humidity_percent": 60.0},
    "tomato": {"ph": 6.0, "air_temperature_c": 26.0, "humidity_percent": 70.0},
}

# Environment fields used for the nearest-row distance and the explanation.
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
    estimated_days_to_harvest: float
    risk_level: str
    status: str
    explanation: str
    source: str = "dataset"


def _column_span(rows: list[dict], column: str) -> float:
    """Min-max span of a numeric column (used to normalize distances). >= 1.0."""
    values = [row[column] for row in rows if row.get(column) is not None]
    if not values:
        return 1.0
    span = max(values) - min(values)
    return span if span > 0 else 1.0


def _nearest_row(rows: list[dict], req: PredictRequest) -> dict:
    """Pick the dataset row closest to the requested environment.

    Distance is the normalized Euclidean distance over pH, air temperature and
    humidity so no single axis (e.g. CO2's large range) dominates.
    """
    spans = {col: _column_span(rows, col) for _, col, _ in _DRIVERS}
    request_values = {col: getattr(req, col) for _, col, _ in _DRIVERS}

    def distance(row: dict) -> float:
        total = 0.0
        for _, col, _ in _DRIVERS:
            row_val = row.get(col)
            if row_val is None:
                continue
            total += ((request_values[col] - row_val) / spans[col]) ** 2
        return total

    return min(rows, key=distance)


def _build_explanation(req: PredictRequest, risk_level: str) -> str:
    """One-line summary naming the largest deviation from the crop's optimal."""
    optimal = _OPTIMALS.get(normalize_crop(req.crop_type), _OPTIMALS["lettuce"])
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
    try:
        rows = rows_for_crop(req.crop_type)
    except FileNotFoundError as exc:
        log.error("sim_predict_dataset_missing", error=str(exc))
        raise HTTPException(status_code=503, detail="Prediction dataset is unavailable") from exc

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No prediction data for crop '{req.crop_type}'",
        )

    # Narrow to the requested growth stage when it has matching rows.
    if req.growth_stage:
        staged = [r for r in rows if r.get("growth_stage", "").lower() == req.growth_stage.lower()]
        if staged:
            rows = staged

    match = _nearest_row(rows, req)
    risk_level = match.get("risk_level", "")
    status = match.get("status", "")

    # Remaining days from UI growth progress (0-100) against the crop's cycle length;
    # fall back to the matched row's day vs the crop max when growth_percent is absent.
    cycle = cycle_length_days(req.crop_type)
    if req.growth_percent is not None:
        remaining = cycle * (1 - max(0.0, min(100.0, req.growth_percent)) / 100.0)
    else:
        remaining = max(0.0, cycle - (match.get("day") or 0.0))

    response = PredictResponse(
        harvest_quality=round(match.get("predicted_yield_score") or 0.0, 1),
        stress_factor=round(match.get("stress_score") or 0.0, 1),
        estimated_days_to_harvest=round(max(0.0, remaining), 1),
        risk_level=risk_level,
        status=status,
        explanation=_build_explanation(req, risk_level),
        source="dataset",
    )
    log.info(
        "sim_predict",
        crop=req.crop_type,
        harvest_quality=response.harvest_quality,
        stress_factor=response.stress_factor,
        risk=risk_level,
    )
    return response
