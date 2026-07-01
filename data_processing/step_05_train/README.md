# Step 5 — Train & validate

**Status:** ☐ Not started

## Goal
Train the **multi-output** model (v1 = tabular gradient-boosted) and validate without leakage.

## Input → Output
`artifacts/04_training_table.parquet` → `artifacts/05_model.pkl` + `artifacts/metrics.json`

## Operations
- Model: **XGBoost / LightGBM**, multi-output (yield, stress, + 3D growth params).
- Validation: **temporal split** and/or **leave-one-team-out** CV — never random-split.
- Report R² / MAE per target per split → `metrics.json`.
- **SHAP** for the top stress driver → feeds the UI `explanation` string.

## Notes
- v1 stays **stateless** (snapshot in → score out) to fit `/api/sim/predict`.
- v2 (sequence model: LSTM/TCN/TFT) is out of scope here — needs a stateful endpoint.
- Keep a linear/RandomForest baseline for comparison.
