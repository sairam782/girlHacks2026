// Loads a full demo grove into .data/store.json.
//
//   npm run seed            replace whatever is there with the demo grove
//   npm run seed -- --keep  refuse to overwrite an existing store
//
// Every deadline is written relative to the day you run it, so leaf states stay correct whenever
// the demo happens: green (4+ days out), yellow (within 3), wilting (1-2 late), fallen (3+ late),
// bloomed (done). Workstreams become the three branches of each tree.

import { promises as fs } from 'fs';
import path from 'path';

const DIR = process.env.CANOPY_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'store.json');

const pad = (n) => String(n).padStart(2, '0');
const DAY = 86400000;
const base = Date.now();
const iso = (d) => { const x = new Date(base + d * DAY); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const stamp = (d, h = 10) => new Date(new Date(base + d * DAY).setHours(h, 0, 0, 0)).toISOString();

const PEOPLE = ['Priya S.', 'Sam R.', 'Jordan M.', 'Dana K.', 'Marcus L.', 'Lena O.', 'Aiko T.'];

// [text, owner, workstream, dueOffset, sourceKey, excerpt, opts]
//   due: number of days from today, or null for no date
//   opts.done: days ago it was completed   opts.slips: [previous due offsets, oldest first]
const Q4 = [
  // --- Legal
  ['Send the vendor quote to Legal', 'Priya S.', 'Legal', 2, 'standup',
    "I'll send the vendor quote by Wednesday.", { slips: [-5, -1] }],
  ['Redline the MSA with Vendor A', 'Dana K.', 'Legal', 9, 'standup', "I'll redline the MSA once the quote lands.", {}],
  ['Finish the data processing addendum', 'Marcus L.', 'Legal', -3, 'legal',
    "I'll finish the DPA review by Thursday the 1st.", {}],
  ['Countersign the mutual NDA', 'Dana K.', 'Legal', 1, 'legal', 'NDA is ready for countersignature.', {}],
  ['Complete the vendor compliance checklist', 'Marcus L.', 'Legal', 7, 'legal', 'I can take the compliance checklist.', {}],
  ['Send the kickoff recap to the vendor', 'Dana K.', 'Legal', -7, 'standup', "I'll get the recap out today.", { done: 7 }],

  // --- Engineering
  ['Run the security review of Vendor A', 'Jordan M.', 'Engineering', 1, 'chat',
    "I'll have the security review back to you by Tuesday.", { slips: [-1] }],
  ['Export the legacy data set', 'Sam R.', 'Engineering', 11, 'standup', "I'll handle the legacy data export.", {}],
  ['Spike the SSO integration', 'Aiko T.', 'Engineering', 10, 'standup', "I'll run the SSO spike this sprint.", {}],
  ['Draft the cutover runbook', 'Sam R.', 'Engineering', 2, 'standup',
    "I'll have a cutover runbook draft by Friday.", { slips: [-2] }],
  ['Load test the new endpoints', 'Aiko T.', 'Engineering', 15, 'doc', 'Load testing can wait until after the freeze.', {}],
  ['Provision sandbox access', 'Sam R.', 'Engineering', -1, 'chat', 'Sandbox access by Wednesday, latest.', {}],
  ['Decommission the old webhooks', 'Sam R.', 'Engineering', -3, 'doc', 'Old webhooks still need decommissioning.', {}],
  ['Migrate staging to Vendor A', 'Aiko T.', 'Engineering', -4, 'standup', "I'll move staging over this week.", { done: 4 }],

  // --- Finance
  ['Sign off on the Q4 budget', 'Jordan M.', 'Finance', -2, 'finance',
    "I'll sign off on the budget by Friday so Priya can move.", {}],
  ['Raise the PO for Vendor A', 'Lena O.', 'Finance', 7, 'finance', "I'll raise the PO once Legal signs.", {}],
  ['Compare Vendor A and B costs', 'Lena O.', 'Finance', 3, 'finance', 'I can put the cost comparison together.', {}],
  ['Draft the invoice schedule', 'Lena O.', 'Finance', 18, 'doc', 'Invoice schedule is a later job.', {}],
  ['Update the Q4 forecast', 'Lena O.', 'Finance', 11, 'finance', "I'll update the forecast after the PO.", {}],
  ['Close out the Q3 cost true-up', 'Lena O.', 'Finance', -3, 'finance', 'The Q3 true-up is still open.', {}],
  ['Negotiate the volume discount', 'Lena O.', 'Finance', -3, 'finance', "I'll push them on volume pricing.", { done: 3 }],

  // --- decisions (branch notes, never owned)
  ['Standardise on Vendor A for all regions', null, 'Legal', null, 'standup',
    'We decided to go with Vendor A across all regions.', { type: 'decision' }],
  ['Freeze code Thursday noon before cutover', null, 'Engineering', null, 'standup',
    "Let's agree a code freeze Thursday at noon.", { type: 'decision' }],
  ['Hold the Q4 budget at its current level', null, 'Finance', null, 'finance',
    'We agreed not to increase the Q4 envelope.', { type: 'decision' }],

  // --- unowned actions: the seeds waiting for an owner
  ['Tell Legal about the new timeline', null, 'Legal', 4, 'standup', 'Someone needs to tell Legal about the new timeline.', {}],
  ["Notify the current vendor we won't renew", null, 'Finance', 6, 'chat', "We still haven't told the incumbent.", {}],
  ['Own the post-cutover support rota', null, 'Engineering', null, 'standup', 'Who owns support after cutover?', {}],
];

const SOURCES = {
  standup: ['mtg', 'Monday standup', -5],
  chat: ['chat', '#vendor-migration thread', -3],
  doc: ['doc', 'Vendor Migration Plan', -2],
  finance: ['mtg', 'Finance sync', -6],
};

// Two lighter projects so the Grove reads as a grove. [text, owner, workstream, due, done?]
const SIDE = {
  'Onboarding Revamp': [
    ['Ship the welcome checklist', 'Aiko T.', 'Design', 8], ['Rewrite the first-run copy', 'Priya S.', 'Design', 12],
    ['Add progress indicators', 'Aiko T.', 'Design', 6], ['Instrument the drop-off funnel', 'Sam R.', 'Data', 9],
    ['Set up the activation dashboard', 'Sam R.', 'Data', 14], ['Define the activation metric', 'Jordan M.', 'Data', 5],
    ['Move the survey after sign-up', 'Priya S.', 'Design', -2], ['A/B test the empty state', 'Aiko T.', 'Design', 16],
    ['Draft the welcome email series', 'Dana K.', 'Lifecycle', 10], ['Localise onboarding for EU', 'Dana K.', 'Lifecycle', 20],
    ['Audit the sign-up form', 'Priya S.', 'Design', -6, 6], ['Pick the onboarding video tool', 'Jordan M.', 'Lifecycle', -9, 9],
  ],
  'Payroll API Launch': [
    ['Finish the payroll webhook', 'Sam R.', 'Platform', 7], ['Document the API surface', 'Marcus L.', 'Docs', 11],
    ['Add idempotency keys', 'Sam R.', 'Platform', 3], ['Pen-test the payout endpoint', 'Aiko T.', 'Platform', 13],
    ['Write the migration guide', 'Marcus L.', 'Docs', 9], ['Publish the sandbox keys', 'Aiko T.', 'Platform', 1],
    ['Sign the processor agreement', 'Dana K.', 'Compliance', 15], ['Complete the SOC 2 evidence pack', 'Dana K.', 'Compliance', -1],
    ['Review the data retention policy', 'Marcus L.', 'Compliance', -3], ['Draft the launch announcement', 'Priya S.', 'Docs', 5],
    ['Set up status page alerts', 'Sam R.', 'Platform', -7, 7], ['Approve the pricing tiers', 'Lena O.', 'Compliance', -4, 4],
  ],
};

// --------------------------------------------------------------------------- build

const state = { projects: [], people: [], sources: [], items: [], events: [] };
let n = 0;
const id = (p) => `${p}${(++n).toString(36).padStart(3, '0')}`;

const personId = new Map();
for (const name of PEOPLE) {
  const p = { id: id('pe'), name, email: `${name.split(' ')[0].toLowerCase()}@example.com` };
  state.people.push(p);
  personId.set(name, p.id);
}

function addItem({ project, source, text, owner, workstream, due, opts = {} }) {
  const createdAt = stamp(source.offset, 9);
  const it = {
    id: id('it'), project_id: project.id, source_id: source.id,
    owner_id: owner ? personId.get(owner) : null,
    type: opts.type === 'decision' ? 'decision' : 'action',
    text, deadline: due === null ? null : iso(due), status: opts.done ? 'done' : 'open',
    source_excerpt: opts.excerpt ?? text, workstream,
    created_at: createdAt, done_at: opts.done ? stamp(-opts.done, 16) : null,
  };
  state.items.push(it);

  const ev = (type, offset, hour, old_value, new_value) =>
    state.events.push({ time: stamp(offset, hour), action_item_id: it.id, project_id: project.id, event_type: type, old_value, new_value });

  // The lifecycle the Timeline and the commitment panel read back.
  const first = opts.slips?.length ? iso(opts.slips[0]) : it.deadline;
  ev('created', source.offset, 9, null, JSON.stringify({ text, owner, deadline: first }));
  let from = first;
  for (const [i, next] of [...(opts.slips ?? []).slice(1), due].entries()) {
    if (!opts.slips?.length) break;
    const to = iso(next);
    ev('deadline_moved', source.offset + 1 + i * 2, 15, from, to);
    from = to;
  }
  if (opts.done) ev('done', -opts.done, 16, null, null);
  return it;
}

function addProject(name, rows, sourceMap) {
  const project = { id: id('pr'), name, created_at: stamp(-14, 9) };
  state.projects.push(project);
  const sources = {};
  for (const [key, [kind, title, offset]] of Object.entries(sourceMap)) {
    const s = { id: id('so'), project_id: project.id, kind, title, meeting_date: iso(offset), text: '', created_at: stamp(offset, 9), extracted: 0 };
    s.offset = offset;
    state.sources.push(s);
    sources[key] = s;
  }
  for (const row of rows) {
    const [text, owner, workstream, due, sourceKey, excerpt, opts] = row;
    const source = sources[sourceKey] ?? Object.values(sources)[0];
    const it = addItem({ project, source, text, owner, workstream, due, opts: { ...opts, excerpt } });
    source.extracted++;
    if (it) continue;
  }
  for (const s of state.sources) delete s.offset;
  return project;
}

addProject('Q4 Vendor Migration', Q4, SOURCES);

for (const [name, rows] of Object.entries(SIDE)) {
  addProject(
    name,
    rows.map(([text, owner, ws, due, done]) => [text, owner, ws, due, 'notes', text, done ? { done } : {}]),
    { notes: ['mtg', `${name} sync`, -4] },
  );
}

// --------------------------------------------------------------------------- write

const keep = process.argv.includes('--keep');
if (keep) {
  try {
    const cur = JSON.parse(await fs.readFile(FILE, 'utf8'));
    if (cur.projects?.length) {
      console.log(`Store already has ${cur.projects.length} project(s); leaving it alone (--keep).`);
      process.exit(0);
    }
  } catch { /* nothing there yet */ }
}

await fs.mkdir(DIR, { recursive: true });
await fs.writeFile(FILE, JSON.stringify(state, null, 2));

// Mirror the history into Tiger Data when it is configured, so the Timeline and the commitment
// lifecycle read from the hypertable rather than only the JSON file. Safe to re-run: it clears
// this demo's projects first.
async function toTiger() {
  let url = process.env.DATABASE_URL;
  if (!url) {
    try {
      const line = (await fs.readFile('.env.local', 'utf8')).split('\n').find((l) => l.startsWith('DATABASE_URL='));
      if (line) url = line.slice('DATABASE_URL='.length).trim();
    } catch { /* no env file */ }
  }
  if (!url) return '  Tiger Data not configured; history stays in .data/store.json.';

  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS commitment_events (
      time TIMESTAMPTZ NOT NULL, action_item_id TEXT NOT NULL, project_id TEXT NOT NULL,
      event_type TEXT NOT NULL, old_value TEXT, new_value TEXT)`);
    await pool.query(`SELECT create_hypertable('commitment_events', 'time', if_not_exists => TRUE)`);
    // Seeding replaces the whole store, so clear the whole hypertable too. Deleting only this
    // run's project ids left history behind from earlier runs, which no screen could ever show.
    const { rowCount: cleared } = await pool.query('DELETE FROM commitment_events');
    // One statement, not one round trip per event.
    const values = state.events.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(',');
    const args = state.events.flatMap((e) => [e.time, e.action_item_id, e.project_id, e.event_type, e.old_value, e.new_value]);
    if (state.events.length) await pool.query(`INSERT INTO commitment_events VALUES ${values}`, args);
    const { rows } = await pool.query('SELECT count(*) c FROM commitment_events');
    return `  Mirrored ${state.events.length} events to Tiger Data (cleared ${cleared} stale rows, ${rows[0].c} rows now).`;
  } catch (e) {
    return `  Tiger Data write failed (${e.message}); history stays in .data/store.json.`;
  } finally {
    await pool.end();
  }
}

const open = state.items.filter((i) => i.type === 'action' && i.status === 'open');
console.log(`Seeded ${FILE}`);
console.log(`  ${state.projects.length} projects · ${state.people.length} people · ${state.sources.length} sources`);
console.log(`  ${state.items.length} items (${open.length} open) · ${state.events.length} events`);
console.log(await toTiger());
console.log('  Restart or refresh the app to see the grove.');
