// Turns a briefing script into speech with ElevenLabs. Returns 501 when no API key is set,
// which tells the client to fall back to the browser's built-in voice.

const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'; // "Rachel", a stock ElevenLabs voice

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: 'ELEVENLABS_API_KEY is not set' }, { status: 501 });

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.length > 2000) return Response.json({ error: 'text is required (max 2000 chars)' }, { status: 400 });

  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' }),
  });
  if (!res.ok) return Response.json({ error: `ElevenLabs error ${res.status}`, detail: await res.text() }, { status: 502 });

  return new Response(res.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' } });
}
