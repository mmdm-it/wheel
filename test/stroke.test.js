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
    const b = compassBands(29);
    assert.deepEqual(b.cw, [321, 341]);
    assert.deepEqual(b.out, [351, 131]);
    assert.deepEqual(b.ccw, [141, 161]);
    assert.deepEqual(b.in, [171, 311]);
  });
  it('each band decides its action, and the dead zones decide nothing', () => {
    const at = x => classifyBearing(x, 29);
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
