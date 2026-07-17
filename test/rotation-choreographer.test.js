import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RotationChoreographer } from '../src/interaction/rotation-choreographer.js';


// C.3: glideTo — the double-flick's travel primitive. Must arrive exactly
// at the (clamped) target and fire onArrive once; must not disturb bounds.
describe('glideTo', () => {
  it('arrives at the clamped target and calls onArrive', async () => {
    const renders = [];
    const ch = new RotationChoreographer({
      onRender: r => renders.push(r),
      minRotation: -10,
      maxRotation: 10
    });
    let arrived = 0;
    await new Promise(resolve => {
      ch.glideTo(99, 40, () => { arrived += 1; resolve(); });
    });
    assert.equal(ch.getRotation(), 10, 'clamps an over-limit target to the bound');
    assert.equal(arrived, 1);
    assert.ok(renders.length >= 2, 'renders intermediate frames');
    const last = renders[renders.length - 1];
    assert.equal(last, 10, 'final render lands on the bound');
  });

  it('no-ops (but still calls onArrive) when already at the target', async () => {
    const ch = new RotationChoreographer({ onRender: () => {}, minRotation: -5, maxRotation: 5 });
    ch.setRotation(5);
    let arrived = 0;
    ch.glideTo(5, 40, () => { arrived += 1; });
    assert.equal(arrived, 1);
  });
});
