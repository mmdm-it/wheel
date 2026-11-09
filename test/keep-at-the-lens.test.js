// KEEPING IS THE LENS'S ALONE (O-280, Howell 2026-11-09): the basement's
// lens wears a caption — KEEP or DISCARD above the verse's name, BOOKMARK
// below — in the tongue's own words, present at every settle and gone while
// the ring turns; a tap on the lens or on either line keeps or drops the
// seat under it. The slider's hold in the overrun below the basement is
// retired: the globe trucks, and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');

test('the view sets the two lines on the lens\'s own frame, words it per seat, and hides it while the ring turns', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const vp = getViewportInfo(411, 802);
  const items = ['a@e', 'b@e', 'c@e'];
  const kept = new Set(['b@e']);
  const opts = (selectedIndex, rotating = false, caption = key => ({ above: kept.has(key) ? 'Discard' : 'Keep', below: 'Bookmark' })) => ({
    id: 'basement', viewport: vp, items, selectedIndex, mirrored: true, labelFor: k => k, allowEmpty: true, labelsBeside: true, lensShift: -4, rotating, caption
  });
  // The stub DOM has no element lookup, so every render builds the stratum afresh: read the tree again after each.
  const treeOf = outer => { const all = []; (function walk(n) { for (const c of n.children || n.childNodes || []) { all.push(c); walk(c); } })(outer); return all; };
  const linesOf = all => all.filter(n => (n.getAttribute?.('class') || '').includes('secondary-strata-caption'));
  const all = treeOf(renderStratum(svg, opts(0)));
  const lines = linesOf(all);
  assert.equal(lines.length, 2, 'two lines');
  const [above, below] = lines;
  assert.equal(above.textContent, 'KEEP');
  assert.equal(below.textContent, 'BOOKMARK');
  assert.ok(above.getAttribute('class').includes('is-verb'), 'the verb is the bold line');
  const lensLabel = all.find(n => (n.getAttribute?.('class') || '').includes('is-magnified') && (n.tag ?? n.tagName)?.toLowerCase?.() === 'text');
  assert.equal(above.getAttribute('transform'), lensLabel.getAttribute('transform'), 'the same frame as the name');
  assert.equal(below.getAttribute('transform'), lensLabel.getAttribute('transform'));
  assert.ok(Number(above.getAttribute('y')) < 0 && Number(below.getAttribute('y')) > 0, 'above is above as read, below is below');
  assert.equal(Number(above.getAttribute('y')), -Number(below.getAttribute('y')));
  const magR = vp.SSd * 0.06;
  assert.ok(Math.abs(Number(below.getAttribute('y'))) > magR, 'clear of the lens disc');
  assert.ok(Number.isFinite(Number(above.dataset.cx)) && Number.isFinite(Number(above.dataset.cy)), 'each line knows its centre on the glass');
  const lens = all.find(n => (n.getAttribute?.('class') || '').includes('is-magnified') && (n.tag ?? n.tagName)?.toLowerCase?.() === 'circle');
  const d = Math.hypot(Number(above.dataset.cx) - Number(lens.getAttribute('cx')), Number(above.dataset.cy) - Number(lens.getAttribute('cy')));
  assert.ok(Math.abs(d - Math.abs(Number(above.getAttribute('y')))) < 0.2, 'the centre is the frame\'s offset carried onto the glass');
  assert.equal(above.getAttribute('display'), null, 'shown at the settle');
  // A kept seat under the lens: the verb turns.
  const kept1 = linesOf(treeOf(renderStratum(svg, opts(1))));
  assert.equal(kept1[0].textContent, 'DISCARD');
  assert.equal(kept1[1].textContent, 'BOOKMARK');
  // Turning: both lines go.
  const turning = linesOf(treeOf(renderStratum(svg, opts(1.4, true))));
  assert.equal(turning[0].getAttribute('display'), 'none');
  assert.equal(turning[1].getAttribute('display'), 'none');
  // A tongue without the words: nothing.
  const wordless = linesOf(treeOf(renderStratum(svg, opts(2, false, () => null))));
  assert.equal(wordless[0].getAttribute('display'), 'none');
  assert.equal(wordless[1].getAttribute('display'), 'none');
});

test('the host words the caption from the tongue, counts a tap on it as the lens, and the slider only trucks', () => {
  const main = read('src/main.js');
  assert.match(main, /caption: key => \(basementWords\?\.keep && basementWords\.discard && basementWords\.one\s*\? \{ above: keptSeat\(key\) \? basementWords\.discard : basementWords\.keep, below: basementWords\.one \} : null\)/);
  assert.match(main, /keep: namesMap\.vocabulary\.keep \|\| null, discard: namesMap\.vocabulary\.discard \|\| null, one: namesMap\.vocabulary\.bookmark_one \|\| null/);
  assert.match(main, /caption: typeof ch\.caption === 'function' \? ch\.caption : null/, 'handed to the view through the one options builder');
  assert.match(main, /\.secondary-strata-caption:not\(\[display="none"\]\)/, 'a tap on a shown line is a tap on the lens');
  assert.match(main, /lensHit\(event, ch\)\) toggleKeep\(items\[target\]\)/, 'and the lens tap keeps or drops');
  for (const gone of ['holdBegin', 'HOLD_MS', 'HOLD_DEPTH', 'SLIDER_OVERRUN', 'OVERRUN_GIVE', 'bookmarkPrompt', 'bookmarkHint']) {
    assert.ok(!main.includes(gone), `${gone} is retired`);
  }
  assert.match(main, /const TRAVEL_LIFT = 0\.5;/, 'the stops stay where the thumb learned them');
  const css = read('styles/base.css');
  assert.match(css, /\.secondary-strata-caption\s*\{[^}]*fill: var\(--color-text\)/);
  assert.match(css, /\.secondary-strata-caption\.is-verb \{ font-weight: 700; \}/);
  assert.ok(!css.includes('#bookmark-hint'), 'the phrase beside the globe is gone with the hold');
});
