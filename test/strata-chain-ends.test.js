// THE CHOOSER RINGS' CHAINS HAVE ENDS TOO (O-272, Howell 2026-11-07): the
// edition ring and the language ring (and the basement's) draw their band
// solid from the centre of the first seat to the centre of the last, and
// hollow beyond. A tongue with one edition is one bead on bare sprocket.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { computeStrataLayout } from '../src/geometry/secondary-strata-geometry.js';
import { chainSpanPoints, bandBounds, STRATA_REACH } from '../src/geometry/focus-ring-geometry.js';

const viewport = { width: 360, height: 657, SSd: 360, LSd: 657 };
const spanFor = (n, centerIndex, mirrored = false) => {
  const l = computeStrataLayout(viewport, Math.max(1, n), centerIndex, mirrored);
  return chainSpanPoints(l.arc, l.startAngle, l.endAngle, l.magA - (n - 1 - centerIndex) * l.spacing, l.magA + centerIndex * l.spacing, bandBounds(viewport.width, viewport.height, STRATA_REACH));
};

describe('a chooser ring\'s band is cut to its chain (O-272)', () => {
  it('the layout now reports the window it laid the chain on', () => {
    const l = computeStrataLayout(viewport, 5, 0, false);
    assert.ok(Number.isFinite(l.startAngle) && Number.isFinite(l.endAngle) && l.endAngle > l.startAngle);
    const m = computeStrataLayout(viewport, 5, 0, true);
    assert.ok(m.endAngle > m.startAngle);
  });
  it('one seat: no solid band at all', () => {
    assert.deepStrictEqual(spanFor(1, 0).points, []);
  });
  it('eight seats with the first in the lens: the band runs from the lens down the chain and stops at the lens', () => {
    const l = computeStrataLayout(viewport, 8, 0, false);
    const s = spanFor(8, 0);
    assert.strictEqual(s.whole, false);
    const top = s.points[s.points.length - 1];
    assert.ok(Math.abs(top[0] - l.magnifier.x) < 0.5 && Math.abs(top[1] - l.magnifier.y) < 0.5, 'the band ends under the lens');
  });
  it('a chain long enough to pass both exits is the whole band', () => {
    assert.strictEqual(spanFor(200, 100).whole, true);
  });
  it('the mirrored ring (the languages) cuts its band in its own frame', () => {
    const l = computeStrataLayout(viewport, 19, 18, true); // last seat in the lens
    const s = spanFor(19, 18, true);
    assert.strictEqual(s.whole, false);
    const end = s.points[0];
    const far = s.points[s.points.length - 1];
    // one end of the solid band is the lens; the mirrored window's angles are negative
    const atLens = [end, far].some(pt => Math.abs(pt[0] - l.magnifier.x) < 0.5 && Math.abs(pt[1] - l.magnifier.y) < 0.5);
    assert.ok(atLens, 'the band ends under the lens');
    assert.ok(l.startAngle < 0 && l.endAngle < 0);
  });
  it('dragged into the overrun the solid band\'s end passes the lens', () => {
    const l = computeStrataLayout(viewport, 8, -2, false); // the first seat two links past the lens
    const s = spanFor(8, -2);
    const top = s.points[s.points.length - 1];
    const lensAngle = Math.atan2(l.magnifier.y - l.arc.hubY, l.magnifier.x - l.arc.hubX);
    const topAngle = Math.atan2(top[1] - l.arc.hubY, top[0] - l.arc.hubX);
    assert.ok(topAngle < lensAngle, 'the chain\'s end has slid below the lens');
  });
});

describe('the strata view draws the bare sprocket under the band (O-272)', () => {
  const view = fs.readFileSync(new URL('../src/view/secondary-strata-view.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
  it('a hollow path, inset inside the band\'s width, made once with the band', () => {
    assert.match(view, /class: 'secondary-strata-band-hollow'/);
    assert.match(view, /bandWidth \/ 2 - ink \/ 2 - 0\.3/);
  });
  it('the band is re-cut at every pose and the hollow shown only when an end is on the glass', () => {
    assert.match(view, /outer\.__band\.setAttribute\('d', span\.whole \? outer\.__bandWhole : pointsToPath\(span\.points\)\)/);
    assert.match(view, /show\(outer\.__bandHollow, !span\.whole\)/);
  });
  it('an empty ring is all bare sprocket', () => {
    assert.match(view, /: \{ whole: false, points: \[\] \};/);
  });
  it('inked like the empty vessel', () => {
    assert.match(css, /\.secondary-strata-band-hollow \{[^}]*stroke: var\(--color-magnifier-stroke, #000\)/s);
  });
});
