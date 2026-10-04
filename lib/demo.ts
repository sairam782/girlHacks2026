// Synthetic demo data: three projects, eleven people, realistic sources, and a full history of edits.
// Everything is generated relative to "today", so leaves are always green, yellow, wilting and fallen in the right mix.
// Each commitment is attached to the exact line it came from, so source quotes always match the source text.
import { addDays, diffDays } from './dates';
import type { ActionItem, AppState, CommitmentEvent, EventType, Person, Project, Source, SourceKind } from './types';

interface ItemSpec {
  t?: 'a' | 'd';                       // action (default) or decision
  text: string;                        // short imperative summary
  owner: string | null;                // original owner, null = unowned (a seed)
  ws: string;                          // workstream = branch of the tree
  due?: number | null;                 // original deadline, in days from today
  moves?: [number, number | null][];   // deadline changes: [days ago it was changed, new deadline in days from today]
  reassign?: [number, string][];       // owner changes: [days ago, new owner]
  done?: number | number[];            // days ago it was marked done; several values alternate done, reopened, done...
  edited?: [number, string];           // [days ago, previous text]
}
type Line = [speaker: string, said: string, item?: ItemSpec];
interface SourceSpec { kind: SourceKind; title: string; ago: number; lines: Line[] }
interface ProjectSpec { key: string; name: string; ago: number; sources: SourceSpec[] }

// The first person is the default "viewing as" persona: Jordan has one late item, one due soon, and a mixed record.
const PEOPLE = ['Jordan M.', 'Priya S.', 'Marcus L.', 'Dana K.', 'Sam R.', 'Aiko T.', 'Lena O.', 'Ravi P.', 'Chloe B.', 'Tomás A.', 'Nia O.'];

const A = (text: string, owner: string | null, ws: string, due: number | null, extra: Partial<ItemSpec> = {}): ItemSpec => ({ text, owner, ws, due, ...extra });
const D = (text: string, owner: string | null, ws: string): ItemSpec => ({ t: 'd', text, owner, ws });

const PROJECTS: ProjectSpec[] = [
  {
    key: 'q4', name: 'Q4 Vendor Migration', ago: 24,
    sources: [
      {
        kind: 'mtg', title: 'Kickoff · Vendor migration', ago: 21, lines: [
          ['Dana', 'Thanks all. The goal is a clean cutover to Vendor A before the end of the quarter.'],
          ['Dana', 'Decision: we go with Vendor A as the primary vendor.', D('Go with Vendor A as the primary vendor', 'Dana K.', 'Legal')],
          ["Priya", "I'll send the vendor quote to Legal by Wednesday.", A('Send the vendor quote to Legal', 'Priya S.', 'Legal', -19, { moves: [[19, -8], [9, 6]], edited: [9, 'Send quote to Legal'] })],
          ['Dana', 'Marcus, can you finish the data processing addendum by next Friday?', A('Finish the data processing addendum', 'Marcus L.', 'Legal', -14, { moves: [[14, -4]] })],
          ['Marcus', "Yes, I'll have the DPA review done by then."],
          ['Dana', "I'll schedule the vendor legal call by Friday.", A('Schedule the vendor legal call', 'Dana K.', 'Legal', -17, { done: 18 })],
          ['Dana', "I'll redline the MSA with Vendor A by October 14.", A('Redline the MSA with Vendor A', 'Dana K.', 'Legal', 11)],
          ['Sam', "I'll draft the cutover runbook by the end of next week.", A('Draft the cutover runbook', 'Sam R.', 'Engineering', -9, { moves: [[9, -1]] })],
          ['Sam', "Aiko, can you run the SSO integration spike by October 15?", A('Run the SSO integration spike', 'Aiko T.', 'Engineering', 12)],
          ['Aiko', 'Sure, October 15 works.'],
          ['Jordan', "I'll finish the security review of Vendor A by next Monday.", A('Finish the security review of Vendor A', 'Jordan M.', 'Engineering', -12, { moves: [[12, -5], [5, 1]] })],
          ['Sam', "I'll provision sandbox access by Wednesday.", A('Provision sandbox access', 'Sam R.', 'Engineering', -19, { done: 20 })],
          ['Jordan', "I'll share the access list with Marcus by Monday.", A('Share the access list with Marcus', 'Jordan M.', 'Engineering', -17, { done: 15 })],
          ['Lena', "I'll get the PO raised for Vendor A by Monday the twelfth.", A('Raise the PO for Vendor A', 'Lena O.', 'Finance', 9)],
          ['Jordan', "I'll sign off the budget by Friday so Priya can move.", A('Sign off the budget', 'Jordan M.', 'Finance', -14, { moves: [[14, -2]] })],
          ['Lena', "And I'll update the Q4 forecast by October 16.", A('Update the Q4 forecast', 'Lena O.', 'Finance', 13)],
          ['Dana', 'Someone needs to tell the current vendor we are not renewing.', A('Tell the current vendor we are not renewing', null, 'Finance', null)],
          ['Dana', 'We still have no owner for the post-cutover support rota.', A('Own the post-cutover support rota', null, 'Engineering', null)],
        ],
      },
      {
        kind: 'mtg', title: 'Monday standup', ago: 5, lines: [
          ['Marcus', 'Morning everyone. Pilot numbers came back and they look great.'],
          ['Priya', "Before we go on, Legal's redline is blocked until the quote lands."],
          ['Sam', "Runbook is slipping to tomorrow, I'm waiting on sandbox access to the new region."],
          ['Aiko', "I'll load test the new endpoints by October 20.", A('Load test the new endpoints', 'Aiko T.', 'Engineering', 17)],
          ['Dana', 'We agreed to freeze the legacy API after cutover.', D('Freeze the legacy API after cutover', 'Dana K.', 'Engineering')],
          ['Lena', "I'll set up the invoice schedule by October 23.", A('Set up the invoice schedule', 'Lena O.', 'Finance', 20)],
          ['Ravi', 'I can take the compliance checklist for Vendor A, due Monday.', A('Complete the Vendor A compliance checklist', 'Ravi P.', 'Legal', 2)],
          ['Dana', 'Ravi, please also send the legal sign-off summary to Priya by Thursday.', A('Send the legal sign-off summary to Priya', 'Ravi P.', 'Legal', 4, { reassign: [[2, 'Chloe B.']] })],
          ['Chloe', "I'll prepare the vendor onboarding deck for the all-hands by October 9.", A('Prepare the vendor onboarding deck', 'Chloe B.', 'Finance', 6)],
          ['Tomás', "I'll set up the data export from the legacy system by October 16.", A('Set up the legacy data export', 'Tomás A.', 'Engineering', 13)],
          ['Nia', "I'll write the customer notice about the migration window by Tuesday.", A('Write the customer notice about the migration window', 'Nia O.', 'Legal', -3, { done: 1 })],
        ],
      },
      {
        kind: 'chat', title: '#vendor-migration thread', ago: 3, lines: [
          ['Lena', 'Any update on the budget sign-off? Priya is waiting.'],
          ['Jordan', 'Still reviewing, will have it by end of day tomorrow.'],
          ['Sam', 'Spun up the sandbox region. Runbook moving to Wednesday.'],
          ['Priya', "Quote needs one more number from finance. I'll get it to Legal Friday."],
          ['Dana', "Thanks. Also, we decided the cutover window is the weekend of October 17.", D('Cutover window is the weekend of October 17', 'Dana K.', 'Engineering')],
          ['Marcus', 'DPA is blocked on the sub-processor section. Will send tomorrow.'],
          ['Aiko', 'SSO spike: starting today.'],
        ],
      },
      {
        kind: 'doc', title: 'Vendor Migration Plan · comments', ago: 1, lines: [
          ['Dana', "Comment on section 4: Legal needs the vendor's security questionnaire before signing.", A('Collect the vendor security questionnaire', 'Ravi P.', 'Legal', 3)],
          ['Lena', 'Comment on the forecast table: please add the migration one-off costs.', A('Add migration one-off costs to the forecast', 'Lena O.', 'Finance', 5)],
          ['Sam', 'Runbook draft v2 attached. Needs a review from Security.', A('Review runbook v2 with Security', 'Jordan M.', 'Engineering', 5)],
        ],
      },
    ],
  },
  {
    key: 'onb', name: 'Onboarding Revamp', ago: 40,
    sources: [
      {
        kind: 'mtg', title: 'Kickoff · Onboarding', ago: 30, lines: [
          ['Nia', 'Goal: new hires productive in two weeks instead of five.'],
          ['Nia', 'Decision: we run a pilot with the January cohort first.', D('Run a pilot with the January cohort first', 'Nia O.', 'People Ops')],
          ['Dana', "I'll approve the pilot budget by Friday.", A('Approve the pilot budget', 'Dana K.', 'People Ops', -22, { done: 23 })],
          ['Chloe', "I'll write the week one welcome email sequence by the 20th.", A('Write the week one welcome emails', 'Chloe B.', 'Content', -12, { done: 14 })],
          ['Tomás', "I'll set up the laptop provisioning checklist by the 18th.", A('Set up the laptop provisioning checklist', 'Tomás A.', 'Tooling', -15, { done: 16 })],
          ['Lena', "I'll map each role to a budget line for equipment by the end of the month.", A('Map each role to an equipment budget line', 'Lena O.', 'People Ops', -3, { done: 5 })],
          ['Ravi', "I'll draft the manager checklist for day one.", A('Draft the manager checklist for day one', 'Ravi P.', 'People Ops', -9, { done: 9 })],
          ['Priya', "I'll write the product one-pager by October 1.", A('Write the product one-pager', 'Priya S.', 'Content', -4, { done: 5 })],
          ['Priya', "I'll record the product overview videos by October 20.", A('Record the product overview videos', 'Priya S.', 'Content', 17)],
        ],
      },
      {
        kind: 'mtg', title: 'Design review', ago: 12, lines: [
          ['Chloe', 'The buddy program needs an owner before the pilot.', A('Own the buddy program', null, 'People Ops', null)],
          ['Tomás', "I'll build the access request form in the HR portal by October 9.", A('Build the access request form in the HR portal', 'Tomás A.', 'Tooling', 6)],
          ['Aiko', "I'll set up the sandbox accounts for new engineers by next Friday.", A('Set up sandbox accounts for new engineers', 'Aiko T.', 'Tooling', -5, { moves: [[5, 2]] })],
          ['Nia', 'Priya, can you review the video scripts by Monday?', A('Review the video scripts', 'Priya S.', 'Content', 5)],
          ['Dana', 'Legal needs to approve the offer-letter wording by October 14.', A('Approve the offer-letter wording', 'Dana K.', 'People Ops', 11)],
          ['Nia', 'We agreed to keep the day-one agenda to three sessions.', D('Keep the day-one agenda to three sessions', 'Nia O.', 'People Ops')],
          ['Chloe', "I'll create the FAQ page for new hires by the 28th.", A('Create the FAQ page for new hires', 'Chloe B.', 'Content', -6, { done: 7 })],
        ],
      },
      {
        kind: 'chat', title: '#onboarding thread', ago: 6, lines: [
          ['Tomás', 'Laptop shipping vendor can do next-day for the January cohort.'],
          ['Jordan', "I'll review the security training module by October 8.", A('Review the security training module', 'Jordan M.', 'Tooling', 5)],
          ['Ravi', 'Someone should confirm the pilot cohort size with Finance.', A('Confirm the pilot cohort size with Finance', null, 'People Ops', null)],
          ['Nia', 'Feedback survey draft is done, sending Friday.'],
          ['Sam', "I'll add the onboarding checklist to the wiki by Wednesday.", A('Add the onboarding checklist to the wiki', 'Sam R.', 'Tooling', -2, { done: 0 })],
        ],
      },
    ],
  },
  {
    key: 'pay', name: 'Payroll API Launch', ago: 32,
    sources: [
      {
        kind: 'mtg', title: 'Kickoff · Payroll API', ago: 26, lines: [
          ['Ravi', 'Target launch is November 2. Decision: we ship the v1 API without bonus runs.', D('Ship the v1 API without bonus runs', 'Ravi P.', 'Backend')],
          ['Aiko', "I'll finish the tax withholding endpoint by October 2.", A('Finish the tax withholding endpoint', 'Aiko T.', 'Backend', -8, { moves: [[8, -1]] })],
          ['Aiko', "I'll publish the OpenAPI spec by the 18th.", A('Publish the OpenAPI spec', 'Aiko T.', 'Backend', -14, { done: 15 })],
          ['Sam', "I'll own the idempotency keys design.", A('Design idempotency keys', 'Sam R.', 'Backend', -18, { done: 19 })],
          ['Marcus', "I'll gather last year's audit findings by the 20th.", A("Gather last year's audit findings", 'Marcus L.', 'Compliance', -9, { done: 10 })],
          ['Marcus', "I'll get the compliance sign-off for state tax tables by October 16.", A('Get compliance sign-off for state tax tables', 'Marcus L.', 'Compliance', 13)],
          ['Dana', "I'll review the data retention policy with Legal by October 9.", A('Review the data retention policy with Legal', 'Dana K.', 'Compliance', 6)],
          ['Jordan', "I'll complete the vendor risk assessment template by the 22nd.", A('Complete the vendor risk assessment template', 'Jordan M.', 'Compliance', -11, { done: 11 })],
          ['Chloe', "I'll write the QA test plan by next Friday.", A('Write the QA test plan', 'Chloe B.', 'QA', -12, { done: 12 })],
          ['Tomás', "I'll set up the load test environment by October 5.", A('Set up the load test environment', 'Tomás A.', 'QA', 2)],
          ['Lena', "I'll confirm the payroll provider rate card by the 25th.", A('Confirm the payroll provider rate card', 'Lena O.', 'Compliance', -8, { done: 6 })],
        ],
      },
      {
        kind: 'mtg', title: 'Weekly sync', ago: 8, lines: [
          ['Ravi', 'Decision: we use signed webhooks, not polling, for pay run status.', D('Use signed webhooks, not polling, for pay run status', 'Ravi P.', 'Backend')],
          ['Aiko', "I'll implement the webhook retry logic by October 14.", A('Implement the webhook retry logic', 'Aiko T.', 'Backend', 11)],
          ['Sam', "I'll write the reconciliation job by October 12.", A('Write the reconciliation job', 'Sam R.', 'Backend', 9)],
          ['Chloe', "I'll run the first regression pass on staging by Monday.", A('Run the first regression pass on staging', 'Chloe B.', 'QA', -7, { moves: [[7, -3]] })],
          ['Marcus', "I'll get the SOC 2 evidence pack to the auditors by the 15th.", A('Send the SOC 2 evidence pack to the auditors', 'Marcus L.', 'Compliance', 12)],
          ['Priya', "I'll write the customer-facing API docs by October 13.", A('Write the customer-facing API docs', 'Priya S.', 'Backend', 10)],
          ['Dana', 'Someone should own the incident runbook for payroll failures.', A('Own the incident runbook for payroll failures', null, 'Compliance', null)],
          ['Nia', "I'll coordinate the pilot with two customers by October 20.", A('Coordinate the pilot with two customers', 'Nia O.', 'QA', 17)],
        ],
      },
      {
        kind: 'chat', title: '#payroll-launch thread', ago: 2, lines: [
          ['Ravi', 'Heads up, the provider sandbox is down for maintenance until tomorrow.'],
          ['Tomás', 'Load test environment is up, running the first baseline.'],
          ['Marcus', 'State tax tables for New York are still missing from the provider.'],
          ['Lena', "I'll chase the provider about the New York tax tables today.", A('Chase the provider about the New York tax tables', 'Lena O.', 'Compliance', 0)],
        ],
      },
      {
        kind: 'doc', title: 'Launch readiness checklist · comments', ago: 4, lines: [
          ['Dana', 'Open item: the penetration test report must be attached before launch.', A('Book the external penetration test', 'Jordan M.', 'Compliance', 5)],
          ['Aiko', 'Rate limiting is not defined for the bulk endpoints.', A('Define rate limits for the bulk endpoints', 'Sam R.', 'Backend', 8)],
        ],
      },
    ],
  },
];

const slug = (n: string) => 'p-' + n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/)[0];
const emailOf = (n: string) => {
  const [f, l] = n.normalize('NFD').replace(/[̀-ͯ.]/g, '').toLowerCase().split(/\s+/);
  return `${f}.${l}@northwind.example`;
};

// Events carry real timestamps in the past. Anything that would land in the future is clamped to now.
export function buildDemo(today: string): AppState {
  // "Now" for the generated history: the real clock, unless the chosen day is still in the future (a pinned demo date).
  const dayStart = new Date(`${today}T00:00:00`).getTime(), dayEnd = new Date(`${today}T23:59:59`).getTime();
  const now = Date.now() < dayStart ? dayEnd : Math.min(Date.now(), dayEnd);
  const at = (ago: number, hhmm: string) => { const t = new Date(`${addDays(today, -ago)}T${hhmm}:00`).getTime(); return new Date(Math.min(t, now)).toISOString(); };
  const endOfDay = (d: string) => new Date(`${d}T23:59:59`).getTime();
  const off = (n: number | null | undefined) => (n === null || n === undefined ? null : addDays(today, n));

  const people: Person[] = PEOPLE.map((name) => ({ id: slug(name), name, email: emailOf(name) }));
  const idOf = (name: string | null) => (name ? people.find((p) => p.name === name)?.id ?? null : null);
  const projects: Project[] = [], sources: Source[] = [], items: ActionItem[] = [], events: CommitmentEvent[] = [];

  for (const p of PROJECTS) {
    const projectId = `demo-${p.key}`;
    projects.push({ id: projectId, name: p.name, created_at: at(p.ago, '09:00') });
    let n = 0;
    p.sources.forEach((s, si) => {
      const sourceId = `${projectId}-s${si + 1}`;
      const text = s.lines.map(([who, said]) => `${who}: ${said}`).join('\n');
      sources.push({ id: sourceId, project_id: projectId, kind: s.kind, title: s.title, meeting_date: addDays(today, -s.ago), text, created_at: at(s.ago, '09:30'), extracted: s.lines.filter((l) => l[2]).length });

      for (const [who, said, spec] of s.lines) {
        if (!spec) continue;
        const id = `${projectId}-i${String(++n).padStart(2, '0')}`;
        const ev = (event_type: EventType, old_value: string | null, new_value: string | null, time: string) => events.push({ time, action_item_id: id, project_id: projectId, event_type, old_value, new_value });

        const moves = [...(spec.moves ?? [])];
        const due0 = off(spec.due);
        let deadline = due0;
        let owner = spec.owner;
        const seq = spec.done === undefined ? [] : Array.isArray(spec.done) ? spec.done : [spec.done];
        const created = at(s.ago, '09:00');
        ev('created', null, JSON.stringify({ owner, deadline }), created);

        // The first time a deadline passes while the item is open, the app logs one "overdue" event.
        let overdueLogged = false;
        const markOverdue = (due: string | null, until: number) => {
          if (overdueLogged || !due || endOfDay(due) >= until) return;
          overdueLogged = true;
          ev('overdue', due, addDays(due, 1), new Date(endOfDay(due)).toISOString());
        };
        for (const [ago, nd] of moves) {
          const when = at(ago, '10:30');
          markOverdue(deadline, new Date(when).getTime());
          const next = off(nd);
          ev('deadline_moved', deadline, next, when);
          deadline = next;
        }
        for (const [ago, to] of spec.reassign ?? []) { ev('reassigned', owner, to, at(ago, '11:00')); owner = to; }
        if (spec.edited) ev('edited', spec.edited[1], spec.text, at(spec.edited[0], '12:00'));
        seq.forEach((ago, k) => ev(k % 2 === 0 ? 'done' : 'reopened', k % 2 === 0 ? 'open' : 'done', k % 2 === 0 ? 'done' : 'open', at(ago, '16:00')));
        const isDone = seq.length % 2 === 1;
        markOverdue(deadline, isDone ? new Date(at(seq[seq.length - 1], '16:00')).getTime() : now);

        items.push({
          id, project_id: projectId, source_id: sourceId, owner_id: idOf(owner), type: spec.t === 'd' ? 'decision' : 'action',
          text: spec.text, deadline, status: isDone ? 'done' : 'open', source_excerpt: `${who}: ${said}`, workstream: spec.ws,
          created_at: created, done_at: isDone ? at(seq[seq.length - 1], '16:00') : null,
        });
      }
    });
  }
  events.sort((a, b) => a.time.localeCompare(b.time));
  return { projects, people, sources, items, events };
}

// Quick facts about the generated data, handy for checks and docs.
export function describeDemo(s: AppState, today: string) {
  const open = s.items.filter((i) => i.status === 'open' && i.type === 'action' && i.owner_id);
  const state = { green: 0, yellow: 0, wilting: 0, fallen: 0 };
  for (const i of open) {
    const left = i.deadline ? diffDays(today, i.deadline) : 99;
    if (left > 3) state.green++; else if (left >= 0) state.yellow++; else if (left >= -2) state.wilting++; else state.fallen++;
  }
  return { projects: s.projects.length, people: s.people.length, sources: s.sources.length, items: s.items.length, events: s.events.length, done: s.items.filter((i) => i.status === 'done').length, seeds: s.items.filter((i) => i.status === 'open' && !i.owner_id).length, ...state };
}
