// THE LARGEST CHILD (O-132): the node the lens's down-swipe drills into —
// the best prominence tier in the sky, ties to the first sibling.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
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
  it('the node just drilled out from comes first, over the favourite (O-198: the reciprocal swipe)', () => {
    assert.equal(largestChildIndex([node(0, 1), { ...node(7), standout: true }, node(2, 2)]), 1);
  });
  it('nothing to drill into is -1', () => {
    assert.equal(largestChildIndex([]), -1);
    assert.equal(largestChildIndex(null), -1);
  });
});

// O-327 (Howell 2026-11-21): every sky has one large star and only one, and a
// tap on the lens takes it: the node just visited, else the landmark, else
// the first.
describe('the sky\'s one large star (O-327)', async () => {
  const { largeChildIndex, largeGridNode, GRID_LARGE_SCALE } = await import('../src/pyramid/volume-pyramid.js');
  const kid = (id, prominence) => (prominence ? { id, prominence } : { id });
  it('the node just visited wins over the landmark', () => {
    assert.equal(largeChildIndex([kid('a'), kid('b', 1), kid('c')], { standoutId: 'c' }), 2);
  });
  it('a landmark earns nothing (O-329): unvisited, the first child is large', () => {
    assert.equal(largeChildIndex([kid('a'), kid('b', 1), kid('c', 1)]), 0);
    assert.equal(largeChildIndex([kid('a', 2), kid('b', 1)], { standoutId: 'gone' }), 0);
  });
  it('a visit is permanent and supersedes the landmark; the latest visit wins (O-328)', () => {
    assert.equal(largeChildIndex([kid('a'), kid('b', 1), { id: 'c', visited: 3 }]), 2);
    assert.equal(largeChildIndex([{ id: 'a', visited: 9 }, kid('b', 1), { id: 'c', visited: 3 }]), 0);
    // the node just drilled out from still comes first
    assert.equal(largeChildIndex([{ id: 'a', visited: 9 }, kid('b', 1), kid('c')], { standoutId: 'c' }), 2);
    // an unvisited sky shows its first child, landmark or no (O-329)
    assert.equal(largeChildIndex([{ id: 'a', visited: 0 }, kid('b', 1)]), 0);
  });
  it('the record: latest per leaf, a chapter keeps one place, volumes apart', async () => {
    const store = new Map();
    globalThis.window = { localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } };
    try {
      const { visitedSeq, visitedVersion, markVisited, forgetVisited } = await import('../src/core/visited.js');
      forgetVisited();
      const v0 = visitedVersion();
      markVisited('one', ['u1'], ['u1', 'u2', 'u3']);
      markVisited('one', ['u3', 'u3b'], ['u1', 'u2', 'u3']);
      assert.equal(visitedSeq('one', 'u1'), 0, 'superseded by the later visit in its chapter');
      assert.equal(visitedSeq('one', 'u3'), 2);
      assert.equal(visitedSeq('one', 'u3b'), 2);
      assert.equal(visitedSeq('two', 'u3'), 0);
      assert.ok(visitedVersion() > v0);
      assert.match(store.get('wheel-visited-v1'), /"u3":2/);
    } finally { delete globalThis.window; }
  });
  it('else the first: a lesser rank earns nothing, and a sky is never without one', () => {
    assert.equal(largeChildIndex([kid('a'), kid('b', 2), kid('c')]), 0);
    assert.equal(largeChildIndex([kid('only')]), 0);
    assert.equal(largeChildIndex([]), -1);
  });
  it('the star drawn large is the tap\'s answer, whatever else the nodes say', () => {
    assert.equal(largestChildIndex([{ item: kid('a', 1) }, { item: kid('b'), large: true }, { item: kid('c'), standout: true }]), 1);
  });
  it('the month\'s lattice: the day just visited, else the first day; never a header or a dimmed day', () => {
    const cell = (id, serial, level = 'day', dim = false) => ({ id, dim, item: { id, level, serial } });
    const grid = [cell('wd:0', undefined, 'weekday'), cell('d30', 9, 'day', true), cell('d2', 11), cell('d1', 10), cell('d3', 12)];
    assert.equal(largeGridNode(grid).id, 'd1');
    assert.equal(largeGridNode(grid, 'd3').id, 'd3');
    assert.equal(largeGridNode(grid, 'elsewhere').id, 'd1');
    assert.equal(largeGridNode([cell('wd:0', undefined, 'weekday')]), null);
    assert.ok(GRID_LARGE_SCALE > 1 && GRID_LARGE_SCALE <= 1.3, 'larger, and still inside its own gap');
  });
  it('the host draws from the same decision it taps by', () => {
    const host = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
    assert.match(host, /large: isLarge\(child\),/);
    assert.match(host, /const big = largeGridNode\(grid\.nodes, leftId\);/);
    assert.match(host, /largestPyramidIndex: \(\) => largestChildIndex\(lastPyramidData\?\.nodes \|\| \[\]\)/);
  });
});
