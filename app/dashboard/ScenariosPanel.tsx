'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, Pencil, Check } from 'lucide-react';
import { useSimulation } from './SimulationProvider';
import type { Scenario, ScenarioMetrics } from '@/lib/scenarioMetrics';

// Compare Scenarios (issue #10). Lives in the (repurposed) Dashboard tab. Three modes: a card grid,
// a single-scenario detail, and a side-by-side comparison table. Metrics come straight from the
// engine-fed store — no AI here.

const MAX_COMPARE = 3;

const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ScenariosPanel({
  onStartNewSession, initialViewId,
}: {
  onStartNewSession: () => void;
  /** Opens straight into this scenario's report on mount — used by Save Session so saving a run
   *  acts as "View Report" instead of landing on the grid first. */
  initialViewId?: string | null;
}) {
  const { scenarios, deleteScenario, renameScenario, handleReset } = useSimulation();
  const [selected, setSelected] = useState<string[]>([]);
  const [viewId, setViewId] = useState<string | null>(initialViewId ?? null);
  const [comparing, setComparing] = useState(false);

  const toggle = (id: string) =>
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev,
    );

  const viewing = scenarios.find(s => s.id === viewId) ?? null;
  const chosen = selected
    .map(id => scenarios.find(s => s.id === id))
    .filter((s): s is Scenario => Boolean(s));

  if (viewing) {
    return (
      <ScenarioDetail
        scenario={viewing}
        onBack={() => setViewId(null)}
        onRename={renameScenario}
        onDelete={id => { deleteScenario(id); setViewId(null); }}
        onStartNewSession={() => { handleReset(); onStartNewSession(); }}
      />
    );
  }

  if (comparing && chosen.length >= 2) {
    return <ScenarioCompare scenarios={chosen} onBack={() => setComparing(false)} />;
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Compare Scenarios</h2>
            <p className="text-xs text-slate-400">Saved runs — select 2–3 to see how their settings affected yield and stress.</p>
          </div>
          <button
            onClick={() => setComparing(true)}
            disabled={chosen.length < 2}
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Compare selected · {selected.length}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => { handleReset(); onStartNewSession(); }}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800/60 bg-slate-950/60 shadow-inner shadow-black/40 hover:border-blue-500/50 hover:bg-slate-950 text-slate-400 hover:text-blue-300 transition-all p-6 min-h-[168px] text-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/30 group-hover:bg-blue-600/25 transition-colors">
              <Plus size={20} />
            </span>
            <span className="font-medium text-sm">Start new session</span>
            <span className="text-xs text-slate-500">Set up and run a simulation, then Save Session to capture it here.</span>
          </button>

          {scenarios.map(s => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              selected={selected.includes(s.id)}
              selectDisabled={!selected.includes(s.id) && selected.length >= MAX_COMPARE}
              onToggle={() => toggle(s.id)}
              onView={() => setViewId(s.id)}
              onDelete={() => { deleteScenario(s.id); setSelected(prev => prev.filter(x => x !== s.id)); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario, selected, selectDisabled, onToggle, onView, onDelete,
}: {
  scenario: Scenario;
  selected: boolean;
  selectDisabled: boolean;
  onToggle: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const m = scenario.metrics;
  return (
    <div className={`rounded-xl border p-4 bg-slate-900 shadow-lg transition-all ${selected ? 'border-blue-500 ring-1 ring-blue-500/40 shadow-blue-900/25' : 'border-slate-800 shadow-black/50 hover:shadow-black/70'}`}>
      <div className="flex items-start justify-between gap-2">
        <label className="flex items-center gap-2 cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={selectDisabled}
            aria-label={`Select ${scenario.label} to compare`}
            className="accent-blue-500 shrink-0 disabled:opacity-40"
          />
          <span className="font-medium text-white truncate">{scenario.label}</span>
        </label>
        <button onClick={onDelete} title="Delete scenario" aria-label={`Delete ${scenario.label}`} className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="text-xs text-slate-400 mt-1">{scenario.cropName} · {scenario.systemName}</div>
      <div className="text-xs text-slate-500">{fmtDate(scenario.createdAt)}</div>
      <div className="flex gap-6 mt-3">
        <div>
          <span className="text-slate-500 text-[10px] uppercase block">Yield</span>
          <span className="font-mono text-blue-400 text-sm">{m.finalYieldDisplayed}%</span>
        </div>
        <div>
          <span className="text-slate-500 text-[10px] uppercase block">Avg stress</span>
          <span className="font-mono text-slate-200 text-sm">{m.avgStress}</span>
        </div>
      </div>
      <button onClick={onView} className="mt-3 w-full text-xs font-medium text-slate-300 border border-slate-700 bg-slate-950/40 rounded-lg py-1.5 hover:bg-slate-800 hover:text-white transition-colors">
        View details
      </button>
    </div>
  );
}

function ScenarioDetail({
  scenario, onBack, onRename, onDelete, onStartNewSession,
}: {
  scenario: Scenario;
  onBack: () => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onStartNewSession: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(scenario.label);
  const m = scenario.metrics;
  const f = scenario.finalSettings;
  const stageEntries = Object.entries(m.stageHours);
  const totalStageHours = stageEntries.reduce((sum, [, hours]) => sum + hours, 0);

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-2">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => { setLabel(scenario.label); setEditing(true); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md px-2 py-1 transition-colors">
              <Pencil size={12} /> Rename
            </button>
            <button onClick={() => onDelete(scenario.id)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-500/40 rounded-md px-2 py-1 transition-colors">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>

        {editing ? (
          <div className="flex items-center gap-2 mb-1">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              aria-label="Scenario name"
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-lg font-semibold focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <button onClick={() => { onRename(scenario.id, label.trim() || scenario.label); setEditing(false); }} title="Save name" className="text-blue-400 hover:text-blue-300">
              <Check size={20} />
            </button>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-white">{scenario.label}</h2>
        )}
        <p className="text-xs text-slate-400 mb-6">{scenario.cropName} · {scenario.systemName} · {fmtDate(scenario.createdAt)} · ran {m.durationHours} sim-h</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 ring-1 ring-inset ring-white/5 shadow-lg shadow-black/20">
            <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">Outcome</h3>
            <DetailRow label="Final yield (displayed)" value={`${m.finalYieldDisplayed}%`} sub={`raw ${m.finalYieldRaw}% × √health`} />
            <DetailRow label="Final health" value={`${m.finalHealth}%`} />
            <DetailRow label="Average stress" value={`${m.avgStress} / 100`} />
            <DetailRow label="Time out of range" value={`${m.timeOutOfRangeHours} sim-h`} />
            <DetailRow label="Time to harvest" value={`${m.timeToHarvestDays} days`} />
            <DetailRow label="Duration" value={`${m.durationHours} sim-h`} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 ring-1 ring-inset ring-white/5 shadow-lg shadow-black/20">
            <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">Environment</h3>
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-2 text-sm items-baseline">
              <span></span>
              <span className="text-slate-500 text-[10px] uppercase text-right">avg</span>
              <span className="text-slate-500 text-[10px] uppercase text-right">min</span>
              <span className="text-slate-500 text-[10px] uppercase text-right">max</span>
              <span className="text-slate-500 text-[10px] uppercase text-right">final set</span>
              <EnvRow label="pH" avg={m.envAvg.ph} min={m.envMin.ph} max={m.envMax.ph} final={f.ph} />
              <EnvRow label="Temp (°C)" avg={m.envAvg.temp} min={m.envMin.temp} max={m.envMax.temp} final={f.temp} />
              <EnvRow label="Humidity (%)" avg={m.envAvg.humidity} min={m.envMin.humidity} max={m.envMax.humidity} final={f.humidity} />
              <EnvRow label="CO₂ (ppm)" avg={m.envAvg.co2} min={m.envMin.co2} max={m.envMax.co2} final={f.co2} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 ring-1 ring-inset ring-white/5 shadow-lg shadow-black/20">
            <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">Stage timeline</h3>
            {stageEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No growth-stage data was recorded for this run.</p>
            ) : (
              <div className="space-y-2">
                {stageEntries.map(([stage, hours]) => {
                  const pct = totalStageHours > 0 ? (hours / totalStageHours) * 100 : 0;
                  return (
                    <div key={stage}>
                      <div className="flex items-baseline justify-between text-sm mb-1">
                        <span className="text-slate-300">{stage}</span>
                        <span className="font-mono text-slate-400 text-xs">{hours} sim-h</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                        <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 ring-1 ring-inset ring-white/5 shadow-lg shadow-black/20">
            <h3 className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">Major warnings</h3>
            {m.warnings.length === 0 ? (
              <p className="text-sm text-slate-500">No sustained deviations — this run stayed on target throughout.</p>
            ) : (
              <ul className="space-y-2">
                {m.warnings.map((w, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={w.type === 'critical' ? 'text-red-400' : 'text-yellow-400'}>
                      {w.type === 'critical' ? '● ' : '● '}{w.msg}
                    </span>
                    <span className="font-mono text-slate-500 text-xs whitespace-nowrap">{w.hours} sim-h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          onClick={onStartNewSession}
          className="mt-6 w-full sm:w-auto px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Start new scenario
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-right">
        <span className="font-mono text-slate-100 text-sm">{value}</span>
        {sub && <span className="block text-[10px] text-slate-500">{sub}</span>}
      </span>
    </div>
  );
}

function EnvRow({
  label, avg, min, max, final,
}: { label: string; avg: number; min: number; max: number; final: number }) {
  return (
    <>
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-100 text-right">{avg}</span>
      <span className="font-mono text-slate-500 text-right">{min}</span>
      <span className="font-mono text-slate-500 text-right">{max}</span>
      <span className="font-mono text-slate-400 text-right">{final}</span>
    </>
  );
}

// --- Comparison table ---

type OutcomeRow = { label: string; get: (m: ScenarioMetrics) => number; unit: string; best: 'max' | 'min' };
const OUTCOME_ROWS: OutcomeRow[] = [
  { label: 'Final yield', get: m => m.finalYieldDisplayed, unit: '%', best: 'max' },
  { label: 'Avg stress', get: m => m.avgStress, unit: '', best: 'min' },
  { label: 'Time out of range', get: m => m.timeOutOfRangeHours, unit: ' h', best: 'min' },
  { label: 'Time to harvest', get: m => m.timeToHarvestDays, unit: ' d', best: 'min' },
  { label: 'Final health', get: m => m.finalHealth, unit: '%', best: 'max' },
];
const ENV_ROWS: { label: string; get: (s: Scenario) => number }[] = [
  { label: 'pH', get: s => s.metrics.envAvg.ph },
  { label: 'Temp (°C)', get: s => s.metrics.envAvg.temp },
  { label: 'Humidity (%)', get: s => s.metrics.envAvg.humidity },
  { label: 'CO₂ (ppm)', get: s => s.metrics.envAvg.co2 },
];

function ScenarioCompare({ scenarios, onBack }: { scenarios: Scenario[]; onBack: () => void }) {
  const base = scenarios[0];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          <span className="text-xs text-slate-500">
            <span className="text-amber-400">■</span> differs from {base.label} · <span className="text-emerald-400">■</span> best
          </span>
        </div>
        <h2 className="text-lg font-semibold text-white mb-4">Comparing {scenarios.length} scenarios</h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800 ring-1 ring-inset ring-white/5 shadow-lg shadow-black/20">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900">
                <th className="text-left font-medium text-slate-400 p-3 sticky left-0 bg-slate-900">Metric</th>
                {scenarios.map(s => (
                  <th key={s.id} className="text-left font-semibold text-white p-3 min-w-[130px]">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Configuration (diff vs baseline) */}
              <ConfigRow label="Crop" scenarios={scenarios} get={s => s.cropName} base={base} />
              <ConfigRow label="System" scenarios={scenarios} get={s => s.systemName} base={base} />

              <SectionRow label="Outcome" span={scenarios.length + 1} />
              {OUTCOME_ROWS.map(row => {
                const values = scenarios.map(s => row.get(s.metrics));
                const bestVal = row.best === 'max' ? Math.max(...values) : Math.min(...values);
                return (
                  <tr key={row.label} className="border-t border-slate-800">
                    <td className="text-slate-400 p-3 sticky left-0 bg-slate-950">{row.label}</td>
                    {scenarios.map((s, i) => {
                      const isBest = values[i] === bestVal;
                      return (
                        <td key={s.id} className={`p-3 font-mono ${isBest ? 'text-emerald-400 font-semibold' : 'text-slate-200'}`}>
                          {values[i]}{row.unit}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              <SectionRow label="Environment (avg over run)" span={scenarios.length + 1} />
              {ENV_ROWS.map(row => (
                <ConfigRow key={row.label} label={row.label} scenarios={scenarios} get={s => String(row.get(s))} base={base} mono />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="bg-slate-900/60">
      <td colSpan={span} className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 py-2">{label}</td>
    </tr>
  );
}

function ConfigRow({
  label, scenarios, get, base, mono = false,
}: {
  label: string;
  scenarios: Scenario[];
  get: (s: Scenario) => string;
  base: Scenario;
  mono?: boolean;
}) {
  const baseVal = get(base);
  return (
    <tr className="border-t border-slate-800">
      <td className="text-slate-400 p-3 sticky left-0 bg-slate-950">{label}</td>
      {scenarios.map((s, i) => {
        const val = get(s);
        const differs = i > 0 && val !== baseVal;
        return (
          <td key={s.id} className={`p-3 ${mono ? 'font-mono' : ''} ${differs ? 'text-amber-400' : 'text-slate-200'}`}>
            {val}
          </td>
        );
      })}
    </tr>
  );
}