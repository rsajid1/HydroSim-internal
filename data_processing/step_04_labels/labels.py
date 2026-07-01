# -*- coding: utf-8 -*-
"""
Step 4 - Labels (multi-output targets).  All targets are prefixed `y_` so Step 5 can cleanly
separate features from targets. This step is ADDITIVE (adds y_* + cum_yield; drops nothing).

Input : ../artifacts/03_features.parquet
Output: ../artifacts/04_training_table.parquet

A. cum_yield         - real cumulative kg/m2 (reloaded Production, cumsum over harvest dates).
B. y_yield_score     - performance vs champion Automatoes at same age (0-100).
C. y_stress_score    - 0.5*env_deviation + 0.5*growth_deficit, scaled 0-100 (documented v1).
D. y_plant_height / y_stem_thickness / y_truss_count / y_plant_density - 3D growth passthrough.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(ROOT, "data", "Autonomous Greenhouse Challenge(AGC) - 2nd Edition")
ART  = os.path.join(ROOT, "data_processing", "artifacts")
EPOCH = pd.Timestamp("1899-12-30")
SEASON_START = pd.Timestamp("2019-12-16")
CHAMPION = "Automatoes"
TEAMS = ["AICU", "Automatoes", "Digilog", "IUACAAS", "Reference", "TheAutomators"]

# --- stress-score v1 constants (tune here) ---
OPT = {"temp": (21.0, 8.0), "ph": (6.0, 1.5), "ec": (3.5, 3.0), "vpd": (0.9, 1.5)}
CO2_OPT, CO2_TOL = 800.0, 600.0                     # one-sided: only LOW CO2 penalised
DEV_W = {"temp": 0.30, "ph": 0.20, "ec": 0.20, "vpd": 0.20, "co2": 0.10}
W_ENV, W_DEFICIT = 0.5, 0.5

def cum_yield_on_grid(team, grid):
    """Reload sparse Production, drop pre-season typo, cumsum(ProdA+ProdB), map onto 5-min grid."""
    df = pd.read_csv(os.path.join(DATA, team, "Production.csv"), low_memory=False)
    t = pd.to_numeric(df[df.columns[0]], errors="coerce")
    ts = (EPOCH + pd.to_timedelta(t, unit="D")).dt.round("5min").astype("datetime64[ns]")
    prod = pd.DataFrame({"timestamp": ts,
                         "inc": pd.to_numeric(df["ProdA"], errors="coerce").fillna(0)
                             + pd.to_numeric(df["ProdB"], errors="coerce").fillna(0)})
    prod = prod[prod["timestamp"] >= SEASON_START].sort_values("timestamp")
    prod["cum"] = prod["inc"].cumsum()
    merged = pd.merge_asof(grid.sort_values("timestamp"), prod[["timestamp", "cum"]],
                           on="timestamp", direction="backward")
    return merged["cum"].fillna(0).values

def dev(series, opt, tol):
    return (series - opt).abs().div(tol).clip(0, 1)

def main():
    f = pd.read_parquet(os.path.join(ART, "03_features.parquet"))

    # A. cumulative yield per team on the grid
    parts = []
    for team, g in f.groupby("team", sort=False):
        g = g.sort_values("timestamp").copy()
        g["cum_yield"] = cum_yield_on_grid(team, g[["timestamp"]])
        parts.append(g)
    f = pd.concat(parts, ignore_index=True)

    # B. performance vs champion at same age (grids are identical across teams -> join on timestamp)
    ref = (f[f["team"] == CHAMPION][["timestamp", "Stem_elong", "cum_yield"]]
           .rename(columns={"Stem_elong": "auto_stem", "cum_yield": "auto_cum"}))
    f = f.merge(ref, on="timestamp", how="left")
    ratio_y = f["cum_yield"] / f["auto_cum"].replace(0, np.nan)
    ratio_g = f["Stem_elong"] / f["auto_stem"].replace(0, np.nan)
    perf = ratio_y.where(f["auto_cum"] > 0, ratio_g).fillna(1.0)
    f["y_yield_score"] = (100 * perf).clip(0, 100)

    # C. stress = env deviation + growth deficit
    env = (DEV_W["temp"] * dev(f["tair_24h_mean"], *OPT["temp"])
           + DEV_W["ph"]  * dev(f["pH_drain_PC"], *OPT["ph"])
           + DEV_W["ec"]  * dev(f["EC_drain_PC"], *OPT["ec"])
           + DEV_W["vpd"] * dev(f["vpd"], *OPT["vpd"])
           + DEV_W["co2"] * (CO2_OPT - f["CO2air"]).clip(lower=0).div(CO2_TOL).clip(0, 1))
    deficit = (1 - f["y_yield_score"] / 100).clip(0, 1)
    f["y_stress_score"] = (100 * (W_ENV * env + W_DEFICIT * deficit)).clip(0, 100)

    # D. 3D growth passthrough targets
    f["y_plant_height"]   = f["Stem_elong"]
    f["y_stem_thickness"] = f["Stem_thick"]
    f["y_truss_count"]    = f["Cum_trusses"]
    f["y_plant_density"]  = f["plant_dens"]

    f = f.drop(columns=["auto_stem", "auto_cum"])
    os.makedirs(ART, exist_ok=True)
    outp = os.path.join(ART, "04_training_table.parquet")
    f.to_parquet(outp, index=False)

    # ---- report ----
    print("=== 04_training_table ===")
    print(f"shape: {f.shape[0]} rows x {f.shape[1]} cols")
    print("\nfinal cum_yield (kg/m2) & mean scores per team:")
    print(f"{'team':14} {'final_yield':>11} {'yield_score':>11} {'stress':>8}")
    for team, g in f.groupby("team", sort=False):
        print(f"{team:14} {g['cum_yield'].max():>11.2f} {g['y_yield_score'].mean():>11.1f} {g['y_stress_score'].mean():>8.1f}")
    print("\ncalibration checks (want negative):")
    print(f"  corr(stress, yield_score)  [per-row, instantaneous] = {f['y_stress_score'].corr(f['y_yield_score']):.3f}")
    ts = f.groupby('team').agg(fin=('cum_yield', 'max'), st=('y_stress_score', 'mean'))
    print(f"  corr(mean_stress, final_yield) [per-team, n=6]       = {ts['fin'].corr(ts['st']):.3f}")
    print("  (cum_yield is monotonic-in-time, so corr(stress, cum_yield) is not a valid check)")
    print("\ntarget ranges (min/mean/max):")
    for c in ["y_yield_score", "y_stress_score", "y_plant_height", "y_stem_thickness",
              "y_truss_count", "y_plant_density"]:
        s = f[c]
        print(f"  {c:18} {s.min():8.2f} {s.mean():8.2f} {s.max():8.2f}")
    print(f"\nwrote: {outp}")

if __name__ == "__main__":
    main()