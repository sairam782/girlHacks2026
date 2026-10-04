import { NextResponse } from 'next/server';
import { buildDemo, describeDemo } from '@/lib/demo';
import { loadDemoState } from '@/lib/store';
import { todayISO } from '@/lib/dates';

// Loads the synthetic demo data. Without { "force": true } it only works on an empty app.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const today = todayISO();
  const demo = buildDemo(today);
  try {
    await loadDemoState(demo, b.force === true);
    return NextResponse.json({ ok: true, today, ...describeDemo(demo, today) });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }); }
}
