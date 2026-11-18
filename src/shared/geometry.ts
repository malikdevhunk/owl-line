import type { Point } from './types';

const EPS = 1e-6;

function orient(p: Point, q: Point, r: Point): number {
  const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(v) < EPS) return 0;
  return v > 0 ? 1 : -1;
}

/** Proper intersection only. Shared endpoints do not count as a crossing. */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false;
  return o1 !== o2 && o3 !== o4;
}

export function riverY(river: Point[], x: number): number {
  if (river.length === 0) return 500;
  const first = river[0];
  const last = river[river.length - 1];
  if (!first || !last) return 500;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  for (let i = 0; i < river.length - 1; i++) {
    const p = river[i];
    const q = river[i + 1];
    if (!p || !q) continue;
    if (x >= p.x && x <= q.x) {
      const span = q.x - p.x || 1;
      const t = (x - p.x) / span;
      return p.y + (q.y - p.y) * t;
    }
  }
  return last.y;
}

export function riverSide(river: Point[], p: Point): 'north' | 'south' {
  return p.y <= riverY(river, p.x) ? 'north' : 'south';
}

export function crossesRiver(river: Point[], a: Point, b: Point): boolean {
  if (riverSide(river, a) !== riverSide(river, b)) return true;
  for (let i = 0; i < river.length - 1; i++) {
    const p = river[i];
    const q = river[i + 1];
    if (p && q && segmentsCross(a, b, p, q)) return true;
  }
  return false;
}

/** 100 map units = 1.0 track on the scoreboard. */
export function trackWeight(a: Point, b: Point): number {
  return Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / 10));
}

export function anySegmentsCross(pairs: readonly { a: Point; b: Point }[]): boolean {
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const left = pairs[i];
      const right = pairs[j];
      if (!left || !right) continue;
      if (segmentsCross(left.a, left.b, right.a, right.b)) return true;
    }
  }
  return false;
}
