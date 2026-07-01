# -*- coding: utf-8 -*-
"""
Verification / QA of the final training table against the RAW AGC source files.
Cross-checks that values were preserved through the pipeline, reports missing values,
and sanity-checks ranges.  Read-only.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DATA = os.path.join(ROOT, "data", "Autonomous Greenhouse Challenge(AGC) - 2nd Edition")
ART  = os.path.join(ROOT, "data_processing", "artifacts")
EPOCH = pd.Timestamp("1899-12-30")
TEAM = "Automatoes"

def load_raw(team, fn):
    df = pd.read_csv(os.path.join(DATA, team, fn + ".csv"), low_memory=False)
    t = pd.to_numeric(df[df.columns[0]], errors="coerce")
    ts = (EPOCH + pd.to_timedelta(t, unit="D")).dt.round("5min").astype("datetime64[ns]")
    df = df.drop(columns=[df.columns[0]])
    df.columns = [c.strip() for c in df.columns]
    df.insert(0, "timestamp", ts)
    return df.dropna(subset=["timestamp"]).drop_duplicates("timestamp").set_index("timestamp")

def ok(cond):
    return "PASS" if cond else "**FAIL**"

tt = pd.read_parquet(os.path.join(ART, "04_training_table.parquet"))
A = tt[tt.team == TEAM].sort_values("timestamp").set_index("timestamp")

print("=" * 70)
print("1. SHAPE & PER-TEAM ROW COUNTS")
print("=" * 70)
print(f"training table: {tt.shape[0]} rows x {tt.shape[1]} cols, teams={tt.team.nunique()}")
print(tt.team.value_counts().to_string())

print("\n" + "=" * 70)
print("2. CLIMATE CROSS-CHECK (training table vs raw GreenhouseClimate) - Automatoes")
print("=" * 70)
clim = load_raw(TEAM, "GreenhouseClimate")
sample_ts = [A.index[6000], A.index[25000], A.index[44000]]
cols = ["Tair", "Rhair", "CO2air", "pH_drain_PC", "EC_drain_PC"]
for ts in sample_ts:
    print(f"\n  @ {ts}")
    for c in cols:
        raw = pd.to_numeric(pd.Series([clim.loc[ts, c]]), errors="coerce").iloc[0]
        got = A.loc[ts, c]
        print(f"    {c:14} raw={raw!s:>8}  table={got!s:>8}  {ok(np.isclose(raw, got, atol=0.06, equal_nan=True))}")

print("\n" + "=" * 70)
print("3. NPK CROSS-CHECK (forward-filled lab vs raw LabAnalysis) - Automatoes")
print("=" * 70)
lab = load_raw(TEAM, "LabAnalysis")
lab_ts = lab.index[4]
print(f"  lab sample @ {lab_ts}")
for raw_c, tt_c in [("irr_NO3", "irr_NO3"), ("irr_K", "irr_K"), ("irr_PO4", "irr_PO4")]:
    raw = pd.to_numeric(pd.Series([lab.loc[lab_ts, raw_c]]), errors="coerce").iloc[0]
    got = A.loc[lab_ts, tt_c]
    print(f"    {raw_c:10} raw={raw:>7.2f}  table={got:>7.2f}  {ok(np.isclose(raw, got, atol=0.06))}")
n_check = pd.to_numeric(pd.Series([lab.loc[lab_ts, "irr_NO3"]]), errors="coerce").iloc[0] + \
          pd.to_numeric(pd.Series([lab.loc[lab_ts, "irr_NH4"]]), errors="coerce").iloc[0]
print(f"    npk_N == irr_NO3+irr_NH4 : {n_check:.2f} vs {A.loc[lab_ts,'npk_N']:.2f}  {ok(np.isclose(n_check, A.loc[lab_ts,'npk_N'], atol=0.06))}")

print("\n" + "=" * 70)
print("4. YIELD CROSS-CHECK (cum_yield vs raw Production cumsum) - Automatoes")
print("=" * 70)
prod = load_raw(TEAM, "Production").reset_index()
prod = prod[prod.timestamp >= pd.Timestamp("2019-12-16")].sort_values("timestamp")
prod["cum"] = (pd.to_numeric(prod.ProdA, errors="coerce").fillna(0)
               + pd.to_numeric(prod.ProdB, errors="coerce").fillna(0)).cumsum()
raw_final = prod["cum"].iloc[-1]
print(f"    raw cumsum(ProdA+ProdB) final = {raw_final:.2f}")
print(f"    table cum_yield max           = {A['cum_yield'].max():.2f}   {ok(np.isclose(raw_final, A['cum_yield'].max(), atol=0.05))}")
print(f"    (Automatoes published winner; expected ~14.92)")

print("\n" + "=" * 70)
print("5. GROWTH CROSS-CHECK (y_plant_height vs raw CropParameters.Stem_elong)")
print("=" * 70)
crop = load_raw(TEAM, "CropParameters")
cts = crop.index[8]
raw = pd.to_numeric(pd.Series([crop.loc[cts, "Stem_elong"]]), errors="coerce").iloc[0]
print(f"  @ {cts}  raw Stem_elong={raw:.2f}  table y_plant_height={A.loc[cts,'y_plant_height']:.2f}  "
      f"{ok(np.isclose(raw, A.loc[cts,'y_plant_height'], atol=0.06))}")

print("\n" + "=" * 70)
print("6. MISSING VALUES (whole training table)")
print("=" * 70)
miss = tt.isna().sum()
miss = miss[miss > 0]
if len(miss) == 0:
    print("  0 missing values across all 68 columns.  PASS")
else:
    print(miss.to_string())

print("\n" + "=" * 70)
print("7. RANGE SANITY (key columns, all teams)")
print("=" * 70)
bounds = {"Tair": (10, 35), "Rhair": (20, 100), "CO2air": (300, 1500), "pH_drain_PC": (4, 8),
          "EC_drain_PC": (0.5, 8), "npk_N": (5, 30), "npk_K": (5, 25), "npk_P": (0.5, 6),
          "y_yield_score": (0, 100), "y_stress_score": (0, 100), "y_plant_height": (0, 60)}
for c, (lo, hi) in bounds.items():
    s = tt[c]
    within = s.between(lo, hi).mean() * 100
    print(f"  {c:14} min={s.min():8.2f} max={s.max():8.2f}  within[{lo},{hi}]={within:5.1f}%  {ok(within > 99)}")
