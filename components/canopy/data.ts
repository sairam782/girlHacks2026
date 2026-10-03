// Demo data for the Q4 Vendor Migration project. Replace with real data from the API later.
import type { Curve } from './geometry';

export type LeafState = 'g' | 'a' | 'r' | 'd';

export const C: Record<LeafState | 'root', string> = { g: '#4f9d69', a: '#e3a33b', r: '#b9573a', d: '#b8a487', root: '#2f9e8f' };
export const CT: Record<LeafState, string> = { g: '#2f7a4a', a: '#9a620c', r: '#9c4529', d: '#7d6a50' };
export const BARK = '#7a5a3f';

export const LIMBS: Record<string, { c: Curve; w: [number, number] }> = {
  L0: { c: [[700, 612], [600, 592], [470, 520], [330, 402]], w: [24, 5] },
  L1: { c: [[530, 544], [518, 494], [495, 438], [468, 362]], w: [10, 3] },
  L2: { c: [[433, 482], [390, 488], [330, 505], [262, 498]], w: [9, 2.5] },
  E0: { c: [[700, 548], [688, 430], [728, 330], [702, 182]], w: [22, 4] },
  E1: { c: [[703, 411], [660, 380], [618, 325], [594, 252]], w: [10, 3] },
  E2: { c: [[711, 304], [760, 280], [800, 250], [830, 198]], w: [9, 2.5] },
  F0: { c: [[700, 595], [820, 575], [960, 505], [1080, 392]], w: [24, 5] },
  F1: { c: [[890, 528], [900, 480], [918, 435], [934, 370]], w: [10, 3] },
  F2: { c: [[987, 469], [1040, 478], [1105, 492], [1170, 478]], w: [9, 2.5] },
};

export const WSN: Record<string, string> = { L: 'Legal', E: 'Engineering', F: 'Finance' };

export type LabelPos = 'left' | 'right' | 'above' | 'below';

export interface Leaf {
  id: string;
  limb: string;
  t: number;
  side?: number;
  title: string;
  owner: string;
  forWho?: string;
  due: string;
  dueWas?: string;
  state: LeafState;
  stateLabel?: string;
  risk: number;
  L?: number;
  lp?: LabelPos;
  dep?: boolean;
}

export const LEAVES: Leaf[] = [
  { id: 'quote', limb: 'L0', t: 1, title: 'Send vendor quote to Legal', owner: 'Priya S.', due: 'Fri Oct 9', dueWas: 'Wed Sep 30', state: 'a', stateLabel: 'Slipped twice', risk: 78, L: 50, lp: 'left' },
  { id: 'msa', limb: 'L1', t: 1, title: 'Redline MSA with Vendor A', owner: 'Dana K.', due: 'Wed Oct 14', state: 'g', risk: 18 },
  { id: 'dpa', limb: 'L2', t: 1, title: 'Data processing addendum', owner: 'Marcus L.', due: 'Thu Oct 1', state: 'r', stateLabel: 'Overdue 4 days', risk: 91, lp: 'below' },
  { id: 'nda', limb: 'L0', t: 0.6, side: 1, title: 'Countersign mutual NDA', owner: 'Dana K.', due: 'Tue Oct 6', state: 'g', risk: 9 },
  { id: 'comp', limb: 'L2', t: 0.5, side: -1, title: 'Vendor compliance checklist', owner: 'Marcus L.', due: 'Mon Oct 12', state: 'g', risk: 22 },
  { id: 'sec', limb: 'E0', t: 1, title: 'Security review of Vendor A', owner: 'Jordan M.', forWho: 'Priya S.', due: 'Tue Oct 6', state: 'g', risk: 34, L: 48 },
  { id: 'export', limb: 'E1', t: 1, title: 'Legacy data export', owner: 'Sam R.', due: 'Fri Oct 16', state: 'g', risk: 15, dep: true },
  { id: 'sso', limb: 'E2', t: 1, title: 'SSO integration spike', owner: 'Aiko T.', due: 'Thu Oct 15', state: 'g', risk: 20, dep: true },
  { id: 'runbook', limb: 'E0', t: 0.58, side: 1, title: 'Cutover runbook draft', owner: 'Sam R.', due: 'Wed Oct 7', dueWas: 'Fri Oct 2', state: 'a', stateLabel: 'Slipped once', risk: 64, lp: 'right' },
  { id: 'load', limb: 'E1', t: 0.5, side: 1, title: 'Load test new endpoints', owner: 'Aiko T.', due: 'Tue Oct 20', state: 'g', risk: 12 },
  { id: 'sandbox', limb: 'E2', t: 0.45, side: -1, title: 'Provision sandbox access', owner: 'Sam R.', due: 'Wed Oct 7', state: 'g', risk: 8 },
  { id: 'budget', limb: 'F0', t: 1, title: 'Budget sign-off', owner: 'Jordan M.', forWho: 'Priya S.', due: 'Fri Oct 2', state: 'r', stateLabel: 'Overdue 3 days', risk: 88, L: 48, lp: 'below' },
  { id: 'po', limb: 'F1', t: 1, title: 'Raise PO for Vendor A', owner: 'Lena O.', due: 'Mon Oct 12', state: 'g', risk: 26 },
  { id: 'cost', limb: 'F2', t: 1, title: 'Vendor A vs B cost comparison', owner: 'Lena O.', due: 'Thu Oct 8', state: 'g', risk: 14 },
  { id: 'invoice', limb: 'F0', t: 0.58, side: -1, title: 'Invoice schedule', owner: 'Lena O.', due: 'Fri Oct 23', state: 'g', risk: 10 },
  { id: 'forecast', limb: 'F1', t: 0.5, side: 1, title: 'Update Q4 forecast', owner: 'Lena O.', due: 'Fri Oct 16', state: 'g', risk: 11 },
];

export interface FallenLeaf { id: string; ws: string; title: string; owner: string; due: string; x: number; y: number; rot: number }

export const FALLEN: FallenLeaf[] = [
  { id: 'recap', ws: 'Legal', title: 'Kickoff recap to vendor', owner: 'Dana K.', due: 'Fri Sep 18', x: 612, y: 812, rot: 24 },
  { id: 'webhooks', ws: 'Engineering', title: 'Decommission old webhooks', owner: 'Sam R.', due: 'Wed Sep 23', x: 812, y: 822, rot: -62 },
  { id: 'trueup', ws: 'Finance', title: 'Q3 cost true-up', owner: 'Lena O.', due: 'Wed Sep 30', x: 884, y: 804, rot: 152 },
];

export type SourceKind = 'mtg' | 'chat' | 'doc';
export interface Evidence { k: SourceKind; src: string; when: string; quote: string; tag: string; tc: LeafState; who: string }

export const EV: Record<string, Evidence[]> = {
  quote: [
    { k: 'mtg', src: 'Monday standup', when: 'Mon Sep 28 · 9:42 AM', quote: "I'll send the vendor quote by Wednesday.", tag: 'Commitment made', tc: 'g', who: 'Priya S.' },
    { k: 'chat', src: '#vendor-migration thread', when: 'Wed Sep 30 · 4:18 PM', quote: 'Still working on that quote, need one more number.', tag: 'Hedge detected', tc: 'a', who: 'Priya S.' },
    { k: 'doc', src: 'Comment on Vendor Migration Plan', when: 'Fri Oct 2 · 5:51 PM', quote: 'Quote pending, will get to it next week.', tag: 'Slip detected', tc: 'a', who: 'Priya S.' },
  ],
  sec: [{ k: 'chat', src: 'Direct message with Priya S.', when: 'Thu Oct 1 · 11:05 AM', quote: "I'll have the security review back to you by Tuesday.", tag: 'Commitment made', tc: 'g', who: 'Jordan M. (you)' }],
  budget: [
    { k: 'mtg', src: 'Finance sync', when: 'Tue Sep 29 · 2:00 PM', quote: "I'll sign off on the budget by Friday so Priya can move.", tag: 'Commitment made', tc: 'g', who: 'Jordan M. (you)' },
    { k: 'chat', src: '#vendor-migration thread', when: 'Mon Oct 5 · 9:10 AM', quote: 'Any update on the budget sign-off?', tag: 'Follow-up, no reply', tc: 'r', who: 'Lena O.' },
  ],
  runbook: [
    { k: 'mtg', src: 'Monday standup', when: 'Mon Sep 28 · 9:47 AM', quote: "I'll have a cutover runbook draft by Friday.", tag: 'Commitment made', tc: 'g', who: 'Sam R.' },
    { k: 'chat', src: '#eng-migration', when: 'Fri Oct 2 · 6:30 PM', quote: 'Runbook slipping to Wednesday, waiting on sandbox.', tag: 'Slip detected', tc: 'a', who: 'Sam R.' },
  ],
  dpa: [
    { k: 'mtg', src: 'Legal check-in', when: 'Mon Sep 21 · 3:30 PM', quote: "I'll finish the DPA review by Thursday the 1st.", tag: 'Commitment made', tc: 'g', who: 'Marcus L.' },
    { k: 'doc', src: 'DPA draft v3', when: 'Last edited Sep 24', quote: 'TODO: section 7, sub-processors.', tag: 'Went quiet', tc: 'r', who: 'Marcus L.' },
  ],
};

export const WHY: Record<string, string> = {
  quote: 'Two missed dates, hedging in the last update (“will get to it next week”), and Legal’s review is blocked behind it.',
  dpa: 'Past due with no mention in 11 days. Legal sign-off depends on it.',
  runbook: 'One slip, blocked on sandbox access. Owner gave a new date.',
  budget: 'Three days past due. Lena followed up this morning with no reply.',
};

export const SEEDS = [
  { id: 's1', text: 'Someone needs to tell Legal about the new timeline', src: 'Thu sync · Oct 1', branch: 'Legal', picks: ['Dana K.', 'Priya S.', 'Jordan M.'] },
  { id: 's2', text: 'Notify the current vendor we won’t renew', src: '#vendor-migration · Sep 30', branch: 'Finance', picks: ['Lena O.', 'Dana K.'] },
  { id: 's3', text: 'Own the post-cutover support rota', src: 'Monday standup · Sep 28', branch: 'Engineering', picks: ['Sam R.', 'Aiko T.'] },
];

// Scripted voice-agent exchange (ms offsets from opening the panel).
export const SCRIPT = [
  { who: 'you', text: 'What do I owe Priya?', start: 500, dur: 1100 },
  { who: 'canopy', text: 'Two things: the security review, due tomorrow, and the budget sign-off, which is 3 days overdue.', start: 2200, dur: 3200 },
  { who: 'you', text: 'Push the security review to Thursday.', start: 6300, dur: 1500 },
  { who: 'canopy', text: "Done. I've moved it and noted the slip.", start: 8500, dur: 1300 },
];
export const MOVE_AT = 9300;

export interface GroveProject { id: string; name: string; health: number; active: number; g: number; a: number; r: number; f: number; seed: number; h: number; foliage: number; sync: string }

export const GROVE: GroveProject[] = [
  { id: 'onb', name: 'Onboarding Revamp', health: 94, active: 14, g: 14, a: 0, r: 0, f: 0, seed: 11, h: 360, foliage: 170, sync: 'Synced 12 min ago' },
  { id: 'q4', name: 'Q4 Vendor Migration', health: 62, active: 16, g: 12, a: 2, r: 2, f: 3, seed: 7, h: 350, foliage: 8, sync: '' },
  { id: 'pay', name: 'Payroll API Launch', health: 81, active: 12, g: 10, a: 1, r: 1, f: 1, seed: 23, h: 335, foliage: 80, sync: 'Synced 4 min ago' },
];

export const AV = ['#dcebdc', '#f3e3c4', '#ead7cc', '#d6e5e7', '#e4e1d3', '#e2dcec', '#d9e6d0'];

// [name, initials, kept on time, total]
export const PEOPLE: [string, string, number, number][] = [
  ['Lena O.', 'LO', 6, 6], ['Dana K.', 'DK', 4, 4], ['Sam R.', 'SR', 5, 7], ['Priya S.', 'PS', 3, 6], ['Jordan M. (you)', 'JM', 2, 4],
];

export const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').replace('.', '').slice(0, 2).toUpperCase();
export const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
