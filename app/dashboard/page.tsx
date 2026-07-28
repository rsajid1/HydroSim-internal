'use client';

import React, { useState, useEffect } from 'react';
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
  LogOut,
  Database,
  CheckCircle,
  XCircle,
  Loader,
  LineChart as LineChartIcon,
  ChevronsLeft,
  ChevronsRight,
  Info,
} from 'lucide-react';
import { useSimulation, SYSTEMS, CROPS } from './SimulationProvider';

/**
 * HydroSim - Interactive Hydroponics & Greenhouse Simulator
 * Converted to Next.js + TypeScript
 */

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
  readOnly?: boolean;
}

interface NavItemProps {
  icon: React.ReactElement<any, any>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
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

const ControlSlider: React.FC<ControlSliderProps> = ({ label, icon, value, min, max, step, onChange, readOnly = false }) => {
  const id = React.useId();
  return (
    <div className="mb-4 group">
      <div className="flex justify-between items-baseline mb-1.5 gap-2">
        <label htmlFor={id} className="flex items-center gap-2 text-slate-300 text-xs font-medium uppercase">
          {icon} {label}
          {readOnly && <span className="text-[10px] text-slate-500 normal-case font-normal">(status only)</span>}
        </label>
        {/* Current value only — the optimal "Target" marker lives on the Real-time Telemetry
            gauges, so repeating it on the sliders was redundant. */}
        <span className="font-mono text-xs font-bold text-blue-400 whitespace-nowrap">{value.toFixed(1)}</span>
      </div>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => !readOnly && onChange?.(parseFloat(e.target.value))}
        disabled={readOnly}
        className={`w-full h-2 bg-slate-800 rounded-lg appearance-none transition-all ${readOnly ? 'opacity-50 cursor-not-allowed accent-slate-500' : 'cursor-pointer accent-blue-500 hover:accent-blue-400'}`}
      />
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, collapsed = false }) => (
  <button onClick={onClick} aria-label={label} title={label} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${collapsed ? 'md:justify-center' : ''} ${active ? 'bg-blue-600/10 text-blue-400 border-r-2 border-blue-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
    {React.cloneElement(icon, { size: 20 } as any)}
    <span className={`font-medium text-sm ${collapsed ? 'hidden' : 'hidden md:block'}`}>{label}</span>
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

  // -- Sidebar collapse (icon-only) — user-toggled, persisted across reloads. Init false to
  // match the server-rendered HTML (avoids a hydration mismatch); the saved value is applied
  // on mount. --
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  useEffect(() => {
    // Read once after mount (not a lazy initializer) so the server and client agree on the
    // initial `false`, avoiding a hydration mismatch on the sidebar width.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem('hydrosim.sidebarCollapsed') === 'true') setSidebarCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem('hydrosim.sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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

  // -- Shared simulation state (lives above this page so it survives navigation to
  // /dashboard/simulation — see app/dashboard/SimulationProvider.tsx) --
  const sim = useSimulation();
  const {
    activeSystem, setActiveSystem,
    activeCrop, setActiveCrop,
    isRunning, setIsRunning,
    simulationTime,
    growthStageByRow, healthByRow, plantDeadByRow, alerts,
    params, setParams, metrics,
    predictionByRow,
    activeRow, setActiveRow,
    plants,
    rows,
    rowOccupancy,
    getGrowthLabel,
    handleReset,
  } = sim;

  // Garden planter UI state that's local to this page only (the confirmation toast
  // isn't needed on the chart page).
  const [cropConfirmation, setCropConfirmation] = useState<string | null>(null);

  // Click-to-plant (single-crop session): selects the row, and if it's empty, plants the
  // current session crop (activeCrop) into all 3 of its slots. There's no per-row crop
  // choice — the crop comes from the Crop Type selector. Clicking an already-planted row
  // just selects it; clearing a row is done via Reset.
  //
  // Planting is a PRE-RUN setup action: once the simulation is running, clicking an empty
  // row must not plant a new crop (that would start a fresh plant mid-run and disrupt the
  // in-progress simulation). While running we only let the user switch between rows that
  // already have a plant; empty planters are inert until the run is paused/reset.
  const handlePlanterClick = (row: number) => {
    if (isRunning) {
      if (rowOccupancy(row) > 0) setActiveRow(row);
      return;
    }
    setActiveRow(row);
    if (rowOccupancy(row) === 0) {
      const slot = activeCrop.id === 'tomatoes' ? 'tomato' : 'lettuce';
      sim.assignCrop(slot, row);
      setCropConfirmation(`${activeCrop.name} planted in ${rows[row].name}`);
      setTimeout(() => setCropConfirmation(null), 3000);
    }
  };

  const handleViewChart = (row: number) => {
    setActiveRow(row);
    router.push('/dashboard/simulation');
  };

  // Slider/gauge "Target" markers follow the engine's stage-aware optima when a prediction is
  // live (they shift as the plant grows — e.g. tomato air temp eases toward harvest); before the
  // first prediction, fall back to the crop-level optima.
  const activeOptimal = predictionByRow[activeRow]?.optimal ?? activeCrop.optimal;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">

      {/* --- SIDEBAR NAVIGATION --- */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-16 md:w-64'} bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-[width] duration-300 ease-in-out`}>
        <div className={`p-4 flex items-center gap-3 border-b border-slate-800 h-16 ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/20 shrink-0">H</div>
          <span className={`font-bold text-lg tracking-tight ${sidebarCollapsed ? 'hidden' : 'hidden md:block'}`}>HydroSim</span>
        </div>

        {/* Collapse/expand toggle — only meaningful at md+ (below md the sidebar is already icon-only) */}
        <button
          onClick={() => setSidebarCollapsed(v => !v)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          className={`hidden md:flex items-center gap-2 mx-2 mt-2 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          {sidebarCollapsed
            ? <ChevronsRight size={18} />
            : <><ChevronsLeft size={18} /><span className="text-xs font-medium">Collapse</span></>}
        </button>

        <nav className="flex-1 p-2 space-y-1 mt-4">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeNav === 'dashboard'} onClick={() => setActiveNav('dashboard')} collapsed={sidebarCollapsed} />
          <NavItem icon={<Activity />} label="Simulation" active={activeNav === 'simulation'} onClick={() => setActiveNav('simulation')} collapsed={sidebarCollapsed} />
          <NavItem icon={<Database />} label="Database" active={activeNav === 'database'} onClick={() => setActiveNav('database')} collapsed={sidebarCollapsed} />
          <NavItem icon={<BookOpen />} label="Learning Modules" active={false} onClick={() => router.push('/dashboard/learning')} collapsed={sidebarCollapsed} />
          <div className="my-4 border-t border-slate-800"></div>
          <NavItem icon={<Settings />} label="Configuration" active={activeNav === 'config'} onClick={() => setActiveNav('config')} collapsed={sidebarCollapsed} />
        </nav>
{/* logout button */}
          <button
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-red-400 hover:bg-red-500/10 hover:text-red-300 ${sidebarCollapsed ? 'md:justify-center' : ''}`}
          >
            <LogOut size={20} />
            <span className={`font-medium text-sm ${sidebarCollapsed ? 'hidden' : 'hidden md:block'}`}>Logout</span>
          </button>
        <div className={`p-4 border-t border-slate-800 ${sidebarCollapsed ? 'hidden' : 'hidden md:block'}`}>
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
                    title={isRunning ? 'Pause or reset to change the system' : 'System Architecture'}
                    value={activeSystem.id}
                    disabled={isRunning}
                    onChange={(e) => {
                      const sys = SYSTEMS.find(s => s.id === e.target.value);
                      if (sys) setActiveSystem(sys);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="crop-select" className="text-xs text-slate-500 mb-1 block">Crop Type</label>
                  <select
                    id="crop-select"
                    aria-label="Crop Type"
                    title={isRunning ? 'Pause or reset to change the crop' : 'Crop Type'}
                    value={activeCrop.id}
                    disabled={isRunning}
                    onChange={(e) => {
                      const crop = CROPS.find(c => c.id === e.target.value);
                      if (crop) {
                        setActiveCrop(crop);
                        // Single-crop session: re-plant any occupied rows to the new crop and reset.
                        sim.replantToCrop(crop);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {CROPS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            <Card>
               {/* Header + info icon. The "settings are global" note lives in a hover/focus tooltip
                   (CSS peer, no JS popup) instead of a paragraph eating panel space. */}
               <div className="relative flex items-center gap-1.5 mb-3">
                 <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Environment Controls</h3>
                 <button
                   type="button"
                   aria-label="About environment settings"
                   className="peer inline-flex items-center text-slate-500 hover:text-slate-300 focus:text-slate-300 cursor-help outline-none"
                 >
                   <Info size={13} />
                 </button>
                 <span
                   role="tooltip"
                   className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-56 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-normal normal-case leading-snug text-slate-300 opacity-0 shadow-lg transition-opacity duration-150 peer-hover:opacity-100 peer-focus:opacity-100"
                 >
                   Environment settings are global — they apply to all pods on every shelf (shared nutrient
                   solution &amp; climate). Per-pod overrides aren&apos;t supported.
                 </span>
               </div>
               <ControlSlider
                  label="Acidity (pH)"
                  icon={<Droplets size={14} />}
                  value={params.ph}
                  min={4.0} max={8.0} step={0.1}
                  onChange={(v) => setParams({...params, ph: v})}
               />
               <ControlSlider
                  label="Temperature (°C)"
                  icon={<Thermometer size={14} />}
                  value={params.temp}
                  min={10} max={40} step={0.5}
                  onChange={(v) => setParams({...params, temp: v})}
               />
               <ControlSlider
                  label="Humidity (%)"
                  icon={<Wind size={14} />}
                  value={params.humidity}
                  min={0} max={100} step={1}
                  onChange={(v) => setParams({...params, humidity: v})}
               />
               <ControlSlider
                  label="CO2 Levels (ppm)"
                  icon={<Wind size={14} />}
                  value={params.co2}
                  min={300} max={1200} step={10}
                  onChange={(v) => setParams({...params, co2: v})}
               />
            </Card>
          </div>

          {/* --- COLUMN 2: VISUALIZATION (DIGITAL TWIN) --- */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Status chip — isolated, compact, elevated pill for the ACTIVE row (row · stage · health ·
                clock). No wrapping panel: it floats on the page background above the grow bed. */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-slate-700/80 bg-slate-900/90 px-5 py-2.5 text-sm shadow-lg shadow-black/40 ring-1 ring-inset ring-white/5 max-w-full overflow-x-auto">
                <span className="flex items-center gap-1.5 text-slate-400 uppercase tracking-wide whitespace-nowrap">
                  <Sprout size={15} className="text-green-400 shrink-0" />
                  {rows[activeRow].name}
                </span>
                <span className="w-px h-4 bg-slate-600/60 shrink-0" />
                <span className="text-white font-semibold whitespace-nowrap">{getGrowthLabel(growthStageByRow[activeRow])} ({Math.floor(growthStageByRow[activeRow])}%)</span>
                <span className="w-px h-4 bg-slate-600/60 shrink-0" />
                <span className={`font-semibold whitespace-nowrap ${plantDeadByRow[activeRow] ? 'text-red-500' : healthByRow[activeRow] >= 0.7 ? 'text-green-400' : healthByRow[activeRow] >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {plantDeadByRow[activeRow] ? 'DEAD' : `Health ${Math.round(healthByRow[activeRow] * 100)}%`}
                </span>
                <span className="w-px h-4 bg-slate-600/60 shrink-0" />
                <span className="font-mono text-slate-300 whitespace-nowrap">{simulationTime} Hours</span>
              </div>
            </div>

            {/* Grow bed — isolated, elevated tray centered on the page background (no wrapping slate
                panel). Size-capped smaller so it doesn't dominate the column. */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-full max-w-[340px]">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <div className="text-xs font-semibold text-white uppercase tracking-wide">3×3 Grow Bed</div>
                  <div className="text-[10px] text-slate-400">Click a row to plant {activeCrop.name}</div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-[#f6f7ee] p-3 space-y-2 shadow-xl shadow-black/40 ring-1 ring-black/5">
                  {[0, 1, 2].map(row => {
                    const isActiveRow = activeRow === row;
                    // The active row is indicated by recolouring its pots' outer ring (blue selection
                    // colour) instead of a background box — inactive rows keep the terracotta rim.
                    const ringColor = isActiveRow ? '#60a5fa' : '#d16a55';
                    const rowSlots = plants.slice(row * 3, row * 3 + 3);
                    return (
                      <div key={row} className="relative">
                        <div className="flex items-center justify-between mb-1 px-0.5">
                          <span className={`text-[9px] font-medium uppercase tracking-wide ${isActiveRow ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>{rows[row].name}</span>
                          <span className="text-[9px] font-mono text-slate-500">{rowOccupancy(row)}/3</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                          {rowSlots.map((slot, colIdx) => {
                            const globalIdx = row * 3 + colIdx;
                            const planterId = `crop${globalIdx + 1}`;
                            return (
                              <div key={planterId} id={planterId} className="relative flex flex-col items-center">
                                <button
                                  onClick={() => handlePlanterClick(row)}
                                  className={`relative aspect-square w-full rounded-full transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 flex items-center justify-center ${isRunning && slot === 'empty' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                  aria-label={`${planterId}, ${slot === 'empty' ? 'empty' : slot}`}
                                  style={{
                                    backgroundColor: '#5b3a2c',
                                    boxShadow: slot !== 'empty'
                                      ? `0 0 0 5px ${ringColor}, inset 0 0 0 2px rgba(0,0,0,0.05)`
                                      : `0 0 0 ${isActiveRow ? '4px' : '3px'} ${ringColor}`,
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
                      </div>
                    );
                  })}
                </div>

                {/* One View Chart action for the ACTIVE row — shown only when that row is planted.
                    Opens /dashboard/simulation for the active row (the chart page itself is unchanged). */}
                {rowOccupancy(activeRow) > 0 && (
                  <button
                    onClick={() => handleViewChart(activeRow)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950/40 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:border-emerald-400/50 hover:text-emerald-200 transition-colors"
                  >
                    <LineChartIcon size={14} /> View Chart — {rows[activeRow].name}
                  </button>
                )}

                {cropConfirmation && (
                  <div className="mt-2 text-center text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800 rounded-lg py-2 px-3">
                    {cropConfirmation}
                  </div>
                )}
              </div>
            </div>

            {/* Alerts Console */}
            <div role="status" aria-live="polite" className="h-32 bg-black/40 border border-slate-800 rounded-lg p-3 overflow-y-auto text-xs">
              <div className="sticky top-0 bg-slate-950/90 border-b border-slate-800 pb-1 mb-2 flex justify-between items-center">
                 <span className="font-bold text-slate-400 uppercase tracking-wider">System Log</span>
                 {alerts.length > 0 && <span className="text-red-400 animate-pulse flex items-center gap-1"><AlertTriangle size={10}/> Attention Needed</span>}
              </div>
              {alerts.length === 0 ? (
                <div className="text-slate-600 italic p-2">System Nominal. No active alerts.</div>
              ) : (
                <div className="space-y-1 font-mono">
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
               <MetricGauge label="pH Level" value={params.ph} unit="" min={4.0} max={8.0} optimal={activeOptimal.ph} />
               <MetricGauge label="Air Temp" value={params.temp} unit="°C" min={10} max={40} optimal={activeOptimal.temp} />
               <MetricGauge label="Humidity" value={params.humidity} unit="%" min={0} max={100} optimal={activeOptimal.humidity} />
               <MetricGauge label="CO2 (ppm)" value={params.co2} unit="" min={300} max={1200} optimal={activeOptimal.co2} />
            </Card>

            <Card className="relative overflow-hidden">
               {/* Header row: title + source badge side by side (badge no longer absolutely
                   positioned, so it can't overlap the row name in the title). */}
               <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider truncate">Harvest Quality — {rows[activeRow].name}</h3>
                  <div className="shrink-0 text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                     <Cpu size={10} /> {predictionByRow[activeRow] ? 'Engine' : 'Local'}
                  </div>
               </div>

               {(() => {
                 // Discount the engine's instantaneous quality by accumulated health, so damage has a
                 // lasting yield consequence (a rescued plant doesn't snap back to 100%). predict_yield
                 // itself is untouched — this penalty lives only in the display, keeping the AGC-validated
                 // function intact. sqrt softens the discount in the mid-range (a 55%-health plant keeps
                 // ~74% of its yield, not 55%) so "mildly off on everything" isn't unduly punishing, while
                 // still going to 0 when the plant is actually dead (health 0 → yields nothing).
                 const rowPrediction = predictionByRow[activeRow];
                 const rowHealth = healthByRow[activeRow];
                 const harvestQuality = rowPrediction ? rowPrediction.harvestQuality * Math.sqrt(rowHealth) : metrics.yieldPrediction;
                 const stress = rowPrediction ? rowPrediction.stressFactor : metrics.stressLevel;
                 return (
                   <>
                     <div className="text-center py-4">
                        <div className="text-4xl font-bold text-white mb-1">{harvestQuality.toFixed(0)}%</div>
                        <div className="text-xs text-slate-400">Estimated Harvest Quality</div>
                     </div>

                     <div className="space-y-2 mt-2">
                        {rowPrediction && (
                           <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Est. Time to Harvest</span>
                              <span className="text-slate-200 font-mono">{rowPrediction.timeToHarvest.toFixed(0)} days</span>
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
                           {rowPrediction
                             ? rowPrediction.explanation
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
