# Step 1 — Consolidate (ETL / join the 7 files)

**Status:** ☐ Not started

## Goal
Join the 7 tomato files per team into **one 5-min master** with real dates, then stack all 6
teams (add a `team` column). Preserve the real timeline — no aggregation.

## Inputs
`../data/Autonomous Greenhouse Challenge(AGC) - 2nd Edition/<team>/*.csv` + `Weather/Weather.csv`

## Output
`artifacts/01_master.parquet` — one row per `(team, timestamp)`; columns = climate + slab +
weather (5-min) + forward-filled lab (NPK) + interpolated crop params + aligned production.

## Operations
1. Parse `%time` (Excel serial) → `timestamp` datetime (epoch `1899-12-30`).
2. Use `GreenhouseClimate` 5-min index as the spine; left-join `GrodanSens`, `Weather` on timestamp.
3. `LabAnalysis` (~14-day) → **forward-fill** onto the 5-min grid (recipe holds between samples).
4. `CropParameters` (weekly) → **interpolate** onto the grid.
5. `Production` (weekly) → align to harvest dates (keep sparse; labels come in step 4).
6. Concatenate all 6 teams with a `team` column.

## Notes / gotchas
- Keep 5-min; do **not** aggregate.
- `Weather` is shared across teams (join on timestamp only).
- Do cleaning in step 2 — here just align + join.
