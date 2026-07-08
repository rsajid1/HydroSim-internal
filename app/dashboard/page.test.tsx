/**
 * Tests for the dashboard simulation controls (Issue #23).
 *
 * We mock two things:
 *   - next/navigation: jsdom doesn't have a router, so we stub it and spy on
 *     push() so the logout tests can check where it redirects.
 *   - global.fetch: no real backend in tests; the component falls back to
 *     local metrics when fetch fails, so this is fine.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("system selector has all four hydroponic systems", () => {
    // Same as above — guards against a system being accidentally dropped.
    render(<DashboardPage />);
    const select = screen.getByRole("combobox", { name: /system architecture/i }) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["nft", "dwc", "aeroponics", "vertical"]);
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
