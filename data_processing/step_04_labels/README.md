# Step 4 — Labels (multi-output targets)

**Status:** ☑ Done — full `artifacts/04_training_table.parquet` (286,854 × 68) + slim `artifacts/04_training_final.parquet` (286,854 × 14, via `finalize.py`). Targets `y_yield_score`, `y_stress_score`, `y_plant_height`, `y_stem_thickness`, `y_truss_count`, `y_plant_density` + `cum_yield`. Calibration: corr(stress, yield_score) = −0.68 (per-row), corr(mean_stress, final_yield) = −0.66 (per-team). Stress optima/weights are tunable constants in `labels.py`.

## Goal
Build the supervised targets — yield + stress **plus the 3D growth outputs**.

## Input → Output
`artifacts/03_features.parquet` → `artifacts/04_training_table.parquet` (full, 68 cols)

Then **finalize** (`finalize.py`) projects the full table down to the slim training table:
`04_training_table.parquet` → `artifacts/04_training_final.parquet` (**286,854 × 14**) + `.csv`.

- The full 68-col table stays as the **audit/provenance** artifact (needed to *build* the
  labels here and to cross-check in `verify.py`).
- The slim table is **what Step 5 trains on** — only the servable feature set + trained
  targets, renamed to the serve-contract names (see
  [`step_05_train/README.md`](../step_05_train/README.md) "Feature contract"):
  `ph, ec (=feed irr_EC), air_temperature_c, humidity_percent, co2_ppm, vpd,
  days_since_transplant` → `y_yield_score, y_plant_height, y_stem_thickness, y_truss_count,
  y_plant_density`. (`y_stress_score`/`cum_yield` remain in the full table only — stress is
  engine-owned in v1.)
- Run: `python step_04_labels/finalize.py` (after `labels.py`).

## Targets
| Target | Source | Drives |
| --- | --- | --- |
| `yield_score` (0–100) | `Production.ProdA`+`ProdB` normalized | Yield gauge |
| `stress_score` (0–100) | engineered (below) | Stress gauge |
| `plant_height` | `Stem_elong` | 3D height/size |
| `stem_thickness` | `Stem_thick` | 3D stem diameter |
| `truss_count` | `Cum_trusses` | 3D fruit clusters |
| `plant_density` | `plant_dens` | 3D scene population |

## Stress score (engineered, calibrated)
`deviation-integral` (weighted |value − optimal| over pH/EC/Tair/VPD/CO₂, integrated over time)
+ `growth-deficit` (day's growth rate vs. cohort best), scaled 0–100, **weights fit against
realized yield loss** so stress predicts lower harvest.

## Notes
- Normalize `yield_score` vs. the `Automatoes` optimum = 100.
- Keep both a per-row target and a season total for sanity checks.
