// Pure helpers for loading the local synthetic dataset that backs the simulation.
// Kept free of any Next.js / fs imports so they can be unit-tested directly and
// reused by both the API route (app/api/dataset/route.ts) and the dashboard.

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

// UI crop ids -> dataset `crop_type` values. The dashboard uses "tomatoes" while the
// dataset stores "tomato"; this mirrors the alias map in backend/app/sim/dataset.py so
// the frontend and backend resolve crops the same way.
const CROP_ALIASES: Record<string, string> = {
  tomatoes: 'tomato',
  tomato: 'tomato',
  lettuce: 'lettuce',
};

// Map a UI crop id (e.g. "tomatoes") to its dataset crop_type, case-insensitively.
export function normalizeCrop(crop: string): string {
  const key = (crop || '').trim().toLowerCase();
  return CROP_ALIASES[key] ?? key;
}

// Parse the raw CSV text into typed rows.
export function parseDataset(csvText: string): DatasetRow[] {
  const [headerLine, ...lines] = csvText.trim().split('\n');
  const headers = headerLine.split(',');

  return lines.map(line => {
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
  });
}

// Return the rows for a single crop, sorted by `day` so the simulation can replay them
// in grow-cycle order (seedling -> harvest). Filtering is crop-only: the System Setup
// selector does not narrow rows (the synthetic generator does not vary values by
// system_type, so a system filter would not change the playback). Crops with no rows
// (e.g. herbs, cucumbers) return an empty array, which the dashboard treats as "no
// dataset" and falls back to its local drift.
export function filterRowsForCrop(rows: DatasetRow[], crop: string): DatasetRow[] {
  const target = normalizeCrop(crop);
  return rows
    .filter(r => r.crop_type?.toLowerCase() === target)
    .sort((a, b) => a.day - b.day);
}
