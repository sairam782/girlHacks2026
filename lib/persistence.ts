// Vercel instances share PostgreSQL state; local development retains the JSON store.
import { Pool } from 'pg';
import { buildDemo } from '@/scripts/demo-data.mjs';
import type { AppState } from './types';

export const databaseStore = () => process.env.CANOPY_STORE === 'postgres' || !!process.env.VERCEL;
const storeKey = () => process.env.CANOPY_STORE_KEY || 'canopy-demo';
let pool: Pool | undefined;
let ready: Promise<void> | undefined;

function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for persistent Vercel storage.');
  return pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    // DATABASE_URL can supply the provider's sslmode and certificate settings.
    ...(process.env.DATABASE_SSL === 'false' ? { ssl: false } : {}),
  });
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
