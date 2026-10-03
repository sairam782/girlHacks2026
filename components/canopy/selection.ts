// Builds the data shown in the commitment side panel for the selected leaf.
import { C, CT, EV, FALLEN, WHY, WSN, initials, lc, type Evidence, type Leaf, type LeafState } from './data';
import { tint } from './geometry';

export function selData(leaves: Leaf[], sel: string | null, secMoved: boolean) {
  if (!sel) return null;
  const leaf = leaves.find((l) => l.id === sel);
  const fall = FALLEN.find((f) => f.id === sel);
  if (!leaf && !fall) return null;
  const L = leaf || { ...fall!, state: 'd' as LeafState, stateLabel: 'Dropped', risk: 100, forWho: undefined, dueWas: undefined };
  const ws = leaf ? WSN[leaf.limb[0]] : fall!.ws;
  const col = C[L.state], label = L.state === 'g' ? 'On track' : L.stateLabel;

  let ev: Evidence[] =
    EV[L.id] ||
    (fall
      ? [
          { k: 'chat', src: '#vendor-migration thread', when: 'Mon Sep 14', quote: `I can take the ${lc(L.title)}.`, tag: 'Commitment made', tc: 'g', who: L.owner },
          { k: 'doc', src: 'Vendor Migration Plan', when: 'Removed Sep 30', quote: 'Item struck from checklist, no comment left.', tag: 'Dropped silently', tc: 'd', who: 'No owner response' },
        ]
      : [{ k: 'mtg', src: 'Monday standup', when: 'Mon Sep 28', quote: `I'll take ${lc(L.title)}, done by ${L.due}.`, tag: 'Commitment made', tc: 'g', who: L.owner }]);
  if (L.id === 'sec' && secMoved) {
    ev = [...ev, { k: 'chat', src: 'Canopy voice', when: 'Mon Oct 5 · just now', quote: 'Push the security review to Thursday.', tag: 'Slip noted', tc: 'a', who: 'Jordan M. (you)' }];
  }

  let steps: [string, string, string][];
  if (L.id === 'quote') steps = [['Committed', 'Mon Sep 28', 'g0'], ['In progress', 'Wed Sep 30', 'g'], ['Slipped', 'Wed Sep 30', 'a'], ['Slipped', 'Fri Oct 2', 'a']];
  else if (L.state === 'd') steps = [['Committed', 'Sep 14', 'g0'], ['Went quiet', 'Sep 21', 'a'], ['Dropped', 'Sep 30', 'd']];
  else if (L.state === 'r') steps = [['Committed', 'Sep 21', 'g0'], ['In progress', 'Sep 24', 'g'], ['Overdue', L.due.replace(/^\w+ /, ''), 'r']];
  else if (L.state === 'a') steps = [['Committed', 'Sep 28', 'g0'], ['In progress', 'Oct 1', 'g'], ['Slipped', L.id === 'sec' ? 'Oct 5' : 'Oct 2', 'a']];
  else steps = [['Committed', 'Sep 28', 'g0'], ['In progress', 'Oct 1', 'g']];
  const sc = (k: string) => (k === 'g0' ? C.root : C[k as LeafState]);

  const why =
    L.id === 'sec' && secMoved
      ? 'Moved once by voice on Mon Oct 5. Priya was notified automatically.'
      : WHY[L.id] ||
        (L.state === 'd'
          ? 'No mention in any source for 3 weeks, then removed from the plan without a decision. Canopy keeps it so it can be revived or closed on purpose.'
          : L.state === 'g'
            ? 'Owner reconfirmed recently. No hedging language detected.'
            : 'Missed one date; last update hedged.');

  return {
    id: L.id,
    ws,
    title: L.title,
    owner: L.owner,
    init: initials(L.owner),
    forWho: L.forWho,
    due: L.state === 'd' ? 'Was ' + L.due : L.due,
    dueWas: L.dueWas,
    stateLabel: label,
    color: col,
    textColor: CT[L.state],
    colorLine: tint(col, 0.35),
    colorBg: tint(col, 0.1),
    risk: L.risk,
    why,
    steps: steps.map((x, i) => ({ label: x[0], date: x[1], color: sc(x[2]), ring: tint(sc(x[2]), 0.18), notLast: i < steps.length - 1 })),
    ev: ev.map((e) => ({ ...e, tcText: CT[e.tc], tcBg: tint(C[e.tc], 0.14) })),
    evCount: ev.length + ' source' + (ev.length > 1 ? 's' : ''),
    hasContra: L.id === 'quote',
    first: L.owner.split(' ')[0],
  };
}

export type SelData = NonNullable<ReturnType<typeof selData>>;
