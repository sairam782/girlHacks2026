// Visual constants and shared shapes for the tree. All project data comes from the API (see lib/).
import type { Curve } from './geometry';

export type LeafState = 'g' | 'a' | 'r' | 'd';

export const C: Record<LeafState | 'root', string> = { g: '#4f9d69', a: '#e3a33b', r: '#b9573a', d: '#b8a487', root: '#2f9e8f' };
export const CT: Record<LeafState, string> = { g: '#2f7a4a', a: '#9a620c', r: '#9c4529', d: '#7d6a50' };
export const BARK = '#7a5a3f';

// Three workstream branches (L, E, F), three limbs each.
export const LIMBS: Record<string, { c: Curve; w: [number, number] }> = {
  L0: { c: [[700, 612], [600, 592], [470, 520], [330, 402]], w: [24, 5] },
  L1: { c: [[530, 544], [518, 494], [495, 438], [468, 362]], w: [10, 3] },
  L2: { c: [[433, 482], [390, 488], [330, 505], [262, 498]], w: [9, 2.5] },
  E0: { c: [[700, 548], [688, 430], [728, 330], [702, 182]], w: [22, 4] },
  E1: { c: [[703, 411], [660, 380], [618, 325], [594, 252]], w: [10, 3] },
  E2: { c: [[711, 304], [760, 280], [800, 250], [830, 198]], w: [9, 2.5] },
  F0: { c: [[700, 595], [820, 575], [960, 505], [1080, 392]], w: [24, 5] },
  F1: { c: [[890, 528], [900, 480], [918, 435], [934, 370]], w: [10, 3] },
  F2: { c: [[987, 469], [1040, 478], [1105, 492], [1170, 478]], w: [9, 2.5] },
};

// Where each workstream label sits on the trunk: [x, y, anchor].
export const WS_LABEL: [number, number, 'start' | 'middle' | 'end'][] = [[600, 626, 'middle'], [676, 486, 'end'], [818, 608, 'middle']];

export type LabelPos = 'left' | 'right' | 'above' | 'below';

export interface Leaf {
  id: string; limb: string; t: number; side?: number;
  title: string; owner: string; due: string; state: Exclude<LeafState, 'd'>; stateLabel: string; risk: number; lp?: LabelPos;
}

export interface FallenLeaf { id: string; title: string; owner: string; x: number; y: number; rot: number }

export interface GroveProject { id: string; name: string; health: number; seed: number; h: number; foliage: number; slot: number }

export const AV = ['#dcebdc', '#f3e3c4', '#ead7cc', '#d6e5e7', '#e4e1d3', '#e2dcec', '#d9e6d0'];

export const initials = (n: string) => n.replace(/\(.*?\)/g, '').trim().split(/\s+/).map((x) => x[0]).join('').replace('.', '').slice(0, 2).toUpperCase();
