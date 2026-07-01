# AGC Datasets — Structure, Timestamps & Simulator-Linkage Analysis

Programmatic analysis of the two Autonomous Greenhouse Challenge datasets in this folder,
focused on (a) start/end timestamps per group, (b) how structured the data is + missing
values, and (c) what **directly links to the HydroSim simulator** (its pH/EC/temp/humidity/
CO₂ controls, the future NPK control, and its yield/stress labels).

> Method: parsed every CSV/XLSX with pandas. AGC time columns (`%time`) are **Excel serial
> numbers** (e.g. `43815.00347` = 5-min step); WUR/4TU time columns are real datetimes.
> Script + venv used for this report live in the session scratchpad (not in this folder).

## What's in this folder

| Part | Crop | What it is | Note |
|---|---|---|---|
| `Autonomous Greenhouse Challenge (WUR  4TU)/` | **Lettuce** | 3rd AGC online challenge — 2 experiments, 6 teams (cva, digital-cucumbers, koala, monday-lettuce, reference, veggie-might) | tied to MDPI 2929 lettuce paper |
| `Autonomous Greenhouse Challenge(AGC) - 2nd Edition/` | **Cherry tomato** | 2nd AGC — 6 teams (AICU, Automatoes, Digilog, IUACAAS, Reference, TheAutomators) + shared Weather | the rich, tabular one |
| `1st Experiment.zip` (24 GB), `2nd Experiment.zip` (20 GB) | Lettuce | raw bundles incl. **images** | left unopened; the extracted folders already hold the timeseries |

So the two datasets line up exactly with HydroSim's two crops: **lettuce + tomato**.

---

## 1. Start / End timestamps per group

### 1st Edition — Lettuce (WUR/4TU), from `GreenhouseClimate.xlsx` (5-min)

**Experiment 1** — identical window for all teams (same compartments/period):

| Group (team) | Rows | Start | End | Span | Missing |
|---|---|---|---|---|---|
| all 6 teams | 13,826 | **2022-02-01 00:00** | **2022-03-21 00:00** | 48 d | ~2.0–2.2 % |

**Experiment 2** — same start, but **each team ended on a different date** (own harvest call):

| Group (team) | Rows | Start | End | Span | Missing |
|---|---|---|---|---|---|
| cva | 12,386 | 2022-05-02 00:00 | 2022-06-14 00:00 | 43 d | 3.0 % |
| digital-cucumbers | 12,962 | 2022-05-02 00:00 | 2022-06-16 00:00 | 45 d | 2.9 % |
| koala | 13,538 | 2022-05-02 00:00 | 2022-06-18 00:00 | 47 d | 3.4 % |
| monday-lettuce | 12,674 | 2022-05-02 00:00 | 2022-06-15 00:00 | 44 d | 3.0 % |
| reference | 11,234 | 2022-05-02 00:00 | 2022-06-10 00:00 | 39 d | 3.7 % |
| veggie-might | 12,386 | 2022-05-02 00:00 | 2022-06-14 00:00 | 43 d | 3.0 % |

Shared Weather: Exp1 `2022-02-01 → 2022-03-21`, Exp2 `2022-05-02 → 2022-06-17 23:55`, 5-min, <0.2 % missing.

### 2nd Edition — Tomato (AGC), from `GreenhouseClimate.csv` (5-min)

**All 6 teams share one identical window** (same 6 glasshouse compartments, same run):

| Group (team) | Rows | Start | End | Span | Missing |
|---|---|---|---|---|---|
| AICU, Automatoes, Digilog, IUACAAS, Reference, TheAutomators | 47,809 | **2019-12-16 00:00** | **2020-05-30 00:00** | 166 d | **0.0 %** |

Shared Weather: `2019-12-16 → 2020-05-30`, 5-min, 0.1 % missing.

> Timestamp takeaway: tomato = one clean 166-day cycle across all teams; lettuce = two short
> (~40–48 day) cycles, Exp1 uniform, Exp2 ragged end-dates. Teams differ by **control
> strategy**, not by measurement window (except lettuce Exp2 harvest timing).

---

## 2. Structure & missing values

### Tomato (2nd Edition) — 7 files per team

| File | Rows | Cols | Cadence | Missing | Role |
|---|---|---|---|---|---|
| `GreenhouseClimate.csv` | 47,809 | 50 | 5-min | **0.0 %** | climate + setpoints + **pH_drain_PC, EC_drain_PC** |
| `GrodanSens.csv` | 47,809 | 7 | 5-min | ~0 % | slab EC/WC/**temp** (root-zone) |
| `LabAnalysis.csv` | 10 | 39 | ~14-day | 0.0 % | **full nutrient ion panel (NPK)** |
| `Production.csv` | 24 | 9 | ~weekly | 0–1.6 % | **yield** (ProdA/B kg/m², fruit counts/weights) |
| `CropParameters.csv` | 23 | 6 | ~weekly | 8.7–9.6 % | **growth** (stem elong/thick, cum trusses) |
| `TomQuality.csv` | 8 | 7 | per-harvest | 0–3.6 % | quality (TSS/Brix, acid, juice, bite) |
| `Resources.csv` | 166 | 7 | daily | 0 % (IUACAAS 45.5 %) | heat/elec/CO₂/irrigation/drain use |

Overall this is **very structured and near-complete** on the high-frequency streams (climate,
slab, weather = 0 % missing over 166 days × 6 teams).

### Lettuce (1st Edition) — 3 files per team + shared Weather

| File | Rows | Cols | Cadence | Missing | Role |
|---|---|---|---|---|---|
| `GreenhouseClimate.xlsx` | ~11k–13.8k | 20 | 5-min | 2–3.7 % | Tair, Rhair, CO2air, PARin, HumDef, screens, pipe, + sigrow/ridder derived |
| `GreenhouseControls.xlsx` | same | 11 | 5-min | ~0–0.2 % | setpoints (vip) |
| `GreenhouseCrop.xlsx` | Final Harvest 74×11; Plant Density 48×2 | — | per-harvest / periodic | 0 % (Exp2 Final Harvest ~53 %) | **yield** (fresh weight) + plant density |

### Data-quality flags (found during parsing)

1. **`Production.csv` first row is mis-dated `2019-02-14`** — ~10 months before the Dec-2019
   transplant. A placeholder/typo; drop or correct row 1 before building the yield curve.
2. **`TomQuality.csv` time axis is not an Excel serial** — values parse to `1900-…`, i.e.
   they're **relative day/truss numbers**, not absolute dates. Also its header merges two
   fields (`Weight` + `DMC_fruit` joined by a tab). Needs the ReadMe to align to calendar time.
3. **`CropParameters` 8–10 % missing is structural**, not corruption — `Cum_trusses` is blank
   before trusses form. Same for lettuce `Cum_trusses`-type early values.
4. **`Resources.csv` for team IUACAAS is 45.5 % missing** — that team's resource logging is
   partial; the other five are complete.
5. **Lettuce Exp2 `Final Harvest` sheet ~53 % missing** and the harvest sheets use a **wide,
   manual matrix layout** (`Date of Harvest:` as a header cell, `Unnamed: N` columns) — must be
   reshaped to tidy long form before use.
6. **GrodanSens** has a brief all-NaN startup around transplant day (sensors came online a bit
   after Dec 16); negligible over the full run.

---

## 3. Direct linkage to the HydroSim simulator

HydroSim controls: pH, EC, air-temp, humidity, CO₂ (+ future **NPK** control); labels:
`predicted_yield_score`, `stress_score`.

### Tomato (2nd Edition) — near-complete coverage ✅

| Simulator control / label | Source file → column | Cadence | Fit |
|---|---|---|---|
| **pH** | `GreenhouseClimate.pH_drain_PC` (or `LabAnalysis.irr_PH`/`drain_PH`) | 5-min / 14-day | ✅ Direct |
| **EC** | `GreenhouseClimate.EC_drain_PC`, `GrodanSens.EC_slab1/2`, `LabAnalysis.irr_EC` | 5-min | ✅ Direct |
| **Air temp** | `GreenhouseClimate.Tair` | 5-min | ✅ Direct |
| **Humidity** | `GreenhouseClimate.Rhair` (+ `HumDef` VPD) | 5-min | ✅ Direct |
| **CO₂** | `GreenhouseClimate.CO2air` | 5-min | ✅ Direct |
| **Water/root temp** | `GrodanSens.t_slab1/2` | 5-min | ✅ Direct |
| **Light hours / DLI** | `GreenhouseClimate.Tot_PAR`, `AssimLight` + `Weather.PARout` | 5-min | ⚙️ derive DLI |
| **NPK (future control)** | `LabAnalysis`: **N = irr_NO3 + irr_NH4**, **P = irr_PO4**, **K = irr_K** (+ Ca, Mg, SO4, micros) | 14-day | ✅ real, itemized |
| **Growth stage** | `CropParameters.Stem_elong`, `Cum_trusses` | weekly | ⚙️ engineer from Δ/time |
| **Yield label** | `Production.ProdA`/`ProdB` (cum kg/m²), `Weight_fruits_ClassA` | weekly | ✅ real |
| **Stress label** | — none shipped — | — | ⚙️ engineer (growth-deficit / deviation-integral) |
| Quality (bonus) | `TomQuality` TSS/acid/juice/bite | per-harvest | ✅ bonus |

**Headline:** the tomato set covers **every** current slider directly at 5-min resolution,
**plus** a real itemized NPK panel (`LabAnalysis`) — the exact thing the hydroponics expert
asked for — and a real yield label. Only growth-stage and stress need engineering.

### Lettuce (1st Edition) — environment + yield only, **no nutrient data** ⚠️

| Simulator control / label | Source | Fit |
|---|---|---|
| Air temp | `GreenhouseClimate.Tair` | ✅ Direct |
| Humidity | `GreenhouseClimate.Rhair` / `HumDef` | ✅ Direct |
| CO₂ | `GreenhouseClimate.CO2air` | ✅ Direct |
| Light / DLI | `PARin`, `AssimLight`, `Weather.PARout` | ⚙️ derive |
| **pH** | — **not logged anywhere** in lettuce climate/controls — | ❌ Missing |
| **EC** | — **not logged** — | ❌ Missing |
| **NPK** | — **no LabAnalysis file for lettuce** — | ❌ Missing |
| Yield label | `GreenhouseCrop` → Final Harvest fresh weight (+ Plant Density) | ✅ real (needs reshaping) |
| Growth | Plant Density over time + **image-derived height/coverage in the 24 GB zip** | ⚙️ engineer |
| Stress label | — none — | ⚙️ engineer |

**Key asymmetry:** verified programmatically — the lettuce timeseries logs **no pH, EC, or
nutrient ions at all** (checked every climate/control column across all 6 teams). Its growth
signal lives mostly in the **image bundle**, not the tables.

---

## 4. Takeaways for the modeling plan

1. **Tomato is the strong backbone.** 166 days × 6 teams at 5-min with **0 % missing** on the
   climate/slab/weather streams, real yield (`Production`), real growth (`CropParameters`), and
   — critically — a **real itemized NPK panel** (`LabAnalysis`) for the expert's fertilizer
   control. Every simulator slider maps directly.
2. **Lettuce is environment + yield only.** Good for Tair/RH/CO₂/light → yield, but you must
   treat pH/EC/NPK as **externally known/fixed** (from the challenge's standard recipe) or drop
   those inputs for lettuce — they are not in this data.
3. **Labels:** `yield` is real for both crops; `stress_score` must be **engineered** for both
   (deviation-integral calibrated against real yield, or growth-deficit vs cohort).
4. **ETL must handle:** Excel-serial → datetime conversion (tomato), the `Production` row-1
   date typo, `TomQuality`'s relative-day axis + merged header, the wide harvest-sheet layout
   (lettuce), and the 6× team fan-out (stack teams as replicates or keep `team` as a feature).
5. **Join keys:** align 5-min climate to sparse weekly/biweekly labels by timestamp
   (forward-fill / interpolate); aggregate 5-min → daily features (DLI, VPD, mean/among-day
   ranges) before joining to yield.

## Source folders analyzed

- `Autonomous Greenhouse Challenge (WUR  4TU)/1st Experiment/.../TimeSeries_1stExperiment/<team>/`
- `Autonomous Greenhouse Challenge (WUR  4TU)/2nd Experiment/.../TimeSeries/<team>/`
- `Autonomous Greenhouse Challenge(AGC) - 2nd Edition/<team>/` + `Weather/Weather.csv`
