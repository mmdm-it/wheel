import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { getViewportInfo, getMagnifierAngle } from '../src/geometry/focus-ring-geometry.js';
import {
  calculatePyramidCapacity,
  sampleSiblings,
  placePyramidNodes,
  getCenterOutwardOrder,
  DEFAULT_ARCS
} from '../src/geometry/child-pyramid.js';

const mkSiblings = count => Array.from({ length: count }, (_, idx) => ({ id: `n-${idx}`, sort: idx }));

describe('child-pyramid geometry', () => {
  it('calculates capacity using magnifier->180deg window', () => {
    const viewport = getViewportInfo(900, 900);

    const cap = calculatePyramidCapacity({ width: viewport.width, height: viewport.height, ...viewport });
    const expectedStart = getMagnifierAngle(viewport);
    const expectedRange = Math.PI - expectedStart;

    assert.ok(cap.total >= 1, 'baseline capacity should be at least one node');
    assert.ok(cap.angularRange > 0, 'angular range should be positive');
    assert.ok(Math.abs(cap.cornerAngle - expectedStart) < 1e-9, 'start angle should align to magnifier angle');
    assert.ok(Math.abs(cap.angularRange - expectedRange) < 1e-9, 'angular range should be magnifier->180deg');
  });

  it('samples siblings deterministically and keeps endpoints', () => {
    const siblings = mkSiblings(150);
    const sampled = sampleSiblings(siblings, 15);

    assert.equal(sampled.length, 15);
    assert.equal(sampled[0].id, 'n-0');
    assert.equal(sampled.at(-1).id, 'n-149');

    const orderIndices = sampled.map(s => siblings.findIndex(o => o.id === s.id));
    const sorted = [...orderIndices].sort((a, b) => a - b);
    assert.deepEqual(orderIndices, sorted, 'sampling should preserve order');
  });

  it('uses center-outward visual ordering for ballet effect', () => {
    assert.deepEqual(getCenterOutwardOrder(7), [3, 4, 2, 5, 1, 6, 0]);
    assert.deepEqual(getCenterOutwardOrder(6), [2, 3, 1, 4, 0, 5]);
  });

  it('places nodes in spiral pattern', () => {
    const viewport = getViewportInfo(1000, 1000);
    const capacity = calculatePyramidCapacity({ width: viewport.width, height: viewport.height, ...viewport }, { nodeRadius: 10, minAngularSpacingDeg: 6 });
    const siblings = mkSiblings(10);
    const placements = placePyramidNodes(siblings, { width: viewport.width, height: viewport.height, ...viewport }, { capacity });

    assert.equal(placements.length, siblings.length);
    // Verify all placements have valid coordinates
    placements.forEach(p => {
      assert.ok(Number.isFinite(p.x), 'x should be finite');
      assert.ok(Number.isFinite(p.y), 'y should be finite');
      assert.ok(Number.isFinite(p.angle), 'angle should be finite');
      assert.equal(p.arc, 'spiral', 'arc should be spiral');
    });
  });

  it('places nodes within viewport boundaries', () => {
    const viewport = getViewportInfo(450, 450);
    const capacity = calculatePyramidCapacity({ width: viewport.width, height: viewport.height, ...viewport });
    const siblings = mkSiblings(Math.min(5, capacity.total || 5));
    const placements = placePyramidNodes(siblings, { width: viewport.width, height: viewport.height, ...viewport }, { capacity });

    // Verify placements are within viewport bounds
    placements.forEach(p => {
      assert.ok(p.x >= 0 && p.x <= viewport.width, `x (${p.x}) should be within viewport width (${viewport.width})`);
      assert.ok(p.y >= 0 && p.y <= viewport.height, `y (${p.y}) should be within viewport height (${viewport.height})`);
    });
  });

  it('places all nodes in spiral pattern', () => {
    const viewport = getViewportInfo(900, 900);
    const siblings = mkSiblings(5);
    const capacity = {
      angularRange: Math.PI / 2,
      magnifierAngle: Math.PI / 3,
      cornerAngle: Math.PI / 6,
      arcs: [
        { ...DEFAULT_ARCS[0], capacity: 1 },
        { ...DEFAULT_ARCS[1], capacity: 1 },
        { ...DEFAULT_ARCS[2], capacity: 3 }
      ],
      total: 5
    };

    const placements = placePyramidNodes(siblings, { width: viewport.width, height: viewport.height, ...viewport }, { capacity });

    // Verify all siblings are placed
    assert.equal(placements.length, siblings.length);
    // Spiral layout uses 'spiral' arc name
    placements.forEach(p => {
      assert.equal(p.arc, 'spiral');
    });
  });
});
