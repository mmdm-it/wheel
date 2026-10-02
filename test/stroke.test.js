// THE COMPASS DECIDES (O-152): Howell's bands for rotate and drill, with dead
// zones between them, on the Moto G 2025's page area (Northwest = 331°).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bearingOf, diagonalLean, compassBands, classifyBearing, axisFor, nearestKind, sketchedKind, SKETCHED_WEDGES } from '../src/core/stroke.js';

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

// NO DEAD ZONES (O-191): every stroke is the nearer of the four directions.
describe('the nearer axis decides, and nothing is dead (O-191)', () => {
  it('the four directions themselves', () => {
    assert.equal(nearestKind(331, 29), 'cw');
    assert.equal(nearestKind(151, 29), 'ccw');
    assert.equal(nearestKind(61, 29), 'out');
    assert.equal(nearestKind(241, 29), 'in');
  });
  it('the old dead zones now belong to their nearer neighbour', () => {
    assert.equal(nearestKind(345, 29), 'cw', '14° from cw, 76° from out');
    assert.equal(nearestKind(16, 29), 'cw', '45° each way: the first listed wins, which is turning');
    assert.equal(nearestKind(17, 29), 'out');
    assert.equal(nearestKind(135, 29), 'ccw');
    assert.equal(nearestKind(196, 29), 'ccw'); assert.equal(nearestKind(197, 29), 'in');
    assert.equal(nearestKind(285, 29), 'in'); assert.equal(nearestKind(286, 29), 'cw', 'the tie goes to turning');
  });
  it('the diagonals drill; straight up and down are nearer the band, and turn', () => {
    assert.equal(nearestKind(225, 29), 'in', 'towards the south-west, where the lens is');
    assert.equal(nearestKind(45, 29), 'out', 'towards the north-east, where the sky is');
    assert.equal(nearestKind(180, 29), 'ccw', '29° from the band\'s tangent, 61° from the drill');
    assert.equal(nearestKind(0, 29), 'cw');
  });
});

// THE DEAD ZONES AS HOWELL DREW THEM (2026-10-02): four 75-degree wedges on
// fixed SCREEN bearings with fifteen dead degrees at each midpoint. No lean.
describe('the wedges as drawn (2026-10-02)', () => {
  it('each wedge owns its own middle', () => {
    assert.equal(sketchedKind(42), 'out', 'northeast drills out');
    assert.equal(sketchedKind(132), 'ccw', 'southeast turns counter-clockwise');
    assert.equal(sketchedKind(222), 'in', 'southwest drills in');
    assert.equal(sketchedKind(312), 'cw', 'northwest turns clockwise');
  });
  it('the four midpoints are dead', () => {
    for (const b of [0, 357, 4, 87, 90, 94, 177, 180, 184, 267, 270, 274]) {
      assert.equal(sketchedKind(b), null, `${b} sits in a dead wedge`);
    }
  });
  it('a wedge owns both its edges, so the dead runs are 81-94 and its kin', () => {
    assert.equal(sketchedKind(5), 'out'); assert.equal(sketchedKind(4), null);
    assert.equal(sketchedKind(80), 'out'); assert.equal(sketchedKind(81), null);
    assert.equal(sketchedKind(95), 'ccw'); assert.equal(sketchedKind(94), null);
    assert.equal(sketchedKind(350), 'cw'); assert.equal(sketchedKind(351), null);
  });
  it('the cluster the gesture log caught now reads one way, not two', () => {
    // 2026-10-01 on the phone: 9, 16, 16, 17 and 30 degrees split between
    // turning and drilling at a boundary that fell at 16.
    for (const b of [9, 16, 17, 30, 59]) assert.equal(sketchedKind(b), 'out', `${b} drills out`);
  });
  it('the wedges and the dead zones tile the whole compass exactly once', () => {
    const seen = new Map();
    for (let b = 0; b < 360; b++) seen.set(b, sketchedKind(b));
    const live = [...seen.values()].filter(Boolean).length;
    assert.equal(live, 4 * 76, 'four wedges of 76 whole degrees, edges included');
    assert.equal(360 - live, 4 * 14, 'and fourteen whole dead degrees at each midpoint');
  });
  it('bearings wrap, so the northwest wedge is not split by north', () => {
    assert.equal(sketchedKind(-10), 'cw', '-10 is 350');
    assert.equal(sketchedKind(365), 'out', '365 is 5');
  });
  it('the drills follow O-191: southwest to northeast out, the reverse in', () => {
    assert.equal(sketchedKind(bearingOf(10, -10)), 'out', 'up and right');
    assert.equal(sketchedKind(bearingOf(-10, 10)), 'in', 'down and left');
    assert.equal(SKETCHED_WEDGES.length, 4);
  });
});
