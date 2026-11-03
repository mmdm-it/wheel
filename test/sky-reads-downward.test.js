// THE SKY IS FULL, READS DOWNWARD, AND EVERY SIBLING HAS A SEAT ON THE CHAIN
// (O-263, Howell 2026-11-02): a drill out seats the whole set, not the ring's
// visible nodes; every sky takes its seats highest first in sibling order;
// a star whose ring seat is off screen flies to it on the straight tangent
// run past the exit, cut a screen's length out, instead of fading to a flock.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { chainSeatAt, chainPointAt, getViewportInfo, getArcParameters, getViewportWindow } from '../src/geometry/focus-ring-geometry.js';

const src = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

describe('the full sky and the seats on the chain (O-263)', () => {
  const vp = getViewportInfo(360, 657);
  const arc = getArcParameters(vp);
  const win = getViewportWindow(vp);
  it('a seat inside the window is on the arc, as chainPointAt places it', () => {
    const a = (win.startAngle + win.endAngle) / 2;
    assert.deepEqual(chainSeatAt(arc, win, a, vp.LSd), chainPointAt(arc, win.startAngle, win.endAngle, a));
  });
  it('a seat past the upper exit lies on the straight run, no farther than the reach', () => {
    const far = chainSeatAt(arc, win, win.endAngle + 40, vp.LSd);
    const exit = chainPointAt(arc, win.startAngle, win.endAngle, win.endAngle);
    assert.equal(far.onArc, false);
    assert.ok(Math.abs(Math.hypot(far.x - exit.x, far.y - exit.y) - vp.LSd) < 1e-6, 'cut at one screen length');
    assert.equal(far.tangentAngle, win.endAngle, 'the label stays square to the exit');
  });
  it('a seat past the lower exit likewise, and nearer seats keep their true distance', () => {
    const exit = chainPointAt(arc, win.startAngle, win.endAngle, win.startAngle);
    const near = chainSeatAt(arc, win, win.startAngle - 0.1, vp.LSd);
    assert.ok(Math.abs(Math.hypot(near.x - exit.x, near.y - exit.y) - 0.1 * arc.radius) < 1e-6);
    const far = chainSeatAt(arc, win, win.startAngle - 40, vp.LSd);
    assert.ok(Math.abs(Math.hypot(far.x - exit.x, far.y - exit.y) - vp.LSd) < 1e-6);
  });
  it('the host no longer winnows a drill-out sky to the ring, nor flies stars to a flock on a drill in', () => {
    const host = src('index.js');
    assert.doesNotMatch(host, /children\.filter\(ch => dynamicSky\.ids\.has/);
    assert.doesNotMatch(host, /distantStars/);
    assert.match(host, /const ringTargets = seatsOnChain\(tempNormalized, tempRotation,/);
    assert.match(host, /chainSeatAt\(arcParams, windowInfo, angle, vp\.LSd\)/);
  });
  it('after a drill out the run is anchored on the node just left, else the landmark', () => {
    const host = src('index.js');
    const i = host.indexOf('const anchor = (() => {');
    const body = host.slice(i, i + 400);
    assert.ok(body.indexOf('standoutId') < body.indexOf('isLarge'), 'the node just left is asked first');
  });
});
