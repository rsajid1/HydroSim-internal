# HydroSim — TODO: engine & system

The deterministic **grey-box physics engine** (`backend/app/sim/engine.py`) is the **permanent,
sole scorer** for both crops. There is **no ML model** and **no dataset integration** on the
roadmap: the team dropped model training/serving, and the AGC tomato dataset + `data_processing/`
pipeline now stand only as a **research / thesis attachment** — not wired into the running system.

Related docs: [`docs/engine.md`](engine.md) · [`docs/local_sim.md`](local_sim.md) ·
[`docs/simulation.md`](simulation.md)

---

## ⏳ Pending

_None — all tracked engine/system work is complete._ The AGC dataset + `data_processing/`
pipeline remain a research/thesis attachment, intentionally out of scope.

---

## ✅ Completed

1. **Engine ↔ dashboard constants in sync** — reconciled tomato air-temp (26 → 25) and the CO2
   target (crop-aware 800 / 900, was a hardcoded 800) so the engine's `CROP_PROFILES` is the
   single source of truth. Swept every UI-scored field (pH / EC / temp / humidity / CO2 all match
   the engine; the unexposed water/light fields have no UI target to drift).

2. **Stage-aware targets (issue #5)** — `optimal_targets(crop, stage)` overlays per-stage
   `stage_targets` (tomato 5 stages, lettuce 3; EC ramps with maturity, humidity drops at
   flowering, temps ease toward harvest). `stage_for_progress` resolves the stage from
   `growth_percent` (no request-contract change); `sim.py` threads it through
   stress/growth/health/explanation and returns `growth_stage` + a stage-aware `optimal`. Dashboard
   sliders/gauges shift their "Target" as the plant grows. `stage=None`/unknown stage keeps
   crop-level, so the dataset generator and calibration suite are unaffected and the seeded CSV
   stays byte-identical. Tests updated (118 backend pass, lint 0 errors).

3. **System — engine is the sole live scorer (validated)** — confirmed nothing in `app/` /
   `components/` / `lib/` fetches `GET /api/dataset` at runtime; the dashboard runs entirely off
   `POST /api/sim/predict`, and the backend consults the synthetic CSV **only** for
   `cycle_length_days` (a reference input, not replay).

5. **System cleanup — dead code + docs** — removed the now-dead `app/api/dataset/route.ts`
   (+ `route.test.ts`) and its orphaned `lib/dataset.ts` helper, and dropped the vestigial
   `flowRate` sim param. Refreshed the `backend/app/sim/dataset.py` docstring (crop-metadata only
   now), rewrote the stale `docs/local_sim.md` banner, and added a stage-aware note to
   `docs/simulation.md`. Backend still reads the CSV only for `cycle_length_days`.

4. **Environment controls / telemetry + healthy start** — the Environment Controls had no EC
   slider while Telemetry had no CO2 gauge (exact opposites); with stage-aware optima, the
   unadjustable EC made the seedling EC target a permanent, unfixable stress driver. Added an **EC
   control slider** and a **CO2 telemetry gauge** (controls ↔ telemetry now mirror the 5
   engine-scored fields), relabeled the "Water Temp" gauge to **"Air Temp"** (it shows air temp),
   and **seeded the sliders from the engine's seedling-stage optima** on load / crop-change / Reset
   so a fresh crop opens unstressed — previously it read ~25% stress / ~71% harvest at rest from
   off-target 22 °C / 400 ppm defaults, and Reset re-hardcoded CO2 to 400.

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