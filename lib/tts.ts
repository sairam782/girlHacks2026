// ElevenLabs text-to-speech. Returns null when no key is set or the call fails, so callers can fall back to the browser voice.
export async function speak(text: string): Promise<Buffer | null> {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2' }),
    });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch { return null; }
}
