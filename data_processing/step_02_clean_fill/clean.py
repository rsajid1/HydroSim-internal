# -*- coding: utf-8 -*-
"""
Step 2 - Clean & causal fill.

Input : ../artifacts/01_master.parquet
Output: ../artifacts/02_clean.parquet

- Strip whitespace from column names (some AGC headers have trailing spaces).
- Clip environment INPUT streams to physical bounds, then interpolate short gaps.
- Production: 0 before each team's first *in-season* harvest -> removes the pre-season
  Production row-1 typo (dated Feb-2019) that merge_asof had carried into early rows.
- Structural fills: Cum_trusses -> 0 before trusses form; morphology + lab recipe back/forward
  filled (near-constant, set at the start of the grow).
- TomQuality is left for later (relative-day axis).  All fills are within-team.
"""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA = os.path.join(ROOT, "data", "Autonomous Greenhouse Challenge(AGC) - 2nd Edition")
ART  = os.path.join(ROOT, "data_processing", "artifacts")
EPOCH = pd.Timestamp("1899-12-30")
SEASON_START = pd.Timestamp("2019-12-16")
TEAMS = ["AICU", "Automatoes", "Digilog", "IUACAAS", "Reference", "TheAutomators"]

ENV_CLIP = {  # physical bounds; out-of-range -> NaN -> interpolate
    "pH_drain_PC": (3, 9), "EC_drain_PC": (0, 8),
    "EC_slab1": (0, 12), "EC_slab2": (0, 12),
    "Tair": (5, 45), "t_slab1": (5, 45), "t_slab2": (5, 45),
    "Rhair": (0, 100), "CO2air": (200, 2000),
}
CROP_MORPH = ["Stem_elong", "Stem_thick", "stem_dens", "plant_dens"]
PROD = ["ProdA", "ProdB", "Nr_fruits_ClassA", "Weight_fruits_ClassA",
        "Nr_fruits_ClassB", "Weight_fruits_ClassB", "avg_nr_harvested_trusses",
        "Truss development time"]

def first_in_season_harvest(team):
    df = pd.read_csv(os.path.join(DATA, team, "Production.csv"), low_memory=False)
    t = pd.to_numeric(df[df.columns[0]], errors="coerce")
    ts = (EPOCH + pd.to_timedelta(t, unit="D")).dt.round("5min").astype("datetime64[ns]")
    ts = ts[ts >= SEASON_START]
    return ts.min()

def main():
    m = pd.read_parquet(os.path.join(ART, "01_master.parquet"))
    m.columns = m.columns.str.strip()
    # all non-key columns are measurements; coerce to numeric (step 1 left some as 'NaN'-text strings)
    for c in m.columns:
        if c not in ("team", "timestamp"):
            m[c] = pd.to_numeric(m[c], errors="coerce")
    lab = [c for c in m.columns if c.startswith(("irr_", "drain_"))]

    pre = {c: 100 * m[c].notna().mean() for c in
           ["pH_drain_PC", "EC_drain_PC", "irr_NO3", "Stem_elong", "Cum_trusses", "ProdA"]}

    out, zeroed = [], 0
    for team, g in m.groupby("team", sort=False):
        g = g.sort_values("timestamp").copy()
        fh = first_in_season_harvest(team)

        for c, (lo, hi) in ENV_CLIP.items():
            if c in g:
                g[c] = g[c].where(g[c].between(lo, hi)).interpolate(limit_direction="both")

        for c in PROD:                       # production = 0 before first real harvest
            if c in g:
                zeroed += int(((g["timestamp"] < fh) & g[c].fillna(0).ne(0)).sum())
                g.loc[g["timestamp"] < fh, c] = 0.0
                g[c] = g[c].fillna(0.0)

        if "Cum_trusses" in g:
            g["Cum_trusses"] = g["Cum_trusses"].fillna(0.0)      # structural: no trusses yet
        for c in CROP_MORPH + lab:                                # near-constant -> fill edges
            if c in g:
                g[c] = g[c].bfill().ffill()
        out.append(g)

    clean = pd.concat(out, ignore_index=True)
    empty_cols = [c for c in clean.columns if clean[c].isna().all()]   # junk Unnamed:* etc.
    clean = clean.drop(columns=empty_cols)
    os.makedirs(ART, exist_ok=True)
    outp = os.path.join(ART, "02_clean.parquet")
    clean.to_parquet(outp, index=False)

    print("=== 02_clean ===")
    print(f"shape: {clean.shape[0]} rows x {clean.shape[1]} cols")
    print(f"dropped {len(empty_cols)} all-empty columns: {empty_cols}")
    print(f"typo/pre-harvest production cells zeroed: {zeroed}")
    print(f"\n{'column':14} {'before%':>8} {'after%':>8}")
    for c in pre:
        print(f"  {c:12} {pre[c]:>8.1f} {100*clean[c].notna().mean():>8.1f}")
    remaining = clean.drop(columns=['team','timestamp']).isna().mean().mul(100)
    still = remaining[remaining > 1].sort_values(ascending=False)
    print(f"\ncolumns still >1% missing: {len(still)}")
    for c, v in still.head(12).items():
        print(f"  {c:22} {v:5.1f}%")
    print(f"\nwrote: {outp}")

if __name__ == "__main__":
    main()
