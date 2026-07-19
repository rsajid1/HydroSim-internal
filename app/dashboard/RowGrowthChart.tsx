'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export interface RowHistoryPoint {
  time: number;    // simulationTime (hours) at the tick this point was recorded
  growth: number;  // 0-100
  health: number;  // 0-100
  stress: number;  // 0-100
}

interface RowGrowthChartProps {
  data: RowHistoryPoint[];
  rowName: string;
  /** Tailwind height class(es) for the chart container. Defaults to the compact
   *  size used inline on the dashboard; the full-page chart view passes a taller one. */
  heightClassName?: string;
}

export const RowGrowthChart: React.FC<RowGrowthChartProps> = ({ data, rowName, heightClassName = 'h-36' }) => {
  if (data.length < 2) {
    return (
      <div className={`${heightClassName} mt-3 flex items-center justify-center bg-slate-950/40 border border-slate-800 rounded-lg`}>
        <span className="text-[11px] text-slate-500 italic">Waiting for simulation data…</span>
      </div>
    );
  }

  return (
    <div className={`${heightClassName} mt-3 bg-slate-950/40 border border-slate-800 rounded-lg p-2`} aria-label={`${rowName} growth chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={(t: number) => `${t}h`}
            stroke="#334155"
          />
          <YAxis
            domain={[0, 100]}
            width={28}
            tick={{ fontSize: 10, fill: '#64748b' }}
            stroke="#334155"
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }}
            labelFormatter={(t: number) => `${t}h`}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="growth" name="Growth %" stroke="#3987e5" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="health" name="Health %" stroke="#008300" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="stress" name="Stress %" stroke="#e66767" strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
