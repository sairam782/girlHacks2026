'use client';

import { useState } from 'react';
import { C, CT, initials, type LeafState } from './data';
import { card, mono, serif } from './panels';
import { fmt, fmtShort, todayISO } from '@/lib/dates';
import type { History } from '@/lib/history';
import type { VItem } from '@/lib/view';
import type { CommitmentEvent, EventType, Extracted, Project, Source, SourceKind } from '@/lib/types';

const field = { height: 36, padding: '0 10px', borderRadius: 9, border: '1px solid #dcdad0', background: '#fff', fontSize: 13, color: '#1d2620', fontFamily: 'inherit', boxSizing: 'border-box' } as const;
const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: '#7a857e' } as const;

const SAMPLE = `Weekly vendor sync, Monday
Dana: Okay, quick recap. We decided to go with Vendor A for the migration.
Priya: Sure, that works. I'll send the revised pricing to the client by Friday.
Dana: Marcus, can you finish the data processing addendum by Thursday?
Marcus: Yes, I'll get the DPA review done by Thursday.
Sam: I will draft the cutover runbook by next Tuesday.
Dana: Jordan, can you sign off the budget by Wednesday?
Jordan: Will do, budget sign-off by Wednesday.
Lena: I'll raise the PO for Vendor A once the budget is approved.
Dana: We agreed to freeze the legacy API after cutover.
Dana: Someone needs to tell Legal about the new timeline.
Aiko: I'll run the SSO integration spike by end of week.`;

type Draft = Extracted & { keep: boolean };

// Paste → Gemini extracts → you review and fix → the reviewed items are planted. Nothing reaches the
// tree until someone has looked at it, so a wrong owner or date never becomes "truth" silently.
export function IngestModal({ projects, projectId, onClose, onDone }: {
  projects: Project[]; projectId: string | null; onClose: () => void; onDone: (r: { n: number; engine: string; note?: string; projectId: string }) => void;
}) {
  const [pid, setPid] = useState(projectId || projects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<SourceKind>('mtg');
  const [date, setDate] = useState(todayISO());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [engine, setEngine] = useState('');
  const [note, setNote] = useState<string | undefined>();
  const [people, setPeople] = useState<string[]>([]);

  const post = async (extra: Record<string, unknown>) => {
    const r = await fetch('/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: pid, title, kind, meetingDate: date, text, ...extra }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Extraction failed');
    return j;
  };

  const extractNow = async () => {
    setBusy(true); setErr('');
    try {
      const j = await post({ preview: true });
      setDrafts((j.items as Extracted[]).map((x) => ({ ...x, keep: true })));
      setEngine(j.engine); setNote(j.note); setPeople(j.people || []);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const plant = async () => {
    if (!drafts) return;
    setBusy(true); setErr('');
    try {
      const keep = drafts.filter((d) => d.keep && d.text.trim()).map(({ keep: _k, ...x }) => x);
      const j = await post({ items: keep, engine });
      const skipped = j.skipped ? `${j.skipped} already on the tree ${j.skipped === 1 ? 'was' : 'were'} skipped.` : '';
      onDone({ n: j.items.length, engine, note: [note, skipped].filter(Boolean).join(' ') || undefined, projectId: pid });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  const set = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds && ds.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const kept = drafts?.filter((d) => d.keep).length ?? 0;
  const small = { ...field, height: 30, fontSize: 12.5, padding: '0 8px' };
  const found = drafts ? `${engine === 'gemini' ? 'Gemini' : 'Canopy'} found ${drafts.length} item${drafts.length === 1 ? '' : 's'}` : 'Add a source';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(30,40,34,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: drafts ? 'min(860px, 100%)' : 'min(640px, 100%)', maxHeight: '100%', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 24px 60px rgba(40,55,45,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: serif, fontSize: 28, color: '#16211b' }}>{found}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#7a857e' }}>×</button>
        </div>

        {!drafts ? (
          <>
            <p style={{ margin: 0, fontSize: 13, color: '#65706a', lineHeight: 1.45 }}>Paste a transcript, chat thread, or doc. Canopy pulls out every decision, owner, and deadline. You review them before anything lands on the tree.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <label style={lbl}>Project<select value={pid} onChange={(e) => setPid(e.target.value)} style={field}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label style={lbl}>Type<select value={kind} onChange={(e) => setKind(e.target.value as SourceKind)} style={field}><option value="mtg">Meeting transcript</option><option value="chat">Chat thread</option><option value="doc">Doc</option></select></label>
              <label style={lbl}>Meeting date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={field} /></label>
            </div>
            <label style={lbl}>Name (becomes the source label)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monday standup" style={field} /></label>
            <label style={lbl}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>Text<button onClick={() => { setText(SAMPLE); setTitle(title || 'Vendor sync'); }} style={{ background: 'none', border: 'none', color: '#2f6b4f', cursor: 'pointer', fontSize: 11.5, padding: 0 }}>Load sample transcript</button></span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={11} placeholder="Paste here…" style={{ ...field, height: 'auto', padding: 10, lineHeight: 1.45, resize: 'vertical' }} />
            </label>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, color: '#65706a', lineHeight: 1.45 }}>
              Fix anything that looks wrong, untick what is not a real commitment, then plant them. Items with no owner become seeds waiting for one.
              {note && <span style={{ display: 'block', marginTop: 6, color: '#9a620c' }}>{note}</span>}
            </p>
            <datalist id="ingest-people">{people.map((n) => <option key={n} value={n} />)}</datalist>
            {drafts.length === 0 && <div style={{ fontSize: 13, color: '#8a948d', padding: '12px 0' }}>Nothing to track was found in this text.</div>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {drafts.map((d, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 10, padding: '12px 0', borderTop: '1px solid #efeee7', opacity: d.keep ? 1 : 0.45 }}>
                  <input type="checkbox" checked={d.keep} onChange={(e) => set(i, { keep: e.target.checked })} aria-label={`Keep ${d.text}`} style={{ marginTop: 8, width: 16, height: 16, accentColor: '#2f6b4f' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={d.type} onChange={(e) => set(i, { type: e.target.value as Extracted['type'] })} aria-label="Type" style={{ ...small, width: 104 }}><option value="action">Action</option><option value="decision">Decision</option></select>
                      <input value={d.text} onChange={(e) => set(i, { text: e.target.value })} aria-label="What" style={{ ...small, flex: 1, minWidth: 0 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {d.type === 'action' && <input list="ingest-people" value={d.owner ?? ''} onChange={(e) => set(i, { owner: e.target.value || null })} placeholder="No owner (seed)" aria-label="Owner" style={{ ...small, width: 170 }} />}
                      {d.type === 'action' && <input type="date" value={d.deadline ?? ''} onChange={(e) => set(i, { deadline: e.target.value || null })} aria-label="Due" style={{ ...small, width: 150 }} />}
                      <input value={d.workstream ?? ''} onChange={(e) => set(i, { workstream: e.target.value || null })} placeholder="Workstream" aria-label="Workstream" style={{ ...small, width: 130 }} />
                    </div>
                    <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 14.5, color: '#65706a', lineHeight: 1.35 }}>“{d.source_excerpt}”</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {err && <div style={{ fontSize: 12.5, color: '#9c4529' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={drafts ? () => setDrafts(null) : onClose} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid #dcdad0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>{drafts ? 'Back' : 'Cancel'}</button>
          {drafts ? (
            <button className="hov-primary" disabled={busy || kept === 0} onClick={plant} style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: busy ? 'wait' : 'pointer', opacity: busy || kept === 0 ? 0.6 : 1 }}>
              {busy ? 'Planting…' : `Plant ${kept} on the tree`}
            </button>
          ) : (
            <button className="hov-primary" disabled={busy || !text.trim() || !pid} onClick={extractNow} style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: busy ? 'wait' : 'pointer', opacity: busy || !text.trim() ? 0.6 : 1 }}>
              {busy ? 'Reading…' : 'Extract commitments'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(30,40,34,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate(name.trim()); }} style={{ ...card, width: 'min(420px, 100%)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontFamily: serif, fontSize: 28, color: '#16211b' }}>New project</span>
        <label style={lbl}>Project name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 Vendor Migration" style={field} /></label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid #dcdad0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button className="hov-primary" type="submit" disabled={!name.trim()} style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Plant it</button>
        </div>
      </form>
    </div>
  );
}

const th = { textAlign: 'left', fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8a948d', fontWeight: 400, padding: '10px 12px' } as const;
const td = { padding: '11px 12px', fontSize: 13, color: '#1d2620', borderTop: '1px solid #efeee7', verticalAlign: 'top' } as const;

export function ListView({ items, sel, onSelect }: { items: VItem[]; sel: string | null; onSelect: (id: string) => void }) {
  const rank = (v: VItem) => ({ d: 0, r: 1, a: 2, g: 3, x: 5 }[v.d.state] + (v.it.deadline ? 0 : 0.5));
  const rows = [...items].sort((a, b) => rank(a) - rank(b) || (a.it.deadline || '9').localeCompare(b.it.deadline || '9'));
  if (!rows.length) return <Empty text="Nothing extracted yet. Add a source to start." />;
  return (
    <div style={{ ...card, flex: 1, minHeight: 0, overflow: 'auto', margin: '14px 0 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Item</th><th style={th}>Owner</th><th style={th}>Due</th><th style={th}>State</th><th style={th}>Source</th></tr></thead>
        <tbody>
          {rows.map((v) => {
            const st = v.d.state === 'x' ? null : (v.d.state as LeafState);
            return (
              <tr key={v.it.id} onClick={() => onSelect(v.it.id)} style={{ cursor: 'pointer', background: sel === v.it.id ? '#f3f7f1' : undefined }}>
                <td style={td}><span style={{ opacity: v.d.state === 'x' ? 0.55 : 1, textDecoration: v.d.state === 'x' ? 'line-through' : undefined }}>{v.it.text}</span><div style={{ fontFamily: mono, fontSize: 10, color: '#8a948d', marginTop: 3 }}>{v.it.type.toUpperCase()} · {v.it.workstream}</div></td>
                <td style={td}>{v.owner || <span style={{ color: '#a17f33' }}>Unowned</span>}</td>
                <td style={td}>{v.due}{v.dueWas && <div style={{ fontSize: 11, color: '#8a948d', textDecoration: 'line-through' }}>{v.dueWas}</div>}</td>
                <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: st ? CT[st] : '#8a6a99' }}><span style={{ width: 11, height: 6, borderRadius: '0 100% 0 100%', background: st ? C[st] : '#d9b8d6' }} />{v.d.label}</span></td>
                <td style={{ ...td, color: '#7a857e', fontSize: 12, maxWidth: 260 }}>“{v.it.source_excerpt.length > 70 ? v.it.source_excerpt.slice(0, 69) + '…' : v.it.source_excerpt}”</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SourcesView({ sources, items, onDelete }: { sources: Source[]; items: VItem[]; onDelete: (id: string) => Promise<void> }) {
  if (!sources.length) return <Empty text="No sources yet." />;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[...sources].reverse().map((s) => (
        <details key={s.id} style={{ ...card, padding: '14px 16px' }}>
          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: serif, fontSize: 20, color: '#16211b' }}>{s.title}</span>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>{{ mtg: 'MEETING', chat: 'CHAT', doc: 'DOC' }[s.kind]} · {fmt(s.meeting_date)} · {items.filter((v) => v.it.source_id === s.id).length} items</span>
            <button onClick={(e) => { e.preventDefault(); const n = items.filter((v) => v.it.source_id === s.id).length; if (window.confirm(`Delete "${s.title}" and the ${n} item${n === 1 ? '' : 's'} extracted from it?`)) void onDelete(s.id); }}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #efd3c6', borderRadius: 8, padding: '3px 10px', fontSize: 11.5, color: '#9c4529', cursor: 'pointer' }}>Delete</button>
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.5, color: '#4a554e', margin: '12px 0 0', maxHeight: 280, overflow: 'auto' }}>{s.text}</pre>
        </details>
      ))}
    </div>
  );
}

const EV_LABEL: Record<EventType, string> = { created: 'created', reassigned: 'reassigned', deadline_moved: 'deadline moved', edited: 'edited', done: 'marked done', reopened: 'reopened', overdue: 'went overdue', nudged: 'owner nudged', mood_flagged: 'mood flagged' };
const EV_COLOR: Record<EventType, string> = { created: C.root, reassigned: '#6b8fb5', deadline_moved: C.a, edited: '#8a948d', done: C.g, reopened: C.a, overdue: C.r, nudged: '#2f8a77', mood_flagged: '#6f7196' };

function describe(e: CommitmentEvent) {
  const d = (x: string | null) => (x ? fmtShort(x) : 'no date');
  if (e.event_type === 'deadline_moved') return `${d(e.old_value)} → ${d(e.new_value)}`;
  if (e.event_type === 'reassigned') return `${e.old_value || 'unowned'} → ${e.new_value || 'unowned'}`;
  if (e.event_type === 'overdue') return `was due ${d(e.old_value)}`;
  if (e.event_type === 'mood_flagged') return e.new_value ? `· sounded ${e.new_value}` : '· cleared';
  if (e.event_type === 'created') { try { const j = JSON.parse(e.new_value || '{}'); return `${j.owner || 'unowned'} · ${d(j.deadline)}`; } catch { return ''; } }
  return '';
}

export function TimelineView({ hist, items }: { hist: (History & { events: CommitmentEvent[] }) | null; items: VItem[] }) {
  if (!hist) return <Empty text="Loading history…" />;
  const name = (id: string) => items.find((v) => v.it.id === id)?.it.text || 'Removed item';
  const stat = (n: string | number, l: string, c = '#16211b') => (
    <div style={{ ...card, padding: '14px 16px', flex: '1 1 140px' }}>
      <div style={{ fontFamily: serif, fontSize: 34, lineHeight: 1, color: c }}>{n}</div>
      <div style={{ fontSize: 12, color: '#7a857e', marginTop: 6 }}>{l}</div>
    </div>
  );
  const events = [...hist.events].reverse().slice(0, 80);
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {stat(hist.greenPct + '%', 'of days stayed green (no overdue leaf)', hist.greenPct >= 80 ? CT.g : CT.a)}
        {stat(hist.slips, 'deadline slips', hist.slips ? CT.a : '#16211b')}
        {stat(hist.reassignments, 'reassignments')}
      </div>
      {hist.greenDays.length > 0 && (
        <div style={{ ...card, padding: '14px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e', marginBottom: 10 }}>Last {hist.greenDays.length} days</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {hist.greenDays.map((d) => <span key={d.date} title={fmt(d.date) + (d.green ? ' · green' : ' · had overdue leaves')} style={{ flex: 1, height: 22, borderRadius: 5, background: d.green ? C.g : C.r, opacity: d.green ? 0.85 : 0.9 }} />)}
          </div>
        </div>
      )}
      <div style={{ ...card, padding: '14px 16px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e', marginBottom: 6 }}>How deadlines slipped</div>
        {hist.drifts.length === 0 && <div style={{ fontSize: 12.5, color: '#8a948d', padding: '6px 0' }}>No deadline has moved yet. Edit a due date and it shows up here.</div>}
        {hist.drifts.map((d) => (
          <div key={d.itemId} style={{ padding: '10px 0', borderTop: '1px solid #efeee7', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#1d2620' }}>{name(d.itemId)}</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: CT.a }}>{d.chain.join('  →  ')}  <span style={{ color: '#8a948d' }}>({d.slips} slip{d.slips > 1 ? 's' : ''})</span></span>
          </div>
        ))}
      </div>
      <div style={{ ...card, padding: '14px 16px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e', marginBottom: 6 }}>Event log</div>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 118px minmax(0,1fr)', gap: 10, padding: '8px 0', borderTop: '1px solid #efeee7', alignItems: 'baseline' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: EV_COLOR[e.event_type] }} />
            <span style={{ fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>{e.time.slice(5, 16).replace('T', ' ')}</span>
            <span style={{ fontSize: 12.5, color: '#1d2620' }}>{name(e.action_item_id)} <span style={{ color: '#7a857e' }}>· {EV_LABEL[e.event_type]} {describe(e)}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...card, flex: 1, margin: '14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a948d', fontSize: 13.5 }}>{text}</div>;
}

export { initials };
