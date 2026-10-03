import { NextResponse } from 'next/server';
import { getState } from '@/lib/store';
import { todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getState();
  return NextResponse.json({ ...s, today: todayISO(), engines: { gemini: !!process.env.GEMINI_API_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY, tiger: !!process.env.DATABASE_URL } });
}
