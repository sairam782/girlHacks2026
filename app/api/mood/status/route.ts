// What Mood Mirror can do right now: which engine labels tone, and whether recordings
// can be transcribed (that needs the Python service plus speech keys).

import { llmEngine } from '@/components/canopy/mood/azure';
import { serviceUrl } from '@/components/canopy/mood/service';
import type { MoodStatus } from '@/components/canopy/mood/types';

// /api/status reports `speech` as a boolean (Azure Speech configured or not), or as the name of
// the engine it ended up with. Read both, and only trust a response that looks like this service.
function readSpeech(body: unknown): Pick<MoodStatus, 'speech' | 'speechEngine'> | null {
  if (!body || typeof body !== 'object') return null;
  const { speech, emotions } = body as { speech?: unknown; emotions?: unknown };
  if (speech === undefined && !Array.isArray(emotions)) return null;
  if (typeof speech === 'string') {
    const on = speech !== '' && speech !== 'none' && speech !== 'offline';
    return { speech: on, speechEngine: on ? speech : undefined };
  }
  return { speech: speech === true, speechEngine: speech === true ? 'Azure Speech' : undefined };
}

export async function GET() {
  let found: Pick<MoodStatus, 'speech' | 'speechEngine'> | null = null;
  try {
    const res = await fetch(`${serviceUrl()}/api/status`, { signal: AbortSignal.timeout(1200), cache: 'no-store' });
    if (res.ok) found = readSpeech(await res.json());
  } catch {
    // The service is optional; transcripts and the demo work without it.
  }
  const status: MoodStatus = { speech: found?.speech ?? false, speechEngine: found?.speechEngine, llm: llmEngine(), service: found !== null };
  return Response.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
