#!/usr/bin/env python3
"""Generate HydroSim synthetic lettuce and tomato simulation data."""

from __future__ import annotations

import csv
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure the backend package is importable when this script is run from the repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.sim.engine import (  # noqa: E402  (import after sys.path manipulation)
    CROP_PROFILES,
    LIMITS,
    STRESS_WEIGHTS,
    TOLERANCES,
    classify,
    compute_stress,
    predict_yield,
)


# Fixed random seed so the generated CSV is identical every time the script runs.
SEED = 20260608

# Number of sample records created for each crop/stage/system/scenario combination.
ROWS_PER_STAGE_SYSTEM_SCENARIO = 5

# CSV destination, resolved from the project root instead of the current terminal path.
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "synthetic_hydroponics_dataset.csv"

# Hydroponic system categories included in the generated records.
SYSTEM_TYPES = ["nft", "dwc", "aeroponics", "vertical"]

# Scenario labels used to control how far generated values drift from crop targets.
SCENARIOS = ["stable", "warning", "critical"]

# Column order for the output CSV.
FIELDNAMES = [
    "simulation_id",
    "crop_type",
    "growth_stage",
    "system_type",
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
    "risk_level",
    "status",
    "source_profile",
    "created_at",
]

# Maximum random deviation from target values for each scenario.
# Stable stays close to target, warning moves farther away, critical moves farthest.
NOISE_BY_SCENARIO = {
    "stable": {
        "ph": 0.15,
        "ec": 0.15,
        "air_temperature_c": 1.5,
        "water_temperature_c": 1.0,
        "humidity_percent": 5.0,
        "co2_ppm": 80.0,
        "water_level_percent": 8.0,
        "light_hours": 1.0,
    },
    "warning": {
        "ph": 0.55,
        "ec": 0.45,
        "air_temperature_c": 4.0,
        "water_temperature_c": 3.0,
        "humidity_percent": 14.0,
        "co2_ppm": 220.0,
        "water_level_percent": 22.0,
        "light_hours": 2.5,
    },
    "critical": {
        "ph": 1.1,
        "ec": 0.9,
        "air_temperature_c": 7.0,
        "water_temperature_c": 5.5,
        "humidity_percent": 26.0,
        "co2_ppm": 420.0,
        "water_level_percent": 40.0,
        "light_hours": 4.0,
    },
}


def clamp(value: float, field: str) -> float:
    lower, upper = LIMITS[field]
    return max(lower, min(upper, value))


def offset_value(target: float, field: str, scenario: str) -> float:
    magnitude = NOISE_BY_SCENARIO[scenario][field]
    if scenario == "stable":
        offset = random.uniform(-magnitude, magnitude)
    else:
        direction = random.choice([-1, 1])
        offset = direction * random.uniform(magnitude * 0.55, magnitude)
    return clamp(target + offset, field)


def round_value(field: str, value: float) -> float | int:
    if field in {"co2_ppm", "water_level_percent", "humidity_percent", "light_hours"}:
        return round(value)
    return round(value, 2)


def build_rows() -> list[dict[str, str | int | float]]:
    random.seed(SEED)
    rows = []
    created_at = datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc)
    record_number = 1

    for crop_type, profile in CROP_PROFILES.items():
        targets = profile["targets"]
        stages = profile["stages"]
        for growth_stage, day_range in stages.items():
            for system_type in SYSTEM_TYPES:
                for scenario in SCENARIOS:
                    for _ in range(ROWS_PER_STAGE_SYSTEM_SCENARIO):
                        values = {
                            field: offset_value(target, field, scenario)
                            for field, target in targets.items()
                        }
                        stress_score = compute_stress(values, crop_type)
                        risk_level, status = classify(stress_score)
                        predicted_yield_score = predict_yield(stress_score)
                        row_created_at = created_at + timedelta(minutes=record_number - 1)

                        rows.append(
                            {
                                "simulation_id": f"sim_{record_number:04d}",
                                "crop_type": crop_type,
                                "growth_stage": growth_stage,
                                "system_type": system_type,
                                "day": random.randint(*day_range),
                                "ph": round_value("ph", values["ph"]),
                                "ec": round_value("ec", values["ec"]),
                                "air_temperature_c": round_value(
                                    "air_temperature_c", values["air_temperature_c"]
                                ),
                                "water_temperature_c": round_value(
                                    "water_temperature_c", values["water_temperature_c"]
                                ),
                                "humidity_percent": round_value(
                                    "humidity_percent", values["humidity_percent"]
                                ),
                                "co2_ppm": round_value("co2_ppm", values["co2_ppm"]),
                                "water_level_percent": round_value(
                                    "water_level_percent", values["water_level_percent"]
                                ),
                                "light_hours": round_value("light_hours", values["light_hours"]),
                                "stress_score": stress_score,
                                "predicted_yield_score": predicted_yield_score,
                                "risk_level": risk_level,
                                "status": status,
                                "source_profile": profile["source_profile"],
                                "created_at": row_created_at.isoformat().replace("+00:00", "Z"),
                            }
                        )
                        record_number += 1

    return rows


def main() -> None:
    rows = build_rows()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
