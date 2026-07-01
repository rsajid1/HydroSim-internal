# Frontend Controls → Real Dataset Mapping (AGC)

How HydroSim's dashboard controls map onto the **Autonomous Greenhouse Challenge (AGC)**
real datasets, **by source**, for **tomato** and **lettuce**. This is the bridge between the
current UI (`app/dashboard/page.tsx`) and a real-data training pipeline that would replace
the synthetic `data/synthetic_hydroponics_dataset.csv` behind the existing
`POST /api/sim/predict` contract (see `docs/local_sim.md`).

> Goal: answer "how close is the frontend to a real dataset?" per crop, and record exactly
> which controls map **directly**, which must be **engineered**, and which are **mismatches**
> (UI-only, not consumed by the model).
> **Figures below are verified against the downloaded data** — see `data/DATASET_ANALYSIS.md`.

---

## Frontend controls (what the model actually sees)

Verified in `app/dashboard/page.tsx`:

| Control | Range / step | Sent to model field |
| --- | --- | --- |
| Acidity (pH) | 4.0–8.0 / 0.1 | `ph` |
| Nutrient Conc. (EC) | 0.5–4.0 / 0.1 | `ec` |
| Temperature (°C) | 10–40 / 0.5 | `air_temperature_c` |
| Humidity (%) | 0–100 / 1 | `humidity_percent` |
| CO₂ (ppm) | 300–1200 / 10 | `co2_ppm` |
| Crop selector | lettuce / herbs / tomatoes / cucumbers | `crop_type` |
| Growth (`growthStage`, 0–100) | derived | `growth_percent` |
| System selector | nft / dwc / aeroponics / vertical | **not used** (does not narrow rows) |

Output gauges: **Yield Prediction**, **Stress Level**, **Water Level**, plus input gauges
pH / EC / "Water Temp" / Humidity.

**Fit legend:** ✅ Direct = real column, just rename/units · ⚙️ Engineered = derived from
dated measurements + timestamps · ❌ Mismatch = no source (UI-only, model ignores it).

---

## Source A — Tomato: AGC 2nd Edition (cherry tomato) ✅ usable

- **Dataset:** `data/Autonomous Greenhouse Challenge(AGC) - 2nd Edition/` (Kaggle mirror of the WUR 2nd challenge). Publication: *Cherry Tomato Production in Intelligent Greenhouses*, Sensors 2020, 20(22):6430.
- **Verified shape:** 6 teams, **identical window 2019-12-16 → 2020-05-30 (166 d)**. Climate / slab / weather at **5-min, 0.0 % missing**; `LabAnalysis` ~14-day; `Production` & `CropParameters` weekly. Data is **spread across 7 files per team** (join by timestamp).
- **Best group = `Automatoes`** — challenge winner (€6.86/m² net profit) **and** top measured yield **14.92 kg/m²** (A+B) in the data. Production ranking: Automatoes 14.92 > TheAutomators 14.36 > Reference 14.30 > Digilog 14.21 > AICU 13.76 > IUACAAS 13.48.

| Frontend control / label | Real source (file → column) | Cadence | Fit |
| --- | --- | --- | --- |
| pH | `GreenhouseClimate.pH_drain_PC` (or `LabAnalysis.irr_PH`/`drain_PH`) | 5-min / 14-day | ✅ Direct (real) |
| EC | `GreenhouseClimate.EC_drain_PC`, `GrodanSens.EC_slab1/2`, `LabAnalysis.irr_EC` | 5-min | ✅ Direct (real) |
| Temperature (air) | `GreenhouseClimate.Tair` | 5-min | ✅ Direct |
| Humidity | `GreenhouseClimate.Rhair` (+ `HumDef` = VPD) | 5-min | ✅ Direct |
| CO₂ | `GreenhouseClimate.CO2air` | 5-min | ✅ Direct |
| Water / root temp | `GrodanSens.t_slab1/2` | 5-min | ✅ Direct (real) |
| Light → DLI | `GreenhouseClimate.Tot_PAR`, `AssimLight` + `Weather.PARout` | 5-min | ⚙️ derive DLI |
| **NPK (future control)** | `LabAnalysis`: **N = irr_NO3 + irr_NH4**, **P = irr_PO4**, **K = irr_K** (+ Ca/Mg/SO4/micros) | ~14-day | ✅ **Real, itemized** |
| Growth (0–100) | `CropParameters.Stem_elong`, `Cum_trusses`, `Stem_thick` | weekly | ⚙️ Engineered |
| **Yield** (output) | `Production.ProdA` + `ProdB` (per-harvest kg/m²), `Weight_fruits_ClassA` | weekly | ✅ Real |
| **Stress** (output) | none shipped → deviation-integral / growth-deficit vs real yield | derived | ⚙️ Engineered |
| Quality (bonus) | `TomQuality`: TSS, Acid, %Juice, Bite | per-harvest | bonus |
| System type / Water Level | rockwool **slab-drip** + drain % (no NFT/DWC reservoir) | — | ❌ Mismatch (UI-only) |

**Correction vs. the earlier draft:** pH, EC, root-temp and NPK are **real, directly logged** —
not "derive from recipe." NPK is a full itemized ion panel (`LabAnalysis`), exactly the
hydroponics expert's ask. Only **growth-stage** and **stress** genuinely need engineering.

---

## Source B — Lettuce: NOT USABLE for training ❌

Verified across all 6 lettuce teams × 2 experiments (WUR/4TU): the lettuce timeseries logs
**no pH, no EC, and no nutrient ions anywhere** — only `Tair` / `Rhair` / `CO2air` / `PARin` +
harvest fresh weight. Its growth signal lives in the **24 GB image bundle**, not the tables.

**Decision: lettuce is dropped from ML training** — it cannot feed the pH/EC/NPK inputs the
simulator (and the model) require. An environment→yield-only lettuce model is possible later,
but it would not exercise the nutrient controls, so it is out of scope for now.

---

## Closeness verdict (tomato)

| Layer | Tomato | Notes |
| --- | --- | --- |
| **Model inputs** (`/api/sim/predict`) | ~95 % real | pH/EC/temp/humidity/CO₂ all logged directly; only `growth_percent` engineered |
| **Labels** (yield / stress) | yield real, stress engineered | `Production` is real; stress derived + calibrated against real yield |
| **NPK control** (future) | real | `LabAnalysis` itemized ions — no derivation needed |
| **UI extras** (system, water level) | n/a | not consumed by the model |

**Bottom line:** the tomato data drops in behind the existing `/api/sim/predict` contract
**without changing a single slider**. The real work is **ETL (join 7 files by timestamp) +
label engineering (growth stage, stress)** — detailed in the tomato ML plan.

---

## Gaps to close

1. **`growth_percent` / `growth_stage`** — engineer from `CropParameters` (`Stem_elong`,
   `Cum_trusses`) + days-since-transplant. Required for full fidelity.
2. **Air vs. water temp** — one "Temperature" slider but a gauge mislabeled **"Water Temp"**
   (`app/dashboard/page.tsx:936`). Both are now *real* columns (`Tair` + `GrodanSens.t_slab`) —
   split into two controls or fix the label.
3. **Multi-file join** — the 7 tomato files share the Excel-serial `%time` axis; join on it,
   forward-fill sparse (lab/production/crop) onto the 5-min grid.
4. **Data cleanup** — `Production` row-1 date typo (`2019-02-14`); `TomQuality` relative-day
   axis + merged `Weight/DMC_fruit` header.
5. **System type & Water Level** — slab-drip + drain %, not an NFT/DWC reservoir; relabel or
   keep UI-only (model ignores them).

---

## Sources

- AGC 2nd ed. tomato (Kaggle): https://www.kaggle.com/datasets/piantic/autonomous-greenhouse-challengeagc-2nd-2019
- Cherry tomato paper (Sensors 2020, PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC7698269/
- Team Automatoes wins 2nd AGC (net profit €6.86/m²): https://letsgrow.com/en/news/team-automatoes-wins-autonomous-greenhouse-challenge
- Local data analysis: `data/DATASET_ANALYSIS.md`
- AGC overview (WUR): https://www.wur.nl/en/research/plant/autonomous-greenhouse-challenge
