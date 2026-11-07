// THE CHAIN HAS ENDS (O-271, Howell 2026-11-06): "the focus ring is not a
// wheel, but rather a sprocket with a chain that has ends." The band is solid
// only where the chain is — up to the centre of the first link and of the
// last, never past them (Howell's note the same evening) — and hollow beyond, at every level, in display angles that
// turn with the links.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { chainSpanPoints, bandEdges, bandCenterlinePoints, chainPointAt } from '../src/geometry/focus-ring-geometry.js';

const arc = { hubX: 780, hubY: 0, radius: 780 };
const startAngle = Math.atan2(657, 360 - 780); // the lower exit of a 360x657 window
const endAngle = Math.PI;

describe('the band is drawn only where the chain is (O-271)', () => {
  it('a chain reaching past both exits gets the whole centreline, unchanged', () => {
    const r = chainSpanPoints(arc, startAngle, endAngle, startAngle - 10, endAngle + 10, null);
    assert.strictEqual(r.whole, true);
    assert.deepStrictEqual(r.points, bandCenterlinePoints(arc, startAngle, endAngle, null));
  });
  it('a chain whose first link is on the glass stops there: the path ends at the span\'s upper angle', () => {
    const upper = 2.6; // between the lower exit (~2.14) and the upper (pi)
    const r = chainSpanPoints(arc, startAngle, endAngle, startAngle - 10, upper, null);
    assert.strictEqual(r.whole, false);
    const last = r.points[r.points.length - 1];
    const want = chainPointAt(arc, startAngle, endAngle, upper);
    assert.ok(Math.abs(last[0] - want.x) < 1e-6 && Math.abs(last[1] - want.y) < 1e-6, 'ends at the chain\'s end');
    // and nothing beyond it: every point's angle about the hub is at most `upper`
    for (const [x, y] of r.points) assert.ok(Math.atan2(y - arc.hubY, x - arc.hubX) <= upper + 1e-9);
  });
  it('a chain whose last link is on the glass starts there, and runs up the tangent beyond the upper exit', () => {
    const lower = 2.4;
    const r = chainSpanPoints(arc, startAngle, endAngle, lower, endAngle + 10, null);
    const first = r.points[0];
    const want = chainPointAt(arc, startAngle, endAngle, lower);
    assert.ok(Math.abs(first[0] - want.x) < 1e-6 && Math.abs(first[1] - want.y) < 1e-6);
    const last = r.points[r.points.length - 1];
    assert.ok(last[1] < arc.hubY, 'the final point is up the vertical tangent above the hub');
  });
  it('the chain\'s end on the tangent run is honoured too (an end above the upper exit)', () => {
    const upper = endAngle + 0.5;
    const r = chainSpanPoints(arc, startAngle, endAngle, startAngle - 10, upper, null);
    const last = r.points[r.points.length - 1];
    const want = chainPointAt(arc, startAngle, endAngle, upper);
    assert.ok(Math.abs(last[0] - want.x) < 1e-6 && Math.abs(last[1] - want.y) < 1e-6);
  });
  it('an empty span draws nothing', () => {
    assert.deepStrictEqual(chainSpanPoints(arc, startAngle, endAngle, 2.5, 2.5, null).points, []);
  });
  it('the hollow band is the centreline\'s two edges, each half a band width off it', () => {
    const pts = bandCenterlinePoints(arc, startAngle, endAngle, null);
    const [a, b] = bandEdges(pts, 7.8);
    assert.strictEqual(a.length, pts.length);
    assert.strictEqual(b.length, pts.length);
    // on the arc the edges are radial: one at r + 7.8, the other at r - 7.8 (within sampling tolerance)
    const mid = Math.floor(pts.length / 2);
    const ra = Math.hypot(a[mid][0] - arc.hubX, a[mid][1] - arc.hubY), rb = Math.hypot(b[mid][0] - arc.hubX, b[mid][1] - arc.hubY);
    assert.ok(Math.abs(Math.abs(ra - rb) - 15.6) < 0.1, `edges ${ra} ${rb}`);
  });
});

describe('the ring carries its chain span to the view (O-271)', () => {
  const index = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const view = fs.readFileSync(new URL('../src/view/focus-ring-view.js', import.meta.url), 'utf8');
  it('the bounds name the chain\'s ends at the centres of the end links, not past them', () => {
    assert.match(index, /chainUpper: firstAngle,/);
    assert.match(index, /chainLower: lastAngle$/m);
  });
  it('the span sent to the view is in display angles (base + rotation)', () => {
    assert.match(index, /chainSpan: .*lower: bounds\.chainLower \+ rotation, upper: bounds\.chainUpper \+ rotation/);
  });
  it('the view keeps a hollow path under the band and hides it while the chain covers the glass', () => {
    assert.match(view, /focus-ring-band-hollow/);
    assert.match(view, /if \(chain\.whole\) \{\s*this\.bandHollow\.style\.display = 'none';/);
  });
  it('the hollow band is inked like an empty vessel', () => {
    const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
    assert.match(css, /\.focus-ring-band-hollow \{[^}]*fill: none;[^}]*stroke: var\(--color-magnifier-stroke, #000\)/s);
  });
});
