// Turns raw state into what the screens draw: derived leaf states, tree slots, and per-person stats.
import { diffDays, fmt } from './dates';
import { leafState, slipCount, slipRisk, type Derived } from './leaf';
import type { ActionItem, AppState, CommitmentEvent, Person } from './types';
import { LIMBS, WS_LABEL, type FallenLeaf, type Leaf } from '../components/canopy/data';

export interface VItem {
  it: ActionItem; d: Derived; owner: string | null; slips: number; risk: number; due: string; dueWas?: string; events: CommitmentEvent[];
}

export function viewItems(s: AppState, projectId: string, asof: string): VItem[] {
  const byItem = new Map<string, CommitmentEvent[]>();
  for (const e of s.events) { if (e.project_id === projectId) (byItem.get(e.action_item_id) || byItem.set(e.action_item_id, []).get(e.action_item_id)!).push(e); }
  return s.items.filter((i) => i.project_id === projectId).map((it) => {
    const events = (byItem.get(it.id) || []).sort((a, b) => a.time.localeCompare(b.time));
    const d = leafState(it, asof);
    const slips = slipCount(it.id, events);
    let was: string | undefined;
    if (slips) { try { const f = JSON.parse(events.find((e) => e.event_type === 'created')?.new_value || '{}').deadline; if (f && f !== it.deadline) was = fmt(f); } catch { /* ignore */ } }
    return { it, d, owner: s.people.find((p) => p.id === it.owner_id)?.name ?? null, slips, risk: slipRisk(d, slips, it.mood_flag), due: it.deadline ? fmt(it.deadline) : 'No date', dueWas: was, events };
  });
}

// Tree leaves are owned, open actions. Ownerless items are "seeds" and decisions are branch notes.
export const isLeaf = (v: VItem) => v.it.type === 'action' && !!v.owner && v.d.state !== 'x' && v.d.state !== 'd';
export const isSeed = (v: VItem) => v.it.status === 'open' && !v.owner;

// Per limb: tips first, then twigs on alternating sides.
const SLOTS: [number, number, number][] = [
  ...[0, 1, 2].map((k): [number, number, number] => [k, 1, 0]),
  ...[[0.6, 1], [0.5, -1], [0.78, -1], [0.38, 1]].flatMap(([t, sd]) => [0, 1, 2].map((k): [number, number, number] => [k, t, sd])),
];
export const SLOTS_PER_BRANCH = SLOTS.length;

export interface Branch { name: string; count: number; atRisk: number }

export function layoutTree(vs: VItem[]) {
  const live = vs.filter(isLeaf);
  const order: string[] = [];
  const size = new Map<string, number>();
  for (const v of live) { const w = v.it.workstream; if (!size.has(w)) order.push(w); size.set(w, (size.get(w) || 0) + 1); }
  let groups = order;
  if (order.length > 3) groups = [...order].sort((a, b) => size.get(b)! - size.get(a)!).slice(0, 2).concat('Other');
  const gi = (w: string) => { const i = groups.indexOf(w); return i === -1 ? 2 : i; };
  const branches: Branch[] = groups.map((name) => ({ name, count: 0, atRisk: 0 }));
  const used = [0, 0, 0];
  const leaves: Leaf[] = [];
  let hidden = 0;
  const urgency = (v: VItem) => (v.it.deadline ? v.it.deadline : '9999');
  for (const v of [...live].sort((a, b) => urgency(a).localeCompare(urgency(b)))) {
    const g = gi(v.it.workstream);
    branches[g].count++;
    if (v.d.state !== 'g') branches[g].atRisk++;
    if (used[g] >= SLOTS.length) { hidden++; continue; }
    const [k, t, side] = SLOTS[used[g]++];
    const limb = 'LEF'[g] + k;
    if (!LIMBS[limb]) continue;
    leaves.push({ id: v.it.id, limb, t, side: side || undefined, ws: v.it.workstream, title: v.it.text, owner: v.owner!, due: v.due, state: v.d.state as 'g' | 'a' | 'r', stateLabel: v.d.label, risk: v.risk, mood: v.it.mood_flag ?? undefined });
  }
  const fallen: FallenLeaf[] = vs.filter((v) => v.it.type === 'action' && v.d.state === 'd').slice(0, 14).map((v, i) => ({
    id: v.it.id, title: v.it.text, owner: v.owner || 'Unowned', x: 520 + (i % 9) * 46 + (Math.floor(i / 9) % 2) * 22, y: 800 + ((i * 37) % 26), rot: ((i * 67) % 300) - 150,
  }));
  return { leaves, fallen, branches, hidden, labels: WS_LABEL };
}

export interface PersonStat { id: string; name: string; kept: number; total: number }

// "Kept on time" = done by the deadline; total adds anything still open past its deadline.
export function followThrough(s: AppState, asof: string, projectId?: string): PersonStat[] {
  return s.people.map((p): PersonStat => {
    const mine = s.items.filter((i) => i.owner_id === p.id && i.type === 'action' && (!projectId || i.project_id === projectId));
    const done = mine.filter((i) => i.status === 'done');
    const kept = done.filter((i) => !i.deadline || !i.done_at || i.done_at.slice(0, 10) <= i.deadline).length;
    const late = mine.filter((i) => i.status === 'open' && i.deadline && diffDays(i.deadline, asof) > 0).length;
    return { id: p.id, name: p.name, kept, total: done.length + late };
  }).filter((x) => x.total > 0);
}

export function projectHealth(vs: VItem[]) {
  const c = { g: 0, a: 0, r: 0, d: 0, done: 0 };
  for (const v of vs) { if (v.it.type !== 'action' || !v.owner) continue; if (v.d.state === 'x') c.done++; else c[v.d.state]++; }
  const open = c.g + c.a + c.r + c.d;
  return { ...c, open, health: open ? Math.round(((c.g + c.a) / open) * 100) : 100 };
}

export const personById = (people: Person[], id: string | null) => people.find((p) => p.id === id);
