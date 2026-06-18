"""Local synthetic-dataset loader for the simulation/prediction feature.

Reads the repo-root ``data/synthetic_hydroponics_dataset.csv`` (the same file the
frontend ``/api/dataset`` route serves) and exposes simple, cached lookups so the
prediction endpoint can serve the precomputed ``predicted_yield_score`` /
``stress_score`` / ``risk_level`` columns without any database access.

The CSV is loaded once and cached in module memory; ML scoring can replace the
lookup later without changing this module's public surface.
"""
from functools import lru_cache
from pathlib import Path
import csv

# data/synthetic_hydroponics_dataset.csv lives at the repo root.
# This file is backend/app/sim/dataset.py -> parents[3] is the repo root.
DATASET_PATH = Path(__file__).resolve().parents[3] / "data" / "synthetic_hydroponics_dataset.csv"

# UI crop ids -> dataset crop_type values (the dashboard uses "tomatoes").
_CROP_ALIASES = {
    "tomatoes": "tomato",
    "tomato": "tomato",
    "lettuce": "lettuce",
}

# Numeric columns parsed to float; everything else stays a string.
_NUMERIC_COLUMNS = {
    "day",
    "ph",
    "ec",
    "air_temperature_c",
    "water_temperature_c",
    "humidity_percent",
    "co2_ppm",
    "water_level_percent",
    "light_hours",
    "stress_score",
    "predicted_yield_score",
}


def normalize_crop(crop_type: str) -> str:
    """Map a UI crop id (e.g. ``"tomatoes"``) to its dataset ``crop_type`` value."""
    return _CROP_ALIASES.get((crop_type or "").strip().lower(), (crop_type or "").strip().lower())


@lru_cache(maxsize=1)
def _load_rows() -> tuple[dict, ...]:
    """Parse the CSV once and cache the result.

    Raises ``FileNotFoundError`` if the dataset file is missing so callers can
    surface a clear error instead of a generic 500.
    """
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset file not found at {DATASET_PATH}")

    rows: list[dict] = []
    with DATASET_PATH.open(newline="", encoding="utf-8") as handle:
        for raw in csv.DictReader(handle):
            row: dict = {}
            for key, value in raw.items():
                if key in _NUMERIC_COLUMNS:
                    try:
                        row[key] = float(value)
                    except (TypeError, ValueError):
                        row[key] = None
                else:
                    row[key] = (value or "").strip()
            rows.append(row)
    return tuple(rows)


def rows_for_crop(crop_type: str) -> list[dict]:
    """Return all dataset rows for the given crop (case-insensitive, alias-aware)."""
    target = normalize_crop(crop_type)
    return [row for row in _load_rows() if row.get("crop_type", "").lower() == target]


def cycle_length_days(crop_type: str) -> float:
    """Return the crop's grow-cycle length, used to estimate time-to-harvest.

    Defined as the maximum ``day`` seen for that crop in the dataset. Raises
    ``ValueError`` when the crop has no rows so the caller can return a clear error.
    """
    rows = rows_for_crop(crop_type)
    if not rows:
        raise ValueError(f"No dataset rows for crop '{crop_type}'")
    days = [row["day"] for row in rows if row.get("day") is not None]
    return max(days) if days else 0.0