# HydroSim — Simulation Guide

## What the Simulation Does

HydroSim replays real lettuce grow data from a synthetic dataset to show how environmental conditions change over a grow cycle.

When you press **Play**, the simulation steps through rows of recorded data — one row per second. Each row updates:

| What changes | Where you see it |
|---|---|
| pH level | Environment Controls + Telemetry gauge |
| EC (nutrient concentration) | Environment Controls (status only) |
| Air temperature | Environment Controls + Telemetry gauge |
| Humidity | Environment Controls |
| CO₂ level | Environment Controls |
| Stress score | Telemetry — Stress Level gauge |
| Yield prediction | Telemetry — Yield Prediction gauge |
| Water level | Telemetry — Water Level gauge |
| Growth stage | Plant growth label (Seedling → Vegetative → Harvest Ready) |

The data comes from `data/synthetic_hydroponics_dataset.csv`, loaded per selected crop via
`GET /api/dataset?crop=<id>` and sorted by grow-cycle `day`. Lettuce and tomato both have
dataset rows; the System Setup selector does not narrow the rows (the synthetic data is not
varied by system type). When the last row is reached, the simulation loops back to the start.

If the selected crop has no dataset rows (herbs, cucumbers) or the dataset fetch fails, the
simulation falls back to random parameter drift so it never stalls.

---

## How to Change the Simulation

### Change which crops or systems are shown
Crop filtering lives in `filterRowsForCrop()` in `lib/dataset.ts` (consumed by
`app/api/dataset/route.ts`). It returns all rows for the requested crop, sorted by `day`.
- The crop is chosen by the dashboard via `GET /api/dataset?crop=<id>` (the crop dropdown).
- To make the dataset switch on system type too, add a `system` query param in
  `app/api/dataset/route.ts` and an extra `system_type` filter in `filterRowsForCrop()`.
- To add a brand-new crop, add its rows to the CSV and (if the UI id differs from the
  dataset `crop_type`) extend the alias map in `lib/dataset.ts`.

### Change simulation speed
In `app/dashboard/page.tsx`, find the simulation loop and change the interval:
```ts
}, 1000); // 1 second per row — increase to slow down, decrease to speed up
```

### Change what each growth stage maps to
The growth stage label is driven by a lookup in the simulation loop:
```ts
const stageMap = {
  seedling: 5,
  vegetative: 25,
  flowering: 60,
  fruiting: 75,
  harvest: 95,
};
```
Adjust these numbers (0–100) to change where each stage appears on the progress bar.

### Add new parameters to the simulation
1. Add the field to the `DatasetRow` interface in `app/api/dataset/route.ts`
2. Parse it from the CSV in the same file
3. Map it to a `params` or `metrics` field inside the simulation loop in `app/dashboard/page.tsx`

---

## Optimal Path to Update the Environment

The environment controls (pH, temperature, humidity, CO₂) are driven by the dataset during simulation. To move them toward optimal values, the recommended approach is:

### 1. Understand the optimal targets
Each crop has defined optimal values in `app/dashboard/page.tsx`:
```ts
{ id: 'lettuce', optimal: { ph: 6.0, ec: 1.2, temp: 20, humidity: 60 } }
```

### 2. Watch the telemetry gauges
The white marker on each gauge shows the optimal target. The coloured bar shows the current value:
- **Green** — within optimal range
- **Yellow** — mild deviation
- **Red** — critical deviation, stress is accumulating

### 3. Alert console
The system log at the bottom of the dashboard fires alerts when:
- pH deviates more than **0.5** from optimal → warning
- pH deviates more than **1.0** → critical (+20 stress)
- Temperature deviates more than **5°C** → warning (+15 stress)

### 4. To manually correct the environment
Pause the simulation, adjust the pH, Temperature, Humidity, and CO₂ sliders toward their optimal targets, then resume. The stress score and yield prediction will reflect the corrected values on the next tick.

> **Note:** EC is currently status-only and cannot be manually adjusted — it is driven entirely by the dataset.
