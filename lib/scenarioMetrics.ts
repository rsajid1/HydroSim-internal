// Compare Scenarios (issue #10) — pure, framework-free data model + aggregation.
//
// No React/DOM here so the math is unit-testable in isolation. The provider feeds one sample per
// simulation tick via accumulate(), then calls finalize() at save time to produce the stored
// ScenarioMetrics. EC was removed from the simulation, so only four environment fields are tracked.

/** The four environment fields the simulation controls (mirrors the provider's SimulationParams). */
export interface EnvParams {
  ph: number;
  temp: number;
  humidity: number;
  co2: number;
}

/** Per-tick input: the live environment plus the active row's engine stress at that tick. */
export interface ScenarioSample {
  params: EnvParams;
  stressFactor: number; // engine stress_factor, 0-100
}

/** Running totals accumulated across a run; averages/totals are derived in finalize(). */
export interface ScenarioAccumulator {
  ticks: number;
  sumPh: number;
  sumTemp: number;
  sumHumidity: number;
  sumCo2: number;
  sumStress: number;
  outOfRangeTicks: number;
}

/** Inputs known only at save time (final row state + clock). */
export interface ScenarioFinalState {
  harvestQuality: number;  // engine harvest_quality, 0-100 (raw, undiscounted)
  health: number;          // active row plant health, 0-1
  timeToHarvestDays: number;
  durationHours: number;   // simulationTime at save
  simHoursPerTick: number; // converts out-of-range ticks -> sim-hours
}

export interface ScenarioMetrics {
  finalYieldRaw: number;       // harvest_quality
  finalYieldDisplayed: number; // raw × √health (matches the dashboard's discount)
  finalHealth: number;         // 0-100
  avgStress: number;           // mean stress_factor over ticks
  timeToHarvestDays: number;
  timeOutOfRangeHours: number; // sim-hours where stress exceeded the threshold
  durationHours: number;
  envAvg: EnvParams;           // mean of params over ticks
}

/** One saved run. finalSettings holds the slider values at save (the "what I set"). */
export interface Scenario {
  id: string;
  createdAt: number; // Date.now()
  label: string;     // "Scenario N", user-renameable
  cropId: string;
  cropName: string;
  systemId: string;
  systemName: string;
  finalSettings: EnvParams;
  metrics: ScenarioMetrics;
}

/** Stress above which a tick counts toward "time out of range". */
export const OUT_OF_RANGE_STRESS_THRESHOLD = 10;

export function createAccumulator(): ScenarioAccumulator {
  return { ticks: 0, sumPh: 0, sumTemp: 0, sumHumidity: 0, sumCo2: 0, sumStress: 0, outOfRangeTicks: 0 };
}

/** Fold one tick's sample into the accumulator (mutates it and returns it for convenience). */
export function accumulate(acc: ScenarioAccumulator, sample: ScenarioSample): ScenarioAccumulator {
  acc.ticks += 1;
  acc.sumPh += sample.params.ph;
  acc.sumTemp += sample.params.temp;
  acc.sumHumidity += sample.params.humidity;
  acc.sumCo2 += sample.params.co2;
  acc.sumStress += sample.stressFactor;
  if (sample.stressFactor > OUT_OF_RANGE_STRESS_THRESHOLD) acc.outOfRangeTicks += 1;
  return acc;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function finalize(acc: ScenarioAccumulator, final: ScenarioFinalState): ScenarioMetrics {
  const n = acc.ticks;
  const mean = (sum: number): number => (n > 0 ? sum / n : 0);
  const health = Math.max(0, Math.min(1, final.health));
  return {
    finalYieldRaw: round1(final.harvestQuality),
    finalYieldDisplayed: round1(final.harvestQuality * Math.sqrt(health)),
    finalHealth: round1(health * 100),
    avgStress: round1(mean(acc.sumStress)),
    timeToHarvestDays: round1(final.timeToHarvestDays),
    timeOutOfRangeHours: acc.outOfRangeTicks * final.simHoursPerTick,
    durationHours: final.durationHours,
    envAvg: {
      ph: round1(mean(acc.sumPh)),
      temp: round1(mean(acc.sumTemp)),
      humidity: round1(mean(acc.sumHumidity)),
      co2: Math.round(mean(acc.sumCo2)),
    },
  };
}