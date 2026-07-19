# Changelog
> Please note, PR links are not available for changes below as they are on private repository or not committed. Changes implemented after May 12, 2026 will include PR links. 
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
