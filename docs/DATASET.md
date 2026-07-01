# HydroSim Dataset Plan

## Purpose

HydroSim currently does not have a dataset provided by the industry partner. To keep development moving, the team will use a synthetic dataset for development, testing, and demonstration.

The synthetic dataset is intended to show that the application can:

- Store and retrieve simulation data.
- Connect backend data to the dashboard.
- Display environmental conditions and simulation outputs.
- Validate that the simulation flow produces expected results.

The synthetic dataset is not intended to prove real biological accuracy or replace validated partner data.

---

## Dataset Approach

The first dataset will focus on **lettuce** and **tomato** because the current dashboard supports these crops and they have accessible public references for common hydroponic and greenhouse conditions.

The dataset will be generated from reference ranges for:

- pH
- Electrical conductivity (EC)
- Air temperature
- Water temperature
- Humidity
- CO2 level
- Water level
- Growth stage

The dataset will include normal, warning, and critical scenarios so the dashboard can test different simulation outcomes.

---

## Proposed Columns

| Column | Description |
| ------ | ----------- |
| `simulation_id` | Unique ID for the simulated record |
| `crop_type` | Crop being simulated, such as `lettuce` or `tomato` |
| `growth_stage` | Current stage of growth |
| `system_type` | Hydroponic system, such as `nft`, `dwc`, `aeroponics`, or `vertical` |
| `day` | Simulated day in the crop cycle |
| `ph` | Nutrient solution pH |
| `ec` | Electrical conductivity / nutrient concentration |
| `air_temperature_c` | Air temperature in Celsius |
| `water_temperature_c` | Water temperature in Celsius |
| `humidity_percent` | Relative humidity percentage |
| `co2_ppm` | CO2 level in parts per million |
| `water_level_percent` | Reservoir or system water level |
| `light_hours` | Daily light exposure |
| `stress_score` | Synthetic stress score from 0 to 100 |
| `predicted_yield_score` | Synthetic yield score from 0 to 100 |
| `risk_level` | `low`, `medium`, or `high` |
| `status` | Summary status, such as `stable`, `warning`, or `critical` |
| `source_profile` | Reference profile used to generate the row |
| `created_at` | Timestamp for the generated record |

---

## Growth Stages

Lettuce records will use:

- `seedling`
- `vegetative`
- `harvest_ready`

Tomato records will use:

- `seedling`
- `vegetative`
- `flowering`
- `fruiting`
- `harvest_ready`

These stages are simplified for the simulation and dashboard workflow.

---

## Reference Sources

The synthetic dataset will be based on publicly available references. These sources will be used to guide approximate environmental ranges and growth-stage terminology:

- Oklahoma State University Extension: Electrical Conductivity and pH Guide for Hydroponics  
  https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics

- Oklahoma State University Extension: Hydroponics  
  https://extension.okstate.edu/fact-sheets/hydroponics.html

- Purdue University Extension: Greenhouse Tomato Production  
  https://www.purdue.edu/hla/sites/cea/wp-content/uploads/sites/15/2024/05/Greenhouse-Tomato-Production.pdf

- BBCH Monograph: Growth Stages of Mono- and Dicotyledonous Plants  
  https://www.openagrar.de/servlets/MCRFileNodeServlet/openagrar_derivate_00010428/BBCH-Skala_en.pdf

An optional public hydroponics IoT dataset may be used later as a comparison or validation reference:

- Kaggle: Hydroponics datasets  
  https://www.kaggle.com/datasets/itsmonir31/hydroponics-datasets

---

## Limitations

- The dataset is synthetic and should be labelled as development/demo data.
- The values are based on reference ranges, not measured partner data.
- The output scores are generated for software testing and workflow validation.
- Real partner data should replace or calibrate this dataset if it becomes available.

---

## Next Steps

1. Review and approve the proposed dataset structure.
2. Create a generator script for synthetic lettuce and tomato records.
3. Generate a CSV file for development and testing.
4. Update the dashboard and backend to use the dataset structure.

---

## Real Dataset Sourcing — Final Findings (2026-06-21)

> Research pass to replace the **synthetic** CSV described above with a **real,
> researcher-shared** hydroponics dataset that can train the AI yield + stress model.
> Today the prediction is a dataset lookup (`POST /api/sim/predict`, see
> `docs/local_sim.md`); the goal is to swap that for a trained model behind the same
> request/response contract. This pass also scores how well each candidate covers a future
> **NPK fertilizer control** — the project's hydroponics expert noted that EC alone only
> reflects total dissolved salts, and that different crops/stages need different N-P-K
> blends (e.g. a 10-10-10 fertilizer), so per-element N/P/K is a major plus.

### Scoring rubric (anchored to HydroSim's inputs/labels)

- **Model inputs today:** pH, EC, air temp, water temp, humidity, CO₂, light hours,
  growth stage, system type, crop.
- **Model outputs today:** `predicted_yield_score`, `stress_score`, `risk_level`, `status`.

| Weight | Criterion |
| --- | --- |
| 25 | **Real target label** — actual yield and/or a stress/health signal to train on |
| 20 | **Hydroponic input coverage** — pH, EC, temp, humidity, CO₂, light |
| 15 | **Crop match** — lettuce / tomato (HydroSim's two crops) |
| 15 | **NPK / nutrient breakdown** — the expert's mandatory-plus |
| 10 | **Richness** — size, time-series, multi-condition |
| 15 | **Accessibility** — free + downloadable now, permissive license |

### Scored shortlist

| # | Dataset | Real? | Crop | Yield label | NPK | License | **Score** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Autonomous Greenhouse Challenge** (WUR / 4TU) | ✅ | lettuce + tomato + cucumber | ✅ real harvest/fresh-weight | ⚠️ EC + recipe (derivable) | typically CC BY | **86** |
| 2 | **Horti-M3-Tomato** (Nature Sci Data, Zenodo) | ✅ | tomato | ✅ quality + biomass | ⚠️ recipe-only (derivable) | CC BY-**NC-ND** | **79 → reference only** |
| 3 | **Crop Recommendation / crops-npk** (Kaggle) | ✅ field | 22 crops (not lettuce/tomato) | ❌ class label only | ✅ explicit N,P,K | open | **52** |
| 4 | **Smart Farming Sensor Data** (Kaggle) | ⚠️ likely synthetic | generic | ✅ yield (synthetic) | partial | open | **50** |
| 5 | **Lettuce NPK Dataset** (Kaggle, images) | ✅ | lettuce | ❌ deficiency class | ✅ N/P/K classes | open | **48** |
| 6 | **Frontiers lettuce-yield study** | ✅ | lettuce | ✅ fresh head weight | measured, unused | ❌ on request | **46** |
| 7 | Aquaponics water-quality IoT / "Hydroponics Feed" | ✅ | none | ❌ | ❌ | open | ~30 |

### Top candidates (verified)

**1. Autonomous Greenhouse Challenge — recommended backbone (~86).**
Gold-standard controlled-environment data from Wageningen UR. 5-minute time-series
greenhouse climate (temp, RH, CO₂, radiation/light, setpoints), irrigation incl.
**supply/drain EC and pH**, resource use, **plus real crop harvest data** (fresh weight,
yield, fruit counts, growth). Editions cover **lettuce (3rd)** and **tomato (2nd, 4th)** —
HydroSim's exact crops. Confirmed soilless/**hydroponic**: lettuce sown in rockwool plugs
for **NFT and DWC** systems, tomato on rockwool mats with drip + circulating nutrient
solution — and **NFT/DWC map directly onto HydroSim's `system_type` enums**. Free for
research via 4TU/WUR (typically CC BY — confirm per edition); 2nd edition mirrored on
Kaggle. Hydroponic relevance: **~95% (high)**.

**2. Horti-M3-Tomato — reference only, not a training input (~79 on merit, downgraded).**
A 2026 three-year multimodal tomato dataset (substrate-trough hydroponics, NE China).
30-minute sensor logs (air temp, RH, light, CO₂, **substrate temp + moisture**), daily RGB
images, fertilization treatments, weekly phenotypes, and yield. Verified specifics that
downgrade it for our pipeline:
- **NPK is recipe-level, not itemized.** Fertilization is recorded as salt masses (e.g.
  control = *27.2 g KH₂PO₄, 52.3 g K₂SO₄, 4.4 g CaCl₂* every 15 days; six variants), **not**
  as N/P/K columns or an NPK ratio. N/P/K is *derivable* from salt stoichiometry but is
  per-treatment, not per-row.
- **No nutrient-solution pH or EC in the logs** — substrate *moisture* is logged, not EC.
  Two of HydroSim's core inputs are therefore absent.
- **License is CC BY-NC-ND 4.0** — NonCommercial **and** NoDerivatives. Reshaping it into
  our CSV / training on it is arguably a derivative work, and NC blocks any commercial use.
Hydroponic relevance: **~78% (substrate hydroponics)**, but the license + missing pH/EC +
recipe-only NPK make it a tomato sanity-check reference rather than a training source.

**3. Crop Recommendation / crops-npk — NPK feature *template* only (~52).**
2,200 rows with clean **N, P, K, temperature, humidity, pH** columns. Best illustration of
how to model the expert's NPK control, but it is field agronomy, the target is a *crop
class* (not yield/stress), and it lacks EC/CO₂/lettuce/tomato. Use for schema/feature
design, not training.

### Key gap (important)

No single free, downloadable, tabular dataset combines hydroponic pH/EC **+** full N-P-K
**+** real yield **AND** a stress label **for both lettuce and tomato.** Two consequences:

1. **Real datasets give yield, not a `stress_score`.** Our 0–100 `stress_score` is a
   synthetic construct; with real data it must be **engineered** (e.g. deviation-from-optimal,
   growth-rate dips, recorded health/deficiency events) — same as today, but grounded in
   real conditions.
2. **NPK is the weakest-covered axis** among the rich real sets. The expert's NPK control
   most likely starts as a **derived feature** (decompose EC + fertilizer recipe into
   N/P/K) rather than a directly-measured column.

### Recommendation

1. **Backbone:** Autonomous Greenhouse Challenge (start with **lettuce 3rd + tomato 2nd**) —
   maps almost 1:1 onto the CSV schema (climate → temp/humidity/co2/light, irrigation →
   ec/ph, harvest → `predicted_yield_score`); derive `stress_score`/`risk_level`/`status`.
2. **Tomato sanity-check:** Horti-M3-Tomato as a *reference* (do not train on it — CC BY-NC-ND).
3. **NPK control:** use Crop-Recommendation/crops-npk as the feature template; source real
   N/P/K by decomposing AGC's nutrient recipe/EC.

No paid dataset is needed — the strongest candidates are free.

### Sources

- Autonomous Greenhouse Challenge — time-series (WUR/4TU): https://research.wur.nl/en/datasets/3rd-autonomous-greenhouse-challenge-time-series-data-on-realized-/
- Autonomous Greenhouse Challenge — 2nd ed. (Kaggle): https://www.kaggle.com/datasets/piantic/autonomous-greenhouse-challengeagc-2nd-2019
- Autonomous Greenhouse Challenge — overview (WUR): https://www.wur.nl/en/research/plant/autonomous-greenhouse-challenge
- AGC growing method (rockwool/NFT/DWC, ISHS): https://ishs.org/ishs-article/361_22/
- Horti-M3-Tomato (Nature Scientific Data): https://www.nature.com/articles/s41597-026-07074-w
- Horti-M3-Tomato data (Zenodo): https://doi.org/10.5281/zenodo.17217565
- Crop Recommendation (Kaggle): https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset
- Lettuce yield ML review (ScienceDirect): https://www.sciencedirect.com/science/article/pii/S2772375525001583
- Frontiers lettuce-yield ML study: https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.706042/full
- Smart Farming Sensor Data (Kaggle): https://www.kaggle.com/datasets/atharvasoundankar/smart-farming-sensor-data-for-yield-prediction
