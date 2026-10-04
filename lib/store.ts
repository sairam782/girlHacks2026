// Server-side persistence. Entities live in a JSON file; every CommitmentEvent is also mirrored to Tiger Data when configured.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { todayISO, diffDays } from './dates';
import { tigerDeleteItems, tigerHistory, tigerInsert } from './tiger';
import type { ActionItem, AppState, CommitmentEvent, EventType, Extracted, Person, Project, Source, SourceKind } from './types';

export const DATA_DIR = process.env.CANOPY_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'store.json');
const empty = (): AppState => ({ projects: [], people: [], sources: [], items: [], events: [] });

let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<AppState> {
  try { return { ...empty(), ...JSON.parse(await fs.readFile(FILE, 'utf8')) }; } catch { return empty(); }
}

// Serialises read-modify-write cycles so concurrent requests cannot clobber each other.
export function mutate<T>(fn: (s: AppState, log: (e: Omit<CommitmentEvent, 'time'> & { time?: string }) => void) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const s = await read();
    const pending: CommitmentEvent[] = [];
    const out = await fn(s, (e) => { const ev = { time: new Date().toISOString(), ...e } as CommitmentEvent; s.events.push(ev); pending.push(ev); });
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE + '.tmp', JSON.stringify(s, null, 2));
    await fs.rename(FILE + '.tmp', FILE);
    void tigerInsert(pending);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function getState(): Promise<AppState> {
  await queue;
  const today = todayISO();
  const isLate = (i: ActionItem) => i.status === 'open' && !!i.deadline && diffDays(i.deadline, today) > 0;
  // Overdue is derived from the clock, so log it once, the first time a leaf is seen past its deadline.
  // The check runs inside the serialised mutation so concurrent requests cannot log it twice.
  const s = await read();
  const logged = new Set(s.events.filter((e) => e.event_type === 'overdue').map((e) => e.action_item_id));
  if (!s.items.some((i) => isLate(i) && !logged.has(i.id))) return s;
  return mutate((st, log) => {
    const seen = new Set(st.events.filter((e) => e.event_type === 'overdue').map((e) => e.action_item_id));
    for (const i of st.items) {
      if (isLate(i) && !seen.has(i.id)) log({ action_item_id: i.id, project_id: i.project_id, event_type: 'overdue', old_value: i.deadline, new_value: today, time: new Date(`${i.deadline}T23:59:59`).toISOString() });
    }
    return st;
  });
}

export async function historyFor(projectId: string): Promise<CommitmentEvent[]> {
  const local = (await getState()).events.filter((e) => e.project_id === projectId);
  const t = await tigerHistory(projectId);
  // Tiger only holds what was written through the app. Seeded or imported history lives in the
  // JSON store, so fall back whenever Tiger knows less than we already do.
  return t && t.length >= local.length ? t : local;
}

export const createProject = (name: string) =>
  mutate<Project>((s) => { const p = { id: randomUUID().slice(0, 8), name: name.trim(), created_at: new Date().toISOString() }; s.projects.push(p); return p; });

// "Priya" matches "Priya S." and vice versa; anything else becomes a new person.
export function findOrAddPerson(s: AppState, name: string): Person {
  const n = name.trim().toLowerCase();
  const first = (x: string) => x.toLowerCase().split(/\s+/)[0].replace(/\.$/, '');
  const hit = s.people.find((p) => p.name.toLowerCase() === n) || s.people.find((p) => first(p.name) === first(name));
  if (hit) {
    if (name.trim().length > hit.name.length && first(hit.name) === first(name)) hit.name = name.trim();
    return hit;
  }
  const p = { id: randomUUID().slice(0, 8), name: name.trim() };
  s.people.push(p);
  return p;
}

/** Same wording, same owner, same project: one commitment, however many times it was said. */
const itemKey = (projectId: string, text: string, ownerId: string | null) =>
  `${projectId}|${ownerId ?? ''}|${text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()}`;

export function ingestItems(input: { projectId: string; title: string; kind: SourceKind; meetingDate: string; text: string }, extracted: Extracted[]) {
  return mutate((s, log) => {
    if (!s.projects.some((p) => p.id === input.projectId)) throw new Error('Unknown project');

    // Pasting the same transcript twice (a double click, or a re-paste after a tweak) used to
    // grow a second copy of every leaf. Hand back what that text produced the first time.
    const same = s.sources.find((x) => x.project_id === input.projectId && x.text === input.text && input.text.length > 0);
    if (same) {
      return { source: same, items: s.items.filter((i) => i.source_id === same.id), duplicate: true as const };
    }

    const src: Source = { id: randomUUID().slice(0, 8), project_id: input.projectId, kind: input.kind, title: input.title, meeting_date: input.meetingDate, text: input.text, created_at: new Date().toISOString(), extracted: extracted.length };
    s.sources.push(src);
    const created: ActionItem[] = [];
    // Created events carry the meeting's time so history lines up with when the commitment was made.
    const at = new Date(`${input.meetingDate}T09:00:00`);
    const when = (at.getTime() > Date.now() ? new Date() : at).toISOString();
    // Overlapping sources restate the same promise; keep the first and skip the repeat.
    const seen = new Set(s.items.filter((i) => i.status === 'open').map((i) => itemKey(i.project_id, i.text, i.owner_id)));
    let skipped = 0;
    for (const x of extracted) {
      const owner = x.owner ? findOrAddPerson(s, x.owner) : null;
      const key = itemKey(input.projectId, x.text, owner?.id ?? null);
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      const it: ActionItem = { id: randomUUID().slice(0, 8), project_id: input.projectId, source_id: src.id, owner_id: owner?.id ?? null, type: x.type, text: x.text, deadline: x.deadline, status: 'open', source_excerpt: x.source_excerpt, workstream: (x.workstream || input.title).trim(), created_at: when, done_at: null };
      s.items.push(it);
      created.push(it);
      log({ action_item_id: it.id, project_id: it.project_id, event_type: 'created', old_value: null, new_value: JSON.stringify({ owner: owner?.name ?? null, deadline: x.deadline }), time: when });
    }
    src.extracted = created.length;
    return { source: src, items: created, skipped };
  });
}

/** Removes one commitment and its history. Returns false when the id is unknown. */
export function deleteItem(id: string) {
  return mutate(async (s) => {
    const i = s.items.findIndex((x) => x.id === id);
    if (i === -1) return false;
    s.items.splice(i, 1);
    s.events = s.events.filter((e) => e.action_item_id !== id);
    await tigerDeleteItems([id]);
    return true;
  });
}

/** Undoes an ingest: the source and every commitment it produced, with their history. */
export function deleteSource(id: string) {
  return mutate(async (s) => {
    const i = s.sources.findIndex((x) => x.id === id);
    if (i === -1) return null;
    const items = s.items.filter((x) => x.source_id === id);
    const ids = new Set(items.map((x) => x.id));
    s.sources.splice(i, 1);
    s.items = s.items.filter((x) => !ids.has(x.id));
    s.events = s.events.filter((e) => !ids.has(e.action_item_id));
    await tigerDeleteItems([...ids]);
    return { removed: items.length };
  });
}

export interface ItemPatch { text?: string; owner?: string | null; deadline?: string | null; done?: boolean; type?: 'action'; nudge?: boolean }

export function patchItem(id: string, p: ItemPatch) {
  return mutate((s, log) => {
    const it = s.items.find((i) => i.id === id);
    if (!it) throw new Error('Unknown item');
    const ev = (event_type: EventType, old_value: string | null, new_value: string | null) => log({ action_item_id: id, project_id: it.project_id, event_type, old_value, new_value });
    const nameOf = (pid: string | null) => s.people.find((x) => x.id === pid)?.name ?? null;
    if (p.owner !== undefined) {
      const next = p.owner ? findOrAddPerson(s, p.owner) : null;
      if ((next?.id ?? null) !== it.owner_id) { ev('reassigned', nameOf(it.owner_id), next?.name ?? null); it.owner_id = next?.id ?? null; }
    }
    if (p.type === 'action' && it.type !== 'action') it.type = 'action';
    if (p.deadline !== undefined && p.deadline !== it.deadline) { ev('deadline_moved', it.deadline, p.deadline); it.deadline = p.deadline; }
    if (p.text !== undefined && p.text.trim() && p.text !== it.text) { ev('edited', it.text, p.text); it.text = p.text.trim(); }
    // A nudge is a reminder sent to the owner with the evidence attached. Recording it means the
    // next person to open this leaf can see it was already chased, and when.
    if (p.nudge) ev('nudged', null, nameOf(it.owner_id));
    if (p.done !== undefined && (p.done ? 'done' : 'open') !== it.status) {
      it.status = p.done ? 'done' : 'open';
      it.done_at = p.done ? new Date().toISOString() : null;
      ev(p.done ? 'done' : 'reopened', p.done ? 'open' : 'done', it.status);
    }
    return it;
  });
}
