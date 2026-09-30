// THE RING KEEPS ITS ELEMENTS (O-185, Howell 2026-09-30: the chooser rings
// "not nearly as smooth as the primary stratum focus ring"). The stratum
// renderer used to rebuild every circle and label whenever the centre moved,
// which is every pointer move of a drag. It now keeps them for as long as
// the seats are the same and only re-poses them; a change of seats rebuilds.
// These cells hold that with a container that remembers what was appended.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';
import { renderStratum } from '../src/view/secondary-strata-view.js';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';

installBrowserGlobals('?volume=bible');
const viewport = getViewportInfo(420, 800);

// A container that answers querySelector('#id') with the element it holds —
// the one thing the mock DOM's container does not do.
function container() {
  const held = new Map();
  return {
    held,
    appendChild(n) { held.set(n.getAttribute('id'), n); },
    querySelector(sel) { return sel.startsWith('#') ? held.get(sel.slice(1)) || null : null; }
  };
}
const circlesOf = outer => outer.__seats.map(s => s.circle);
const opts = (items, selectedIndex, extra = {}) => ({ id: 'ring', viewport, items, selectedIndex, labelFor: x => x, ...extra });

describe('the stratum renderer keeps its elements (O-185)', () => {
  it('turning the ring re-poses the same circles rather than making new ones', () => {
    const svg = container();
    const outer = renderStratum(svg, opts(['a', 'b', 'c', 'd'], 0));
    const before = circlesOf(outer);
    const cx0 = before[2].getAttribute('cx');
    const again = renderStratum(svg, opts(['a', 'b', 'c', 'd'], 1.4, { rotating: true }));
    assert.equal(again, outer, 'the same stratum');
    assert.deepEqual(circlesOf(again), before, 'the same four circles');
    assert.notEqual(before[2].getAttribute('cx'), cx0, 'moved to the new centre');
  });
  it('settled, the seat under the lens hides and the lens wears its name; turning, every seat shows and the lens is empty', () => {
    const svg = container();
    const outer = renderStratum(svg, opts(['a', 'b', 'c'], 1));
    const seats = outer.__seats;
    assert.equal(seats[1].circle.getAttribute('display'), 'none', 'the seat in the lens is hidden');
    assert.equal(outer.__lensLabel.textContent, 'B');
    assert.ok(!outer.__lens.getAttribute('class').includes('lens-empty'));
    renderStratum(svg, opts(['a', 'b', 'c'], 1.3, { rotating: true }));
    assert.equal(seats[1].circle.getAttribute('display'), null, 'every seat shows while turning');
    assert.ok(outer.__lens.getAttribute('class').includes('lens-empty'));
    assert.equal(outer.__lensLabel.getAttribute('display'), 'none');
  });
  it('a change of seats, or of their dress, rebuilds', () => {
    const svg = container();
    const outer = renderStratum(svg, opts(['a', 'b', 'c'], 0));
    const before = circlesOf(outer);
    renderStratum(svg, opts(['a', 'b', 'c', 'd'], 0));
    assert.notDeepEqual(circlesOf(outer).slice(0, 3), before, 'new seats, new circles');
    const dressed = circlesOf(outer);
    renderStratum(svg, opts(['a', 'b', 'c', 'd'], 0, { classFor: k => (k === 'd' ? 'is-coming' : '') }));
    assert.notDeepEqual(circlesOf(outer), dressed, 'a new dress is a new membership');
    assert.ok(circlesOf(outer)[3].getAttribute('class').includes('is-coming'));
  });
  it('turning, the seat under the lens swells to the primary\'s peak and its label rides the same scale (O-186)', () => {
    const svg = container();
    const outer = renderStratum(svg, opts(['a', 'b', 'c', 'd', 'e'], 2, { centerMagnified: true }));
    const restR = Number(outer.__seats[0].circle.getAttribute('r'));
    renderStratum(svg, opts(['a', 'b', 'c', 'd', 'e'], 2, { centerMagnified: true, rotating: true }));
    const inLens = outer.__seats[2];
    assert.ok(Math.abs(Number(inLens.circle.getAttribute('r')) / restR - 2) < 0.02, 'twice its resting radius, the primary\'s peak');
    assert.match(inLens.label.getAttribute('transform'), /scale\(2\.000\)/, 'the name grows with it');
    assert.ok(inLens.label.getAttribute('class').includes('is-passing'));
    assert.ok(Math.abs(Number(outer.__seats[0].circle.getAttribute('r')) - restR) < 0.5, 'a seat two away rests');
  });
  it('a seat wears its mark before its name, the lens too, and the legend stands in the volume\'s words (O-188)', () => {
    const svg = container();
    const outer = renderStratum(svg, opts(['kept', 'hit', 'loose'], 0, { labelsBeside: true, markFor: k => (k === 'kept' ? 'B' : k === 'hit' ? 'L' : null), legend: [['B', 'Bookmarks'], ['L', 'Landmarks'], ['X', '']] }));
    assert.equal(outer.__seats[0].label.textContent, 'B KEPT');
    assert.equal(outer.__seats[1].label.textContent, 'L HIT');
    assert.equal(outer.__seats[2].label.textContent, 'LOOSE', 'no mark, no glyph');
    assert.equal(outer.__lensLabel.textContent, 'B KEPT', 'the lens carries the mark too');
    const legend = [...outer.__inner.children].filter(n => (n.getAttribute('class') || '').includes('secondary-strata-legend')).map(n => n.textContent);
    assert.deepEqual(legend, ['B BOOKMARKS', 'L LANDMARKS'], 'a row without a word is left out');
  });
  it('an identical render is a no-op', () => {
    const svg = container();
    const outer = renderStratum(svg, opts(['a', 'b'], 0));
    const pose = outer.dataset.pose, sig = outer.dataset.signature;
    const cx = outer.__seats[0].circle.getAttribute('cx');
    outer.__seats[0].circle.setAttribute('cx', '999');   // a mark the renderer would erase if it re-posed
    renderStratum(svg, opts(['a', 'b'], 0));
    assert.equal(outer.__seats[0].circle.getAttribute('cx'), '999', 'untouched');
    assert.equal(outer.dataset.pose, pose); assert.equal(outer.dataset.signature, sig);
    void cx;
  });
});
