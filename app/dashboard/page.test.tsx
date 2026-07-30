/**
 * Tests for the dashboard simulation controls (Issue #23).
 *
 * We mock two things:
 *   - next/navigation: jsdom doesn't have a router, so we stub it and spy on
 *     push() so the logout tests can check where it redirects.
 *   - global.fetch: no real backend in tests; the component falls back to
 *     local metrics when fetch fails, so this is fine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import DashboardPage from "./page";
import { SimulationProvider } from "./SimulationProvider";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  mockPush.mockClear();
  localStorage.clear();
});

/** DashboardPage reads all simulation state from SimulationProvider (moved out so it
 *  survives navigation to /dashboard/simulation) — every render needs this wrapper. */
const renderDashboard = () => render(<SimulationProvider><DashboardPage /></SimulationProvider>);

// ---------------------------------------------------------------------------
// Initial render
// Check that the page loads and all the key controls are visible and in the
// right default state before the user does anything.
// ---------------------------------------------------------------------------
describe("DashboardPage - initial render", () => {
  it("renders without crashing", () => {
    // Catches broken imports, missing providers, or bad JSX at mount time.
    const { container } = renderDashboard();
    expect(container).not.toBeEmptyDOMElement();
  });

  it("Simulate button shows 'Simulate' on load, not 'Pause'", () => {
    // Simulation is idle on load — button shouldn't already say Pause.
    renderDashboard();
    const btn = screen.getByRole("button", { name: /simulate/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/simulate/i);
  });

  it("crop selector defaults to Lettuce", () => {
    // Lettuce is first in CROPS — page should never open with an empty selection.
    renderDashboard();
    const select = screen.getByRole("combobox", { name: /crop type/i }) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("lettuce");
  });

  it("crop selector offers the two predictable crops (lettuce, tomatoes)", () => {
    // Herbs/cucumbers were removed — only crops with local dataset predictions remain.
    renderDashboard();
    const select = screen.getByRole("combobox", { name: /crop type/i }) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["lettuce", "tomatoes"]);
  });

  it("system selector defaults to NFT", () => {
    // NFT is first in SYSTEMS and should be pre-selected on load.
    renderDashboard();
    const select = screen.getByRole("combobox", { name: /system architecture/i }) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("nft");
  });

  it("system selector offers the two modeled systems (NFT, DWC)", () => {
    // Only NFT and DWC are modeled by the engine; aeroponics/vertical were removed.
    renderDashboard();
    const select = screen.getByRole("combobox", { name: /system architecture/i }) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["nft", "dwc"]);
  });

  it("environment sliders are present, EC is not user-adjustable", () => {
    // pH, temperature, humidity are the tunable parameters; EC has been removed from the sim
    // (no slider, no telemetry gauge, not scored).
    renderDashboard();
    expect(screen.getByRole("slider", { name: /acidity/i })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /nutrient/i })).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /temperature/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /humidity/i })).toBeInTheDocument();
  });

  it("simulation time starts at 0 hours", () => {
    // simulationTime only increments once the user starts the simulation.
    renderDashboard();
    expect(screen.getByText(/0 hours/i)).toBeInTheDocument();
  });

  it("growth stage shows Seedling (0%) on load", () => {
    // growthStage starts at 0. We match the full "Seedling (0%)" string to
    // avoid false positives from other percentage values on the page
    // (humidity gauge, stress factor, etc. also render as "X%").
    renderDashboard();
    expect(screen.getByText(/Seedling \(0%\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Simulate / Pause toggle
// The main button needs to flip between "Simulate" and "Pause" correctly.
// If this breaks, users can't control the simulation at all.
// ---------------------------------------------------------------------------
describe("DashboardPage - Simulate button interaction", () => {
  it("clicking Simulate switches the button to Pause", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("clicking Pause switches the button back to Simulate", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(screen.getByRole("button", { name: /simulate/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Reset button
// Reset should stop a running simulation. Without this, users would have no
// clean way to restart a scenario from scratch.
// ---------------------------------------------------------------------------
describe("DashboardPage - Reset button interaction", () => {
  it("Reset button is present", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: /reset simulation/i })).toBeInTheDocument();
  });

  it("clicking Reset while running stops the simulation", () => {
    // Start it, confirm it's running, then reset and check it stopped.
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset simulation/i }));
    expect(screen.getByRole("button", { name: /simulate/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Crop selection
// Swapping crops should update the dropdown and stop any running simulation.
// The component calls handleReset() on change so growth stats and optimal
// targets reset to the new crop's values.
// ---------------------------------------------------------------------------
describe("DashboardPage - Crop selection", () => {
  it("changing the crop updates the selector", () => {
    renderDashboard();
    const select = screen.getByRole("combobox", { name: /crop type/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "tomatoes" } });
    expect(select.value).toBe("tomatoes");
  });

  it("changing crop mid-simulation stops the simulation", () => {
    // If simulation kept running after a crop change, growth stats would be
    // out of sync with the new crop's optimal targets.
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /crop type/i }), {
      target: { value: "tomatoes" },
    });

    expect(screen.getByRole("button", { name: /simulate/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Logout
// Must redirect to /auth/login AND clear all three auth tokens from
// localStorage. Missing either one leaves the session in a broken state.
// ---------------------------------------------------------------------------
describe("DashboardPage - Logout", () => {
  it("logout button is present", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("clicking logout redirects to /auth/login", () => {
    // A wrong route here means the user stays on the dashboard after logging out.
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(mockPush).toHaveBeenCalledWith("/auth/login");
  });

  it("clears access_token on logout", () => {
    // Primary auth credential — must be gone so the session can't be reused.
    localStorage.setItem("access_token", "fake-token");
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("clears id_token on logout", () => {
    // Carries identity claims (name, email). Should not linger after logout.
    localStorage.setItem("id_token", "fake-id-token");
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(localStorage.getItem("id_token")).toBeNull();
  });

  it("clears refresh_token on logout", () => {
    // Refresh token can silently renew access tokens — leaving it behind
    // would effectively keep the user logged in.
    localStorage.setItem("refresh_token", "fake-refresh");
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Growth integration
// The growth bar must advance at the rate the engine returns — scaled by the
// crop's cycle length and slowed by stress — and must freeze when the engine
// has not answered. Before this, it advanced at a flat 0.2%/tick regardless.
// ---------------------------------------------------------------------------
describe("DashboardPage - growth advances at the engine's rate", () => {
  // Mirrors the constants in page.tsx (not exported).
  const PREDICT_DEBOUNCE_MS = 300;

  // Matches PredictResponse. growth_rate 1.0 = unstressed; cycle_days 45 = lettuce.
  // healthRate defaults to 0 (neutral) so health stays pinned at 1.0 and growth math is
  // unaffected; the health-specific tests below pass a non-zero rate.
  const predictionBody = (growthRate: number, cycleDays = 45, healthRate = 0) => ({
    harvest_quality: 100,
    stress_factor: (1 - growthRate) * 100,
    growth_rate: growthRate,
    health_rate: healthRate,
    cycle_days: cycleDays,
    estimated_days_to_harvest: 45,
    risk_level: "low",
    status: "stable",
    explanation: "All inputs near optimal",
    source: "engine",
  });

  /** Click and let React's scheduler flush — under fake timers it otherwise never does. */
  const click = async (name: RegExp | string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  /** Plant lettuce in shelf 0 so a prediction is fetched. Single-crop session: clicking an
   *  empty planter plants the active crop directly (lettuce is the default), no crop picker. */
  const plantLettuce = async () => {
    await click(/crop1, empty/i);
  };

  const tick = async (times: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000 * times);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances the clock by SIM_HOURS_PER_TICK (6) simulated hours per tick", async () => {
    renderDashboard();
    await click(/simulate/i);
    await tick(1);
    expect(screen.getByText(/6 hours/i)).toBeInTheDocument();
  });

  it("grows an unstressed lettuce at the crop's cycle rate", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(1.0) });
    renderDashboard();
    await plantLettuce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });

    await click(/simulate/i);
    await tick(10);

    // perTick = (100 * 6) / (45 * 24) = 0.5555…%  →  10 ticks = 5.55%, floored to 5.
    // Lettuce's stage thresholds put 5% just past Seed (<5) into Cotyledon.
    expect(screen.getByText(/Cotyledon \(5%\)/i)).toBeInTheDocument();
  });

  it("grows a stressed plant more slowly than an unstressed one", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.5) });
    renderDashboard();
    await plantLettuce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });

    await click(/simulate/i);
    await tick(20);

    // Half the rate → 20 × 0.2777% = 5.55%, floored to 5. Deliberately 20 ticks, not 10:
    // at 10 ticks this lands on 2%, which the old flat 0.2%/tick code also produced.
    expect(screen.getByText(/Cotyledon \(5%\)/i)).toBeInTheDocument();
  });

  it("does not grow a plant at growth_rate 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.0) });
    renderDashboard();
    await plantLettuce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });

    await click(/simulate/i);
    await tick(20);

    expect(screen.getByText(/Seed \(0%\)/i)).toBeInTheDocument();
  });

  it("freezes growth when the backend gives no prediction", async () => {
    // Default beforeEach mock is { ok: false }, so `prediction` stays null. The bar must
    // not advance at some invented rate — a backend outage should be visible, not silent.
    renderDashboard();
    await click(/simulate/i);
    await tick(20);

    expect(screen.getByText(/Seedling \(0%\)/i)).toBeInTheDocument();
    // …but the clock keeps running, so the freeze is distinguishable from a stalled timer.
    expect(screen.getByText(/120 hours/i)).toBeInTheDocument();
  });

  it("starts at full health", () => {
    renderDashboard();
    expect(screen.getByText(/Health 100%/i)).toBeInTheDocument();
  });

  it("loses health over time under a negative health rate", async () => {
    // -0.01/sim-hour × 6 h/tick = -0.06/tick → 10 ticks ≈ -0.6 → ~40% health.
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.5, 45, -0.01) });
    renderDashboard();
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });

    await click(/simulate/i);
    await tick(10);

    expect(screen.getByText(/Health 40%/i)).toBeInTheDocument();
  });

  it("dies when health reaches 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.2, 45, -0.05) });
    renderDashboard();
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });

    await click(/simulate/i);
    await tick(60);   // far more than enough to drive health past 0

    expect(screen.getByText(/DEAD/i)).toBeInTheDocument();
  });

  it("stays dead even when conditions are restored (death is irreversible)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.2, 45, -0.05) });
    renderDashboard();
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });
    await click(/simulate/i);
    await tick(60);
    expect(screen.getByText(/DEAD/i)).toBeInTheDocument();

    // Backend now reports perfect conditions with full recovery; a slider move forces the refetch.
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(1.0, 45, 0.05) });
    await act(async () => {
      fireEvent.change(screen.getByRole("slider", { name: /acidity/i }), { target: { value: "6" } });
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });
    await tick(30);

    expect(screen.getByText(/DEAD/i)).toBeInTheDocument();   // no resurrection
  });

  it("reset brings a dead plant back to full health", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.2, 45, -0.05) });
    renderDashboard();
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });
    await click(/simulate/i);
    await tick(60);
    expect(screen.getByText(/DEAD/i)).toBeInTheDocument();

    await click(/reset simulation/i);
    expect(screen.getByText(/Health 100%/i)).toBeInTheDocument();
    expect(screen.queryByText(/DEAD/i)).not.toBeInTheDocument();
  });

  it("accumulated damage suppresses growth — a sick plant grows slower than a healthy one", async () => {
    // Both have growth_rate 1.0, but the damaged plant's health has decayed, so its growth
    // (perTick × rate × health) falls behind. This is the memory the whole change is for.
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(1.0, 45, -0.03) });
    renderDashboard();
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });

    await click(/simulate/i);
    await tick(10);

    // Healthy (health=1) would reach 5% (Cotyledon) in 10 ticks; with health bleeding down it
    // stays strictly less, i.e. still within the Seed stage (<5%).
    expect(screen.queryByText(/Cotyledon \(5%\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Seed \([0-3]%\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Per-row independence & growth charts
// A session is single-crop now (all rows hold the crop picked in the Crop Type
// selector), but each row is still its OWN simulation — rows planted at different
// times must not share one global growth number. Changing the crop re-plants every
// row and resets the run; the header Reset zeroes the clock and all rows.
// ---------------------------------------------------------------------------
describe("DashboardPage - per-row independence & growth charts", () => {
  const PREDICT_DEBOUNCE_MS = 300;

  const predictionBody = (growthRate: number, cycleDays = 45, healthRate = 0) => ({
    harvest_quality: 100,
    stress_factor: (1 - growthRate) * 100,
    growth_rate: growthRate,
    health_rate: healthRate,
    cycle_days: cycleDays,
    estimated_days_to_harvest: 45,
    risk_level: "low",
    status: "stable",
    explanation: "All inputs near optimal",
    source: "engine",
  });

  /** Routes the mocked fetch response by the request's crop_type, so two rows
   *  planted with different crops get different growth/cycle behavior. */
  const mockFetchByCrop = (byCropType: Record<string, ReturnType<typeof predictionBody>>) => {
    global.fetch = vi.fn((_url: unknown, opts: unknown) => {
      const body = JSON.parse((opts as RequestInit).body as string);
      const resp = byCropType[body.crop_type];
      return Promise.resolve({ ok: !!resp, json: async () => resp ?? {} });
    }) as unknown as typeof fetch;
  };

  const click = async (name: RegExp | string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  const tick = async (times: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000 * times);
    });
  };

  const settle = async () => {
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });
  };

  /** Plants the session crop (lettuce by default) into row 0 (crop1-3) and row 1 (crop4-6).
   *  Single-crop session: clicking an empty planter plants the active crop — no per-row picker. */
  const plantTwoRows = async () => {
    await click(/crop1, empty/i);
    await click(/crop4, empty/i);
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("each planted row tracks its own growth (rows are independent)", async () => {
    // Same crop in both rows now, so to observe independence we plant them at different
    // times: row 0 runs first, then (paused) row 1 is planted and both run together, so
    // row 1 stays strictly behind. A single shared growth number could not show this.
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(1.0, 45) });
    renderDashboard();

    await click(/crop1, empty/i);      // plant row 0 (lettuce)
    await settle();
    await click(/simulate/i);
    await tick(10);                    // row 0 → 5.55% → 5%

    await click(/pause/i);             // planting is blocked while running — pause first
    await click(/crop4, empty/i);      // plant row 1 (starts now); also selects row 1
    await settle();
    await click(/simulate/i);
    await tick(10);                    // row 0 keeps growing; row 1 grows from 0

    // Row 1 is active (planting it selected it) and lags because it started 10 ticks late.
    // Match any lettuce growth-stage label — row 0 may have crossed into a later stage.
    const stagePct = /(?:Seed|Cotyledon|Seedling|Rosette|Cupping|Heading) \(\d+%\)/i;
    const pct = (t: string | null) => Number(t?.match(/\((\d+)%\)/)?.[1] ?? -1);
    const row1Pct = pct(screen.getByText(stagePct).textContent);

    // Switch to row 0 — it must be strictly further along, proving the two rows don't
    // share one global growth number (a shared number would read identically here).
    await click(/crop1, lettuce/i);
    const row0Pct = pct(screen.getByText(stagePct).textContent);

    expect(row0Pct).toBeGreaterThan(row1Pct);
  });

  it("changing the crop re-plants every row to the new crop and resets the run", async () => {
    // Single-crop session: switching the Crop Type selector re-plants ALL occupied rows to
    // the new crop and resets the run (a different plant), replacing the old per-row picker.
    mockFetchByCrop({
      lettuce: predictionBody(1.0, 45),
      tomatoes: predictionBody(1.0, 120),
    });
    renderDashboard();
    await plantTwoRows();              // both rows lettuce
    await settle();

    await click(/simulate/i);
    await tick(10);
    expect(screen.getByText(/60 hours/i)).toBeInTheDocument();

    // Pause first — the Crop Type selector is disabled while running.
    await click(/pause/i);
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: /crop type/i }), { target: { value: "tomatoes" } });
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });

    // Run reset (clock zeroed) and every row now holds tomato.
    expect(screen.getByText(/0 hours/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crop1, tomato/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crop4, tomato/i })).toBeInTheDocument();
  });

  it("the header Reset button still resets the clock and every row", async () => {
    mockFetchByCrop({
      lettuce: predictionBody(1.0, 45),
      tomatoes: predictionBody(1.0, 120),
    });
    renderDashboard();
    await plantTwoRows();              // both rows lettuce (the session crop)
    await settle();

    await click(/simulate/i);
    await tick(10);
    expect(screen.getByText(/60 hours/i)).toBeInTheDocument();

    await click(/reset simulation/i);

    expect(screen.getByText(/0 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Seed \(0%\)/i)).toBeInTheDocument(); // active row
    await click(/crop1, lettuce/i);
    expect(screen.getByText(/Seed \(0%\)/i)).toBeInTheDocument(); // row 0 too
  });

  it("shows a View Chart button once a row is planted, not before", async () => {
    // The chart itself now lives on its own page (/dashboard/simulation) — see
    // simulation/page.test.tsx. Here we only check the dashboard's entry point to it.
    renderDashboard();
    expect(screen.queryByRole("button", { name: /view chart/i })).not.toBeInTheDocument();

    await click(/crop1, empty/i);      // plant the session crop

    expect(screen.getByRole("button", { name: /view chart/i })).toBeInTheDocument();
  });

  it("clicking View Chart navigates to /dashboard/simulation", async () => {
    renderDashboard();
    await click(/crop1, empty/i);      // plant the session crop

    await click(/view chart/i);

    expect(mockPush).toHaveBeenCalledWith('/dashboard/simulation');
  });
});

// ---------------------------------------------------------------------------
// Compare Scenarios (issue #10) — rendered by the "Dashboard" nav tab. We seed the store
// directly (localStorage) so we can exercise the grid/compare UI without running a sim.
// ---------------------------------------------------------------------------
describe("DashboardPage - Compare Scenarios", () => {
  type SeedArgs = { id: string; label: string; yield: number; stress: number; ph: number; at: number };
  const makeScenario = (a: SeedArgs) => ({
    id: a.id, createdAt: a.at, label: a.label,
    cropId: "lettuce", cropName: "Lettuce", systemId: "nft", systemName: "NFT",
    finalSettings: { ph: a.ph, temp: 20, humidity: 60, co2: 800 },
    metrics: {
      finalYieldRaw: a.yield, finalYieldDisplayed: a.yield, finalHealth: 100,
      avgStress: a.stress, timeToHarvestDays: 30, timeOutOfRangeHours: 0, durationHours: 120,
      envAvg: { ph: a.ph, temp: 20, humidity: 60, co2: 800 },
    },
  });

  const clickBtn = async (name: RegExp) => {
    await act(async () => { fireEvent.click(screen.getByRole("button", { name })); });
  };

  it("lists saved scenarios and compares two side by side with distinct metrics", async () => {
    localStorage.setItem("hydrosim.scenarios", JSON.stringify([
      makeScenario({ id: "s1", label: "Scenario 1", yield: 82, stress: 12, ph: 6.0, at: 1 }),
      makeScenario({ id: "s2", label: "Scenario 2", yield: 74, stress: 21, ph: 5.5, at: 2 }),
    ]));
    renderDashboard();

    await clickBtn(/^dashboard$/i);            // switch to the repurposed Dashboard tab
    expect(screen.getByText("Scenario 1")).toBeInTheDocument();
    expect(screen.getByText("Scenario 2")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /select Scenario 1/i }));
      fireEvent.click(screen.getByRole("checkbox", { name: /select Scenario 2/i }));
    });
    await clickBtn(/compare selected/i);

    expect(screen.getByText("Final yield")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();  // Scenario 1 displayed yield
    expect(screen.getByText("74%")).toBeInTheDocument();  // Scenario 2 displayed yield
    expect(screen.getByText("5.5")).toBeInTheDocument();  // Scenario 2's differing pH average
  });

  it("shows the Start new session card and disables Compare until 2 are selected", async () => {
    renderDashboard();
    await clickBtn(/^dashboard$/i);
    expect(screen.getByRole("button", { name: /start new session/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compare selected/i })).toBeDisabled();
  });
});
