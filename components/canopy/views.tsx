'use client';

import { useState } from 'react';
import { C, CT, initials, type LeafState } from './data';
import { card, mono, serif } from './panels';
import { fmt, fmtShort, todayISO } from '@/lib/dates';
import type { History } from '@/lib/history';
import type { VItem } from '@/lib/view';
import type { CommitmentEvent, EventType, Project, Source, SourceKind } from '@/lib/types';

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

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: pid, title, kind, meetingDate: date, text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Extraction failed');
      onDone({ n: j.items.length, engine: j.engine, note: j.note, projectId: pid });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(30,40,34,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 'min(640px, 100%)', maxHeight: '100%', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 24px 60px rgba(40,55,45,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: serif, fontSize: 28, color: '#16211b' }}>Add a source</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#7a857e' }}>×</button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#65706a', lineHeight: 1.45 }}>Paste a transcript, chat thread, or doc. Canopy pulls out every decision, owner, and deadline, and grows a leaf for each.</p>
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
        {err && <div style={{ fontSize: 12.5, color: '#9c4529' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid #dcdad0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button className="hov-primary" disabled={busy || !text.trim() || !pid} onClick={submit} style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: busy ? 'wait' : 'pointer', opacity: busy || !text.trim() ? 0.6 : 1 }}>
            {busy ? 'Reading…' : 'Extract commitments'}
          </button>
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

export function SourcesView({ sources, items }: { sources: Source[]; items: VItem[] }) {
  if (!sources.length) return <Empty text="No sources yet." />;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[...sources].reverse().map((s) => (
        <details key={s.id} style={{ ...card, padding: '14px 16px' }}>
          <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: serif, fontSize: 20, color: '#16211b' }}>{s.title}</span>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>{{ mtg: 'MEETING', chat: 'CHAT', doc: 'DOC' }[s.kind]} · {fmt(s.meeting_date)} · {items.filter((v) => v.it.source_id === s.id).length} items</span>
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.5, color: '#4a554e', margin: '12px 0 0', maxHeight: 280, overflow: 'auto' }}>{s.text}</pre>
        </details>
      ))}
    </div>
  );
}

const EV_LABEL: Record<EventType, string> = { created: 'created', reassigned: 'reassigned', deadline_moved: 'deadline moved', edited: 'edited', done: 'marked done', reopened: 'reopened', overdue: 'went overdue' };
const EV_COLOR: Record<EventType, string> = { created: C.root, reassigned: '#6b8fb5', deadline_moved: C.a, edited: '#8a948d', done: C.g, reopened: C.a, overdue: C.r };

function describe(e: CommitmentEvent) {
  const d = (x: string | null) => (x ? fmtShort(x) : 'no date');
  if (e.event_type === 'deadline_moved') return `${d(e.old_value)} → ${d(e.new_value)}`;
  if (e.event_type === 'reassigned') return `${e.old_value || 'unowned'} → ${e.new_value || 'unowned'}`;
  if (e.event_type === 'overdue') return `was due ${d(e.old_value)}`;
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
