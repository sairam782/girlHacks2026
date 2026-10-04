import { NextResponse } from 'next/server';
import { extract } from '@/lib/extract';
import { getState, ingestItems } from '@/lib/store';
import { isDate, todayISO, weekday, WEEKDAYS } from '@/lib/dates';
import { fail, readJson } from '@/lib/http';
import type { SourceKind } from '@/lib/types';

export const maxDuration = 60;

interface Body { text?: unknown; projectId?: unknown; meetingDate?: unknown; kind?: unknown; title?: unknown }

export async function POST(req: Request) {
  try {
    const b = await readJson<Body>(req);
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'Paste some text first.' }, { status: 400 });
    if (text.length > 60000) return NextResponse.json({ error: 'Text is too long (60k characters max).' }, { status: 400 });

    const state = await getState();
    const projectId = typeof b.projectId === 'string' ? b.projectId : '';
    if (!state.projects.some((p) => p.id === projectId)) return NextResponse.json({ error: 'Pick a project.' }, { status: 400 });

    const meetingDate = isDate(b.meetingDate) ? b.meetingDate : todayISO();
    const kind: SourceKind = b.kind === 'chat' || b.kind === 'doc' ? b.kind : 'mtg';
    const people = state.people.map((p) => p.name);
    const { items, engine, note } = await extract(text, meetingDate, WEEKDAYS[weekday(meetingDate)], people);
    const title = typeof b.title === 'string' && b.title.trim()
      ? b.title.trim()
      : kind === 'chat' ? 'Chat thread' : kind === 'doc' ? 'Document' : 'Meeting';

    const result = await ingestItems({ projectId, title, kind, meetingDate, text }, items);
    return NextResponse.json({ ...result, engine, note });
  } catch (e) {
    return fail(e);
  }
}
