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

/** A System Log warning/critical entry, as raised for a single tick. */
export interface ScenarioWarning {
  type: 'critical' | 'warning';
  msg: string;
}

/** Per-tick input: the live environment, the active row's engine stress, its growth-stage label,
 *  and any System Log entries raised that tick. */
export interface ScenarioSample {
  params: EnvParams;
  stressFactor: number; // engine stress_factor, 0-100
  stageLabel: string;   // active row's growth stage at this tick (getGrowthLabel())
  alerts: ScenarioWarning[]; // this tick's System Log entries, if any
}

/** Running totals accumulated across a run; averages/totals/min/max are derived in finalize(). */
export interface ScenarioAccumulator {
  ticks: number;
  sumPh: number;
  sumTemp: number;
  sumHumidity: number;
  sumCo2: number;
  sumStress: number;
  outOfRangeTicks: number;
  minPh: number; maxPh: number;
  minTemp: number; maxTemp: number;
  minHumidity: number; maxHumidity: number;
  minCo2: number; maxCo2: number;
  /** Ticks spent in each growth-stage label — converted to hours in finalize(). */
  stageTicks: Record<string, number>;
  /** Distinct warning messages seen, with how many ticks each was raised on. */
  warningCounts: Record<string, { type: 'critical' | 'warning'; count: number }>;
}

/** Inputs known only at save time (final row state + clock). */
export interface ScenarioFinalState {
  harvestQuality: number;  // engine harvest_quality, 0-100 (raw, undiscounted)
  health: number;          // active row plant health, 0-1
  timeToHarvestDays: number;
  durationHours: number;   // simulationTime at save
  simHoursPerTick: number; // converts out-of-range ticks -> sim-hours
}

/** A distinct warning message from the run, with how long it was raised for. */
export interface ScenarioWarningSummary extends ScenarioWarning {
  hours: number; // sim-hours this message was active (ticks × simHoursPerTick)
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
  envMin: EnvParams;           // min of params over ticks
  envMax: EnvParams;           // max of params over ticks
  /** Sim-hours spent in each growth stage, keyed by stage label (e.g. "Seedling"). */
  stageHours: Record<string, number>;
  /** Major warnings from the run, longest-active first, capped to the top 5. */
  warnings: ScenarioWarningSummary[];
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
  return {
    ticks: 0, sumPh: 0, sumTemp: 0, sumHumidity: 0, sumCo2: 0, sumStress: 0, outOfRangeTicks: 0,
    minPh: Infinity, maxPh: -Infinity,
    minTemp: Infinity, maxTemp: -Infinity,
    minHumidity: Infinity, maxHumidity: -Infinity,
    minCo2: Infinity, maxCo2: -Infinity,
    stageTicks: {},
    warningCounts: {},
  };
}

/** Fold one tick's sample into the accumulator (mutates it and returns it for convenience). */
export function accumulate(acc: ScenarioAccumulator, sample: ScenarioSample): ScenarioAccumulator {
  acc.ticks += 1;
  const { ph, temp, humidity, co2 } = sample.params;
  acc.sumPh += ph;
  acc.sumTemp += temp;
  acc.sumHumidity += humidity;
  acc.sumCo2 += co2;
  acc.sumStress += sample.stressFactor;
  if (sample.stressFactor > OUT_OF_RANGE_STRESS_THRESHOLD) acc.outOfRangeTicks += 1;

  acc.minPh = Math.min(acc.minPh, ph); acc.maxPh = Math.max(acc.maxPh, ph);
  acc.minTemp = Math.min(acc.minTemp, temp); acc.maxTemp = Math.max(acc.maxTemp, temp);
  acc.minHumidity = Math.min(acc.minHumidity, humidity); acc.maxHumidity = Math.max(acc.maxHumidity, humidity);
  acc.minCo2 = Math.min(acc.minCo2, co2); acc.maxCo2 = Math.max(acc.maxCo2, co2);

  acc.stageTicks[sample.stageLabel] = (acc.stageTicks[sample.stageLabel] ?? 0) + 1;

  for (const alert of sample.alerts) {
    const existing = acc.warningCounts[alert.msg];
    acc.warningCounts[alert.msg] = { type: alert.type, count: (existing?.count ?? 0) + 1 };
  }

  return acc;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function finalize(acc: ScenarioAccumulator, final: ScenarioFinalState): ScenarioMetrics {
  const n = acc.ticks;
  const mean = (sum: number): number => (n > 0 ? sum / n : 0);
  const minmax = (v: number): number => (n > 0 ? v : 0); // no ticks -> Infinity/-Infinity sentinels unused
  const health = Math.max(0, Math.min(1, final.health));

  const stageHours: Record<string, number> = {};
  for (const [stage, ticks] of Object.entries(acc.stageTicks)) {
    stageHours[stage] = round1(ticks * final.simHoursPerTick);
  }

  const warnings: ScenarioWarningSummary[] = Object.entries(acc.warningCounts)
    .map(([msg, { type, count }]) => ({ type, msg, hours: round1(count * final.simHoursPerTick) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

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
    envMin: {
      ph: round1(minmax(acc.minPh)),
      temp: round1(minmax(acc.minTemp)),
      humidity: round1(minmax(acc.minHumidity)),
      co2: Math.round(minmax(acc.minCo2)),
    },
    envMax: {
      ph: round1(minmax(acc.maxPh)),
      temp: round1(minmax(acc.maxTemp)),
      humidity: round1(minmax(acc.maxHumidity)),
      co2: Math.round(minmax(acc.maxCo2)),
    },
    stageHours,
    warnings,
  };
}