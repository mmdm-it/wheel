// THE COMPASS DECIDES (O-152): Howell's bands for rotate and drill, with dead
// zones between them, on the Moto G 2025's page area (Northwest = 331°).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bearingOf, diagonalLean, compassBands, classifyBearing, axisFor } from '../src/core/stroke.js';

describe('the compass decides (O-152)', () => {
  it('bearings are a compass on the glass: north up, clockwise', () => {
    assert.equal(bearingOf(0, -10), 0);
    assert.equal(bearingOf(10, 0), 90);
    assert.equal(bearingOf(0, 10), 180);
    assert.equal(bearingOf(-10, 0), 270);
  });
  it('the Moto G page area leans 29° and gives Howell\'s bands', () => {
    const d = diagonalLean(720, 1314);
    assert.ok(Math.abs(d - 28.7) < 0.1);
    // The first ruling's numbers, with its original inner edges.
    const b = compassBands(29, { cwInner: 10, ccwInner: 10 });
    assert.deepEqual(b.cw, [321, 341]);
    assert.deepEqual(b.out, [351, 131]);
    assert.deepEqual(b.ccw, [141, 161]);
    assert.deepEqual(b.in, [171, 311]);
  });
  it('each band decides its action, and the dead zones decide nothing', () => {
    const at = x => classifyBearing(x, 29, { cwInner: 10, ccwInner: 10 });
    for (const x of [321, 331, 341]) assert.equal(at(x), 'cw', `${x}`);
    for (const x of [141, 151, 161]) assert.equal(at(x), 'ccw', `${x}`);
    for (const x of [351, 0, 61, 90, 131]) assert.equal(at(x), 'out', `${x}`);
    for (const x of [171, 180, 241, 270, 311]) assert.equal(at(x), 'in', `${x}`);
    for (const x of [345, 135, 165, 315]) assert.equal(at(x), null, `${x} is dead`);
  });
  it('a stroke measures along its own axis, the two axes at right angles', () => {
    const cw = axisFor('cw', 29), out = axisFor('out', 29);
    assert.ok(Math.abs(cw.ux * out.ux + cw.uy * out.uy) < 1e-9, 'perpendicular');
    assert.ok(cw.ux < 0 && cw.uy < 0, 'clockwise points up and to the left');
    assert.ok(out.ux > 0 && out.uy < 0, 'drill out points up and to the right');
  });
});

// THE ROTATION BANDS WIDEN BY THE MAGNIFIER'S CORNERS (O-152 amended): on the
// Moto G page area the magnifier sees the upper-left corner at 341° and the
// lower-right at 132.3°, so clockwise reaches 351° and counter-clockwise
// starts at 122.3°; the dead zones keep 10°, drill out narrows.
describe('the rotation bands widen by the magnifier\'s corners (O-152 amended)', () => {
  const opts = { ul: 341, lr: 132.3, cwInner: 10, ccwInner: 10 };
  it('clockwise 321–351, counter-clockwise 122.3–161, drill out 1–112.3, drill in unchanged', () => {
    const b = compassBands(29, opts);
    assert.deepEqual(b.cw, [321, 351]);
    assert.deepEqual(b.ccw.map(x => Math.round(x * 10) / 10), [122.3, 161]);
    assert.deepEqual(b.out.map(x => Math.round(x * 10) / 10), [1, 112.3]);
    assert.deepEqual(b.in, [171, 311]);
  });
  it('the wider rotation and the gaps beside it decide as drawn', () => {
    const at = x => classifyBearing(x, 29, opts);
    assert.equal(at(348), 'cw', 'nearly straight up now turns');
    assert.equal(at(125), 'ccw');
    assert.equal(at(355), null, 'the gap past clockwise');
    assert.equal(at(117), null, 'the gap before counter-clockwise');
    assert.equal(at(45), 'out');
    assert.equal(at(241), 'in');
  });
});

// AND INWARD TO THE THUMB (O-152 amended again): the gesture log's strokes.
describe('the bands cover the logged strokes (O-152, 2026-09-16 log)', () => {
  const opts = { ul: 341, lr: 132.3 };
  it('clockwise 296–351, counter-clockwise 122.3–171, drill out 1–112.3, drill in 181–286', () => {
    const b = compassBands(29, opts);
    assert.deepEqual(b.cw, [296, 351]);
    assert.deepEqual(b.ccw.map(x => Math.round(x * 10) / 10), [122.3, 171]);
    assert.deepEqual(b.in, [181, 286]);
  });
  it('every logged rotation and drill stroke decides as intended', () => {
    const at = x => classifyBearing(x, 29, opts);
    for (const x of [322, 318, 321, 314, 320, 300, 301, 305, 309, 316, 332]) assert.equal(at(x), 'cw', `${x}`);
    for (const x of [156, 166, 161, 143, 150]) assert.equal(at(x), 'ccw', `${x}`);
    for (const x of [39, 53, 60]) assert.equal(at(x), 'out', `${x}`);
    for (const x of [206, 228, 256]) assert.equal(at(x), 'in', `${x}`);
  });
});
