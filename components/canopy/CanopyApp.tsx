'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AV, C, GROVE, LEAVES, MOVE_AT, PEOPLE, SCRIPT, SEEDS, type Leaf } from './data';
import { MorningBriefing, TalkButton, type BriefingItem } from './briefing';
import { CommitmentPanel, FollowThrough, UnownedDecisions } from './panels';
import { selData } from './selection';
import { CanvasBg, GroveTree, Orb, ProjectTree, Wave } from './trees';

const serif = "'Instrument Serif', serif";
const mono = "'Geist Mono', monospace";

export interface CanopyAppProps {
  motes?: boolean;
  leafLabels?: 'at-risk' | 'all' | 'none';
  showTour?: boolean;
}

type Screen = 'grove' | 'tree';

// The security review leaf changes once the voice agent has moved it.
const withVoiceEdits = (l: Leaf, secMoved: boolean): Leaf =>
  l.id === 'sec' && secMoved ? { ...l, state: 'a', due: 'Thu Oct 8', dueWas: 'Tue Oct 6', stateLabel: 'Slipped once', risk: 52 } : l;

export default function CanopyApp({ motes = true, leafLabels = 'at-risk', showTour = true }: CanopyAppProps) {
  const [vw, setVw] = useState<number | null>(null);
  const [screen, setScreen] = useState<Screen>('grove');
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [voice, setVoice] = useState(false);
  const [vt, setVt] = useState(0);
  const [secMoved, setSecMoved] = useState(false);
  const [planted, setPlanted] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const vTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (vTimer.current) clearInterval(vTimer.current);
    vTimer.current = null;
  };

  const openVoice = useCallback(() => {
    stopTimer();
    setScreen('tree');
    setVoice(true);
    setSel(null);
    setVt(0);
    setSecMoved(false);
    const start = performance.now();
    vTimer.current = setInterval(() => {
      const t = performance.now() - start;
      setVt(t);
      if (t >= MOVE_AT) setSecMoved(true);
      if (t > 11000) stopTimer();
    }, 50);
  }, []);

  const closeVoice = useCallback(() => {
    stopTimer();
    setVoice(false);
    setSecMoved((m) => m || vt >= MOVE_AT);
  }, [vt]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      stopTimer();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (/INPUT|TEXTAREA/.test(tag)) return;
      if (e.key === 'Escape') {
        if (voice) closeVoice();
        else if (sel) setSel(null);
      } else if ((e.key === 'v' || e.key === 'V') && !voice && !e.metaKey && !e.ctrlKey) openVoice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [voice, sel, closeVoice, openVoice]);

  const leaves = useMemo(() => LEAVES.map((l) => withVoiceEdits(l, secMoved)), [secMoved]);
  const onHover = useCallback((id: string | null) => setHover(id), []);
  const onSelect = useCallback((id: string) => setSel(id), []);

  if (vw === null) return null;

  const cnt = { g: 0, a: 0, r: 0 };
  leaves.forEach((l) => {
    if (l.state !== 'd') cnt[l.state]++;
  });
  const isTree = screen === 'tree';
  const selected = isTree ? selData(leaves, sel, secMoved) : null;
  const orphanCount = SEEDS.filter((x) => !planted[x.id]).length;
  const mid = vw >= 1180, wide = vw >= 1320;

  const vLines = SCRIPT.filter((l) => vt >= l.start).map((l) => {
    const n = Math.round(Math.min(1, (vt - l.start) / l.dur) * l.text.length);
    return { isYou: l.who === 'you', text: l.text.slice(0, n) };
  });
  const activeLine = SCRIPT.find((l) => vt >= l.start && vt < l.start + l.dur + 300);
  const vState = !voice ? 'idle' : activeLine ? (activeLine.who === 'you' ? 'listening' : 'speaking') : vt >= MOVE_AT ? 'done' : 'idle';
  const phase: 0 | 1 | 2 = !voice ? 0 : vt < 3000 ? 0 : vt < MOVE_AT ? 1 : 2;

  const goTree = () => { stopTimer(); setScreen('tree'); setSel(null); setVoice(false); };
  const goGrove = () => { stopTimer(); setScreen('grove'); setSel(null); setVoice(false); };
  const openLeaf = (id: string) => () => { stopTimer(); setScreen('tree'); setSel(id); setVoice(false); };
  const tourIdx = voice ? 3 : !isTree ? 0 : sel ? 2 : 1;
  const sec = leaves.find((l) => l.id === 'sec')!;

  const nav: [string, string, (() => void) | undefined, boolean][] = [
    ['The Grove', '42', goGrove, !isTree],
    ['My commitments', '6', openLeaf('budget'), false],
    ['Meetings', '14', undefined, false],
    ['People', '24', undefined, false],
    ['Sources', '3', undefined, false],
    ['Settings', '', undefined, false],
  ];
  const tour: [string, () => void][] = [['01 Grove', goGrove], ['02 Tree view', goTree], ['03 Commitment', openLeaf('quote')], ['04 Voice', openVoice]];
  const secLine = sec.state === 'a' ? 'Security review moved to Thursday' : 'Security review is due tomorrow';
  const seedLine = orphanCount === 0 ? 'Every decision has an owner' : `${orphanCount} decision${orphanCount === 1 ? '' : 's'} still need${orphanCount === 1 ? 's' : ''} an owner`;
  const briefingItems: BriefingItem[] = [
    { text: 'Budget sign-off is 3 days overdue', kind: 'overdue' },
    { text: secLine, kind: 'soon' },
    { text: seedLine, kind: 'seed' },
  ];
  const briefingScript = [
    'Good morning, Jordan. Here is your briefing for Monday, October 5th.',
    'First, what is overdue: your budget sign-off for Priya is three days late, and Lena followed up this morning.',
    sec.state === 'a'
      ? 'Your security review of Vendor A has moved to Thursday, and Priya has been told.'
      : 'Due tomorrow: the security review of Vendor A, also for Priya.',
    orphanCount > 0
      ? `This week, ${orphanCount === 1 ? 'one decision still needs' : `${orphanCount} decisions still need`} an owner, so take a minute to plant ${orphanCount === 1 ? 'it' : 'them'}.`
      : 'Every decision from this week has an owner.',
    'If you only do one thing today, sign off on the budget.',
  ].join(' ');
  const people = PEOPLE.map((p, i) => {
    const ratio = p[2] / p[3];
    return { name: p[0], init: p[1], bg: AV[i], ratio: p[2] + '/' + p[3], pct: Math.round(ratio * 100) + '%', bar: ratio >= 0.8 ? '#4f9d69' : ratio >= 0.6 ? '#9cbf5a' : '#e3a33b' };
  });

  const railShow = vw >= 1000 || !!selected;
  const headerStat = (n: number | string, color: string) => <span style={{ fontFamily: serif, fontSize: 24, color }}>{n}</span>;
  const statLabel = (s: string) => <span style={{ fontSize: 12.5, color: '#7a857e' }}>{s}</span>;
  const plainBtn = { display: 'flex', alignItems: 'baseline', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f3f2ec', color: '#1d2620', fontFamily: "'Geist', system-ui, sans-serif" }}>
      {mid && (
        <aside style={{ width: 212, flex: 'none', display: 'flex', flexDirection: 'column', gap: 22, padding: '20px 14px 16px', borderRight: '1px solid #e4e2d9', background: '#f8f7f2', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div style={{ padding: '0 8px' }}>
            <button onClick={goGrove} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <span style={{ width: 20, height: 20, borderRadius: '2px 100% 2px 100%', background: 'linear-gradient(135deg, #7cc58f, #2f6b4f)' }} />
              <span style={{ fontFamily: serif, fontSize: 28, lineHeight: 1, color: '#16211b' }}>Canopy</span>
            </button>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: '#7a857e', marginTop: 8 }}>From conversations to kept promises.</div>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {nav.map(([label, count, go, active]) => (
              <button key={label} onClick={go} className={active ? undefined : 'hov-nav'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, padding: '0 10px', borderRadius: 9, border: 'none', background: active ? '#e8eee6' : 'none', color: active ? '#1d3a2b' : '#4a554e', fontSize: 13.5, fontWeight: active ? 500 : 400, cursor: 'pointer', textAlign: 'left' }}>
                {label}
                <span style={{ fontFamily: mono, fontSize: 11, color: active ? '#5f7a69' : '#9aa29c' }}>{count}</span>
              </button>
            ))}
          </nav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9aa29c', padding: '0 10px 6px' }}>Projects</div>
            {GROVE.map((g) => (
              <button key={g.id} className="hov-nav" onClick={g.id === 'q4' ? goTree : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, padding: '6px 10px', borderRadius: 9, border: 'none', background: isTree && g.id === 'q4' ? '#e8eee6' : 'transparent', color: '#2b3630', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: g.health > 90 ? C.g : g.health > 75 ? '#9cbf5a' : C.a }} />
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>{g.name}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: '#8a948d' }}>{g.health}%</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {showTour && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 10, borderRadius: 12, border: '1px dashed #d8d6cc' }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9aa29c', padding: '0 4px 4px' }}>Demo tour</div>
              {tour.map(([label, go], i) => {
                const active = i === tourIdx;
                return (
                  <button key={label} onClick={go} className={active ? undefined : 'hov-tour'}
                    style={{ textAlign: 'left', background: active ? '#fff' : 'none', border: active ? '1px solid #e4e2d9' : '1px solid transparent', borderRadius: 7, padding: '5px 8px', fontFamily: mono, fontSize: 11, color: active ? '#1d2620' : '#7a857e', cursor: 'pointer' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', fontSize: 11.5, color: '#7a857e' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f9d69', boxShadow: '0 0 0 3px rgba(79,157,105,0.18)' }} />
            Meetings, chat, docs synced
          </div>
          <button className="hov-primary" style={{ height: 40, borderRadius: 11, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>+ New project</button>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 60, flex: 'none', display: 'flex', alignItems: 'center', gap: 20, padding: '0 24px', whiteSpace: 'nowrap' }}>
          {vw >= 1000 && (
            <div style={{ flex: 1, minWidth: 120, maxWidth: 380, height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: 10, background: '#fff', border: '1px solid #e4e2d9', color: '#9aa29c', fontSize: 13, overflow: 'hidden' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #9aa29c', flex: 'none' }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>Search commitments, people, quotes</span>
              <span style={{ fontFamily: mono, fontSize: 10.5, border: '1px solid #e4e2d9', borderRadius: 5, padding: '1px 5px' }}>⌘K</span>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {headerStat(42, '#16211b')}
              {statLabel(wide ? 'active commitments' : 'active')}
            </div>
            <button onClick={goTree} style={plainBtn}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e3a33b', alignSelf: 'center' }} />
              {headerStat(cnt.a + cnt.r + 2, '#a86d10')}
              {statLabel('at risk')}
            </button>
            <button onClick={goTree} style={plainBtn}>
              <span style={{ width: 6, height: 9, borderRadius: '50%', background: '#d4b25e', alignSelf: 'center' }} />
              {headerStat(orphanCount, '#8a6a1e')}
              {statLabel(wide ? 'orphaned decisions' : 'orphaned')}
            </button>
            <button onClick={openLeaf('quote')} style={plainBtn}>
              <span style={{ width: 7, height: 7, background: '#b9573a', transform: 'rotate(45deg)', alignSelf: 'center' }} />
              {headerStat(1, '#9c4529')}
              {statLabel('contradiction')}
            </button>
          </div>
        </header>

        {!isTree && (
          <div data-screen-label="01 The Grove" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '4px 24px 20px', gap: 16 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>The Grove · Monday, October 5</div>
              <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 'clamp(28px, 5vh, 40px)', lineHeight: 1.05, margin: '6px 0 4px', color: '#16211b' }}>Good morning, Jordan.</h1>
              <div style={{ fontSize: 14, color: '#65706a' }}>Three projects, forty-two promises. A fuller canopy means a healthier project.</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 18, border: '1px solid #e4e2d9', overflow: 'hidden', background: 'linear-gradient(180deg, #e9f1ea 0%, #f3f1e6 64%, #e7ebda 100%)' }}>
              <CanvasBg motes={motes} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gridTemplateRows: 'minmax(0,1fr)', gap: 16, padding: '20px 24px' }}>
                {GROVE.map((g) => {
                  const c = g.id === 'q4' ? { g: cnt.g, a: cnt.a, r: cnt.r, f: 3 } : { g: g.g, a: g.a, r: g.r, f: g.f };
                  const hero = g.id === 'q4';
                  return (
                    <div key={g.id} className="hov-grove" onClick={hero ? goTree : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0, cursor: 'pointer', borderRadius: 14, transition: 'background .25s' }}>
                      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <GroveTree gd={g} cnt={c} />
                      </div>
                      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '12px 0 6px', textAlign: 'center' }}>
                        <div style={{ fontFamily: serif, fontSize: 'clamp(20px, 2.2vw, 26px)', lineHeight: 1.05, color: '#16211b' }}>{g.name}</div>
                        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#65706a', whiteSpace: 'nowrap' }}>{g.health}% healthy</div>
                        <div style={{ display: 'flex', gap: 12, fontFamily: mono, fontSize: 11.5, color: '#4a554e' }}>
                          {([[C.g, c.g], [C.a, c.a], [C.r, c.r], [C.d, c.f]] as const).map(([col, n], i) => (
                            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: col }} />
                              {n}
                            </span>
                          ))}
                        </div>
                        {hero ? (
                          <span style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: '#fff', background: '#2f6b4f', borderRadius: 15, padding: '6px 14px' }}>Open tree →</span>
                        ) : (
                          <span style={{ marginTop: 2, fontSize: 12, color: '#8a948d', padding: '6px 0' }}>{g.sync}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {isTree && (
          <div data-screen-label="02 Tree view" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#8a948d' }}>
              <button className="hov-crumb" onClick={goGrove} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#65706a' }}>The Grove</button>
              <span>›</span>
              <span style={{ color: '#2b3630' }}>Q4 Vendor Migration</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: '#e5efe6', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: 18, height: 18, borderRadius: '2px 100% 2px 100%', background: 'linear-gradient(135deg, #7cc58f, #2f6b4f)' }} />
              </span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 'clamp(26px, 4.4vh, 36px)', lineHeight: 1, margin: 0, color: '#16211b' }}>Q4 Vendor Migration</h1>
                <div style={{ fontSize: 12.5, color: '#7a857e', marginTop: 5 }}>16 active · {cnt.a + cnt.r} at risk · 3 dropped · Updated from Fri doc comment, 2h ago</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {PEOPLE.map((p, i) => (
                  <span key={p[1]} style={{ width: 30, height: 30, marginLeft: -7, borderRadius: '50%', background: AV[i], border: '2px solid #f3f2ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, color: '#2b3630' }}>{p[1]}</span>
                ))}
                <span style={{ marginLeft: 6, fontSize: 12, color: '#7a857e' }}>+2</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 12, borderBottom: '1px solid #e4e2d9', fontSize: 13 }}>
              <span style={{ padding: '9px 0', borderBottom: '2px solid #2f6b4f', marginBottom: -1, color: '#1d3a2b', fontWeight: 500 }}>Tree view</span>
              <span style={{ padding: '9px 0', color: '#7a857e' }}>List</span>
              <span style={{ padding: '9px 0', color: '#7a857e' }}>Sources</span>
              <span style={{ padding: '9px 0', color: '#7a857e' }}>Timeline</span>
              <button className="hov-contra" onClick={openLeaf('quote')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#fbf1ec', border: '1px solid #efd3c6', borderRadius: 14, padding: '4px 11px', fontSize: 12, color: '#9c4529', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, background: '#b9573a', transform: 'rotate(45deg)' }} />
                Vendor A or B? 1 contradiction
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', marginTop: 14, borderRadius: 18, border: '1px solid #e4e2d9', overflow: 'hidden', background: 'linear-gradient(180deg, #e9f1ea 0%, #f3f1e6 66%, #e7ebda 100%)' }}>
              <CanvasBg motes={motes} />
              <div onClick={() => setSel(null)} style={{ position: 'absolute', inset: 0, transition: 'transform .45s cubic-bezier(.2,.7,.2,1)', transform: `scale(${zoom})` }}>
                <ProjectTree leaves={leaves} sel={sel} hover={hover} secMoved={secMoved} phase={phase} mode={leafLabels} onSelect={onSelect} onHover={onHover} />
              </div>
              {!selected && (
                <div style={{ position: 'absolute', left: 14, top: 14, zIndex: 5, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.86)', border: '1px solid #e7e5dc', backdropFilter: 'blur(8px)', fontSize: 12, color: '#3a453e' }}>
                  {([[C.g, 'On track', cnt.g, 0], [C.a, 'Slipping', cnt.a, 0], [C.r, 'Overdue', cnt.r, 0], [C.d, 'Dropped', 3, 150]] as const).map(([col, label, n, rot]) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 15, height: 8, borderRadius: '0 100% 0 100%', background: col, transform: rot ? `rotate(${rot}deg)` : undefined }} />
                      {label}
                      <span style={{ fontFamily: mono, color: '#8a948d' }}>{n}</span>
                    </span>
                  ))}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 15, height: 2, background: '#2f9e8f' }} />
                    Dependency
                  </span>
                </div>
              )}
              <div style={{ position: 'absolute', right: 14, bottom: 14, zIndex: 5, display: 'flex', flexDirection: 'column', borderRadius: 11, background: 'rgba(255,255,255,0.9)', border: '1px solid #e7e5dc', overflow: 'hidden' }}>
                <button className="hov-zoom" onClick={() => setZoom((z) => Math.min(1.8, +(z * 1.2).toFixed(2)))} style={{ width: 34, height: 34, border: 'none', background: 'none', fontSize: 17, color: '#3a453e', cursor: 'pointer' }}>+</button>
                <button className="hov-zoom" onClick={() => setZoom((z) => Math.max(0.6, +(z / 1.2).toFixed(2)))} style={{ width: 34, height: 34, border: 'none', borderTop: '1px solid #eeede6', background: 'none', fontSize: 17, color: '#3a453e', cursor: 'pointer' }}>−</button>
                <button className="hov-zoom" onClick={() => setZoom(1)} style={{ width: 34, height: 34, border: 'none', borderTop: '1px solid #eeede6', background: 'none', fontFamily: mono, fontSize: 9.5, color: '#3a453e', cursor: 'pointer' }}>FIT</button>
              </div>

              {voice && (
                <>
                  <div onClick={closeVoice} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'linear-gradient(180deg, rgba(243,242,236,0) 35%, rgba(243,242,236,0.75))' }} />
                  <div data-screen-label="04 Voice agent" style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', width: 'min(660px, calc(100% - 32px))', zIndex: 21, display: 'grid', gridTemplateColumns: '128px minmax(0,1fr)', gap: 22, alignItems: 'center', padding: '20px 22px 20px 16px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(18px)', border: '1px solid #e4e2d9', borderRadius: 20, boxShadow: '0 24px 60px rgba(40,55,45,0.18)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                      <Orb state={vState} size={104} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 14 }}>
                        {vState === 'listening' && <Wave />}
                        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2f8a77' }}>
                          {vState === 'listening' ? 'Listening' : vState === 'speaking' ? 'Speaking' : vState === 'done' ? 'Updated' : 'Ready'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>Canopy voice · live transcript</span>
                        <button onClick={closeVoice} style={{ background: 'none', border: '1px solid #e4e2d9', borderRadius: 7, padding: '3px 8px', fontFamily: mono, fontSize: 10, color: '#7a857e', cursor: 'pointer' }}>ESC</button>
                      </div>
                      {vLines.map((l, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '54px minmax(0,1fr)', gap: 12, alignItems: 'baseline' }}>
                          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: l.isYou ? '#8a948d' : '#2f8a77' }}>{l.isYou ? 'You' : 'Canopy'}</span>
                          {l.isYou ? (
                            <span style={{ fontSize: 15, lineHeight: 1.45, color: '#4a554e' }}>{l.text}</span>
                          ) : (
                            <span style={{ fontFamily: serif, fontSize: 21, lineHeight: 1.28, color: '#16211b', textWrap: 'pretty' }}>{l.text}</span>
                          )}
                        </div>
                      ))}
                      {vt >= MOVE_AT + 400 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8a5a0c', background: '#fdf3e1', border: '1px solid #f1d9a8', borderRadius: 12, padding: '4px 11px' }}>
                            <span style={{ width: 12, height: 7, borderRadius: '0 100% 0 100%', background: '#e3a33b' }} />
                            Security review · Tue Oct 6 → Thu Oct 8 · Priya notified
                          </span>
                          <button onClick={openVoice} style={{ marginLeft: 'auto', background: '#fff', border: '1px solid #dcdad0', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#3a453e', cursor: 'pointer' }}>Replay</button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {railShow && (
        <aside style={{ width: vw >= 1320 ? 372 : 330, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: selected ? '14px 16px 16px 0' : '14px 16px 104px 0', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' }}>
          {selected ? (
            <CommitmentPanel sel={selected} nudged={!!nudged[selected.id]} onClose={() => setSel(null)} onNudge={() => setNudged((n) => ({ ...n, [selected.id]: true }))} />
          ) : (
            <>
              <MorningBriefing dateLabel="Mon Oct 5" items={briefingItems} script={briefingScript} />
              <UnownedDecisions planted={planted} picking={picking} orphanCount={orphanCount} onPlant={setPicking}
                onPick={(id, name) => { setPlanted((p) => ({ ...p, [id]: name })); setPicking(null); }} />
              <FollowThrough people={people} />
            </>
          )}
        </aside>
      )}

      {/* Hidden while the voice panel is open, and while a commitment is open so it doesn't cover the panel's action buttons. */}
      {!voice && !selected && <TalkButton onClick={openVoice} />}
    </div>
  );
}
