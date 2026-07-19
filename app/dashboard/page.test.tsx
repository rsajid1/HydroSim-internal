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

// ---------------------------------------------------------------------------
// Initial render
// Check that the page loads and all the key controls are visible and in the
// right default state before the user does anything.
// ---------------------------------------------------------------------------
describe("DashboardPage - initial render", () => {
  it("renders without crashing", () => {
    // Catches broken imports, missing providers, or bad JSX at mount time.
    const { container } = render(<DashboardPage />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it("Simulate button shows 'Simulate' on load, not 'Pause'", () => {
    // Simulation is idle on load — button shouldn't already say Pause.
    render(<DashboardPage />);
    const btn = screen.getByRole("button", { name: /simulate/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/simulate/i);
  });

  it("crop selector defaults to Lettuce", () => {
    // Lettuce is first in CROPS — page should never open with an empty selection.
    render(<DashboardPage />);
    const select = screen.getByRole("combobox", { name: /crop type/i }) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("lettuce");
  });

  it("crop selector has all four crops", () => {
    // Fails if someone accidentally removes a crop from the CROPS constant.
    render(<DashboardPage />);
    const select = screen.getByRole("combobox", { name: /crop type/i }) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["lettuce", "herbs", "tomatoes", "cucumbers"]);
  });

  it("system selector defaults to NFT", () => {
    // NFT is first in SYSTEMS and should be pre-selected on load.
    render(<DashboardPage />);
    const select = screen.getByRole("combobox", { name: /system architecture/i }) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("nft");
  });

  it("system selector offers the two modeled systems (NFT, DWC)", () => {
    // Only NFT and DWC are modeled by the engine; aeroponics/vertical were removed.
    render(<DashboardPage />);
    const select = screen.getByRole("combobox", { name: /system architecture/i }) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["nft", "dwc"]);
  });

  it("all four environment sliders are present", () => {
    // pH, EC, temperature, humidity — these are the parameters users tune.
    render(<DashboardPage />);
    expect(screen.getByRole("slider", { name: /acidity/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /nutrient/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /temperature/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /humidity/i })).toBeInTheDocument();
  });

  it("simulation time starts at 0 hours", () => {
    // simulationTime only increments once the user starts the simulation.
    render(<DashboardPage />);
    expect(screen.getByText(/0 hours/i)).toBeInTheDocument();
  });

  it("growth stage shows Seedling (0%) on load", () => {
    // growthStage starts at 0. We match the full "Seedling (0%)" string to
    // avoid false positives from other percentage values on the page
    // (humidity gauge, stress factor, etc. also render as "X%").
    render(<DashboardPage />);
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
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("clicking Pause switches the button back to Simulate", () => {
    render(<DashboardPage />);
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
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: /reset simulation/i })).toBeInTheDocument();
  });

  it("clicking Reset while running stops the simulation", () => {
    // Start it, confirm it's running, then reset and check it stopped.
    render(<DashboardPage />);
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
    render(<DashboardPage />);
    const select = screen.getByRole("combobox", { name: /crop type/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "tomatoes" } });
    expect(select.value).toBe("tomatoes");
  });

  it("changing crop mid-simulation stops the simulation", () => {
    // If simulation kept running after a crop change, growth stats would be
    // out of sync with the new crop's optimal targets.
    render(<DashboardPage />);
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
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("clicking logout redirects to /auth/login", () => {
    // A wrong route here means the user stays on the dashboard after logging out.
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(mockPush).toHaveBeenCalledWith("/auth/login");
  });

  it("clears access_token on logout", () => {
    // Primary auth credential — must be gone so the session can't be reused.
    localStorage.setItem("access_token", "fake-token");
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("clears id_token on logout", () => {
    // Carries identity claims (name, email). Should not linger after logout.
    localStorage.setItem("id_token", "fake-id-token");
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(localStorage.getItem("id_token")).toBeNull();
  });

  it("clears refresh_token on logout", () => {
    // Refresh token can silently renew access tokens — leaving it behind
    // would effectively keep the user logged in.
    localStorage.setItem("refresh_token", "fake-refresh");
    render(<DashboardPage />);
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

  /** Plant lettuce in shelf 0 so `hasPlantedCrop` is true and a prediction is fetched. */
  const plantLettuce = async () => {
    await click(/crop1, empty/i);
    // The dropdown entry's accessible name is "lettuceLettuce" — the <img alt> runs straight
    // into the label with no separator — so match on a substring, not the visible text.
    await click(/lettuce/i);
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
    render(<DashboardPage />);
    await click(/simulate/i);
    await tick(1);
    expect(screen.getByText(/6 hours/i)).toBeInTheDocument();
  });

  it("grows an unstressed lettuce at the crop's cycle rate", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(1.0) });
    render(<DashboardPage />);
    await plantLettuce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });

    await click(/simulate/i);
    await tick(10);

    // perTick = (100 * 6) / (45 * 24) = 0.5555…%  →  10 ticks = 5.55%, floored to 5.
    expect(screen.getByText(/Seedling \(5%\)/i)).toBeInTheDocument();
  });

  it("grows a stressed plant more slowly than an unstressed one", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.5) });
    render(<DashboardPage />);
    await plantLettuce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });

    await click(/simulate/i);
    await tick(20);

    // Half the rate → 20 × 0.2777% = 5.55%, floored to 5. Deliberately 20 ticks, not 10:
    // at 10 ticks this lands on 2%, which the old flat 0.2%/tick code also produced.
    expect(screen.getByText(/Seedling \(5%\)/i)).toBeInTheDocument();
  });

  it("does not grow a plant at growth_rate 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.0) });
    render(<DashboardPage />);
    await plantLettuce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS);
    });

    await click(/simulate/i);
    await tick(20);

    expect(screen.getByText(/Seedling \(0%\)/i)).toBeInTheDocument();
  });

  it("freezes growth when the backend gives no prediction", async () => {
    // Default beforeEach mock is { ok: false }, so `prediction` stays null. The bar must
    // not advance at some invented rate — a backend outage should be visible, not silent.
    render(<DashboardPage />);
    await click(/simulate/i);
    await tick(20);

    expect(screen.getByText(/Seedling \(0%\)/i)).toBeInTheDocument();
    // …but the clock keeps running, so the freeze is distinguishable from a stalled timer.
    expect(screen.getByText(/120 hours/i)).toBeInTheDocument();
  });

  it("starts at full health", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Health 100%/i)).toBeInTheDocument();
  });

  it("loses health over time under a negative health rate", async () => {
    // -0.01/sim-hour × 6 h/tick = -0.06/tick → 10 ticks ≈ -0.6 → ~40% health.
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.5, 45, -0.01) });
    render(<DashboardPage />);
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });

    await click(/simulate/i);
    await tick(10);

    expect(screen.getByText(/Health 40%/i)).toBeInTheDocument();
  });

  it("dies when health reaches 0", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.2, 45, -0.05) });
    render(<DashboardPage />);
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });

    await click(/simulate/i);
    await tick(60);   // far more than enough to drive health past 0

    expect(screen.getByText(/DEAD/i)).toBeInTheDocument();
  });

  it("stays dead even when conditions are restored (death is irreversible)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(0.2, 45, -0.05) });
    render(<DashboardPage />);
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
    render(<DashboardPage />);
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
    render(<DashboardPage />);
    await plantLettuce();
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });

    await click(/simulate/i);
    await tick(10);

    // Healthy (health=1) would reach 5% in 10 ticks; with health bleeding down it is strictly less.
    expect(screen.queryByText(/Seedling \(5%\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Seedling \([0-3]%\)/i)).toBeInTheDocument();
  });
});
