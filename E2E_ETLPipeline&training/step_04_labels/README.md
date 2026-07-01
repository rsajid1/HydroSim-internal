# Step 4 — Labels (multi-output targets)

**Status:** ☐ Not started

## Goal
Build the supervised targets — yield + stress **plus the 3D growth outputs**.

## Input → Output
`artifacts/03_features.parquet` → `artifacts/04_training_table.parquet`

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
