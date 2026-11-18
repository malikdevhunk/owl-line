import type { Constraint, Edge, Playable } from './types';

export type Hop = {
  to: string;
  edge: Edge;
};

function arrowBlocks(constraint: Constraint, edge: Edge, from: string): boolean {
  if (constraint.kind !== 'one_way') return false;
  const arrow = constraint.arrows.find((item) => item.edgeId === edge.id);
  if (!arrow) return false;
  return arrow.from !== from;
}

export function outgoing(playable: Playable, from: string): Hop[] {
  const closed = playable.constraint.kind === 'bridge_closed' ? playable.constraint.edgeId : null;
  const hops: Hop[] = [];
  for (const edge of playable.edges) {
    if (edge.id === closed) continue;
    if (arrowBlocks(playable.constraint, edge, from)) continue;
    if (edge.a === from) hops.push({ to: edge.b, edge });
    else if (edge.b === from) hops.push({ to: edge.a, edge });
  }
  return hops;
}

export type Legal = { ok: true; length: number } | { ok: false; reason: string };

export function legality(playable: Playable, path: readonly string[]): Legal {
  if (path.length > 80) return { ok: false, reason: 'That route wanders too far.' };
  if (path.length < 2) return { ok: false, reason: 'The car has not left the depot.' };
  if (path[0] !== playable.depotId) return { ok: false, reason: 'Service starts at the depot.' };
  const last = path[path.length - 1];
  if (last !== playable.depotId) return { ok: false, reason: 'Bring the car home.' };

  let length = 0;
  const seen = new Set<string>();
  const start = path[0];
  if (start) seen.add(start);

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    if (!from || !to) return { ok: false, reason: 'That route is broken.' };
    const hop = outgoing(playable, from).find((item) => item.to === to);
    if (!hop) return { ok: false, reason: 'That track is not open.' };
    length += hop.edge.w;
    seen.add(to);
  }

  for (const id of playable.required) {
    if (!seen.has(id)) return { ok: false, reason: 'A stop is still dark.' };
  }

  if (playable.constraint.kind === 'market_first') {
    const market = playable.nodes.find((node) => node.district === 'market');
    const hills = playable.nodes.filter((node) => node.district === 'hill');
    if (market && hills.length > 0) {
      const marketAt = path.indexOf(market.id);
      for (const hill of hills) {
        const hillAt = path.indexOf(hill.id);
        if (hillAt !== -1 && (marketAt === -1 || hillAt < marketAt)) {
          return { ok: false, reason: 'Serve the market before the hill.' };
        }
      }
    }
  }

  if (playable.constraint.kind === 'works_last') {
    const works = playable.nodes.find((node) => node.district === 'works');
    const beforeHome = path[path.length - 2];
    if (!works || beforeHome !== works.id) {
      return { ok: false, reason: 'Call at the works, then bring the car home.' };
    }
  }

  if (playable.constraint.kind === 'short_budget' && length > playable.constraint.budget) {
    return { ok: false, reason: 'That route is over the track budget.' };
  }

  return { ok: true, length };
}
