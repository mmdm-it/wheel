import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { bearingOf, bearingOfUnit, localAxes, quadrantKind, axisOf } from '../src/core/stroke.js';

// The Moto G's page area: 347 × 633 css px; the ring's centre by the v2
// formula sits at (751, 0), just off the right edge at the top.
const HUB = { x: 751, y: 0 };
const axesAt = (x, y) => localAxes(x, y, HUB.x, HUB.y);
const near = (a, b, tol = 0.5) => Math.abs(((a - b + 540) % 360) - 180) <= tol;

describe('the local compass (O-200)', () => {
  test('bearings: north 0, east 90, south 180, west 270', () => {
    assert.equal(bearingOf(0, -10), 0);
    assert.equal(bearingOf(10, 0), 90);
    assert.equal(bearingOf(0, 10), 180);
    assert.equal(bearingOf(-10, 0), 270);
  });

  test('at the lens the tangent points up-left and the radial line up-right, toward the centre', () => {
    const a = axesAt(159, 463);   // the magnifier, 142° round the circle
    assert.ok(near(bearingOfUnit(a.cw), 322, 1), `cw tangent ${bearingOfUnit(a.cw)}`);
    assert.ok(near(bearingOfUnit(a.out), 52, 1), `out radial ${bearingOfUnit(a.out)}`);
    assert.ok(Math.abs(a.cw.ux * a.out.ux + a.cw.uy * a.out.uy) < 1e-9, 'at right angles');
  });

  test('the axes turn with the point of impact: nearly vertical at the top left, leaning across the middle', () => {
    assert.ok(near(bearingOfUnit(axesAt(80, 250).cw), 339, 1), 'top left: almost straight up');
    assert.ok(near(bearingOfUnit(axesAt(220, 500).cw), 317, 1), 'middle: leaning');
    assert.ok(near(bearingOfUnit(axesAt(330, 700).cw), 301, 1), 'lower right: leaning further');
  });

  test('clockwise is the clockwise of a clock face around the centre', () => {
    // Straight below the centre, 9 o\'clock seen from it is to the left; moving
    // up on the left side of a clock is clockwise.
    const left = axesAt(HUB.x - 500, HUB.y);
    assert.ok(near(bearingOfUnit(left.cw), 0), 'left of the centre: clockwise is up');
    const below = axesAt(HUB.x, HUB.y + 500);
    assert.ok(near(bearingOfUnit(below.cw), 270), 'below the centre: clockwise is left');
  });

  test('the four quarters: the nearer axis wins, no stroke is dead', () => {
    const a = axesAt(159, 463);
    const along = (bearing, len = 10) => [len * Math.sin(bearing * Math.PI / 180), -len * Math.cos(bearing * Math.PI / 180)];
    assert.equal(quadrantKind(...along(322), a), 'cw');
    assert.equal(quadrantKind(...along(142), a), 'ccw');
    assert.equal(quadrantKind(...along(52), a), 'out');
    assert.equal(quadrantKind(...along(232), a), 'in');
    // 44° off an axis is still that axis; 46° off is the neighbour.
    assert.equal(quadrantKind(...along(322 + 44), a), 'cw');
    assert.equal(quadrantKind(...along(322 + 46), a), 'out');
    assert.equal(quadrantKind(...along(52 + 44), a), 'out');
    assert.equal(quadrantKind(...along(52 + 46), a), 'ccw');
    // Every whole degree is one of the four.
    const seen = new Set();
    for (let b = 0; b < 360; b++) seen.add(quadrantKind(...along(b), a));
    assert.deepEqual([...seen].sort(), ['ccw', 'cw', 'in', 'out']);
  });

  test('a tie is a turn', () => {
    const a = { cw: { ux: 1, uy: 0 }, out: { ux: 0, uy: -1 } };
    assert.equal(quadrantKind(10, -10, a), 'cw');
    assert.equal(quadrantKind(-10, 10, a), 'ccw');
  });

  test('the measuring axis of each kind, and the opposite kinds point opposite ways', () => {
    const a = axesAt(159, 463);
    assert.deepEqual(axisOf('cw', a), a.cw);
    assert.deepEqual(axisOf('out', a), a.out);
    const ccw = axisOf('ccw', a), inn = axisOf('in', a);
    assert.ok(Math.abs(ccw.ux + a.cw.ux) < 1e-12 && Math.abs(ccw.uy + a.cw.uy) < 1e-12);
    assert.ok(Math.abs(inn.ux + a.out.ux) < 1e-12 && Math.abs(inn.uy + a.out.uy) < 1e-12);
    assert.equal(axisOf('tap', a), null);
  });

  test('at the centre itself north and east stand in', () => {
    const a = axesAt(HUB.x, HUB.y);
    assert.deepEqual(a, { cw: { ux: 0, uy: -1 }, out: { ux: 1, uy: 0 } });
  });
});
