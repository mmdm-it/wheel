// KEEPING IS THE LENS'S ALONE (O-280, Howell 2026-11-09): one upright word
// stands in the open ground to the right of the basement's lens — BOOKMARK
// for the hollow dashed candidate under it, DISCARD for a kept seat, nothing
// for an oft-quoted one — in the tongue's own words, present at every settle
// and gone while the ring turns; a tap on the lens or on the word keeps or
// drops the seat. The slider's hold in the overrun below the basement is
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

test('the view stands one upright word right of the lens, words it per seat, and hides it while the ring turns', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const vp = getViewportInfo(411, 802);
  const items = ['a@e', 'b@e', 'c@e'];
  const kept = new Set(['b@e']);
  const opts = (selectedIndex, rotating = false, caption = key => (kept.has(key) ? 'Discard' : 'Bookmark')) => ({
    id: 'basement', viewport: vp, items, selectedIndex, mirrored: true, labelFor: k => k, allowEmpty: true, labelsBeside: true, lensShift: -4, rotating, caption
  });
  // The stub DOM has no element lookup, so every render builds the stratum afresh: read the tree again after each.
  const treeOf = outer => { const all = []; (function walk(n) { for (const c of n.children || n.childNodes || []) { all.push(c); walk(c); } })(outer); return all; };
  const wordOf = all => all.filter(n => (n.getAttribute?.('class') || '').includes('secondary-strata-caption'));
  const tag = n => (n.tag ?? n.tagName)?.toLowerCase?.();
  const all = treeOf(renderStratum(svg, opts(0)));
  const words = wordOf(all);
  assert.equal(words.length, 1, 'one word');
  const [word] = words;
  assert.equal(word.textContent, 'BOOKMARK');
  assert.equal(word.getAttribute('transform'), null, 'upright: no rotation');
  assert.equal(word.getAttribute('text-anchor'), 'start');
  const lens = all.find(n => (n.getAttribute?.('class') || '').includes('is-magnified') && tag(n) === 'circle');
  const cx = Number(lens.getAttribute('cx')), cy = Number(lens.getAttribute('cy')), magR = vp.SSd * 0.06;
  assert.equal(Number(word.getAttribute('y')), Number(cy.toFixed(1)), 'at the lens\'s height');
  assert.ok(Number(word.getAttribute('x')) > cx + 2 * magR, 'to the right of the lens, clear of the disc');
  assert.ok(Number(word.getAttribute('x')) < cx + 3 * magR, 'and not far from it');
  // Sized to the room (Howell: "it runs a little wide for 'bookmark'"): the word ends on the glass.
  const size = parseFloat(word.style.fontSize);
  assert.ok(size > 12 && size <= 21.01, `the lens label's size or less (${size})`);
  assert.ok(Number(word.getAttribute('x')) + 8 * 0.82 * size <= vp.width - 0.03 * vp.SSd + 0.5, 'BOOKMARK lands whole');
  // A long word in a narrow glass is cut smaller still.
  const narrow = getViewportInfo(320, 640);
  const longWord = wordOf(treeOf(renderStratum(svg, { ...opts(0, false, () => 'Entfernen'), viewport: narrow })))[0];
  const ls = parseFloat(longWord.style.fontSize);
  assert.ok(ls < size, `smaller where there is less room (${ls})`);
  assert.ok(Number(longWord.getAttribute('x')) + 9 * 0.82 * ls <= narrow.width - 0.03 * narrow.SSd + 0.5, 'and still whole');
  assert.equal(word.dataset.cx, word.getAttribute('x'), 'its anchor on the glass, for the host\'s tap');
  assert.equal(word.dataset.cy, word.getAttribute('y'));
  assert.equal(word.getAttribute('display'), null, 'shown at the settle');
  // A kept seat under the lens: the word turns.
  assert.equal(wordOf(treeOf(renderStratum(svg, opts(1))))[0].textContent, 'DISCARD');
  // Turning: the word goes.
  assert.equal(wordOf(treeOf(renderStratum(svg, opts(1.4, true))))[0].getAttribute('display'), 'none');
  // Nothing to decide (an oft-quoted seat, or a tongue without the words): nothing.
  assert.equal(wordOf(treeOf(renderStratum(svg, opts(2, false, () => null))))[0].getAttribute('display'), 'none');
});

test('the host words it from the tongue — BOOKMARK for the candidate alone, DISCARD for a kept seat, nothing for an oft-quoted one — counts a tap on it as the lens, and the slider only trucks', () => {
  const main = read('src/main.js');
  const cap = main.slice(main.indexOf('caption: key => {'), main.indexOf('\n};', main.indexOf('caption: key => {')));
  assert.match(cap, /if \(!\(basementWords\?\.bookmarkVerb && basementWords\.discard\)\) return null;/, 'both words or none');
  assert.match(cap, /if \(keptSeat\(key\)\) return basementWords\.discard;/, 'a kept seat offers DISCARD');
  assert.match(cap, /if \(isHit\(key\)\) return null;/, 'an oft-quoted seat offers nothing');
  assert.match(cap, /return basementWords\.bookmarkVerb;/, 'the candidate alone offers BOOKMARK');
  assert.ok(cap.indexOf('keptSeat(key)') < cap.indexOf('isHit(key)') && cap.indexOf('isHit(key)') < cap.indexOf('return basementWords.bookmarkVerb'), 'in that order');
  assert.match(main, /bookmarkVerb: roomKit\.bookmark_verb \|\| null, discard: roomKit\.discard \|\| null/, 'from the phone\'s kit (O-282)');
  const keep = main.slice(main.indexOf('function toggleKeep'), main.indexOf('// THE LIVE PREVIEW'));
  assert.match(keep, /if \(isHit\(key\)\) return false;\s*keepBookmark\(/, 'and the tap keeps no oft-quoted seat');
  assert.match(main, /caption: typeof ch\.caption === 'function' \? ch\.caption : null/, 'handed to the view through the one options builder');
  const hit = main.slice(main.indexOf('function lensHit'), main.indexOf('// Re-render ONLY the front stratum'));
  assert.match(hit, /\.secondary-strata-caption:not\(\[display="none"\]\)/, 'a shown word is the lens\'s');
  assert.match(hit, /getBBox/, 'its box where the glass can measure it');
  assert.match(main, /lensHit\(event, ch, 'word'\)\) toggleKeep\(items\[target\]\)/, 'and a tap on the word keeps or drops (the glass no longer does, O-326)');
  for (const gone of ['holdBegin', 'HOLD_MS', 'HOLD_DEPTH', 'SLIDER_OVERRUN', 'OVERRUN_GIVE', 'bookmarkPrompt', 'bookmarkHint']) {
    assert.ok(!main.includes(gone), `${gone} is retired`);
  }
  assert.match(main, /const TRAVEL_LIFT = 0\.5;/, 'the stops stay where the thumb learned them');
  const css = read('styles/base.css');
  const rule = css.match(/\.secondary-strata-caption\s*\{([^}]*)\}/)[1];
  assert.match(rule, /fill: var\(--caption-ink, var\(--color-text\)\)/);
  assert.match(rule, /font-weight: 700/);
  // The parent label's halo on the word (Howell: "a halo around the discard or bookmark label, the same way we put a halo around the parent button label"): a name passing beneath is dimmed, not hidden — as a mask on the names since O-289 (test/halo-on-the-names-alone.test.js); the word itself paints no stroke.
  assert.match(rule, /paint-order: stroke fill/);
  assert.match(rule, /stroke-opacity: var\(--caption-halo-opacity, 0\)/);
  assert.match(rule, /stroke-width: var\(--parent-halo-width, 0\.6em\)/);
  const view = read('src/view/secondary-strata-view.js');
  assert.ok(!view.includes('clearWordPath'), 'no name is hidden for the word');
  assert.ok(!css.includes('#bookmark-hint'), 'the phrase beside the globe is gone with the hold');
});

// O-324 (Howell 2026-11-21): on the edition and language rings a single tap on
// the lens, at rest, carries the reader to the text behind the glass.
test('a tap on the lens of the edition or language ring enters the text: at rest only, never from a seat with nothing to read', () => {
  const main = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/main.js'), 'utf8');
  const up = main.slice(main.indexOf("['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>\n    strataLayer"), main.indexOf('// ── The strata transition tween'));
  assert.match(up, /const onLens = items\.length > 0 && \(tapped == null \|\| tapped === target\) && lensHit\(event, ch, ch === BASEMENT \? 'glass' : null\);/, 'the seat under the lens counts as the lens; in the basement the glass alone does (O-326)');
  assert.match(up, /enter = !caught && canEnterFromLens\(ch, items\[target\]\);/, 'a ring caught mid-glide has chosen nothing yet');
  assert.ok(up.indexOf('springbackStrata(center, target, ch, items);') < up.indexOf('goToStratum(0)'), 'the seat is committed before the floors move');
  const can = main.slice(main.indexOf('function canEnterFromLens'), main.indexOf('// Is the press on the lodestar itself?'));
  assert.match(can, /ch\.inert\(item\)\) return false/);
  assert.match(can, /isComingLanguage\?\.\(item\) \|\| dimensionBridge\.isElsewhereLanguage\?\.\(item\)/);
  assert.match(main, /const caught = Boolean\(strataSnap\);/);
});

// O-326 (Howell 2026-11-21): the tap on the lens is extended to the main ring
// and to the basement.
test('a tap on the lens drills one level in on the main ring, and in the basement goes to the verse; the word beside the lens still marks', () => {
  const main = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/main.js'), 'utf8');
  const click = main.slice(main.indexOf("app.view.magnifierCircle.addEventListener('click'"), main.indexOf('// Expose app to window for console API'));
  assert.ok(click.indexOf('strikeSettledChar()') < click.indexOf('app.toggleVersePart?.()') && click.indexOf('app.toggleVersePart?.()') < click.indexOf('app.largestPyramidIndex?.()'), 'search first, then the half of a divided verse, then the drill');
  assert.match(click, /if \(app\.toggleVersePart\?\.\(\)\) return;/, 'a divided verse keeps its own tap');
  assert.match(click, /if \(star < 0\) return;/, 'a leaf has nothing below and the tap is inert');
  assert.match(click, /app\.handlePyramidNodeClick\?\.\(star\);/, 'by the same door a tapped star uses, which refuses while a migration flies');
  assert.match(click, /lensSwipeFiredAt && Date\.now\(\) - lensSwipeFiredAt < 700/, 'a stroke begun on the lens is not a tap');
  const hit = main.slice(main.indexOf('function lensHit'), main.indexOf('// Re-render ONLY the front stratum'));
  assert.match(hit, /if \(part !== 'word' && Math\.hypot/, 'the word alone can be asked for');
  assert.match(hit, /if \(part === 'glass'\) return false;/, 'and the glass alone');
  const up = main.slice(main.indexOf("['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>\n    strataLayer"), main.indexOf('// ── The strata transition tween'));
  assert.match(up, /if \(enter\) \{ if \(ch === BASEMENT\) BASEMENT\.select\(items\[target\]\); const went = goToStratum\(0\);/, 'the basement names its seat, then rises by the ordinary ascent');
});
