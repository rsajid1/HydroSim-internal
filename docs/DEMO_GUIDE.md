# HydroSim Demo Guide

A walkthrough of every working part of the frontend, written for presenting the app live. Read the **Rough Edges** section first — it's the difference between a smooth demo and an accidental screenshot of a raw error message.

## Before you start

- The frontend talks to a separate FastAPI backend at `http://127.0.0.1:8001`. Make sure it's running before the demo — login, signup, the AI Yield card, and the Database panel all depend on it.
- **Auth needs a real AWS Cognito user.** There's no hardcoded test/demo account. Either have a pre-verified Cognito account ready to log in with, or skip login entirely — **there is no login gate on `/dashboard`**, you can navigate straight to `localhost:3001/dashboard` in the URL bar and the whole simulation works with zero auth. This is your safety net if login misbehaves live.
- If the backend isn't running, the dashboard grid still works — you just won't get live AI predictions (badge shows "Local" instead of "Engine") or Database panel data.

## 1. Auth flow (optional — can skip)

Root `/` auto-redirects to `/auth/signup`. Four pages: Sign up, Log in, Forgot password, Reset password — all hit the backend for real, no client-side mocking.

**Avoid:** don't deliberately type a wrong password or a nonexistent email to "demonstrate error handling." The backend forwards Cognito's raw error message verbatim, and a wrong-password error looks different from a nonexistent-user error — a known, documented issue (username enumeration). It won't look broken, but it won't look polished either. Stick to a real login you know works, or skip straight to `/dashboard`.

## 2. Dashboard (`/dashboard`) — the core of the demo

### Left nav bar
Five items: Dashboard, Simulation, Database, Learning Modules, Configuration.

**Important:** only **Database** actually changes what's shown. Dashboard, Simulation, Learning Modules, and Configuration all render the identical planter grid — clicking between them only changes which nav item is highlighted. **Don't click "Learning Modules" expecting content — there isn't a learning module page yet**, that's a future feature.

### Garden Planter (center grid)
Planting is **row-based**, not per-pot. Demo it like this:
1. Click any pot in a row (e.g. "Top Row").
2. A dropdown appears — click **Lettuce** or **Tomatoes**.
3. All 3 slots in that row fill instantly, plus a green confirmation toast for 3 seconds.
4. A **"View Chart"** button appears under the row — clicking it jumps to the dedicated chart page (`/dashboard/simulation`) for that row.

Switching a row to a *different* crop resets that row's growth back to 0% (toast changes to "restarting this row") — good to know so an accidental re-pick doesn't look like a bug.

### System Architecture selector (NFT vs DWC)
A dropdown that changes the header text and the "Did you know?" card copy. Functionally it feeds the AI prediction (DWC buffers stress vs. NFT), but there's **no big visual change** — don't oversell this as a dramatic moment.

### Environment Controls
Four **live, editable** sliders: pH, Temperature, Humidity, CO2. Moving any of them immediately updates the telemetry gauges and (if the sim is running) the AI Yield card within ~300ms.

- **EC is read-only** — shown as a gauge only, no slider.
- **There is no flow-rate control** in the UI.

### Simulate / Reset (top-right header)
- **Simulate/Pause** starts or stops the clock. Each real second advances the simulated clock by 6 hours and updates growth/health for every planted row.
- **Reset** stops the sim, zeroes the clock, and restarts all three rows' growth/health from 0% — it does **not** un-plant crops.
- Changing the crop-type dropdown in "System Setup" also triggers a reset as a side effect — don't be surprised if growth suddenly restarts after that click.
- **"Export CSV" and "Save Session" buttons in the header do nothing** — they have no click handler. Don't promise a download live.

### AI Yield & Stress Prediction card
Shows harvest quality %, stress %, and (when live) estimated time-to-harvest. Badge in the corner reads **"Engine"** (backend answered) or **"Local"** (fallback/no backend) — if the backend's down this just silently shows "Local," it doesn't error on screen, so it's safe either way.

### Alerts (System Log panel)
Triggers automatically from pH/temperature deviation. **Reliable way to trigger one live:** with the sim running, drag the pH slider to an extreme (below ~4.5 or above ~7.5 for lettuce) — a red "pH Critical" alert appears within a second. Good, fast, controllable demo beat if you want to show the alerting system.

### Growth Stage image (the feature we just built)
Only **lettuce** has stage art — Seed → Cotyledon → Seedling → Rosette → Cupping → Heading. Tomatoes fall back to a generic label with no image, so **use lettuce for this part of the demo**.

- Small (32px) version shown inline on the dashboard next to "Growth Stage — [Row]".
- **Large version (up to 220px) lives on the chart page**, in a side panel next to the growth graph — this is the better spot to show it off.
- **Timing:** lettuce completes a full growth cycle in about 3 real minutes when healthy. The first stage change (Seed → Cotyledon) should appear **roughly 10–15 seconds** after pressing Simulate — plant lettuce, hit Simulate, and you'll see the image flip within about 15 seconds. Good, fast, reliable moment to plan around.

### Database panel
Clicking "Database" swaps in a connection-info card. It's **static text until you press "Test Connection"**, which calls the backend's health-check endpoint and shows either a green "Connected" result or a red failure box.

**Avoid:** if you haven't confirmed the backend can reach Postgres beforehand, don't press "Test Connection" live — a failure currently displays the raw database host, name, and driver error text (a known, documented issue). The panel looks perfectly fine without pressing that button, so skip it if you're not sure.

## 3. Simulation chart page (`/dashboard/simulation`)

Reached via a row's "View Chart" button (the left-nav "Simulation" item does *not* go here — only the planter button does).

- Row tabs at top switch between Top/Middle/Bottom Row without leaving the page.
- Growth chart plots growth %, health %, and stress over time.
- **The new large stage-image panel** sits beside the chart (lettuce only), with the stage name and % grown underneath.
- Below the chart: Harvest Quality, Stress Factor, and (when live) Estimated Time to Harvest.
- If nothing's planted in the selected row, this page shows a placeholder instead of a chart — plant first, then navigate here.

## Quick pre-demo checklist

- [ ] Backend running and reachable at `127.0.0.1:8001`
- [ ] Either a working Cognito login ready, or plan to skip straight to `/dashboard`
- [ ] Confirmed Postgres is reachable if you plan to press "Test Connection" — otherwise skip that button
- [ ] Plan to demo growth-stage images with **lettuce**, not tomatoes
- [ ] Know that "Learning Modules," "Export CSV," and "Save Session" are not functional yet — avoid clicking them live
- [ ] Have a row ready to plant early in the demo so growth has time to progress by the time you want to show a stage change
