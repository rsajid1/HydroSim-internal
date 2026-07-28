# data_processing — Tomato dataset → model pipeline

Turns the raw AGC 2nd-edition **cherry-tomato** files into (a) one clean **5-min, real-date
master table** and (b) a trained **multi-output model** (yield + stress + 3D growth), following
[`docs/tomato_ml_plan.md`](../docs/tomato_ml_plan.md).

Each step is a folder with its own `README.md` (goal / inputs / outputs / **status**) plus its
script(s). Run steps in order; each reads the previous artifact and writes the next.

## Source data (in-repo: `data/`)

```
../data/Autonomous Greenhouse Challenge(AGC) - 2nd Edition/
    <team>/{GreenhouseClimate,GrodanSens,LabAnalysis,Production,CropParameters,TomQuality,Resources}.csv
    Weather/Weather.csv
```
Teams: `AICU, Automatoes, Digilog, IUACAAS, Reference, TheAutomators`.
Verified structure/timestamps/missing values: [`data/DATASET_ANALYSIS.md`](../data/DATASET_ANALYSIS.md).

## Core principle (do not violate)

**One master table at REAL 5-min resolution with REAL dates** (`2019-12-16 → 2020-05-30`).
No daily aggregation of the base — the simulator replays it *fast* (5-min → seconds) while
dates/lifecycle stay real. Daily is only ever an optional *training view*. (Plan §1.)

## Pipeline

| Step | Folder | Input → Output | Status |
| --- | --- | --- | --- |
| 1 | `step_01_consolidate/` | 7 raw files × 6 teams → `artifacts/01_master.parquet` | ☑ **Done** (286,854 × 129) |
| 2 | `step_02_clean_fill/` | `01_master` → `artifacts/02_clean.parquet` | ☑ **Done** (286,854 × 124) |
| 3 | `step_03_features/` | `02_clean` → `artifacts/03_features.parquet` | ☑ **Done** (286,854 × 61) |
| 4 | `step_04_labels/` | `03_features` → `04_training_table.parquet` (full, audit) → `finalize.py` → `artifacts/04_training_final.parquet` (slim, train) | ☑ **Done** (68-col full + **14-col slim**) |
| 5 | `step_05_train/` | `04_training_final` (slim) → `artifacts/05_model.pkl` + `metrics.json` | ☐ Not started |
| 6 | `step_06_serve/` | master + model → app `data/*.csv` + wired `predict()` | ☐ Not started |

Update the ☐/☑ here **and** in each step's README as you finish.

## Per-step summary

Brief of each step's README — open the step folder's `README.md` for full detail.

**1 · Consolidate** — join the 7 tomato files per team on the 5-min `GreenhouseClimate` spine; sparse
tables (lab ~14-day, crop/production weekly, resources daily) carried forward via
`merge_asof(backward)`; stack all 6 teams with a `team` column. Weather is shared across teams (join
on timestamp only); `TomQuality` (relative-day axis) is deferred to step 2. No aggregation.

**2 · Clean & fill** — remove the `Production` Feb-2019 date typo (pre-harvest cells → 0), range-clip
→ interpolate the env streams, structural `Cum_trusses` NaN→0, causal ffill of lab/recipe → **0
missing**. `IUACAAS/Resources` is ~45% missing — keep the team for input variety, but don't trust its
Resources columns.

**3 · Features** — derive `days_since_transplant`, `growth_percent`, `growth_stage` (from each team's
own truss/harvest events), VPD, DLI, GDD, 24-h rolling Tair stats, pH/EC excursions, NPK. All
rolling/cumulative values are computed causally **within each team**. Exact formulas: "Engineered
values & formulas" below.

**4 · Labels** — build the multi-output targets (`y_yield_score`, `y_stress_score`, + 3D-growth
passthroughs) into the full **68-col audit** table, then `finalize.py` projects the servable feature
set + targets into the slim **14-col training** table. Calibration: corr(stress, yield) = −0.68
per-row. Stress optima/weights are tunable constants at the top of `labels.py`.

**5 · Train** *(not started)* — a multi-output gradient-boosted model (XGBoost/LightGBM) on the
**slim** table only, validated by temporal and/or leave-one-team-out CV (never random split), with
SHAP for the top-driver explanation. **Feature contract (train ⇔ serve):** model inputs are bounded
by what the engine can supply live — `ph, ec (feed EC), air_temperature_c, humidity_percent, co2_ppm,
vpd, days_since_transplant`. `days_since_transplant` is the *only* lifecycle input: `growth_stage`
(engine uses calendar ranges, labels use observed plant events) and `growth_percent` (team-relative,
leaky) are excluded. Stress stays engine-owned in v1.

**6 · Serve** *(not started)* — export a HydroSim-schema replay CSV into `../data/` and swap the
lookup in `backend/app/routers/sim.py::predict()` for `model.predict(...)` with the request/response
contract **unchanged**; keep the synthetic-dataset path as a fallback. Serve follow-up: add
`days_since_transplant` to `PredictRequest`.

## Artifacts

Intermediates live in `artifacts/` (git-ignored — bulky). Naming: `NN_<name>.parquet`.
Final small deliverable (HydroSim-schema CSV) is written to the app's `../data/` in step 6.

**Two Step-4 tables — don't confuse them:**
- `04_training_table.parquet` (68 cols) — **full/audit**. Keeps every raw + engineered
  column; needed to *build* the labels and to cross-check in `verify.py`. Not for training.
- `04_training_final.parquet` (14 cols) — **slim/train**. Only the servable feature set +
  trained targets, renamed to serve-contract names (`finalize.py`). **Step 5 trains on this.**
  Training on the full table would be train–serve skew (columns the engine can't supply live).

## Environment (Windows-first, matches repo convention)

```bash
cd data_processing
uv venv .venv
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
```

## Conventions

- One step = one folder + one `README.md` + runnable, **idempotent** script(s).
- Excel-serial `%time` → datetime via epoch `1899-12-30`; keep the real timestamp column.
- Causal only — no row may use future measurements (no leakage).
- Keep *decisions* in the plan doc; keep *what-this-step-does* in the step README. Don't scatter.

## Engineered values & formulas (Steps 1–4)

Track of what is **raw** (original AGC column names) vs **engineered**, with the exact formula
for each derived value. Engineered features use `lower_snake`; engineered targets use `y_*`.

### Step 1 — consolidate (transform only, no new labels)
- `timestamp` = `1899-12-30 + %time (days)`, rounded to 5-min (Excel-serial → datetime).
- Sparse tables joined via `merge_asof(backward)` = carry most-recent prior value (causal).

### Step 2 — clean & fill (no new labels; cleaning rules)
- Numeric coercion; strip header whitespace; drop all-empty `Unnamed:` columns.
- Env clip→NaN→interpolate: pH∈[3,9], EC_drain∈[0,8], EC_slab∈[0,12], Tair/t_slab∈[5,45], Rhair∈[0,100], CO₂∈[200,2000].
- Production = 0 before each team's first in-season harvest (removes the Feb-2019 typo).
- `Cum_trusses` NaN→0 (structural); morphology + lab recipe `bfill().ffill()`.
- NaN patch: weather/light gaps interpolated; `WC_slab*` ffill/bfill → **0 missing**.

### Step 3 — engineered FEATURES
| Feature | Formula |
| --- | --- |
| `days_since_transplant` | (timestamp − 2019-12-16) in days |
| `growth_percent` | clip(`Stem_elong` / max(`Stem_elong`)ₜₑₐₘ × 100, 0, 100) |
| `growth_stage` | seedling (day≤14) → vegetative (day>14 & `Cum_trusses`=0) → flowering (`Cum_trusses`>0) → fruiting (`ProdA`>0) → harvest_ready (`ProdA`>0 & day ≥ max_day−14) |
| `vpd` (kPa) | 0.6108·e^(17.27·Tair/(Tair+237.3)) · (1 − Rhair/100), clipped ≥0 |
| `dli_24h` (mol/m²) | rolling₂₈₈ Σ(`Tot_PAR`) × 300 / 1e6 |
| `gdd_cum` | Σ( clip(Tair−10, 0) × 5/1440 ) |
| `tair_24h_mean` / `tair_24h_range` | rolling₂₈₈ mean / (max−min) of Tair |
| `ph_excursion_24h` | rolling₂₈₈ count(`pH_drain_PC` ∉ [5.5, 6.5]) |
| `npk_N` | `irr_NO3` + `irr_NH4` |
| `npk_P` / `npk_K` | `irr_PO4` / `irr_K` |
| `npk_K_Ca_ratio` | `irr_K` / `irr_Ca` |
| `n_uptake` | `irr_NO3` − `drain_NO3` |

`rolling₂₈₈` = trailing 24 h (288 × 5-min); all rolling/cumulative computed causally **within each team**.

### Step 4 — engineered TARGETS (`y_` prefix)
| Target | Formula |
| --- | --- |
| `cum_yield` (kg/m²) | cumsum(`ProdA`+`ProdB`) over in-season harvest dates, asof-mapped to grid |
| `y_yield_score` (0–100) | 100 × perf; perf = `cum_yield`/Automatoes\_`cum_yield` while harvesting, else `Stem_elong`/Automatoes\_`Stem_elong`; clip 0–100 |
| `y_stress_score` (0–100) | 100 × (0.5·env_dev + 0.5·growth_deficit), clip 0–100 |
| ↳ env_dev | 0.30·d(tair_24h_mean; 21,8) + 0.20·d(pH; 6,1.5) + 0.20·d(EC_drain; 3.5,3) + 0.20·d(vpd; 0.9,1.5) + 0.10·clip((800−CO₂)/600, 0,1);  d(x;opt,tol)=clip(\|x−opt\|/tol, 0,1) |
| ↳ growth_deficit | clip(1 − `y_yield_score`/100, 0, 1) |
| `y_plant_height` | = `Stem_elong` (passthrough) |
| `y_stem_thickness` | = `Stem_thick` (passthrough) |
| `y_truss_count` | = `Cum_trusses` (passthrough) |
| `y_plant_density` | = `plant_dens` (passthrough) |

Stress-score optima/weights are tunable constants at the top of `step_04_labels/labels.py`.

---

## Related docs

- Build plan: [`docs/tomato_ml_plan.md`](../docs/tomato_ml_plan.md)
- Control mapping: [`docs/dataset_controls.md`](../docs/dataset_controls.md)
- Data analysis: [`data/DATASET_ANALYSIS.md`](../data/DATASET_ANALYSIS.md)
