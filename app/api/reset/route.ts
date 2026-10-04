import { NextResponse } from 'next/server';
import { replaceState } from '@/lib/store';
import { buildDemo } from '@/scripts/demo-data.mjs';
import type { AppState } from '@/lib/types';

// "Reset demo": puts the demo grove back, with dates relative to today. Set CANOPY_ALLOW_RESET=false
// on a deployment that holds real data.
export async function POST() {
  if (process.env.CANOPY_ALLOW_RESET === 'false') return NextResponse.json({ error: 'Reset is turned off on this deployment.' }, { status: 403 });
  return NextResponse.json(await replaceState(buildDemo() as AppState));
}
