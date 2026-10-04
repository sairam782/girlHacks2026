import { NextResponse } from 'next/server';
import { briefing } from '@/lib/briefing';
import { getState } from '@/lib/store';
import { isDate, todayISO } from '@/lib/dates';
import { fail, readJson } from '@/lib/http';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await readJson<{ personId?: string; asof?: unknown }>(req);
    return NextResponse.json(await briefing(String(b.personId ?? ''), await getState(), isDate(b.asof) ? b.asof : todayISO()));
  } catch (e) { return fail(e, 404); }
}
