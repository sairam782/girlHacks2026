'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AV, C, initials, type GroveProject } from './data';
import { AskCanopy, BranchNotes, CommitmentPanel, FollowThrough, UnownedDecisions } from './panels';
import { CanvasBg, GroveTree, ProjectTree } from './trees';
import { BriefingDock, IngestModal, ListView, NewProjectModal, SourcesView, TimelineView } from './views';
import { addDays, diffDays, fmt, fmtLong } from '@/lib/dates';
import type { History } from '@/lib/history';
import type { AppState, CommitmentEvent } from '@/lib/types';
import { followThrough, isSeed, layoutTree, projectHealth, viewItems, type VItem } from '@/lib/view';

const serif = "'Instrument Serif', serif";
const mono = "'Geist Mono', monospace";

export interface CanopyAppProps {
  motes?: boolean;
  leafLabels?: 'at-risk' | 'all' | 'none';
}

type Screen = 'grove' | 'tree';
type Tab = 'tree' | 'list' | 'sources' | 'timeline';
type Data = AppState & { today: string; engines: { gemini: boolean; elevenlabs: boolean; tiger: boolean } };

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const safe = (fn: () => void) => { try { fn(); } catch { /* storage unavailable */ } };

export default function CanopyApp({ motes = true, leafLabels = 'at-risk' }: CanopyAppProps) {
  const [vw, setVw] = useState<number | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [screen, setScreen] = useState<Screen>('grove');
  const [tab, setTab] = useState<Tab>('tree');
  const [pid, setPid] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [voice, setVoice] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [ingest, setIngest] = useState(false);
  const [newProj, setNewProj] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [toast, setToast] = useState('');
  const [hist, setHist] = useState<(History & { events: CommitmentEvent[] }) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) throw new Error('Could not load');
      setData(await r.json());
      setLoadErr('');
    } catch (e) { setLoadErr((e as Error).message); }
  }, []);

  useEffect(() => {
    refresh();
    safe(() => setViewer(localStorage.getItem('canopy.viewer')));
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [refresh]);

  const asof = data ? addDays(data.today, offset) : '';
  const project = data?.projects.find((p) => p.id === pid) ?? null;
  const me = data?.people.find((p) => p.id === viewer) ?? data?.people[0] ?? null;

  useEffect(() => {
    if (!project || tab !== 'timeline') return;
    let dead = false;
    fetch(`/api/history?projectId=${project.id}&asof=${asof}`, { cache: 'no-store' }).then((r) => r.json()).then((h) => { if (!dead) setHist(h); });
    return () => { dead = true; };
  }, [project, tab, asof, data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const perProject = useMemo(() => {
    if (!data) return [];
    return data.projects.map((p) => { const vs = viewItems(data, p.id, asof); return { p, vs, h: projectHealth(vs) }; });
  }, [data, asof]);
  const cur = perProject.find((x) => x.p.id === pid) ?? null;
  const vs: VItem[] = cur?.vs ?? [];
  const tree = useMemo(() => layoutTree(vs), [vs]);

  // What the viewer owes: overdue plus anything due in the next 7 days, across projects.
  const owe = useMemo(() => {
    if (!me) return [];
    return perProject.flatMap(({ p, vs: list }) => list.filter((v) => v.it.owner_id === me.id && v.it.type === 'action' && v.it.status === 'open' && v.it.deadline && diffDays(asof, v.it.deadline) <= 7).map((v) => ({ v, p })))
      .sort((a, b) => a.v.it.deadline!.localeCompare(b.v.it.deadline!));
  }, [perProject, me, asof]);

  const openLeaf = useCallback((projectId: string, id: string | null) => { setPid(projectId); setScreen('tree'); setTab('tree'); setSel(id); setVoice(false); }, []);
  const goGrove = () => { setScreen('grove'); setSel(null); setVoice(false); };
  const openProject = (id: string) => { setPid(id); setScreen('tree'); setTab('tree'); setSel(null); setVoice(false); };
  const openVoice = useCallback(() => { if (!me) { setToast('Add a source first so Canopy knows who is on the team.'); return; } setVoice(true); setSel(null); }, [me]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement | null)?.tagName ?? '')) return;
      if (e.key === 'Escape') { if (voice) setVoice(false); else if (sel) setSel(null); }
      else if ((e.key === 'v' || e.key === 'V') && !voice && !e.metaKey && !e.ctrlKey) openVoice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [voice, sel, openVoice]);

  const onHover = useCallback((id: string | null) => setHover(id), []);
  const onSelect = useCallback((id: string) => setSel(id), []);

  const patch = useCallback(async (id: string, body: Record<string, unknown>) => {
    const r = await fetch(`/api/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) setToast((await r.json()).error || 'Could not save');
    await refresh();
  }, [refresh]);

  const createProject = async (name: string) => {
    const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const p = await r.json();
    setNewProj(false);
    await refresh();
    if (r.ok) { setPid(p.id); setScreen('tree'); setSel(null); setIngest(true); }
  };

  if (vw === null || (!data && !loadErr)) return null;
  if (!data) return <div style={{ padding: 40, fontFamily: 'system-ui', color: '#9c4529' }}>Canopy could not reach its API: {loadErr}</div>;

  const isTree = screen === 'tree' && !!project;
  const selected = isTree && sel ? vs.find((v) => v.it.id === sel) ?? null : null;
  const seeds = vs.filter(isSeed);
  const decisions = vs.filter((v) => v.it.type === 'decision' && v.owner && v.it.status === 'open');
  const allSeeds = perProject.reduce((n, x) => n + x.vs.filter(isSeed).length, 0);
  const totals = perProject.reduce((a, x) => ({ g: a.g + x.h.g, a: a.a + x.h.a, r: a.r + x.h.r, d: a.d + x.h.d, open: a.open + x.h.open }), { g: 0, a: 0, r: 0, d: 0, open: 0 });
  const mid = vw >= 1180, wide = vw >= 1320;
  const railShow = vw >= 1000 || !!selected;
  const stats = followThrough(data, asof).map((s, i) => {
    const ratio = s.kept / s.total;
    return { name: s.name, init: initials(s.name), bg: AV[i % AV.length], ratio: `${s.kept}/${s.total}`, pct: Math.round(ratio * 100) + '%', bar: ratio >= 0.8 ? '#4f9d69' : ratio >= 0.6 ? '#9cbf5a' : '#e3a33b' };
  });
  const highlight = new Set(voice ? owe.filter((o) => o.p.id === pid).map((o) => o.v.it.id) : []);
  const grove: GroveProject[] = perProject.map(({ p, h }, i) => ({ id: p.id, name: p.name, health: h.health, seed: 5 + (hash(p.id) % 40), h: 345, foliage: 20 + Math.min(120, h.open * 6), slot: i % 3 }));
  const owners = [...new Set(vs.filter((v) => v.owner && v.d.state !== 'x').map((v) => v.owner!))];

  const headerStat = (n: number | string, color: string) => <span style={{ fontFamily: serif, fontSize: 24, color }}>{n}</span>;
  const statLabel = (s: string) => <span style={{ fontSize: 12.5, color: '#7a857e' }}>{s}</span>;
  const plainBtn = { display: 'flex', alignItems: 'baseline', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' } as const;
  const nav: [string, string | number, (() => void) | undefined, boolean][] = [
    ['The Grove', data.projects.length, goGrove, !isTree],
    ['Add a source', '', data.projects.length ? () => setIngest(true) : () => setNewProj(true), false],
    ['Sources', data.sources.length, project ? () => { setTab('sources'); setScreen('tree'); } : undefined, false],
    ['People', data.people.length, undefined, false],
  ];
  const selectStyle = { height: 30, borderRadius: 8, border: '1px solid #e4e2d9', background: '#fff', fontSize: 12.5, color: '#2b3630', padding: '0 6px', fontFamily: 'inherit' } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f3f2ec', color: '#1d2620', fontFamily: "'Geist', system-ui, sans-serif" }}>
      {mid && (
        <aside style={{ width: 212, flex: 'none', display: 'flex', flexDirection: 'column', gap: 22, padding: '20px 14px 16px', borderRight: '1px solid #e4e2d9', background: '#f8f7f2', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div style={{ padding: '0 8px' }}>
            <button onClick={goGrove} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <span style={{ width: 20, height: 20, borderRadius: '2px 100% 2px 100%', background: 'linear-gradient(135deg, #7cc58f, #2f6b4f)' }} />
              <span style={{ fontFamily: serif, fontSize: 28, lineHeight: 1, color: '#16211b' }}>Canopy</span>
            </button>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: '#7a857e', marginTop: 8 }}>Meetings end. Commitments should not.</div>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {nav.map(([label, count, go, active]) => (
              <button key={label} onClick={go} className={active || !go ? undefined : 'hov-nav'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, padding: '0 10px', borderRadius: 9, border: 'none', background: active ? '#e8eee6' : 'none', color: active ? '#1d3a2b' : go ? '#4a554e' : '#9aa29c', fontSize: 13.5, fontWeight: active ? 500 : 400, cursor: go ? 'pointer' : 'default', textAlign: 'left' }}>
                {label}
                <span style={{ fontFamily: mono, fontSize: 11, color: active ? '#5f7a69' : '#9aa29c' }}>{count}</span>
              </button>
            ))}
          </nav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9aa29c', padding: '0 10px 6px' }}>Projects</div>
            {perProject.map(({ p, h }) => (
              <button key={p.id} className="hov-nav" onClick={() => openProject(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, padding: '6px 10px', borderRadius: 9, border: 'none', background: isTree && pid === p.id ? '#e8eee6' : 'transparent', color: '#2b3630', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: h.health > 90 ? C.g : h.health > 75 ? '#9cbf5a' : C.a }} />
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>{p.name}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: '#8a948d' }}>{h.health}%</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, border: '1px dashed #d8d6cc' }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9aa29c' }}>Time travel</div>
            <div style={{ fontSize: 12, color: '#4a554e' }}>{fmt(asof)}{offset ? ` (${offset > 0 ? '+' : ''}${offset}d)` : ' · today'}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[-1, 1, 3].map((n) => <button key={n} onClick={() => setOffset((o) => o + n)} style={{ flex: 1, height: 26, borderRadius: 7, border: '1px solid #e4e2d9', background: '#fff', fontFamily: mono, fontSize: 11, cursor: 'pointer' }}>{n > 0 ? '+' : ''}{n}d</button>)}
              <button onClick={() => setOffset(0)} disabled={!offset} style={{ flex: 1, height: 26, borderRadius: 7, border: '1px solid #e4e2d9', background: '#fff', fontFamily: mono, fontSize: 11, cursor: 'pointer', opacity: offset ? 1 : 0.4 }}>0</button>
            </div>
            <div style={{ fontSize: 11, color: '#8a948d', lineHeight: 1.35 }}>Jump ahead to watch leaves yellow and wilt.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px', fontSize: 11.5, color: '#7a857e' }}>
            {([['Gemini', data.engines.gemini, 'extraction'], ['ElevenLabs', data.engines.elevenlabs, 'voice'], ['Tiger Data', data.engines.tiger, 'history']] as const).map(([n, on, role]) => (
              <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#4f9d69' : '#c9c7bb', boxShadow: on ? '0 0 0 3px rgba(79,157,105,0.18)' : undefined }} />
                {n} <span style={{ color: '#a9afa9' }}>{on ? role : 'fallback'}</span>
              </span>
            ))}
          </div>
          <button className="hov-primary" onClick={() => setNewProj(true)} style={{ height: 40, borderRadius: 11, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>+ New project</button>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 60, flex: 'none', display: 'flex', alignItems: 'center', gap: 20, padding: '0 24px', whiteSpace: 'nowrap' }}>
          {!mid && <button onClick={goGrove} style={{ background: 'none', border: 'none', fontFamily: serif, fontSize: 24, cursor: 'pointer', color: '#16211b' }}>Canopy</button>}
          <button className="hov-primary" onClick={() => (data.projects.length ? setIngest(true) : setNewProj(true))} style={{ height: 34, padding: '0 14px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Paste a transcript</button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
            {data.people.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a857e' }}>
                Viewing as
                <select value={me?.id ?? ''} onChange={(e) => { setViewer(e.target.value); safe(() => localStorage.setItem('canopy.viewer', e.target.value)); }} style={selectStyle}>
                  {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {headerStat(totals.open, '#16211b')}
              {statLabel(wide ? 'active commitments' : 'active')}
            </div>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e3a33b', alignSelf: 'center' }} />
              {headerStat(totals.a + totals.r + totals.d, '#a86d10')}
              {statLabel('at risk')}
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ width: 6, height: 9, borderRadius: '50%', background: '#d4b25e', alignSelf: 'center' }} />
              {headerStat(allSeeds, '#8a6a1e')}
              {statLabel(wide ? 'orphaned decisions' : 'orphaned')}
            </span>
          </div>
        </header>

        {!isTree && (
          <div data-screen-label="01 The Grove" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '4px 24px 20px', gap: 16 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>The Grove · {fmtLong(asof)}</div>
              <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 'clamp(28px, 5vh, 40px)', lineHeight: 1.05, margin: '6px 0 4px', color: '#16211b' }}>{me ? `Good morning, ${me.name.split(' ')[0]}.` : 'Welcome to Canopy.'}</h1>
              <div style={{ fontSize: 14, color: '#65706a' }}>{data.projects.length ? `${data.projects.length} project${data.projects.length > 1 ? 's' : ''}, ${totals.open} open promise${totals.open === 1 ? '' : 's'}. A fuller canopy means a healthier project.` : 'Paste a meeting transcript and watch your first tree grow.'}</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 18, border: '1px solid #e4e2d9', overflow: 'hidden', background: 'linear-gradient(180deg, #e9f1ea 0%, #f3f1e6 64%, #e7ebda 100%)' }}>
              <CanvasBg motes={motes} />
              {data.projects.length === 0 ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 24 }}>
                  <div style={{ fontFamily: serif, fontSize: 34, color: '#16211b' }}>No trees yet</div>
                  <div style={{ fontSize: 14, color: '#65706a', maxWidth: 420, lineHeight: 1.5 }}>Create a project, then paste a transcript, chat thread, or doc. Every decision, owner, and deadline becomes a leaf.</div>
                  <button className="hov-primary" onClick={() => setNewProj(true)} style={{ height: 42, padding: '0 20px', borderRadius: 12, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Plant your first project</button>
                </div>
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.min(grove.length, 3)}, minmax(0,1fr))`, gridAutoRows: 'minmax(0,1fr)', gap: 16, padding: '20px 24px', overflowY: 'auto' }}>
                  {grove.map((g, i) => {
                    const h = perProject[i].h;
                    const c = { g: h.g, a: h.a, r: h.r, f: h.d };
                    return (
                      <div key={g.id} className="hov-grove" onClick={() => openProject(g.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 360, cursor: 'pointer', borderRadius: 14, transition: 'background .25s' }}>
                        <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                          <GroveTree gd={g} cnt={c} />
                        </div>
                        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '12px 0 6px', textAlign: 'center' }}>
                          <div style={{ fontFamily: serif, fontSize: 'clamp(20px, 2.2vw, 26px)', lineHeight: 1.05, color: '#16211b' }}>{g.name}</div>
                          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#65706a', whiteSpace: 'nowrap' }}>{g.health}% healthy</div>
                          <div style={{ display: 'flex', gap: 12, fontFamily: mono, fontSize: 11.5, color: '#4a554e' }}>
                            {([[C.g, c.g], [C.a, c.a], [C.r, c.r], [C.d, c.f]] as const).map(([col, n], k) => (
                              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: col }} />
                                {n}
                              </span>
                            ))}
                          </div>
                          <span style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: '#fff', background: '#2f6b4f', borderRadius: 15, padding: '6px 14px' }}>Open tree →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {isTree && project && cur && (
          <div data-screen-label="02 Tree view" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#8a948d' }}>
              <button className="hov-crumb" onClick={goGrove} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#65706a' }}>The Grove</button>
              <span>›</span>
              <span style={{ color: '#2b3630' }}>{project.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: '#e5efe6', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: 18, height: 18, borderRadius: '2px 100% 2px 100%', background: 'linear-gradient(135deg, #7cc58f, #2f6b4f)' }} />
              </span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 'clamp(26px, 4.4vh, 36px)', lineHeight: 1, margin: 0, color: '#16211b' }}>{project.name}</h1>
                <div style={{ fontSize: 12.5, color: '#7a857e', marginTop: 5 }}>{cur.h.open} active · {cur.h.a + cur.h.r + cur.h.d} at risk · {cur.h.d} fallen · {cur.h.done} bloomed{tree.hidden ? ` · ${tree.hidden} more in List` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {owners.slice(0, 6).map((n, i) => (
                  <span key={n} title={n} style={{ width: 30, height: 30, marginLeft: -7, borderRadius: '50%', background: AV[i % AV.length], border: '2px solid #f3f2ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, color: '#2b3630' }}>{initials(n)}</span>
                ))}
                {owners.length > 6 && <span style={{ marginLeft: 6, fontSize: 12, color: '#7a857e' }}>+{owners.length - 6}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 12, borderBottom: '1px solid #e4e2d9', fontSize: 13 }}>
              {([['tree', 'Tree view'], ['list', 'List'], ['sources', 'Sources'], ['timeline', 'Timeline']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '9px 0', background: 'none', border: 'none', borderBottom: tab === k ? '2px solid #2f6b4f' : '2px solid transparent', marginBottom: -1, color: tab === k ? '#1d3a2b' : '#7a857e', fontWeight: tab === k ? 500 : 400, cursor: 'pointer', fontSize: 13 }}>{l}</button>
              ))}
            </div>

            {tab === 'list' && <ListView items={vs} sel={sel} onSelect={onSelect} />}
            {tab === 'sources' && <SourcesView sources={data.sources.filter((s) => s.project_id === project.id)} items={vs} />}
            {tab === 'timeline' && <TimelineView hist={hist} items={vs} />}
            {tab === 'tree' && (
              <div style={{ flex: 1, minHeight: 0, position: 'relative', marginTop: 14, borderRadius: 18, border: '1px solid #e4e2d9', overflow: 'hidden', background: 'linear-gradient(180deg, #e9f1ea 0%, #f3f1e6 66%, #e7ebda 100%)' }}>
                <CanvasBg motes={motes} />
                <div onClick={() => setSel(null)} style={{ position: 'absolute', inset: 0, transition: 'transform .45s cubic-bezier(.2,.7,.2,1)', transform: `scale(${zoom})` }}>
                  <ProjectTree leaves={tree.leaves} fallen={tree.fallen} branches={tree.branches} highlight={highlight} sel={sel} hover={hover} mode={tree.leaves.length > 6 && leafLabels === 'at-risk' ? 'none' : leafLabels} onSelect={onSelect} onHover={onHover} />
                </div>
                {tree.leaves.length === 0 && tree.fallen.length === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ pointerEvents: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.8)', padding: 24, borderRadius: 16 }}>
                      <div style={{ fontFamily: serif, fontSize: 26 }}>A bare trunk</div>
                      <div style={{ fontSize: 13, color: '#65706a' }}>Paste a transcript and leaves will appear.</div>
                      <button className="hov-primary" onClick={() => setIngest(true)} style={{ height: 36, padding: '0 16px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Add a source</button>
                    </div>
                  </div>
                )}
                {!selected && (
                  <div style={{ position: 'absolute', left: 14, top: 14, zIndex: 5, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.86)', border: '1px solid #e7e5dc', backdropFilter: 'blur(8px)', fontSize: 12, color: '#3a453e' }}>
                    {([[C.g, 'Green · due 4+ days', cur.h.g, 0], [C.a, 'Yellow · due in 3 days', cur.h.a, 0], [C.r, 'Wilting · 1-2 days late', cur.h.r, 0], [C.d, 'Fallen · 3+ days late', cur.h.d, 150]] as const).map(([col, l, n, rot]) => (
                      <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 15, height: 8, borderRadius: '0 100% 0 100%', background: col, transform: rot ? `rotate(${rot}deg)` : undefined }} />
                        {l}
                        <span style={{ fontFamily: mono, color: '#8a948d' }}>{n}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: 'absolute', right: 14, bottom: 14, zIndex: 5, display: 'flex', flexDirection: 'column', borderRadius: 11, background: 'rgba(255,255,255,0.9)', border: '1px solid #e7e5dc', overflow: 'hidden' }}>
                  <button className="hov-zoom" onClick={() => setZoom((z) => Math.min(1.8, +(z * 1.2).toFixed(2)))} style={{ width: 34, height: 34, border: 'none', background: 'none', fontSize: 17, color: '#3a453e', cursor: 'pointer' }}>+</button>
                  <button className="hov-zoom" onClick={() => setZoom((z) => Math.max(0.6, +(z / 1.2).toFixed(2)))} style={{ width: 34, height: 34, border: 'none', borderTop: '1px solid #eeede6', background: 'none', fontSize: 17, color: '#3a453e', cursor: 'pointer' }}>−</button>
                  <button className="hov-zoom" onClick={() => setZoom(1)} style={{ width: 34, height: 34, border: 'none', borderTop: '1px solid #eeede6', background: 'none', fontFamily: mono, fontSize: 9.5, color: '#3a453e', cursor: 'pointer' }}>FIT</button>
                </div>
                {voice && me && <BriefingDock personId={me.id} personName={me.name} asof={asof} onClose={() => setVoice(false)} />}
              </div>
            )}
          </div>
        )}
        {voice && me && !isTree && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}><div style={{ position: 'absolute', inset: 0 }}><BriefingDock personId={me.id} personName={me.name} asof={asof} onClose={() => setVoice(false)} /></div></div>
        )}
        {voice && me && isTree && tab !== 'tree' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}><div style={{ position: 'absolute', inset: 0 }}><BriefingDock personId={me.id} personName={me.name} asof={asof} onClose={() => setVoice(false)} /></div></div>
        )}
      </div>

      {railShow && (
        <aside style={{ width: wide ? 372 : 330, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 16px 0', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' }}>
          {selected ? (
            <CommitmentPanel key={selected.it.id + selected.events.length} v={selected} source={data.sources.find((s) => s.id === selected.it.source_id)} people={data.people} onClose={() => setSel(null)} onPatch={patch} />
          ) : (
            <>
              {me && (
                <AskCanopy who={me.name} openVoice={openVoice}
                  owe={owe.map(({ v, p }) => ({ id: v.it.id, title: v.it.text, sub: `${v.d.label} · ${p.name}`, state: v.d.state === 'x' ? 'g' : v.d.state, go: () => openLeaf(p.id, v.it.id) }))} />
              )}
              <UnownedDecisions seeds={seeds} people={data.people} onPlant={(id, owner) => patch(id, { owner, type: 'action' })} />
              <BranchNotes decisions={decisions} sources={data.sources} />
              <FollowThrough people={stats} />
              {!me && !seeds.length && <div style={{ fontSize: 12.5, color: '#8a948d', padding: 8 }}>Your briefing, unowned decisions, and follow-through show up here once a source is added.</div>}
            </>
          )}
        </aside>
      )}

      {ingest && data.projects.length > 0 && (
        <IngestModal projects={data.projects} projectId={pid} onClose={() => setIngest(false)}
          onDone={async (r) => { setIngest(false); await refresh(); openProject(r.projectId); setToast(`Extracted ${r.n} item${r.n === 1 ? '' : 's'} with ${r.engine === 'gemini' ? 'Gemini' : 'built-in rules'}.${r.note ? ' ' + r.note : ''}`); }} />
      )}
      {newProj && <NewProjectModal onClose={() => setNewProj(false)} onCreate={createProject} />}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 60, background: '#16211b', color: '#fff', fontSize: 13, padding: '10px 16px', borderRadius: 12, maxWidth: 'min(560px, calc(100% - 32px))', boxShadow: '0 12px 30px rgba(0,0,0,0.25)' }}>{toast}</div>
      )}
    </div>
  );
}
