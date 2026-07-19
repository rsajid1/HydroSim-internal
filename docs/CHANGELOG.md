# Changelog
> Please note, PR links are not available for changes below as they are on private repository or not committed. Changes implemented after May 12, 2026 will include PR links. 
## 2026-07-19

Engine and dashboard reconciled to a single source of truth, made **stage-aware**, and the environment controls fixed. Work on the `feature_cleanups` branch; ML training and dataset integration were dropped — the AGC dataset + `data_processing/` pipeline now stand only as a research/thesis attachment (see `docs/TODO.md`).

### Added
- **Stage-aware optimal targets** (issue #5) — `optimal_targets(crop, stage)` overlays per-stage `stage_targets` (tomato 5 stages, lettuce 3: EC ramps with maturity, humidity drops at flowering, temps ease toward harvest). `stage_for_progress()` resolves the stage from `growth_percent` server-side (no request-contract change); `POST /api/sim/predict` now returns `growth_stage` + a stage-aware `optimal` map. Dashboard sliders/gauges shift their "Target" as the plant grows (`backend/app/sim/engine.py`, `backend/app/routers/sim.py`, `app/dashboard/page.tsx`).
- **EC environment control + CO2 telemetry gauge** — Environment Controls had no EC slider while Real-time Telemetry had no CO2 gauge (exact opposites); both added so the two panels mirror the five engine-scored fields (`app/dashboard/page.tsx`).

### Changed / Fixed
- **Single source of truth for optima** — tomato air-temp reconciled dashboard 26 → 25 to match the engine (`sim.py` reads `optimal_targets()`, no separate `_OPTIMALS`); the CO2 target made crop-aware (lettuce 800 / tomato 900) instead of a hardcoded 800 (`backend/app/sim/engine.py`, `app/dashboard/SimulationProvider.tsx`).
- **Fresh crop starts unstressed** — sliders now seed from the engine's seedling-stage optima on load / crop-change / Reset, so the plant opens at ~100% health. Previously the defaults (22 °C / 400 ppm) sat off-target and Reset re-hardcoded CO2 to 400, so it read ~25% stress / ~71% harvest at rest before any user action. Seed-once only (never mid-run), so the plant still drifts as it grows and the user must adapt (`app/dashboard/SimulationProvider.tsx`).
- **Unadjustable EC no longer a permanent stressor** — with stage-aware optima the seedling EC target (0.8 / 2.0) was unreachable because EC had no control, making it a phantom "main stress driver"; the new EC slider fixes this.
- **"Water Temp" telemetry gauge relabeled "Air Temp"** — it displays the air-temperature parameter (`app/dashboard/page.tsx`).

### Removed
- **Dead dataset scaffolding** — the frontend `app/api/dataset/route.ts` (+ its test) and the orphaned `lib/dataset.ts` helper (nothing fetched the route at runtime), plus the vestigial `flowRate` sim param. The backend still reads the CSV **only** for `cycle_length_days`; `backend/app/sim/dataset.py`'s docstring and `docs/local_sim.md` / `docs/simulation.md` were refreshed to match.

### Known limitations / follow-ups
- The engine is **sanity-calibrated, not data-fit** — the dataset is a thesis attachment, not integrated.
- Health has **no equilibrium floor**, is **fully reversible**, and tolerances are **symmetric**; a display-only yield discount (`× √health`) is not reflected in the API. See `docs/engine.md` §8 / `docs/TODO.md`.

---

## 2026-07-18

Weekend build-out of the **`data_processing/` pipeline** — turning the raw Autonomous Greenhouse Challenge (AGC) 2nd-edition cherry-tomato files into one clean, model-ready training table (groundwork for the AI yield/stress model, GitHub issue #33).

### Added
- **`data_processing/` step pipeline (Steps 1–4)** — a folder-per-step, idempotent pipeline (each with its own `README.md` + script) that consolidates the 7 raw AGC files × 6 teams into one **5-min, real-date master** (`2019-12-16 → 2020-05-30`) and derives the supervised targets:
  - **Step 1 — consolidate** → `01_master.parquet` (286,854 × 129): join 7 files on the Excel-serial `%time` axis; sparse tables carried causally forward (`merge_asof` backward).
  - **Step 2 — clean & fill** → `02_clean.parquet` (× 124): range-clip→interpolate on env streams, Feb-2019 production-date typo removed, structural `Cum_trusses` NaN→0, causal fills → **0 missing**.
  - **Step 3 — features** → `03_features.parquet` (× 61): `days_since_transplant`, `growth_stage` (phenology from observed truss/harvest events), `vpd`, `dli_24h`, `gdd_cum`, rolling 24 h stats, NPK columns.
  - **Step 4 — labels** → `04_training_table.parquet` (full/audit, × 68): multi-output targets `y_yield_score`, `y_stress_score`, and the 3D-growth passthroughs (`y_plant_height`, `y_stem_thickness`, `y_truss_count`, `y_plant_density`) + `cum_yield`. Calibration check: corr(stress, yield) = −0.68 per-row, −0.66 per-team.
- **Feature contract + slim training table** — `step_04_labels/finalize.py` projects the 68-col audit table down to `04_training_final.parquet` (**286,854 × 14**): only the features the physics engine can actually supply at inference (`PredictRequest`-bounded), renamed to the serve-contract names, so train and serve match. Prevents train–serve skew (`data_processing/step_05_train/README.md` "Feature contract").
- **Locked ML feature decisions** (documented in `docs/tomato_ml_plan.md`, `docs/TODO.md`, and the Step-5 README):
  - Inputs bounded by `PredictRequest`: `ph, ec (= feed irr_EC), air_temperature_c, humidity_percent, co2_ppm, vpd, days_since_transplant` — `ec` is **feed EC** (the controllable), not drain/slab EC.
  - **`days_since_transplant` is the only lifecycle feature** — not `growth_stage` (train labels it from observed plant events, the engine from fixed calendar day-ranges → same word, different plant) and not `growth_percent` (`Stem_elong`-derived, team-relative → leakage). Feed real days on the AGC `[0, ~166]` axis, don't rescale to the engine's 120-day cycle. The engine keeps computing `growth_stage` for the UI only.
  - **NPK and light/DLI dropped** from the model/UI (no control or visualization); feed EC is the sole nutrient signal (a documented scope trade-off). Stress stays **engine-owned** in v1; the model would output yield + the 3D growth params.
- **`docs/TODO.md`** — post-pivot backlog gating any engine re-calibration / ML-overlay wiring behind "train and verify the model first."

### Changed
- **AI model training (Step 5) shelved for now** — the team is **not** training the ML model at this time. The `data_processing/` pipeline and the training-ready table are kept as a documented record so the work can resume later; the physics engine remains the live scorer for both crops. Steps 5 (train) and 6 (serve) stay `☐ Not started`. GitHub issue #33 is being closed to reflect this pause (the dataset→training-table work is done and recorded).

## 2026-07-17

The simulation engine grew from a stress/yield scorer into a live, stateful, system-aware model.

### Added
- **Live growth dynamics** — pressing Simulate now advances *real* growth. `growth_percent` accumulates each tick at the engine's crop-aware, stress-aware rate (`growth += perTick × growth_rate`) instead of a flat increment, so the growth bar reflects the actual environment and crop cycle. `/api/sim/predict` returns `growth_rate` and `cycle_days`; the dashboard integrates them over ticks (`SIM_HOURS_PER_TICK`) (`backend/app/sim/engine.py`, `backend/app/routers/sim.py`, `app/dashboard/page.tsx`) ([PR #41](https://github.com/rsajid1/HydroSim-internal/pull/41))
- **Stateful plant health & death** — a `health` (vigour) state accumulates the memory of stress: it declines under stress, recovers more slowly (a lasting deficit), discounts the displayed harvest quality, and latches **DEAD** when it reaches 0 (cleared only by Reset/replant). The engine exposes `health_rate`; the frontend integrates it over ticks (`engine.py`, `app/dashboard/page.tsx`) ([PR #43](https://github.com/rsajid1/HydroSim-internal/pull/43))
- **Hydroponic system modelling (NFT vs DWC)** — the System Architecture selector now affects the simulation: DWC's reservoir buffers deviations (the same off-target condition yields less stress) versus the NFT baseline, via `SYSTEM_TOLERANCE_FACTORS`. `/api/sim/predict` takes `system_type`; the selector is trimmed to the two modelled systems (aeroponics/vertical removed) ([PR #44](https://github.com/rsajid1/HydroSim-internal/pull/44))
- **Calibration invariant suite** — `backend/tests/test_calibration.py` sweeps the whole input grid and asserts engine sanity invariants (ideal is perfect, monotonic stress, bounded outputs, life/death ordering with a single-field lethality floor, DWC never harsher than NFT), so a future constant change that breaks sensible behaviour fails CI ([PR #44](https://github.com/rsajid1/HydroSim-internal/pull/44))

### Changed
- **`/api/sim/predict` explanation & status honesty** — the "main stress driver" is now ranked by weighted stress contribution (not raw deviation across mismatched units), EC and CO₂ are included in the ranking, and a single fully-saturated field is no longer reported `stable` (status/risk are floored on saturation) (`backend/app/routers/sim.py`) ([PR #42](https://github.com/rsajid1/HydroSim-internal/pull/42))
- **Health-model calibration** (PR #44) — quadratic decay so mild stress is tolerated while damage accelerates toward severe; worst-factor health (Liebig's law of the minimum) so a single catastrophic field drives survival, with the per-field excess capped so no single field is disproportionately lethal; displayed harvest quality softened to `yield × √health`.
- **Docs** — `docs/simulation.md` rewritten for the engine-driven model (was CSV replay); `docs/local_sim.md` marked partly superseded; `docs/engine.md` gains a calibration-model & limitations section.

### Known limitations / follow-ups
- The engine is **sanity-calibrated, not data-validated** — no ground-truth dataset exists for the modelled water-culture systems; constants are documented engineering estimates.
- Health has **no equilibrium floor** (sustained mild stress declines rather than settling) and is **fully reversible** (no permanent-damage cap); tolerances are symmetric. See `docs/engine.md` §8.

---

## 2026-07-09

### Changed
- `compute_stress` now normalizes the score over the fields actually supplied, so a partial sensor reading spans the full 0-100 range (`backend/app/sim/engine.py`). Previously the dashboard's 5-field reading could reach at most 66 stress — 66 of the 100 available weight — which capped harvest quality at ~24 and made `critical` risk nearly unreachable. Extreme inputs now correctly report 100 stress / 0 yield / `critical`.
- **Behaviour change:** predicted yield can now reach 0 and risk can reach `critical` from the dashboard. `STRESS_WEIGHTS` sums to exactly 100, so readings that supply all eight fields are unaffected and the seeded dataset remains byte-identical.

### Known follow-ups
- The prediction's "main stress driver" is chosen by largest raw deviation across mismatched units rather than largest weighted contribution — rank by weighted stress instead. (Visible today: an env with pH 2.0 units off and humidity 40% off names humidity the driver, though pH carries the higher weight.)
- A single fully-saturated field (e.g. pH at 4.0, alone) scores 27 stress and still classifies as `low` risk. Worth revisiting `classify()` thresholds — or emitting a per-field warning — as part of issue #6.

---

## 2026-07-03

### Changed
- Environment Controls are now a single **global** environment state driving telemetry, the AI prediction, and stress/yield for all pods. The simulation loop no longer overwrites the user's sliders with replayed dataset rows, the EC slider is editable, the prediction refreshes on slider changes even while paused, and helper text clarifies the environment is global (not per-pod) (`app/dashboard/page.tsx`) ([PR #37](https://github.com/rsajid1/HydroSim-internal/pull/37))
- `POST /api/sim/predict` now computes yield/stress from the deterministic grey-box engine (`compute_stress` → `predict_yield` → `classify`) instead of a nearest-row dataset lookup, so predictions respond live to the environment; explanation targets come from `engine.optimal_targets` and the `source` field is now `"engine"`. Request/response contract unchanged (`backend/app/routers/sim.py`) ([PR #37](https://github.com/rsajid1/HydroSim-internal/pull/37))

### Known follow-ups
- ~~Stress score caps ~66% because the engine weights 8 fields but the UI sends only 5~~ — resolved 2026-07-09, see above.
- The prediction's "main stress driver" is chosen by largest raw deviation across mismatched units rather than largest weighted contribution — rank by weighted stress instead.

---

## 2026-06-18

### Added
- AI Yield & Stress Prediction panel — `POST /api/sim/predict` (FastAPI) returns harvest quality, stress factor, estimated time-to-harvest, risk level, and a one-line explanation via a nearest-row lookup over the local synthetic dataset; the dashboard AI card calls it live and falls back to the client-side calculation when the backend is unreachable. Includes the backend dataset loader (`backend/app/sim/dataset.py`) and prediction tests (`backend/tests/test_sim_predict.py`) ([PR #30](https://github.com/rsajid1/HydroSim-internal/pull/30))
- `lib/dataset.ts` — shared, framework-free helpers (`parseDataset`, `filterRowsForCrop`, `normalizeCrop`) for loading the local synthetic dataset, with unit tests in `app/api/dataset/route.test.ts` ([PR #31](https://github.com/rsajid1/HydroSim-internal/pull/31))

### Changed
- Simulation loop now **replays the local synthetic dataset** for the selected crop instead of random parameter drift — one recorded row per tick from `GET /api/dataset?crop=<id>` (`app/dashboard/page.tsx`). Herbs/cucumbers or a failed fetch fall back to drift so the run never stalls ([PR #31](https://github.com/rsajid1/HydroSim-internal/pull/31))
- `GET /api/dataset` is now crop-aware (`?crop=` with `tomatoes`→`tomato` alias), returns rows sorted by grow-cycle day, and handles a missing dataset file with a clear error response (`app/api/dataset/route.ts`) ([PR #31](https://github.com/rsajid1/HydroSim-internal/pull/31))
- Simulation v1 — added the local dataset API route (`app/api/dataset/route.ts`) and integrated the dashboard environment controls; added the simulation guide (`docs/simulation.md`) ([PR #28](https://github.com/rsajid1/HydroSim-internal/pull/28))
- Crop planting reworked — planters grouped into rows of 3 (selecting a crop applies to the whole row), shelf occupancy indicator changed from `x/9` to `x/3 rows`, and the EC slider changed to status-only display ([PR #27](https://github.com/rsajid1/HydroSim-internal/pull/27))
- `pylint` added to `backend/requirements.txt` so backend linting runs locally and in CI ([PR #29](https://github.com/rsajid1/HydroSim-internal/pull/29))
- Documentation updated to reflect dataset-driven simulation (`docs/local_sim.md`, `docs/simulation.md`) ([PR #31](https://github.com/rsajid1/HydroSim-internal/pull/31))

---

## 2026-06-12

### Changed
- QA strategy document updated to reflect the actual CI pipeline and synthetic dataset usage ([PR #24](https://github.com/rsajid1/HydroSim-internal/pull/24))
- Documented the synthetic dataset generator constants with explanatory comments ([PR #25](https://github.com/rsajid1/HydroSim-internal/pull/25))

---

## 2026-06-09

### Added
- Synthetic hydroponics dataset added (`data/synthetic_hydroponics_dataset.csv`) with 480 simulation records across lettuce and tomato crop profiles ([PR #18](https://github.com/rsajid1/HydroSim-internal/pull/18))
- CI/CD pipeline configured via GitHub Actions — runs ESLint + Vitest (frontend) and Pylint + pytest (backend) on all PRs and pushes to main ([PR #17](https://github.com/rsajid1/HydroSim-internal/pull/17))
- Backend test suite added (`backend/tests/`) covering auth validation, health endpoint, and user validation ([PR #17](https://github.com/rsajid1/HydroSim-internal/pull/17))
- Vitest configured for frontend unit testing (`vitest.config.mts`, `vitest.setup.ts`) ([PR #17](https://github.com/rsajid1/HydroSim-internal/pull/17))
- Dataset plan documentation added (`docs/DATASET.md`) ([PR #16](https://github.com/rsajid1/HydroSim-internal/pull/16))

### Changed
- ESLint config updated to exclude `.d.ts` files, `eslint.config.mjs`, and `package-lock.json` from linting
- Turbopack enabled for faster frontend dev server startup
- VS Code settings added to scope ESLint to TypeScript/JavaScript files only

---

## 2026-02-27

### Added
- Database test added to dashboard 
- Added new routes to application to enable data streaming 
- General code improvements 

---

## 2026-02-06

### Added
- Postgres database connection route created 

### Removed
- Front end files deprecated 
---

## 2026-01-30

> No PR available for this release (pushed directly to GitHub)

### Changed
- New planter structure added to simulation 
- Landing page now goes directly to authentication 
- Next updated to version 16.1.6 

---

## 2026-01-22

### Added
- Dashboard added to main project structure 
- Added logout button on dashboard 
### Changed
- Began combining front and backend files 

### Fixed
- Dashboard removed from frontend files 

---

## Planned

### Upcoming
- Deprecate frontend folder 
- Integrate shadcn/ui blocks (https://ui.shadcn.com/blocks) 
