import { NextResponse } from 'next/server';
import { handleVoice, type Turn } from '@/lib/voice';
import { speak } from '@/lib/tts';
import { isDate, todayISO } from '@/lib/dates';
import { fail, readJson } from '@/lib/http';

export const maxDuration = 60;

interface Body { said?: unknown; personId?: unknown; asof?: unknown; history?: unknown }

const isTurn = (h: unknown): h is Turn =>
  !!h && typeof h === 'object' && typeof (h as Turn).text === 'string'
  && ((h as Turn).who === 'you' || (h as Turn).who === 'canopy');

export async function POST(req: Request) {
  try {
    const b = await readJson<Body>(req);
    const said = typeof b.said === 'string' ? b.said.trim().slice(0, 500) : '';
    if (!said) return NextResponse.json({ error: 'Nothing was heard.' }, { status: 400 });

    // The last few turns let it resolve "push it to Friday" against whatever was just discussed.
    const history: Turn[] = Array.isArray(b.history) ? b.history.filter(isTurn).slice(-6) : [];
    const r = await handleVoice(said, String(b.personId ?? ''), isDate(b.asof) ? b.asof : todayISO(), history);
    const mp3 = await speak(r.reply.slice(0, 1500));
    return NextResponse.json({ ...r, audio: mp3 ? `data:audio/mpeg;base64,${mp3.toString('base64')}` : null });
  } catch (e) {
    return fail(e, 400);
  }
}
