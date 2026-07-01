# -*- coding: utf-8 -*-
"""
Step 3 - Feature engineering (incl. growth stage).

Input : ../artifacts/02_clean.parquet
Output: ../artifacts/03_features.parquet

- Trim to modeling columns (drop the ~40 _sp/_vip setpoints, light-spectrum ints, actuators).
- Engineer: days_since_transplant, growth_percent, growth_stage, VPD, DLI (trailing 24h),
  GDD (cumulative), rolling Tair stats, pH excursions, NPK (N/P/K + ratio + N uptake).
- Everything rolling/cumulative is computed causally WITHIN each team.
- Raw growth + production columns are carried through for Step 4 (label building).
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ART  = os.path.join(ROOT, "data_processing", "artifacts")
SEASON_START = pd.Timestamp("2019-12-16")
STEPS_24H = 288  # 5-min steps in a day

ENV   = ["Tair", "Rhair", "CO2air", "HumDef", "pH_drain_PC", "EC_drain_PC",
         "EC_slab1", "EC_slab2", "WC_slab1", "WC_slab2", "t_slab1", "t_slab2",
         "Tot_PAR", "AssimLight", "Cum_irr", "water_sup"]
WEATHER = ["PARout", "Iglob", "Tout", "Rhout", "RadSum", "AbsHumOut"]
NUTR  = ["irr_PH", "irr_EC", "irr_NO3", "irr_NH4", "irr_PO4", "irr_K", "irr_Ca", "irr_Mg",
         "drain_NO3", "drain_PO4", "drain_K"]
GROWTH = ["Stem_elong", "Stem_thick", "Cum_trusses", "stem_dens", "plant_dens"]
PROD  = ["ProdA", "ProdB", "Nr_fruits_ClassA", "Weight_fruits_ClassA",
         "Nr_fruits_ClassB", "Weight_fruits_ClassB", "avg_nr_harvested_trusses"]

def vpd(Tair, Rh):                       # kPa
    svp = 0.6108 * np.exp(17.27 * Tair / (Tair + 237.3))
    return (svp * (1 - Rh / 100)).clip(lower=0)

def engineer(g):
    g = g.sort_values("timestamp").copy()
    days = (g["timestamp"] - SEASON_START).dt.total_seconds() / 86400.0
    g["days_since_transplant"] = days

    # growth_percent from cumulative stem elongation
    mx = g["Stem_elong"].max()
    g["growth_percent"] = (g["Stem_elong"] / mx * 100).clip(0, 100) if mx and mx > 0 else 0.0

    # growth_stage by phenology (later rules override earlier)
    stage = pd.Series("seedling", index=g.index)
    stage[days > 14] = "vegetative"
    stage[g["Cum_trusses"] > 0] = "flowering"
    harvest_started = g["ProdA"] > 0
    stage[harvest_started] = "fruiting"
    stage[harvest_started & (days >= days.max() - 14)] = "harvest_ready"
    g["growth_stage"] = stage.values

    # environment-derived
    g["vpd"] = vpd(g["Tair"], g["Rhair"])
    if "Tot_PAR" in g:
        g["dli_24h"] = g["Tot_PAR"].rolling(STEPS_24H, min_periods=1).sum() * 300 / 1e6  # ~mol/m2/24h
    g["gdd_cum"] = ((g["Tair"] - 10).clip(lower=0) * (5 / 1440.0)).cumsum()
    g["tair_24h_mean"]  = g["Tair"].rolling(STEPS_24H, min_periods=1).mean()
    g["tair_24h_range"] = (g["Tair"].rolling(STEPS_24H, min_periods=1).max()
                           - g["Tair"].rolling(STEPS_24H, min_periods=1).min())
    ph_out = ~g["pH_drain_PC"].between(5.5, 6.5)
    g["ph_excursion_24h"] = ph_out.rolling(STEPS_24H, min_periods=1).sum()

    # NPK
    g["npk_N"] = g.get("irr_NO3", 0) + g.get("irr_NH4", 0)
    g["npk_P"] = g.get("irr_PO4", np.nan)
    g["npk_K"] = g.get("irr_K", np.nan)
    if "irr_Ca" in g:
        g["npk_K_Ca_ratio"] = g["npk_K"] / g["irr_Ca"].replace(0, np.nan)
    if "drain_NO3" in g:
        g["n_uptake"] = g["irr_NO3"] - g["drain_NO3"]
    return g

def main():
    m = pd.read_parquet(os.path.join(ART, "02_clean.parquet"))
    keep_raw = [c for c in (ENV + WEATHER + NUTR + GROWTH + PROD) if c in m.columns]
    m = m[["team", "timestamp"] + keep_raw]

    feats = pd.concat([engineer(g) for _, g in m.groupby("team", sort=False)], ignore_index=True)

    os.makedirs(ART, exist_ok=True)
    outp = os.path.join(ART, "03_features.parquet")
    feats.to_parquet(outp, index=False)

    eng = ["days_since_transplant", "growth_percent", "growth_stage", "vpd", "dli_24h",
           "gdd_cum", "tair_24h_mean", "tair_24h_range", "ph_excursion_24h",
           "npk_N", "npk_P", "npk_K", "npk_K_Ca_ratio", "n_uptake"]
    print("=== 03_features ===")
    print(f"shape: {feats.shape[0]} rows x {feats.shape[1]} cols  (kept {len(keep_raw)} raw + {len(eng)} engineered)")
    print("\ngrowth_stage distribution (rows):")
    print(feats["growth_stage"].value_counts().to_string())
    print("\nengineered-feature sanity (min / mean / max):")
    for c in eng:
        if c in feats and pd.api.types.is_numeric_dtype(feats[c]):
            s = feats[c]
            print(f"  {c:22} {s.min():8.2f} {s.mean():8.2f} {s.max():8.2f}   miss={100*s.isna().mean():.1f}%")
    print(f"\nwrote: {outp}")

if __name__ == "__main__":
    main()
