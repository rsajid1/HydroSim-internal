# -*- coding: utf-8 -*-
"""
Step 4 (finalize) - Project the full labelled table down to the SLIM training table.

Input : ../artifacts/04_training_table.parquet   (68 cols, audit/provenance)
Output: ../artifacts/04_training_final.parquet    (14 cols, what Step 5 trains on)
        ../artifacts/04_training_final.csv         (same, for inspection)

Why a separate slim table (see data_processing/step_05_train/README.md "Feature contract"):
- The model's inputs are bounded by what the physics engine supplies live (PredictRequest).
- Training on columns the server can't populate = train-serve skew.
- The raw growth/production + greenhouse-internal columns already did their job (they BUILT
  the labels in labels.py); after that they must NOT be fed as features.
- Feature columns are renamed to the serve-contract names so train and serve match exactly.

This is a pure column select + rename. Values are unchanged (verified in verify.py).
"""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ART  = os.path.abspath(os.path.join(HERE, "..", "artifacts"))

# raw column  ->  serve-contract feature name (PredictRequest fields + derived vpd + clock)
FEATURE_MAP = {
    "pH_drain_PC": "ph",
    "irr_EC":      "ec",                 # FEED EC (recipe/supply), not drain/slab -- locked decision
    "Tair":        "air_temperature_c",
    "Rhair":       "humidity_percent",
    "CO2air":      "co2_ppm",
    "vpd":         "vpd",                # derived from Tair+Rhair (engine computes it live)
    "days_since_transplant": "days_since_transplant",   # the ONLY lifecycle feature
}
KEYS    = ["team", "timestamp"]
TARGETS = ["y_yield_score", "y_plant_height", "y_stem_thickness",
           "y_truss_count", "y_plant_density"]           # stress stays engine-owned in v1


def main():
    full = pd.read_parquet(os.path.join(ART, "04_training_table.parquet"))

    missing = [c for c in list(FEATURE_MAP) + KEYS + TARGETS if c not in full.columns]
    if missing:
        raise SystemExit(f"missing expected columns in 04_training_table: {missing}")

    slim = full[KEYS + list(FEATURE_MAP) + TARGETS].rename(columns=FEATURE_MAP)
    slim = slim[KEYS + list(FEATURE_MAP.values()) + TARGETS]   # stable, readable order

    # guard: features/targets must be fully populated (0 missing was verified upstream)
    nulls = slim.drop(columns=KEYS).isna().sum()
    bad = nulls[nulls > 0]

    os.makedirs(ART, exist_ok=True)
    pq = os.path.join(ART, "04_training_final.parquet")
    csv = os.path.join(ART, "04_training_final.csv")
    slim.to_parquet(pq, index=False)
    slim_csv = slim.copy()
    float_cols = slim_csv.select_dtypes("float").columns
    slim_csv[float_cols] = slim_csv[float_cols].round(4)
    slim_csv.to_csv(csv, index=False)

    print("=== 04_training_final (slim) ===")
    print(f"shape: {slim.shape[0]} rows x {slim.shape[1]} cols  (from full {full.shape[1]} cols)")
    print(f"features (X): {list(FEATURE_MAP.values())}")
    print(f"targets  (Y): {TARGETS}")
    if len(bad):
        print(f"\n!! columns with missing values:\n{bad.to_string()}")
    else:
        print("missing values: 0  PASS")
    print("\nec (feed) sanity  min/mean/max: "
          f"{slim['ec'].min():.2f} / {slim['ec'].mean():.2f} / {slim['ec'].max():.2f}")
    print(f"\nwrote: {pq}\nwrote: {csv}")


if __name__ == "__main__":
    main()