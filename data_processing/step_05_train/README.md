# Step 5 — Train & validate

**Status:** ☐ Not started

## Goal
Train the **multi-output** model (v1 = tabular gradient-boosted) and validate without leakage.

## Input → Output
`artifacts/04_training_table.parquet` → `artifacts/05_model.pkl` + `artifacts/metrics.json`

## Feature contract (train ⇔ serve — do not violate)

The model's inputs are **bounded by what the physics engine supplies at inference**
(the `PredictRequest` contract in `backend/app/routers/sim.py`). Training on any column the
server cannot populate live = **train–serve skew** (looks great in CV, fails deployed).
The 68-column table is the *label + derivation source*; only the set below are model inputs.

**INPUTS (X) — provided by the physics engine each tick:**

| Feature | Real column | Notes |
|---|---|---|
| `ph` | `pH_drain_PC` | |
| `ec` | **`irr_EC` (feed EC)** | supply/recipe EC the grower sets; ~14-day, ffilled → coarse setpoint |
| `air_temperature_c` | `Tair` | |
| `humidity_percent` | `Rhair` | |
| `co2_ppm` | `CO2air` | |
| `vpd` | derived (`Tair`+`Rhair`) | deterministic — engine computes it |
| `days_since_transplant`, `gdd_cum`, `growth_percent`, `growth_stage` | lifecycle | engine tracks; **required** so a snapshot model can place the plant on its growth curve |
| `crop_type` | constant `tomato` | |

**OUTPUTS (Y) — multi-output targets the model predicts (replace the engine's yield path):**

| Target | Drives |
|---|---|
| `y_yield_score` | Yield gauge (replaces engine `predict_yield`) |
| `y_plant_height` | 3D plant height |
| `y_stem_thickness` | 3D stem diameter |
| `y_truss_count` | 3D fruit clusters |
| `y_plant_density` | 3D scene population |

- **Stress stays engine-owned** (`compute_stress`) — transparent grey-box core; not a model
  output in v1. (Optional: add `y_stress_score` as a target later if a data-driven stress is
  wanted; the column already exists.)

**EXCLUDED — never features (leakage or unservable):**
- **Targets / leakage:** all `y_*`, `cum_yield`, and the raw growth/production columns
  (`Stem_elong`, `Stem_thick`, `Cum_trusses`, `stem_dens`, `plant_dens`, `ProdA/B`,
  `Nr_fruits_*`, `Weight_fruits_*`, `avg_nr_harvested_trusses`) — these *are* the answer.
- **Greenhouse internals / weather (no control, no sensor in the sim):** `HumDef`,
  `EC_slab1/2`, `WC_slab1/2`, `t_slab1/2`, `Tot_PAR`, `AssimLight`, `Cum_irr`, `water_sup`,
  all `Weather.*` (`PARout`, `Iglob`, `Tout`, `Rhout`, `RadSum`, `AbsHumOut`), and the raw
  `irr_*`/`drain_*` ion columns.
- **Dropped by scope decision:** NPK (`npk_*`) and light/DLI (`dli_24h`) — no control/viz
  (see `docs/TODO.md` §1–2). Feed EC is the sole nutrient signal.
- **`team`** — grouping/CV tag only, never a feature.

> Run CV on **this input set only** — a richer feature matrix inflates offline scores that
> won't survive deployment. Prune within the servable set (SHAP) only if a feature is a dud.

## Operations
- Model: **XGBoost / LightGBM**, multi-output (yield, stress, + 3D growth params).
- Validation: **temporal split** and/or **leave-one-team-out** CV — never random-split.
- Report R² / MAE per target per split → `metrics.json`.
- **SHAP** for the top stress driver → feeds the UI `explanation` string.

## Notes
- v1 stays **stateless** (snapshot in → score out) to fit `/api/sim/predict`.
- v2 (sequence model: LSTM/TCN/TFT) is out of scope here — needs a stateful endpoint.
- Keep a linear/RandomForest baseline for comparison.
