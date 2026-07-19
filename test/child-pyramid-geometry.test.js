import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeChildPyramidGeometry } from '../src/geometry/child-pyramid-geometry.js';

describe('computeChildPyramidGeometry (star field)', () => {
  const viewport = { width: 800, height: 800, SSd: 800, LSd: 800 };
  const magnifier = { x: 100, y: 780, radius: 48, angle: 0 };
  const arcParams = { hubX: 1100, hubY: 400, radius: 1050 };
  const phone = { width: 375, height: 625, SSd: 375, LSd: 625 };
  const phoneMag = { x: 60, y: 560, radius: 24, angle: 5.6 };
  const phoneArc = { hubX: 520, hubY: 300, radius: 480 };

  it('places EVERY child — no starvation (the sparse-months bug)', () => {
    for (const childCount of [3, 7, 12, 20]) {
      const r = computeChildPyramidGeometry(phone, phoneMag, phoneArc, {
        childCount, parentSortNumber: childCount, hasDimensionButton: false
      });
      assert.equal(r.intersections.length, childCount,
        `childCount ${childCount}: placed only ${r.intersections.length}`);
    }
  });

  it('draws one fan line per star, all sharing the magnifier origin', () => {
    const r = computeChildPyramidGeometry(viewport, magnifier, arcParams, {
      childCount: 9, parentSortNumber: 4
    });
    assert.equal(r.fanLines.length, r.intersections.length);
    for (const f of r.fanLines) {
      assert.equal(f.x1, magnifier.x);
      assert.equal(f.y1, magnifier.y);
    }
  });

  it('keeps stars inside the CPUA, apart from each other, and out of the logo', () => {
    const logoBounds = { left: 560, right: 720, top: 40, bottom: 200 };
    const r = computeChildPyramidGeometry(viewport, magnifier, arcParams, {
      childCount: 12, parentSortNumber: 7, logoBounds
    });
    const nodeR = 0.04 * viewport.SSd;
    for (const p of r.intersections) {
      assert.ok(p.x >= r.cpua.left && p.x <= r.cpua.right, 'inside CPUA x');
      assert.ok(p.y >= r.cpua.top && p.y <= r.cpua.bottom, 'inside CPUA y');
      assert.ok(!(p.x > logoBounds.left - nodeR && p.x < logoBounds.right + nodeR
        && p.y > logoBounds.top - nodeR && p.y < logoBounds.bottom + nodeR), 'outside logo');
    }
    for (let i = 0; i < r.intersections.length; i += 1) {
      for (let j = i + 1; j < r.intersections.length; j += 1) {
        const d = Math.hypot(
          r.intersections[i].x - r.intersections[j].x,
          r.intersections[i].y - r.intersections[j].y
        );
        assert.ok(d >= nodeR * 2.3 - 1e-9, `stars ${i},${j} too close: ${d}`);
      }
    }
  });

  it('gives each parent its own constellation (the dance)', () => {
    const a = computeChildPyramidGeometry(viewport, magnifier, arcParams, {
      childCount: 8, parentSortNumber: 3
    });
    const aCoords = a.intersections.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';');
    const b = computeChildPyramidGeometry(viewport, magnifier, arcParams, {
      childCount: 8, parentSortNumber: 4
    });
    const bCoords = b.intersections.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';');
    assert.notEqual(aCoords, bCoords, 'different parents must scatter differently');
  });

  it('maps sibling order to centrality — earlier siblings sit nearer the field center', () => {
    const r = computeChildPyramidGeometry(viewport, magnifier, arcParams, {
      childCount: 10, parentSortNumber: 11
    });
    const cx = (r.cpua.left + r.cpua.rightFull) / 2;
    const cy = (r.cpua.top + r.cpua.bottom) / 2;
    const dist = p => Math.hypot(p.x - cx, p.y - cy);
    const first = dist(r.intersections[0]);
    const last = dist(r.intersections[r.intersections.length - 1]);
    assert.ok(first <= last, 'slot 0 should be at least as central as the last slot');
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
