import { describe, it, expect } from "vitest";
import {
  createAccumulator,
  accumulate,
  finalize,
  OUT_OF_RANGE_STRESS_THRESHOLD,
  type ScenarioSample,
  type ScenarioFinalState,
} from "@/lib/scenarioMetrics";

const sample = (
  stressFactor: number,
  params = { ph: 6.0, temp: 20, humidity: 60, co2: 800 },
): ScenarioSample => ({ params, stressFactor });

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
});