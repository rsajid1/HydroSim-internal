/**
 * Tests for the standalone growth-chart page (/dashboard/simulation).
 *
 * Mirrors the mocking setup in ../page.test.tsx: next/navigation is stubbed (this
 * page only needs a working Link, not push, but the mock is harmless either way),
 * and global.fetch defaults to a failed response so tests opt in to a live backend
 * only when they need one.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import SimulationChartPage from "./page";
import DashboardPage from "../page";
import { SimulationProvider } from "../SimulationProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  localStorage.clear();
});

const renderChartPage = () => render(<SimulationProvider><SimulationChartPage /></SimulationProvider>);

describe("SimulationChartPage - initial render", () => {
  it("renders without crashing", () => {
    const { container } = renderChartPage();
    expect(container).not.toBeEmptyDOMElement();
  });

  it("shows a back link to /dashboard", () => {
    renderChartPage();
    const link = screen.getByRole("link", { name: /back to dashboard/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("shows all three row-switcher options", () => {
    renderChartPage();
    expect(screen.getByRole("button", { name: /top row/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /middle row/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bottom row/i })).toBeInTheDocument();
  });

  it("shows an empty-state message when the active row has nothing planted", () => {
    renderChartPage();
    expect(screen.getByText(/nothing planted in top row/i)).toBeInTheDocument();
  });

  it("switching rows updates the empty-state message to match", () => {
    renderChartPage();
    fireEvent.click(screen.getByRole("button", { name: /middle row/i }));
    expect(screen.getByText(/nothing planted in middle row/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Cross-page: the simulation keeps ticking while "on" the chart page
// This is the core claim behind moving the chart to its own route — the tick
// loop lives in SimulationProvider (app/dashboard/layout.tsx wraps both routes
// in one instance), so it must not reset or pause when the rendered page swaps.
// ---------------------------------------------------------------------------
describe("Cross-page live simulation", () => {
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

  const click = async (name: RegExp | string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  const tick = async (times: number) => {
    await act(async () => { await vi.advanceTimersByTimeAsync(1000 * times); });
  };

  const settle = async () => {
    await act(async () => { await vi.advanceTimersByTimeAsync(PREDICT_DEBOUNCE_MS); });
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("growth keeps advancing after swapping from the dashboard to the chart page under one provider", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => predictionBody(1.0, 45) });

    // A tiny harness renders both pages under ONE shared SimulationProvider instance
    // and toggles which one is mounted — this is exactly what app/dashboard/layout.tsx
    // + Next's router produce when navigating between /dashboard and
    // /dashboard/simulation: the provider is never unmounted, only its child swaps.
    function Harness({ showChart }: { showChart: boolean }) {
      return (
        <SimulationProvider>
          {showChart ? <SimulationChartPage /> : <DashboardPage />}
        </SimulationProvider>
      );
    }

    const { rerender } = render(<Harness showChart={false} />);

    // Single-crop session: clicking an empty planter plants the active crop (lettuce by default).
    await click(/crop1, empty/i);
    await settle();
    await click(/simulate/i);
    await tick(5);

    const growthAtSwap = screen.getByText(/Seedling \(\d+%\)/i).textContent;

    // Swap to the chart page — same provider tree, so the tick-loop's useEffect
    // (inside SimulationProvider) is never torn down.
    rerender(<Harness showChart={true} />);

    await tick(10);

    // Row 0 is the default active row on both pages, so the chart page's own status
    // line reflects the same row and should show strictly more growth than at the
    // moment of the swap — proving ticking continued while the chart page was mounted.
    const growthAfter = screen.getByText(/Seedling \(\d+%\)/i).textContent;
    expect(growthAfter).not.toEqual(growthAtSwap);

    const growthPercent = (text: string | null) => Number(text?.match(/\((\d+)%\)/)?.[1] ?? -1);
    expect(growthPercent(growthAfter)).toBeGreaterThan(growthPercent(growthAtSwap));
  });
});
