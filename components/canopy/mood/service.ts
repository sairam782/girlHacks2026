// The Python Mood Mirror service in mood-mirror/. It does the things Next.js cannot: speaker
// separation from a recording (ElevenLabs Scribe or Azure Speech), the opt-in face layer, and the
// spoken per-person brief. Those last two need an analysis id from its in-memory store, so every
// upload goes through it whenever it is up.
//
//   cd mood-mirror && pip install -r requirements.txt && uvicorn app:app --port 8000
//
// Without it, components/canopy/mood/engine.ts still analyses transcripts in-process.

export const serviceUrl = () => (process.env.MOOD_MIRROR_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

/** Fetch from the service, with a timeout so a dead port never hangs a request. */
export function serviceFetch(path: string, init: RequestInit = {}, timeoutMs = 120_000) {
  return fetch(`${serviceUrl()}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
}

/** Hands the service's own JSON response straight back to the browser. */
export async function relay(res: Response) {
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const START_SERVICE_HINT =
  'Start it with: cd mood-mirror && pip install -r requirements.txt && uvicorn app:app --port 8000';
