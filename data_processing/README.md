# data_processing — Tomato dataset → model pipeline

Turns the raw AGC 2nd-edition **cherry-tomato** files into (a) one clean **5-min, real-date
master table** and (b) a trained **multi-output model** (yield + stress + 3D growth), following
[`docs/tomato_ml_plan.md`](../docs/tomato_ml_plan.md).

Each step is a folder with its own `README.md` (goal / inputs / outputs / **status**) plus its
script(s). Run steps in order; each reads the previous artifact and writes the next.

## Source data (in-repo: `data/`)

```
../data/Autonomous Greenhouse Challenge(AGC) - 2nd Edition/
    <team>/{GreenhouseClimate,GrodanSens,LabAnalysis,Production,CropParameters,TomQuality,Resources}.csv
    Weather/Weather.csv
```
Teams: `AICU, Automatoes, Digilog, IUACAAS, Reference, TheAutomators`.
Verified structure/timestamps/missing values: [`data/DATASET_ANALYSIS.md`](../data/DATASET_ANALYSIS.md).

## Core principle (do not violate)

**One master table at REAL 5-min resolution with REAL dates** (`2019-12-16 → 2020-05-30`).
No daily aggregation of the base — the simulator replays it *fast* (5-min → seconds) while
dates/lifecycle stay real. Daily is only ever an optional *training view*. (Plan §1.)

## Pipeline

| Step | Folder | Input → Output | Status |
| --- | --- | --- | --- |
| 1 | `step_01_consolidate/` | 7 raw files × 6 teams → `artifacts/01_master.parquet` | ☑ **Done** (286,854 × 129) |
| 2 | `step_02_clean_fill/` | `01_master` → `artifacts/02_clean.parquet` | ☑ **Done** (286,854 × 124) |
| 3 | `step_03_features/` | `02_clean` → `artifacts/03_features.parquet` | ☑ **Done** (286,854 × 61) |
| 4 | `step_04_labels/` | `03_features` → `artifacts/04_training_table.parquet` | ☑ **Done** (286,854 × 68) |
| 5 | `step_05_train/` | `04_training_table` → `artifacts/05_model.pkl` + `metrics.json` | ☐ Not started |
| 6 | `step_06_serve/` | master + model → app `data/*.csv` + wired `predict()` | ☐ Not started |

Update the ☐/☑ here **and** in each step's README as you finish.

## Artifacts

Intermediates live in `artifacts/` (git-ignored — bulky). Naming: `NN_<name>.parquet`.
Final small deliverable (HydroSim-schema CSV) is written to the app's `../data/` in step 6.

## Environment (Windows-first, matches repo convention)

```bash
cd data_processing
uv venv .venv
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
```

## Conventions

- One step = one folder + one `README.md` + runnable, **idempotent** script(s).
- Excel-serial `%time` → datetime via epoch `1899-12-30`; keep the real timestamp column.
- Causal only — no row may use future measurements (no leakage).
- Keep *decisions* in the plan doc; keep *what-this-step-does* in the step README. Don't scatter.

## Related docs

- Build plan: [`docs/tomato_ml_plan.md`](../docs/tomato_ml_plan.md)
- Control mapping: [`docs/dataset_controls.md`](../docs/dataset_controls.md)
- Data analysis: [`data/DATASET_ANALYSIS.md`](../data/DATASET_ANALYSIS.md)
