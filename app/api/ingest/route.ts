import { NextResponse } from 'next/server';
import { extract } from '@/lib/extract';
import { getState, ingestItems } from '@/lib/store';
import { isDate, todayISO, weekday, WEEKDAYS } from '@/lib/dates';
import { fail, readJson } from '@/lib/http';
import type { Extracted, SourceKind } from '@/lib/types';

export const maxDuration = 60;

interface Body {
  text?: unknown; projectId?: unknown; meetingDate?: unknown; kind?: unknown;
  title?: unknown; preview?: unknown; items?: unknown; engine?: unknown;
}

// Two steps so a person reviews what Gemini found before it lands on the tree:
//   { preview: true, ...source }      → extract only, nothing saved
//   { items: Extracted[], ...source } → save exactly these items (as reviewed)
// Without either flag it extracts and saves in one go, as before.
export async function POST(req: Request) {
  try {
    const b = await readJson<Body>(req);
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'Paste some text first.' }, { status: 400 });
    if (text.length > 60000) return NextResponse.json({ error: 'Text is too long (60k characters max).' }, { status: 400 });

    const state = await getState();
    const projectId = typeof b.projectId === 'string' ? b.projectId : '';
    if (!state.projects.some((p) => p.id === projectId)) return NextResponse.json({ error: 'Pick a project.' }, { status: 400 });

    const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
    const dupe = state.sources.find((s) => s.project_id === projectId && s.text && squash(s.text) === squash(text));
    if (dupe) return NextResponse.json({ error: `This text was already added as "${dupe.title}". Delete that source first to re-extract it.` }, { status: 409 });

    const meetingDate = isDate(b.meetingDate) ? b.meetingDate : todayISO();
    const kind: SourceKind = b.kind === 'chat' || b.kind === 'doc' ? b.kind : 'mtg';
    const title = typeof b.title === 'string' && b.title.trim()
      ? b.title.trim()
      : kind === 'chat' ? 'Chat thread' : kind === 'doc' ? 'Document' : 'Meeting';

    // Step two: save exactly what the person approved, re-validated rather than trusted.
    if (Array.isArray(b.items)) {
      const items: Extracted[] = (b.items as Partial<Extracted>[])
        .filter((x) => x && typeof x.text === 'string' && x.text.trim())
        .slice(0, 200)
        .map((x) => ({
          type: x.type === 'decision' ? 'decision' : 'action',
          text: x.text!.trim().slice(0, 300),
          owner: typeof x.owner === 'string' && x.owner.trim() ? x.owner.trim().slice(0, 60) : null,
          deadline: isDate(x.deadline) ? x.deadline : null,
          source_excerpt: typeof x.source_excerpt === 'string' && x.source_excerpt.trim() ? x.source_excerpt.trim().slice(0, 600) : x.text!.trim(),
          workstream: typeof x.workstream === 'string' && x.workstream.trim() ? x.workstream.trim().slice(0, 28) : null,
        }));
      const result = await ingestItems({ projectId, title, kind, meetingDate, text }, items);
      return NextResponse.json({ ...result, engine: typeof b.engine === 'string' ? b.engine : 'reviewed' });
    }

    const people = state.people.map((p) => p.name);
    const { items, engine, note } = await extract(text, meetingDate, WEEKDAYS[weekday(meetingDate)], people);
    if (b.preview === true) return NextResponse.json({ items, engine, note, people });

    const result = await ingestItems({ projectId, title, kind, meetingDate, text }, items);
    return NextResponse.json({ ...result, engine, note });
  } catch (e) {
    return fail(e);
  }
}
