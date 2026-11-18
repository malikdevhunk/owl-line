import type { Edge, Puzzle, Stop } from './types';

export type PublicEdge = Edge & {
  closed: boolean;
  oneWay: 'ab' | 'ba' | null;
};

export type PublicPuzzle = {
  id: string;
  date: string | null;
  nodes: Stop[];
  edges: PublicEdge[];
  river: Puzzle['river'];
  constraint: Puzzle['constraint'];
  required: string[];
  depotId: string;
  theme: string;
  mapName: string | null;
  authorName: string | null;
};

function oneWayOf(puzzle: Puzzle, edge: Edge): 'ab' | 'ba' | null {
  if (puzzle.constraint.kind !== 'one_way') return null;
  const arrow = puzzle.constraint.arrows.find((item) => item.edgeId === edge.id);
  if (!arrow) return null;
  if (arrow.from === edge.a && arrow.to === edge.b) return 'ab';
  if (arrow.from === edge.b && arrow.to === edge.a) return 'ba';
  return null;
}

/** Player-facing puzzle. The optimal route is not included. */
export function presentPuzzle(puzzle: Puzzle): PublicPuzzle {
  return {
    id: puzzle.id,
    date: puzzle.date,
    nodes: puzzle.nodes,
    edges: puzzle.edges.map((edge) => ({
      ...edge,
      closed: puzzle.constraint.kind === 'bridge_closed' && puzzle.constraint.edgeId === edge.id,
      oneWay: oneWayOf(puzzle, edge),
    })),
    river: puzzle.river,
    constraint: puzzle.constraint,
    required: puzzle.required,
    depotId: puzzle.depotId,
    theme: puzzle.theme,
    mapName: puzzle.mapName,
    authorName: puzzle.authorName,
  };
}
