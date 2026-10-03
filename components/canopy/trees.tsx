'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { BARK, C, CT, LIMBS, WS_LABEL, initials, type FallenLeaf, type Leaf, type LeafState, type LabelPos, type GroveProject } from './data';
import { bz, bzd, f1, leafD, leafTop, place, rng, taper, tint, type Curve, type Placement } from './geometry';

const shadowFilter = (id: string, sd: number, op: number) => (
  <filter key={id} id={id} x="-40%" y="-40%" width="180%" height="200%">
    <feDropShadow dx={0} dy={1.5} stdDeviation={sd} floodColor="#283a2e" floodOpacity={op} />
  </filter>
);
const blurFilter = (id: string, sd: number) => (
  <filter key={id} id={id} x="-20%" y="-200%" width="140%" height="500%">
    <feGaussianBlur stdDeviation={sd} />
  </filter>
);
const barkGrad = (id: string) => (
  <linearGradient key={id} id={id} x1={0} x2={1} y1={0} y2={0}>
    <stop offset="0%" stopColor="#a5835f" />
    <stop offset="55%" stopColor="#7a5a3f" />
    <stop offset="100%" stopColor="#5c432f" />
  </linearGradient>
);

interface GenericTreeOpts {
  seed: number; h: number; cx: number; base: number; pre: string;
  roots?: string[]; greens?: string[]; foliage: number; fallen: number; data: string[];
}

// Procedurally grown tree: trunk, five limbs with forks, background foliage, and one leaf per commitment.
function genericTree(o: GenericTreeOpts): ReactNode[] {
  const r = rng(o.seed), H = o.h, cx = o.cx, B = o.base, pre = o.pre, els: ReactNode[] = [];
  els.push(
    <defs key="df">
      {shadowFilter(pre + 's', 1.2, 0.22)}
      {blurFilter(pre + 'b', 3)}
      {barkGrad(pre + 'bk')}
      <radialGradient id={pre + 'gg'}>
        <stop offset="0%" stopColor="rgba(110,140,80,0.28)" />
        <stop offset="100%" stopColor="rgba(110,140,80,0)" />
      </radialGradient>
    </defs>,
  );
  els.push(<ellipse key="gnd" cx={cx} cy={B + 6} rx={H * 0.7} ry={H * 0.07} fill={`url(#${pre}gg)`} />);
  (o.roots || []).forEach((d, i) => {
    els.push(<path key={'rc' + i} d={d} fill="none" stroke={tint(C.root, 0.3)} strokeWidth={3} />);
    els.push(<path key={'rf' + i} d={d} fill="none" stroke={C.root} strokeWidth={1.8} strokeDasharray="5 14" strokeLinecap="round" style={{ animation: `dashFlow ${6 + i}s linear infinite` }} />);
  });
  const trunk: Curve = [[cx, B], [cx + (r() - 0.5) * 14, B - H * 0.14], [cx + (r() - 0.5) * 14, B - H * 0.28], [cx + (r() - 0.5) * 10, B - H * 0.42]];
  const wood = [
    taper(trunk, H * 0.1, H * 0.03),
    taper([[cx - H * 0.02, B - 3], [cx - H * 0.06, B + 1], [cx - H * 0.1, B + 4], [cx - H * 0.16, B + 7]], H * 0.045, 1),
    taper([[cx + H * 0.02, B - 3], [cx + H * 0.06, B + 1], [cx + H * 0.1, B + 3], [cx + H * 0.15, B + 6]], H * 0.04, 1),
  ];
  const limbs: { c: Curve; w: [number, number] }[] = [];
  [-156, -128, -98, -70, -40].forEach((deg, i) => {
    const a = ((deg + (r() - 0.5) * 14) * Math.PI) / 180, st = bz(trunk, 0.6 + (i % 2) * 0.2 + r() * 0.15), len = H * (0.34 + r() * 0.14) * (i === 2 ? 1.15 : 1);
    const e = [st[0] + Math.cos(a) * len, st[1] + Math.sin(a) * len];
    const c: Curve = [st, [st[0] + (e[0] - st[0]) * 0.35, st[1] + (e[1] - st[1]) * 0.35 - len * 0.12], [st[0] + (e[0] - st[0]) * 0.7, st[1] + (e[1] - st[1]) * 0.7 - len * 0.1], e];
    limbs.push({ c, w: [H * 0.042, H * 0.008] });
    const ft = 0.45 + r() * 0.2, fs = bz(c, ft), fa = a + (a < -Math.PI / 2 ? 0.55 : -0.55), fl = len * (0.38 + r() * 0.15), fe = [fs[0] + Math.cos(fa) * fl, fs[1] + Math.sin(fa) * fl];
    limbs.push({ c: [fs, [fs[0] + (fe[0] - fs[0]) * 0.4, fs[1] + (fe[1] - fs[1]) * 0.4 - fl * 0.08], [fs[0] + (fe[0] - fs[0]) * 0.75, fs[1] + (fe[1] - fs[1]) * 0.75 - fl * 0.06], fe], w: [H * 0.018, H * 0.006] });
  });
  limbs.forEach((l) => wood.push(taper(l.c, l.w[0], l.w[1])));
  wood.forEach((d, i) => els.push(<path key={'w' + i} d={d} fill={`url(#${pre}bk)`} />));
  const greens = o.greens || ['#8fc39a', '#76b384', '#a5d0ab', '#5f9f70', '#b9dcbc'];
  for (let k = 0; k < o.foliage; k++) {
    const l = limbs[Math.floor(r() * limbs.length)], t = 0.3 + r() * 0.7, p = bz(l.c, t), d = bzd(l.c, t), sd = r() < 0.5 ? -1 : 1, off = 4 + r() * 20, nx = -d[1] * sd, ny = d[0] * sd;
    const x = p[0] + nx * off + d[0] * r() * 8, y = p[1] + ny * off;
    const ang = (Math.atan2(ny + d[1] * 0.6 + (r() - 0.5) * 0.8, nx + d[0] * 0.6 + (r() - 0.5) * 0.8) * 180) / Math.PI;
    const L = 9 + r() * 9;
    els.push(<path key={'f' + k} d={leafD(L, L * 0.38, (r() - 0.5) * 0.3)} transform={`translate(${f1(x)},${f1(y)}) rotate(${f1(ang)})`} fill={greens[Math.floor(r() * greens.length)]} opacity={f1(0.55 + r() * 0.4)} />);
  }
  const pts: { l: (typeof limbs)[number]; t: number; sd: number }[] = [];
  limbs.forEach((l) => pts.push({ l, t: 1, sd: 0 }));
  limbs.forEach((l, i) => {
    pts.push({ l, t: 0.62, sd: i % 2 ? 1 : -1 });
    pts.push({ l, t: 0.84, sd: i % 2 ? -1 : 1 });
    pts.push({ l, t: 0.42, sd: i % 2 ? -1 : 1 });
  });
  o.data.forEach((col, i) => {
    const P = pts[i % pts.length], q = place(P.l.c, P.t, P.sd, 12);
    if (!q.tip) els.push(<path key={'tw' + i} d={`M${f1(q.px)} ${f1(q.py)}Q${f1(q.qx!)} ${f1(q.qy!)} ${f1(q.x)} ${f1(q.y)}`} fill="none" stroke={BARK} strokeWidth={1.6} strokeLinecap="round" />);
    const L = 19 + r() * 4;
    els.push(
      <g key={'dl' + i} transform={`translate(${f1(q.x)},${f1(q.y)}) rotate(${f1(q.ang)})`} filter={`url(#${pre}s)`}>
        <path d={leafD(L, L * 0.38, (r() - 0.5) * 0.25)} fill={col} />
        <path d={leafTop(L, L * 0.38)} fill="#fff" opacity={0.18} />
      </g>,
    );
  });
  for (let k = 0; k < o.fallen; k++) {
    const x = cx + (r() - 0.5) * H * 0.6, y = B + 8 + r() * 12, L = 15;
    els.push(<path key={'fl' + k} d={leafD(L, L * 0.38, 0.2)} transform={`translate(${f1(x)},${f1(y)}) rotate(${f1(r() * 360)})`} fill={C.d} opacity={0.9} />);
  }
  return els;
}

// Sunlight, rolling hills, drifting mist, and optional fireflies behind every canvas.
export const CanvasBg = memo(function CanvasBg({ motes }: { motes: boolean }) {
  const r = rng(5);
  const flies: ReactNode[] = [];
  if (motes) {
    for (let i = 0; i < 18; i++) {
      const s = 2 + r() * 2;
      flies.push(
        <div key={'ff' + i} style={{ position: 'absolute', left: f1(r() * 100) + '%', top: f1(10 + r() * 75) + '%', width: s, height: s, borderRadius: '50%', background: '#e9c766', boxShadow: '0 0 6px 1px rgba(233,199,102,0.6)', animation: `ff${i % 3} ${f1(10 + r() * 10)}s ease-in-out ${f1(-r() * 12)}s infinite` }} />,
      );
    }
  }
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 45% at 22% 0%, rgba(255,247,222,0.95), transparent 70%), radial-gradient(ellipse 80% 30% at 50% 104%, rgba(196,212,170,0.55), transparent 70%)' }} />
      <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: '10%', height: '26%', background: 'radial-gradient(ellipse 40% 60% at 18% 100%, rgba(170,198,168,0.45), transparent 70%), radial-gradient(ellipse 45% 70% at 85% 100%, rgba(160,192,160,0.4), transparent 70%)' }} />
      {([[-10, '50%', 46], [35, '58%', 54]] as const).map((m, i) => (
        <div key={'m' + i} style={{ position: 'absolute', left: m[0] + '%', bottom: '4%', width: '75%', height: m[1], background: 'radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.55), transparent 62%)', filter: 'blur(14px)', animation: `mist ${m[2]}s ease-in-out ${-i * 9}s infinite alternate` }} />
      ))}
      {flies}
    </div>
  );
});

// One project tree in The Grove overview.
export const GroveTree = memo(function GroveTree({ gd, cnt }: { gd: GroveProject; cnt: { g: number; a: number; r: number; f: number } }) {
  const r = rng(gd.seed + 1), data: string[] = [];
  for (let i = 0; i < cnt.g; i++) data.push(C.g);
  [...Array(cnt.a).fill(C.a), ...Array(cnt.r).fill(C.r)].forEach((c) => data.splice(Math.floor(r() * Math.min(data.length, 10)), 0, c));
  const B = 448, cx = 220;
  const L = `M${cx} ${B + 4} C ${cx - 70} ${B + 26}, ${cx - 180} ${B + 34}, ${cx - 340} ${B + 26}`;
  const R = `M${cx} ${B + 4} C ${cx + 70} ${B + 26}, ${cx + 180} ${B + 34}, ${cx + 340} ${B + 26}`;
  const roots = gd.slot === 1 ? [L, R] : gd.slot === 0 ? [R] : [L];
  return (
    <svg viewBox="0 0 440 480" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}>
      {genericTree({ cx, base: B, h: gd.h, seed: gd.seed, data, foliage: gd.foliage, fallen: cnt.f, pre: 'gv' + gd.id, roots })}
    </svg>
  );
});

function labelPos(q: Placement, L: number, lp?: LabelPos) {
  const a = (q.ang * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), tx = q.x + dx * L, ty = q.y + dy * L;
  const m = lp || (dy < -0.8 ? 'above' : dx < 0 ? 'left' : 'right');
  if (m === 'above') return { x: tx, yTop: ty - 72, anchor: 'middle' };
  if (m === 'below') return { x: q.x + dx * L * 0.5, yTop: q.y + dy * L * 0.5 + 26, anchor: 'middle' };
  if (m === 'left') return { x: tx - 12, yTop: ty - 29, anchor: 'end' };
  return { x: tx + 12, yTop: ty - 29, anchor: 'start' };
}

function labelCard(key: string, p: { x: number; yTop: number; anchor: string }, title: string, sub: string, state: LeafState, init: string) {
  const col = C[state], ct = CT[state], w = Math.max(title.length * 10.4, sub.length * 8.8) + 70, hh = 62;
  const x0 = Math.max(176, Math.min(1224 - w, p.anchor === 'end' ? p.x - w : p.anchor === 'middle' ? p.x - w / 2 : p.x)), y0 = p.yTop;
  return (
    <g key={key} style={{ pointerEvents: 'none' }}>
      <rect x={f1(x0)} y={f1(y0)} width={f1(w)} height={hh} rx={13} fill="#fff" stroke="#e4e2d9" filter="url(#cs)" />
      <circle cx={f1(x0 + 28)} cy={f1(y0 + 31)} r={16} style={{ fill: tint(col, 0.18), transition: 'fill 1.6s' }} />
      <text x={f1(x0 + 28)} y={f1(y0 + 35.5)} textAnchor="middle" style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, fontWeight: 600, fill: ct }}>{init}</text>
      <text x={f1(x0 + 54)} y={f1(y0 + 27)} style={{ fontFamily: 'Geist, sans-serif', fontSize: 19, fontWeight: 500, fill: '#1d2620' }}>{title}</text>
      <text x={f1(x0 + 54)} y={f1(y0 + 47)} style={{ fontFamily: '"Geist Mono", monospace', fontSize: 13.5, letterSpacing: '0.04em', fill: ct, transition: 'fill 1.6s' }}>{sub}</text>
    </g>
  );
}

export interface ProjectTreeProps {
  leaves: Leaf[];
  fallen: FallenLeaf[];
  branches: { name: string; count: number; atRisk: number }[];
  highlight: Set<string>; // leaves the briefing is currently talking about
  sel: string | null;
  hover: string | null;
  mode: 'at-risk' | 'all' | 'none';
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

// The detailed project tree: three workstream branches, one leaf per commitment.
export function ProjectTree({ leaves, fallen, branches, highlight, sel, hover, mode, onSelect, onHover }: ProjectTreeProps) {
  return useMemo(() => {
    const r = rng(42);
    const back: ReactNode[] = [], wood: string[] = [], twigs: ReactNode[] = [], lf: ReactNode[] = [], rings: ReactNode[] = [], labels: ReactNode[] = [];
    const mono = { fontFamily: '"Geist Mono", monospace', letterSpacing: '0.12em' };
    const halo = { paintOrder: 'stroke', stroke: 'rgba(246,245,238,0.9)', strokeWidth: 5, strokeLinejoin: 'round' } as const;

    back.push(<rect key="hit" x={-600} y={-200} width={2600} height={1300} fill="transparent" />);
    back.push(<g key="gl" opacity={0.4}>{genericTree({ cx: 60, base: 814, h: 240, seed: 11, data: Array(12).fill(C.g), foliage: 70, fallen: 0, pre: 'gl' })}</g>);
    back.push(<g key="gr" opacity={0.4}>{genericTree({ cx: 1340, base: 814, h: 225, seed: 23, data: [C.g, C.g, C.a, C.g, C.g, C.r, C.g, C.g, C.g, C.g, C.g, C.g], foliage: 45, fallen: 1, pre: 'gr' })}</g>);
    const roots = ['M700 792 C 620 822, 520 846, 380 848 S 140 836, 60 814', 'M700 792 C 790 822, 900 846, 1040 846 S 1260 834, 1340 814', 'M690 798 C 650 840, 600 868, 520 892', 'M712 798 C 760 846, 830 872, 910 890'];
    back.push(<ellipse key="gnd" cx={700} cy={808} rx={560} ry={60} fill="url(#gnd)" />);
    roots.forEach((d, i) => {
      back.push(<path key={'rc' + i} d={d} fill="none" stroke={tint(C.root, i < 2 ? 0.28 : 0.18)} strokeWidth={i < 2 ? 4 : 2.5} strokeLinecap="round" />);
      if (i < 2) back.push(<path key={'rf' + i} d={d} fill="none" stroke={C.root} strokeWidth={2} strokeLinecap="round" strokeDasharray="6 16" style={{ animation: `dashFlow ${7 + i}s linear infinite` }} />);
    });

    wood.push(taper([[700, 806], [707, 720], [692, 640], [700, 524]], 64, 20));
    wood.push(taper([[686, 796], [660, 804], [636, 810], [600, 816]], 22, 2));
    wood.push(taper([[714, 796], [742, 804], [770, 808], [806, 814]], 20, 2));
    Object.values(LIMBS).forEach((l) => wood.push(taper(l.c, l.w[0], l.w[1])));
    Object.values(LIMBS).forEach((l) => {
      for (let k = 0; k < 2; k++) {
        const t = 0.25 + r() * 0.6, sd = r() < 0.5 ? -1 : 1, p = bz(l.c, t), d = bzd(l.c, t), len = 18 + r() * 22, nx = -d[1] * sd, ny = d[0] * sd;
        const e = [p[0] + (nx * 0.8 + d[0] * 0.6) * len, p[1] + (ny * 0.8 + d[1] * 0.6) * len];
        wood.push(taper([p, [p[0] + (e[0] - p[0]) * 0.4, p[1] + (e[1] - p[1]) * 0.4], [p[0] + (e[0] - p[0]) * 0.7, p[1] + (e[1] - p[1]) * 0.7 - 4], e], 3, 0.6, 8));
      }
    });

    fallen.forEach((f) => {
      const on = sel === f.id || hover === f.id;
      lf.push(
        <g key={f.id} transform={`translate(${f.x},${f.y}) rotate(${f.rot})`} style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelect(f.id); }} onMouseEnter={() => onHover(f.id)} onMouseLeave={() => onHover(null)}>
          <circle cx={17} cy={0} r={20} fill="transparent" />
          <path d={leafD(34, 12, 0.2)} fill={C.d} opacity={on ? 1 : 0.9} filter="url(#ls)" />
          <path d="M2 0 Q17 1 31 0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        </g>,
      );
      if (on) labels.push(labelCard('fl' + f.id, { x: f.x + 18, yTop: f.y + 22, anchor: 'middle' }, f.title.length > 30 ? f.title.slice(0, 29) + '…' : f.title, 'FALLEN · ' + f.owner.toUpperCase(), 'd', initials(f.owner)));
    });
    if (fallen.length && !fallen.some((f) => f.id === hover || f.id === sel)) {
      labels.push(<text key="fallcap" x={520} y={790} textAnchor="start" style={{ ...mono, fontSize: 12, fill: '#8a7558', ...halo }}>{fallen.length} FALLEN · STILL TRACKED</text>);
    }
    branches.forEach((w, i) => {
      const [x, y, anchor] = WS_LABEL[i];
      labels.push(<text key={'ws' + i} x={x} y={y} textAnchor={anchor} style={{ ...mono, fontSize: 12.5, fontWeight: 500, fill: '#4a5a50', ...halo }}>{w.name.toUpperCase()}</text>);
      labels.push(<text key={'wc' + i} x={x} y={y + 17} textAnchor={anchor} style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, fill: '#7a857e', ...halo }}>{w.count} leaves · {w.atRisk} at risk</text>);
    });

    leaves.forEach((l) => {
      const limb = LIMBS[l.limb], L = 42, q = place(limb.c, l.t, l.side || 0, 24), col = C[l.state];
      if (!q.tip) twigs.push(<path key={'t' + l.id} d={`M${f1(q.px)} ${f1(q.py)}Q${f1(q.qx!)} ${f1(q.qy!)} ${f1(q.x)} ${f1(q.y)}`} fill="none" stroke="#7a5a3f" strokeWidth={2.4} strokeLinecap="round" />);
      const isSel = sel === l.id, isHov = hover === l.id, hl = highlight.has(l.id);
      const asym = (r() - 0.5) * 0.3, W = L * 0.37, a = (q.ang * Math.PI) / 180, mx = q.x + Math.cos(a) * L * 0.5, my = q.y + Math.sin(a) * L * 0.5;
      const swayDur = f1(4.5 + r() * 3), swayDelay = f1(-r() * 5);
      lf.push(
        <g key={l.id} transform={`translate(${f1(q.x)},${f1(q.y)}) rotate(${f1(q.ang)})`} style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelect(l.id); }} onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)}>
          <g transform={`scale(${isSel || isHov ? 1.16 : 1})`}>
            <g style={{ animation: `sway ${swayDur}s ease-in-out ${swayDelay}s infinite`, transformBox: 'fill-box', transformOrigin: '0% 50%' }}>
              <ellipse cx={L / 2} cy={0} rx={L * 0.62} ry={L * 0.45} fill="transparent" />
              <path d={leafD(L, W, asym)} filter="url(#ls)" style={{ fill: col, transition: 'fill 1.6s ease' }} />
              <path d={leafTop(L, W, asym)} fill="#fff" opacity={0.2} />
              <path d={`M1.5 0 Q${f1(L * 0.5)} ${f1(asym * 4)} ${f1(L * 0.93)} 0`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.1} />
            </g>
          </g>
        </g>,
      );
            if (isSel) rings.push(<circle key={'sr' + l.id} cx={f1(mx)} cy={f1(my)} r={L * 0.8} fill="none" stroke="#2b3630" strokeWidth={1.3} strokeDasharray="3 5" />);
      if (hl) rings.push(<circle key={'pr' + l.id} cx={f1(mx)} cy={f1(my)} r={L * 0.6} fill="none" stroke="#2f8a77" strokeWidth={2} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pulseRing 1.3s ease-out infinite' }} />);
      const show = mode === 'all' || isSel || isHov || hl || (mode === 'at-risk' && l.state !== 'g');
      if (show) {
        const sub = `${l.stateLabel.toUpperCase()} · ${l.due.toUpperCase()}`;
        labels.push(labelCard('lb' + l.id, labelPos(q, L, l.lp), l.title.length > 30 ? l.title.slice(0, 29) + '…' : l.title, sub, l.state, initials(l.owner)));
      }
    });

    return (
      <svg viewBox="170 140 1060 800" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          {shadowFilter('ls', 1.6, 0.28)}
          {shadowFilter('cs', 4, 0.12)}
          {blurFilter('rb', 3)}
          {barkGrad('bark')}
          <radialGradient id="gnd">
            <stop offset="0%" stopColor="rgba(120,140,80,0.3)" />
            <stop offset="100%" stopColor="rgba(120,140,80,0)" />
          </radialGradient>
        </defs>
        {back}
        {wood.map((d, i) => <path key={'w' + i} d={d} fill="url(#bark)" />)}
        {twigs}
        {lf}
        {rings}
        {labels}
      </svg>
    );
  }, [leaves, fallen, branches, highlight, sel, hover, mode, onSelect, onHover]);
}

export function Orb({ state, size }: { state: 'idle' | 'listening' | 'speaking' | 'done'; size: number }) {
  const sp = state === 'speaking' ? 1.1 : state === 'listening' ? 1.7 : 3.4;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <div style={{ position: 'absolute', inset: -size * 0.28, borderRadius: '50%', background: 'radial-gradient(circle, rgba(76,195,154,0.28), transparent 66%)', animation: `orbBreathe ${sp}s ease-in-out infinite` }} />
      <div style={{ position: 'absolute', inset: -size * 0.06, borderRadius: '50%', background: 'conic-gradient(from 0deg, transparent, rgba(47,158,143,0.55), transparent 38%, rgba(227,180,90,0.45), transparent 72%)', filter: `blur(${size * 0.06}px)`, animation: 'orbSpin 7s linear infinite' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 36% 30%, #ffffff 0%, #c9f2e2 16%, #5fcaa3 42%, #23876a 74%, #155a47 100%)', boxShadow: '0 10px 30px rgba(35,135,106,0.35), inset 0 -8px 20px rgba(0,40,30,0.25)', animation: `orbBreathe ${sp}s ease-in-out infinite` }} />
      <div style={{ position: 'absolute', left: '22%', top: '15%', width: '32%', height: '18%', borderRadius: '50%', background: 'rgba(255,255,255,0.6)', filter: 'blur(4px)' }} />
    </div>
  );
}

export function Wave() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: 2, height: 14, borderRadius: 1, background: '#2f8a77', transformOrigin: 'center', animation: `wave ${0.7 + i * 0.13}s ease-in-out ${-i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}
