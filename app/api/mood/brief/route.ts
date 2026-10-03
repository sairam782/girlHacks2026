// The private spoken recap of one person's own mood report. POST builds the script (and the audio,
// when the service has an ElevenLabs key); GET streams that audio back.

import { serviceFetch, START_SERVICE_HINT } from '@/components/canopy/mood/service';

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Send analysis_id and speaker as form data.' }, { status: 400 });
  }
  if (!form.get('analysis_id') || !form.get('speaker')) {
    return Response.json({ error: 'Run the meeting analysis again, then ask for the brief.' }, { status: 400 });
  }

  try {
    const res = await serviceFetch('/api/brief', { method: 'POST', body: form }, 60_000);
    const body = await res.json().catch(() => ({}));
    // The service points at its own audio route; send the browser to ours instead.
    if (res.ok && body?.audio) {
      const q = new URLSearchParams({ analysis_id: String(form.get('analysis_id')), speaker: String(form.get('speaker')) });
      body.url = `/api/mood/brief?${q}`;
    }
    return Response.json(body, { status: res.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: `The spoken brief needs the Mood Mirror service. ${START_SERVICE_HINT}` }, { status: 503 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = new URLSearchParams({
    analysis_id: searchParams.get('analysis_id') ?? '',
    speaker: searchParams.get('speaker') ?? '',
  });

  try {
    const res = await serviceFetch(`/api/brief/audio?${q}`, {}, 60_000);
    if (!res.ok) return Response.json({ error: 'Generate the brief first.' }, { status: res.status });
    return new Response(res.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: `The spoken brief needs the Mood Mirror service. ${START_SERVICE_HINT}` }, { status: 503 });
  }
}
