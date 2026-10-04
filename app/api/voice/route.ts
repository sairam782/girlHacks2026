import { NextResponse } from 'next/server';
import { handleVoice } from '@/lib/voice';
import { speak } from '@/lib/tts';
import { isDate, todayISO } from '@/lib/dates';

export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json();
  const said = typeof b.said === 'string' ? b.said.trim().slice(0, 500) : '';
  if (!said) return NextResponse.json({ error: 'Nothing was heard.' }, { status: 400 });
  try {
    const r = await handleVoice(said, b.personId, isDate(b.asof) ? b.asof : todayISO());
    const mp3 = await speak(r.reply.slice(0, 1500));
    return NextResponse.json({ ...r, audio: mp3 ? `data:audio/mpeg;base64,${mp3.toString('base64')}` : null });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
