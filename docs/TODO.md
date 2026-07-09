# HydroSim — TODO: engine calibration & AI-model integration

Post-pivot backlog. The system moved from **replaying a synthetic CSV** to a
deterministic **grey-box physics engine** (`backend/app/sim/engine.py`) that computes
each tick. This file tracks the changes needed to (a) calibrate that engine against our
real tomato dataset and (b) layer the trained ML model on top — **across the system**.

> **Gate — do this first.** Everything below is unlocked **only after** we finish
> `data_processing/` **Step 5 (train)** and verify the model actually works
> (leave-one-team-out + temporal CV, sane yield/stress/growth outputs). Until the model
> is trained and its behaviour is understood, these are **planned, not started** —
> we don't want to re-tune the engine or reshape the pipeline against an unvalidated model.

Related docs: [`docs/engine.md`](engine.md) · [`docs/tomato_ml_plan.md`](tomato_ml_plan.md) ·
[`data_processing/README.md`](../data_processing/README.md) · [`docs/local_sim.md`](local_sim.md)

---

## 0. Prerequisite (must complete before anything below)

- [ ] **Step 5 — train the ML model** (`data_processing/step_05_train/`): multi-output
      (yield + stress + 3D growth), leave-one-team-out + temporal CV, exclude `y_*` and
      raw growth/production from features → `05_model.pkl` + `metrics.json`.
- [ ] **Verify the model works** — inspect metrics, check predictions are physically
      sensible (yield/stress ranges, growth monotonicity), confirm no leakage. Only then
      proceed.

---

## 1. Dataset → engine field alignment

The engine models 8 fields; our AGC tomato table maps cleanly on 5, proxies 3, and has
**no NPK**. (Full mapping table in the analysis / `docs/engine.md` §2.)

Clean: `ph←pH_drain_PC`, `air_temperature_c←Tair`, `humidity_percent←Rhair`,
`co2_ppm←CO2air`. Needs work:

- [x] **EC basis decision — RESOLVED: feed EC.** The engine/model use **feed EC**
      (`LabAnalysis.irr_EC`, the irrigation/supply EC the grower mixes), **not** drain/slab
      EC. Rationale: feed EC is the *controllable* the user dials; drain/slab EC is a
      response variable (partly an outcome → confounded as an input). Caveat: `irr_EC` is
      ~14-day cadence (forward-filled) → a coarse recipe setpoint. Still open: re-target the
      engine's `ec=2.5` / limit `0.5–4.0` to the feed-EC scale after calibration (§6).
- [ ] **`water_temperature_c`** — currently no true source; `t_slab1/2` (slab temp) is a
      proxy. Decide: map from slab temp, or leave on a published prior.
- [ ] **`water_level_percent`** — `WC_slab1/2` (slab water content) is a proxy, not tank
      level. Decide mapping or keep on prior.
- [x] **`light_hours` — WON'T DO (no light control/visualization).** Light/DLI is dropped
      as a model input and UI control. Engine keeps its `light_hours` field on a published
      prior (not data-driven); it is simply not exposed to the user or fed to the model.

## 2. NPK-aware stress — ❌ WON'T DO (scope decision)

**Decision:** NPK is **not** added as a control, visualization, or model/engine input.
Feed EC (`irr_EC`) is the **sole nutrient signal**. This deliberately re-accepts the
"EC alone doesn't capture N-P-K balance" limitation (the expert's original concern) as a
known, documented scope trade-off — there is no NPK slider or 3D cue to justify it.

- [x] NPK inputs dropped from the engine and the model feature set.
- [ ] *(If NPK controls are ever added later)* revisit: test `npk_N/P/K` (or
      `npk_K_Ca_ratio`) terms in `STRESS_WEIGHTS`/`TOLERANCES` and add crop-optimal NPK
      targets to `CROP_PROFILES`. The `npk_*` columns stay in the training table for this.

## 3. Stage-specific optima (issue #5)

Engine v1 uses one crop-level target and **ignores** the `stage` argument.

- [ ] Emit a **per-stage median-env table** (seedling…fruiting) from the real data
      (Step 3 already engineers `growth_stage`).
- [ ] Lift stage-specific target bands into `CROP_PROFILES[...]["targets"]` per stage and
      make `optimal_targets(crop, stage)` actually use `stage`.

## 4. Growth integrator + phenology (the "generate next row/stage" core)

`compute_growth_rate` is a per-tick multiplier but there's **no integrator** — the engine
is stateless per tick today. To generate the next row, it needs state that accumulates.

- [ ] Add a growth integrator whose output is calibrated to real `y_plant_height` /
      `y_stem_thickness` / `y_truss_count` / `Cum_trusses` curves over the ~166-day season
      (anchor on `gdd_cum`).
- [ ] Drive **stage transitions** from GDD/phenology (from the data) rather than fixed
      day-ranges in `CROP_PROFILES[...]["stages"]`.

## 5. Yield-map calibration

- [ ] Replace/fit the linear `yield = 100 − 1.15·stress` against real `cum_yield`
      (kg/m², Automatoes = 14.92). Consider a non-linear response.
- [ ] Reconcile units: engine's abstract `harvest_quality` (0–100) vs real kg/m².

## 6. Calibrate weights/tolerances — against MEASURED outcomes, not our labels

- [ ] Fit `STRESS_WEIGHTS` / `TOLERANCES` to close error vs **real yield (kg/m²) and real
      growth curves** — target `docs/engine.md` §7's **±10%** bar. Document before/after.
- [ ] ⚠️ **Avoid circularity:** do **not** fit the engine to our engineered `y_stress_score`
      (it shares the engine's OPT/DEV_W math). Use `y_stress_score` only as a cross-check.
      The `y_`-prefix already separates engineered targets from measured columns.

## 7. Reconcile conflicting constants (single source of truth)

- [ ] Tomato air-temp target is **25.0** in `engine.py` vs **26.0** in the dashboard
      `CROPS[].optimal` / `_OPTIMALS` — flagged in `docs/engine.md` §2. Pick one (from the
      data) and make it canonical across engine + dashboard + docs.
- [ ] Sweep the other targets/limits for the same drift after calibration.

## 8. Pipeline change — add an engine-calibration track

The dataset now feeds **two** consumers; make that explicit in `data_processing/`.

- [ ] Add **`step_05b_calibrate/`** (or fold into Step 5) consuming the Step-4 table:
  - [ ] fitted `STRESS_WEIGHTS` / `TOLERANCES`,
  - [ ] per-stage target bands,
  - [ ] a **calibration export renamed to the engine's 8 field names** (+ NPK if adopted).
- [ ] Keep ML **Step 5 (train)** / **Step 6 (serve)** as-is; the calibration track runs
      **beside** them on the same table (two consumers, one corpus).

## 9. Lettuce (no dataset — published priors only)

- [ ] Add `docs/lettuce_priors.md` citing the sources behind the OSU lettuce profile so
      the engine's lettuce numbers are defensible.
- [ ] Keep lettuce as a **reasoned estimate** tier — it cannot be data-calibrated
      (no pH/EC/NPK data). Same tomato-only asymmetry as the ML model.

## 10. AI ↔ physics engine wiring (system-wide)

Division of labor (see analysis / `docs/engine.md` grey-box note). They **share the
dataset**, they don't call each other at runtime.

- [ ] **Physics engine = state generator + default scorer** — steps env/growth forward
      each tick (replaces CSV replay), works for **both crops** and any crop without a model.
- [ ] **ML model = refinement scorer, tomato only** — plugs into the **same**
      `POST /api/sim/predict`; overrides the score for tomato when a model is loaded;
      flip `source` `"engine"` → `"model"` so the UI shows who answered. Everything else
      falls back to the physics engine.
- [ ] Retire the runtime CSV replay in `app/dashboard/page.tsx` / `GET /api/dataset`
      once the engine drives stepping (keep the CSV only as a dev/demo fallback).
- [ ] Update `docs/local_sim.md` (still describes the CSV-lookup v1) and
      `docs/simulation.md` once the engine is the live source.

---

## Suggested order

**0 (gate)** → **1 + 7** (align fields, kill constant drift) → **6** (fit weights vs
measured) → **3 + 4** (stages + growth integrator: the real "next row/stage") →
**2 + 5** (NPK + yield map) → **8** (pipeline track) → **10** (wire ML overlay) →
**9** (lettuce priors, anytime).