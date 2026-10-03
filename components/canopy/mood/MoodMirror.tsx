'use client';

// Mood Mirror inside Canopy: a private look back at how a meeting felt for one person.
// Same report as the standalone app in mood-mirror/static/index.html, drawn in Canopy's
// language — cream paper, serif numbers, leaf-shaped tone marks, evidence cards.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AV, initials, LEAVES, WSN, type Leaf } from '../data';
import { CanvasBg } from '../trees';
import { FaceLayer } from './FaceLayer';
import { MoodBrief } from './MoodBrief';
import {
  ENGINE_LABEL, LABEL, MEETING_LABELS, TONE, mmss,
  type Emotion, type FaceBlock, type MeetingId, type Moment, type MoodReport, type MoodStatus, type PersonReport, type Suggestion,
} from './types';
import { card, cardTitle, LeafMark, micro, mono, Quoted, secondaryBtn, sectionNote, serif, ToneChip } from './ui';

const firstName = (n: string) => n.trim().split(/\s+/)[0].toLowerCase();

/** Canopy leaves owned by this speaker, matched on first name. */
const leavesFor = (speaker: string): Leaf[] => LEAVES.filter((l) => firstName(l.owner) === firstName(speaker));

export interface MoodMirrorProps {
  onBack: () => void;
  onOpenCommitment: (id: string) => void;
  motes?: boolean;
}

export default function MoodMirror({ onBack, onOpenCommitment, motes = true }: MoodMirrorProps) {
  const [report, setReport] = useState<MoodReport | null>(null);
  const [status, setStatus] = useState<MoodStatus | null>(null);
  const [meeting, setMeeting] = useState<MeetingId>('vendor');
  const [current, setCurrent] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const [lang, setLang] = useState('en-US');
  const scroller = useRef<HTMLDivElement | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nm = useCallback((id: string) => names[id] || id, [names]);

  const load = useCallback(async (run: () => Promise<Response>, pending: string) => {
    setBusy(true);
    setMsg({ text: pending });
    try {
      const res = await run();
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || body?.detail || res.statusText);
      const data = body as MoodReport;
      const ids = Object.keys(data.people);
      setReport(data);
      setNames({});
      setRenaming(false);
      // Canopy's user is Jordan, so open on their report when they were in the room.
      setCurrent(ids.find((id) => firstName(id) === 'jordan') ?? ids[0] ?? null);
      setMsg({ text: `${data.title} · ${data.turns.length} turns · ${mmss(data.team.duration_sec)} long` });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), err: true });
    } finally {
      setBusy(false);
    }
  }, []);

  const runDemo = useCallback((id: MeetingId) => {
    setMeeting(id);
    void load(() => fetch(`/api/mood/demo?meeting=${id}`), `Reading the ${MEETING_LABELS[id].toLowerCase()}…`);
  }, [load]);

  // Status and the default meeting load on first open, so the report is there to look at.
  useEffect(() => {
    let live = true;
    fetch('/api/mood/status')
      .then((r) => r.json())
      .then((s) => { if (live) setStatus(s as MoodStatus); })
      .catch(() => { if (live) setStatus({ speech: false, llm: 'offline', service: false }); });
    return () => { live = false; };
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    runDemo('vendor');
  }, [runDemo]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    const isAudio = !f.name.toLowerCase().endsWith('.json');
    void load(
      () => fetch(`/api/mood/analyze?language=${encodeURIComponent(lang)}`, { method: 'POST', body: fd }),
      isAudio ? 'Transcribing and separating speakers… (about as long as the recording)' : 'Reading the transcript…',
    );
  };

  const jumpTo = (id: number) => {
    const el = document.getElementById(`mood-moment-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1500);
  };

  /** The face pass returns that person's updated block and re-ranked suggestions. */
  const applyFace = useCallback((id: string, face: FaceBlock, suggestions: Suggestion[]) => {
    setReport((r) => (r ? { ...r, people: { ...r.people, [id]: { ...r.people[id], face, suggestions } } } : r));
  }, []);

  const person = current && report ? report.people[current] : null;
  const people = report ? Object.keys(report.people) : [];

  const statusPills = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {[
        { on: status ? status.llm !== 'offline' : false, text: `Tone · ${status ? ENGINE_LABEL[status.llm] : 'checking…'}` },
        { on: !!status?.speech, text: status?.speech ? `Speech · ${status.speechEngine ?? 'connected'}` : 'Speech · transcripts only' },
      ].map((p) => (
        <span key={p.text} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#65706a', background: '#fff', border: '1px solid #e4e2d9', borderRadius: 13, padding: '3px 11px', whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: p.on ? '#4f9d69' : '#c7cdc6', boxShadow: p.on ? '0 0 0 3px rgba(79,157,105,0.18)' : undefined }} />
          {p.text}
        </span>
      ))}
    </div>
  );

  return (
    <div data-screen-label="05 Mood Mirror" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#8a948d', flex: 'none' }}>
        <button className="hov-crumb" onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#65706a' }}>The Grove</button>
        <span>›</span>
        <span style={{ color: '#2b3630' }}>Mood Mirror</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 10, flexWrap: 'wrap', flex: 'none' }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: '#eef0f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <LeafMark color="linear-gradient(135deg, #a9b0d4, #6f7196)" w={18} h={18} style={{ borderRadius: '2px 100% 2px 100%' }} />
        </span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 'clamp(26px, 4.4vh, 36px)', lineHeight: 1, margin: 0, color: '#16211b' }}>Mood Mirror</h1>
          <div style={{ fontSize: 12.5, color: '#7a857e', marginTop: 5 }}>
            How the meeting felt for you, what happened right before each feeling, and what to do next.
          </div>
        </div>
        {statusPills}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 12, borderBottom: '1px solid #e4e2d9', fontSize: 13, flex: 'none', flexWrap: 'wrap' }}>
        <span style={{ padding: '9px 0', borderBottom: '2px solid #2f6b4f', marginBottom: -1, color: '#1d3a2b', fontWeight: 500 }}>Your report</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#f1f0f6', border: '1px solid #dedde8', borderRadius: 14, padding: '4px 11px', fontSize: 12, color: '#4b4d72', whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6f7196' }} />
          Private · only you see this report
        </span>
      </div>

      <div ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 110, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ---------------------------------------------------------- load bar */}
        <section style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #dcdad0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            {(Object.keys(MEETING_LABELS) as MeetingId[]).map((id, i) => {
              const active = meeting === id;
              return (
                <button key={id} className={active ? undefined : 'hov-soft'} onClick={() => runDemo(id)} disabled={busy}
                  style={{ height: 38, padding: '0 14px', border: 'none', borderLeft: i ? '1px solid #e4e2d9' : undefined, background: active ? '#2f6b4f' : 'none', color: active ? '#fff' : '#3a453e', fontSize: 13, fontWeight: active ? 500 : 400, cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                  {MEETING_LABELS[id]}
                </button>
              );
            })}
          </div>
          <label className="hov-soft" style={{ ...secondaryBtn, display: 'flex', alignItems: 'center' }}>
            Upload recording or transcript
            <input type="file" onChange={onUpload} disabled={busy}
              accept=".wav,.mp3,.m4a,.mp4,.mov,.webm,.ogg,.flac,.aac,.json" style={{ display: 'none' }} />
          </label>
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Meeting language"
            style={{ ...secondaryBtn, padding: '0 8px' }}>
            {[['en-US', 'English (US)'], ['en-IN', 'English (India)'], ['en-GB', 'English (UK)'], ['es-ES', 'Spanish'], ['hi-IN', 'Hindi']].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {msg && (
            <span style={{ fontSize: 12.5, lineHeight: 1.45, color: msg.err ? '#9c4529' : '#7a857e', flex: '1 1 240px', minWidth: 0 }}>
              {msg.text}
            </span>
          )}
        </section>

        {!report ? (
          <section style={{ ...card, padding: '60px 20px', textAlign: 'center', color: '#8a948d', fontSize: 13.5 }}>
            {busy ? 'Reading the meeting…' : 'Pick a demo meeting or upload a recording to see the report.'}
          </section>
        ) : !person || !current ? null : (
          <>
            {/* -------------------------------------------------- viewing as */}
            <section style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 'none' }}>
              <span style={micro}>Viewing as</span>
              {people.map((id, i) => {
                const active = id === current;
                return (
                  <button key={id} className={active ? undefined : 'hov-pick'} onClick={() => { setCurrent(id); setRenaming(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, background: active ? '#e8eee6' : '#fff', border: `1px solid ${active ? '#bcd3c0' : '#dcdad0'}`, borderRadius: 14, padding: '4px 11px 4px 4px', fontSize: 12.5, fontWeight: active ? 500 : 400, color: active ? '#1d3a2b' : '#3a453e', cursor: 'pointer' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', background: AV[i % AV.length], fontSize: 9, fontWeight: 600, color: '#2b3630', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(nm(id))}</span>
                    {nm(id)}
                    {firstName(id) === 'jordan' && <span style={{ fontSize: 11, color: '#7a857e' }}>(you)</span>}
                  </button>
                );
              })}
              {renaming ? (
                <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setNames((n) => ({ ...n, [current]: draft.trim() })); setRenaming(false); }}
                  style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Display name for ${current}`}
                    style={{ height: 32, width: 130, padding: '0 10px', borderRadius: 9, border: '1px solid #dcdad0', background: '#fff', color: '#1d2620', font: 'inherit', fontSize: 13 }} />
                  <button type="submit" className="hov-primary" style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 12.5, cursor: 'pointer' }}>Save</button>
                </form>
              ) : (
                <button className="hov-soft" onClick={() => { setDraft(nm(current)); setRenaming(true); }}
                  style={{ marginLeft: 'auto', height: 32, padding: '0 12px', borderRadius: 9, background: '#fff', border: '1px solid #dcdad0', color: '#65706a', fontSize: 12.5, cursor: 'pointer' }}>
                  Rename speaker
                </button>
              )}
            </section>

            <Tiles person={person} report={report} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12, flex: 'none' }}>
              <Mix report={report} person={person} who={nm(current)} />
              <Timeline report={report} person={person} onJump={jumpTo} />
            </div>

            <LinkedCommitments speaker={current} who={nm(current)} person={person} onOpen={onOpenCommitment} motes={motes} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12, alignItems: 'start', flex: 'none' }}>
              <FaceLayer report={report} speaker={current} who={nm(current)} onUpdated={applyFace} />
              <MoodBrief report={report} speaker={current} who={nm(current)} />
            </div>

            <section style={{ ...card, padding: 18, flex: 'none' }}>
              <span style={cardTitle}>What you can do next</span>
              <p style={sectionNote}>Actions tied to specific moments, never “just be happier”.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 14 }}>
                {person.suggestions.map((s, i) => (
                  <div key={i} style={{ padding: '13px 15px', borderRadius: 12, background: '#f8f8f3', border: '1px solid #ebeae2', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1d2620', lineHeight: 1.3 }}>{s.title}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: '#65706a', textWrap: 'pretty' }}>{s.detail}</span>
                    {s.at != null && person.moments.length > 0 && (
                      <button onClick={() => jumpTo(nearest(person.moments, s.at!).id)} className="hov-tour"
                        style={{ alignSelf: 'flex-start', marginTop: 2, background: 'none', border: 'none', padding: 0, fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2f6b4f', cursor: 'pointer' }}>
                        See the moment at {mmss(s.at)} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ---------------------------------------------------- moments */}
            <section style={{ ...card, padding: 18, flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={cardTitle}>Your moments</span>
                <span style={{ fontSize: 11.5, color: '#8a948d' }}>{person.moments.length} of {person.turns} turns</span>
              </div>
              <p style={sectionNote}>The exact words behind every label, and what happened right before.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {person.moments.length === 0 && (
                  <span style={{ fontSize: 13, color: '#8a948d' }}>Nothing stood out. A calm, neutral meeting for you.</span>
                )}
                {person.moments.map((m) => {
                  const why = [
                    m.cut_off ? 'You were cut off here' : null,
                    m.deflected_question ? 'Your question was moved past' : null,
                    m.context,
                  ].filter(Boolean) as string[];
                  return (
                    <div key={m.id} id={`mood-moment-${m.id}`}
                      style={{ padding: '12px 14px', borderRadius: 12, background: flash === m.id ? '#fdf3e1' : '#f8f8f3', border: `1px solid ${flash === m.id ? '#f1d9a8' : '#ebeae2'}`, display: 'flex', flexDirection: 'column', gap: 9, transition: 'background .3s, border-color .3s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        <ToneChip emotion={m.emotion} />
                        <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>{m.time}</span>
                      </div>
                      <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 19, lineHeight: 1.3, color: '#16211b', textWrap: 'pretty' }}>
                        “<Quoted text={m.text} evidence={m.evidence} />”
                      </div>
                      {why.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                          {why.map((w) => (
                            <span key={w} style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: mono, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b4d72', background: '#f1f0f6', borderRadius: 9, padding: '3px 9px' }}>
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={() => setShowTranscript((s) => !s)} className="hov-tour"
                style={{ marginTop: 14, background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: '#65706a', cursor: 'pointer' }}>
                {showTranscript ? '− Hide full transcript' : '+ Full transcript'}
              </button>
              {showTranscript && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
                  {report.turns.map((t) => {
                    const me = t.speaker === current;
                    return (
                      <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0,1fr)', gap: 10, padding: '5px 8px', borderRadius: 8, background: me ? '#f1f0f6' : undefined, fontSize: 13, lineHeight: 1.45 }}>
                        <span style={{ fontFamily: mono, fontSize: 10.5, color: '#9aa29c', paddingTop: 2 }}>{mmss(t.start)}</span>
                        <span style={{ color: '#3a453e' }}>
                          <strong style={{ fontWeight: 600, color: me ? '#4b4d72' : '#1d2620' }}>{nm(t.speaker)}:</strong> {t.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <p style={{ margin: '2px 2px 0', fontSize: 11.5, lineHeight: 1.55, color: '#8a948d', flex: 'none' }}>
              Labels from {ENGINE_LABEL[report.engine.labels]} · suggestions from {ENGINE_LABEL[report.engine.suggestions]} · source: {report.source}.
              Read from the words only — no face or voice-tone analysis. Labels describe the words used, not a diagnosis of how anyone feels.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const nearest = (moments: Moment[], at: number) => moments.reduce((a, b) => (Math.abs(b.t - at) < Math.abs(a.t - at) ? b : a));

// ------------------------------------------------------------------- tiles

function Tiles({ person, report }: { person: PersonReport; report: MoodReport }) {
  const diff = person.mood_score - report.team.mood_score;
  const calm: Emotion[] = ['neutral', 'happy', 'confident'];
  const flagged = person.cut_offs + person.deflected_questions + person.moments.filter((m) => !calm.includes(m.emotion)).length;
  const tone = TONE[person.dominant];

  const tile = (k: string, body: React.ReactNode, d: string) => (
    <div key={k} style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, color: '#65706a' }}>{k}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minHeight: 36 }}>{body}</div>
      <span style={{ fontSize: 12, color: '#8a948d', lineHeight: 1.4 }}>{d}</span>
    </div>
  );
  const big = (v: React.ReactNode, color = '#16211b') => <span style={{ fontFamily: serif, fontSize: 34, lineHeight: 1, color }}>{v}</span>;
  const unit = (s: string) => <span style={{ fontSize: 14, color: '#8a948d' }}>{s}</span>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, flex: 'none' }}>
      {tile('Mood score', <>{big(person.mood_score, tone.text)}{unit('/ 100')}</>,
        `Team average ${report.team.mood_score} (${diff >= 0 ? '+' : ''}${diff})`)}
      {tile('Main tone', <ToneChip emotion={person.dominant} />, 'Most common feeling besides neutral')}
      {tile('Airtime', <>{big(Math.round(person.airtime_share * 100))}{unit('%')}</>,
        `An even split is ${Math.round(report.team.equal_airtime_share * 100)}%`)}
      {tile('Moments to look at', big(flagged),
        `${person.cut_offs} cut off · ${person.deflected_questions} question moved past`)}
    </div>
  );
}

// --------------------------------------------------------------- emotion mix

function Mix({ report, person, who }: { report: MoodReport; person: PersonReport; who: string }) {
  const row = (label: string, mix: Record<Emotion, number>) => (
    <div style={{ display: 'grid', gridTemplateColumns: '88px minmax(0,1fr)', alignItems: 'center', gap: 10, marginTop: 12 }}>
      <span style={{ fontSize: 12.5, color: '#65706a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ display: 'flex', gap: 2, height: 26 }}>
        {report.emotions.filter((e) => mix[e] > 0).map((e) => (
          <span key={e} title={`${label} · ${LABEL[e]}: ${Math.round(mix[e] * 100)}%`}
            style={{ flex: mix[e], minWidth: 0, height: '100%', background: TONE[e].fill, borderRadius: 3 }} />
        ))}
      </span>
    </div>
  );
  return (
    <section style={{ ...card, padding: 18, minWidth: 0 }}>
      <span style={cardTitle}>Emotion mix</span>
      <p style={sectionNote}>Share of your turns by tone, next to the team average.</p>
      {row(who, person.mix)}
      {row('Team average', report.team.mix)}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 14 }}>
        {report.emotions.map((e) => (
          <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3a453e', whiteSpace: 'nowrap' }}>
            <LeafMark color={TONE[e].fill} w={13} h={7} />
            {LABEL[e]}
          </span>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ timeline

function Timeline({ report, person, onJump }: { report: MoodReport; person: PersonReport; onJump: (id: number) => void }) {
  const [hoverId, setHoverId] = useState<number | null>(null);
  const W = 520, H = 212, L = 56, R = 14, T = 16, B = 36;
  const dur = Math.max(report.team.duration_sec, 1);
  const x = (s: number) => L + (s / dur) * (W - L - R);
  const y = (v: number) => T + (1 - (v + 1) / 2) * (H - T - B);

  const turnById = useMemo(() => new Map(report.turns.map((t) => [t.id, t])), [report.turns]);
  const momentById = useMemo(() => new Map(person.moments.map((m) => [m.id, m])), [person.moments]);
  const step = dur > 600 ? 300 : 60;
  const ticks: number[] = [];
  for (let s = 0; s <= dur; s += step) ticks.push(s);

  const events = person.moments.filter((m) => m.cut_off || m.deflected_question);
  const hovered = hoverId == null ? null : momentById.get(hoverId) ?? null;
  const hoveredTurn = hoverId == null ? null : turnById.get(hoverId) ?? null;
  const axis = { fill: '#9aa29c', fontSize: 10.5, fontFamily: mono } as const;

  return (
    <section style={{ ...card, padding: 18, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <span style={cardTitle}>Mood across the meeting</span>
      <p style={sectionNote}>Each leaf is one thing you said. Above the line feels positive, below feels tense.</p>
      <div style={{ position: 'relative', marginTop: 12, borderRadius: 14, border: '1px solid #e7e5dc', overflow: 'hidden', background: 'linear-gradient(180deg, #e9f1ea 0%, #f3f1e6 66%, #e7ebda 100%)' }}>
        <CanvasBg motes={false} />
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Mood across the meeting" style={{ display: 'block', position: 'relative' }}>
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#cfd6cd" strokeWidth={1.5} />
          <text x={L - 8} y={y(0.8) + 4} textAnchor="end" {...axis}>positive</text>
          <text x={L - 8} y={y(0) + 4} textAnchor="end" {...axis}>neutral</text>
          <text x={L - 8} y={y(-0.8) + 4} textAnchor="end" {...axis}>tense</text>
          {ticks.map((s) => (
            <text key={s} x={x(s)} y={H - 12} textAnchor="middle" {...axis}>{mmss(s)}</text>
          ))}
          {events.map((m) => (
            <path key={`e${m.id}`} d={`M${x(m.t) - 5},${H - B + 12} L${x(m.t) + 5},${H - B + 12} L${x(m.t)},${H - B + 2} Z`}
              fill="#6f7196" opacity={0.85}>
              <title>{`${m.time} · ${m.cut_off ? 'You were cut off' : 'Your question was moved past'}`}</title>
            </path>
          ))}
          {person.timeline.length > 1 && (
            <path fill="none" stroke="#a8b0a8" strokeWidth={1.8}
              d={person.timeline.map((q, i) => `${i ? 'L' : 'M'}${x(q.t)},${y(q.valence)}`).join(' ')} />
          )}
          {person.timeline.map((q) => {
            const on = hoverId === q.id;
            return (
              <g key={q.id} transform={`translate(${x(q.t)}, ${y(q.valence)})`} style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverId(q.id)} onMouseLeave={() => setHoverId((h) => (h === q.id ? null : h))}
                onClick={() => onJump(q.id)}>
                <circle r={on ? 9 : 6} fill={TONE[q.emotion].fill} stroke="#fff" strokeWidth={2} style={{ transition: 'r .12s' }} />
              </g>
            );
          })}
        </svg>
        {hovered && hoveredTurn && (
          <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, padding: '9px 11px', borderRadius: 10, background: 'rgba(255,255,255,0.95)', border: '1px solid #e7e5dc', backdropFilter: 'blur(8px)', boxShadow: '0 6px 18px rgba(40,55,45,0.12)', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <ToneChip emotion={hovered.emotion} time={hovered.time} />
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.4, color: '#3a453e' }}>
              <Quoted text={hoveredTurn.text.slice(0, 140)} evidence={hovered.evidence} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------- tie-in with the trees

/** Mood Mirror's reason for existing inside Canopy: a tense yes is a leaf that is likely to wilt. */
function LinkedCommitments({ speaker, who, person, onOpen, motes }: {
  speaker: string; who: string; person: PersonReport; onOpen: (id: string) => void; motes: boolean;
}) {
  const owned = leavesFor(speaker);
  if (!owned.length) return null;

  const strain = person.moments.filter((m) => ['frustrated', 'anxious', 'confused', 'sad', 'angry'].includes(m.emotion)).length;
  const reasons = [
    strain > 0 ? `${strain} tense moment${strain === 1 ? '' : 's'}` : null,
    person.cut_offs > 0 ? `cut off ${person.cut_offs}×` : null,
    person.deflected_questions > 0 ? `${person.deflected_questions} question moved past` : null,
  ].filter(Boolean) as string[];

  return (
    <section style={{ ...card, padding: 0, overflow: 'hidden', flex: 'none' }}>
      <div style={{ position: 'relative', padding: 18, background: 'linear-gradient(180deg, #eef1f6 0%, #f6f5f1 100%)', borderBottom: '1px solid #eceae3' }}>
        <CanvasBg motes={motes} />
        <div style={{ position: 'relative' }}>
          <span style={cardTitle}>What {who} took on here</span>
          <p style={{ ...sectionNote, maxWidth: 620 }}>
            {reasons.length
              ? `This meeting carried ${reasons.join(', ')}. A yes given under strain is the kind of leaf that wilts, so Canopy watches these more closely.`
              : 'A steady meeting. These are the leaves that came out of it.'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {owned.map((l) => {
          const t = { g: TONE.happy, a: TONE.anxious, r: TONE.angry, d: TONE.neutral }[l.state];
          return (
            <button key={l.id} className="hov-soft" onClick={() => onOpen(l.id)}
              style={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid #f1f0ea', background: 'none', border: 'none', borderTopStyle: 'solid', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <LeafMark color={t.fill} w={16} h={9} />
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 13.5, color: '#1d2620', lineHeight: 1.35 }}>{l.title}</span>
                <span style={{ fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>
                  {WSN[l.limb[0]]} · due {l.due}{l.forWho ? ` · for ${l.forWho}` : ''}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: serif, fontSize: 20, color: t.text }}>{l.risk}%</span>
                <span style={{ fontSize: 11.5, color: '#8a948d' }}>slip risk</span>
                <span style={{ color: '#b4bcb6', fontSize: 15 }}>›</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
