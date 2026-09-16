// THE ANGLE OF THE STROKE DECIDES (O-142): along the ring turns, across it drills.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { strokeKind, radialAt } from '../src/core/stroke.js';

// A hub far to the right; the finger comes down straight left of it, so the
// radial points left (-1, 0) and the tangent is vertical.
const r = radialAt(100, 500, 1000, 500);

describe('the angle of the stroke (O-142)', () => {
  it('the radial unit points from the hub through the finger', () => {
    assert.deepEqual(r, { rx: -1, ry: 0 });
    assert.equal(radialAt(5, 5, 5, 5), null, 'at the hub there is no direction');
  });
  it('along the ring turns; across it drills, outward in, inward out', () => {
    assert.equal(strokeKind({ vx: 0, vy: 40, ...r }), 'rotate', 'straight along the tangent');
    assert.equal(strokeKind({ vx: -40, vy: 0, ...r }), 'outward', 'away from the hub');
    assert.equal(strokeKind({ vx: 40, vy: 0, ...r }), 'inward', 'toward the hub');
  });
  it('the ambiguous diagonal turns, and the lean is the dial', () => {
    assert.equal(strokeKind({ vx: -30, vy: 30, ...r }), 'rotate', '45° is short of the 50° lean');
    assert.equal(strokeKind({ vx: -30, vy: 30, ...r, drillDeg: 40 }), 'outward', 'a lower lean lets the diagonal drill');
    assert.equal(strokeKind({ vx: -40, vy: 20, ...r }), 'outward', '63° off the tangent drills');
  });
  it('a stroke of no length decides nothing', () => {
    assert.equal(strokeKind({ vx: 0, vy: 0, ...r }), null);
    assert.equal(strokeKind({ vx: 1, vy: 1, rx: NaN, ry: 0 }), null);
  });
});
