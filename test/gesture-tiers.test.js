import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeFlickRotation, FLICK_SCRUBS } from '../src/interaction/gesture-tiers.js';

describe('flick tier (scrub-anchored, chain-independent)', () => {
  const sensitivity = Math.PI / 4 / 100; // the drag sensitivity (matches main.js)
  const vp = { width: 375, height: 640 };

  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

  it('is FLICK_SCRUBS corner-to-corner scrubs of rotation', () => {
    const oneScrub = (vp.width + vp.height) * sensitivity; // Manhattan span × sensitivity
    near(computeFlickRotation(vp, sensitivity), FLICK_SCRUBS * oneScrub);
  });

  it('does NOT depend on chain length — identical viewport, identical result', () => {
    // The function never sees the chain: that is the whole point of the fix.
    assert.equal(computeFlickRotation(vp, sensitivity), computeFlickRotation(vp, sensitivity));
  });

  it('scales linearly with the scrub multiplier', () => {
    const base = computeFlickRotation(vp, sensitivity, 4);
    const doubled = computeFlickRotation(vp, sensitivity, 8);
    assert.ok(Math.abs(doubled - 2 * base) < 1e-9);
  });

  it('honors the live console override (__flickScrubs)', () => {
    const prev = globalThis.__flickScrubs;
    globalThis.__flickScrubs = 10;
    try {
      const oneScrub = (vp.width + vp.height) * sensitivity;
      near(computeFlickRotation(vp, sensitivity), 10 * oneScrub);
    } finally {
      if (prev === undefined) delete globalThis.__flickScrubs;
      else globalThis.__flickScrubs = prev;
    }
  });

  it('degrades safely on missing inputs', () => {
    assert.equal(computeFlickRotation(undefined, undefined), 0);
    assert.equal(computeFlickRotation({ width: 0, height: 0 }, sensitivity), 0);
  });
});
