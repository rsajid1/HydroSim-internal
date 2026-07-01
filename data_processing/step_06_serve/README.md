# Step 6 — Serve / integrate

**Status:** ☐ Not started

## Goal
Ship two artifacts into the app: the **replay CSV** and the **trained model** — without changing
the `/api/sim/predict` contract.

## Inputs → Outputs
- `artifacts/01_master.parquet` (or a slim view) → app **`../data/tomato_real.csv`** (replay source).
- `artifacts/05_model.pkl` → served by the backend scorer.

## Operations
1. Export a HydroSim-schema CSV for the simulator replay (real 5-min timeline; played fast).
2. Swap the lookup inside `backend/app/routers/sim.py::predict()` for `model.predict(features)`
   — **request/response shape unchanged** (see `docs/local_sim.md`).
3. (Optional) add a `confidence` field and a "Model" source badge.

## Notes
- CSV = "what the environment does over the cycle"; model = "given conditions → yield/stress/growth".
  Both are needed; the model replaces the *lookup*, not the CSV.
- Keep the synthetic dataset path working as a fallback.
