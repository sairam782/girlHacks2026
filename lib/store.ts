// Server-side persistence. Entities live in a JSON file; every CommitmentEvent is also mirrored to Tiger Data when configured.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { todayISO, diffDays } from './dates';
import { tigerClear, tigerDeleteItems, tigerHistory, tigerInsert } from './tiger';
import type { ActionItem, AppState, CommitmentEvent, EventType, Extracted, Person, Project, Source, SourceKind } from './types';

// Vercel's disk is read-only except /tmp, so there the store is copied to /tmp on first write.
// Changes then last only as long as that server instance does.
const BUNDLED = path.join(process.env.CANOPY_DATA_DIR || path.join(process.cwd(), '.data'), 'store.json');
export const DATA_DIR = process.env.CANOPY_DATA_DIR || (process.env.VERCEL ? '/tmp/canopy' : path.join(process.cwd(), '.data'));
const FILE = path.join(DATA_DIR, 'store.json');
const empty = (): AppState => ({ projects: [], people: [], sources: [], items: [], events: [] });

let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<AppState> {
  for (const f of [FILE, BUNDLED]) {
    try { return { ...empty(), ...JSON.parse(await fs.readFile(f, 'utf8')) }; } catch { /* try the next one */ }
  }
  return empty();
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
  // Logging overdue is bookkeeping: if the disk cannot be written, still show the grove.
  return mutate((st, log) => {
    const seen = new Set(st.events.filter((e) => e.event_type === 'overdue').map((e) => e.action_item_id));
    for (const i of st.items) {
      if (isLate(i) && !seen.has(i.id)) log({ action_item_id: i.id, project_id: i.project_id, event_type: 'overdue', old_value: i.deadline, new_value: today, time: new Date(`${i.deadline}T23:59:59`).toISOString() });
    }
    return st;
  }).catch((err) => { console.error('[store] could not save overdue events', err); return s; });
}

// Tiger Data is the history of record, but it only holds events written since DATABASE_URL was set
// (seeded or reset demo data, or events from before, live only in the local log). Merge the two,
// dedupe, and drop events for items that have since been deleted.
export async function historyFor(projectId: string): Promise<CommitmentEvent[]> {
  const s = await getState();
  const live = new Set(s.items.filter((i) => i.project_id === projectId).map((i) => i.id));
  const local = s.events.filter((e) => e.project_id === projectId);
  const tiger = (await tigerHistory(projectId)) ?? [];
  const key = (e: CommitmentEvent) => `${e.time}|${e.action_item_id}|${e.event_type}|${e.new_value ?? ''}`;
  const seen = new Set<string>();
  return [...tiger, ...local]
    .filter((e) => live.has(e.action_item_id) && !seen.has(key(e)) && !!seen.add(key(e)))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Replaces everything (used by "Reset demo"). Events are mirrored to Tiger Data too. */
export function replaceState(next: AppState) {
  return mutate(async (s) => {
    Object.assign(s, next);
    // The old history belongs to items that no longer exist, so clear before mirroring: otherwise
    // every reset leaves another full copy in the hypertable that no screen can reach.
    await tigerClear();
    await tigerInsert(next.events);
    return { projects: next.projects.length, items: next.items.length };
  });
}

export const deleteItem = (id: string) =>
  mutate(async (s) => {
    if (!s.items.some((i) => i.id === id)) throw new Error('Unknown item');
    s.items = s.items.filter((i) => i.id !== id);
    s.events = s.events.filter((e) => e.action_item_id !== id);
    await tigerDeleteItems([id]);
    return { ok: true };
  });

/** Deletes a source and every item extracted from it: the undo for a bad paste. */
export const deleteSource = (id: string) =>
  mutate(async (s) => {
    if (!s.sources.some((x) => x.id === id)) throw new Error('Unknown source');
    const gone = new Set(s.items.filter((i) => i.source_id === id).map((i) => i.id));
    s.sources = s.sources.filter((x) => x.id !== id);
    s.items = s.items.filter((i) => !gone.has(i.id));
    s.events = s.events.filter((e) => !gone.has(e.action_item_id));
    await tigerDeleteItems([...gone]);
    return { removed: gone.size };
  });

export const deleteProject = (id: string) =>
  mutate(async (s) => {
    if (!s.projects.some((p) => p.id === id)) throw new Error('Unknown project');
    await tigerDeleteItems(s.items.filter((i) => i.project_id === id).map((i) => i.id));
    s.projects = s.projects.filter((p) => p.id !== id);
    s.sources = s.sources.filter((x) => x.project_id !== id);
    s.items = s.items.filter((i) => i.project_id !== id);
    s.events = s.events.filter((e) => e.project_id !== id);
    // People stay unless they own nothing anywhere any more.
    const owners = new Set(s.items.map((i) => i.owner_id));
    s.people = s.people.filter((p) => owners.has(p.id));
    return { ok: true };
  });

export const createProject = (name: string) =>
  mutate<Project>((s) => { const p = { id: randomUUID().slice(0, 8), name: name.trim(), created_at: new Date().toISOString() }; s.projects.push(p); return p; });

// "Priya" matches "Priya S." and vice versa, but "Sam R." never matches "Sam K.". A bare first name
// only matches when exactly one person has it; anything else becomes a new person.
export function findOrAddPerson(s: AppState, name: string): Person {
  const n = name.trim().toLowerCase();
  const parts = (x: string) => x.toLowerCase().replace(/\./g, '').split(/\s+/).filter(Boolean);
  const first = (x: string) => parts(x)[0] ?? '';
  const last = (x: string) => parts(x)[1]?.[0] ?? '';
  const compatible = (p: Person) => first(p.name) === first(name) && (!last(p.name) || !last(name) || last(p.name) === last(name));
  const candidates = s.people.filter(compatible);
  const hit = s.people.find((p) => p.name.toLowerCase() === n)
    || candidates.find((p) => last(name) && last(p.name) === last(name))
    || (candidates.length === 1 ? candidates[0] : undefined);
  if (hit) {
    if (name.trim().length > hit.name.length && first(hit.name) === first(name)) hit.name = name.trim();
    return hit;
  }
  const p = { id: randomUUID().slice(0, 8), name: name.trim() };
  s.people.push(p);
  return p;
}

export function ingestItems(input: { projectId: string; title: string; kind: SourceKind; meetingDate: string; text: string }, extracted: Extracted[]) {
  return mutate((s, log) => {
    if (!s.projects.some((p) => p.id === input.projectId)) throw new Error('Unknown project');
    const src: Source = { id: randomUUID().slice(0, 8), project_id: input.projectId, kind: input.kind, title: input.title, meeting_date: input.meetingDate, text: input.text, created_at: new Date().toISOString(), extracted: extracted.length };
    s.sources.push(src);
    const created: ActionItem[] = [];
    let skipped = 0;
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const existing = new Set(s.items.filter((i) => i.project_id === input.projectId && i.status === 'open').map((i) => `${i.owner_id ?? ''}|${norm(i.text)}`));
    // Created events carry the meeting's time so history lines up with when the commitment was made.
    const at = new Date(`${input.meetingDate}T09:00:00`);
    const when = (at.getTime() > Date.now() ? new Date() : at).toISOString();
    for (const x of extracted) {
      const owner = x.owner ? findOrAddPerson(s, x.owner) : null;
      const k = `${owner?.id ?? ''}|${norm(x.text)}`;
      if (existing.has(k)) { skipped++; continue; }
      existing.add(k);
      const it: ActionItem = { id: randomUUID().slice(0, 8), project_id: input.projectId, source_id: src.id, owner_id: owner?.id ?? null, type: x.type, text: x.text, deadline: x.deadline, status: 'open', source_excerpt: x.source_excerpt, workstream: (x.workstream || input.title).trim(), created_at: when, done_at: null };
      s.items.push(it);
      created.push(it);
      log({ action_item_id: it.id, project_id: it.project_id, event_type: 'created', old_value: null, new_value: JSON.stringify({ owner: owner?.name ?? null, deadline: x.deadline }), time: when });
    }
    src.extracted = created.length;
    return { source: src, items: created, skipped };
  });
}

export interface ItemPatch { text?: string; owner?: string | null; deadline?: string | null; done?: boolean; type?: 'action'; nudge?: boolean; mood?: string | null }

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
    if (p.mood !== undefined && (p.mood || null) !== (it.mood_flag ?? null)) { ev('mood_flagged', it.mood_flag ?? null, p.mood || null); it.mood_flag = p.mood || null; }
    if (p.done !== undefined && (p.done ? 'done' : 'open') !== it.status) {
      it.status = p.done ? 'done' : 'open';
      it.done_at = p.done ? new Date().toISOString() : null;
      ev(p.done ? 'done' : 'reopened', p.done ? 'open' : 'done', it.status);
    }
    return it;
  });
}
