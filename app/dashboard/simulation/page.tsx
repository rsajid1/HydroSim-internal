'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Sprout, Cpu } from 'lucide-react';
import { useSimulation } from '../SimulationProvider';
import { RowGrowthChart } from '../RowGrowthChart';

export default function SimulationChartPage() {
  const {
    activeRow, setActiveRow, rows, plants,
    growthStageByRow, healthByRow, plantDeadByRow, historyByRow, predictionByRow,
    metrics, simulationTime, getGrowthLabel, rowCrop,
  } = useSimulation();

  const isPlanted = plants[activeRow * 3] !== 'empty';
  const crop = rowCrop(activeRow);
  const rowPrediction = predictionByRow[activeRow];
  const rowHealth = healthByRow[activeRow];

  // Same discount/fallback logic as the dashboard's Harvest Quality card, for
  // whichever row is currently selected here.
  const harvestQuality = rowPrediction ? rowPrediction.harvestQuality * Math.sqrt(rowHealth) : metrics.yieldPrediction;
  const stress = rowPrediction ? rowPrediction.stressFactor : metrics.stressLevel;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="font-mono text-white text-sm">{simulationTime} Hours</div>
        </div>

        <div className="flex gap-2">
          {rows.map((row) => {
            const active = row.id === activeRow;
            return (
              <button
                key={row.id}
                onClick={() => setActiveRow(row.id)}
                aria-pressed={active}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {row.name}
              </button>
            );
          })}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          {!isPlanted ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              Nothing planted in {rows[activeRow].name} yet — plant a crop from the dashboard to see its growth chart.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sprout size={14} className="text-green-400" />
                  <span>{rows[activeRow].name}{crop ? ` — ${crop.name}` : ''}</span>
                  <span className="text-white font-semibold">
                    {getGrowthLabel(growthStageByRow[activeRow])} ({Math.floor(growthStageByRow[activeRow])}%)
                  </span>
                  <span className={`font-semibold ${plantDeadByRow[activeRow] ? 'text-red-500' : healthByRow[activeRow] >= 0.7 ? 'text-green-400' : healthByRow[activeRow] >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                    · {plantDeadByRow[activeRow] ? 'DEAD' : `Health ${Math.round(healthByRow[activeRow] * 100)}%`}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                  <Cpu size={10} /> {rowPrediction ? 'Engine' : 'Local'}
                </div>
              </div>

              <RowGrowthChart
                data={historyByRow[activeRow]}
                rowName={rows[activeRow].name}
                heightClassName="h-[60vh] min-h-[360px]"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 text-sm">
                <div>
                  <div className="text-slate-500 text-xs">Harvest Quality</div>
                  <div className="text-white text-lg font-semibold">{harvestQuality.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Stress Factor</div>
                  <div className={`text-lg font-semibold ${stress > 20 ? 'text-red-400' : 'text-green-400'}`}>
                    {stress.toFixed(1)}%
                  </div>
                </div>
                {rowPrediction && (
                  <div>
                    <div className="text-slate-500 text-xs">Est. Time to Harvest</div>
                    <div className="text-white text-lg font-semibold">{rowPrediction.timeToHarvest.toFixed(0)} days</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
