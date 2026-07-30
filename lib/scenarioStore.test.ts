import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageScenarioStore } from "@/lib/scenarioStore";
import type { Scenario } from "@/lib/scenarioMetrics";

const scenario = (id: string, createdAt: number, label = id): Scenario => ({
  id,
  createdAt,
  label,
  cropId: "lettuce",
  cropName: "Lettuce",
  systemId: "nft",
  systemName: "NFT",
  finalSettings: { ph: 6, temp: 20, humidity: 60, co2: 800 },
  metrics: {
    finalYieldRaw: 80,
    finalYieldDisplayed: 80,
    finalHealth: 100,
    avgStress: 5,
    timeToHarvestDays: 30,
    timeOutOfRangeHours: 0,
    durationHours: 120,
    envAvg: { ph: 6, temp: 20, humidity: 60, co2: 800 },
  },
});

describe("LocalStorageScenarioStore", () => {
  let store: LocalStorageScenarioStore;

  beforeEach(() => {
    window.localStorage.clear();
    store = new LocalStorageScenarioStore();
  });

  it("returns an empty list before anything is saved", () => {
    expect(store.list()).toEqual([]);
  });

  it("saves and lists scenarios newest first", () => {
    store.save(scenario("a", 100));
    store.save(scenario("b", 300));
    store.save(scenario("c", 200));
    expect(store.list().map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("upserts by id rather than duplicating", () => {
    store.save(scenario("a", 100, "first"));
    store.save(scenario("a", 100, "second"));
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("second");
  });

  it("removes by id", () => {
    store.save(scenario("a", 100));
    store.save(scenario("b", 200));
    store.remove("a");
    expect(store.list().map((s) => s.id)).toEqual(["b"]);
  });

  it("renames by id and leaves others untouched", () => {
    store.save(scenario("a", 100, "old"));
    store.save(scenario("b", 200, "keep"));
    store.rename("a", "new");
    const byId = Object.fromEntries(store.list().map((s) => [s.id, s.label]));
    expect(byId).toEqual({ a: "new", b: "keep" });
  });

  it("treats corrupt stored JSON as an empty list", () => {
    window.localStorage.setItem("hydrosim.scenarios", "not json{");
    expect(store.list()).toEqual([]);
  });

  it("persists across store instances (same localStorage)", () => {
    store.save(scenario("a", 100));
    const fresh = new LocalStorageScenarioStore();
    expect(fresh.list().map((s) => s.id)).toEqual(["a"]);
  });
});