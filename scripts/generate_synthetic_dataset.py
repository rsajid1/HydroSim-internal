#!/usr/bin/env python3
"""Generate HydroSim synthetic lettuce and tomato simulation data."""

from __future__ import annotations

import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path


SEED = 20260608
ROWS_PER_STAGE_SYSTEM_SCENARIO = 5
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "synthetic_hydroponics_dataset.csv"

SYSTEM_TYPES = ["nft", "dwc", "aeroponics", "vertical"]
SCENARIOS = ["stable", "warning", "critical"]

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

CROP_PROFILES = {
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

LIMITS = {
    "ph": (4.0, 8.0),
    "ec": (0.5, 4.0),
    "air_temperature_c": (10.0, 40.0),
    "water_temperature_c": (10.0, 32.0),
    "humidity_percent": (25.0, 100.0),
    "co2_ppm": (300.0, 1200.0),
    "water_level_percent": (20.0, 100.0),
    "light_hours": (8.0, 20.0),
}

STRESS_WEIGHTS = {
    "ph": 18.0,
    "ec": 16.0,
    "air_temperature_c": 14.0,
    "water_temperature_c": 10.0,
    "humidity_percent": 10.0,
    "co2_ppm": 8.0,
    "water_level_percent": 14.0,
    "light_hours": 10.0,
}

TOLERANCES = {
    "ph": 1.0,
    "ec": 1.0,
    "air_temperature_c": 8.0,
    "water_temperature_c": 6.0,
    "humidity_percent": 30.0,
    "co2_ppm": 500.0,
    "water_level_percent": 50.0,
    "light_hours": 6.0,
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


def calculate_stress(values: dict[str, float], targets: dict[str, float]) -> int:
    total = 0.0
    for field, weight in STRESS_WEIGHTS.items():
        diff_ratio = abs(values[field] - targets[field]) / TOLERANCES[field]
        total += min(1.0, diff_ratio) * weight
    return round(max(0.0, min(100.0, total)))


def classify(stress_score: int) -> tuple[str, str]:
    if stress_score >= 60:
        return "high", "critical"
    if stress_score >= 30:
        return "medium", "warning"
    return "low", "stable"


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
                        stress_score = calculate_stress(values, targets)
                        risk_level, status = classify(stress_score)
                        predicted_yield_score = max(0, min(100, 100 - round(stress_score * 1.15)))
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
