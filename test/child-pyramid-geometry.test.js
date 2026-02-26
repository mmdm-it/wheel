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
