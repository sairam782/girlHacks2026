import { NextResponse } from 'next/server';
import { getState, historyFor } from '@/lib/store';
import { history } from '@/lib/history';
import { isDate, todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const projectId = u.searchParams.get('projectId') || '';
  // Without one, every filter below matches nothing and the caller gets a confident-looking
  // all-zero report rather than being told what was missing.
  if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
  const asof = isDate(u.searchParams.get('asof')) ? u.searchParams.get('asof')! : todayISO();
  const s = await getState();
  const events = await historyFor(projectId);
  const items = s.items.filter((i) => i.project_id === projectId);
  return NextResponse.json({ events, ...history(items, events, asof) });
}
