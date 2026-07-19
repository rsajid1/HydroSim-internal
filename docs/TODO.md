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

## 1. Keep engine ↔ dashboard constants in sync (single source of truth)

The engine's `CROP_PROFILES` and the dashboard's `CROPS[].optimal` are two separate literals with
no shared config — they can silently drift, and when they do the UI's "Target" / Reset default
lands off the engine's optimum (a user on-target reads phantom stress).

- [x] **Tomato air-temp 25 vs 26 — RESOLVED.** Engine `CROP_PROFILES` is the source of truth
      (25.0); the dashboard `CROPS[].optimal.temp` was reconciled 26 → 25, and `sim.py` reads
      `optimal_targets()` (no separate `_OPTIMALS`).
- [ ] Sweep the **other** engine targets/limits against the dashboard values and fix any further
      drift (see the comment above `CROPS` in `app/dashboard/SimulationProvider.tsx`).

## 2. Stage-aware targets (issue #5) — reasoned estimates, not data

Engine v1 uses one crop-level target and **ignores** the `stage` argument.

- [ ] Make `optimal_targets(crop, stage)` actually use `stage`, with per-stage target bands set
      from **published agronomic priors** (same reasoned-estimate tier as the rest of the engine).

## 3. Lettuce profile — published priors only

- [ ] Add `docs/lettuce_priors.md` citing the sources behind the OSU lettuce profile so the
      engine's lettuce numbers are defensible.
- [ ] Keep lettuce as a **reasoned-estimate** tier (published sources, no calibration).

## 4. System — make the engine the sole live source

The engine already scores `/api/sim/predict`; finish removing the old CSV-replay leftovers so the
running app no longer touches a dataset at runtime.

- [ ] Retire the runtime CSV replay in `app/dashboard/page.tsx` / `GET /api/dataset` (keep the
      CSV only as a dev/demo fallback for time-to-harvest, if at all).
- [ ] Update `docs/local_sim.md` (still describes CSV-lookup v1) and `docs/simulation.md` so they
      describe the engine as the sole live source (no dataset, no model overlay).

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