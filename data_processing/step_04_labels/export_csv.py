# -*- coding: utf-8 -*-
"""Export the Step-4 training table to CSV for inspection (keys + targets moved to the front)."""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.abspath(os.path.join(HERE, "..", "artifacts"))

df = pd.read_parquet(os.path.join(ART, "04_training_table.parquet"))

front = ["team", "timestamp", "days_since_transplant", "growth_stage", "growth_percent",
         "y_yield_score", "y_stress_score", "y_plant_height", "y_stem_thickness",
         "y_truss_count", "y_plant_density", "cum_yield"]
order = front + [c for c in df.columns if c not in front]
df = df[order]

# round floats for readability
for c in df.select_dtypes("float").columns:
    df[c] = df[c].round(4)

out = os.path.join(ART, "04_training_table.csv")
df.to_csv(out, index=False)
size_mb = os.path.getsize(out) / 1e6
print(f"wrote: {out}")
print(f"size: {size_mb:.1f} MB  |  shape: {df.shape[0]} rows x {df.shape[1]} cols")
print("\ncolumn order:\n  " + "\n  ".join(order))
print("\nhead (key cols, first 6 rows of Automatoes):")
prev = df[df.team == "Automatoes"].head(6)[
    ["timestamp", "days_since_transplant", "growth_stage", "growth_percent",
     "Tair", "pH_drain_PC", "EC_drain_PC", "npk_N", "y_yield_score", "y_stress_score", "cum_yield"]]
print(prev.to_string(index=False))