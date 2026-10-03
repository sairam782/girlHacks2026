// Commitment history: how deadlines slipped, who reassigned what, and how often a project stays green.
import { addDays, diffDays, fmtShort, todayISO } from './dates';
import type { ActionItem, CommitmentEvent } from './types';

export interface Drift { itemId: string; text: string; chain: string[]; slips: number }
export interface History {
  greenDays: { date: string; green: boolean }[];
  greenPct: number;
  slips: number;
  reassignments: number;
  drifts: Drift[];
}

const day = (t: string) => t.slice(0, 10);

// Replays the event log to rebuild each leaf's deadline and status on any past day.
export function history(items: ActionItem[], events: CommitmentEvent[], asof: string, span = 14): History {
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));
  const ids = new Set(items.map((i) => i.id));
  const evs = sorted.filter((e) => ids.has(e.action_item_id));

  const greenDays: History['greenDays'] = [];
  for (let n = span - 1; n >= 0; n--) {
    const d = addDays(asof, -n);
    const st = new Map<string, { deadline: string | null; done: boolean; born: boolean }>();
    for (const e of evs) {
      if (day(e.time) > d) continue;
      const cur = st.get(e.action_item_id) || { deadline: null, done: false, born: false };
      if (e.event_type === 'created') { cur.born = true; try { cur.deadline = JSON.parse(e.new_value || '{}').deadline ?? null; } catch { /* keep */ } }
      else if (e.event_type === 'deadline_moved') cur.deadline = e.new_value;
      else if (e.event_type === 'done') cur.done = true;
      else if (e.event_type === 'reopened') cur.done = false;
      st.set(e.action_item_id, cur);
    }
    const born = [...st.values()].filter((x) => x.born);
    if (!born.length) continue;
    greenDays.push({ date: d, green: !born.some((x) => !x.done && x.deadline && diffDays(x.deadline, d) > 0) });
  }

  const drifts: Drift[] = [];
  for (const it of items) {
    const mine = evs.filter((e) => e.action_item_id === it.id);
    const moves = mine.filter((e) => e.event_type === 'deadline_moved');
    if (!moves.length) continue;
    let first: string | null = null;
    try { first = JSON.parse(mine.find((e) => e.event_type === 'created')?.new_value || '{}').deadline ?? null; } catch { /* none */ }
    const chain = [first ?? moves[0].old_value, ...moves.map((m) => m.new_value)].map((d) => (d ? fmtShort(d) : 'no date'));
    drifts.push({ itemId: it.id, text: it.text, chain, slips: moves.length });
  }
  drifts.sort((a, b) => b.slips - a.slips);

  const g = greenDays.filter((x) => x.green).length;
  return {
    greenDays,
    greenPct: greenDays.length ? Math.round((g / greenDays.length) * 100) : 100,
    slips: evs.filter((e) => e.event_type === 'deadline_moved').length,
    reassignments: evs.filter((e) => e.event_type === 'reassigned' && e.old_value).length,
    drifts,
  };
}

export { todayISO };
