# Step 2 — Clean & causal fill

**Status:** ☑ Done — `artifacts/02_clean.parquet` (286,854 × 124); 56,160 pre-harvest production cells zeroed (typo removed), key columns 100% covered, 5 empty `Unnamed:` cols dropped

## Goal
Fix the known data-quality anomalies and fill missing values **causally** (no future leakage).

## Input → Output
`artifacts/01_master.parquet` → `artifacts/02_clean.parquet`

## Operations
1. **`Production` row-1 date typo** (`2019-02-14`) → drop/relabel.
2. **`TomQuality`** relative-day axis + merged `Weight/DMC_fruit` header → remap or set aside.
3. **Range clips** (pH ∈ [3,9], EC ∈ [0,8]) + rolling-median despike on 5-min streams.
4. **`IUACAAS/Resources` 45 % missing** → don't depend on its resource columns.
5. **Fills:** structural `0` for pre-truss `Cum_trusses`; forward-fill lab/recipe; interpolate
   growth. Impute using **past values only**.

## Notes
- `IUACAAS` is also the lowest producer — fine to keep for input variety, just don't trust its
  Resources columns.
- Record any rows dropped (count) in a short log for traceability.
