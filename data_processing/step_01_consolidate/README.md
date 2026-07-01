# Step 1 — Consolidate (ETL / join the 7 files)

**Status:** ☑ Done — `artifacts/01_master.parquet` (286,854 rows × 129 cols, 6 teams, 2019-12-16 → 2020-05-30)

## Goal
Join the 7 tomato files per team into **one 5-min master** with real dates, then stack all 6
teams (add a `team` column). Preserve the real timeline — no aggregation.

## Inputs
`../data/Autonomous Greenhouse Challenge(AGC) - 2nd Edition/<team>/*.csv` + `Weather/Weather.csv`

## Output
`artifacts/01_master.parquet` — one row per `(team, timestamp)`; columns = climate + slab +
weather (5-min) + forward-filled lab (NPK) + forward-filled crop params + aligned production.

## Operations
1. Parse `%time` (Excel serial) → `timestamp` datetime (epoch `1899-12-30`), rounded to 5-min.
2. Use `GreenhouseClimate` 5-min index as the spine; join `GrodanSens`, `Weather` on timestamp.
3. Sparse tables (`LabAnalysis` ~14-day, `CropParameters` weekly, `Production` weekly,
   `Resources` daily) → `merge_asof(direction="backward")` = causal forward-fill.
4. Concatenate all 6 teams with a `team` column.

## Run
```bash
../.venv/Scripts/python.exe consolidate.py
```

## Notes / gotchas
- Keep 5-min; do **not** aggregate.
- `Weather` is shared across teams (join on timestamp only).
- `TomQuality` is skipped here (relative-day axis) — handled in step 2.
- Cleaning (Production row-1 typo, interpolation) is step 2 — here just align + join.
