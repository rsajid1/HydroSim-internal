# HydroSim — Simulation Guide

## What the Simulation Does

HydroSim is a **live grey-box simulation**, not a data replay. You set the environment with sliders
(pH, EC, temperature, humidity, CO₂) and choose a crop and a hydroponic system (NFT or DWC). A
deterministic engine (`backend/app/sim/engine.py`) computes stress, growth, and plant health from
those inputs each tick. The synthetic dataset is a calibration/validation artefact and a stand-in for
the partner data that never arrived — it is **not** the live data source.

Once a crop is planted and you press **Simulate**, each 1-second tick advances `SIM_HOURS_PER_TICK`
(6) simulated hours and does three things:

1. Sends the current environment to `POST /api/sim/predict`, which returns stress, harvest quality,
   growth rate, health rate, risk, and a one-line explanation.
2. **Grows** the plant: `growth += perTick × growth_rate × health` — gated by *both* current
   conditions (`growth_rate`) and accumulated vigour (`health`), so a recovering plant grows slowly.
3. **Integrates health** (plant vigour, 0–100%): it declines under stress, recovers more slowly under
   good conditions, and if it reaches 0 the plant **dies** — an absorbing state cleared only by Reset
   or replanting.

| What you see | Driven by |
|---|---|
| Stress Factor | engine weighted normalised-deviation stress (0–100) |
| Estimated Harvest Quality | engine yield (`100 − 1.15·stress`) × √health (accumulated-damage discount) |
| Health % | integrated engine health rate; 0 = dead |
| Growth Stage / % | accumulated growth, crop-cycle aware |
| Est. time to harvest | crop cycle length × remaining growth |
| Risk / status / explanation | engine `classify` + largest weighted stress driver |

## Systems (NFT vs DWC)

The **System Architecture** selector changes how forgiving the root zone is. DWC's large reservoir
buffers pH/EC/temperature swings, so the same off-target condition produces **less** stress; NFT is the
baseline. Only NFT and DWC are modelled (via `SYSTEM_TOLERANCE_FACTORS` in the engine); an unknown
system falls back to the NFT baseline.

## The environment is global

All sliders apply to every shelf and pod — a single shared nutrient solution and climate. Per-pod
overrides are not supported.

## How to Change the Simulation

- **Engine parameters & formulae** (targets, tolerances, weights, health/system constants): the single
  source of truth is `backend/app/sim/engine.py`. See `docs/engine.md` for the full parameter reference,
  the calibration model, and the sanity-invariant guard (`backend/tests/test_calibration.py`).
- **Simulation speed / time base:** `SIM_HOURS_PER_TICK` and the 1000 ms interval in
  `app/dashboard/page.tsx`.
- **Crop targets or a new crop:** `CROP_PROFILES` in the engine (the dataset generator imports the same
  constants, so the two cannot drift).

## Calibration & limitations

The engine is **sanity-calibrated, not data-validated** — there is no ground-truth dataset for the
water-culture systems modelled. `docs/engine.md` §8 documents the accepted simplifications: symmetric
tolerances, health has no equilibrium floor (sustained mild stress declines rather than settling), and
health is fully reversible (no permanent-damage cap). These are v1 grey-box simplifications with the
realistic versions noted as future work.
