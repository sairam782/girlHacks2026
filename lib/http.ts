// Small helpers shared by the route handlers.
import { NextResponse } from 'next/server';

/** Thrown when a request body is not usable. Routes turn it into a 400. */
export class BadRequest extends Error {}

/**
 * Reads a JSON body. `await req.json()` throws on an empty or malformed body, which otherwise
 * surfaces as a bare 500 with no message, so every caller goes through here instead.
 */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object') return body as T;
  } catch { /* falls through to the same message */ }
  throw new BadRequest('Expected a JSON object in the request body.');
}

/** Maps a thrown error to a response: BadRequest to 400, anything else to `status`. */
export function fail(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status: e instanceof BadRequest ? 400 : status });
}
