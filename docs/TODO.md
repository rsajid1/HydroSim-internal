# HydroSim — TODO: frontend UX & simulation flow

The engine and system work is done and merged (see `docs/CHANGELOG.md`). The current focus is the
**frontend simulation flow and UX**: locking the pre-run setup, making a session single-crop, polishing
and unifying the UI, handling failure states, and letting users save and compare multiple runs.

Pending items are ordered best-first (foundational / low-effort first) and split into **Features** and
**Bugs**; bugs that are the flip side of a feature are cross-linked to avoid double work. The
deterministic grey-box engine (`backend/app/sim/engine.py`) remains the sole scorer — the AGC dataset +
`data_processing/` pipeline stay a research/thesis attachment, out of scope here.

Related docs: [`docs/engine.md`](engine.md) · [`docs/simulation.md`](simulation.md) ·
[`docs/local_sim.md`](local_sim.md)

---

## ✅ Completed (branch: `feature_cleanups`)

Brief pointers — see `docs/CHANGELOG.md` (2026-07-25 / 07-26) for the full detail.

1. **Harvest Quality rename** — AI card title "AI Yield Prediction" → "Harvest Quality — {row}".
2. **Single-crop session + locked setup** — one crop/system per session, selectors locked while running,
   single-crop planter (`replantToCrop`), planting blocked mid-run. Resolves bugs **B1** and **B2**.
3. **Collapsible sidebar** — persisted icon-only ↔ full toggle on the left nav.
4. **UI / control polish** — removed the sliders' redundant "Target" (the marker lives on telemetry) and
   number box, fixed the source-badge/title overlap, typography/spacing cleanups.
5. **Visualization column refactor** — isolated, elevated status chip above a centred, size-capped grow
   bed; one "View Chart — {row}" for the active row; active row shown via blue pot rings.
6. **Environment Controls note → info-icon hover tooltip** — decluttered the controls panel.
7. **Simulation failure states** — death latch (irreversible **DEAD** + colour-coded health) was already
   in place; added **deviation-with-grace**: the System Log now scores all five controls against the
   active stage's optimum (fixing the bug where it only reacted to pH/temp), warns per off-target control,
   and escalates a sustained severe deviation to *critical* only after a grace window. *Backend-failure
   UX* and *dying-plant visuals* were dropped from scope (redundant with the health chip + growth chart;
   plant-health visuals belong to the optional 3D view).

All verified: **48 frontend tests pass, lint 0 errors** (dashboard tests updated to the single-crop flow).

---

## ⏳ Pending — Features

1. **Compare Scenarios — save & compare multiple runs** (GitHub issue #10)
   Let users save completed runs and compare 2–3 side by side (final yield, average stress, time to
   harvest, time out of range, env averages) so instructors/learners see how configurations performed.

   **Source of truth = the engine.** Every metric comes from the deterministic grey-box engine's
   `/api/sim/predict` output (`predictionByRow`) + provider state — there is **no AI/ML** here; the
   issue's "AI predictions" wording predates the ML drop (the dataset/pipeline is a thesis attachment).

   **Decisions locked in:**
   - **Phase 1 on `localStorage`, behind a swappable `ScenarioStore` interface** — Phase 2 drops in a
     backend with no UI rewrite.
   - A "scenario" = **one saved run** at run level (env & stress are global; the **active row** supplies
     the plant outcome — under a global environment all occupied rows track near-identically, so one
     representative is enough).
   - **Save trigger** = the existing header **Save Session** button (manual), disabled until
     `simulationTime > 0`. Auto-capture on harvest is deferred/optional.
   - **"Time out of range"** = sim-hours where the active row's engine `stress_factor` exceeded a
     threshold (~10). Per-param version later.
   - **Charts out of MVP scope** — a scenario stores summary numbers only, not the per-tick trajectory,
     so overlaying growth/stress curves would need a persisted downsampled series (Phase 2). The live-sim
     `RowGrowthChart` stays a run-time view; comparison is table-first.

   **Data model** (`lib/scenarioMetrics.ts`):
   ```ts
   interface ScenarioMetrics {
     finalYieldRaw: number;        // predictionByRow[activeRow].harvestQuality
     finalYieldDisplayed: number;  // raw × √health  (matches the dashboard's discount)
     finalHealth: number;          // 0–100
     avgStress: number;            // running mean of stressFactor over ticks
     timeToHarvestDays: number;    // predictionByRow[activeRow].timeToHarvest at save
     timeOutOfRangeHours: number;  // sim-hours where stress > ~10
     durationHours: number;        // simulationTime
     envAvg: { ph; temp; humidity; co2 };  // running mean of params over ticks (EC removed from the sim)
   }
   interface Scenario {
     id: string; createdAt: number; label: string;   // "Scenario N", renameable
     cropId; cropName; systemId; systemName;
     finalSettings: SimulationParams;  // slider values at save (the "what I set")
     metrics: ScenarioMetrics;
   }
   ```
   Pure, unit-tested aggregation (the piece that satisfies the unit-test AC):
   `createAccumulator()` → `accumulate(acc, { params, stressFactor })` per tick → `finalize(acc, finalState)
   → ScenarioMetrics`.

   **Metrics & sources** (all engine/provider values available today unless noted):
   | Metric | Source |
   |---|---|
   | Final yield | `predictionByRow[activeRow].harvestQuality` — store raw **and** displayed `×√health`, + final health |
   | Average stress | running mean of `predictionByRow[activeRow].stressFactor` over ticks |
   | Time to harvest | `predictionByRow[activeRow].timeToHarvest` (days) at save |
   | Env averages (pH/temp/humidity/CO₂) | running mean of `params` over ticks (EC removed from the sim) |
   | Time out of range | **new** — sim-hours where `stress_factor` > threshold (per-param version later) |
   | Final health / duration | `healthByRow[activeRow]`, `simulationTime` |

   **Storage** (`lib/scenarioStore.ts`): `interface ScenarioStore { list(); save(s); remove(id);
   rename(id, label); }`; a `localStorageScenarioStore` under key `hydrosim.scenarios` (JSON array,
   SSR-safe guards). Phase 2 swaps in a `/api/scenarios` fetch impl — same interface, no UI change.

   **Provider accumulation** (`SimulationProvider.tsx`): a `runAccumRef` of
   `{ ticks, sumPh, sumTemp, sumHumidity, sumCo2, sumStress, outOfRangeTicks }`, incremented once
   per tick in the existing loop (where `calculatePhysics` runs), reset in `handleReset`. Context gains
   `scenarios` (loaded from the store on mount, hydration-safe), `saveScenario()`, `deleteScenario(id)`,
   `renameScenario(id, label)`.

   **UI lives in the existing (unused) Dashboard tab** — no new sidebar item. Today the main sim view
   renders for `activeNav !== 'database'`, so the **Dashboard** nav slot (`activeNav === 'dashboard'`)
   just duplicates **Simulation**. Repurpose it: render the Compare view at `'dashboard'` and tighten the
   sim-view guard to `activeNav !== 'database' && activeNav !== 'dashboard'` (optionally relabel the nav
   item text "Dashboard" → "Compare Scenarios"). New `ScenariosPanel.tsx` (its own component,
   `useSimulation()`).

   Card grid + a **"Start new session"** card (→ switches to the Simulation tab); **View** opens a
   single-scenario detail; select 2–3 → **Compare**:
   ```
   Compare Scenarios (Dashboard tab)              [ Compare selected · 2 ]
   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
   │  +            │ │ ☑ Scenario 1  │ │ ☑ Scenario 2  │
   │  Start new    │ │ Lettuce · NFT │ │ Lettuce · DWC │
   │  session      │ │ Jul 28 14:02  │ │ Jul 28 14:20  │
   │ (→ Simulation)│ │ Yield 82 · S12│ │ Yield 74 · S21│
   └───────────────┘ │ [View] [🗑]   │ │ [View] [🗑]   │
                     └───────────────┘ └───────────────┘

   Detail (View):                     Compare (2–3 selected):
   ← Back  Scenario 2 · Lettuce·DWC                Scenario 1   Scenario 2
   OUTCOME              ENV  avg  set   Crop        Lettuce      Lettuce
   Yield(disp) 74%      pH   5.6  5.5   System      NFT          DWC *
   Health      86%      Temp 22   21   ─ Outcome ───────────────────────
   Avg stress  21       Hum  63   60    Final yield 82% ▲        74%
   Out of range 18 h    CO₂  780  800   Avg stress  12  ▲        21
   To harvest  31 d                     Out of range 6 h ▲       18 h
   Duration    96 h                     ─ Environment (avg) ─────────────
                                        pH          6.0          5.6 *
                                        Temp        20 °C        22 °C *
                                        * differs from baseline  ▲ best
   ```

   **How comparison reads** — a metrics **table, one column per scenario**. First selected = baseline;
   any *config* cell that differs from it (crop, system, an env-average) is flagged `*` (the "what
   changed"), and each *outcome* row marks the best value ▲ (the "what it did"). Reads directly as
   "Scenario 2 ran pH lower and picked DWC → higher stress, lower yield."

   **Build order:**
   1. `lib/scenarioMetrics.ts` — pure aggregation (sample type + `createAccumulator`/`accumulate`/
      `finalize` → averages/totals/out-of-range) **+ `scenarioMetrics.test.ts`** (Vitest — a runner
      already exists; satisfies the unit-test acceptance criterion). *Lock the math first, no UI.*
   2. `lib/scenarioStore.ts` — the `ScenarioStore` interface + `localStorage` implementation (Phase 2
      swaps in a fetch-based one).
   3. `SimulationProvider` — per-tick `runAccumRef` accumulator (reset on `handleReset`); `saveScenario()`,
      `scenarios`, `deleteScenario()`, `renameScenario()` on the context.
   4. Wire the header **Save Session** button → `saveScenario()` (confirmation toast; disabled until
      `simulationTime > 0`).
   5. **Compare Scenarios view** in the repurposed **Dashboard** tab (`ScenariosPanel.tsx`): card grid +
      "Start new session" card, single-scenario detail, select 2–3, comparison **table** with the
      *changed* config cells and *best* outcomes highlighted. Table first; charts later.
   6. Verify — Vitest + `npm run lint`; manual: two distinct runs show distinct metrics, and changing only
      pH highlights that difference; a clean vs bad run shows the expected yield/stress gap.

   **Out of scope here** (issue's older notes): scenario *templates* and the full post-simulation *report*
   (issues 9 / 13) — this feature just makes its metrics report-ready.

   **Phase 2 (later, optional):** persist server-side — a `scenarios` table (manual DDL, like `users`) +
   `/api/scenarios` router (create/list/delete) keyed by the Cognito user, swapping the store
   implementation only. Enables cross-device/instructor persistence and pairs with **bug B3**.

---

## 🐛 Pending — Bugs

- **B3 — Leaving the simulator URL resets the run.** The sim persists across `/dashboard/*` routes
  (provider lives in `app/dashboard/layout.tsx`) but resets when navigating away from `/dashboard`
  entirely. Decide the intended behavior — persist run state (e.g. via Compare Scenarios' Phase-2 backend)
  or warn the user before they leave.

> **Resolved** (see Completed): **B1** (crop consistency) and **B2** (mid-run selection stopped the sim)
> were fixed by the single-crop session; the "planting another row mid-run restarts the simulation" bug
> was fixed alongside it.

---

## 💡 New features or refinement (optional)

- **3D plant-growth visualization.** Replace/augment the 2D planter with an accurate 3D view of plant
  growth, and show health visually (plant thriving vs. dying / simulation failure). This subsumes the
  "visualize dying plants" idea that was dropped from the (now-complete) failure-states work as redundant
  with the health chip + growth chart.

---

## Engine limitations to document in the final report

Not code TODOs — accepted limitations to write up (the engine is sanity-calibrated by reasoned
estimate, not data-fit; see `docs/engine.md` §8):

- **Display-only yield discount** — the dashboard shows `harvest_quality × √health`, but the API
  returns the **undiscounted** `harvest_quality` (`predict_yield` is untouched). The health
  penalty is a presentation choice; any other API consumer sees the raw number.
- **Health has no equilibrium floor** — for any stress above `HEALTH_STRESS_NEUTRAL` the health
  rate is a fixed negative value independent of current health, so a persistently mid-stressed
  plant (~30–50) crawls to death rather than settling at a stable reduced vigor.
- **Health is fully reversible** — recovery always returns to 1.0; prior damage leaves no
  permanent ceiling. Only actual death (health 0) latches.
- **Symmetric tolerances** — stress uses `abs(value − target)`, so too-hot = too-cold and
  below-optimal = above-optimal for every field; real crop responses are asymmetric.
- **Estimate-based constants** — the DWC system factor `1.3` and `HEALTH_LIEBIG_SCALE 40` (and
  the health decay/recovery rates) are documented engineering estimates.
