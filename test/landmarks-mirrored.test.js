// A LANDMARK'S NAME STANDS ON THE OTHER SIDE OF THE RING (O-275, Howell's
// sketch 2026-11-08: "The alignment of the bookmarks is fine as is, but the
// landmarks should be shifted far to the left. In other words, should have
// the mirror offset, mirrored about the focus ring line."). A bookmark's name
// starts just past its disc and runs outward; a landmark's ends just short
// of its disc and runs inward, the same distance on the mirror side. The
// legend's two words stand the same two ways about one axis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, '..', f), 'utf8');

test('the host sends a landmark inward, a bookmark outward, and the legend the same way', () => {
  const main = read('src/main.js');
  assert.match(main, /sideFor: key => \(!keptSeat\(key\) && isHit\(key\) \? -1 : 1\)/, 'a kept hit is a bookmark, outward');
  assert.match(main, /\[MARK_LANDMARK, basementWords\.landmark, -1\], \[MARK_BOOKMARK, basementWords\.bookmark \? .* : null, 1\]/);
  assert.match(main, /sideFor: ch\.sideFor \|\| null/, 'the options builder passes it to the view');
});

test('the view mirrors an inward name about the ring\'s line and anchors its end at the disc', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const items = ['lens', 'kept', 'hit'];
  const outer = renderStratum(svg, {
    id: 'basement', viewport: getViewportInfo(420, 800), items, selectedIndex: 0, labelsBeside: true, mirrored: true,
    labelFor: k => k, markFor: k => (k === 'kept' ? 'is-bookmark' : k === 'hit' ? 'is-landmark' : null),
    sideFor: k => (k === 'hit' ? -1 : 1),
    legend: [['is-landmark', 'Landmark', -1], ['is-bookmark', 'Bookmark', 1]]
  });
  const num = (el, a) => Number(el.getAttribute(a));
  const kept = outer.__seats[1], hit = outer.__seats[2];
  assert.equal(kept.label.getAttribute('text-anchor'), 'start', 'a bookmark starts at its disc');
  assert.equal(hit.label.getAttribute('text-anchor'), 'end', 'a landmark ends at its disc');
  // Each name's anchor is the same distance from its disc, on opposite sides along the radius.
  const off = seat => ({ dx: num(seat.label, 'x') - num(seat.circle, 'cx'), dy: num(seat.label, 'y') - num(seat.circle, 'cy') });
  const k = off(kept), h = off(hit);
  const kr = Math.hypot(k.dx, k.dy), hr = Math.hypot(h.dx, h.dy);
  assert.ok(kr > 1 && Math.abs(kr - hr) < 0.5, `same distance from the disc (${kr.toFixed(1)} vs ${hr.toFixed(1)})`);
  // Opposite sides: the two offsets point against each other along their own radii (dot product negative).
  assert.ok((k.dx * h.dx + k.dy * h.dy) < 0 || (Math.sign(k.dx) !== Math.sign(h.dx)), 'the landmark\'s anchor is on the mirror side');
  // The legend's words ride arcs on the names' own sides of the band (O-276):
  // the bookmark word on the inner arc, hanging, below the lens; the other
  // word on the outer arc, standing, above it.
  const legend = [...outer.__inner.children].filter(n => (n.getAttribute('class') || '') === 'secondary-strata-legend' || (n.getAttribute('class') || '').startsWith('secondary-strata-legend '));
  assert.equal(legend.length, 2);
  const [land, book] = legend;
  assert.equal(land.dataset.side, 'outer');
  assert.equal(book.dataset.side, 'inner');
  assert.equal(land.getAttribute('dominant-baseline'), 'alphabetic');
  assert.equal(book.getAttribute('dominant-baseline'), 'hanging');
  const arcOf = t => [...outer.__inner.children].find(n => n.getAttribute('id') === t.firstChild.getAttribute('href').slice(1));
  const radiusOf = t => Number(arcOf(t).getAttribute('d').split(' A ')[1].split(' ')[0]);
  assert.ok(radiusOf(land) > radiusOf(book), 'the outer word\'s arc is the larger');
  assert.equal(land.firstChild.getAttribute('startOffset'), '50%');
  assert.equal(land.firstChild.textContent, 'LANDMARK');
});

test('a legend row without a side rides the outer arc', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const outer = renderStratum(svg, { id: 'b2', viewport: getViewportInfo(420, 800), items: ['a', 'b'], selectedIndex: 0, labelsBeside: true, labelFor: k => k, legend: [['x', 'One'], ['y', 'Two']] });
  const legend = [...outer.__inner.children].filter(n => (n.getAttribute('class') || '').startsWith('secondary-strata-legend '));
  assert.deepEqual(legend.map(n => [n.dataset.side, n.textContent]), [['outer', 'ONE'], ['outer', 'TWO']]);
});
