import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays } from '../src/shared/dates';
import { generateDaily } from '../src/shared/generate';
import { anySegmentsCross, crossesRiver } from '../src/shared/geometry';
import { presentPuzzle } from '../src/shared/present';
import { legality } from '../src/shared/route';
import { starsFor } from '../src/shared/score';
import { solvePlayable } from '../src/shared/solve';
import type { Puzzle } from '../src/shared/types';
import { realizeDraft } from '../src/shared/workshop';

function degree(puzzle: Puzzle, id: string): number {
  return puzzle.edges.filter((edge) => edge.a === id || edge.b === id).length;
}

function assertFair(puzzle: Puzzle): void {
  assert.ok(puzzle.nodes.length >= 8 && puzzle.nodes.length <= 12);
  assert.equal(new Set(puzzle.nodes.map((node) => node.id)).size, puzzle.nodes.length);
  for (const node of puzzle.nodes) {
    assert.ok(degree(puzzle, node.id) <= 4);
    assert.ok(degree(puzzle, node.id) >= 1);
  }
  assert.ok(degree(puzzle, puzzle.depotId) >= 2);
  const pairs = puzzle.edges.flatMap((edge) => {
    const a = puzzle.nodes.find((node) => node.id === edge.a);
    const b = puzzle.nodes.find((node) => node.id === edge.b);
    return a && b ? [{ a, b }] : [];
  });
  assert.equal(anySegmentsCross(pairs), false);

  for (const edge of puzzle.edges) {
    const a = puzzle.nodes.find((node) => node.id === edge.a);
    const b = puzzle.nodes.find((node) => node.id === edge.b);
    assert.ok(a && b);
    if (edge.bridge) assert.equal(crossesRiver(puzzle.river, a, b), true);
  }
  assert.ok(puzzle.edges.filter((edge) => edge.bridge).length >= 2);

  const again = solvePlayable(puzzle);
  assert.ok(again, puzzle.date ?? puzzle.id);
  assert.equal(again.length, puzzle.Lstar);
  assert.deepEqual(again.path, puzzle.optimalPath);
  const checked = legality(puzzle, puzzle.optimalPath);
  assert.equal(checked.ok, true);
  if (checked.ok) {
    assert.equal(checked.length, puzzle.Lstar);
    assert.equal(starsFor(checked.length, puzzle.Lstar), 3);
  }

  if (puzzle.constraint.kind === 'bridge_closed') {
    const closed = puzzle.constraint.edgeId;
    for (let i = 0; i < puzzle.optimalPath.length - 1; i++) {
      const from = puzzle.optimalPath[i];
      const to = puzzle.optimalPath[i + 1];
      const used = puzzle.edges.find(
        (edge) =>
          edge.id === closed &&
          ((edge.a === from && edge.b === to) || (edge.a === to && edge.b === from))
      );
      assert.equal(used, undefined);
    }
  }
  if (puzzle.constraint.kind === 'one_way') {
    for (const arrow of puzzle.constraint.arrows) {
      const edge = puzzle.edges.find((item) => item.id === arrow.edgeId);
      assert.ok(edge);
      for (let i = 0; i < puzzle.optimalPath.length - 1; i++) {
        const from = puzzle.optimalPath[i];
        const to = puzzle.optimalPath[i + 1];
        const uses =
          (edge.a === from && edge.b === to) || (edge.a === to && edge.b === from);
        if (!uses) continue;
        assert.equal(from, arrow.from);
        assert.equal(to, arrow.to);
      }
    }
  }
  if (puzzle.constraint.kind === 'market_first') {
    const market = puzzle.nodes.find((node) => node.district === 'market');
    const hill = puzzle.nodes.find((node) => node.district === 'hill');
    assert.ok(market && hill);
    assert.ok(puzzle.optimalPath.indexOf(market.id) < puzzle.optimalPath.indexOf(hill.id));
  }
  if (puzzle.constraint.kind === 'works_last') {
    const works = puzzle.nodes.find((node) => node.district === 'works');
    assert.ok(works);
    assert.equal(puzzle.optimalPath[puzzle.optimalPath.length - 2], works.id);
  }
  if (puzzle.constraint.kind === 'short_budget') {
    assert.ok(puzzle.Lstar <= puzzle.constraint.budget);
    assert.ok(puzzle.constraint.budget <= puzzle.Lstar + Math.max(8, Math.round(puzzle.Lstar * 0.12)));
  }

  const shown = presentPuzzle(puzzle);
  assert.equal('optimalPath' in shown, false);
  assert.equal('Lstar' in shown, false);
}

describe('daily maps', () => {
  it('builds a fair solvable night for every date the judges will see', () => {
    const kinds = new Set<string>();
    let cursor = '2026-12-01';
    for (let i = 0; i < 16; i++) {
      const puzzle = generateDaily(cursor);
      assert.equal(puzzle.date, cursor);
      assertFair(puzzle);
      kinds.add(puzzle.constraint.kind);
      cursor = addDays(cursor, 1);
    }
    assert.ok(kinds.size >= 4, `expected several rules, saw ${[...kinds].join(', ')}`);
  });

  it('stays solvable across two months and does not repeat a map', () => {
    const shapes = new Set<string>();
    let cursor = '2026-11-18';
    for (let i = 0; i < 60; i++) {
      const puzzle = generateDaily(cursor);
      assertFair(puzzle);
      shapes.add(puzzle.nodes.map((node) => `${node.x},${node.y}`).join(';'));
      cursor = addDays(cursor, 1);
    }
    assert.ok(shapes.size >= 50);
  });

  it('is deterministic for a date', () => {
    assert.deepEqual(generateDaily('2026-12-08'), generateDaily('2026-12-08'));
  });
});

describe('workshop drafts', () => {
  it('refuses a map that is too small to publish', () => {
    const result = realizeDraft(
      {
        nodes: [{ id: 'n0', x: 100, y: 100, district: 'depot' }],
        edges: [],
        kind: 'short_budget',
      },
      () => 0.2
    );
    assert.equal(result.ok, false);
  });

  it('publishes a hand-checked eight-stop night', () => {
    const nodes = [
      { id: 'n0', x: 160, y: 220, district: 'market' as const },
      { id: 'n1', x: 360, y: 200, district: 'depot' as const },
      { id: 'n2', x: 560, y: 230, district: 'works' as const },
      { id: 'n3', x: 760, y: 210, district: 'stop' as const },
      { id: 'n4', x: 160, y: 780, district: 'hill' as const },
      { id: 'n5', x: 360, y: 800, district: 'harbor' as const },
      { id: 'n6', x: 560, y: 770, district: 'stop' as const },
      { id: 'n7', x: 760, y: 800, district: 'stop' as const },
    ];
    const edges = [
      ['e0', 'n0', 'n1'],
      ['e1', 'n1', 'n2'],
      ['e2', 'n2', 'n3'],
      ['e3', 'n4', 'n5'],
      ['e4', 'n5', 'n6'],
      ['e5', 'n6', 'n7'],
      ['e6', 'n0', 'n4'],
      ['e7', 'n3', 'n7'],
    ].map(([id, a, b]) => ({ id: id ?? '', a: a ?? '', b: b ?? '' }));
    const result = realizeDraft({ nodes, edges, kind: 'works_last' }, () => 0.4);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.puzzle.constraint.kind, 'works_last');
      assert.ok(result.puzzle.mapName);
      assert.match(result.puzzle.mapName, /^[A-Za-z0-9 ,']+$/);
      assertFair({ ...result.puzzle, date: '2026-12-01' });
    }
  });
});
