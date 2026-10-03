import { NextResponse } from 'next/server';
import { extract } from '@/lib/extract';
import { getState, ingestItems } from '@/lib/store';
import { isDate, todayISO, weekday, WEEKDAYS } from '@/lib/dates';
import type { SourceKind } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json();
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'Paste some text first.' }, { status: 400 });
  if (text.length > 60000) return NextResponse.json({ error: 'Text is too long (60k characters max).' }, { status: 400 });
  const state = await getState();
  if (!state.projects.some((p) => p.id === b.projectId)) return NextResponse.json({ error: 'Pick a project.' }, { status: 400 });
  const meetingDate = isDate(b.meetingDate) ? b.meetingDate : todayISO();
  const kind: SourceKind = ['mtg', 'chat', 'doc'].includes(b.kind) ? b.kind : 'mtg';
  const people = state.people.map((p) => p.name);
  const { items, engine, note } = await extract(text, meetingDate, WEEKDAYS[weekday(meetingDate)], people);
  const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim() : kind === 'chat' ? 'Chat thread' : kind === 'doc' ? 'Document' : 'Meeting';
  const result = await ingestItems({ projectId: b.projectId, title, kind, meetingDate, text }, items);
  return NextResponse.json({ ...result, engine, note });
}
