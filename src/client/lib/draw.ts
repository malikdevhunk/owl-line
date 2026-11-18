import type { Point } from '../../shared/types';

export function chain(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export function rail(a: Point, b: Point, gap = 4.5) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * gap;
  const oy = (dx / len) * gap;
  return {
    ax: a.x + ox,
    ay: a.y + oy,
    bx: b.x + ox,
    by: b.y + oy,
    cx: a.x - ox,
    cy: a.y - oy,
    dx: b.x - ox,
    dy: b.y - oy,
    mx: (a.x + b.x) / 2,
    my: (a.y + b.y) / 2,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
