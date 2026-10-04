// Voice agent: turns what someone said into an action on their commitments, then a spoken reply.
//
// Gemini reads a snapshot of the real grove and picks an intent plus the items it applies to. The
// app runs the action and writes the confirmation itself, so a reply can never claim something that
// did not happen. Only the `answer` intent lets the model write prose, and it is told to use nothing
// but the numbers in the snapshot.
import { buildScript } from './briefing';
import { addDays, diffDays, fmt, fmtShort, isDate, resolveRelative, weekday, WEEKDAYS } from './dates';
import { leafState, slipCount, slipRisk } from './leaf';
import { getState, ingestItems, patchItem } from './store';
import type { ActionItem, AppState, CommitmentEvent, Person } from './types';

export type Intent =
  | 'list_owed' | 'briefing' | 'move_deadline' | 'mark_done' | 'reassign'
  | 'nudge' | 'add_commitment' | 'answer';

export interface Turn { who: 'you' | 'canopy'; text: string }

interface Parsed {
  intent: Intent;
  itemIds: string[];
  newDeadline: string | null;
  newOwner: string | null;
  newText: string | null;
  projectId: string | null;
  reply: string | null;
}

export interface VoiceResult { reply: string; changes: string[]; engine: 'gemini' | 'rules' }

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['list_owed', 'briefing', 'move_deadline', 'mark_done', 'reassign', 'nudge', 'add_commitment', 'answer'] },
    itemIds: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
    newDeadline: { type: 'STRING', nullable: true },
    newOwner: { type: 'STRING', nullable: true },
    newText: { type: 'STRING', nullable: true },
    projectId: { type: 'STRING', nullable: true },
    reply: { type: 'STRING', nullable: true },
  },
  required: ['intent'],
};

const short = (t: string) => t.replace(/[.!?]+$/, '');
const firstName = (n: string) => n.split(' ')[0];
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "Fallen · overdue 3 days" is for the panel; out loud it should just be "3 days overdue". */
const spoken = (label: string, daysLeft: number | null) =>
  (daysLeft !== null && daysLeft < 0 ? `${-daysLeft} day${daysLeft === -1 ? '' : 's'} overdue` : label.toLowerCase());

// --------------------------------------------------------------- the snapshot

/** Everything the model is allowed to reason from: the real grove, in about 6 KB. */
function snapshot(s: AppState, me: Person, asof: string, open: ActionItem[]): string {
  const name = (id: string | null) => s.people.find((p) => p.id === id)?.name ?? 'nobody';
  const proj = (id: string) => s.projects.find((p) => p.id === id)?.name ?? '?';
  const byItem = new Map<string, CommitmentEvent[]>();
  for (const e of s.events) {
    const list = byItem.get(e.action_item_id);
    if (list) list.push(e); else byItem.set(e.action_item_id, [e]);
  }

  const lines = open.slice(0, 80).map((i) => {
    const d = leafState(i, asof);
    const slips = slipCount(i.id, byItem.get(i.id) ?? []);
    const due = i.deadline ? `${fmtShort(i.deadline)} (${diffDays(asof, i.deadline)}d)` : 'no date';
    return `${i.id} | ${short(i.text)} | ${name(i.owner_id)} | ${due} | ${d.label} | ${slips} slips | risk ${slipRisk(d, slips)}% | ${proj(i.project_id)}`;
  });

  // Who keeps their word, over everything they have ever owned here.
  const follow = s.people.map((p) => {
    const mine = s.items.filter((i) => i.owner_id === p.id && i.type === 'action');
    const done = mine.filter((i) => i.status === 'done');
    const kept = done.filter((i) => !i.deadline || !i.done_at || i.done_at.slice(0, 10) <= i.deadline).length;
    const late = mine.filter((i) => i.status === 'open' && i.deadline && diffDays(i.deadline, asof) > 0).length;
    return { name: p.name, kept, total: done.length + late, late };
  }).filter((x) => x.total > 0).sort((a, b) => a.kept / a.total - b.kept / b.total);

  const projects = s.projects.map((p) => {
    const items = s.items.filter((i) => i.project_id === p.id && i.type === 'action' && i.owner_id);
    const live = items.filter((i) => i.status === 'open');
    const risk = live.filter((i) => leafState(i, asof).state !== 'g').length;
    return `- ${p.name} — ${live.length} open, ${risk} at risk, ${items.length - live.length} done`;
  });

  const slipped = open
    .map((i) => ({ i, moves: (byItem.get(i.id) ?? []).filter((e) => e.event_type === 'deadline_moved') }))
    .filter((x) => x.moves.length)
    .sort((a, b) => b.moves.length - a.moves.length)
    .slice(0, 6)
    .map((x) => `- ${short(x.i.text)}: ${x.moves.map((m) => (m.new_value ? fmtShort(m.new_value) : 'no date')).join(' → ')} (${x.moves.length})`);

  const unowned = s.items.filter((i) => i.status === 'open' && !i.owner_id && i.type === 'action').slice(0, 8);

  return [
    `TODAY: ${asof} (${WEEKDAYS[weekday(asof)]}). SPEAKER: ${me.name}.`,
    '',
    'PROJECTS:', ...projects,
    '',
    'OPEN COMMITMENTS (id | text | owner | due | state | slips | risk | project):',
    lines.join('\n') || '(none)',
    '',
    'UNOWNED DECISIONS waiting for an owner:',
    unowned.map((i) => `${i.id} | ${short(i.text)}`).join('\n') || '(none)',
    '',
    'FOLLOW-THROUGH (kept on time / total):',
    follow.map((f) => `- ${f.name}: ${f.kept}/${f.total}${f.late ? `, ${f.late} late right now` : ''}`).join('\n') || '(nothing finished yet)',
    '',
    'DEADLINES THAT MOVED:',
    slipped.join('\n') || '(none)',
  ].join('\n');
}

// ---------------------------------------------------------------- the parsers

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
const STOP = new Set(['the', 'and', 'for', 'push', 'move', 'mark', 'done', 'finished', 'complete', 'completed', 'set', 'that', 'this', 'with', 'out', 'can', 'you', 'please', 'until', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'tomorrow', 'next', 'week', 'nudge', 'remind', 'chase']);

function matchItem(said: string, mine: ActionItem[], all: ActionItem[]): ActionItem | null {
  const sw = new Set(words(said).filter((w) => !STOP.has(w)));
  const score = (it: ActionItem) => words(it.text).filter((w) => sw.has(w)).length;
  for (const pool of [mine, all]) {
    const ranked = pool.map((it) => ({ it, s: score(it) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (ranked.length && (ranked.length === 1 || ranked[0].s > ranked[1].s)) return ranked[0].it;
  }
  return null;
}

/** No Gemini key: still handle the common asks, including the analytical ones, from real numbers. */
function rules(said: string, asof: string, me: Person, s: AppState, mine: ActionItem[], all: ActionItem[]): Parsed {
  const t = said.toLowerCase();
  const none = { itemIds: [], newDeadline: null, newOwner: null, newText: null, projectId: null, reply: null };
  const one = (it: ActionItem | null) => (it ? [it.id] : []);

  if (/\b(brief|briefing|summary|catch me up)\b/.test(t)) return { intent: 'briefing', ...none };

  // Checked first: "who is slipping" is about people, not about which leaves are late.
  if (/\bwho\b.*\b(slipping|behind|late|reliable|keeps|kept|follow[- ]?through|best|worst|trust)\b/.test(t)) {
    return { intent: 'answer', ...none, reply: whoIsSlipping(s, asof) };
  }
  if (/\b(at risk|in trouble|slipping|behind|overdue|worried about|going wrong|needs attention|falling)\b/.test(t)) {
    return { intent: 'answer', ...none, reply: atRisk(s, asof) };
  }
  if (/\b(nudge|remind|chase|ping|follow up with)\b/.test(t)) {
    return { intent: 'nudge', ...none, itemIds: one(matchItem(said, all, all)) };
  }
  if (/\b(push|move|delay|postpone|reschedule|extend)\b/.test(t)) {
    const date = resolveRelative(t.replace(/^.*?\b(to|until|by|till)\b/, ''), asof) ?? resolveRelative(t, asof);
    return { intent: 'move_deadline', ...none, itemIds: one(matchItem(said, mine, all)), newDeadline: date };
  }
  if (/\b(what do i owe|what('s| is) due|what am i (supposed|due)|my (tasks|commitments|items|list)|due (today|this week))\b/.test(t)) {
    return { intent: 'list_owed', ...none };
  }
  if (/\b(done|finished|complete|completed|wrapped up|sent|shipped)\b/.test(t)) {
    return { intent: 'mark_done', ...none, itemIds: one(matchItem(said, mine, all)) };
  }
  const re = t.match(/\b(?:reassign|give|hand|pass)\b.*?\bto\s+([a-z]+)/);
  if (re) {
    return { intent: 'reassign', ...none, itemIds: one(matchItem(said, mine, all)), newOwner: re[1].replace(/^./, (c) => c.toUpperCase()) };
  }
  return { intent: 'answer', ...none };
}

async function viaGemini(said: string, asof: string, me: Person, open: ActionItem[], s: AppState, history: Turn[]): Promise<Parsed> {
  const recent = history.slice(-6).map((h) => `${h.who === 'you' ? me.name : 'Canopy'}: ${h.text}`).join('\n');
  const prompt = `You are Canopy's voice assistant. Canopy tracks the promises people make in meetings and shows them as leaves on a tree: green on track, yellow due soon, wilting overdue, fallen dropped.

${snapshot(s, me, asof, open)}
${recent ? `\nEARLIER IN THIS CONVERSATION:\n${recent}\n` : ''}
${me.name} just said: "${said}"

Choose exactly one intent:
- list_owed — they ask what they owe or what is due.
- briefing — they ask for their briefing or a catch-up.
- move_deadline — change a due date. Put every affected id in itemIds and set newDeadline (YYYY-MM-DD), resolving words like "Thursday" or "next week" against today. "Push everything due this week to Friday" means several ids.
- mark_done — something is finished. Put the ids in itemIds.
- reassign — hand items to someone. Set itemIds and newOwner.
- nudge — remind or chase the owner of something. Set itemIds.
- add_commitment — they are making a new promise ("add a commitment to send the deck by Friday"). Set newText (short imperative), newDeadline if given, newOwner if someone else owns it, and projectId.
- answer — any question about the state of the work: what is at risk, who is slipping, how a project is doing, what slipped the most, what to do first. Write a spoken answer of one to three sentences in reply.

Rules:
- Use ONLY ids that appear above. Never invent one. If you cannot tell which item they mean, pick the intent and leave itemIds empty.
- For answer, use only the numbers above. Never guess a figure. Say plainly if the data does not show it.
- Keep reply natural and spoken, no lists or markdown.
- Resolve pronouns from the conversation above: "push it to Friday" refers to whatever was just discussed.`;

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const j = await res.json();
  const p = JSON.parse(j?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text || '').join('') || '{}');
  return {
    intent: (p.intent as Intent) || 'answer',
    itemIds: Array.isArray(p.itemIds) ? p.itemIds.filter((x: unknown) => typeof x === 'string') : [],
    newDeadline: p.newDeadline || null,
    newOwner: p.newOwner || null,
    newText: p.newText || null,
    projectId: p.projectId || null,
    reply: p.reply || null,
  };
}

// ------------------------------------------------------- answers from the data

function listOwed(me: Person, s: AppState, asof: string): string {
  const mine = s.items
    .filter((i) => i.owner_id === me.id && i.type === 'action' && i.status === 'open' && i.deadline && diffDays(asof, i.deadline) <= 7)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  if (!mine.length) return 'Nothing is due this week. You are clear.';
  const bits = mine.slice(0, 4).map((i) => {
    const d = diffDays(asof, i.deadline!);
    return `${short(i.text)}, ${d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'due today' : `due ${fmt(i.deadline!)}`}`;
  });
  return `You owe ${mine.length === 1 ? 'one thing' : `${mine.length} things`}. ${bits.join('. ')}.${mine.length > 4 ? ` Plus ${mine.length - 4} more.` : ''}`;
}

function atRisk(s: AppState, asof: string): string {
  const name = (id: string | null) => s.people.find((p) => p.id === id)?.name ?? 'nobody';
  const live = s.items.filter((i) => i.type === 'action' && i.status === 'open' && i.owner_id);
  const bad = live
    .map((i) => ({ i, d: leafState(i, asof) }))
    .filter((x) => x.d.state === 'r' || x.d.state === 'd')
    .sort((a, b) => (a.i.deadline ?? '').localeCompare(b.i.deadline ?? ''));
  if (!bad.length) {
    const soon = live.filter((i) => leafState(i, asof).state === 'a').length;
    return soon ? `Nothing is overdue. ${soon} item${soon === 1 ? ' is' : 's are'} due within three days.` : 'Nothing is overdue and nothing is due in the next three days.';
  }
  const top = bad.slice(0, 3).map((x) => `${short(x.i.text)}, ${firstName(name(x.i.owner_id))}, ${spoken(x.d.label, x.d.daysLeft)}`);
  return `${bad.length} item${bad.length === 1 ? ' is' : 's are'} past due. ${listOf(top)}.${bad.length > 3 ? ` And ${bad.length - 3} more.` : ''}`;
}

function whoIsSlipping(s: AppState, asof: string): string {
  const stats = s.people.map((p) => {
    const mine = s.items.filter((i) => i.owner_id === p.id && i.type === 'action');
    const done = mine.filter((i) => i.status === 'done');
    const kept = done.filter((i) => !i.deadline || !i.done_at || i.done_at.slice(0, 10) <= i.deadline).length;
    const late = mine.filter((i) => i.status === 'open' && i.deadline && diffDays(i.deadline, asof) > 0).length;
    return { name: p.name, kept, total: done.length + late, late };
  }).filter((x) => x.total > 0);
  if (!stats.length) return 'Nobody has finished anything yet, so there is no follow-through to compare.';
  const worst = [...stats].sort((a, b) => a.kept / a.total - b.kept / b.total)[0];
  const best = [...stats].sort((a, b) => b.kept / b.total - a.kept / a.total)[0];
  const lateNow = stats.filter((x) => x.late).sort((a, b) => b.late - a.late);
  const head = lateNow.length
    ? `${listOf(lateNow.slice(0, 3).map((x) => `${firstName(x.name)} has ${x.late} late`))}.`
    : 'Nobody is late right now.';
  return `${head} Over everything, ${firstName(worst.name)} keeps ${worst.kept} of ${worst.total} on time, and ${firstName(best.name)} is the most reliable at ${best.kept} of ${best.total}.`;
}

// ---------------------------------------------------------------- the handler

export async function handleVoice(said: string, personId: string, asof: string, history: Turn[] = []): Promise<VoiceResult> {
  const s = await getState();
  const me = s.people.find((p) => p.id === personId);
  if (!me) throw new Error('Unknown person');
  const open = s.items.filter((i) => i.status === 'open' && i.type === 'action' && i.owner_id);
  const mine = open.filter((i) => i.owner_id === me.id);

  let engine: VoiceResult['engine'] = 'rules';
  let p: Parsed;
  if (process.env.GEMINI_API_KEY) {
    try { p = await viaGemini(said, asof, me, open, s, history); engine = 'gemini'; }
    catch { p = rules(said, asof, me, s, mine, open); }
  } else p = rules(said, asof, me, s, mine, open);

  // Only ever act on ids that really exist.
  const items = p.itemIds.map((id) => open.find((i) => i.id === id)).filter((x): x is ActionItem => !!x);
  const ask = (verb: string) => (mine.length
    ? `Which one should I ${verb}? You have ${mine.slice(0, 3).map((i) => short(i.text)).join(', ')}.`
    : 'I could not tell which commitment you mean.');

  switch (p.intent) {
    case 'list_owed':
      return { reply: listOwed(me, s, asof), changes: [], engine };

    case 'briefing':
      return { reply: buildScript(me, s, asof), changes: [], engine };

    case 'move_deadline': {
      if (!items.length) return { reply: ask('move'), changes: [], engine };
      if (!isDate(p.newDeadline)) return { reply: `What date should I move ${items.length > 1 ? 'those' : `"${short(items[0].text)}"`} to?`, changes: [], engine };
      const changes: string[] = [];
      let slipped = 0;
      for (const it of items) {
        const was = it.deadline;
        await patchItem(it.id, { deadline: p.newDeadline });
        if (was && diffDays(was, p.newDeadline) > 0) slipped++;
        changes.push(`${short(it.text)} · ${was ? fmt(was) : 'no date'} → ${fmt(p.newDeadline)}`);
      }
      const what = items.length === 1 ? short(items[0].text) : `${items.length} commitments`;
      return { reply: `Done. I moved ${what} to ${fmt(p.newDeadline)}${slipped ? ` and noted the slip${slipped > 1 ? 's' : ''}` : ''}.`, changes, engine };
    }

    case 'mark_done': {
      if (!items.length) return { reply: ask('mark done'), changes: [], engine };
      for (const it of items) await patchItem(it.id, { done: true });
      const what = items.length === 1 ? short(items[0].text) : listOf(items.map((i) => short(i.text)));
      return { reply: `Marked done: ${what}. Nice work.`, changes: items.map((i) => `${short(i.text)} · done`), engine };
    }

    case 'reassign': {
      if (!items.length) return { reply: ask('reassign'), changes: [], engine };
      if (!p.newOwner) return { reply: `Who should take ${short(items[0].text)}?`, changes: [], engine };
      for (const it of items) await patchItem(it.id, { owner: p.newOwner });
      const what = items.length === 1 ? short(items[0].text) : `${items.length} commitments`;
      return { reply: `Done. ${what} now belong${items.length === 1 ? 's' : ''} to ${p.newOwner}.`, changes: items.map((i) => `${short(i.text)} → ${p.newOwner}`), engine };
    }

    case 'nudge': {
      if (!items.length) return { reply: ask('nudge the owner of'), changes: [], engine };
      const changes: string[] = [];
      for (const it of items) {
        await patchItem(it.id, { nudge: true });
        changes.push(`${short(it.text)} · owner nudged`);
      }
      const who = [...new Set(items.map((i) => firstName(s.people.find((p2) => p2.id === i.owner_id)?.name ?? 'the owner')))];
      return { reply: `I nudged ${listOf(who)} about ${items.length === 1 ? short(items[0].text) : `${items.length} commitments`}, with the evidence attached.`, changes, engine };
    }

    case 'add_commitment': {
      const text = p.newText?.trim();
      if (!text) return { reply: 'What should the commitment say?', changes: [], engine };
      const project = s.projects.find((x) => x.id === p.projectId) ?? s.projects[0];
      if (!project) return { reply: 'There is no project to add it to yet.', changes: [], engine };
      const deadline = isDate(p.newDeadline) ? p.newDeadline : resolveRelative(said, asof);
      await ingestItems(
        { projectId: project.id, title: 'Added by voice', kind: 'chat', meetingDate: asof, text: said },
        [{ type: 'action', text, owner: p.newOwner || me.name, deadline, source_excerpt: said, workstream: 'Added by voice' }],
      );
      return {
        reply: `Added: ${text}${deadline ? `, due ${fmt(deadline)}` : ', with no date yet'}. It is on the ${project.name} tree.`,
        changes: [`New leaf · ${text}${deadline ? ` · ${fmt(deadline)}` : ''}`],
        engine,
      };
    }

    default:
      return {
        reply: p.reply
          || 'I can tell you what you owe, what is at risk, who is slipping, move a date, mark something done, nudge an owner, or add a commitment.',
        changes: [],
        engine,
      };
  }
}

// Kept so a caller can offer the next thing to try.
export const VOICE_HINTS = [
  'What do I owe?',
  "What's at risk?",
  'Who is slipping?',
  'Push the security review to Thursday',
  'Nudge Marcus about the addendum',
];

export const _internal = { atRisk, whoIsSlipping, snapshot, addDays };
