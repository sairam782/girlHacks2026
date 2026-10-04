// Leaf state is derived from status and deadline (README table). Pure, so server and browser agree.
import { diffDays } from './dates';
import type { ActionItem, CommitmentEvent } from './types';

export type LeafState = 'g' | 'a' | 'r' | 'd' | 'x'; // green, yellow, wilting, fallen, gone (bloom)
export type DerivedStatus = 'open' | 'done' | 'overdue';

export interface Derived { state: LeafState; label: string; status: DerivedStatus; daysLeft: number | null }

export function leafState(it: Pick<ActionItem, 'status' | 'deadline'>, asof: string): Derived {
  if (it.status === 'done') return { state: 'x', label: 'Done', status: 'done', daysLeft: null };
  if (!it.deadline) return { state: 'g', label: 'No date set', status: 'open', daysLeft: null };
  const left = diffDays(asof, it.deadline);
  if (left > 3) return { state: 'g', label: `Due in ${left} days`, status: 'open', daysLeft: left };
  if (left >= 0) return { state: 'a', label: left === 0 ? 'Due today' : `Due in ${left} day${left > 1 ? 's' : ''}`, status: 'open', daysLeft: left };
  const over = -left;
  if (over >= 3) return { state: 'd', label: `Fallen · overdue ${over} days`, status: 'overdue', daysLeft: left };
  return { state: 'r', label: `Wilting · overdue ${over} day${over > 1 ? 's' : ''}`, status: 'overdue', daysLeft: left };
}

export const slipCount = (id: string, events: CommitmentEvent[]) => events.filter((e) => e.action_item_id === id && e.event_type === 'deadline_moved').length;

// Heuristic: how likely the leaf is to wilt. Rises with urgency and with every deadline that already moved.
// A yes given under strain (flagged from Mood Mirror) adds a fixed bump.
export function slipRisk(d: Derived, slips: number, moodFlag?: string | null): number {
  const base = { g: 8, a: 38, r: 78, d: 99, x: 0 }[d.state];
  if (d.state === 'x') return 0;
  const near = d.state === 'g' && d.daysLeft !== null ? Math.max(0, 14 - d.daysLeft) : 0;
  return Math.min(99, base + near + slips * 14 + (d.daysLeft === null ? 8 : 0) + (moodFlag ? 15 : 0));
}
