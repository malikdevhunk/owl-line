import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampElapsed, rankKey, starsFor, weekKey } from '../src/shared/score';

describe('stars and rank', () => {
  it('gives three stars only for the optimal length', () => {
    assert.equal(starsFor(1000, 1000), 3);
    assert.equal(starsFor(999, 1000), 3);
  });

  it('gives two stars up to ten percent over', () => {
    assert.equal(starsFor(1100, 1000), 2);
    assert.equal(starsFor(1101, 1000), 1);
  });

  it('lets a shorter route outrank any faster longer one', () => {
    const shorter = rankKey(142, 90_000);
    const longer = rankKey(143, 500);
    assert.ok(shorter < longer);
  });

  it('breaks ties on the clock', () => {
    assert.ok(rankKey(142, 1000) < rankKey(142, 1001));
  });

  it('ranks a richer week ahead of a faster thin one', () => {
    assert.ok(weekKey(12, 400) < weekKey(11, 10));
  });

  it('refuses a zero-millisecond finish', () => {
    assert.equal(clampElapsed(0, 8), 8 * 120);
    assert.equal(clampElapsed(50_000, 4), 50_000);
    assert.equal(clampElapsed(9_999_999, 4), 30 * 60 * 1000);
  });
});
