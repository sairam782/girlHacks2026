// Voice agent: turns what someone said into an action on their commitments, then a spoken reply.
// Gemini picks the intent; the app runs it and writes the confirmation itself, so a reply never claims something that did not happen.
import { buildScript } from './briefing';
import { diffDays, fmt, isDate, resolveRelative, weekday, WEEKDAYS } from './dates';
import { getState, patchItem } from './store';
import type { ActionItem, AppState, Person } from './types';

export type Intent = 'list_owed' | 'briefing' | 'move_deadline' | 'mark_done' | 'reassign' | 'other';
interface Parsed { intent: Intent; itemId: string | null; newDeadline: string | null; newOwner: string | null; reply: string | null }
export interface VoiceResult { reply: string; changes: string[]; engine: 'gemini' | 'rules' }

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['list_owed', 'briefing', 'move_deadline', 'mark_done', 'reassign', 'other'] },
    itemId: { type: 'STRING', nullable: true },
    newDeadline: { type: 'STRING', nullable: true },
    newOwner: { type: 'STRING', nullable: true },
    reply: { type: 'STRING', nullable: true },
  },
  required: ['intent'],
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
const STOP = new Set(['the', 'and', 'for', 'push', 'move', 'mark', 'done', 'finished', 'complete', 'completed', 'set', 'that', 'this', 'with', 'out', 'can', 'you', 'please', 'to', 'until', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'tomorrow', 'next', 'week']);

// Best open item by word overlap with what was said; mine first. Null when nothing clearly matches.
function matchItem(said: string, mine: ActionItem[], all: ActionItem[]): ActionItem | null {
  const sw = new Set(words(said).filter((w) => !STOP.has(w)));
  const score = (it: ActionItem) => words(it.text).filter((w) => sw.has(w)).length;
  for (const pool of [mine, all]) {
    const ranked = pool.map((it) => ({ it, s: score(it) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (ranked.length && (ranked.length === 1 || ranked[0].s > ranked[1].s)) return ranked[0].it;
  }
  return null;
}

function rules(said: string, asof: string, mine: ActionItem[], all: ActionItem[]): Parsed {
  const t = said.toLowerCase();
  const none = { itemId: null, newDeadline: null, newOwner: null, reply: null };
  if (/\b(brief|briefing|summary|catch me up)\b/.test(t)) return { intent: 'briefing', ...none };
  if (/\b(what do i owe|what('s| is) due|what am i (supposed|due)|my (tasks|commitments|items|list)|due (today|this week))\b/.test(t)) return { intent: 'list_owed', ...none };
  if (/\b(push|move|delay|postpone|reschedule|extend)\b/.test(t)) {
    const date = resolveRelative(t.replace(/^.*?\b(to|until|by|till)\b/, ''), asof) ?? resolveRelative(t, asof);
    return { intent: 'move_deadline', ...none, itemId: matchItem(said, mine, all)?.id ?? null, newDeadline: date };
  }
  if (/\b(done|finished|complete|completed|wrapped up|sent|shipped)\b/.test(t)) return { intent: 'mark_done', ...none, itemId: matchItem(said, mine, all)?.id ?? null };
  const re = t.match(/\b(?:reassign|give|hand)\b.*?\bto\s+([a-z]+)/);
  if (re) return { intent: 'reassign', ...none, itemId: matchItem(said, mine, all)?.id ?? null, newOwner: re[1].replace(/^./, (c) => c.toUpperCase()) };
  return { intent: 'other', ...none };
}

async function viaGemini(said: string, asof: string, me: Person, all: ActionItem[], s: AppState): Promise<Parsed> {
  const owner = (i: ActionItem) => s.people.find((p) => p.id === i.owner_id)?.name ?? 'nobody';
  const list = all.slice(0, 80).map((i) => `${i.id} | ${i.text} | owner ${owner(i)} | due ${i.deadline ?? 'no date'}`).join('\n');
  const prompt = `You are the voice assistant in Canopy, a commitment tracker. The speaker is ${me.name}. Today is ${asof} (${WEEKDAYS[weekday(asof)]}).

Open commitments (id | text | owner | due):
${list || '(none)'}

They said: "${said}"

Pick one intent:
- list_owed: asks what they owe or what is due.
- briefing: asks for their briefing or a summary.
- move_deadline: wants to push or change a due date. Set itemId (from the list only) and newDeadline as YYYY-MM-DD, resolving words like "Thursday" or "next week" against today.
- mark_done: says something is finished. Set itemId.
- reassign: wants to give an item to someone. Set itemId and newOwner.
- other: anything else. Put a short helpful answer (one or two sentences) in reply.
If you cannot tell which item they mean, still choose the intent and leave itemId null. Never invent ids.`;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const j = await res.json();
  const p = JSON.parse(j?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text || '').join('') || '{}');
  return { intent: p.intent || 'other', itemId: p.itemId || null, newDeadline: p.newDeadline || null, newOwner: p.newOwner || null, reply: p.reply || null };
}

const short = (t: string) => t.replace(/[.!?]+$/, '');

function listOwed(me: Person, s: AppState, asof: string): string {
  const mine = s.items.filter((i) => i.owner_id === me.id && i.type === 'action' && i.status === 'open' && i.deadline && diffDays(asof, i.deadline) <= 7).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  if (!mine.length) return 'Nothing is due this week. You are clear.';
  const bits = mine.slice(0, 4).map((i) => {
    const d = diffDays(asof, i.deadline!);
    return `${short(i.text)}, ${d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'due today' : `due ${fmt(i.deadline!)}`}`;
  });
  return `You owe ${mine.length === 1 ? 'one thing' : `${mine.length} things`}. ${bits.join('. ')}.${mine.length > 4 ? ` Plus ${mine.length - 4} more.` : ''}`;
}

export async function handleVoice(said: string, personId: string, asof: string): Promise<VoiceResult> {
  const s = await getState();
  const me = s.people.find((p) => p.id === personId);
  if (!me) throw new Error('Unknown person');
  const open = s.items.filter((i) => i.status === 'open' && i.type === 'action' && i.owner_id);
  const mine = open.filter((i) => i.owner_id === me.id);
  let engine: VoiceResult['engine'] = 'rules';
  let p: Parsed;
  if (process.env.GEMINI_API_KEY) {
    try { p = await viaGemini(said, asof, me, open, s); engine = 'gemini'; } catch { p = rules(said, asof, mine, open); }
  } else p = rules(said, asof, mine, open);

  const item = p.itemId ? open.find((i) => i.id === p.itemId) ?? null : null;
  const ask = (verb: string) => mine.length ? `Which one should I ${verb}? You have ${mine.slice(0, 3).map((i) => short(i.text)).join(', ')}.` : `I could not find which commitment you mean.`;

  switch (p.intent) {
    case 'list_owed': return { reply: listOwed(me, s, asof), changes: [], engine };
    case 'briefing': return { reply: buildScript(me, s, asof), changes: [], engine };
    case 'move_deadline': {
      if (!item) return { reply: ask('move'), changes: [], engine };
      if (!isDate(p.newDeadline)) return { reply: `What date should I move "${short(item.text)}" to?`, changes: [], engine };
      const was = item.deadline;
      await patchItem(item.id, { deadline: p.newDeadline });
      const late = was && diffDays(was, p.newDeadline) > 0;
      return { reply: `Done. I moved ${short(item.text)} to ${fmt(p.newDeadline)}${late ? ' and noted the slip' : ''}.`, changes: [`${short(item.text)} · ${was ? fmt(was) : 'no date'} → ${fmt(p.newDeadline)}`], engine };
    }
    case 'mark_done': {
      if (!item) return { reply: ask('mark done'), changes: [], engine };
      await patchItem(item.id, { done: true });
      return { reply: `Marked done: ${short(item.text)}. Nice work.`, changes: [`${short(item.text)} · done`], engine };
    }
    case 'reassign': {
      if (!item) return { reply: ask('reassign'), changes: [], engine };
      if (!p.newOwner) return { reply: `Who should take ${short(item.text)}?`, changes: [], engine };
      await patchItem(item.id, { owner: p.newOwner });
      return { reply: `Done. ${short(item.text)} now belongs to ${p.newOwner}.`, changes: [`${short(item.text)} → ${p.newOwner}`], engine };
    }
    default:
      return { reply: p.reply || 'I can tell you what you owe, push a date, mark something done, or hand it to someone. Try "push the pricing to Thursday".', changes: [], engine };
  }
}

