// Mood Mirror upload endpoint. Accepts a transcript (.json/.txt/.vtt/.srt/.docx), a recording,
// or both at once — the service takes the words from the transcript and keeps the video for the
// face layer.
//
// Everything goes to the Python service when it is up, because only a report from the service
// carries the analysis id that /api/mood/face and /api/mood/brief need. If the service is down,
// a .json transcript is still analysed in-process; recordings need the service.

import { addSuggestions, labelTurns } from '@/components/canopy/mood/azure';
import { analyzeTurns, EmptyMeetingError } from '@/components/canopy/mood/engine';
import { relay, serviceFetch, START_SERVICE_HINT } from '@/components/canopy/mood/service';

const MAX_TRANSCRIPT_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Send the file as multipart/form-data.' }, { status: 400 });
  }

  const files = ['file', 'transcript', 'media'].filter((k) => form.get(k) instanceof File);
  if (!files.length) return Response.json({ error: 'No file received.' }, { status: 400 });

  const url = new URL(req.url);
  const language = url.searchParams.get('language') || 'en-US';
  const engine = url.searchParams.get('engine') === 'offline' ? 'offline' : 'auto';
  const speakers = url.searchParams.get('num_speakers');
  const query = new URLSearchParams({ language, engine, ...(speakers ? { num_speakers: speakers } : {}) });

  try {
    const res = await serviceFetch(`/api/analyze?${query}`, { method: 'POST', body: form });
    return relay(res);
  } catch {
    // Service not running: a JSON transcript can still be analysed here.
  }

  const solo = form.get('transcript') ?? form.get('file');
  const name = solo instanceof File ? solo.name : '';
  if (!(solo instanceof File) || !name.toLowerCase().endsWith('.json')) {
    return Response.json({
      error: `Recordings and .txt/.vtt/.srt/.docx transcripts need the Mood Mirror service. ${START_SERVICE_HINT} `
        + 'A transcript .json works without it.',
    }, { status: 503 });
  }
  if (solo.size > MAX_TRANSCRIPT_BYTES) return Response.json({ error: 'Transcript is larger than 4 MB.' }, { status: 413 });

  let parsed: { title?: string; turns?: unknown } | unknown[];
  try {
    parsed = JSON.parse(await solo.text());
  } catch (e) {
    return Response.json({ error: `Transcript JSON not readable: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }
  const turns = Array.isArray(parsed) ? parsed : parsed?.turns;
  const title = (!Array.isArray(parsed) && typeof parsed?.title === 'string' && parsed.title) || name.replace(/\.json$/i, '');

  try {
    const report = await analyzeTurns(turns, title, 'transcript file', {
      ...(engine === 'offline' ? {} : { labelTurns, suggest: addSuggestions }),
    });
    return Response.json(report);
  } catch (e) {
    if (e instanceof EmptyMeetingError) return Response.json({ error: e.message }, { status: 400 });
    console.error('[mood] transcript analysis failed:', e);
    return Response.json({ error: 'Could not analyze that transcript.' }, { status: 500 });
  }
}
