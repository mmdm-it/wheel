// THE WORD'S HALO TOUCHES THE NAMES ALONE (O-289, Howell 2026-11-10, his
// iPhone screenshot of BOOKMARK standing in the arc of its own watermark:
// "the halo around the bookmark label is covering the bookmark's watermark
// in the basement. That watermark should not be affected by the halo. The
// halo around the bookmark label exists only to prevent a collision with
// adjacent bookmark labels"). The halo was paint — a stroke in the ground's
// colour on the word — and paint covers whatever lies under it. Now it is a
// luminance mask the names' groups wear: white glass with the word drawn
// into it black, so only a name can be dimmed by it, and the watermark, the
// band and the discs are untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');
const treeOf = outer => { const all = []; (function walk(n) { for (const c of n.children || n.childNodes || []) { all.push(c); walk(c); } })(outer); return all; };
const tag = n => (n.tag ?? n.tagName)?.toLowerCase?.();
const cls = n => n.getAttribute?.('class') || '';

test('the names stand in groups of their own and wear the word\'s mask at a settle, not while turning', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const vp = getViewportInfo(411, 802);
  const items = ['a@e', 'b@e', 'c@e'];
  const opts = (selectedIndex, rotating = false, caption = () => 'Bookmark') => ({
    id: 'basement', viewport: vp, items, selectedIndex, mirrored: true, labelFor: k => k, allowEmpty: true, labelsBeside: true, lensShift: -4, rotating, caption,
    classFor: k => (k === 'c@e' ? 'is-provisional' : '')
  });
  const outer = renderStratum(svg, opts(0));
  const all = treeOf(outer);
  // The drawing: every disc, then the names' group, then the lens, its name's group, the word.
  const inner = outer.children.find(n => cls(n) === 'stratum-inner');
  const order = inner.children.map(n => `${tag(n)}.${cls(n).split(' ')[0]}`);
  const discs = order.filter(o => o === 'circle.secondary-strata-node');
  assert.equal(discs.length, 4, 'three seats and the lens');
  const names = inner.children.find(n => cls(n) === 'secondary-strata-names');
  const lensName = inner.children.find(n => cls(n) === 'secondary-strata-lens-name');
  assert.ok(names && lensName, 'the names and the lens\'s name in groups of their own');
  const seatDiscs = order.map((o, i) => (o === 'circle.secondary-strata-node' ? i : -1)).filter(i => i >= 0);
  assert.ok(order.indexOf('g.secondary-strata-names') > seatDiscs[2], 'the names after the three seats\' discs');
  assert.ok(order.indexOf('g.secondary-strata-names') < seatDiscs[3], 'and under the lens, drawn last');
  assert.ok(order.indexOf('g.secondary-strata-lens-name') > order.indexOf('g.secondary-strata-names'), 'the lens\'s name above them');
  assert.equal(order[order.length - 1], 'text.secondary-strata-caption', 'the word last');
  assert.equal(names.children.length, 3, 'every seat\'s name');
  assert.ok(names.children.every(n => cls(n).startsWith('secondary-strata-label')));
  assert.ok(lensName.children[0] && cls(lensName.children[0]).includes('is-magnified'));
  // A seat's class is worn by its name as well as its disc: the names are no longer the discs' next siblings.
  assert.ok(cls(names.children[2]).includes('is-provisional'), `the provisional seat's name says so (${cls(names.children[2])})`);
  assert.ok(!cls(names.children[0]).includes('is-provisional'));
  const css = read('styles/base.css');
  assert.match(css, /\.secondary-strata-label\.is-coming \{ opacity: 0\.62; \}/, 'the placeholder\'s faint name by its own class');
  assert.doesNotMatch(css, /\.secondary-strata-node\.is-coming \+ \.secondary-strata-label/, 'the sibling rule is gone');
  // The mask: in the stratum's own defs, white glass and a <use> of the word.
  const defs = outer.children.find(n => tag(n) === 'defs');
  assert.ok(defs, 'defs on the stratum');
  const mask = defs.children.find(n => tag(n) === 'mask');
  assert.equal(mask.getAttribute('id'), 'basement-halo-cut');
  assert.equal(mask.getAttribute('maskUnits'), 'userSpaceOnUse', 'laid in the glass\'s space, not the names\' bounds');
  const [sheet, copy] = mask.children;
  assert.equal(tag(sheet), 'rect'); assert.equal(sheet.getAttribute('fill'), '#fff');
  assert.equal(tag(copy), 'use'); assert.equal(copy.getAttribute('href'), '#basement-caption');
  assert.equal(copy.getAttribute('xlink:href'), '#basement-caption');
  assert.equal(cls(copy), 'caption-halo-cut');
  const word = all.find(n => cls(n).includes('secondary-strata-caption'));
  assert.equal(word.getAttribute('id'), 'basement-caption', 'the word carries the id the copy follows');
  // Settled with the word standing (no glass to measure here): the names wear the mask.
  assert.equal(names.getAttribute('mask'), 'url(#basement-halo-cut)');
  assert.equal(lensName.getAttribute('mask'), 'url(#basement-halo-cut)');
  // Turning: the word is hidden and the mask comes off — a masked group is rasterised at every frame.
  const turning = renderStratum(svg, opts(1.4, true));
  const tnames = treeOf(turning).find(n => cls(n) === 'secondary-strata-names');
  assert.equal(tnames.getAttribute('mask'), null, 'no mask while the ring turns');
  // No word to show (an oft-quoted seat): no mask either.
  const silent = renderStratum(svg, opts(2, false, () => null));
  assert.equal(treeOf(silent).find(n => cls(n) === 'secondary-strata-names').getAttribute('mask'), null);
});

test('on a glass that can be measured, the mask is worn only where a shown name meets the word\'s halo', async () => {
  installBrowserGlobals();
  const { wearHalo } = await import('../src/view/secondary-strata-view.js');
  const el = (rect, attrs = {}, fontSize = '20px') => ({
    attrs, style: { fontSize },
    getAttribute(k) { return this.attrs[k] ?? null; },
    getBoundingClientRect: () => rect
  });
  const group = () => { const a = {}; return { a, setAttribute(k, v) { a[k] = v; }, removeAttribute(k) { delete a[k]; }, getAttribute(k) { return a[k] ?? null; } }; };
  const word = el({ left: 200, right: 300, top: 400, bottom: 420, width: 100, height: 20 });
  const far = el({ left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20 });
  const touching = el({ left: 100, right: 198, top: 410, bottom: 430, width: 98, height: 20 });   // within the 0.3em (6px) reach of the stroke
  const clear = el({ left: 100, right: 190, top: 410, bottom: 430, width: 90, height: 20 });      // 10px off: beyond it
  const hidden = el({ left: 250, right: 350, top: 405, bottom: 425, width: 100, height: 20 }, { display: 'none' });
  const outer = { __cut: [group(), group()] };
  assert.equal(wearHalo(outer, 'b', word, [far, clear]), false, 'nothing meets the word');
  assert.equal(outer.__cut[0].getAttribute('mask'), null);
  assert.equal(wearHalo(outer, 'b', word, [far, touching]), true, 'a name within the stroke\'s reach');
  assert.equal(outer.__cut[0].getAttribute('mask'), 'url(#b-halo-cut)');
  assert.equal(outer.__cut[1].getAttribute('mask'), 'url(#b-halo-cut)');
  assert.equal(wearHalo(outer, 'b', word, [hidden]), false, 'a hidden name crossing it counts for nothing');
  assert.equal(outer.__cut[0].getAttribute('mask'), null, 'and the mask comes off again');
  const hiddenWord = el({ left: 200, right: 300, top: 400, bottom: 420, width: 100, height: 20 }, { display: 'none' });
  assert.equal(wearHalo(outer, 'b', hiddenWord, [touching]), false, 'no word, no mask');
  assert.equal(wearHalo(outer, 'b', null, [touching]), false);
});

test('the word paints no stroke of its own; its copy in the mask is black at the halo\'s opacity', () => {
  const css = read('styles/base.css');
  const rule = css.match(/\.secondary-strata-caption\s*\{([^}]*)\}/)[1];
  assert.match(rule, /fill: var\(--caption-ink, var\(--color-text\)\)/);
  assert.match(rule, /stroke: #000;/);
  assert.match(rule, /stroke-opacity: var\(--caption-halo-opacity, 0\)/, 'off on the glass');
  assert.doesNotMatch(rule, /--color-ground/, 'no ground paint: the halo covers nothing');
  const cut = css.match(/\.caption-halo-cut\s*\{([^}]*)\}/)[1];
  assert.match(cut, /--caption-ink: #000/);
  assert.match(cut, /--caption-halo-opacity: var\(--parent-halo-opacity, 0\.85\)/, 'the parent label\'s knob, as before');
  const light = read('src/view/basement-light.js');
  assert.doesNotMatch(light, /paint\('--color-ground'/, 'the ground is no longer a variable');
});
