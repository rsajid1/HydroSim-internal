# HydroSim — Tomato ML Plan

Canonical plan for training the AI **yield + stress + growth** model on the AGC 2nd-edition
cherry-tomato data and wiring it into the existing `POST /api/sim/predict` contract.
Builds on `docs/dataset_controls.md` (control mapping) and `data/DATASET_ANALYSIS.md`
(verified structure / timestamps / missing values).

## 0. Decisions locked

- **Crop: tomato only.** Lettuce is unusable (no pH/EC/NPK logged — see `dataset_controls.md`).
- **Training data: pool all 6 teams** for input variety (same 166-day window, different control
  strategies → the model sees good *and* bad conditions). **`Automatoes` = optimal reference**
  (challenge winner, highest measured yield 14.92 kg/m²) — used for optimal targets + demo, not
  as the only training grower.
- **Contract unchanged:** still `POST /api/sim/predict` (per `docs/local_sim.md`).
- **Inputs bounded by `PredictRequest`** (see §6b): `ec` = **feed EC** (`irr_EC`); **NPK and
  light dropped** (no control/viz). Model outputs = yield + 3D growth params; **stress stays
  engine-owned**.

## 1. One master table — real 5-min resolution, real dates

There is **one source of truth**: `tomato_timeseries.csv` — one row per **(team, 5-min
timestamp)** across the real timeline **2019-12-16 → 2020-05-30**, with env columns + engineered
features + (forward-filled) sparse labels.

- **Do NOT aggregate to daily as the base.** The real 5-min lifecycle is preserved.
- The **simulator replays this file fast** (map 5-min step → seconds/ticks) while **dates and
  lifecycle stay real** — speed is a playback concern, not a data concern.
- Daily aggregation, if ever needed, is an **optional training *view*** derived from the master,
  never a replacement for it.

This one file is **both** the simulator's replay source **and** the model's training data.

## 1b. Combining the 6 teams — training vs. replay (+ simulation impact)

"Combine" means **two different operations** — don't conflate them:

| | Training data | Simulation replay |
| --- | --- | --- |
| Operation | **stack** (append rows) all 6 teams + a `team` tag | **pick one** team's timeline |
| Size | ~47,809 × 6 ≈ 287k rows | one 166-day grow |
| Why | input variety → learns good *and* bad conditions | one plant's life, not 6× the same window |

**Training (the stack):**
- Vertical stack, **not** a merge/average — averaging destroys the environment→yield variance the model needs.
- `team` is a **source tag, not a feature** — keep for grouping/validation, exclude from model inputs (else it memorizes team→yield).
- Validate **leave-one-team-out** (or temporal); never random-split (5-min rows are autocorrelated → leakage).
- Pool for the scorer: it must score *bad* slider settings, which only the weaker teams exhibit.

**Backend impact (small; pooling is invisible at inference):**
- `/api/sim/predict`: lookup → `model.predict(current snapshot)`. Request/response contract unchanged.
- `/api/dataset?crop=`: serve **one team's real timeline** (default `Automatoes`); optional `team`/`scenario` param.
- Two artifacts remain: replay CSV (one team) + model (all six). The model replaces the *lookup*, not the CSV.

**Frontend impact: near-zero.**
- No slider/contract change. Multi-output growth params are additive (they drive the 3D plant).
- Optional grower/scenario dropdown. Lettuce falls back as today.

**Mental model:** stack 6 → train one robust model; replay one (`Automatoes`) → the timeline the user watches. **Model scores, CSV plays.**

## 2. Consolidate the 7 files into the master (join on `%time`)

All tomato files share the Excel-serial `%time` axis (`epoch 1899-12-30 + serial`).

| File | Native grain | Into master |
|---|---|---|
| `GreenhouseClimate.csv` | 5-min | keep 5-min (Tair, Rhair, CO2air, HumDef, EC_drain_PC, pH_drain_PC, Tot_PAR, water_sup…) |
| `GrodanSens.csv` | 5-min | keep 5-min (EC_slab, WC_slab, t_slab) |
| `Weather/Weather.csv` | 5-min | keep 5-min (PARout, Iglob, Tout, Rhout) |
| `LabAnalysis.csv` | ~14-day | **forward-fill** onto 5-min grid (recipe holds between samples) → N/P/K columns |
| `CropParameters.csv` | weekly | **interpolate** onto 5-min (Stem_elong, Stem_thick, Cum_trusses, plant_dens) |
| `Production.csv` | weekly | align to harvest dates → cumulative yield |
| `TomQuality.csv` | per-harvest | optional bonus targets |

Result: continuous 5-min rows, real dates, sparse measurements carried causally forward.

## 3. Clean (known anomalies from the analysis)

1. `Production` **row-1 date typo** (`2019-02-14`) → drop/relabel before building the yield curve.
2. `TomQuality` **time axis is relative day-number** (parses to `1900-…`) and header merges
   `Weight`+`DMC_fruit` → split header / remap to calendar, or skip (bonus only).
3. `IUACAAS/Resources` **45 % missing** → don't depend on its resource columns.
4. **Range clips** (pH∈[3,9], EC∈[0,8]) + rolling-median despike on 5-min streams.

## 4. Fill missing values (causal — no future leakage)

- **Climate / slab / weather** (~0 % missing): interpolate short gaps; back-fill day-1 slab NaNs.
- **`CropParameters` structural NaNs** (`Cum_trusses` before trusses form): fill with **0**, not interpolate.
- **Sparse lab / production / crop**: **forward-fill** recipe, **linear-interpolate** growth.
- Impute using **past values only**, so no row sees future measurements.

## 5. Feature engineering (incl. growth stage)

- **`days_since_transplant`** (transplant = 2019-12-16).
- **`growth_percent`** = `clip(Stem_elong / final Stem_elong × 100, 0, 100)` — a real 0–100 curve.
- **`growth_stage`** by phenology: seedling → vegetative → flowering (`Cum_trusses>0`) → fruiting
  → harvest (`Production>0`) — thresholds from actual truss/harvest dates.
- **Environment features:** DLI (from `Tot_PAR`/`PARout`), VPD (`Tair`+`Rhair`, or `HumDef`),
  GDD (cumulative), daily min/max/range, pH/EC excursion counts.
- **NPK features:** N = `irr_NO3`+`irr_NH4`, P = `irr_PO4`, K = `irr_K` (+ K:Ca:Mg ratios) — ready
  for the future NPK control.

## 6. Targets — multi-output (drives yield gauge AND the 3D plant)

The model predicts (and the replay carries) all of:

| Output | Source | Used for |
|---|---|---|
| `yield_score` (0–100) | `Production.ProdA`+`ProdB` normalized | Yield gauge |
| `stress_score` (0–100) | **engineered** (below) | Stress gauge |
| `plant_height` | `CropParameters.Stem_elong` | **3D plant height/size** |
| `stem_thickness` | `Stem_thick` | **3D stem diameter** |
| `truss_count` | `Cum_trusses` | **3D fruit clusters** |
| `plant_density` | `plant_dens` | **3D scene population** |

- **Replay mode:** these come straight from the interpolated data.
- **Interactive mode:** the multi-output model predicts them from the current sliders, so the 3D
  plant grows/fruits in response to the environment.

**Stress score (engineered, calibrated):** deviation-integral (weighted |value − optimal| over
pH/EC/Tair/VPD/CO₂, integrated over time) + growth-deficit (day's growth rate vs. cohort best),
scaled 0–100, with weights **fit against realized yield loss** so stress actually predicts lower
harvest (real-data-grounded, not hand-tuned).

## 6b. Feature contract — inputs are bounded by `PredictRequest`

The model's **inputs** are limited to what the physics engine can supply live (the
`PredictRequest` fields in `backend/app/routers/sim.py`) — training on any column the server
can't populate is **train–serve skew**. The full 68-column table is the *label/derivation
source*, not the feature matrix. Locked decisions:

- **Inputs (engine-provided):** `ph`, `ec`, `air_temperature_c`, `humidity_percent`,
  `co2_ppm`, `vpd` (derived), **`days_since_transplant`** (the *only* lifecycle feature),
  `crop_type`=tomato.
- **`growth_stage` and `growth_percent` are NOT features.** `growth_stage` means different
  things in training (observed truss/harvest events) vs the engine (fixed calendar day-ranges)
  → categorical mismatch → silent mispredict; `growth_percent` is `Stem_elong`-derived +
  team-relative (leakage). Feed the continuous `days_since_transplant` on the real AGC
  `[0, ~166]` axis — **don't** rescale to the engine's 120-day cycle. The engine keeps
  computing `growth_stage` **for the UI only** (decoupled from the model).
- **Cumulative/rolling features** (`gdd_cum`, `dli_24h`, `tair_24h_*`, `ph_excursion_24h`) are
  out of v1 — they need session state the stateless endpoint lacks (unlock in v2).
- **`ec` = feed EC** (`LabAnalysis.irr_EC`) — the recipe/supply EC the grower sets, **not**
  drain/slab EC (a response variable). Coarse (~14-day, ffilled).
- **NPK and light/DLI are dropped** — no control/visualization for them (see `docs/TODO.md`
  §1–2). Feed EC is the sole nutrient signal (a documented EC-alone scope trade-off).
- **Outputs (model):** `y_yield_score` + the four 3D growth params (§6). **Stress stays
  engine-owned** (`compute_stress`) in v1.
- **Excluded (leakage/unservable):** all `y_*`/`cum_yield`/raw growth+production, greenhouse
  internals + weather, raw `irr_*`/`drain_*`, and `team`.

The canonical, itemized contract lives in
[`data_processing/step_05_train/README.md`](../data_processing/step_05_train/README.md).

## 7. Model choice + architecture fit

- **v1 — Tabular gradient-boosted (XGBoost/LightGBM)** on the §6b servable feature set
  (GDD/`days_since_transplant` carry the temporal effect). Captures temporal effects
  **without a sequence input**, so it fits HydroSim's **stateless** `/api/sim/predict`
  (snapshot in → score out), is low-latency (<2 s), and explainable (SHAP → the UI
  `explanation`). Multi-output for §6.
- **v2 — Sequence model (LSTM / TCN / Temporal Fusion Transformer)** on the 5-min sequences.
  Natural for real-resolution data, but needs a **history sequence**, so the backend must become
  **stateful** (track the session trajectory). Heavier; ~24 independent yield points/team →
  overfitting risk. Upgrade once the endpoint is stateful.
- **Validation:** temporal split and/or leave-one-team-out CV — **never random-split** a time
  series (leakage). Report R²/MAE per split.

## 8. How it plugs into HydroSim (two artifacts, both needed)

1. **`tomato_timeseries.csv`** (the joined master) → simulator **replay source** + model **training
   data**. The replay steps through rows = the real grow cycle (played fast).
2. **`tomato_model` (`.pkl`/`.json`)** → the **scorer** that replaces the lookup inside
   `backend/app/routers/sim.py::predict()`.

The model does **not** replace the CSV — it replaces the *lookup*. CSV = "what the environment is
doing over the cycle"; model = "given these conditions → yield / stress / growth." Request/response
contract stays identical (per `docs/local_sim.md`).

## 9. Build order

1. **ETL** → `tomato_timeseries.csv` (5-min, real dates, 6 teams, `growth_stage` engineered).
2. **Clean + causal-fill** (§3–4).
3. **Features + multi-output labels** (§5–6).
4. **Train + validate** (temporal / LOTO) — tabular v1.
5. **Export model + wire into `predict()`** — contract unchanged.
6. *(optional v2)* stateful endpoint + sequence model.