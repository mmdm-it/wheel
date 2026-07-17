import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeFlickLinks, FLICK_FRACTION, FLICK_MIN_FACTOR } from '../src/interaction/gesture-tiers.js';

describe('flick tier (chain-relative travel)', () => {
  it('is 10% of the chain on big chains — every chain is ten flicks long', () => {
    assert.equal(computeFlickLinks(6000, 15), 600);
    assert.equal(computeFlickLinks(1100, 15), 110);
  });

  it('floors at twice the visible window on small chains', () => {
    // 12-month ring: 10% would be ~1 node; the floor takes over and the
    // glide clamp turns it into "to the end" — the intended tier collapse.
    assert.equal(computeFlickLinks(12, 15), 30);
    assert.equal(computeFlickLinks(12, 15), FLICK_MIN_FACTOR * 15);
  });

  it('crossover sits where fraction and floor agree', () => {
    const visible = 15;
    const crossover = (FLICK_MIN_FACTOR * visible) / FLICK_FRACTION; // 300 links
    assert.equal(computeFlickLinks(crossover, visible), FLICK_MIN_FACTOR * visible);
    assert.ok(computeFlickLinks(crossover + 100, visible) > FLICK_MIN_FACTOR * visible);
  });

  it('degrades safely on missing inputs', () => {
    assert.equal(computeFlickLinks(0, 0), 0);
    assert.equal(computeFlickLinks(NaN, undefined), 0);
    assert.equal(computeFlickLinks(1000, NaN), 100);
  });
});
