import { anySegmentsCross, crossesRiver, trackWeight } from './geometry';
import { EDITOR_RIVER } from './generate';
import { assignStopNames, communityMapName } from './names';
import { legality } from './route';
import { solvePlayable } from './solve';
import type { Constraint, DraftBody, Edge, Playable, Puzzle, Stop } from './types';

const DISTRICTS = new Set(['depot', 'market', 'harbor', 'hill', 'works', 'stop']);

export type DraftResult = { ok: true; puzzle: Puzzle } | { ok: false; error: string };

function fail(error: string): DraftResult {
  return { ok: false, error };
}

export function realizeDraft(draft: DraftBody, rand: () => number): DraftResult {
  if (draft.nodes.length < 8 || draft.nodes.length > 12) {
    return fail('A community line needs 8 to 12 stops.');
  }
  const ids = new Set<string>();
  for (const node of draft.nodes) {
    if (!/^n\d{1,2}$/.test(node.id) || ids.has(node.id)) return fail('A stop on this map is not valid.');
    ids.add(node.id);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return fail('A stop fell off the map.');
    if (node.x < 48 || node.y < 48 || node.x > 952 || node.y > 952) return fail('Keep stops on the paper.');
    if (!DISTRICTS.has(node.district)) return fail('That district is not on the night map.');
  }
  for (let i = 0; i < draft.nodes.length; i++) {
    for (let j = i + 1; j < draft.nodes.length; j++) {
      const a = draft.nodes[i];
      const b = draft.nodes[j];
      if (!a || !b) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 72) return fail('Those stops are too close to read.');
    }
  }

  const depots = draft.nodes.filter((node) => node.district === 'depot');
  if (depots.length !== 1) return fail('Mark one depot.');
  const depot = depots[0];
  if (!depot) return fail('Mark one depot.');

  if (draft.kind === 'market_first') {
    if (!draft.nodes.some((node) => node.district === 'market')) return fail('Mark a market first.');
    if (!draft.nodes.some((node) => node.district === 'hill')) return fail('Mark the hill.');
  }
  if (draft.kind === 'works_last' && !draft.nodes.some((node) => node.district === 'works')) {
    return fail('Mark the works.');
  }

  const edgeIds = new Set<string>();
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const edge of draft.edges) {
    if (!/^e\d{1,2}$/.test(edge.id) || edgeIds.has(edge.id)) return fail('A track on this map is not valid.');
    edgeIds.add(edge.id);
    if (!ids.has(edge.a) || !ids.has(edge.b) || edge.a === edge.b) return fail('A track does not meet a stop.');
    const key = edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`;
    if (seen.has(key)) return fail('That track is already drawn.');
    seen.add(key);
    const a = draft.nodes.find((node) => node.id === edge.a);
    const b = draft.nodes.find((node) => node.id === edge.b);
    if (!a || !b) return fail('A track does not meet a stop.');
    edges.push({
      id: edge.id,
      a: edge.a,
      b: edge.b,
      w: trackWeight(a, b),
      bridge: crossesRiver(EDITOR_RIVER, a, b),
    });
  }

  const points = edges.map((edge) => {
    const a = draft.nodes.find((node) => node.id === edge.a);
    const b = draft.nodes.find((node) => node.id === edge.b);
    return a && b ? { a, b } : null;
  });
  if (points.some((pair) => pair === null)) return fail('A track does not meet a stop.');
  const pairs = points.flatMap((pair) => (pair ? [pair] : []));
  if (anySegmentsCross(pairs)) return fail('Tracks may not cross. Use a stop, or the river.');

  for (const node of draft.nodes) {
    const degree = edges.filter((edge) => edge.a === node.id || edge.b === node.id).length;
    if (degree > 4) return fail('A stop can take four tracks at most.');
    if (degree === 0) return fail('Every stop needs a track.');
  }

  const names = assignStopNames(draft.nodes.map((node) => node.district));
  const nodes: Stop[] = draft.nodes.map((node, index) => ({
    id: node.id,
    name: names[index] ?? 'Stop',
    x: Math.round(node.x),
    y: Math.round(node.y),
    district: node.district,
  }));

  const byPoint = new Map(nodes.map((node) => [node.id, node]));
  const bridges = edges.filter((edge) => edge.bridge);
  const shore = edges.filter((edge) => !edge.bridge);
  let constraint: Constraint;
  if (draft.kind === 'bridge_closed') {
    if (bridges.length < 1) return fail('Draw a track across the river before you close it.');
    const pick = bridges[Math.floor(rand() * bridges.length)];
    if (!pick) return fail('Draw a track across the river before you close it.');
    constraint = { kind: 'bridge_closed', edgeId: pick.id };
  } else if (draft.kind === 'one_way') {
    if (shore.length < 2) return fail('Draw two shore tracks before making them one-way.');
    const arrows = shore.slice(0, 2).flatMap((edge) => {
      const a = byPoint.get(edge.a);
      const b = byPoint.get(edge.b);
      if (!a || !b) return [];
      return a.x <= b.x
        ? [{ edgeId: edge.id, from: edge.a, to: edge.b }]
        : [{ edgeId: edge.id, from: edge.b, to: edge.a }];
    });
    if (arrows.length < 2) return fail('Draw two shore tracks before making them one-way.');
    constraint = { kind: 'one_way', arrows };
  } else if (draft.kind === 'short_budget') {
    constraint = { kind: 'short_budget', budget: 1_000_000 };
  } else {
    constraint = { kind: draft.kind };
  }

  const playable: Playable = {
    nodes,
    edges,
    constraint,
    required: nodes.map((node) => node.id),
    depotId: depot.id,
  };
  const solved = solvePlayable(playable);
  if (!solved) return fail('This night has no way home. Change a track or the rule.');
  const checked = legality(playable, solved.path);
  if (!checked.ok || checked.length !== solved.length) return fail('This night has no way home.');

  const finalConstraint =
    constraint.kind === 'short_budget'
      ? { kind: 'short_budget' as const, budget: solved.length + Math.max(8, Math.round(solved.length * 0.12)) }
      : constraint;

  return {
    ok: true,
    puzzle: {
      id: 'draft',
      date: null,
      seed: 'workshop',
      nodes,
      edges,
      river: EDITOR_RIVER.map((point) => ({ ...point })),
      constraint: finalConstraint,
      required: playable.required,
      depotId: depot.id,
      Lstar: solved.length,
      theme: 'Community night',
      optimalPath: solved.path,
      mapName: communityMapName(rand),
      authorName: null,
    },
  };
}
