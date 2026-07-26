# HydroSim — TODO: frontend UX & simulation flow

The engine and system work is done and merged (see `docs/CHANGELOG.md`). The current focus is the
**frontend simulation flow and UX**: locking the pre-run setup, making a session single-crop, hiding
setup once a run is live, guiding the user through stage changes, and handling failure states.

Items are ordered best-first (foundational / low-effort first). The list is split into **Features**
and **Bugs**; several bugs are the flip side of a feature and are cross-linked to avoid double work.
The deterministic grey-box engine (`backend/app/sim/engine.py`) remains the sole scorer — the AGC
dataset + `data_processing/` pipeline stay a research/thesis attachment, out of scope here.

Related docs: [`docs/engine.md`](engine.md) · [`docs/simulation.md`](simulation.md) ·
[`docs/local_sim.md`](local_sim.md)

---

## ⏳ Pending — Features

1. **Rename "AI Yield Prediction" → "Harvest Quality"** (quick win, no deps)
   The inner metric already reads *"Estimated Harvest Quality"*, but the card title still says
   *"AI Yield Prediction — {row}"* (`app/dashboard/page.tsx:652`). Rename the card title, the
   `Cpu` source badge wording, and any other "AI yield" copy to the harvest-quality naming so the
   dashboard is consistent. Keep the underlying engine field names unchanged.

2. **Lock setup to pre-run + make a session single-crop** (foundational — also fixes Bugs B1/B2)
   Before a run starts the user picks **one** crop and **one** hydroponic technique; once **Simulate**
   is pressed, both selections are locked. Every component (environment controls, ranges, visualization,
   telemetry) loads that one crop's values only — no mixed crops per rack. To simulate a different crop
   the user starts a **new session** (see feature 6). This subsumes the current per-rack `assignCrop`
   flow, which today lets racks hold different crops independently of the global Crop Type.
   - Disable the Crop Type + System Architecture selectors while `isRunning`.
   - Drive the whole dashboard off one `activeCrop`; drop per-rack crop assignment (or fix all racks to
     the session crop).

3. **Hide technique selection once a run is live**
   When the simulation is running, hide the sidebar nav and the **System Setup** panel (crop +
   architecture selectors). Keep **visualization, telemetry, environment controls, harvest-quality,
   and instructions** visible — the environment controls stay so the user can still react during a run,
   and the telemetry's "Target" already shifts per stage to hint what to adjust. Restore the hidden
   panels on pause/reset.

   > Stage-change hints come from telemetry, not a pop-up: the gauges already show the engine's
   > stage-aware `optimal` as a moving "Target", so the user reads what to change straight from
   > telemetry. (The earlier stage-change pop-up idea is dropped as redundant.)

4. **UI polish & unification** — *keep the current design system* (dark slate theme, blue accent, card
   style); this is **spacing / typography / alignment** only. Best done after features 2–3, since those
   change what's on screen during a run. Concrete fixes seen in the current dashboard:
   - **Fix two overlap bugs:** the sidebar footer avatar ("N") overlaps the "Project Status / System
     Online" text, and the "Local" source badge overlaps the "AI Yield Prediction — Top Row" card title.
   - **Unify typography:** labels/headers mix monospace and sans (growth-stage header, "Click a planter
     to assign a crop", "System Log", "0 Hours"). Define one type scale; reserve monospace for
     numeric/data readouts only.
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

5. **Simulation failure states** (partly present — extend it)
   The death latch already exists (`plantDeadByRow`, health→0 = "DEAD"). Build out the failure UX:
   - **Deviation-with-grace**: when controls sit far outside the current stage's optimal range, warn and
     give the user a short window to react before health damage compounds.
   - **Backend failure**: show an explicit failure state when `/api/sim/predict` is unreachable, instead
     of silently freezing growth.
   - **Visualize dying plants**: reflect low health / death in the visualization (wilting/dead plant),
     driven by the per-row yield/health rate.

6. **Multiple sessions to compare runs** (GitHub issue #10)
   Let the user save and revisit multiple simulation runs to compare them and iterate. The "Save Session"
   header button (`app/dashboard/page.tsx:296`) is currently a no-op — wire it up. Each session captures
   its crop, technique, environment history, and outcome so runs can be compared side by side.

---

## 🐛 Pending — Bugs

- **B1 — Crop selection must be consistent everywhere.** Choosing a crop should load *only* that crop's
  settings, ranges, visual, and telemetry. Today the per-rack planter can hold mixed lettuce/tomato
  independent of the global Crop Type, so the visual and the scored crop can diverge.
  → Resolved by **feature 2** (single-crop session).
- **B2 — Editing selection mid-run stops the simulation.** The Crop Type / System selectors stay
  interactive while running; changing the crop calls `handleReset()` and halts the run midway.
  → Resolved by **feature 2** (lock selectors while `isRunning`).
- **B3 — Leaving the simulator URL resets the run.** The sim persists across `/dashboard/*` routes
  (provider lives in `app/dashboard/layout.tsx`) but resets when navigating away from `/dashboard`
  entirely. Decide the intended behavior — persist run state (e.g. via the session model in feature 6)
  or warn the user before they leave.

---

## 💡 New features or refinement (optional)

- **3D plant-growth visualization.** Replace/augment the 2D planter with an accurate 3D view of plant
  growth, and show health visually (plant thriving vs. dying / simulation failure). Pairs with the
  dying-plant visuals in feature 5.

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