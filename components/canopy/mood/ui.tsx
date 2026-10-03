'use client';

// Shared Canopy-styled pieces for the Mood Mirror screen.

import { LABEL, TONE, type Emotion } from './types';

export const serif = "'Instrument Serif', serif";
export const mono = "'Geist Mono', monospace";

export const card = { background: '#fff', border: '1px solid #e4e2d9', borderRadius: 16 } as const;
export const micro = { fontFamily: mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' } as const;
export const cardTitle = { fontFamily: serif, fontSize: 23, color: '#16211b' } as const;
export const sectionNote = { margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.45, color: '#7a857e' } as const;
export const secondaryBtn = { height: 38, padding: '0 14px', borderRadius: 10, background: '#fff', border: '1px solid #dcdad0', color: '#3a453e', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' } as const;
export const primaryBtn = { height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' } as const;

/** Mood Mirror's own accent: the private, personal half of Canopy. */
export const PRIVATE = { ink: '#4b4d72', fill: '#6f7196', bg: '#f1f0f6', line: '#dedde8' } as const;

/** Leaf silhouette, the same mark the tree and the legend use. */
export function LeafMark({ color, w = 15, h = 8, style }: { color: string; w?: number; h?: number; style?: React.CSSProperties }) {
  return <span style={{ width: w, height: h, flex: 'none', borderRadius: '0 100% 0 100%', background: color, ...style }} />;
}

export function ToneChip({ emotion, time }: { emotion: Emotion; time?: string }) {
  const t = TONE[emotion];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: t.bg, border: `1px solid ${t.line}`, borderRadius: 12, padding: '3px 10px', fontSize: 12.5, fontWeight: 500, color: t.text, whiteSpace: 'nowrap' }}>
      <LeafMark color={t.fill} w={12} h={7} />
      {LABEL[emotion]}
      {time && <span style={{ fontFamily: mono, fontSize: 10, color: t.text, opacity: 0.7 }}>{time}</span>}
    </span>
  );
}

/** The quote with the model's evidence words marked, so no label is a black box. */
export function Quoted({ text, evidence }: { text: string; evidence: string }) {
  const i = evidence ? text.toLowerCase().indexOf(evidence.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: '#fdf3e1', color: 'inherit', borderRadius: 3, padding: '0 3px' }}>{text.slice(i, i + evidence.length)}</mark>
      {text.slice(i + evidence.length)}
    </>
  );
}

/** Small uppercase tag, the same shape the evidence cards use for detection labels. */
export function Tag({ children, ink = PRIVATE.ink, bg = PRIVATE.bg }: { children: React.ReactNode; ink?: string; bg?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: mono, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink, background: bg, borderRadius: 9, padding: '3px 9px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
