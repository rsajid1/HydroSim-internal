# -*- coding: utf-8 -*-
"""
Step 1 - Consolidate: join the 7 AGC tomato files per team into ONE 5-min master
table with real dates, then stack all 6 teams (add a `team` column).

Input : ../../data/Autonomous Greenhouse Challenge(AGC) - 2nd Edition/<team>/*.csv
Output: ../artifacts/01_master.parquet

Design (see docs/tomato_ml_plan.md + step README):
- `%time` is an Excel serial number -> datetime (epoch 1899-12-30), rounded to the 5-min grid.
- Spine = GreenhouseClimate (5-min). GrodanSens + Weather join on the exact 5-min timestamp.
- Sparse tables (LabAnalysis ~14d, CropParameters weekly, Production weekly, Resources daily)
  are attached with merge_asof(direction="backward") = causal forward-fill of the most-recent
  prior measurement (no future leakage). TomQuality is skipped here (relative-day axis; step 2).
- Cleaning / interpolation / label-building happen in later steps. This step only aligns + joins.
"""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(ROOT, "data", "Autonomous Greenhouse Challenge(AGC) - 2nd Edition")
ART  = os.path.join(ROOT, "data_processing", "artifacts")
EPOCH = pd.Timestamp("1899-12-30")
TEAMS = ["AICU", "Automatoes", "Digilog", "IUACAAS", "Reference", "TheAutomators"]

def load(path):
    """Read a file, convert its first column (%time serial) to a 5-min-rounded timestamp."""
    df = pd.read_csv(path, low_memory=False)
    tc = df.columns[0]
    t = pd.to_numeric(df[tc], errors="coerce")
    df = df.drop(columns=[tc])
    ts = (EPOCH + pd.to_timedelta(t, unit="D")).dt.round("5min").astype("datetime64[ns]")
    df.insert(0, "timestamp", ts)
    df = df.dropna(subset=["timestamp"]).drop_duplicates("timestamp").sort_values("timestamp")
    return df.reset_index(drop=True)

def main():
    weather = load(os.path.join(DATA, "Weather", "Weather.csv"))
    frames = []
    for team in TEAMS:
        d = os.path.join(DATA, team)
        m = load(os.path.join(d, "GreenhouseClimate.csv"))                  # spine (5-min)
        m = m.merge(load(os.path.join(d, "GrodanSens.csv")), on="timestamp", how="left")
        m = m.merge(weather, on="timestamp", how="left")
        for fn in ("LabAnalysis", "CropParameters", "Production", "Resources"):
            s = load(os.path.join(d, fn + ".csv"))
            m = pd.merge_asof(m, s, on="timestamp", direction="backward")   # causal forward-fill
        m.insert(0, "team", team)
        frames.append(m)
        print(f"  {team:14} rows={len(m):>6}  {m.timestamp.min()} -> {m.timestamp.max()}")

    master = pd.concat(frames, ignore_index=True)
    os.makedirs(ART, exist_ok=True)
    out = os.path.join(ART, "01_master.parquet")
    master.to_parquet(out, index=False)

    # ---- sanity report ----
    print("\n=== 01_master ===")
    print(f"shape: {master.shape[0]} rows x {master.shape[1]} cols")
    print(f"teams: {master['team'].nunique()}  |  date range: {master.timestamp.min()} -> {master.timestamp.max()}")
    key = ["Tair", "Rhair", "CO2air", "pH_drain_PC", "EC_drain_PC", "EC_slab1", "t_slab1",
           "PARout", "irr_NO3", "irr_PO4", "irr_K", "Stem_elong", "Cum_trusses", "ProdA"]
    print("\nkey-column coverage (non-null %):")
    for c in key:
        if c in master.columns:
            print(f"  {c:14} {100*master[c].notna().mean():5.1f}%")
        else:
            print(f"  {c:14} MISSING COLUMN")
    print(f"\nwrote: {out}")

if __name__ == "__main__":
    main()
