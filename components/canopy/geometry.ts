// Bezier + leaf-shape helpers used to draw the trees procedurally.

export type Pt = number[];
export type Curve = Pt[];

export const f1 = (n: number) => Math.round(n * 10) / 10;

// Seeded PRNG (mulberry32) so every render draws the same tree.
export function rng(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bz(c: Curve, t: number): Pt {
  const u = 1 - t;
  return [0, 1].map(
    (k) => u * u * u * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t * t * t * c[3][k],
  );
}

export function bzd(c: Curve, t: number): Pt {
  const u = 1 - t;
  const d = [0, 1].map(
    (k) => 3 * u * u * (c[1][k] - c[0][k]) + 6 * u * t * (c[2][k] - c[1][k]) + 3 * t * t * (c[3][k] - c[2][k]),
  );
  const l = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / l, d[1] / l];
}

// A filled path that follows curve c, tapering from width w0 to w1.
export function taper(c: Curve, w0: number, w1: number, n = 22) {
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = bz(c, t), d = bzd(c, t), w = (w0 + (w1 - w0) * Math.pow(t, 0.75)) / 2;
    L.push([p[0] - d[1] * w, p[1] + d[0] * w]);
    R.push([p[0] + d[1] * w, p[1] - d[0] * w]);
  }
  const f = (q: Pt) => f1(q[0]) + ' ' + f1(q[1]);
  const e = bz(c, 1), d = bzd(c, 1);
  return 'M' + L.map(f).join('L') + 'Q' + f1(e[0] + d[0] * w1) + ' ' + f1(e[1] + d[1] * w1) + ' ' + R.reverse().map(f).join('L') + 'Z';
}

export function leafD(L: number, W: number, asym = 0) {
  const a = W * (1 + asym), b = W * (1 - asym);
  return `M0 0C${f1(L * 0.22)} ${f1(-a)} ${f1(L * 0.66)} ${f1(-a * 0.85)} ${L} 0C${f1(L * 0.66)} ${f1(b * 0.85)} ${f1(L * 0.22)} ${f1(b)} 0 0Z`;
}

export function leafTop(L: number, W: number, asym = 0) {
  const a = W * (1 + asym);
  return `M0 0C${f1(L * 0.22)} ${f1(-a)} ${f1(L * 0.66)} ${f1(-a * 0.85)} ${L} 0Z`;
}

export interface Placement {
  px: number; py: number; x: number; y: number; qx?: number; qy?: number; ang: number; tip?: boolean;
}

// Where a leaf attaches: at the tip of a limb (sd=0) or on a twig to one side.
export function place(c: Curve, t: number, sd: number, tw: number): Placement {
  const p = bz(c, t), d = bzd(c, t);
  if (!sd) return { px: p[0], py: p[1], x: p[0] + d[0] * 2, y: p[1] + d[1] * 2, ang: (Math.atan2(d[1], d[0]) * 180) / Math.PI, tip: true };
  const nx = -d[1] * sd, ny = d[0] * sd;
  return {
    px: p[0], py: p[1],
    x: p[0] + nx * tw + d[0] * tw * 0.45, y: p[1] + ny * tw + d[1] * tw * 0.45,
    qx: p[0] + d[0] * tw * 0.55, qy: p[1] + d[1] * tw * 0.55,
    ang: (Math.atan2(ny + d[1] * 0.75, nx + d[0] * 0.75) * 180) / Math.PI,
  };
}

export const tint = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
