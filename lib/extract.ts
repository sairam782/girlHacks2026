// Turns raw meeting text into decisions and action items. Gemini does the work; a regex fallback keeps the app usable without a key.
import { isDate, resolveRelative } from './dates';
import type { Extracted } from './types';

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      type: { type: 'STRING', enum: ['action', 'decision'] },
      text: { type: 'STRING' },
      owner: { type: 'STRING', nullable: true },
      deadline: { type: 'STRING', nullable: true },
      source_excerpt: { type: 'STRING' },
      workstream: { type: 'STRING', nullable: true },
    },
    required: ['type', 'text', 'source_excerpt'],
  },
};

const PROMPT = (text: string, meeting: string, weekday: string, people: string[]) => `You extract commitments from meeting notes, chat threads, and docs.

Meeting date: ${meeting} (${weekday}). Known people: ${people.length ? people.join(', ') : 'none yet'}.

Return a JSON array. One object per item:
- type: "action" (someone must do something) or "decision" (the group settled on something).
- text: short imperative summary, e.g. "Send revised pricing to the client".
- owner: the person's name only if named or clearly implied ("I'll..." means the speaker). Use the exact spelling of a known person when it matches. Otherwise null.
- deadline: YYYY-MM-DD. Resolve relative dates ("by Friday", "tomorrow", "end of week") against the meeting date. Null if no date is given. Never guess.
- source_excerpt: the exact line from the text it came from, verbatim.
- workstream: a 1-2 word topic grouping (e.g. "Legal", "Engineering", "Finance"). Reuse the same label for related items.

Do not invent items. Skip small talk.

TEXT:
"""
${text}
"""`;

async function viaGemini(text: string, meeting: string, weekday: string, people: string[]): Promise<Extracted[]> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT(text, meeting, weekday, people) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '[]';
  return JSON.parse(raw);
}

// Sentence-level heuristics: "Name, can you ... by Friday", "I'll ...", "Name will ...", "we decided ...".
function viaRules(text: string, meeting: string, people: string[]): Extracted[] {
  const out: Extracted[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^\[?([A-Z][\w.' -]{0,24}?)\]?\s*[:\-–]\s+(.*)$/);
    const speaker = m ? m[1].trim() : null;
    const body = (m ? m[2] : line).replace(/^(?:yes|yeah|sure|okay|ok|right|will do)[,.!]?\s+/i, '');
    for (const s of body.split(/(?<=[.!?])\s+/)) {
      const sentence = s.trim();
      if (sentence.length < 12) continue;
      const deadline = resolveRelative(sentence, meeting);
      const addr = sentence.match(/^([A-Z][a-z]+)[, ]+(?:can|could|will|would|please)\b/);
      const will = sentence.match(/\b([A-Z][a-z]+) (?:will|is going to|to take|has to|needs to|should)\b/);
      const first = /\b(I'll|I will|I can take|I'm going to|let me)\b/i.test(sentence);
      const decision = /\b(we (?:decided|agreed|are going with|will go with|chose)|decision:|let's go with|we're going with)\b/i.test(sentence);
      const action = addr || will || first || /\b(action item|todo|to-do|need to|needs to|by (?:eod|monday|tuesday|wednesday|thursday|friday|tomorrow))\b/i.test(sentence);
      if (!action && !decision) continue;
      let owner: string | null = null;
      if (first && speaker) owner = speaker;
      else if (addr) owner = addr[1];
      else if (will && !/^(We|They|It|This|That|Someone)$/.test(will[1])) owner = will[1];
      if (owner) owner = people.find((p) => p.toLowerCase().split(' ')[0] === owner!.toLowerCase().split(' ')[0]) || owner;
      const clean = sentence.replace(/^(\w+)[, ]+(can|could|will|would|please)( you)?\s+/i, '').replace(/^(I'll|I will|let me)\s+/i, '').replace(/\s+(?:by|on|before|until)\s+(?:next |this )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|eod|end of (?:the )?(?:day|week|month)|next week)\b.*$/i, '').replace(/\s+(?:today|tomorrow)$/i, '').replace(/[.!?]+$/, '');
      out.push({
        type: decision && !action ? 'decision' : 'action',
        text: clean.charAt(0).toUpperCase() + clean.slice(1),
        owner: decision && !action ? null : owner,
        deadline,
        source_excerpt: sentence,
        workstream: null,
      });
    }
  }
  // A reply that restates an item (same owner and date) is the same commitment.
  return out.filter((x, i) => !x.owner || !x.deadline || out.findIndex((y) => y.owner === x.owner && y.deadline === x.deadline && y.type === x.type) === i);
}

export async function extract(text: string, meeting: string, weekday: string, people: string[]): Promise<{ items: Extracted[]; engine: 'gemini' | 'rules'; note?: string }> {
  let items: Extracted[] = [];
  let engine: 'gemini' | 'rules' = 'rules';
  let note: string | undefined;
  if (process.env.GEMINI_API_KEY) {
    try { items = await viaGemini(text, meeting, weekday, people); engine = 'gemini'; }
    catch (e) { note = `Gemini failed (${(e as Error).message}); used built-in rules instead.`; items = viaRules(text, meeting, people); }
  } else {
    note = 'No GEMINI_API_KEY set; used built-in rules instead.';
    items = viaRules(text, meeting, people);
  }
  // Enforce the contract: never trust model dates or owners blindly.
  const clean = items
    .filter((x) => x && typeof x.text === 'string' && x.text.trim())
    .map((x) => ({
      type: x.type === 'decision' ? 'decision' as const : 'action' as const,
      text: x.text.trim(),
      owner: x.owner && String(x.owner).trim() && !/^(null|none|unknown|unassigned)$/i.test(String(x.owner).trim()) ? String(x.owner).trim() : null,
      deadline: isDate(x.deadline) ? x.deadline : null,
      source_excerpt: (x.source_excerpt || x.text).trim(),
      workstream: x.workstream ? String(x.workstream).trim().slice(0, 28) : null,
    }));
  return { items: clean, engine, note };
}
