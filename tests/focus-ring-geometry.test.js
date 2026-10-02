import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getViewportInfo,
  getArcParameters,
  getNodeSpacing,
  getViewportWindow,
  calculateNodePositions,
  getMagnifierAngle,
  standardBandCenterline,
  clipPolylineToRect,
  bandBounds
} from '../src/geometry/focus-ring-geometry.js';

test('getViewportInfo computes LSd/SSd and portrait flag', () => {
  const vp = getViewportInfo(120, 200);
  assert.equal(vp.LSd, 200);
  assert.equal(vp.SSd, 120);
  assert.equal(vp.isPortrait, true);
});

test('arc parameters and magnifier angle are finite', () => {
  const vp = getViewportInfo(200, 120);
  const arc = getArcParameters(vp);
  assert.ok(Number.isFinite(arc.hubX));
  assert.ok(Number.isFinite(arc.hubY));
  assert.ok(arc.radius > 0);
  const angle = getMagnifierAngle(vp);
  assert.ok(Number.isFinite(angle));
});

test('calculateNodePositions carries provided radius and respects viewport window', () => {
  const vp = getViewportInfo(200, 200);
  const nodeRadius = 12;
  const nodes = calculateNodePositions([
    { id: 'a', order: 0 },
    { id: 'b', order: 1 }
  ], vp, 0, nodeRadius);

  assert.ok(nodes.length > 0);
  nodes.forEach(node => {
    assert.equal(node.radius, nodeRadius);
    const windowInfo = getViewportWindow(vp, getNodeSpacing(vp));
    assert.ok(node.angle >= windowInfo.startAngle - 1e-9);
    assert.ok(node.angle <= windowInfo.endAngle + 1e-9);
  });
});

// THE BAND IS BOUNDED TO WHAT ITS FLOOR CAN SHOW (O-187).
test('a polyline is cut at the rect, ending on its edge', () => {
  const cut = clipPolylineToRect([[-100, 50], [50, 50], [50, 200]], [0, 0, 100, 100]);
  assert.deepEqual(cut, [[0, 50], [50, 50], [50, 100]]);
});
test('the strata band stays within 2.6 viewports of the centre and reaches that edge; unbounded it runs seven screens', () => {
  const vp = getViewportInfo(360, 800);
  const box = pts => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const bounded = box(standardBandCenterline(vp));
  const [x0, y0, x1, y1] = bandBounds(360, 800, 2.6);
  assert.ok(bounded[0] >= x0 - 0.01 && bounded[1] >= y0 - 0.01 && bounded[2] <= x1 + 0.01 && bounded[3] <= y1 + 0.01, `within the reach: ${bounded}`);
  const ends = standardBandCenterline(vp);
  const onEdge = ([x, y]) => Math.abs(x - x0) < 0.01 || Math.abs(x - x1) < 0.01 || Math.abs(y - y0) < 0.01 || Math.abs(y - y1) < 0.01;
  assert.ok(onEdge(ends[0]) && onEdge(ends[ends.length - 1]), 'both runs end on the edge of the reach, so the band still spans it');
  const free = box(standardBandCenterline(vp, { reach: 0 }));
  assert.ok(free[3] - free[1] > 5000, 'unbounded, the runs make it thousands of pixels tall');
});
