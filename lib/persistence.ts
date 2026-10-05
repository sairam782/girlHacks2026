// Vercel instances share PostgreSQL state; local development retains the JSON store.
import { Pool } from 'pg';
import { buildDemo } from '@/scripts/demo-data.mjs';
import type { AppState } from './types';

export const databaseStore = () => process.env.CANOPY_STORE === 'postgres' || !!process.env.VERCEL || !!process.env.CANOPY_DATABASE_URL;
const storeKey = () => process.env.CANOPY_STORE_KEY || 'canopy-demo';
let pool: Pool | undefined;
let ready: Promise<void> | undefined;

function db() {
  const connectionString = process.env.CANOPY_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('A PostgreSQL connection is required for persistent Vercel storage.');
  if (pool) return pool;
  pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 10000,
    // DATABASE_URL can supply the provider's sslmode and certificate settings.
    ...(process.env.DATABASE_SSL === 'false' ? { ssl: false } : {}),
  });
  pool.on('error', (error) => console.error('[database] idle connection error', error.message));
  return pool;
}

async function init() {
  if (!ready) ready = (async () => {
    await db().query('CREATE TABLE IF NOT EXISTS canopy_app_state (id TEXT PRIMARY KEY, state JSONB NOT NULL)');
    const initial: AppState = process.env.CANOPY_DEMO_MODE === 'true'
      ? buildDemo() as AppState
      : { projects: [], people: [], sources: [], items: [], events: [] };
    await db().query('INSERT INTO canopy_app_state (id, state) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [storeKey(), JSON.stringify(initial)]);
  })().catch((error) => { ready = undefined; throw error; });
  await ready;
}

export async function readDatabase(): Promise<AppState> {
  await init();
  const result = await db().query('SELECT state FROM canopy_app_state WHERE id = $1', [storeKey()]);
  if (!result.rows[0]) throw new Error('The Canopy store is missing.');
  return result.rows[0].state;
}

export async function mutateDatabase<T>(change: (state: AppState) => Promise<T>): Promise<T> {
  await init();
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    // Database locking protects against concurrent writes across function instances.
    const result = await client.query('SELECT state FROM canopy_app_state WHERE id = $1 FOR UPDATE', [storeKey()]);
    if (!result.rows[0]) throw new Error('The Canopy store is missing.');
    const state: AppState = result.rows[0].state;
    const output = await change(state);
    await client.query('UPDATE canopy_app_state SET state = $2::jsonb WHERE id = $1', [storeKey(), JSON.stringify(state)]);
    await client.query('COMMIT');
    return output;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
