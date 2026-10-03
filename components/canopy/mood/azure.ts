// Tone labels and personal suggestions from Azure OpenAI (or plain OpenAI), server-side only.
// Same prompts as mood-mirror/emotions.py and mood-mirror/insights.py, so both engines agree.
// With no keys set, every function here reports "offline" and engine.ts does the work.

import { labelOneOffline, suggestOffline } from './engine';
import {
  EMOTIONS,
  type Emotion, type EngineName, type MoodReport, type PersonReport, type RawTurn, type Suggestion, type Turn,
} from './types';

type Flagged = RawTurn & { id: number } & Pick<Turn, 'cut_off' | 'deflected_question'>;

interface Cfg { url: string; headers: Record<string, string>; model: string; engine: EngineName }

export function llmConfig(): Cfg | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (endpoint && azureKey && deployment) {
    const version = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
    return {
      url: `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${version}`,
      headers: { 'api-key': azureKey },
      model: deployment,
      engine: 'azure-openai',
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${openaiKey}` },
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      engine: 'openai',
    };
  }
  return null;
}

export const llmEngine = (): EngineName => llmConfig()?.engine ?? 'offline';

// Some reasoning models reject an explicit temperature; remember which ones and stop sending it.
const noTemperature = new Set<string>();

async function chatJson(cfg: Cfg, system: string, user: string): Promise<Record<string, unknown>> {
  const send = async (withTemp: boolean) => {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { ...cfg.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        response_format: { type: 'json_object' },
        ...(withTemp ? { temperature: 0.2 } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`${cfg.engine} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<{ choices?: { message?: { content?: string } }[] }>;
  };

  let body: Awaited<ReturnType<typeof send>>;
  if (noTemperature.has(cfg.model)) body = await send(false);
  else {
    try {
      body = await send(true);
    } catch (e) {
      if (!/temperature/i.test(String(e))) throw e;
      noTemperature.add(cfg.model);
      body = await send(false);
    }
  }
  return JSON.parse(body.choices?.[0]?.message?.content ?? '{}');
}

// --------------------------------------------------------------- tone labels

const LABEL_SYSTEM = `You label the emotional tone of turns in a work meeting transcript.
Judge only from the words each person says (no guessing from names, roles or gender).
Use the surrounding turns as context: "Fair." after being challenged reads differently than after praise.
Allowed labels: ${EMOTIONS.join(', ')}. Use "neutral" when nothing stands out; do not over-label.
"confident" = assured, taking ownership. "frustrated" = blocked or repeating themselves.
Return JSON: {"labels": [{"id": <turn id>, "emotion": <label>, "intensity": <0.0-1.0>,
"evidence": <the 1-8 words copied exactly from that turn that show the tone, or "">}]}
Return one entry for every turn id you are given.`;

const CHUNK = 30;

/** Labels every turn with the LLM, filling any gaps with the offline lexicon. */
export async function labelTurns(flagged: Flagged[]): Promise<{ turns: Turn[]; engine: EngineName }> {
  const cfg = llmConfig();
  if (!cfg) return { turns: flagged.map((t) => labelOneOffline(t) as Turn), engine: 'offline' };

  try {
    const got = new Map<number, { emotion?: string; intensity?: unknown; evidence?: unknown }>();
    for (let i = 0; i < flagged.length; i += CHUNK) {
      const ctx = flagged.slice(Math.max(0, i - 3), i); // a little context from the previous chunk
      const part = flagged.slice(i, i + CHUNK);
      const lines = [
        ...ctx.map((t) => `(context) ${t.speaker}: ${t.text}`),
        ...part.map((t) => `[${t.id}] ${t.speaker} @${Math.round(t.start)}s: ${t.text}`),
      ];
      const data = await chatJson(cfg, LABEL_SYSTEM, lines.join('\n'));
      for (const item of (data.labels as { id?: unknown }[] | undefined) ?? []) {
        const id = Number(item?.id);
        if (Number.isInteger(id)) got.set(id, item as { emotion?: string });
      }
    }

    const turns = flagged.map((t) => {
      const item = got.get(t.id);
      if (!item || !EMOTIONS.includes(item.emotion as Emotion)) return labelOneOffline(t) as Turn;
      let evidence = String(item.evidence ?? '');
      // Never show evidence that isn't actually in the turn.
      if (evidence && !t.text.toLowerCase().includes(evidence.toLowerCase())) evidence = '';
      const intensity = Math.min(1, Math.max(0, Number(item.intensity ?? 0.5) || 0));
      return { ...t, emotion: item.emotion as Emotion, intensity: Math.round(intensity * 100) / 100, evidence } as Turn;
    });
    return { turns, engine: cfg.engine };
  } catch (e) {
    console.error('[mood] LLM labeling failed, using offline engine:', e);
    return { turns: flagged.map((t) => labelOneOffline(t) as Turn), engine: 'offline' };
  }
}

// --------------------------------------------------------------- suggestions

const SUGGEST_SYSTEM = `You coach one person privately after a work meeting.
You get their own stats and moments (feeling + exact quote + what happened right before).
Write 2-3 suggestions. Each must be a concrete action they can take, tied to a moment and its timestamp.
Never tell them to "be happier", never diagnose, never comment on personality or other people's character.
Plain, warm, short (max 35 words each).
Return JSON: {"suggestions": [{"title": <max 6 words>, "detail": <text>, "at": <seconds or null>}]}`;

/** Fills in `suggestions` on every person. Falls back to the rule-based tips per person. */
export async function addSuggestions(
  people: Record<string, PersonReport>,
  team: MoodReport['team'],
): Promise<EngineName> {
  const cfg = llmConfig();
  if (!cfg) {
    for (const p of Object.values(people)) p.suggestions = suggestOffline(p);
    return 'offline';
  }

  let used: EngineName = 'offline';
  for (const [name, p] of Object.entries(people)) {
    try {
      const payload = {
        mood_score: p.mood_score, dominant: p.dominant, airtime_share: p.airtime_share,
        questions: p.questions, cut_offs: p.cut_offs, deflected_questions: p.deflected_questions,
        interrupted_others: p.interrupted_others, parked_questions: p.parked_questions, mix: p.mix,
        team_mood_score: team.mood_score, equal_airtime_share: team.equal_airtime_share,
        moments: p.moments.map((m) => ({
          time: m.time, t: m.t, emotion: m.emotion, evidence: m.evidence,
          text: m.text, context: m.context, cut_off: m.cut_off, deflected_question: m.deflected_question,
        })),
      };
      const data = await chatJson(cfg, SUGGEST_SYSTEM, `Person: ${name}\n${JSON.stringify(payload)}`);
      const tips = (((data.suggestions as Suggestion[] | undefined) ?? [])
        .filter((s) => s?.title && s?.detail)
        .map((s) => ({ title: String(s.title), detail: String(s.detail), at: s.at == null ? null : Number(s.at) })))
        .slice(0, 3);
      if (!tips.length) throw new Error('empty suggestions');
      p.suggestions = tips;
      used = cfg.engine;
    } catch (e) {
      console.error(`[mood] LLM suggestions failed for ${name}, using rules:`, e);
      p.suggestions = suggestOffline(p);
    }
  }
  return used;
}
