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

const open = state.items.filter((i) => i.type === 'action' && i.status === 'open');
console.log(`Seeded ${FILE}`);
console.log(`  ${state.projects.length} projects · ${state.people.length} people · ${state.sources.length} sources`);
console.log(`  ${state.items.length} items (${open.length} open) · ${state.events.length} events`);
console.log('  Restart or refresh the app to see the grove.');
