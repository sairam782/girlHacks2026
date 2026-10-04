// Morning briefing: build a ~150-word script per person, then voice it with ElevenLabs (cached per person per day).
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { DATA_DIR } from './store';
import { diffDays, fmtLong, weekday, WEEKDAYS } from './dates';
import type { ActionItem, AppState, Person } from './types';
import { speak } from './tts';

const MAX_WORDS = 165;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const dayName = (d: string) => WEEKDAYS[weekday(d)].replace(/^./, (c) => c.toUpperCase());
const trimText = (t: string) => t.replace(/[.!?]+$/, '').replace(/^./, (c) => c.toLowerCase());

export function buildScript(person: Person, state: AppState, asof: string): string {
  const mine = state.items.filter((i) => i.owner_id === person.id && i.type === 'action' && i.status === 'open');
  const proj = (i: ActionItem) => state.projects.find((p) => p.id === i.project_id)?.name;
  const withDate = mine.filter((i) => i.deadline);
  const overdue = withDate.filter((i) => diffDays(asof, i.deadline!) < 0).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const today = withDate.filter((i) => i.deadline === asof);
  const week = withDate.filter((i) => { const d = diffDays(asof, i.deadline!); return d > 0 && d <= 7; }).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const first = person.name.split(' ')[0];
  const hour = 'Good morning';

  if (!overdue.length && !today.length && !week.length) {
    return `${hour}, ${first}. It is ${fmtLong(asof)}. Nothing is overdue and nothing is due today or this week. ${mine.length ? `You have ${plural(mine.length, 'open item')} further out, so you are clear for now.` : 'You have no open commitments.'} Enjoy the quiet.`;
  }

  const parts: string[] = [`${hour}, ${first}. It is ${fmtLong(asof)}. You have ${today.length ? plural(today.length, 'item') : 'nothing'} due today.`];
  const cap = (xs: ActionItem[], n: number) => xs.slice(0, n);
  const build = (limit: number) => {
    const out = [...parts];
    if (overdue.length) {
      out.push(`First, ${plural(overdue.length, 'overdue item')}.`);
      cap(overdue, limit).forEach((i) => out.push(`${i.text.replace(/[.!?]+$/, '')}, ${plural(-diffDays(asof, i.deadline!), 'day')} late${proj(i) ? `, on ${proj(i)}` : ''}.`));
      if (overdue.length > limit) out.push(`Plus ${overdue.length - limit} more.`);
    }
    if (today.length) {
      out.push('Due today.');
      cap(today, limit).forEach((i) => out.push(`${i.text.replace(/[.!?]+$/, '')}.`));
      if (today.length > limit) out.push(`Plus ${today.length - limit} more.`);
    }
    if (week.length) {
      out.push(`Coming this week, ${plural(week.length, 'item')}.`);
      cap(week, limit).forEach((i) => out.push(`${i.text.replace(/[.!?]+$/, '')}, due ${dayName(i.deadline!)}.`));
      if (week.length > limit) out.push(`Plus ${week.length - limit} more.`);
    }
    const top = overdue[0] || today[0] || week[0];
    out.push(`If you do one thing today, ${overdue[0] ? 'clear' : 'finish'}: ${trimText(top.text)}.`);
    return out.join(' ');
  };
  // Shrink the lists until the script fits the 60-second target.
  for (const limit of [3, 2, 1]) {
    const s = build(limit);
    if (words(s) <= MAX_WORDS || limit === 1) return s;
  }
  return build(1);
}

export interface BriefingResult { script: string; audio: string | null; cached: boolean; engine: 'elevenlabs' | 'browser'; note?: string }

export async function briefing(personId: string, state: AppState, asof: string): Promise<BriefingResult> {
  const person = state.people.find((p) => p.id === personId);
  if (!person) throw new Error('Unknown person');
  const script = buildScript(person, state, asof);
  if (!process.env.ELEVENLABS_API_KEY) return { script, audio: null, cached: false, engine: 'browser', note: 'No ELEVENLABS_API_KEY set; using the browser voice.' };

  // A second Vercel request may run on another instance. Return audio directly rather
  // than handing the browser a URL to a file on this invocation's temporary disk.
  if (process.env.VERCEL) {
    const audio = await speak(script);
    return { script, audio: audio ? `data:audio/mpeg;base64,${audio.toString('base64')}` : null,
      cached: false, engine: audio ? 'elevenlabs' : 'browser' };
  }

  const key = `${person.id}-${asof}-${createHash('sha1').update(script).digest('hex').slice(0, 8)}`;
  const file = path.join(DATA_DIR, 'audio', `${key}.mp3`);
  const url = `/api/briefing/audio?key=${key}`;
  try { await fs.access(file); return { script, audio: url, cached: true, engine: 'elevenlabs' }; } catch { /* not cached yet */ }

  const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: script, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2' }),
  });
  if (!res.ok) return { script, audio: null, cached: false, engine: 'browser', note: `ElevenLabs failed (${res.status}); using the browser voice.` };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  return { script, audio: url, cached: false, engine: 'elevenlabs' };
}
