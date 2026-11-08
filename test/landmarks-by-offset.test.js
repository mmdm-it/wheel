// THE BASEMENT TELLS A LANDMARK BY WHERE ITS NAME STARTS (O-275, Howell
// 2026-11-08: "I want all the labels to be black ... by offset, where one
// is offset to the left, the other to the right"). A bookmark's name starts
// flush beside its disc; a landmark's is indented along the same line, in
// the lens too; the legend's two words stand the same way. No mark carries
// a colour or a face: the italics tried first the same evening did not read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, '..', f), 'utf8');

test('the stylesheet colours no mark and slants none', () => {
  const css = read('styles/base.css');
  assert.doesNotMatch(css, /is-(landmark|bookmark)[^\n]*(fill|font-style):/, 'a mark is a hook, not a colour or a face');
  assert.doesNotMatch(css, /#7f1d1d|#16337a/, 'the dark red and dark blue are gone');
  assert.doesNotMatch(read('index.html'), /Montserrat:ital/, 'no italic faces are fetched for it');
});

test('the host indents a landmark and not a bookmark, and says so in the legend', () => {
  const main = read('src/main.js');
  assert.match(main, /const LANDMARK_INDENT_EM = 1\.6;/);
  assert.match(main, /indentFor: key => \(!keptSeat\(key\) && isHit\(key\) \? LANDMARK_INDENT_EM : 0\)/, 'a kept hit is a bookmark, flush');
  assert.match(main, /\[MARK_LANDMARK, basementWords\.landmark, LANDMARK_INDENT_EM\], \[MARK_BOOKMARK, basementWords\.bookmark\]/);
  assert.match(main, /indentFor: ch\.indentFor \|\| null/, 'the options builder passes it to the view');
});

test('the view sets the indent as dx on the seat name, the lens name and the legend word', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const items = ['kept', 'hit', 'loose'];
  const opts = selectedIndex => ({
    id: 'basement', viewport: { width: 400, height: 800, SSd: 400 }, items, selectedIndex, labelsBeside: true, mirrored: true,
    labelFor: k => k,
    markFor: k => (k === 'kept' ? 'is-bookmark' : k === 'hit' ? 'is-landmark' : null),
    indentFor: k => (k === 'hit' ? 1.6 : 0),
    legend: [['is-landmark', 'Landmark', 1.6], ['is-bookmark', 'Bookmark']]
  });
  let outer = renderStratum(svg, opts(0));
  assert.equal(outer.__seats[1].label.getAttribute('dx'), '1.60em', 'the landmark starts further along');
  assert.equal(outer.__seats[0].label.getAttribute('dx'), null, 'the bookmark is flush');
  assert.equal(outer.__seats[2].label.getAttribute('dx'), null, 'a loose seat is flush');
  assert.equal(outer.__lensLabel.getAttribute('dx'), null, 'a bookmark in the lens is flush');
  outer = renderStratum(svg, opts(1));
  assert.equal(outer.__lensLabel.getAttribute('dx'), '1.60em', 'the indent follows the landmark into the lens');
  const legend = [...outer.__inner.children].filter(n => (n.getAttribute('class') || '').includes('secondary-strata-legend')).map(n => [n.textContent, n.getAttribute('dx')]);
  assert.deepEqual(legend, [['LANDMARK', '1.60em'], ['BOOKMARK', null]]);
});

test('a change of indent alone is a new membership, so the ring redraws', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const base = { id: 'b2', viewport: { width: 400, height: 800, SSd: 400 }, items: ['a', 'b'], selectedIndex: 0, labelsBeside: true, labelFor: k => k };
  const first = renderStratum(svg, { ...base, indentFor: () => 0 });
  const sig = first.dataset.signature;
  const second = renderStratum(svg, { ...base, indentFor: k => (k === 'b' ? 1.6 : 0) });
  assert.notEqual(second.dataset.signature, sig);
  assert.equal(second.__seats[1].label.getAttribute('dx'), '1.60em');
});
