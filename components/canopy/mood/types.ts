// Mood Mirror: shapes and palette. Mirrors the report that mood-mirror/insights.py returns,
// so the same UI renders a report from either engine (the TypeScript one in engine.ts, or the
// Python service when audio needs Azure Speech diarization).

// Order matches EMOTIONS in mood-mirror/emotions.py. Stacked bars and legends follow it.
export const EMOTIONS = ['neutral', 'frustrated', 'happy', 'confused', 'anxious', 'confident', 'sad', 'angry'] as const;
export type Emotion = (typeof EMOTIONS)[number];

// How each label pulls the mood score (-1 .. +1).
export const VALENCE: Record<Emotion, number> = {
  happy: 0.8, confident: 0.6, neutral: 0.0, confused: -0.3,
  anxious: -0.5, frustrated: -0.6, sad: -0.7, angry: -0.9,
};

export const LABEL: Record<Emotion, string> = {
  neutral: 'Neutral', frustrated: 'Frustrated', happy: 'Happy', confused: 'Confused',
  anxious: 'Anxious', confident: 'Confident', sad: 'Sad', angry: 'Angry',
};

// Canopy's palette, extended to eight tones: greens read positive, the warm ramp
// (gold → amber → terracotta → red) reads as rising tension, slate blue is sad.
export const TONE: Record<Emotion, { fill: string; text: string; bg: string; line: string }> = {
  neutral:    { fill: '#9aa29c', text: '#5f6a63', bg: '#eef0ed', line: '#dfe2dd' },
  frustrated: { fill: '#c05f3c', text: '#8f3f22', bg: '#fbeae2', line: '#f0d5c8' },
  happy:      { fill: '#4f9d69', text: '#2f7a4a', bg: '#e9f2ea', line: '#d2e4d6' },
  confused:   { fill: '#c9a54b', text: '#866717', bg: '#f8f1dc', line: '#ecdcb4' },
  anxious:    { fill: '#d9873f', text: '#96531a', bg: '#fcf0e0', line: '#f1dcbd' },
  confident:  { fill: '#2f8a77', text: '#1d6354', bg: '#e5f1ee', line: '#cce3dd' },
  sad:        { fill: '#6f7196', text: '#4b4d72', bg: '#eeeef5', line: '#dcdce8' },
  angry:      { fill: '#9c3d28', text: '#7a2a18', bg: '#f8e6e1', line: '#eccdc4' },
};

export type EngineName = 'offline' | 'azure-openai' | 'openai';

export const ENGINE_LABEL: Record<EngineName, string> = {
  offline: 'offline lexicon',
  'azure-openai': 'Azure OpenAI',
  openai: 'OpenAI',
};

export interface RawTurn { speaker: string; start: number; end: number; text: string }

export interface Turn extends RawTurn {
  id: number;
  /** Extra markers the Python service may attach (e.g. from a .vtt). */
  events?: string[];
  emotion: Emotion;
  intensity: number;
  evidence: string;
  cut_off: boolean;
  cut_off_by?: string;
  deflected_question: boolean;
}

export interface Moment {
  id: number;
  events?: string[];
  t: number;
  time: string;
  text: string;
  emotion: Emotion;
  intensity: number;
  evidence: string;
  cut_off: boolean;
  deflected_question: boolean;
  context: string | null;
}

export interface TimelinePoint { id: number; t: number; emotion: Emotion; valence: number }

export interface Suggestion { title: string; detail: string; at: number | null }

/** The opt-in face layer, added by the Python service from one person's own video. */
export interface FaceBlock {
  source: string;
  face_rate: number;
  mix: Record<Emotion, number>;
  line: { t: number; valence: number }[];
  per_turn: Record<string, { emotion: Emotion; conf: number; valence: number }>;
  /** Said one thing, looked another: the "sure, that works" moments. */
  mismatches: { id: number; t: number; time: string; text: string; said: Emotion; looked: Emotion; conf: number }[];
  /** Strong reactions while someone else held the floor. */
  reactions: { id: number; t: number; time: string; speaker: string; text: string; looked: Emotion; conf: number }[];
  agreement: number | null;
}

export interface PersonReport {
  turns: number;
  words: number;
  airtime_sec: number;
  airtime_share: number;
  mood_score: number;
  dominant: Emotion;
  mix: Record<Emotion, number>;
  questions: number;
  cut_offs: number;
  deflected_questions: number;
  interrupted_others: string[];
  parked_questions: string[];
  equal_share: number;
  timeline: TimelinePoint[];
  moments: Moment[];
  suggestions: Suggestion[];
  face?: FaceBlock;
}

export interface TeamReport {
  people: number;
  duration_sec: number;
  mood_score: number;
  mix: Record<Emotion, number>;
  equal_airtime_share: number;
}

export interface MoodReport {
  /** Set by the Python service; needed to add a face layer or a spoken brief. */
  id?: string;
  /** The service kept the uploaded meeting video, so the face layer can reuse it. */
  has_meeting_video?: boolean;
  title: string;
  source: string;
  engine: { labels: EngineName; suggestions: EngineName };
  emotions: readonly Emotion[];
  turns: Turn[];
  people: Record<string, PersonReport>;
  team: TeamReport;
}

export interface MoodStatus {
  /** Audio uploads work: the Python service is reachable and can transcribe. */
  speech: boolean;
  /** What that service calls its speech engine, e.g. "Azure Speech". */
  speechEngine?: string;
  /** Which engine will label tone. */
  llm: EngineName;
  /** The Python service responded. */
  service: boolean;
}

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** The demo meetings bundled in mood-mirror/sample/. Labels only, so clients stay small. */
export const MEETING_LABELS = {
  vendor: 'Q4 vendor standup',
  sprint: 'Sprint check-in',
} as const;

export type MeetingId = keyof typeof MEETING_LABELS;
