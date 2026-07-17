import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeChildPyramidGeometry } from '../src/geometry/child-pyramid-geometry.js';

describe('computeChildPyramidGeometry', () => {
  const viewport = { width: 800, height: 800, SSd: 800, LSd: 800 };
  const magnifier = { x: 100, y: 400, radius: 48, angle: 0 };
  const arcParams = { hubX: 100, hubY: 100, radius: 120 };

  it('returns fan lines, spiral path, and intersections', () => {
    const result = computeChildPyramidGeometry(viewport, magnifier, arcParams, {});
    assert.ok(Array.isArray(result.fanLines));
    assert.ok(result.fanLines.length > 0);
    assert.ok(result.spiral?.path?.length > 0);
    assert.ok(Array.isArray(result.intersections));
  });

  it('respects logo bounds by reducing some fan lines', () => {
    const withLogo = computeChildPyramidGeometry(viewport, magnifier, arcParams, {
      logoBounds: { left: 700, right: 770, top: 0, bottom: 90 }
    });
    const withoutLogo = computeChildPyramidGeometry(viewport, magnifier, arcParams, {});
    assert.ok(withLogo.fanLines.length <= withoutLogo.fanLines.length);
  });
});

// Phase B audit M7: the at-least-one guarantee — the fallback that prevents
// unreachable subtrees when the fan/spiral hunt starves — must never lose
// its floor of exactly one node. childCount 4 on a phone-shaped viewport is
// the historically starving case (the empty-Lombardini-pyramid bug).
describe('at-least-one guarantee', () => {
  it('never returns zero intersections for a non-empty child set', () => {
    const phone = { width: 393, height: 851 };
    const mag = { x: 196, y: 700, r: 40 };
    const arc = { SSd: 393, arcCenterX: 196, arcCenterY: 851, arcRadius: 420 };
    for (const childCount of [1, 2, 3, 4, 5, 7, 12, 50]) {
      const r = computeChildPyramidGeometry(phone, mag, arc, { childCount });
      assert.ok(
        r.intersections.length >= 1,
        `childCount ${childCount} produced zero intersections`
      );
    }
  });

  it('synthetic fallback hits carry the synthetic flag and null fanId', () => {
    // A viewport crushed enough that the hunt cannot place anything real.
    const tiny = { width: 200, height: 300 };
    const mag = { x: 100, y: 250, r: 30 };
    const arc = { SSd: 200, arcCenterX: 100, arcCenterY: 300, arcRadius: 210 };
    const r = computeChildPyramidGeometry(tiny, mag, arc, { childCount: 4 });
    assert.ok(r.intersections.length >= 1, 'expected at least the guaranteed node');
    for (const hit of r.intersections.filter(h => h.synthetic)) {
      assert.equal(hit.fanId, null);
    }
  });
});

// The render loop calls this every frame during a scrub; the result depends
// only on geometry + childCount, so identical inputs must be a cache hit
// (iPhone probe 2026-07-17: this was 64ms of render self-time per frame).
describe('geometry memoization', () => {
  const vp = { width: 800, height: 800, SSd: 800, LSd: 800 };
  const mag = { x: 100, y: 400, radius: 48, angle: 0 };
  const arc = { hubX: 100, hubY: 100, radius: 120 };

  it('returns the identical object for identical inputs (cache hit)', () => {
    const a = computeChildPyramidGeometry(vp, mag, arc, { childCount: 12 });
    const b = computeChildPyramidGeometry(vp, mag, arc, { childCount: 12 });
    assert.equal(a, b, 'a scrub through same-size pyramids must not recompute');
  });

  it('recomputes when childCount changes', () => {
    const a = computeChildPyramidGeometry(vp, mag, arc, { childCount: 12 });
    const b = computeChildPyramidGeometry(vp, mag, arc, { childCount: 5 });
    assert.notEqual(a, b);
    // and returns to a fresh compute when 12 recurs after 5 evicted it
    const c = computeChildPyramidGeometry(vp, mag, arc, { childCount: 12 });
    assert.notEqual(a, c, 'single-slot cache: the intervening 5 evicted the 12');
    assert.equal(c.intersections.length, a.intersections.length, 'but the geometry is equivalent');
  });
});
