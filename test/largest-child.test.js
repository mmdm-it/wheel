// THE LARGEST CHILD (O-132): the node the lens's down-swipe drills into —
// the best prominence tier in the sky, ties to the first sibling.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { largestChildIndex } from '../src/pyramid/volume-pyramid.js';

const node = (order, prominence) => ({ item: { id: `n${order}`, order, ...(prominence ? { prominence } : {}) } });

describe('the largest child (O-132)', () => {
  it('picks the tier-1 star, wherever the sky seated it', () => {
    assert.equal(largestChildIndex([node(0), node(1, 2), node(2, 1), node(3)]), 2);
  });
  it('a sky with no ranks drills into its beginning — the first sibling by order, not by seat', () => {
    assert.equal(largestChildIndex([node(5), node(2), node(9)]), 1);
  });
  it('ties within a tier go to the first sibling', () => {
    assert.equal(largestChildIndex([node(3, 1), node(1, 1), node(2, 2)]), 1);
  });
  it('nothing to drill into is -1', () => {
    assert.equal(largestChildIndex([]), -1);
    assert.equal(largestChildIndex(null), -1);
  });
});
