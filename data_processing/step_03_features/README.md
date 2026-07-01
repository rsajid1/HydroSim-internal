# Step 3 — Feature engineering (incl. growth stage)

**Status:** ☑ Done — `artifacts/03_features.parquet` (286,854 × 61 = 45 raw + 14 engineered); `growth_stage`/`growth_percent`, VPD, DLI, GDD, rolling Tair, pH excursions, NPK (N/P/K + ratio + uptake); setpoint/actuator columns dropped

## Goal
Derive model features from the clean master, including the engineered **growth stage**.

## Input → Output
`artifacts/02_clean.parquet` → `artifacts/03_features.parquet`

## Operations
- **`days_since_transplant`** (transplant = `2019-12-16`).
- **`growth_percent`** = `clip(Stem_elong / final Stem_elong × 100, 0, 100)`.
- **`growth_stage`**: seedling → vegetative → flowering (`Cum_trusses>0`) → fruiting →
  harvest (`Production>0`); thresholds from actual truss/harvest dates.
- **Environment features:** DLI (`Tot_PAR`/`PARout`), VPD (`Tair`+`Rhair` or `HumDef`),
  GDD (cumulative), daily min/max/range, pH/EC excursion counts.
- **NPK:** N = `irr_NO3`+`irr_NH4`, P = `irr_PO4`, K = `irr_K` (+ K:Ca:Mg ratios).

## Notes
- Growth stage is engineered per team from its own trajectory.
- All rolling/cumulative features computed causally within each `team`.
