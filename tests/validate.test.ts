import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legality } from '../src/shared/route';
import { solvePlayable } from '../src/shared/solve';
import type { Playable, Stop } from '../src/shared/types';

function stop(id: string, district: Stop['district']): Stop {
  return { id, name: id, x: 0, y: 0, district };
}

describe('solver', () => {
  it('retraces a dead-end spur to get home', () => {
    const playable: Playable = {
      nodes: [stop('A', 'depot'), stop('B', 'stop'), stop('C', 'works')],
      edges: [
        { id: 'ab', a: 'A', b: 'B', w: 10, bridge: false },
        { id: 'bc', a: 'B', b: 'C', w: 10, bridge: false },
      ],
      constraint: { kind: 'short_budget', budget: 80 },
      required: ['A', 'B', 'C'],
      depotId: 'A',
    };
    const solved = solvePlayable(playable);
    assert.ok(solved);
    assert.equal(solved.length, 40);
    assert.deepEqual(solved.path, ['A', 'B', 'C', 'B', 'A']);
    const checked = legality(playable, solved.path);
    assert.equal(checked.ok, true);
    if (checked.ok) assert.equal(checked.length, 40);
  });

  it('keeps the square when a diagonal is longer than the boundary', () => {
    const playable: Playable = {
      nodes: [stop('A', 'depot'), stop('B', 'market'), stop('C', 'hill'), stop('D', 'works')],
      edges: [
        { id: 'ab', a: 'A', b: 'B', w: 10, bridge: false },
        { id: 'bc', a: 'B', b: 'C', w: 10, bridge: false },
        { id: 'cd', a: 'C', b: 'D', w: 10, bridge: false },
        { id: 'da', a: 'D', b: 'A', w: 10, bridge: false },
        { id: 'ac', a: 'A', b: 'C', w: 25, bridge: false },
      ],
      constraint: { kind: 'market_first' },
      required: ['A', 'B', 'C', 'D'],
      depotId: 'A',
    };
    const solved = solvePlayable(playable);
    assert.ok(solved);
    assert.equal(solved.length, 40);
    const marketAt = solved.path.indexOf('B');
    const hillAt = solved.path.indexOf('C');
    assert.ok(marketAt !== -1 && marketAt < hillAt);
  });

  it('rejects a hop that skips a track', () => {
    const playable: Playable = {
      nodes: [stop('A', 'depot'), stop('B', 'stop'), stop('C', 'stop')],
      edges: [
        { id: 'ab', a: 'A', b: 'B', w: 5, bridge: false },
        { id: 'bc', a: 'B', b: 'C', w: 5, bridge: false },
      ],
      constraint: { kind: 'short_budget', budget: 100 },
      required: ['A', 'B', 'C'],
      depotId: 'A',
    };
    const skipped = legality(playable, ['A', 'C', 'A']);
    assert.equal(skipped.ok, false);
    const home = solvePlayable(playable);
    assert.ok(home);
    const checked = legality(playable, home.path);
    assert.equal(checked.ok, true);
  });

  it('honours a one-way arrow', () => {
    const playable: Playable = {
      nodes: [stop('A', 'depot'), stop('B', 'stop'), stop('C', 'stop')],
      edges: [
        { id: 'ab', a: 'A', b: 'B', w: 4, bridge: false },
        { id: 'bc', a: 'B', b: 'C', w: 4, bridge: false },
        { id: 'ca', a: 'C', b: 'A', w: 4, bridge: false },
      ],
      constraint: { kind: 'one_way', arrows: [{ edgeId: 'ab', from: 'A', to: 'B' }] },
      required: ['A', 'B', 'C'],
      depotId: 'A',
    };
    const against = legality(playable, ['A', 'C', 'B', 'A']);
    assert.equal(against.ok, false);
    const solved = solvePlayable(playable);
    assert.ok(solved);
    assert.equal(solved.path[1], 'B');
  });
});
