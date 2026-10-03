import { NextResponse } from 'next/server';
import { briefing } from '@/lib/briefing';
import { getState } from '@/lib/store';
import { isDate, todayISO } from '@/lib/dates';

export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json();
  try { return NextResponse.json(await briefing(b.personId, await getState(), isDate(b.asof) ? b.asof : todayISO())); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 404 }); }
}
