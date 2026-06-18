import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface DatasetRow {
  simulation_id: string;
  crop_type: string;
  growth_stage: string;
  system_type: string;
  day: number;
  ph: number;
  ec: number;
  air_temperature_c: number;
  humidity_percent: number;
  co2_ppm: number;
  water_level_percent: number;
  stress_score: number;
  predicted_yield_score: number;
  risk_level: string;
  status: string;
}

export async function GET(_req: NextRequest) {

  const csvPath = path.join(process.cwd(), 'data', 'synthetic_hydroponics_dataset.csv');
  const text = fs.readFileSync(csvPath, 'utf-8');
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',');

  const rows: DatasetRow[] = lines
    .map(line => {
      const vals = line.split(',');
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h.trim()] = vals[i]?.trim() ?? ''; });
      return {
        simulation_id: obj.simulation_id,
        crop_type: obj.crop_type,
        growth_stage: obj.growth_stage,
        system_type: obj.system_type,
        day: parseInt(obj.day),
        ph: parseFloat(obj.ph),
        ec: parseFloat(obj.ec),
        air_temperature_c: parseFloat(obj.air_temperature_c),
        humidity_percent: parseFloat(obj.humidity_percent),
        co2_ppm: parseFloat(obj.co2_ppm),
        water_level_percent: parseFloat(obj.water_level_percent),
        stress_score: parseFloat(obj.stress_score),
        predicted_yield_score: parseFloat(obj.predicted_yield_score),
        risk_level: obj.risk_level,
        status: obj.status,
      } as DatasetRow;
    })
    .filter(r => r.crop_type === 'lettuce' && (r.system_type === 'nft' || r.system_type === 'aeroponics'));

  return NextResponse.json(rows);
}
