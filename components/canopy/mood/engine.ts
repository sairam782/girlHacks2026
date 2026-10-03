// The Mood Mirror analysis, in TypeScript: cut-offs and parked questions, tone from words,
// per-person report, and suggestions tied to timestamps.
//
// This is a port of mood-mirror/insights.py plus the offline lexicon from mood-mirror/emotions.py,
// so a transcript can be analysed inside Next.js with no Python process and no API keys. Audio
// still needs the Python service (Azure Speech does the speaker separation) — see
// app/api/mood/analyze/route.ts.

import {
  EMOTIONS, VALENCE, mmss,
  type Emotion, type Moment, type MoodReport, type PersonReport, type RawTurn, type Suggestion, type Turn,
} from './types';

// Rounds away from zero on a tie, which tracks the Python service closely. Chart values can
// still land 0.01 apart on an exact half, which is well under a pixel once drawn.
const r = (x: number, n: number) => {
  const f = 10 ** n;
  return (Math.sign(x) * Math.round(Math.abs(x) * f)) / f;
};

/** Phrases that move a question past, matched at the start of the reply. */
const DEFLECT = /^\s*(moving on|let['’]s take that offline|let['’]s park|park that|let['’]s keep moving|not now|we['’]ll come back|later)/i;

const NEGATIVE: Emotion[] = ['frustrated', 'angry', 'sad', 'anxious', 'confused'];

// Words a sentence does not end on, used to spot a turn that was still mid-thought.
const OPEN_ENDINGS = new Set(['and', 'but', 'because', 'so', 'or', 'the', 'a', 'an', 'to', 'that', 'which',
  'if', 'of', 'with', 'for', 'is', 'was', 'we', 'i', 'my', 'our', 'like', 'um', 'uh', 'then', 'when', 'where']);

const short = (text: string, n: number) => {
  if (text.length <= n) return text;
  const s = text.slice(0, n);
  const i = s.lastIndexOf(' ');
  return (i === -1 ? s : s.slice(0, i)) + '…';
};

const tail = (text: string, n: number) => {
  if (text.length <= n) return text;
  const s = text.slice(-n);
  const i = s.indexOf(' ');
  return i === -1 ? s : s.slice(i + 1);
};

// ------------------------------------------------------------------ the facts

/** Marks moments anyone can check against the transcript: cut-offs and questions moved past. */
export function flagEvents<T extends RawTurn & { id: number }>(turns: T[]): (T & Pick<Turn, 'cut_off' | 'cut_off_by' | 'deflected_question'>)[] {
  return turns.map((t, i) => {
    const next = turns[i + 1];
    const out = { ...t, cut_off: false, deflected_question: false } as T & Pick<Turn, 'cut_off' | 'cut_off_by' | 'deflected_question'>;
    if (next && next.speaker !== t.speaker) {
      // Some transcribers (e.g. ElevenLabs Scribe) drop the final period of a turn, so a missing
      // period alone is not proof. Count a cut-off when the next person talks over them, or jumps
      // in instantly while the sentence is clearly mid-thought ("...because users drop off and").
      const noPeriod = !/[.!?…]\s*$/.test(t.text);
      const talkedOver = next.start < t.end - 0.05;
      const jumpedIn = next.start < t.end + 0.25;
      const words = t.text.toLowerCase().match(/[a-z']+/g) ?? [];
      const midThought = words.length > 0 && OPEN_ENDINGS.has(words[words.length - 1]);
      const trailsOff = /(--|—|–|-|\.\.\.|…)\s*$/.test(t.text); // "so we could—"
      if ((noPeriod && (talkedOver || (jumpedIn && midThought))) || (trailsOff && jumpedIn)) {
        out.cut_off = true;
        out.cut_off_by = next.speaker;
      }
      if (t.text.includes('?') && DEFLECT.test(next.text)) out.deflected_question = true;
    }
    return out;
  });
}

// -------------------------------------------------------- offline tone labels

const LEXICON: Record<Exclude<Emotion, 'neutral'>, string[]> = {
  angry: ['unacceptable', 'ridiculous', 'furious', 'who dropped', '\\bangry\\b', 'fed up', 'this is a joke'],
  frustrated: ['frustrat\\w*', 'keeps? getting', 'twice now', 'again and again', 'annoy\\w*',
    "like i said", 'still waiting', 'for the third time'],
  anxious: ['worried', 'nervous', 'anxious', 'not sure we can', 'what if', 'scared',
    'concerned', 'even tighter', 'stress\\w*'],
  confused: ['confus\\w*', '\\blost\\b', "don['’]t follow", "don['’]t understand", 'which deadline',
    'unclear', 'not sure what', 'wait, sorry', 'what do you mean'],
  sad: ['disappoint\\w*', '\\bsad\\b', 'bummed', 'let down', 'unfortunately', 'miss (it|that)'],
  happy: ['\\bgreat\\b', 'thrilled', '\\blove\\b', 'awesome', 'fantastic', '\\bhappy\\b', '\\bglad\\b',
    'thank you', 'helps', 'feel better', 'perfect', 'excited', 'going well'],
  confident: ['confident', 'i can own', "i['’]ll have", '\\bready\\b', 'i already', '\\bsure\\b',
    'definitely', "i['’]ve got (it|this)"],
};

// When two labels tie, the earlier one wins (negative states are rarer, so surface them).
const PRIORITY: Exclude<Emotion, 'neutral'>[] = ['angry', 'frustrated', 'anxious', 'confused', 'sad', 'happy', 'confident'];

/** Tone from the words alone. Used on its own, and to fill any gaps the LLM leaves. */
export function labelOneOffline<T extends RawTurn>(t: T): T & Pick<Turn, 'emotion' | 'intensity' | 'evidence'> {
  const text = t.text.toLowerCase();
  let best: Emotion = 'neutral';
  let bestHits = 0;
  let evidence = '';
  for (const emo of PRIORITY) {
    const hits: string[] = [];
    for (const p of LEXICON[emo]) {
      for (const m of text.matchAll(new RegExp(p, 'g'))) hits.push(m[0]);
    }
    if (hits.length > bestHits) {
      best = emo;
      bestHits = hits.length;
      // Lower-casing keeps the length, so the index maps back to the speaker's own casing.
      const idx = text.indexOf(hits[0]);
      evidence = t.text.slice(idx, idx + hits[0].length);
    }
  }
  const bangs = (t.text.match(/!/g) ?? []).length;
  const intensity = best === 'neutral' ? 0 : Math.min(1, 0.45 + 0.2 * bestHits + 0.1 * bangs);
  return { ...t, emotion: best, intensity: r(intensity, 2), evidence };
}

// --------------------------------------------------------------- the report

/** A feeling plus what happened just before it, so the person sees the cause, not just the mood. */
function moment(t: Turn, turns: Turn[]): Moment {
  const idx = turns.findIndex((x) => x.id === t.id);
  let context: string | null = null;
  for (let j = idx - 1; j >= 0; j--) {
    const p = turns[j];
    if (t.start - p.start > 120) break;
    if (NEGATIVE.includes(t.emotion) && p.speaker === t.speaker && (p.cut_off || p.deflected_question)) {
      context = (p.cut_off ? 'You were cut off at ' : 'Your question was moved past at ') + mmss(p.start);
      break;
    }
  }
  return {
    id: t.id, t: t.start, time: mmss(t.start), text: t.text, emotion: t.emotion,
    intensity: t.intensity, evidence: t.evidence, cut_off: t.cut_off,
    deflected_question: t.deflected_question, context,
  };
}

export function summarize(turns: Turn[]): Pick<MoodReport, 'people' | 'team'> {
  const byPerson = new Map<string, Turn[]>();
  for (const t of turns) {
    const list = byPerson.get(t.speaker);
    if (list) list.push(t);
    else byPerson.set(t.speaker, [t]);
  }
  const totalTime = turns.reduce((a, t) => a + Math.max(0, t.end - t.start), 0) || 1;

  const people: Record<string, PersonReport> = {};
  for (const [name, ts] of byPerson) {
    // A Map keeps first-seen order, so a tie on count goes to the tone heard first.
    const counts = new Map<Emotion, number>();
    for (const t of ts) counts.set(t.emotion, (counts.get(t.emotion) ?? 0) + 1);

    const mix = Object.fromEntries(EMOTIONS.map((e) => [e, r((counts.get(e) ?? 0) / ts.length, 3)])) as Record<Emotion, number>;
    const score = 50 + (50 * ts.reduce((a, t) => a + VALENCE[t.emotion] * Math.max(t.intensity, t.emotion !== 'neutral' ? 0.5 : 0), 0)) / ts.length;
    const nonNeutral = [...counts].filter(([e]) => e !== 'neutral');
    const airtime = ts.reduce((a, t) => a + Math.max(0, t.end - t.start), 0);

    people[name] = {
      turns: ts.length,
      words: ts.reduce((a, t) => a + t.text.split(/\s+/).filter(Boolean).length, 0),
      airtime_sec: r(airtime, 1),
      airtime_share: r(airtime / totalTime, 3),
      mood_score: Math.round(Math.max(0, Math.min(100, score))),
      dominant: nonNeutral.length ? nonNeutral.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : 'neutral',
      mix,
      questions: ts.filter((t) => t.text.includes('?')).length,
      cut_offs: ts.filter((t) => t.cut_off).length,
      deflected_questions: ts.filter((t) => t.deflected_question).length,
      interrupted_others: turns.filter((x) => x.cut_off && x.cut_off_by === name).map((x) => mmss(x.start)),
      parked_questions: turns.flatMap((x, i) => (i > 0 && x.speaker === name && turns[i - 1].deflected_question ? [mmss(turns[i - 1].start)] : [])),
      timeline: ts.map((t) => ({ id: t.id, t: t.start, emotion: t.emotion, valence: r(VALENCE[t.emotion] * (t.intensity || 0), 2) })),
      moments: ts.filter((t) => t.emotion !== 'neutral' || t.cut_off || t.deflected_question).map((t) => moment(t, turns)),
      equal_share: 0,
      suggestions: [],
    };
  }

  const n = byPerson.size || 1;
  const vals = Object.values(people);
  for (const p of vals) p.equal_share = r(1 / n, 3);
  const team = {
    people: n,
    duration_sec: r(turns.reduce((a, t) => Math.max(a, t.end), 0), 1),
    mood_score: Math.round(vals.reduce((a, p) => a + p.mood_score, 0) / n),
    mix: Object.fromEntries(EMOTIONS.map((e) => [e, r(vals.reduce((a, p) => a + p.mix[e], 0) / n, 3)])) as Record<Emotion, number>,
    equal_airtime_share: r(1 / n, 3),
  };
  return { people, team };
}

// ----------------------------------------------------------- suggestions

export function suggestOffline(p: PersonReport): Suggestion[] {
  const tips: Suggestion[] = [];
  const ms = p.moments;
  const first = (pred: (m: Moment) => boolean) => ms.find(pred);
  const q = (m: Moment) => (m.evidence ? `"${m.evidence}"` : `"${short(m.text, 60)}"`);
  const question = (text: string) => {
    const qs = (text.match(/[^.!?]*\?/g) ?? []).map((x) => x.trim());
    return qs.length ? qs[qs.length - 1] : short(text, 80);
  };

  let m = first((x) => x.deflected_question);
  if (m) tips.push({ title: 'Get your question answered', at: m.t,
    detail: `At ${m.time} you asked "${question(m.text)}" and the meeting moved on. Put it in the follow-up message and ask for a named owner and a date.` });

  m = first((x) => x.cut_off);
  if (m) tips.push({ title: 'Finish the point that got cut off', at: m.t,
    detail: `You were cut off at ${m.time} ("…${tail(m.text, 50)}"). Open the next meeting with it, or post it in writing today so it is on record as yours.` });

  m = first((x) => x.emotion === 'angry' || x.emotion === 'frustrated');
  if (m) tips.push({ title: 'Turn it into a clear request', at: m.t,
    detail: `At ${m.time} you said ${q(m)}. Follow up with one specific ask: who owns it and by when. Requests get action faster than complaints.` });

  m = first((x) => x.emotion === 'anxious');
  if (m) tips.push({ title: "Pin down what's worrying you", at: m.t,
    detail: `At ${m.time} you flagged a worry (${q(m)}). Ask for one concrete safeguard: a freeze date, a buffer day, or a scope cut.` });

  m = first((x) => x.emotion === 'confused');
  if (m) tips.push({ title: 'Ask for decisions in writing', at: m.t,
    detail: `You were unsure at ${m.time} (${q(m)}). Ask the organizer to post decisions, owners and dates after the meeting so nothing depends on memory.` });

  m = first((x) => x.emotion === 'sad');
  if (m) tips.push({ title: 'Name what you want back', at: m.t,
    detail: `At ${m.time} you sounded let down (${q(m)}). Propose when it could return, for example a slot in next sprint's plan.` });

  if (p.parked_questions.length) tips.push({ title: 'Close the loops you parked', at: null,
    detail: `You moved past ${p.parked_questions.length} question(s) from others (at ${p.parked_questions.join(', ')}). Answer them in the follow-up so people know they were heard.` });

  if (p.interrupted_others.length) tips.push({ title: 'Let the last point land', at: null,
    detail: `Someone was cut off while you started talking at ${p.interrupted_others.join(', ')}. Next time, ask "Were you finished?" before moving on.` });

  if (p.airtime_share > 1.6 * p.equal_share) tips.push({ title: 'Leave room for others', at: null,
    detail: `You spoke ${Math.round(p.airtime_share * 100)}% of the time (an even split is ${Math.round(p.equal_share * 100)}%). Try asking the quietest person first next time.` });
  else if (p.airtime_share < 0.6 * p.equal_share) tips.push({ title: 'Get your point in early', at: null,
    detail: `You spoke ${Math.round(p.airtime_share * 100)}% of the time. Raise your top point in the first five minutes, before the agenda fills up.` });

  if (!tips.length) {
    const win = first((x) => x.emotion === 'happy' || x.emotion === 'confident');
    tips.push({ title: 'Keep doing what worked', at: win ? win.t : null,
      detail: (win ? `Your strongest moment was at ${win.time} (${q(win)}). ` : '') + 'Steady, constructive tone. Share credit for the wins in the follow-up.' });
  }
  return tips.slice(0, 3);
}

// ------------------------------------------------------------- orchestration

export class EmptyMeetingError extends Error {}

/** Clean, order and id the turns the way the Python service does. */
export function prepareTurns(raw: unknown): (RawTurn & { id: number })[] {
  if (!Array.isArray(raw)) throw new EmptyMeetingError('Transcript has no "turns" array.');
  const cleaned = raw
    .map((t) => t as Partial<RawTurn>)
    .filter((t) => typeof t?.text === 'string' && t.text.trim().length > 0)
    .map((t) => ({ speaker: String(t.speaker ?? 'Speaker'), start: Number(t.start) || 0, end: Number(t.end) || 0, text: String(t.text).trim() }))
    .sort((a, b) => a.start - b.start)
    .map((t, id) => ({ ...t, id }));
  if (!cleaned.length) throw new EmptyMeetingError('No speech found in this meeting.');
  return cleaned;
}

/**
 * Full pipeline with the offline engine. `labelTurns` lets a caller swap in the LLM labeller;
 * it must return one labelled turn per input turn, in order.
 */
export async function analyzeTurns(
  raw: unknown,
  title: string,
  source: string,
  opts: {
    labelTurns?: (turns: (RawTurn & { id: number } & Pick<Turn, 'cut_off' | 'deflected_question'>)[]) => Promise<{ turns: Turn[]; engine: MoodReport['engine']['labels'] }>;
    suggest?: (people: Record<string, PersonReport>, team: MoodReport['team']) => Promise<MoodReport['engine']['suggestions']>;
  } = {},
): Promise<MoodReport> {
  const flagged = flagEvents(prepareTurns(raw));

  let turns: Turn[];
  let labels: MoodReport['engine']['labels'] = 'offline';
  if (opts.labelTurns) {
    const res = await opts.labelTurns(flagged);
    turns = res.turns;
    labels = res.engine;
  } else {
    turns = flagged.map((t) => labelOneOffline(t) as Turn);
  }

  const { people, team } = summarize(turns);

  let suggestions: MoodReport['engine']['suggestions'] = 'offline';
  if (opts.suggest) suggestions = await opts.suggest(people, team);
  for (const p of Object.values(people)) if (!p.suggestions.length) p.suggestions = suggestOffline(p);

  return { title, source, engine: { labels, suggestions }, emotions: EMOTIONS, turns, people, team };
}
