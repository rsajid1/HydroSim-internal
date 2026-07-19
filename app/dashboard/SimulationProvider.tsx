'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { RowHistoryPoint } from './RowGrowthChart';

// --- TypeScript Interfaces ---

export interface OptimalConditions {
  ph: number;
  ec: number;
  temp: number;
  humidity: number;
  co2: number;
}

export interface Crop {
  id: string;
  name: string;
  optimal: OptimalConditions;
}

export interface System {
  id: string;
  name: string;
  description: string;
}

export interface SimulationParams {
  ph: number;
  ec: number;
  temp: number;
  humidity: number;
  co2: number;
}

export interface SimulationMetrics {
  yieldPrediction: number;
  stressLevel: number;
  waterLevel: number;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning';
  msg: string;
}

export interface Prediction {
  harvestQuality: number;
  stressFactor: number;
  growthRate: number;   // 0-1 speed multiplier from the engine; 1 = unstressed
  healthRate: number;   // signed per-sim-hour change in plant health; integrated over ticks
  cycleDays: number;    // full grow-cycle length for the crop
  timeToHarvest: number;
  riskLevel: string;
  explanation: string;
  stage: string | null;              // resolved growth stage the targets were scored against
  optimal: OptimalConditions | null; // stage-aware targets from the engine (drive the slider "Target")
  source: string;
}

export interface RowLabel {
  id: number;
  name: string;
}

// --- Constants ---

// Only NFT and DWC are modeled by the engine (their ids map to SYSTEM_TOLERANCE_FACTORS).
// DWC's reservoir buffers deviations; NFT is the baseline. Aeroponics/vertical are not modeled yet.
export const SYSTEMS: System[] = [
  { id: 'nft', name: 'Nutrient Film Technique (NFT)', description: 'Continuous flow of nutrient solution over roots.' },
  { id: 'dwc', name: 'Deep Water Culture (DWC)', description: 'Roots suspended in oxygenated nutrient solution.' },
];

// `optimal` MUST match the engine's CROP_PROFILES targets in backend/app/sim/engine.py —
// that engine is the single source of truth for scoring. If they drift, the UI's "Target"
// and Reset default land off the engine's optimum, so a user sitting exactly on target still
// reads phantom stress. (tomato air_temperature_c is 25.0 in the engine, not 26.)
export const CROPS: Crop[] = [
  { id: 'lettuce', name: 'Lettuce', optimal: { ph: 6.0, ec: 1.2, temp: 20, humidity: 60, co2: 800 } },
  { id: 'tomatoes', name: 'Tomatoes', optimal: { ph: 6.0, ec: 2.5, temp: 25, humidity: 70, co2: 900 } },
];

// Backend base URL (reused from the DB panel's fetch pattern).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

// Debounce for the live prediction fetch — coalesces rapid slider drags into one request.
const PREDICT_DEBOUNCE_MS = 300;

// Simulated hours advanced per 1-second tick. Growth is derived from this and the crop's
// cycle length, so the clock and the growth bar share one time base. At 6 h/tick a healthy
// lettuce (45-day cycle) fills in ~3 real minutes and a tomato (120-day) in ~8.
const SIM_HOURS_PER_TICK = 6;

// UI crop ids that have rows in the local synthetic dataset. Others fall back to
// the client-side calculation (the backend returns 404 for them).
const PREDICTABLE_CROPS = new Set(['lettuce', 'tomatoes']);

// Maps a planted slot's crop id to the CROPS list's id (the planter uses singular
// 'tomato', CROPS/the backend use plural 'tomatoes').
const PLANT_TO_CROP_ID: Record<'lettuce' | 'tomato', string> = { lettuce: 'lettuce', tomato: 'tomatoes' };

// Cap on retained history points per row. A full tomato cycle (~120 days) at 6
// sim-hours/tick is ~480 ticks, so this covers a full cycle without trimming in the
// common case while bounding memory if a run is left going past harvest.
const HISTORY_CAP = 500;

export const ROWS: RowLabel[] = [
  { id: 0, name: 'Top Row' },
  { id: 1, name: 'Middle Row' },
  { id: 2, name: 'Bottom Row' },
];

// --- Context ---

interface SimulationContextValue {
  activeSystem: System;
  setActiveSystem: (system: System) => void;
  activeCrop: Crop;
  setActiveCrop: (crop: Crop) => void;
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  simulationTime: number;

  growthStageByRow: Record<number, number>;
  healthByRow: Record<number, number>;
  plantDeadByRow: Record<number, boolean>;
  alerts: Alert[];

  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  metrics: SimulationMetrics;

  predictionByRow: Record<number, Prediction | null>;
  historyByRow: Record<number, RowHistoryPoint[]>;

  activeRow: number;
  setActiveRow: (row: number) => void;
  plants: ('empty' | 'lettuce' | 'tomato')[];
  rows: RowLabel[];

  rowCrop: (row: number) => Crop | null;
  rowOccupancy: (row: number) => number;
  getGrowthLabel: (stage: number) => string;
  resetRow: (row: number) => void;
  handleReset: () => void;
  /** Plants `crop` into `row` (all 3 slots). Returns whether this replaced a
   *  DIFFERENT crop already planted there (in which case the row was reset) —
   *  callers use this to decide what confirmation message to show. */
  assignCrop: (crop: 'lettuce' | 'tomato', row: number) => { changed: boolean };
}

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined);

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return ctx;
}

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  // -- State Management --
  const [activeSystem, setActiveSystem] = useState<System>(SYSTEMS[0]);
  const [activeCrop, setActiveCrop] = useState<Crop>(CROPS[0]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simulationTime, setSimulationTime] = useState<number>(0); // In simulated hours, shared clock for the whole planter

  // Per-row plant lifecycle state — each row is independently simulated from its own
  // planted crop (see `plants` below), keyed 0/1/2. The environment (`params`) stays
  // shared/global across rows; only growth/health/prediction are per-row.
  const [growthStageByRow, setGrowthStageByRow] = useState<Record<number, number>>({ 0: 0, 1: 0, 2: 0 }); // 0 to 100%
  const [healthByRow, setHealthByRow] = useState<Record<number, number>>({ 0: 1, 1: 1, 2: 1 }); // plant vigor 0-1
  const [plantDeadByRow, setPlantDeadByRow] = useState<Record<number, boolean>>({ 0: false, 1: false, 2: false }); // absorbing state
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Environmental Parameters (State + Controls).
  // Seeded from CROPS[0] (lettuce) crop-level optima as an immediate, backend-independent
  // fallback; seedParamsFromEngine() then snaps these to the seedling-stage optima once the
  // engine responds, so a fresh crop opens unstressed (~100% health) instead of at the old
  // off-target 22 °C / 400 ppm defaults.
  const [params, setParams] = useState<SimulationParams>({
    ph: CROPS[0].optimal.ph,
    ec: CROPS[0].optimal.ec,
    temp: CROPS[0].optimal.temp,
    humidity: CROPS[0].optimal.humidity,
    co2: CROPS[0].optimal.co2,
  });

  // Derived Metrics (Simulated Physics)
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    yieldPrediction: 95, // %
    stressLevel: 0, // %
    waterLevel: 100, // %
  });

  // AI prediction from the backend (POST /api/sim/predict), per row. Null when the
  // backend is unreachable or the row's crop has no dataset — the AI card then falls
  // back to `metrics` for the active row.
  const [predictionByRow, setPredictionByRow] = useState<Record<number, Prediction | null>>({ 0: null, 1: null, 2: null });

  // Time-series buffer per row, feeding the RowGrowthChart. One point pushed per tick
  // per occupied row; capped at HISTORY_CAP.
  const [historyByRow, setHistoryByRow] = useState<Record<number, RowHistoryPoint[]>>({ 0: [], 1: [], 2: [] });

  // Garden planter state — a single 3x3 planter; each row is independently assignable.
  const [activeRow, setActiveRow] = useState<number>(0);
  const [plants, setPlants] = useState<('empty' | 'lettuce' | 'tomato')[]>(Array(9).fill('empty'));

  // -- Physics Engine --
  const calculatePhysics = () => {
    const optimal = activeCrop.optimal;
    let totalStress = 0;
    const newAlerts: Alert[] = [];

    // Check pH
    const phDiff = Math.abs(params.ph - optimal.ph);
    if (phDiff > 1.0) {
      totalStress += 20;
      newAlerts.push({ id: Date.now() + 'ph', type: 'critical', msg: `pH Critical: ${params.ph.toFixed(1)}` });
    } else if (phDiff > 0.5) {
      totalStress += 5;
      newAlerts.push({ id: Date.now() + 'ph', type: 'warning', msg: `pH unstable` });
    }

    // Check Temp
    const tempDiff = Math.abs(params.temp - optimal.temp);
    if (tempDiff > 5) {
      totalStress += 15;
      newAlerts.push({ id: Date.now() + 'temp', type: 'warning', msg: `Temp Deviation` });
    }

    // Update State
    setMetrics(prev => ({
      ...prev,
      stressLevel: Math.min(100, totalStress),
      yieldPrediction: Math.max(0, 100 - (totalStress * 1.5))
    }));

    // Dedup alerts and keep last 3
    setAlerts(prev => [...newAlerts, ...prev].slice(0, 3));
  };

  // Resolves a row's planted crop (if any) to its CROPS entry.
  const rowCrop = (row: number): Crop | null => {
    const slot = plants[row * 3];
    if (slot === 'empty') return null;
    return CROPS.find(c => c.id === PLANT_TO_CROP_ID[slot]) ?? null;
  };

  // Tick inputs held in refs rather than dependencies. `predictionByRow` refreshes roughly
  // once per second per occupied row, so adding it to the interval's dependency array would
  // tear down and recreate the timer every tick and the clock would stall.
  const simulationTimeRef = useRef<number>(0);
  useEffect(() => { simulationTimeRef.current = simulationTime; }, [simulationTime]);

  const rowSimRef = useRef<Record<number, { rate: number; cycleDays: number; healthRate: number; stressFactor: number } | null>>({ 0: null, 1: null, 2: null });
  useEffect(() => {
    const next: typeof rowSimRef.current = {};
    for (const row of [0, 1, 2]) {
      const p = predictionByRow[row];
      next[row] = p ? { rate: p.growthRate, cycleDays: p.cycleDays, healthRate: p.healthRate, stressFactor: p.stressFactor } : null;
    }
    rowSimRef.current = next;
  }, [predictionByRow]);

  // Current per-row growth/health + death latch, mirrored to refs so the tick can read
  // them without being deps.
  const growthRowRef = useRef<Record<number, number>>({ 0: 0, 1: 0, 2: 0 });
  useEffect(() => { growthRowRef.current = growthStageByRow; }, [growthStageByRow]);
  const healthRowRef = useRef<Record<number, number>>({ 0: 1, 1: 1, 2: 1 });
  useEffect(() => { healthRowRef.current = healthByRow; }, [healthByRow]);
  const plantDeadRowRef = useRef<Record<number, boolean>>({ 0: false, 1: false, 2: false });
  useEffect(() => { plantDeadRowRef.current = plantDeadByRow; }, [plantDeadByRow]);

  // -- Simulation Loop --
  // Owned here (not by either page) so it keeps running across navigation between
  // /dashboard and /dashboard/simulation — both render under this same provider,
  // via app/dashboard/layout.tsx, so this effect is never torn down by that navigation.
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        const nextTime = simulationTimeRef.current + SIM_HOURS_PER_TICK;
        simulationTimeRef.current = nextTime;
        setSimulationTime(nextTime);

        // Calculate Stress & Yield (reacts to whichever params source is active)
        calculatePhysics();

        // Advance each occupied row's plant health/growth independently — a row is
        // single-crop across its 3 slots, so checking slot 0 tells us if it's planted.
        [0, 1, 2].forEach((row) => {
          if (plants[row * 3] === 'empty') return;

          // Advance plant health first (the stateful "memory"): integrate the engine's
          // per-hour health rate over this tick and clamp to [0, 1]. With no engine
          // answer — backend down, unpredictable crop — health and growth both freeze.
          // A dead plant stays dead — health and growth are frozen until reset/replant.
          const g = rowSimRef.current[row];
          if (!g || plantDeadRowRef.current[row]) return;

          const nextHealth = Math.max(0, Math.min(1, healthRowRef.current[row] + g.healthRate * SIM_HOURS_PER_TICK));
          healthRowRef.current = { ...healthRowRef.current, [row]: nextHealth };
          setHealthByRow(prev => ({ ...prev, [row]: nextHealth }));

          if (nextHealth <= 0) {
            // Health reached zero: the plant is dead. Latch it — sustained stress is not
            // survivable, and restoring good conditions afterward must NOT bring it back to life.
            plantDeadRowRef.current = { ...plantDeadRowRef.current, [row]: true };
            setPlantDeadByRow(prev => ({ ...prev, [row]: true }));
          }

          // Grow at the engine's rate, gated by BOTH current conditions (rate) and
          // accumulated health: a plant recovering from past stress grows slowly even
          // once conditions are good.
          let nextGrowth = growthRowRef.current[row];
          if (g.cycleDays > 0) {
            const perTick = (100 * SIM_HOURS_PER_TICK) / (g.cycleDays * 24);
            nextGrowth = Math.min(100, nextGrowth + perTick * g.rate * nextHealth);
            growthRowRef.current = { ...growthRowRef.current, [row]: nextGrowth };
            setGrowthStageByRow(prev => ({ ...prev, [row]: nextGrowth }));
          }

          const point: RowHistoryPoint = { time: nextTime, growth: nextGrowth, health: nextHealth * 100, stress: g.stressFactor ?? 0 };
          setHistoryByRow(prev => {
            const updated = [...prev[row], point];
            return { ...prev, [row]: updated.length > HISTORY_CAP ? updated.slice(-HISTORY_CAP) : updated };
          });
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeCrop, params.ph, params.temp, params.humidity, plants]); // Added deps for params drift simulation consistency

  // -- AI Prediction Fetch --
  // Calls the backend prediction endpoint for a single row, using THAT row's own planted
  // crop (not the global Crop Type dropdown). On any failure (backend down, unknown crop)
  // it clears that row's prediction so its AI/chart data falls back gracefully.
  const fetchPredictionForRow = async (row: number, crop: Crop) => {
    if (!PREDICTABLE_CROPS.has(crop.id)) {
      setPredictionByRow(prev => ({ ...prev, [row]: null }));
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/sim/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_type: crop.id, // backend maps "tomatoes" -> "tomato"
          system_type: activeSystem.id, // nft (baseline) | dwc (buffered)
          growth_percent: growthStageByRow[row],
          ph: params.ph,
          ec: params.ec,
          air_temperature_c: params.temp,
          humidity_percent: params.humidity,
          co2_ppm: params.co2,
        }),
      });
      if (!res.ok) {
        setPredictionByRow(prev => ({ ...prev, [row]: null }));
        return;
      }
      const data = await res.json();
      setPredictionByRow(prev => ({
        ...prev,
        [row]: {
          harvestQuality: data.harvest_quality,
          stressFactor: data.stress_factor,
          growthRate: data.growth_rate,
          healthRate: data.health_rate,
          cycleDays: data.cycle_days,
          timeToHarvest: data.estimated_days_to_harvest,
          riskLevel: data.risk_level,
          explanation: data.explanation,
          stage: data.growth_stage ?? null,
          // Engine returns stage-aware optima keyed by backend field names; map to the UI shape.
          optimal: data.optimal
            ? {
                ph: data.optimal.ph,
                ec: data.optimal.ec,
                temp: data.optimal.air_temperature_c,
                humidity: data.optimal.humidity_percent,
                co2: data.optimal.co2_ppm,
              }
            : null,
          source: data.source,
        },
      }));
    } catch {
      setPredictionByRow(prev => ({ ...prev, [row]: null })); // graceful fallback to client-side metrics
    }
  };

  // Real-time prediction — but only once the scenario is actually live:
  //   1) a row has a crop planted,
  //   2) the simulation is running (Simulate pressed),
  //   3) that row's crop exists in the local dataset.
  // While all three hold, each occupied row re-fetches on every environment/growth
  // change (manual slider edits and parameter drift), debounced so a slider drag
  // coalesces into one request per row. Otherwise that row's prediction is cleared so
  // the panel stays idle instead of reacting before the user has set anything up.
  useEffect(() => {
    const occupiedRows = [0, 1, 2].filter(r => plants[r * 3] !== 'empty');
    if (occupiedRows.length === 0) return;
    const timer = setTimeout(() => {
      occupiedRows.forEach((row) => {
        const crop = rowCrop(row);
        if (crop) fetchPredictionForRow(row, crop);
        else setPredictionByRow(prev => ({ ...prev, [row]: null }));
      });
    }, PREDICT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants, activeSystem.id, params.ph, params.ec, params.temp, params.humidity, params.co2, growthStageByRow]);

  // -- Seed the environment to the crop's starting (seedling) optima --
  // On mount and whenever the crop changes, ask the engine for the seedling-stage optimal
  // targets and snap the sliders to them, so a fresh crop opens unstressed at ~100% health.
  // This is "seed once": it never runs mid-simulation, so as the plant grows the targets shift
  // while the user's settings stay put and they must adapt (that's the point of stage-aware
  // optima). Falls back silently to the crop-level defaults if the backend is unreachable.
  const seedParamsFromEngine = async (crop: Crop) => {
    if (!PREDICTABLE_CROPS.has(crop.id)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/sim/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_type: crop.id,
          system_type: activeSystem.id,
          growth_percent: 0, // seedling — the starting stage
          ph: crop.optimal.ph,
          ec: crop.optimal.ec,
          air_temperature_c: crop.optimal.temp,
          humidity_percent: crop.optimal.humidity,
          co2_ppm: crop.optimal.co2,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.optimal) {
        setParams(prev => ({
          ...prev,
          ph: data.optimal.ph,
          ec: data.optimal.ec,
          temp: data.optimal.air_temperature_c,
          humidity: data.optimal.humidity_percent,
          co2: data.optimal.co2_ppm,
        }));
      }
    } catch {
      /* backend down — keep the crop-level fallback already in params */
    }
  };

  useEffect(() => {
    seedParamsFromEngine(activeCrop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCrop.id]);

  // -- Handlers --
  // Resets a single row's growth/health/prediction/history (state + refs, synchronously
  // so a tick firing before the mirroring effects re-run can't read stale ref values).
  // Used when a planted row's crop is changed — the row restarts, but the shared clock,
  // environment, and other rows are untouched.
  const resetRow = (row: number) => {
    setGrowthStageByRow(prev => ({ ...prev, [row]: 0 }));
    setHealthByRow(prev => ({ ...prev, [row]: 1 }));
    setPlantDeadByRow(prev => ({ ...prev, [row]: false }));
    setPredictionByRow(prev => ({ ...prev, [row]: null }));
    setHistoryByRow(prev => ({ ...prev, [row]: [] }));
    growthRowRef.current = { ...growthRowRef.current, [row]: 0 };
    healthRowRef.current = { ...healthRowRef.current, [row]: 1 };
    plantDeadRowRef.current = { ...plantDeadRowRef.current, [row]: false };
    rowSimRef.current = { ...rowSimRef.current, [row]: null };
  };

  const handleReset = () => {
    setIsRunning(false);
    setSimulationTime(0);
    simulationTimeRef.current = 0;
    resetRow(0);
    resetRow(1);
    resetRow(2);
    setParams({
      ph: activeCrop.optimal.ph,
      ec: activeCrop.optimal.ec,
      temp: activeCrop.optimal.temp,
      humidity: activeCrop.optimal.humidity,
      co2: activeCrop.optimal.co2, // crop-level fallback; seed call below snaps to seedling optimum
    });
    seedParamsFromEngine(activeCrop); // re-seed to the seedling-stage optima (async)
    setAlerts([]);
    setMetrics({ yieldPrediction: 100, stressLevel: 0, waterLevel: 100 });
  };

  const getGrowthLabel = (stage: number): string => {
    if (stage < 10) return "Seedling";
    if (stage < 40) return "Vegetative";
    if (stage < 80) return "Flowering/Fruiting";
    return "Harvest Ready";
  };

  const assignCrop = (crop: 'lettuce' | 'tomato', row: number): { changed: boolean } => {
    const currentCrop = plants.slice(row * 3, row * 3 + 3).find(s => s !== 'empty');
    const changed = !!currentCrop && currentCrop !== crop;
    setPlants(prev => {
      const next = [...prev];
      next[row * 3] = crop;
      next[row * 3 + 1] = crop;
      next[row * 3 + 2] = crop;
      return next;
    });
    if (changed) {
      resetRow(row); // only this row resets; the clock, other rows, and environment are untouched
    }
    return { changed };
  };

  const rowOccupancy = (row: number) =>
    plants.slice(row * 3, row * 3 + 3).filter(s => s !== 'empty').length;

  const value: SimulationContextValue = {
    activeSystem, setActiveSystem,
    activeCrop, setActiveCrop,
    isRunning, setIsRunning,
    simulationTime,
    growthStageByRow, healthByRow, plantDeadByRow, alerts,
    params, setParams, metrics,
    predictionByRow, historyByRow,
    activeRow, setActiveRow,
    plants,
    rows: ROWS,
    rowCrop, rowOccupancy, getGrowthLabel,
    resetRow, handleReset, assignCrop,
  };

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}
