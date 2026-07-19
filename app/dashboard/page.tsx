'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Droplets,
  Thermometer,
  Wind,
  Cpu,
  Play,
  Pause,
  RotateCcw,
  Save,
  FileText,
  AlertTriangle,
  Sprout,
  Settings,
  LayoutDashboard,
  BookOpen,
  BarChart3,
  LogOut,
  Database,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';

/**
 * HydroSim - Interactive Hydroponics & Greenhouse Simulator
 * Converted to Next.js + TypeScript
 */

// --- TypeScript Interfaces ---

interface OptimalConditions {
  ph: number;
  ec: number;
  temp: number;
  humidity: number;
}

interface Crop {
  id: string;
  name: string;
  optimal: OptimalConditions;
}

interface System {
  id: string;
  name: string;
  description: string;
}

interface SimulationParams {
  ph: number;
  ec: number;
  temp: number;
  humidity: number;
  co2: number;
  flowRate: number;
}

interface SimulationMetrics {
  yieldPrediction: number;
  stressLevel: number;
  waterLevel: number;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning';
  msg: string;
}

interface Prediction {
  harvestQuality: number;
  stressFactor: number;
  growthRate: number;   // 0-1 speed multiplier from the engine; 1 = unstressed
  healthRate: number;   // signed per-sim-hour change in plant health; integrated over ticks
  cycleDays: number;    // full grow-cycle length for the crop
  timeToHarvest: number;
  riskLevel: string;
  explanation: string;
  source: string;
}

// --- Constants ---

// Only NFT and DWC are modeled by the engine (their ids map to SYSTEM_TOLERANCE_FACTORS).
// DWC's reservoir buffers deviations; NFT is the baseline. Aeroponics/vertical are not modeled yet.
const SYSTEMS: System[] = [
  { id: 'nft', name: 'Nutrient Film Technique (NFT)', description: 'Continuous flow of nutrient solution over roots.' },
  { id: 'dwc', name: 'Deep Water Culture (DWC)', description: 'Roots suspended in oxygenated nutrient solution.' },
];

const CROPS: Crop[] = [
  { id: 'lettuce', name: 'Lettuce', optimal: { ph: 6.0, ec: 1.2, temp: 20, humidity: 60 } },
  { id: 'herbs', name: 'Herbs (Basil)', optimal: { ph: 6.2, ec: 1.4, temp: 24, humidity: 55 } },
  { id: 'tomatoes', name: 'Tomatoes', optimal: { ph: 6.0, ec: 2.5, temp: 26, humidity: 70 } },
  { id: 'cucumbers', name: 'Cucumbers', optimal: { ph: 5.8, ec: 2.0, temp: 25, humidity: 75 } },
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

// --- Helper Component Props ---

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  active?: boolean;
}

interface MetricGaugeProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  optimal: number;
  color?: string;
}

interface ControlSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange?: (value: number) => void;
  optimal: number;
  readOnly?: boolean;
}

interface NavItemProps {
  icon: React.ReactElement<any, any>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

// --- Helper Components ---

const Card: React.FC<CardProps> = ({ children, className = "", title, active = false }) => (
  <div className={`bg-slate-900 border ${active ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-slate-800'} rounded-lg p-4 ${className}`}>
    {title && <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">{title}</h3>}
    {children}
  </div>
);

const MetricGauge: React.FC<MetricGaugeProps> = ({ label, value, unit, min, max, optimal }) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  // Determine status color based on distance from optimal
  const diff = Math.abs(value - optimal);
  let statusColor = "bg-green-500";
  if (diff > (max - min) * 0.15) statusColor = "bg-yellow-500";
  if (diff > (max - min) * 0.3) statusColor = "bg-red-500";

  return (
    <div className="mb-4">
      <div className="flex justify-between items-end mb-1">
        <span className="text-slate-400 text-xs">{label}</span>
        <span className="text-slate-100 font-mono font-bold">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative" style={{ ['--gauge-left' as any]: `${((optimal - min) / (max - min)) * 100}%`, ['--gauge-width' as any]: `${percentage}%` }}>
        {/* Optimal Marker */}
        <div className="absolute top-0 bottom-0 w-1 bg-white/30 z-10"
          style={{ left: 'var(--gauge-left)' }}
        />
        {/* Bar */}
        <div
          className={`h-full transition-all duration-500 ease-out ${statusColor}`}
          style={{ width: 'var(--gauge-width)' }}
        />
      </div>
    </div>
  );
};

const ControlSlider: React.FC<ControlSliderProps> = ({ label, icon, value, min, max, step, onChange, optimal, readOnly = false }) => {
  const id = React.useId();
  return (
    <div className="mb-4 group">
      <div className="flex justify-between mb-1.5">
        <label htmlFor={id} className="flex items-center gap-2 text-slate-300 text-xs font-medium uppercase">
          {icon} {label}
          {readOnly && <span className="text-[10px] text-slate-500 normal-case font-normal">(status only)</span>}
        </label>
        <span className="text-slate-400 font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded">
          Target: {optimal}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={id}
          aria-label={label}
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => !readOnly && onChange?.(parseFloat(e.target.value))}
          disabled={readOnly}
          className={`flex-1 h-2 bg-slate-800 rounded-lg appearance-none transition-all ${readOnly ? 'opacity-50 cursor-not-allowed accent-slate-500' : 'cursor-pointer accent-blue-500 hover:accent-blue-400'}`}
        />
        <input
          id={`${id}-value`}
          aria-label={`${label} value`}
          type="number"
          value={parseFloat(value.toFixed(1))}
          readOnly
          className="w-14 bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-right text-sm font-mono text-blue-400 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} aria-label={label} title={label} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${active ? 'bg-blue-600/10 text-blue-400 border-r-2 border-blue-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
    {React.cloneElement(icon, { size: 20 } as any)}
    <span className="font-medium text-sm hidden md:block">{label}</span>
  </button>
);

// --- Main Page Component ---

export default function DashboardPage() {
  const router = useRouter();

  // -- Logout Handler --
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("id_token");
    localStorage.removeItem("refresh_token");
    router.push("/auth/login");
  };

  // -- Nav State --
  const [activeNav, setActiveNav] = useState<string>('simulation');

  // -- DB Test State --
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'connected' | 'failed'>('idle');
  const [dbInfo, setDbInfo] = useState<{ version?: string; error?: string; host?: string; database?: string } | null>(null);

  const testDbConnection = async () => {
    setDbStatus('loading');
    setDbInfo(null);
    try {
      const res = await fetch('http://127.0.0.1:8001/api/db/health');
      const data = await res.json();
      if (data.status === 'connected') {
        setDbStatus('connected');
        setDbInfo({ version: data.version, host: data.host, database: data.database });
      } else {
        setDbStatus('failed');
        setDbInfo({ error: data.error, host: data.host });
      }
    } catch {
      setDbStatus('failed');
      setDbInfo({ error: 'Could not reach backend' });
    }
  };

  // -- State Management --
  const [activeSystem, setActiveSystem] = useState<System>(SYSTEMS[0]);
  const [activeCrop, setActiveCrop] = useState<Crop>(CROPS[0]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simulationTime, setSimulationTime] = useState<number>(0); // In simulated hours
  const [growthStage, setGrowthStage] = useState<number>(0); // 0 to 100%
  const [health, setHealth] = useState<number>(1); // plant vigor 0-1; accumulates the memory of stress
  const [plantDead, setPlantDead] = useState<boolean>(false); // absorbing state: health hit 0, no recovery
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Environmental Parameters (State + Controls)
  const [params, setParams] = useState<SimulationParams>({
    ph: 6.0,
    ec: 1.2,
    temp: 22.0,
    humidity: 60,
    co2: 400,
    flowRate: 100
  });

  // Derived Metrics (Simulated Physics)
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    yieldPrediction: 95, // %
    stressLevel: 0, // %
    waterLevel: 100, // %
  });

  // AI prediction from the backend (POST /api/sim/predict). Null when the backend
  // is unreachable or the crop has no dataset — the AI card then falls back to `metrics`.
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  // Garden planter UI state
  const [activeShelf, setActiveShelf] = useState<number>(0);
  const [shelfPlants, setShelfPlants] = useState<Record<number, ('empty' | 'lettuce' | 'tomato')[]>>({
    0: Array(9).fill('empty'),
    1: Array(9).fill('empty'),
    2: Array(9).fill('empty'),
  });
  const [openDropdown, setOpenDropdown] = useState<{ shelf: number; row: number } | null>(null);
  const [cropConfirmation, setCropConfirmation] = useState<string | null>(null);

  const shelves = [
    { id: 0, name: 'Top Shelf', crops: '' },
    { id: 1, name: 'Middle Shelf', crops: '' },
    { id: 2, name: 'Bottom Shelf', crops: '' },
  ];

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

  // Tick inputs held in refs rather than dependencies. `prediction` refreshes roughly once
  // per second (growthStage is one of its deps), so adding it to the interval's dependency
  // array would tear down and recreate the timer every tick and the clock would stall.
  const growthRef = useRef<{ rate: number; cycleDays: number; healthRate: number } | null>(null);
  useEffect(() => {
    growthRef.current = prediction
      ? { rate: prediction.growthRate, cycleDays: prediction.cycleDays, healthRate: prediction.healthRate }
      : null;
  }, [prediction]);

  // Current health + death latch, mirrored to refs so the tick can read them without being deps.
  const healthRef = useRef<number>(1);
  useEffect(() => { healthRef.current = health; }, [health]);
  const plantDeadRef = useRef<boolean>(false);
  useEffect(() => { plantDeadRef.current = plantDead; }, [plantDead]);

  // -- Simulation Loop --
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setSimulationTime(prev => prev + SIM_HOURS_PER_TICK);

        // Calculate Stress & Yield (reacts to whichever params source is active)
        calculatePhysics();

        // Advance plant health first (the stateful "memory"): integrate the engine's per-hour
        // health rate over this tick and clamp to [0, 1]. With no engine answer — backend down,
        // unplanted shelf, unpredictable crop — health and growth both freeze.
        // A dead plant stays dead — health and growth are frozen until reset/replant.
        const g = growthRef.current;
        if (g && !plantDeadRef.current) {
          const nextHealth = Math.max(0, Math.min(1, healthRef.current + g.healthRate * SIM_HOURS_PER_TICK));
          healthRef.current = nextHealth;   // update synchronously so back-to-back ticks integrate correctly
          setHealth(nextHealth);

          if (nextHealth <= 0) {
            // Health reached zero: the plant is dead. Latch it — sustained stress is not survivable,
            // and restoring good conditions afterward must NOT bring it back to life.
            plantDeadRef.current = true;
            setPlantDead(true);
          }

          // Grow at the engine's rate, gated by BOTH current conditions (rate) and accumulated
          // health: a plant recovering from past stress grows slowly even once conditions are good.
          if (g.cycleDays > 0) {
            const perTick = (100 * SIM_HOURS_PER_TICK) / (g.cycleDays * 24);
            setGrowthStage(prev => Math.min(100, prev + perTick * g.rate * nextHealth));
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeCrop, params.ph, params.temp, params.humidity]); // Added deps for params drift simulation consistency

  // -- AI Prediction Fetch --
  // Calls the backend prediction endpoint with the current environment state.
  // On any failure (backend down, unknown crop) it clears `prediction` so the AI
  // card falls back to the client-side `metrics` — the panel never breaks.
  const fetchPrediction = async () => {
    if (!PREDICTABLE_CROPS.has(activeCrop.id)) {
      setPrediction(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/sim/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_type: activeCrop.id, // backend maps "tomatoes" -> "tomato"
          system_type: activeSystem.id, // nft (baseline) | dwc (buffered)
          growth_percent: growthStage,
          ph: params.ph,
          ec: params.ec,
          air_temperature_c: params.temp,
          humidity_percent: params.humidity,
          co2_ppm: params.co2,
        }),
      });
      if (!res.ok) {
        setPrediction(null);
        return;
      }
      const data = await res.json();
      setPrediction({
        harvestQuality: data.harvest_quality,
        stressFactor: data.stress_factor,
        growthRate: data.growth_rate,
        healthRate: data.health_rate,
        cycleDays: data.cycle_days,
        timeToHarvest: data.estimated_days_to_harvest,
        riskLevel: data.risk_level,
        explanation: data.explanation,
        source: data.source,
      });
    } catch {
      setPrediction(null); // graceful fallback to client-side metrics
    }
  };

  // Real-time prediction — but only once the scenario is actually live:
  //   1) a crop is planted in at least one pod,
  //   2) the simulation is running (Simulate pressed),
  //   3) the selected crop exists in the local dataset.
  // While all three hold, it re-fetches on every environment/growth change (manual
  // slider edits and parameter drift), debounced so a slider drag coalesces into one
  // request. Otherwise the prediction is cleared so the panel stays idle instead of
  // reacting before the user has set anything up.
  useEffect(() => {
    const hasPlantedCrop = Object.values(shelfPlants).some(
      rows => rows.some(slot => slot !== 'empty')
    );
    if (!hasPlantedCrop || !PREDICTABLE_CROPS.has(activeCrop.id)) {
      setPrediction(null);
      return;
    }
    const timer = setTimeout(fetchPrediction, PREDICT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelfPlants, activeCrop.id, activeSystem.id, params.ph, params.ec, params.temp, params.humidity, params.co2, growthStage]);

  // -- Handlers --
  const handleReset = () => {
    setIsRunning(false);
    setSimulationTime(0);
    setGrowthStage(0);
    setHealth(1);
    setPlantDead(false);
    setParams({
      ph: activeCrop.optimal.ph,
      ec: activeCrop.optimal.ec,
      temp: activeCrop.optimal.temp,
      humidity: activeCrop.optimal.humidity,
      co2: 400,
      flowRate: 100
    });
    setAlerts([]);
    setMetrics({ yieldPrediction: 100, stressLevel: 0, waterLevel: 100 });
    setPrediction(null);
  };

  const getGrowthLabel = (stage: number): string => {
    if (stage < 10) return "Seedling";
    if (stage < 40) return "Vegetative";
    if (stage < 80) return "Flowering/Fruiting";
    return "Harvest Ready";
  };

  const handlePlanterClick = (shelfId: number, row: number) => {
    if (openDropdown?.shelf === shelfId && openDropdown?.row === row) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown({ shelf: shelfId, row });
    }
  };

  const assignCrop = (crop: 'lettuce' | 'tomato', shelfId: number, row: number) => {
    const currentCrop = shelfPlants[shelfId].find(s => s !== 'empty');
    const isChange = currentCrop && currentCrop !== crop;
    setShelfPlants(prev => ({
      ...prev,
      [shelfId]: Array(9).fill(crop),
    }));
    setOpenDropdown(null);
    if (isChange) {
      setCropConfirmation('Crop changed — restarting simulation');
      handleReset();
    } else {
      setCropConfirmation(`${crop.charAt(0).toUpperCase() + crop.slice(1)} added to simulation`);
    }
    setTimeout(() => setCropConfirmation(null), 3000);
  };

  const shelfOccupancy = (shelfId: number) =>
    shelfPlants[shelfId].filter(slot => slot !== 'empty').length;

  const rowOccupancy = (shelfId: number, row: number) =>
    shelfPlants[shelfId].slice(row * 3, row * 3 + 3).filter(s => s !== 'empty').length;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">

      {/* --- SIDEBAR NAVIGATION --- */}
      <aside className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all">
        <div className="p-4 flex items-center gap-3 border-b border-slate-800 h-16">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/20">H</div>
          <span className="font-bold text-lg tracking-tight hidden md:block">HydroSim</span>
        </div>

        <nav className="flex-1 p-2 space-y-1 mt-4">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeNav === 'dashboard'} onClick={() => setActiveNav('dashboard')} />
          <NavItem icon={<Activity />} label="Simulation" active={activeNav === 'simulation'} onClick={() => setActiveNav('simulation')} />
          <NavItem icon={<Database />} label="Database" active={activeNav === 'database'} onClick={() => setActiveNav('database')} />
          <NavItem icon={<BarChart3 />} label="Compare Scenarios" active={activeNav === 'compare'} onClick={() => setActiveNav('compare')} />
          <NavItem icon={<BookOpen />} label="Learning Modules" active={activeNav === 'learning'} onClick={() => setActiveNav('learning')} />
          <div className="my-4 border-t border-slate-800"></div>
          <NavItem icon={<Settings />} label="Configuration" active={activeNav === 'config'} onClick={() => setActiveNav('config')} />
        </nav>
{/* logout button */}
          <button
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={20} />
            <span className="font-medium text-sm hidden md:block">Logout</span>
          </button>
        <div className="p-4 border-t border-slate-800 hidden md:block">
          <div className="text-xs text-slate-500 mb-1">Project Status</div>
          <div className="flex items-center gap-2 text-sm font-mono text-green-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            System Online
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white hidden sm:block">{activeSystem.name}</h1>
            <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400 font-mono border border-slate-700">v1.0.4-beta</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-secondary" title="Export CSV">
               <FileText size={18} />
            </button>
            <button className="btn-secondary" title="Save Session">
               <Save size={18} />
            </button>
            <div className="h-8 w-px bg-slate-800 mx-2"></div>
            <button
              onClick={handleReset}
              title="Reset Simulation"
              aria-label="Reset Simulation"
              className="p-2 hover:bg-slate-800 rounded-md text-slate-400 transition-colors"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                isRunning
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
              }`}
            >
              {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Simulate</>}
            </button>
          </div>
        </header>

        {/* Database Panel */}
        {activeNav === 'database' && (
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            <div className="w-full max-w-lg mt-8">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <Database size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">PostgreSQL Connection</h2>
                    <p className="text-xs text-slate-400">dev-hydrosim · ca-central-1</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Host</span>
                    <span className="font-mono text-slate-300 text-xs truncate max-w-xs">dev-hydrosim.cluster-csziftmu9uhi.ca-central-1.rds.amazonaws.com</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>User</span>
                    <span className="font-mono text-slate-300">postgres</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Port</span>
                    <span className="font-mono text-slate-300">5432</span>
                  </div>
                </div>

                <button
                  onClick={testDbConnection}
                  disabled={dbStatus === 'loading'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all"
                >
                  {dbStatus === 'loading'
                    ? <><Loader size={16} className="animate-spin" /> Testing...</>
                    : <><Database size={16} /> Test Connection</>}
                </button>

                {dbStatus === 'connected' && (
                  <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                      <CheckCircle size={16} /> Connected
                    </div>
                    <p className="text-xs text-slate-400 font-mono break-all">{dbInfo?.version}</p>
                  </div>
                )}

                {dbStatus === 'failed' && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                      <XCircle size={16} /> Connection Failed
                    </div>
                    <p className="text-xs text-slate-400 font-mono break-all">{dbInfo?.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Grid */}
        {activeNav !== 'database' && <div className="flex-1 overflow-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* --- COLUMN 1: CONFIGURATION --- */}
          <div className="lg:col-span-3 space-y-4">
            <Card title="System Setup">
              <div className="space-y-4">
                <div>
                  <label htmlFor="system-select" className="text-xs text-slate-500 mb-1 block">Architecture</label>
                  <select
                    id="system-select"
                    aria-label="System Architecture"
                    title="System Architecture"
                    value={activeSystem.id}
                    onChange={(e) => {
                      const sys = SYSTEMS.find(s => s.id === e.target.value);
                      if (sys) setActiveSystem(sys);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    {SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="crop-select" className="text-xs text-slate-500 mb-1 block">Crop Type</label>
                  <select
                    id="crop-select"
                    aria-label="Crop Type"
                    title="Crop Type"
                    value={activeCrop.id}
                    onChange={(e) => {
                      const crop = CROPS.find(c => c.id === e.target.value);
                      if (crop) {
                        setActiveCrop(crop);
                        handleReset(); // Reset simulation on crop change
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    {CROPS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            <Card title="Environment Controls" className="flex-1">
               <p className="text-[10px] text-slate-500 mb-3 leading-tight">
                 Environment settings are global — they apply to all pods on every shelf (shared nutrient
                 solution &amp; climate). Per-pod overrides aren&apos;t supported.
               </p>
               <ControlSlider
                  label="Acidity (pH)"
                  icon={<Droplets size={14} />}
                  value={params.ph}
                  min={4.0} max={8.0} step={0.1}
                  optimal={activeCrop.optimal.ph}
                  onChange={(v) => setParams({...params, ph: v})}
               />
               <ControlSlider
                  label="Nutrient Conc. (EC)"
                  icon={<Activity size={14} />}
                  value={params.ec}
                  min={0.5} max={4.0} step={0.1}
                  optimal={activeCrop.optimal.ec}
                  onChange={(v) => setParams({ ...params, ec: v })}
               />
               <ControlSlider
                  label="Temperature (°C)"
                  icon={<Thermometer size={14} />}
                  value={params.temp}
                  min={10} max={40} step={0.5}
                  optimal={activeCrop.optimal.temp}
                  onChange={(v) => setParams({...params, temp: v})}
               />
               <ControlSlider
                  label="Humidity (%)"
                  icon={<Wind size={14} />}
                  value={params.humidity}
                  min={0} max={100} step={1}
                  optimal={activeCrop.optimal.humidity}
                  onChange={(v) => setParams({...params, humidity: v})}
               />
               <ControlSlider
                  label="CO2 Levels (ppm)"
                  icon={<Wind size={14} />}
                  value={params.co2}
                  min={300} max={1200} step={10}
                  optimal={800} // Generic optimal
                  onChange={(v) => setParams({...params, co2: v})}
               />
            </Card>
          </div>

          {/* --- COLUMN 2: VISUALIZATION (DIGITAL TWIN) --- */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Garden Planter View */}
            <div className="flex-1 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden flex flex-col lg:flex-row">
              <div className="flex-1 p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs text-slate-400 uppercase">
                  <div className="flex items-center gap-2">
                    <Sprout size={14} className="text-green-400" />
                    <span>Growth Stage</span>
                    <span className="text-white font-semibold">{getGrowthLabel(growthStage)} ({Math.floor(growthStage)}%)</span>
                    <span className={`font-semibold ${plantDead ? 'text-red-500' : health >= 0.7 ? 'text-green-400' : health >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                      · {plantDead ? 'DEAD' : `Health ${Math.round(health * 100)}%`}
                    </span>
                  </div>
                  <div className="font-mono text-white">{simulationTime} Hours</div>
                </div>

                <div className="relative flex-1 flex items-center justify-center">
                  <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>
                  <div className="relative w-full max-w-sm space-y-4">
                    {shelves.map((shelf) => {
                      const isActive = activeShelf === shelf.id;
                      return (
                        <button
                          key={shelf.id}
                          onClick={() => setActiveShelf(shelf.id)}
                          className={`group w-full rounded-xl border transition-all flex flex-col gap-1 px-3 py-3 text-left ${isActive ? 'border-emerald-400 bg-slate-800 shadow-lg shadow-emerald-900/40' : 'border-slate-700 bg-slate-800/60 hover:border-emerald-300/70 hover:bg-slate-800/80'}`}
                          aria-pressed={isActive}
                          aria-label={`${shelf.name}, ${Math.floor(shelfOccupancy(shelf.id) / 3)} of 3 rows planted`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">{shelf.name}</div>
                              <div className="text-[11px] text-slate-400">{shelf.crops}</div>
                            </div>
                            <div className={`text-[11px] px-2 py-1 rounded-full font-mono ${isActive ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50' : 'bg-slate-900 text-slate-300 border border-slate-700'}`}>
                              {Math.floor(shelfOccupancy(shelf.id) / 3)}/3 rows
                            </div>
                          </div>
                          <div className="relative mt-2 h-5 rounded-lg overflow-hidden bg-slate-950 border border-slate-700">
                            <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-slate-700/40 to-slate-700/10"></div>
                            <div className="absolute inset-0 flex items-center px-2">
                              <div className={`h-2 rounded-full transition-all ${isActive ? 'bg-emerald-400/80' : 'bg-slate-600/70'}`} style={{ width: `${(shelfOccupancy(shelf.id) / 9) * 100}%` }}></div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="lg:w-1/2 border-t border-slate-800 lg:border-l lg:border-t-0 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs uppercase text-slate-400">Shelf Detail</div>
                    <div className="text-sm font-semibold text-white">{shelves[activeShelf].name}</div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">Click a planter to assign a crop</div>
                </div>

                <div className="rounded-xl border border-slate-200/60 bg-[#f6f7ee] p-4 shadow-inner space-y-3">
                  {[0, 1, 2].map(row => {
                    const isOpen = openDropdown?.shelf === activeShelf && openDropdown?.row === row;
                    const rowSlots = shelfPlants[activeShelf].slice(row * 3, row * 3 + 3);
                    return (
                      <div key={row} className="relative">
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Row {row + 1}</span>
                          <span className="text-[10px] font-mono text-slate-500">{rowOccupancy(activeShelf, row)}/3</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {rowSlots.map((slot, colIdx) => {
                            const globalIdx = row * 3 + colIdx;
                            const planterId = `crop${globalIdx + 1}`;
                            return (
                              <div key={planterId} id={planterId} className="relative flex flex-col items-center">
                                <button
                                  onClick={() => handlePlanterClick(activeShelf, row)}
                                  className="relative aspect-square w-full rounded-full transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 flex items-center justify-center"
                                  aria-label={`${planterId}, ${slot === 'empty' ? 'empty' : slot}`}
                                  style={{
                                    backgroundColor: '#5b3a2c',
                                    boxShadow: slot !== 'empty'
                                      ? '0 0 0 6px #d16a55, inset 0 0 0 2px rgba(0,0,0,0.05)'
                                      : isOpen
                                      ? '0 0 0 5px #60a5fa'
                                      : '0 0 0 3px #d16a55',
                                    opacity: slot !== 'empty' ? 1 : 0.65,
                                  }}
                                >
                                  {slot !== 'empty' && (
                                    <img
                                      src={`/${slot}.svg`}
                                      alt={slot}
                                      className="w-3/5 h-3/5 object-contain pointer-events-none"
                                    />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {isOpen && (
                          <div
                            id="cropSelect"
                            className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden text-xs w-32"
                          >
                            <div className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-100 uppercase tracking-wide">Apply to all 9 planters</div>
                            <button
                              onClick={() => assignCrop('lettuce', activeShelf, row)}
                              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-green-50 text-slate-700"
                            >
                              <img src="/lettuce.svg" alt="lettuce" className="w-4 h-4" />
                              Lettuce
                            </button>
                            <button
                              onClick={() => assignCrop('tomato', activeShelf, row)}
                              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-slate-700"
                            >
                              <img src="/tomato.svg" alt="tomato" className="w-4 h-4" />
                              Tomato
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {cropConfirmation && (
                  <div className="mt-2 text-center text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800 rounded-lg py-2 px-3">
                    {cropConfirmation}
                  </div>
                )}
              </div>
            </div>

            {/* Alerts Console */}
            <div role="status" aria-live="polite" className="h-32 bg-black/40 border border-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-xs">
              <div className="sticky top-0 bg-slate-950/90 border-b border-slate-800 pb-1 mb-2 flex justify-between items-center">
                 <span className="font-bold text-slate-400 uppercase">System Log</span>
                 {alerts.length > 0 && <span className="text-red-400 animate-pulse flex items-center gap-1"><AlertTriangle size={10}/> Attention Needed</span>}
              </div>
              {alerts.length === 0 ? (
                <div className="text-slate-600 italic p-2">System Nominal. No active alerts.</div>
              ) : (
                <div className="space-y-1">
                   {alerts.map(alert => (
                     <div key={alert.id} className={`p-2 rounded border-l-2 ${alert.type === 'critical' ? 'bg-red-500/10 border-red-500 text-red-200' : 'bg-yellow-500/10 border-yellow-500 text-yellow-200'}`}>
                        <span className="font-bold mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {alert.msg}
                     </div>
                   ))}
                </div>
              )}
            </div>
          </div>

          {/* --- COLUMN 3: TELEMETRY & AI --- */}
          <div className="lg:col-span-3 space-y-4">
            <Card title="Real-time Telemetry">
               <MetricGauge label="pH Level" value={params.ph} unit="" min={4.0} max={8.0} optimal={activeCrop.optimal.ph} />
               <MetricGauge label="EC (mS/cm)" value={params.ec} unit="" min={0.5} max={4.0} optimal={activeCrop.optimal.ec} />
               <MetricGauge label="Water Temp" value={params.temp} unit="°C" min={10} max={40} optimal={activeCrop.optimal.temp} />
               <MetricGauge label="Humidity" value={params.humidity} unit="%" min={0} max={100} optimal={activeCrop.optimal.humidity} />
            </Card>

            <Card title="AI Yield Prediction" className="relative overflow-hidden">
               {/* Source Badge — reflects whether the number came from the dataset endpoint or the local fallback */}
               <div className="absolute top-3 right-3 text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                  <Cpu size={10} /> {prediction ? 'Engine' : 'Local'}
               </div>

               {(() => {
                 // Discount the engine's instantaneous quality by accumulated health, so damage has a
                 // lasting yield consequence (a rescued plant doesn't snap back to 100%). predict_yield
                 // itself is untouched — this penalty lives only in the display, keeping the AGC-validated
                 // function intact. sqrt softens the discount in the mid-range (a 55%-health plant keeps
                 // ~74% of its yield, not 55%) so "mildly off on everything" isn't unduly punishing, while
                 // still going to 0 when the plant is actually dead (health 0 → yields nothing).
                 const harvestQuality = prediction ? prediction.harvestQuality * Math.sqrt(health) : metrics.yieldPrediction;
                 const stress = prediction ? prediction.stressFactor : metrics.stressLevel;
                 return (
                   <>
                     <div className="text-center py-4">
                        <div className="text-4xl font-bold text-white mb-1">{harvestQuality.toFixed(0)}%</div>
                        <div className="text-xs text-slate-400">Estimated Harvest Quality</div>
                     </div>

                     <div className="space-y-2 mt-2">
                        {prediction && (
                           <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Est. Time to Harvest</span>
                              <span className="text-slate-200 font-mono">{prediction.timeToHarvest.toFixed(0)} days</span>
                           </div>
                        )}
                        <div className="flex justify-between text-xs">
                           <span className="text-slate-500">Stress Factor</span>
                           <span className={`${stress > 20 ? 'text-red-400' : 'text-green-400'}`}>{stress.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-red-500 stress-bar" style={{ ['--stress-width' as any]: `${stress}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                           {prediction
                             ? prediction.explanation
                             : 'Prediction based on current pH stability and temperature consistency over the last 12 simulated hours.'}
                        </p>
                     </div>
                   </>
                 );
               })()}
            </Card>

             {/* Educational Micro-module */}
             <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-blue-600 rounded-full mt-1">
                      <BookOpen size={14} className="text-white" />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-blue-100">Did you know?</h4>
                      <p className="text-xs text-blue-200 mt-1 leading-relaxed">
                         {activeSystem.name} systems rely heavily on water oxygenation. Keep temperatures below 25°C to maintain high dissolved oxygen levels.
                      </p>
                   </div>
                </div>
             </div>

          </div>
        </div>}
      </main>

      {/* CSS for Animations/Custom Styles */}
      <style>{`
        .bg-grid-pattern {
          background-image: linear-gradient(to right, #1e293b 1px, transparent 1px),
                            linear-gradient(to bottom, #1e293b 1px, transparent 1px);
          background-size: 40px 40px;
        }
        @keyframes wave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-wave {
          background: repeat-x url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAwIDEyMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMGw0MCAxMC43YzQwIDEwLjcgODAgMjEuMyAxMjAgMjEuMyAxNjAgMCAyMDAgNDIuNyAzMjAgNDIuNyA0MCAwIDgwLTEwLjcgMTIwLTEwLjcgNDAgMCA4MCAxMC43IDEyMCAxMC43IDQwIDAgODAtMTAuNyAxMjAtMTAuNyA0MCAwIDgwIDEwLjcgMTIwIDEwLjcgNDAgMCA4MC0xMC43IDEyMC0xMC43IFYgMTIwIEggMCB6IiBmaWxsPSIjM2I4MmY2IiBmaWxsLW9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==');
          background-size: 50% 100%;
          animation: wave 10s linear infinite;
        }
        @keyframes flowHorizontal {
          0% { transform: translateX(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(200px); opacity: 0; }
        }
        .animate-flow-horizontal {
          animation: flowHorizontal 2s infinite linear;
        }
        .btn-secondary {
          @apply p-2 rounded hover:bg-slate-800 text-slate-400 transition-colors;
        }

        /* Dynamic style helpers */
        .water-level { height: var(--water-level); }
        .plant-stem { height: var(--plant-height); width: var(--plant-width); }
        .stress-bar { width: var(--stress-width); transition: width 0.4s ease; }
      `}</style>
    </div>
  );
}
