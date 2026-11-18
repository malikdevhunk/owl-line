import { dayOfYear, weekday } from './dates';
import { anySegmentsCross, crossesRiver, trackWeight } from './geometry';
import { assignStopNames, THEMES } from './names';
import { dateSeed, hashSeed, mulberry32 } from './prng';
import { legality } from './route';
import { solvePlayable } from './solve';
import type { Constraint, ConstraintKind, Edge, Playable, Point, Puzzle, Stop } from './types';

type BankName = 'north' | 'south';
type EdgeKind = 'spine' | 'bridge' | 'chord';

type RawNode = {
  id: string;
  x: number;
  y: number;
  bank: BankName;
};

type RawEdge = {
  a: string;
  b: string;
  kind: EdgeKind;
};

const KINDS: ConstraintKind[] = ['bridge_closed', 'one_way', 'market_first', 'short_budget', 'works_last'];

export const EDITOR_RIVER: Point[] = [
  { x: 0, y: 500 },
  { x: 160, y: 470 },
  { x: 320, y: 530 },
  { x: 500, y: 488 },
  { x: 680, y: 536 },
  { x: 840, y: 474 },
  { x: 1000, y: 508 },
];

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function stopTarget(date: string, rand: () => number): number {
  const day = weekday(date);
  if (day === 0 || day === 6) return rand() < 0.5 ? 11 : 12;
  if (day === 4 || day === 5) return 10;
  return rand() < 0.55 ? 8 : 9;
}

function makeRiver(rand: () => number): Point[] {
  const base = 478 + rand() * 36;
  const amp = 18 + rand() * 14;
  const phase = rand() * Math.PI * 2;
  const points: Point[] = [];
  for (let i = 0; i <= 8; i++) {
    points.push({
      x: Math.round((1000 * i) / 8),
      y: Math.round(base + Math.sin(phase + i * 0.85) * amp),
    });
  }
  return points;
}

function placeBank(
  count: number,
  yCenter: number,
  yLo: number,
  yHi: number,
  bank: BankName,
  rand: () => number,
  regular: boolean
): RawNode[] {
  const nodes: RawNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const jitterX = regular ? 0 : (rand() - 0.5) * 22;
    const jitterY = regular ? 0 : (rand() - 0.5) * 24;
    const wave = regular ? 0 : Math.sin(i * 1.2) * 16;
    nodes.push({
      id: '',
      x: Math.round(clamp(120 + 760 * t + jitterX, 80, 920)),
      y: Math.round(clamp(yCenter + wave + jitterY, yLo, yHi)),
      bank,
    });
  }
  if (!regular) relax(nodes, yLo, yHi);
  nodes.sort((a, b) => a.x - b.x);
  return nodes;
}

function relax(nodes: RawNode[], yLo: number, yHi: number): void {
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist >= 100) continue;
        const push = (100 - dist) / 2;
        a.x = Math.round(clamp(a.x - (dx / dist) * push, 80, 920));
        b.x = Math.round(clamp(b.x + (dx / dist) * push, 80, 920));
        a.y = Math.round(clamp(a.y - (dy / dist) * push, yLo, yHi));
        b.y = Math.round(clamp(b.y + (dy / dist) * push, yLo, yHi));
      }
    }
  }
}

function tryBuild(date: string, rand: () => number, regular: boolean): Puzzle | null {
  const total = regular ? 8 : stopTarget(date, rand);
  const northCount = Math.ceil(total / 2);
  const southCount = total - northCount;
  const north = placeBank(northCount, 226, 150, 330, 'north', rand, regular);
  const south = placeBank(southCount, 774, 670, 860, 'south', rand, regular);
  const raw = [...north, ...south];
  raw.forEach((node, index) => {
    node.id = `s${index}`;
  });

  const byId = new Map(raw.map((node) => [node.id, node]));
  const rough: RawEdge[] = [];

  const pointOf = (id: string): Point | null => {
    const node = byId.get(id);
    return node ? { x: node.x, y: node.y } : null;
  };

  const degree = (id: string) => rough.filter((edge) => edge.a === id || edge.b === id).length;

  const add = (a: RawNode | undefined, b: RawNode | undefined, kind: EdgeKind): boolean => {
    if (!a || !b || a.id === b.id) return false;
    if (rough.some((edge) => (edge.a === a.id && edge.b === b.id) || (edge.a === b.id && edge.b === a.id))) {
      return false;
    }
    if (degree(a.id) >= 4 || degree(b.id) >= 4) return false;
    const pa = pointOf(a.id);
    const pb = pointOf(b.id);
    if (!pa || !pb) return false;
    const pairs = rough.flatMap((edge) => {
      const ea = pointOf(edge.a);
      const eb = pointOf(edge.b);
      return ea && eb ? [{ a: ea, b: eb }] : [];
    });
    if (anySegmentsCross([...pairs, { a: pa, b: pb }])) return false;
    rough.push({ a: a.id, b: b.id, kind });
    return true;
  };

  const link = (bank: RawNode[]) => {
    for (let i = 0; i < bank.length - 1; i++) {
      if (!add(bank[i], bank[i + 1], 'spine')) return false;
    }
    return true;
  };
  if (!link(north) || !link(south)) return null;
  if (!add(north[0], south[0], 'bridge')) return null;
  if (!add(north[north.length - 1], south[south.length - 1], 'bridge')) return null;

  const chordPairs: [RawNode | undefined, RawNode | undefined][] = [
    [north[0], north[2]],
    [south[0], south[2]],
    [north[1], north[3]],
    [south[1], south[3]],
  ];
  let chords = 0;
  for (const [a, b] of chordPairs) {
    if (chords >= 2 && (regular || rand() > 0.5)) continue;
    if (add(a, b, 'chord')) chords += 1;
  }

  const depotIndex = regular ? 1 : 1 + Math.floor(rand() * Math.max(1, north.length - 2));
  const depot = north[Math.min(depotIndex, north.length - 2)];
  const market = depot ? north[north.indexOf(depot) - 1] : undefined;
  const works = depot ? north[north.indexOf(depot) + 1] : undefined;
  if (!depot || !market || !works) return null;
  if (degree(depot.id) < 2) return null;

  const used = new Set([depot.id, market.id, works.id]);
  const hill = south.find((node) => !used.has(node.id));
  if (!hill) return null;
  used.add(hill.id);
  const harbor =
    [...south].reverse().find((node) => !used.has(node.id)) ?? north.find((node) => !used.has(node.id));
  if (!harbor) return null;

  const districtOf = (id: string): Stop['district'] => {
    if (id === depot.id) return 'depot';
    if (id === market.id) return 'market';
    if (id === hill.id) return 'hill';
    if (id === works.id) return 'works';
    if (id === harbor.id) return 'harbor';
    return 'stop';
  };

  const names = assignStopNames(raw.map((node) => districtOf(node.id)));
  const nodes: Stop[] = raw.map((node, index) => ({
    id: node.id,
    name: names[index] ?? 'Stop',
    x: node.x,
    y: node.y,
    district: districtOf(node.id),
  }));

  const river = regular ? EDITOR_RIVER.map((point) => ({ ...point })) : makeRiver(rand);
  const edges: Edge[] = [];
  for (let i = 0; i < rough.length; i++) {
    const edge = rough[i];
    if (!edge) return null;
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) return null;
    edges.push({
      id: `e${i}`,
      a: edge.a,
      b: edge.b,
      w: trackWeight(a, b),
      bridge: edge.kind === 'bridge' || crossesRiver(river, a, b),
    });
  }

  const bridges = edges.filter((edge) => edge.bridge);
  const chordEdges: Edge[] = [];
  for (let index = 0; index < edges.length; index++) {
    if (rough[index]?.kind !== 'chord') continue;
    const chord = edges[index];
    if (chord) chordEdges.push(chord);
  }
  const required = nodes.map((node) => node.id);
  const preferred = KINDS[dayOfYear(date) % KINDS.length] ?? 'short_budget';
  const order: ConstraintKind[] = regular
    ? ['short_budget']
    : KINDS.map((_, index) => KINDS[(KINDS.indexOf(preferred) + index) % KINDS.length] ?? preferred);

  for (const kind of order) {
    const built = constraintFor(kind, bridges, chordEdges, byId, rand);
    if (!built) continue;
    const playable: Playable = {
      nodes,
      edges,
      constraint: built,
      required,
      depotId: depot.id,
    };
    const solved = solvePlayable(playable);
    if (!solved) continue;
    const checked = legality(playable, solved.path);
    if (!checked.ok || checked.length !== solved.length) continue;
    const constraint =
      built.kind === 'short_budget'
        ? { kind: 'short_budget' as const, budget: solved.length + Math.max(8, Math.round(solved.length * 0.12)) }
        : built;
    const theme = THEMES[dayOfYear(date) % THEMES.length] ?? 'Lantern fog';
    return {
      id: date,
      date,
      seed: dateSeed(date),
      nodes,
      edges,
      river,
      constraint,
      required,
      depotId: depot.id,
      Lstar: solved.length,
      theme,
      optimalPath: solved.path,
      mapName: null,
      authorName: null,
    };
  }
  return null;
}

function constraintFor(
  kind: ConstraintKind,
  bridges: Edge[],
  chords: Edge[],
  byId: Map<string, RawNode>,
  rand: () => number
): Constraint | null {
  if (kind === 'bridge_closed') {
    if (bridges.length < 2) return null;
    const pick = bridges[Math.floor(rand() * bridges.length)];
    return pick ? { kind, edgeId: pick.id } : null;
  }
  if (kind === 'one_way') {
    if (chords.length < 2) return null;
    const pool = [...chords];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const current = pool[i];
      const swap = pool[j];
      if (current && swap) {
        pool[i] = swap;
        pool[j] = current;
      }
    }
    const arrows = pool.slice(0, 2).flatMap((edge) => {
      const arrow = westToEast(edge, byId);
      return arrow ? [arrow] : [];
    });
    if (arrows.length < 2) return null;
    return { kind: 'one_way', arrows };
  }
  if (kind === 'short_budget') return { kind: 'short_budget', budget: 1_000_000 };
  return { kind };
}

function westToEast(edge: Edge, byId: Map<string, RawNode>): { edgeId: string; from: string; to: string } | null {
  const a = byId.get(edge.a);
  const b = byId.get(edge.b);
  if (!a || !b) return null;
  if (a.x <= b.x) return { edgeId: edge.id, from: edge.a, to: edge.b };
  return { edgeId: edge.id, from: edge.b, to: edge.a };
}

export function generateDaily(date: string): Puzzle {
  const seed = dateSeed(date);
  for (let attempt = 0; attempt < 40; attempt++) {
    const puzzle = tryBuild(date, mulberry32(hashSeed(`${seed}#${attempt}`)), false);
    if (puzzle) return puzzle;
  }
  const fallback = tryBuild(date, mulberry32(hashSeed(`${seed}#fallback`)), true);
  if (!fallback) throw new Error(`No solvable night map for ${date}`);
  return fallback;
}
