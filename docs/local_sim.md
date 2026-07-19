# Local Simulation — AI Yield & Stress Prediction

> **⚠️ Historical (v1 design) — superseded 2026-07.** This document describes the original
> **dataset-lookup** implementation (nearest-row match, replay from the synthetic CSV,
> `source: "dataset"`). That is **no longer how it works**:
> - `POST /api/sim/predict` computes stress / yield / growth / health **live** from the
>   deterministic grey-box engine (`backend/app/sim/engine.py`) — it is the **sole live scorer**
>   (`source: "engine"`). There is **no ML model overlay** and **no dataset replay**.
> - The `GET /api/dataset` route and its `lib/dataset.ts` helpers have been **removed**; the
>   backend consults the CSV **only** for `cycle_length_days` (time-to-harvest).
> - The response now also carries `growth_rate`, `health_rate`, `cycle_days`, `growth_stage`, a
>   stage-aware `optimal` map, and takes `system_type`.
>
> Only the request/response **contract shape** (payload fields, fallback behaviour) below remains
> broadly accurate. For current behaviour see [`docs/simulation.md`](simulation.md) and
> [`docs/engine.md`](engine.md); the mechanism sections (§1–3, §6) are kept for historical record.

This document explains how the **AI Yield Prediction** panel works end to end: the
route that was added, how the dashboard talks to the backend, and what payloads go in
and out.

> Implements GitHub issue **#8** — "AI yield and stress prediction panel".
> Prediction is now engine-computed (was a dataset lookup in v1). A trained ML model can replace the
> yield computation later **without changing the request/response contract**.

---

## 1. The big picture

```
┌─────────────────────────────┐         POST /api/sim/predict        ┌──────────────────────────────┐
│  Frontend (Next.js :3000)   │  ───────  JSON payload  ──────────▶  │   Backend (FastAPI :8001)    │
│  app/dashboard/page.tsx     │                                      │   app/routers/sim.py         │
│                             │                                      │                              │
│  • AI Yield Prediction card │  ◀──────  JSON response  ──────────  │   • validates request        │
│  • predicts live once the   │                                      │   • looks up nearest row     │
│    scenario is running       │                                      │   • builds explanation       │
└─────────────────────────────┘                                      └───────────────┬──────────────┘
            ▲                                                                         │
            │ fallback to client-side calc                                           │ reads (cached)
            │ if backend is unreachable                                              ▼
            │                                                         ┌──────────────────────────────┐
            └─────────────────────────────────────────────────       │ data/synthetic_hydroponics_  │
                                                                      │ dataset.csv  (dummy dataset) │
                                                                      │ precomputed scores per row   │
                                                                      └──────────────────────────────┘
```

**Yes — it checks against the dummy (synthetic) dataset.** The backend does **not**
recompute yield with a formula and does **not** touch PostgreSQL. It reads the
precomputed `predicted_yield_score` / `stress_score` / `risk_level` columns that
already exist in `data/synthetic_hydroponics_dataset.csv`, picks the row that best
matches the current environment, and returns that row's scores.

---

## 2. The route that was added

| Property | Value |
|---|---|
| **Method + path** | `POST /api/sim/predict` |
| **Defined in** | `backend/app/routers/sim.py` (`APIRouter(prefix="/api/sim")`) |
| **Registered in** | `backend/app/index.py` → `app.include_router(sim.router)` |
| **Auth** | None (read-only prediction; no Cognito token required) |
| **Data source** | `data/synthetic_hydroponics_dataset.csv` (local, cached in memory) |
| **Latency** | A single in-memory lookup — well under issue #8's 2-second budget |

---

## 3. Step-by-step data flow

1. **User sets up the scenario.** They pick a crop (Lettuce or Tomatoes), **plant it in a
   pod** (click a planter → assign the crop), and press **Simulate**.

2. **The panel only goes live once the scenario is ready.** The prediction `useEffect` in
   `app/dashboard/page.tsx` is **gated** — it does nothing (and clears the panel) unless
   **all three** hold: (a) a crop is planted in at least one pod, (b) the simulation is
   running (`isRunning`), and (c) the selected crop exists in the dataset. This prevents
   the panel from reacting before the user has actually set anything up.

3. **Once live, it re-predicts in real time (bidirectional).** While gated open, the
   effect is keyed on the environment inputs (`params.ph`, `params.temp`,
   `params.humidity`, `params.ec`, `params.co2`), the crop, and `growthStage`. Any change
   — a **manual slider edit** or **parameter drift during the run** — schedules
   `fetchPrediction()`, **debounced by `PREDICT_DEBOUNCE_MS` (300 ms)** so a slider drag
   coalesces into one request. Each render rebuilds the call with the *current* values, so
   there's no stale closure.

4. **Frontend builds the payload.** `fetchPrediction()` sends the current environment
   state (`params`), the selected crop id, and the current growth progress
   (`growthStage`, 0–100) to `POST /api/sim/predict`. The crop id `"tomatoes"` is sent
   as-is — the backend maps it to the dataset's `"tomato"`.

5. **Backend validates the request.** FastAPI parses the body into the `PredictRequest`
   Pydantic model. Missing numeric fields fall back to sensible defaults.

6. **Backend loads the dataset (once).** `backend/app/sim/dataset.py` reads the CSV at
   the repo root and caches it in memory (`@lru_cache`), so only the first request pays
   the file-read cost. It filters to the requested crop's rows.

7. **Backend finds the nearest row.** It computes a normalized Euclidean distance
   between the request's `ph` / `air_temperature_c` / `humidity_percent` and each
   candidate row, then selects the closest row. (If `growth_stage` is provided and has
   matching rows, it narrows to that stage first.)

8. **Backend reads the precomputed scores** from that row:
   - `predicted_yield_score` → `harvest_quality`
   - `stress_score` → `stress_factor`
   - `risk_level`, `status` → passed through

9. **Backend derives the extras:**
   - **`estimated_days_to_harvest`** = `cycle_length × (1 − growth_percent / 100)`, where
     `cycle_length` is the crop's maximum `day` in the dataset.
   - **`explanation`** = a one-line sentence naming the environment input that deviates
     most from the crop's optimal target (e.g. *"Humidity 30.0% is 30.0% below optimal —
     main stress driver; risk: high."*).

10. **Backend logs and responds.** It logs a structured `sim_predict` event and returns
   the `PredictResponse` JSON.

11. **Frontend updates the card live.** On success, the AI Yield Prediction card updates
    within ~300 ms of the change — harvest quality, estimated time to harvest, stress
    factor, and the explanation — with a **"Dataset"** badge. On any failure (backend
    down, or a crop with no dataset rows like herbs/cucumbers), `prediction` is set to
    `null` and the card **falls back** to the client-side `calculatePhysics()` numbers
    with a **"Local"** badge — so the panel never breaks.

---

## 4. Request payload (frontend → backend)

`Content-Type: application/json`. Model: `PredictRequest` in `backend/app/routers/sim.py`.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `crop_type` | string | **yes** | — | UI crop id. `"lettuce"` or `"tomatoes"` (mapped to `"tomato"`). |
| `growth_stage` | string \| null | no | `null` | e.g. `"seedling"`, `"vegetative"`, `"harvest_ready"`. Narrows the search when matching rows exist. |
| `growth_percent` | number \| null | no | `null` | The UI's `growthStage`, 0–100. Drives time-to-harvest. |
| `ph` | number | no | `6.0` | |
| `ec` | number | no | `1.2` | |
| `air_temperature_c` | number | no | `20.0` | The UI's `temp`. |
| `humidity_percent` | number | no | `60.0` | The UI's `humidity`. |
| `co2_ppm` | number | no | `400.0` | The UI's `co2`. |

**Example request**
```json
{
  "crop_type": "lettuce",
  "growth_percent": 30,
  "ph": 6.0,
  "ec": 1.2,
  "air_temperature_c": 20.0,
  "humidity_percent": 60.0,
  "co2_ppm": 400
}
```

---

## 5. Response payload (backend → frontend)

Model: `PredictResponse` in `backend/app/routers/sim.py`.

| Field | Type | Meaning |
|---|---|---|
| `harvest_quality` | number | Estimated harvest quality, 0–100 % (from `predicted_yield_score`). |
| `stress_factor` | number | Estimated stress, 0–100 (from `stress_score`). |
| `estimated_days_to_harvest` | number | Remaining days until harvest. |
| `risk_level` | string | `"low"` / `"medium"` / `"high"` (from the dataset row). |
| `status` | string | `"stable"` / `"warning"` / `"critical"` (from the dataset row). |
| `explanation` | string | One-line summary of the key stress driver. |
| `source` | string | Always `"dataset"` for v1 — lets the UI show the **Dataset** badge. |

**Example — ideal lettuce**
```json
{
  "harvest_quality": 94.0,
  "stress_factor": 5.0,
  "estimated_days_to_harvest": 31.5,
  "risk_level": "low",
  "status": "stable",
  "explanation": "All inputs near optimal — minimal stress; risk: low.",
  "source": "dataset"
}
```

**Example — poor lettuce (pH/temp/humidity off)**
```json
{
  "harvest_quality": 21.0,
  "stress_factor": 69.0,
  "estimated_days_to_harvest": 31.5,
  "risk_level": "high",
  "status": "critical",
  "explanation": "Humidity 30.0% is 30.0% below optimal — main stress driver; risk: high.",
  "source": "dataset"
}
```

**Error — crop not in the dataset** (e.g. `"herbs"`) → HTTP `404`:
```json
{ "detail": "No prediction data for crop 'herbs'" }
```
The frontend treats any non-200 as "no prediction" and falls back to the local calc.

---

## 6. The dataset it checks against

`data/synthetic_hydroponics_dataset.csv` — **synthetic/demo data**, not real partner
data (see `docs/DATASET.md`). It contains **180 lettuce** and **300 tomato** rows. The
columns the prediction uses:

| Column | Used for |
|---|---|
| `crop_type` | Filter rows to the selected crop |
| `growth_stage` | Optional narrowing |
| `day` | Crop cycle length → time-to-harvest |
| `ph`, `air_temperature_c`, `humidity_percent` | Nearest-row distance matching |
| `predicted_yield_score` | → `harvest_quality` |
| `stress_score` | → `stress_factor` |
| `risk_level`, `status` | Passed through to the response |

Because the scores are **precomputed**, the endpoint is effectively a lookup table. This
is the v1 "model": when there's enough real data to train an ML model, swap the lookup
inside `predict()` for model inference and keep the same request/response shape.

---

## 7. Files involved

| File | Role |
|---|---|
| `backend/app/routers/sim.py` | The `POST /api/sim/predict` route, request/response models, nearest-row + explanation logic |
| `backend/app/sim/dataset.py` | Loads + caches the CSV; `rows_for_crop()`, `cycle_length_days()`, crop alias mapping |
| `backend/app/index.py` | Registers the router on the FastAPI app |
| `app/dashboard/page.tsx` | `fetchPrediction()`, the 3s polling effect, the AI card UI + local fallback |
| `data/synthetic_hydroponics_dataset.csv` | The local dummy dataset that backs the prediction |
| `backend/tests/test_sim_predict.py` | Tests: ideal → high/low, poor → low/high, tomato alias, unknown-crop 404 |

---

## 8. Try it manually

**Backend**
```bash
cd backend
uvicorn app.index:app --reload --port 8001    # docs at http://127.0.0.1:8001/docs

curl -X POST http://127.0.0.1:8001/api/sim/predict \
  -H "Content-Type: application/json" \
  -d '{"crop_type":"lettuce","ph":6.0,"air_temperature_c":20,"humidity_percent":60,"growth_percent":30}'
```

**Frontend** — run `npm run dev`, open the dashboard, then: (1) pick **Lettuce**,
(2) **click a planter and assign Lettuce** to a pod, (3) press **Simulate**. The AI Yield
Prediction card now goes live. Drag the **Temperature** or **Humidity** slider and within
~300 ms it re-predicts against the nearest dataset row — quality drops and stress rises as
you move away from optimal. Before those three steps the panel stays idle (it won't react
to sliders). Stop the backend mid-run and the card keeps working off the local calc (badge
flips to **Local**).

---

## 9. Limitations / future work

- **Synthetic data only** — scores are demo values, not biologically validated.
- **No ML yet** — v1 is a dataset lookup; a model can replace it behind the same API.
- **No confidence levels** — planned for the ML phase (issue #8 notes).
- **Lettuce + tomato only** — other crops (herbs, cucumbers) have no dataset rows and use
  the client-side fallback.
- The live simulation loop no longer replays any dataset — the engine steps growth/health each
  tick from the current environment, and the `GET /api/dataset` replay route has been **removed**.
  See [`docs/simulation.md`](simulation.md).