'use client';

import { useState } from 'react';
import { C, CT, initials, type LeafState } from './data';
import { tint } from './geometry';
import { fmt, fmtShort } from '@/lib/dates';
import type { VItem } from '@/lib/view';
import type { EventType, Person, Source } from '@/lib/types';

export const serif = "'Instrument Serif', serif";
export const mono = "'Geist Mono', monospace";
export const card = { background: '#fff', border: '1px solid #e4e2d9', borderRadius: 16 } as const;
const cardTitle = { fontFamily: serif, fontSize: 23, color: '#16211b' } as const;
const label = { fontSize: 11.5, color: '#8a948d' } as const;
const secondaryBtn = { height: 38, padding: '0 12px', borderRadius: 10, background: '#fff', border: '1px solid #dcdad0', color: '#3a453e', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' } as const;
const input = { height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid #dcdad0', background: '#fff', fontSize: 13, color: '#1d2620', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' } as const;

export interface Person2 { name: string; init: string; bg: string; ratio: string; pct: string; bar: string }
export function UnownedDecisions({ seeds, people, onPlant }: { seeds: VItem[]; people: Person[]; onPlant: (id: string, owner: string) => void }) {
  const [picking, setPicking] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  if (!seeds.length) return null;
  return (
    <section style={{ ...card, padding: '18px 18px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={cardTitle}>Unowned decisions</span>
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8a6a1e' }}>{seeds.length} seeds</span>
      </div>
      <p style={{ margin: '6px 0 8px', fontSize: 12.5, lineHeight: 1.45, color: '#7a857e' }}>Decided out loud, owned by no one. Plant each with an owner.</p>
      {seeds.map((v) => (
        <div key={v.it.id} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 12, padding: '11px 0', borderTop: '1px solid #efeee7' }}>
          <span style={{ width: 9, height: 13, margin: '3px 0 0 2px', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: 'radial-gradient(circle at 40% 30%, #fbefc8, #d9b863 55%, #a17f33)', boxShadow: '0 1px 3px rgba(120,90,30,0.3)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 13, lineHeight: 1.4, color: '#1d2620' }}>{v.it.text}</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: '#8a948d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.it.type === 'decision' ? 'Decision' : 'Action'} · {v.it.workstream}</span>
              {picking !== v.it.id && (
                <button className="hov-plant" onClick={() => { setPicking(v.it.id); setTyped(''); }} style={{ flex: 'none', whiteSpace: 'nowrap', background: '#fbf6e6', border: '1px dashed #d9bf7a', borderRadius: 12, padding: '3px 10px', fontSize: 11.5, color: '#7a5c14', cursor: 'pointer' }}>Plant</button>
              )}
            </div>
            {picking === v.it.id && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {people.map((p) => (
                  <button key={p.id} className="hov-pick" onClick={() => { onPlant(v.it.id, p.name); setPicking(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #dcdad0', borderRadius: 12, padding: '3px 9px 3px 4px', fontSize: 11.5, color: '#1d2620', cursor: 'pointer' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#e7ece4', fontSize: 8, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(p.name)}</span>
                    {p.name}
                  </button>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { onPlant(v.it.id, typed.trim()); setPicking(null); } }} style={{ display: 'flex', gap: 4 }}>
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="New name" style={{ ...input, height: 26, width: 96, fontSize: 11.5 }} />
                </form>
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

export function BranchNotes({ decisions, sources }: { decisions: VItem[]; sources: Source[] }) {
  if (!decisions.length) return null;
  return (
    <section style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={cardTitle}>Decisions</span>
        <span style={{ fontSize: 11.5, color: '#8a948d' }}>Branch notes</span>
      </div>
      {decisions.map((v) => (
        <div key={v.it.id} style={{ padding: '10px 0', borderTop: '1px solid #efeee7', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: '#1d2620' }}>{v.it.text}</span>
          <span style={{ fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>{v.it.workstream} · {sources.find((s) => s.id === v.it.source_id)?.title} · {v.owner}</span>
        </div>
      ))}
    </section>
  );
}

export function FollowThrough({ people }: { people: Person2[] }) {
  if (!people.length) return null;
  return (
    <section style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={cardTitle}>Follow-through</span>
        <span style={{ fontSize: 11.5, color: '#8a948d' }}>Kept on time</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 14 }}>
        {people.map((m) => (
          <div key={m.name} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 92px 30px', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#2b3630' }}>{m.init}</span>
            <span style={{ fontSize: 13, color: '#2b3630', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
            <span style={{ height: 6, borderRadius: 3, background: '#efeee7', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', borderRadius: 3, width: m.pct, background: m.bar }} />
            </span>
            <span style={{ fontFamily: mono, fontSize: 11, color: '#7a857e', textAlign: 'right' }}>{m.ratio}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceIcon({ k }: { k: 'mtg' | 'chat' | 'doc' }) {
  if (k === 'mtg')
    return (
      <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #65706a', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#65706a' }} />
      </span>
    );
  if (k === 'chat') return <span style={{ width: 12, height: 9, borderRadius: '3px 3px 3px 1px', border: '1.5px solid #65706a', boxSizing: 'border-box' }} />;
  return <span style={{ width: 9, height: 12, borderRadius: '1px 4px 1px 1px', border: '1.5px solid #65706a', boxSizing: 'border-box' }} />;
}

const STEP: Record<EventType, { label: (o: string | null, n: string | null) => string; color: string }> = {
  created: { label: () => 'Committed', color: C.root },
  deadline_moved: { label: (_o, n) => (n ? `Moved to ${fmtShort(n)}` : 'Date removed'), color: C.a },
  reassigned: { label: (_o, n) => (n ? `To ${n.split(' ')[0]}` : 'Unassigned'), color: C.g },
  edited: { label: () => 'Edited', color: C.g },
  overdue: { label: () => 'Overdue', color: C.r },
  done: { label: () => 'Done', color: C.g },
  reopened: { label: () => 'Reopened', color: C.a },
};

export function CommitmentPanel({ v, source, people, onClose, onPatch }: {
  v: VItem; source?: Source; people: Person[]; onClose: () => void; onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(v.it.text);
  const [owner, setOwner] = useState(v.owner || '');
  const [deadline, setDeadline] = useState(v.it.deadline || '');
  const [busy, setBusy] = useState(false);
  const st: LeafState = v.d.state === 'x' ? 'g' : v.d.state;
  const col = C[st];
  const done = v.d.state === 'x';
  const save = async () => {
    setBusy(true);
    await onPatch(v.it.id, { text, owner: owner || null, deadline: deadline || null });
    setBusy(false);
    setEditing(false);
  };
  const steps = v.events.filter((e) => e.event_type in STEP).slice(-5);

  return (
    <section data-screen-label="03 Commitment panel" style={{ ...card, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #efeee7' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>{v.it.workstream} · {v.it.type === 'decision' ? 'Decision' : 'Commitment'}</span>
          <button className="hov-close" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e4e2d9', background: '#fff', color: '#65706a', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <label style={label}>What<textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} style={{ ...input, height: 'auto', padding: 8, marginTop: 4, resize: 'vertical' }} /></label>
            <label style={label}>Owner
              <input list="people-list" value={owner} onChange={(e) => setOwner(e.target.value)} style={{ ...input, marginTop: 4 }} />
              <datalist id="people-list">{people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
            </label>
            <label style={label}>Due<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ ...input, marginTop: 4 }} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="hov-primary" disabled={busy} onClick={save} style={{ ...secondaryBtn, background: '#2f6b4f', color: '#fff', border: 'none', flex: 1 }}>{busy ? 'Saving…' : 'Save changes'}</button>
              <button onClick={() => setEditing(false)} style={secondaryBtn}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
              <span style={{ width: 30, height: 17, marginTop: 8, flex: 'none', borderRadius: '0 100% 0 100%', background: done ? '#d9b8d6' : col, transition: 'background 1.6s' }} />
              <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 28, lineHeight: 1.08, margin: 0, color: '#16211b', textWrap: 'pretty' }}>{v.it.text}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '14px 16px', marginTop: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={label}>Owner</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#1d2620' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#e7ece4', fontSize: 9.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{v.owner ? initials(v.owner) : '?'}</span>
                  {v.owner || 'Unowned'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={label}>Due</span>
                <span style={{ fontSize: 13.5, color: '#1d2620', paddingTop: 3 }}>{v.due}</span>
                {v.dueWas && <span style={label}>originally <span style={{ textDecoration: 'line-through' }}>{v.dueWas}</span></span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={label}>State</span>
                <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 500, color: CT[st], background: tint(col, 0.1), border: `1px solid ${tint(col, 0.35)}`, borderRadius: 12, padding: '3px 10px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: col }} />
                  {v.d.label}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={label}>Slip risk</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: serif, fontSize: 28, lineHeight: 0.9, color: CT[st] }}>{v.risk}%</span>
                  <span style={{ flex: 1, height: 5, borderRadius: 3, background: '#efeee7', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: 3, width: v.risk + '%', background: col }} />
                  </span>
                </div>
              </div>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#65706a', textWrap: 'pretty' }}>
              {done ? 'Marked done. The leaf has bloomed and left the tree.' : v.slips ? `The deadline has moved ${v.slips} time${v.slips > 1 ? 's' : ''}${v.dueWas ? ` since ${v.dueWas}` : ''}. Each slip raises the risk.` : st === 'g' ? 'On track. No slips recorded.' : st === 'a' ? 'Due soon. Check in before it wilts.' : 'Past due. The longer it sits, the closer it is to falling.'}
            </p>
          </>
        )}
      </div>

      <div style={{ flex: '1 0 auto', minWidth: 0, padding: '16px 20px 8px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e', marginBottom: 12 }}>Lifecycle</div>
        <div style={{ display: 'flex', marginBottom: 20 }}>
          {steps.map((e, i) => {
            const s = STEP[e.event_type];
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0, paddingRight: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginRight: -8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: s.color, boxShadow: `0 0 0 3px ${tint(s.color, 0.18)}` }} />
                  {i < steps.length - 1 && <span style={{ flex: 1, height: 1, margin: '0 6px', background: '#dcdad0' }} />}
                </div>
                <span style={{ fontSize: 11.5, lineHeight: 1.25, color: '#1d2620' }}>{s.label(e.old_value, e.new_value)}</span>
                <span style={{ fontFamily: mono, fontSize: 9.5, color: '#8a948d', overflowWrap: 'anywhere' }}>{fmtShort(e.time.slice(0, 10))}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e' }}>Source</span>
          <span style={label}>1 source</span>
        </div>
        {source && (
          <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f8f8f3', border: '1px solid #ebeae2', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: '#fff', border: '1px solid #e4e2d9', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SourceIcon k={source.kind} /></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#3a453e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{source.title}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: '#8a948d', whiteSpace: 'nowrap' }}>{fmt(source.meeting_date)}</span>
            </div>
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 19, lineHeight: 1.28, color: '#16211b', textWrap: 'pretty' }}>“{v.it.source_excerpt}”</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: CT.g, background: tint(C.g, 0.14), borderRadius: 9, padding: '2px 8px' }}>{v.it.type === 'decision' ? 'Decision made' : 'Commitment made'}</span>
              <span style={label}>{v.owner || 'No owner named'}</span>
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <div style={{ position: 'sticky', bottom: 0, display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 20px', borderTop: '1px solid #efeee7', background: '#fff' }}>
          <button className="hov-primary" onClick={() => onPatch(v.it.id, { done: !done })} style={{ flex: '1 1 120px', minWidth: 0, height: 38, padding: '0 12px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {done ? 'Reopen' : 'Mark done'}
          </button>
          <button style={secondaryBtn} onClick={() => { setText(v.it.text); setOwner(v.owner || ''); setDeadline(v.it.deadline || ''); setEditing(true); }}>Edit owner / date</button>
        </div>
      )}
    </section>
  );
}
