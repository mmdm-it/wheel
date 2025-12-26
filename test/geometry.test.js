import test from 'node:test';
import assert from 'node:assert/strict';
import { getViewportInfo, getArcParameters, getViewportWindow, getMagnifierAngle, calculateNodePositions } from '../src/geometry/focus-ring-geometry.js';

const viewport = getViewportInfo(375, 667);

test('viewport info computes LSd/SSd', () => {
  assert.equal(viewport.LSd, 667);
  assert.equal(viewport.SSd, 375);
  assert.equal(viewport.isPortrait, true);
});

test('arc parameters use v2 formulas', () => {
  const arc = getArcParameters(viewport);
  assert.ok(arc.hubX > viewport.width); // off-screen to the right
  assert.equal(arc.hubY, 0);
  assert.ok(arc.radius > viewport.height / 2);
});

test('viewport window caps visible nodes', () => {
  const windowInfo = getViewportWindow(viewport);
  assert.ok(windowInfo.maxNodes <= 21);
  assert.ok(windowInfo.startAngle < windowInfo.endAngle);
  // start angle should be measured from lower-right corner to the hub
  const cornerAngle = Math.atan2(viewport.height - 0, viewport.width - getArcParameters(viewport).hubX);
  assert.ok(Math.abs(windowInfo.startAngle - cornerAngle) < 0.01);
});

test('magnifier angle points to center', () => {
  const angle = getMagnifierAngle(viewport);
  assert.ok(angle > 0); // around 150° for this viewport
});

test('calculateNodePositions filters to visible arc', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `item-${i}` }));
  const nodes = calculateNodePositions(items, viewport, 0);
  assert.ok(nodes.length > 0);
  nodes.forEach(node => {
    assert.ok(node.x && node.y);
  });
});
