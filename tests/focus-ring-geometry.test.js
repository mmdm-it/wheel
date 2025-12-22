import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getViewportInfo,
  getArcParameters,
  getNodeSpacing,
  getViewportWindow,
  calculateNodePositions,
  getMagnifierAngle
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
