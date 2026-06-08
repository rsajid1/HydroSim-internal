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
