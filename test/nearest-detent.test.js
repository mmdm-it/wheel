import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nearestDetent } from '../src/core/nearest-detent.js';

// THE SECTOR FOLLOWS THE RING WHILE IT TURNS (O-256, Howell 2026-10-31).
describe('nearestDetent: the visible node nearest the magnifier, by half (O-84, O-256)', () => {
  const seat = 1.0;
  it('picks the node whose angle is closest to the seat and reports how far it must still turn', () => {
    const nodes = [
      { item: { id: 'a' }, index: 4, angle: 0.4 },
      { item: { id: 'b' }, index: 5, angle: 0.9 },
      { item: { id: 'c' }, index: 6, angle: 1.6 }
    ];
    const near = nearestDetent(nodes, () => seat);
    assert.equal(near.index, 5);
    assert.equal(near.part, 0);
    assert.ok(Math.abs(near.delta - 0.1) < 1e-9);
  });
  it('a split item offers a detent per half, and the nearer half wins', () => {
    const nodes = [{ item: { id: 'long' }, index: 2, angle: 1.25 }];
    const near = nearestDetent(nodes, (item, part) => seat + (part === 0 ? -0.2 : 0.2), () => 2);
    assert.equal(near.part, 1);
  });
  it('the version footnote is never a seat, and an empty window yields nothing', () => {
    assert.equal(nearestDetent([{ item: { placebo: true }, index: 0, angle: seat }], () => seat), null);
    assert.equal(nearestDetent([], () => seat), null);
    assert.equal(nearestDetent([{ item: null, index: 0, angle: seat }], () => seat), null);
  });
});
