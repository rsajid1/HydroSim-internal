# HydroSim — TODO: frontend UX & simulation flow

The engine and system work is done and merged (see `docs/CHANGELOG.md`). The current focus is the
**frontend simulation flow and UX**: locking the pre-run setup, making a session single-crop, hiding
setup once a run is live, handling failure states, and letting users save and compare multiple runs.

Pending items are ordered best-first (foundational / low-effort first) and split into **Features** and
**Bugs**; bugs that are the flip side of a feature are cross-linked to avoid double work. The
deterministic grey-box engine (`backend/app/sim/engine.py`) remains the sole scorer — the AGC dataset +
`data_processing/` pipeline stay a research/thesis attachment, out of scope here.

Related docs: [`docs/engine.md`](engine.md) · [`docs/simulation.md`](simulation.md) ·
[`docs/local_sim.md`](local_sim.md)

---

## ✅ Completed (branch: `feature_cleanups`)

1. **Harvest Quality rename** — the AI card title "AI Yield Prediction — {row}" → **"Harvest Quality —
   {row}"** (and a stale comment on the chart page). The internal `yieldPrediction` field names are left
   unchanged (data-layer, not user-facing).

2. **Single-crop session + locked setup** (foundational; resolves bugs **B1** and **B2**):
   - Crop Type + System Architecture selectors are **disabled while `isRunning`** (dimmed + "pause or
     reset to change" tooltip), so setup can't change mid-run.
   - The planter is **single-crop**: the per-rack lettuce/tomato choice popup is removed; clicking an
     empty row plants the **session crop** (`activeCrop`). Changing Crop Type re-plants any occupied
     rows to the new crop and resets (`replantToCrop`), so the visual can never diverge from the scored
     crop.
   - **Planting is a pre-run action**: clicking a planter while running no longer plants (it only selects
     occupied rows, and empty planters show `cursor-not-allowed`). Fixes a bug where planting another row
     mid-run restarted the simulation.

   Verified: frontend lint 0 errors.

---

## ⏳ Pending — Features

1. **Hide technique selection once a run is live**
   When the simulation is running, hide the sidebar nav and the **System Setup** panel (crop +
   architecture selectors). Keep **visualization, telemetry, environment controls, harvest-quality,
   and instructions** visible — the environment controls stay so the user can still react during a run,
   and the telemetry's "Target" already shifts per stage to hint what to adjust. Restore the hidden
   panels on pause/reset.

   > Stage-change hints come from telemetry, not a pop-up: the gauges already show the engine's
   > stage-aware `optimal` as a moving "Target", so the user reads what to change straight from
   > telemetry. (The earlier stage-change pop-up idea is dropped as redundant.)

2. **UI polish & unification** — *keep the current design system* (dark slate theme, blue accent, card
   style); this is **spacing / typography / alignment** only. Best done after feature 1, since it
   changes what's on screen during a run. Concrete fixes seen in the current dashboard:
   - **Fix two overlap bugs:** the sidebar footer avatar ("N") overlaps the "Project Status / System
     Online" text, and the "Local" source badge overlaps the "Harvest Quality — Top Row" card title.
   - **Unify typography:** labels/headers mix monospace and sans (growth-stage header, "Click a row to
     plant …", "System Log", "0 Hours"). Define one type scale; reserve monospace for numeric/data
     readouts only.
   - **Rebuild the visualization header:** "Growth Stage — Top Row / Seedling (0%) / Health 100% /
     0 Hours" wraps into cramped stacked fragments — lay it out as one aligned status bar.
   - **Balance the visualization column:** it leaves a large empty dark region; equalize column heights
     and center/fill the content so the three columns feel intentional, not lopsided.
   - **Enforce one spacing grid & align cards:** card paddings and gutters vary and the three columns
     don't share a top baseline — put everything on an 8px grid with card headers aligned across columns.
   - **Reduce control noise:** each slider shows both a "Target: X" pill and a separate numeric input —
     unify so the target and the current value aren't visually redundant.
   - **Reconcile the grow-bed panel:** the cream/beige planter clashes with the dark theme — restyle or
     deliberately frame it so it reads as part of the same system.

3. **Simulation failure states** (partly present — extend it)
   The death latch already exists (`plantDeadByRow`, health→0 = "DEAD"). Build out the failure UX:
   - **Deviation-with-grace**: when controls sit far outside the current stage's optimal range, warn and
     give the user a short window to react before health damage compounds.
   - **Backend failure**: show an explicit failure state when `/api/sim/predict` is unreachable, instead
     of silently freezing growth.
   - **Visualize dying plants**: reflect low health / death in the visualization (wilting/dead plant),
     driven by the per-row yield/health rate.

4. **Compare Scenarios — save & compare multiple runs** (GitHub issue #10)
   Let users save completed runs and compare 2–3 side by side (final yield, average stress, time to
   harvest, time out of range, env averages) so instructors/learners see how configurations performed.

   **Decided approach — Phase 1 on `localStorage`, behind a swappable store interface** (Phase 2 can drop
   in a backend with no UI rewrite). A "scenario" = **one saved run** at run level (env & stress are
   global; the active row supplies the plant outcome). Smaller decisions locked in: MVP "time out of
   range" = sim-hours where overall `stress_factor` exceeded a threshold (~10%); Save is the existing
   header **Save Session** button (auto-capture on harvest optional).

   **Metrics & sources** (all available today unless noted):
   | Metric | Source |
   |---|---|
   | Final yield | `prediction.harvestQuality` — store raw **and** displayed `×√health`, plus final health |
   | Average stress | running mean of `prediction.stressFactor` over ticks |
   | Time to harvest | `prediction.timeToHarvest` (days) at completion |
   | Env averages (pH/EC/temp/humidity/CO₂) | running mean of `params` over ticks |
   | Time out of range | **new** — sim-hours where `stress_factor` > threshold (per-param version later) |
   | Final health / duration | `healthByRow`, `simulationTime` |

   **Build order:**
   1. `lib/scenarioMetrics.ts` — pure aggregation (sample type + `aggregate()` → averages/totals/out-of-
      range) **+ `scenarioMetrics.test.ts`** (Vitest — a runner already exists; satisfies the unit-test
      acceptance criterion).
   2. `lib/scenarioStore.ts` — a small `ScenarioStore` interface + a `localStorage` implementation (Phase
      2 swaps in a fetch-based one).
   3. `SimulationProvider` — per-tick accumulator (sums/counts, reset on `handleReset`); `saveScenario()`,
      `scenarios`, `deleteScenario()` on the context.
   4. Wire the header **Save Session** button → `saveScenario()` (confirmation toast).
   5. **Compare Scenarios view** — new nav item + panel: list saved scenarios (crop, system, date, key
      settings), select 2–3, comparison **table** with the *changed* config cells highlighted so students
      see what differed. Table first; charts later.
   6. Verify — Vitest + `npm run lint`; manual: two distinct runs show distinct metrics, and changing only
      pH target highlights that difference.

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
  growth, and show health visually (plant thriving vs. dying / simulation failure). Pairs with the
  dying-plant visuals in feature 3.

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
