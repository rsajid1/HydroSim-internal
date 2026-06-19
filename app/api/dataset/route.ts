import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { parseDataset, filterRowsForCrop } from '@/lib/dataset';

// Re-export the row type so existing importers of this route keep working.
export type { DatasetRow } from '@/lib/dataset';

export async function GET(req: NextRequest) {
  const crop = req.nextUrl.searchParams.get('crop') ?? 'lettuce';
  const csvPath = path.join(process.cwd(), 'data', 'synthetic_hydroponics_dataset.csv');

  let text: string;
  try {
    text = fs.readFileSync(csvPath, 'utf-8');
  } catch (error) {
    // Missing/unreadable dataset file -> clear error instead of an unhandled 500.
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Dataset file could not be read: ${message}` },
      { status: 500 },
    );
  }

  const rows = filterRowsForCrop(parseDataset(text), crop);
  return NextResponse.json(rows);
}
