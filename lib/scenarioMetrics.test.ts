import { describe, it, expect } from "vitest";
import {
  createAccumulator,
  accumulate,
  finalize,
  OUT_OF_RANGE_STRESS_THRESHOLD,
  type ScenarioSample,
  type ScenarioFinalState,
  type ScenarioWarning,
} from "@/lib/scenarioMetrics";

const sample = (
  stressFactor: number,
  params = { ph: 6.0, temp: 20, humidity: 60, co2: 800 },
  stageLabel = "Seedling",
  alerts: ScenarioWarning[] = [],
): ScenarioSample => ({ params, stressFactor, stageLabel, alerts });

const FINAL: ScenarioFinalState = {
  harvestQuality: 80,
  health: 1,
  timeToHarvestDays: 30,
  durationHours: 120,
  simHoursPerTick: 6,
};

describe("createAccumulator", () => {
  it("starts at all zeros", () => {
    expect(createAccumulator()).toEqual({
      ticks: 0, sumPh: 0, sumTemp: 0, sumHumidity: 0, sumCo2: 0, sumStress: 0, outOfRangeTicks: 0,
      minPh: Infinity, maxPh: -Infinity,
      minTemp: Infinity, maxTemp: -Infinity,
      minHumidity: Infinity, maxHumidity: -Infinity,
      minCo2: Infinity, maxCo2: -Infinity,
      stageTicks: {}, warningCounts: {},
    });
  });
});

describe("accumulate", () => {
  it("sums each field and counts ticks", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(10, { ph: 6, temp: 20, humidity: 60, co2: 800 }));
    accumulate(acc, sample(20, { ph: 5, temp: 22, humidity: 50, co2: 900 }));
    expect(acc.ticks).toBe(2);
    expect(acc.sumPh).toBe(11);
    expect(acc.sumTemp).toBe(42);
    expect(acc.sumHumidity).toBe(110);
    expect(acc.sumCo2).toBe(1700);
    expect(acc.sumStress).toBe(30);
  });

  it("counts a tick as out of range only when stress strictly exceeds the threshold", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(OUT_OF_RANGE_STRESS_THRESHOLD));       // exactly at threshold -> not counted
    accumulate(acc, sample(OUT_OF_RANGE_STRESS_THRESHOLD + 0.1)); // just over -> counted
    accumulate(acc, sample(50));                                  // well over -> counted
    expect(acc.outOfRangeTicks).toBe(2);
  });
});

describe("finalize", () => {
  it("averages the environment and stress over the accumulated ticks", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(10, { ph: 6.0, temp: 20, humidity: 60, co2: 800 }));
    accumulate(acc, sample(30, { ph: 5.0, temp: 24, humidity: 70, co2: 900 }));
    const m = finalize(acc, FINAL);
    expect(m.avgStress).toBe(20);
    expect(m.envAvg).toEqual({ ph: 5.5, temp: 22, humidity: 65, co2: 850 });
  });

  it("discounts displayed yield by the square root of health", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(0));
    const m = finalize(acc, { ...FINAL, harvestQuality: 100, health: 0.25 });
    expect(m.finalYieldRaw).toBe(100);
    expect(m.finalYieldDisplayed).toBe(50); // 100 × √0.25
    expect(m.finalHealth).toBe(25);
  });

  it("converts out-of-range ticks to sim-hours", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(50)); // out of range
    accumulate(acc, sample(0));  // in range
    accumulate(acc, sample(80)); // out of range
    const m = finalize(acc, FINAL); // simHoursPerTick 6
    expect(m.timeOutOfRangeHours).toBe(12);
  });

  it("passes through the final-state clock values", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(0));
    const m = finalize(acc, { ...FINAL, timeToHarvestDays: 31, durationHours: 96 });
    expect(m.timeToHarvestDays).toBe(31);
    expect(m.durationHours).toBe(96);
  });

  it("never divides by zero on an empty run (no ticks)", () => {
    const m = finalize(createAccumulator(), FINAL);
    expect(m.avgStress).toBe(0);
    expect(m.envAvg).toEqual({ ph: 0, temp: 0, humidity: 0, co2: 0 });
    expect(m.timeOutOfRangeHours).toBe(0);
    expect(m.finalYieldRaw).toBe(80); // final-state values still flow through
  });

  it("clamps health into [0,1] before discounting", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(0));
    const over = finalize(acc, { ...FINAL, harvestQuality: 100, health: 1.5 });
    expect(over.finalHealth).toBe(100);
    expect(over.finalYieldDisplayed).toBe(100);
  });

  it("tracks min/max per environment field across the run", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(0, { ph: 6.0, temp: 18, humidity: 55, co2: 700 }));
    accumulate(acc, sample(0, { ph: 5.2, temp: 24, humidity: 70, co2: 900 }));
    accumulate(acc, sample(0, { ph: 6.4, temp: 20, humidity: 60, co2: 800 }));
    const m = finalize(acc, FINAL);
    expect(m.envMin).toEqual({ ph: 5.2, temp: 18, humidity: 55, co2: 700 });
    expect(m.envMax).toEqual({ ph: 6.4, temp: 24, humidity: 70, co2: 900 });
  });

  it("reports zeroed min/max on an empty run rather than Infinity sentinels", () => {
    const m = finalize(createAccumulator(), FINAL);
    expect(m.envMin).toEqual({ ph: 0, temp: 0, humidity: 0, co2: 0 });
    expect(m.envMax).toEqual({ ph: 0, temp: 0, humidity: 0, co2: 0 });
  });

  it("converts per-stage ticks into sim-hours for the stage timeline", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(0, undefined, "Seedling"));
    accumulate(acc, sample(0, undefined, "Seedling"));
    accumulate(acc, sample(0, undefined, "Vegetative"));
    const m = finalize(acc, FINAL); // simHoursPerTick 6
    expect(m.stageHours).toEqual({ Seedling: 12, Vegetative: 6 });
  });

  it("aggregates warnings by message, converts to hours, and caps at the top 5 longest-active", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(0, undefined, "Seedling", [{ type: "warning", msg: "pH off-target" }]));
    accumulate(acc, sample(0, undefined, "Seedling", [{ type: "warning", msg: "pH off-target" }]));
    accumulate(acc, sample(0, undefined, "Seedling", [{ type: "critical", msg: "Temperature critical" }]));
    const m = finalize(acc, FINAL); // simHoursPerTick 6
    expect(m.warnings).toEqual([
      { type: "warning", msg: "pH off-target", hours: 12 },
      { type: "critical", msg: "Temperature critical", hours: 6 },
    ]);
  });

  it("returns no warnings when the run had none", () => {
    const acc = createAccumulator();
    accumulate(acc, sample(0));
    const m = finalize(acc, FINAL);
    expect(m.warnings).toEqual([]);
  });
});