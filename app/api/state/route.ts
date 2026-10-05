import { NextResponse } from 'next/server';
import { getState } from '@/lib/store';
import { todayISO } from '@/lib/dates';
import { databaseStore } from '@/lib/persistence';
import { tigerEnabled } from '@/lib/tiger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const s = await getState();
    return NextResponse.json({ ...s, today: todayISO(), demoMode: process.env.CANOPY_DEMO_MODE === 'true', engines: { gemini: !!process.env.GEMINI_API_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY, tiger: tigerEnabled(), database: databaseStore() } }, { headers });
  } catch (error) {
    console.error('[state] database unavailable', error);
    return NextResponse.json({ error: 'The database is temporarily unavailable. Retrying automatically.' }, { status: 503, headers });
  }
}
