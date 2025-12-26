import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';
import {
  calculatePyramidCapacity,
  sampleSiblings,
  placePyramidNodes,
  getCenterOutwardOrder,
  DEFAULT_ARCS
} from '../src/geometry/child-pyramid.js';

const mkSiblings = count => Array.from({ length: count }, (_, idx) => ({ id: `n-${idx}`, sort: idx }));

describe('child-pyramid geometry', () => {
  it('calculates higher capacity for square vs portrait viewports', () => {
    const square = getViewportInfo(900, 900);
    const portrait = getViewportInfo(720, 1280);

    const squareCap = calculatePyramidCapacity({ width: square.width, height: square.height, ...square });
    const portraitCap = calculatePyramidCapacity({ width: portrait.width, height: portrait.height, ...portrait });

    assert.ok(squareCap.total > portraitCap.total, 'expected more capacity on square viewport');
    assert.ok(squareCap.total >= 6, 'baseline capacity should be non-trivial');
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

  it('places nodes with even angular spacing across arcs', () => {
    const viewport = getViewportInfo(1000, 1000);
    const capacity = calculatePyramidCapacity({ width: viewport.width, height: viewport.height, ...viewport }, { nodeRadius: 10, minAngularSpacingDeg: 6 });
    const siblings = mkSiblings(capacity.total);
    const placements = placePyramidNodes(siblings, { width: viewport.width, height: viewport.height, ...viewport }, { capacity });

    assert.equal(placements.length, siblings.length);
    const angles = placements.map(p => p.angle).sort((a, b) => a - b);
    const expectedStep = capacity.angularRange / (angles.length + 1);
    const diffs = angles.slice(1).map((angle, idx) => angle - angles[idx]);
    diffs.forEach(diff => {
      assert.ok(Math.abs(diff - expectedStep) < expectedStep * 0.25, 'angles should be roughly evenly spaced');
    });
  });

  it('respects per-arc capacity when distributing placements', () => {
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

    const countsByArc = placements.reduce((acc, p) => {
      acc[p.arc] = (acc[p.arc] || 0) + 1;
      return acc;
    }, {});

    assert.equal(countsByArc.inner, 1);
    assert.equal(countsByArc.middle, 1);
    assert.equal(countsByArc.outer, 3);
  });
});
