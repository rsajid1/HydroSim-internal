# HydroSim — TODO: engine & system

The deterministic **grey-box physics engine** (`backend/app/sim/engine.py`) is the **permanent,
sole scorer** for both crops. There is **no ML model** and **no dataset integration** on the
roadmap: the team dropped model training/serving, and the AGC tomato dataset + `data_processing/`
pipeline now stand only as a **research / thesis attachment** — they are not calibrated into,
aligned with, or wired into the running system.

This file therefore tracks only the remaining **engine-internal, system, and documentation**
work. Anything that would derive engine numbers from the dataset is intentionally **out of
scope** and not listed here.

Related docs: [`docs/engine.md`](engine.md) · [`docs/local_sim.md`](local_sim.md) ·
[`docs/simulation.md`](simulation.md)

---

## 1. Keep engine ↔ dashboard constants in sync (single source of truth) — DONE

The engine's `CROP_PROFILES` and the dashboard's `CROPS[].optimal` are two separate literals with
no shared config — they can silently drift, and when they do the UI's "Target" / Reset default
lands off the engine's optimum (a user on-target reads phantom stress).

- [x] **Tomato air-temp 25 vs 26 — RESOLVED.** Dashboard `CROPS[].optimal.temp` reconciled 26 → 25
      to match the engine (`sim.py` reads `optimal_targets()`; no separate `_OPTIMALS`).
- [x] **CO2 target — RESOLVED.** The CO2 slider hardcoded `optimal={800}` for all crops while the
      engine scores lettuce 800 / tomato 900. Added `co2` to `OptimalConditions` + `CROPS` (800 /
      900, matching `CROP_PROFILES`) and wired the slider to `activeCrop.optimal.co2`.
- [x] **Swept the rest.** ph / ec / temp / humidity / co2 now all match the engine.
      `water_temperature_c`, `water_level_percent`, `light_hours` are not exposed as UI controls,
      so the engine's present-weight normalization just omits them — no target to drift.
- Note: initial/Reset CO2 defaults to 400 ppm (ambient, unenriched) **by design** — a starting
  condition, not a drift; the slider's Target now correctly reads the crop optimum.

## 2. Stage-aware targets (issue #5) — reasoned estimates, not data

Engine v1 uses one crop-level target and **ignores** the `stage` argument.

- [ ] Make `optimal_targets(crop, stage)` actually use `stage`, with per-stage target bands set
      from **published agronomic priors** (same reasoned-estimate tier as the rest of the engine).

## 3. System — engine is the sole live source — VALIDATED (teammate did it)

A teammate wired the engine in as the live scorer (via the #47 visualization refactor). What
validation found:

- [x] **Engine is the sole runtime scorer.** Nothing in `app/`, `components/`, or `lib/` fetches
      `GET /api/dataset` at runtime — the dashboard drives everything off `POST /api/sim/predict`.
      The backend consults the synthetic CSV **only** for `cycle_length_days` (time-to-harvest), a
      reference input, not replay (`backend/app/routers/sim.py:154`).
- [ ] Remove the now-dead `app/api/dataset/route.ts` (+ `route.test.ts`) — unused at runtime.
- [ ] Update `docs/local_sim.md` / `docs/simulation.md` to describe the engine as the sole live
      source (no dataset replay, no model overlay).

---

## Engine limitations to document in the final report

Not code TODOs — accepted limitations to write up (the engine is sanity-calibrated by reasoned
estimate, not data-fit; see `docs/engine.md` §8):

- **Display-only yield discount** — the dashboard shows `harvest_quality × √health`, but the API
  returns the **undiscounted** `harvest_quality` (`predict_yield` is untouched). The health
  penalty is a presentation choice; any other API consumer sees the raw number.
- **Health has no equilibrium floor** — for any stress above `HEALTH_STRESS_NEUTRAL` the health
  rate is a fixed negative value independent of current health, so a persistently mid-stressed
  plant (~30–50) crawls to death rather than settling at a stable reduced vigor.
- **Health is fully reversible** — recovery always returns to 1.0; prior damage leaves no
  permanent ceiling. Only actual death (health 0) latches.
- **Symmetric tolerances** — stress uses `abs(value − target)`, so too-hot = too-cold and
  below-optimal = above-optimal for every field; real crop responses are asymmetric.
- **Estimate-based constants** — the DWC system factor `1.3` and `HEALTH_LIEBIG_SCALE 40` (and
  the health decay/recovery rates) are documented engineering estimates.