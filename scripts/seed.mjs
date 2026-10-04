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
import { buildDemo } from './demo-data.mjs';

const DIR = process.env.CANOPY_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'store.json');
const state = buildDemo();

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
