// Tiger Data (TimescaleDB) hypertable for CommitmentEvent. Enabled when DATABASE_URL is set; otherwise the JSON store is used.
import { Pool } from 'pg';
import type { CommitmentEvent } from './types';

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

export const tigerEnabled = () => !!process.env.DATABASE_URL;

function init(): Promise<void> {
  if (!ready) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
    ready = (async () => {
      await pool!.query(`CREATE TABLE IF NOT EXISTS commitment_events (
        time TIMESTAMPTZ NOT NULL, action_item_id TEXT NOT NULL, project_id TEXT NOT NULL,
        event_type TEXT NOT NULL, old_value TEXT, new_value TEXT)`);
      await pool!.query(`SELECT create_hypertable('commitment_events', 'time', if_not_exists => TRUE)`);
      await pool!.query(`CREATE INDEX IF NOT EXISTS commitment_events_item ON commitment_events (action_item_id, time DESC)`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function tigerInsert(evs: CommitmentEvent[]): Promise<void> {
  if (!tigerEnabled() || !evs.length) return;
  try {
    await init();
    for (const e of evs) {
      await pool!.query('INSERT INTO commitment_events VALUES ($1,$2,$3,$4,$5,$6)', [e.time, e.action_item_id, e.project_id, e.event_type, e.old_value, e.new_value]);
    }
  } catch (err) { console.error('[tiger] insert failed', err); }
}

export async function tigerHistory(projectId: string): Promise<CommitmentEvent[] | null> {
  if (!tigerEnabled()) return null;
  try {
    await init();
    const r = await pool!.query('SELECT time, action_item_id, project_id, event_type, old_value, new_value FROM commitment_events WHERE project_id = $1 ORDER BY time ASC', [projectId]);
    return r.rows.map((x) => ({ ...x, time: new Date(x.time).toISOString() }));
  } catch (err) { console.error('[tiger] query failed', err); return null; }
}
