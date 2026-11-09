// THE BASEMENT'S LIGHT AND ITS WATERMARKS (O-277, Howell 2026-11-08): the
// ground a few shades deeper in the volume's own hue, riding the floor's
// dissolve; the legend's two words grown to fill the stretch of their arcs
// the glass shows, faint, and drawn under everything on the ring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';
import { basementGround, setBasementDepth } from '../src/view/basement-light.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');

test('the ground deepens in its own hue: every channel scaled alike, the theme untouched at depth 0', () => {
  assert.equal(basementGround('#d9a877', 0), 'rgb(217, 168, 119)');
  const deep = basementGround('#d9a877', 1).match(/\d+/g).map(Number);
  const ratio = deep.map((v, i) => v / [217, 168, 119][i]);
  assert.ok(ratio.every(r => Math.abs(r - ratio[0]) < 0.01), `one scale for all channels (${ratio.map(r => r.toFixed(3))})`);
  assert.ok(ratio[0] > 0.8 && ratio[0] < 0.88, `a sixth darker, about (${ratio[0].toFixed(3)})`);
  // Halfway through the dissolve, halfway down.
  const mid = basementGround('rgb(217, 168, 119)', 0.5).match(/\d+/g).map(Number);
  assert.ok(mid[0] > deep[0] && mid[0] < 217);
  assert.equal(basementGround('', 1), null, 'no theme, no ground');
});

test('the depth writes the legacy ground variable on the root and clears it on the floors above', () => {
  const root = { style: (() => { const s = {}; Object.defineProperties(s, {
    setProperty: { value(n, v) { s[n] = v; } }, getPropertyValue: { value(n) { return s[n] ?? ''; } }, removeProperty: { value(n) { delete s[n]; } } }); return s; })() };
  root.style.setProperty('--theme-color-bg', '#d9a877');
  setBasementDepth(1, root);
  assert.equal(root.style['--color-bg'], basementGround('#d9a877', 1));
  setBasementDepth(0.25, root);
  assert.equal(root.style['--color-bg'], basementGround('#d9a877', 0.25));
  setBasementDepth(0, root);
  assert.equal(root.style['--color-bg'], undefined, 'the theme speaks again');
});

test('the host hands the glide the floor\'s dissolve and the settle the floor it stands on', () => {
  const main = read('src/main.js');
  assert.match(main, /if \(toFront < 0 \|\| fromFront < 0\) setBasementDepth\(1 - primaryOpacity\);/, 'the ground rides the floor\'s own dissolve');
  assert.match(main, /setBasementDepth\(1\);/, 'deep when the basement is front');
  assert.match(main, /setBasementDepth\(0\);/, 'the theme\'s own above it');
});

test('each word fills the visible stretch of its arc, is sized by the view, and lies under the ring', async () => {
  installBrowserGlobals();
  const { renderStratum, visibleArc } = await import('../src/view/secondary-strata-view.js');
  const vp = getViewportInfo(411, 802);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const items = Array.from({ length: 20 }, (_, i) => `s${i}`);
  const outer = renderStratum(svg, { id: 'wm', viewport: vp, items, selectedIndex: 5, mirrored: true, labelsBeside: true, labelFor: k => k,
    legend: [['is-landmark', 'Oft-quoted', -1], ['is-bookmark', 'Bookmarks', 1]] });
  const kids = [...outer.__inner.children];
  const words = kids.filter(n => (n.getAttribute('class') || '').startsWith('secondary-strata-legend '));
  assert.equal(words.length, 2);
  const [oft, book] = words;
  // Much larger than the title they replace, and set by the view, not the sheet.
  const px = n => parseFloat(n.style.fontSize);
  assert.ok(px(oft) > 40 && px(book) > 40, `watermark sizes (${px(oft)}, ${px(book)})`);
  assert.ok(px(oft) <= 0.2 * vp.SSd + 0.1 && px(book) <= 0.2 * vp.SSd + 0.1, 'under the ceiling');
  // Each arc's ends lie on the glass: the word is centred on what the reader can see.
  const arcOf = t => kids.find(n => n.getAttribute('id') === t.firstChild.getAttribute('href').slice(1));
  const ends = t => { const d = arcOf(t).getAttribute('d'); const m = d.match(/M ([\d.-]+) ([\d.-]+) A [\d.]+ [\d.]+ 0 0 1 ([\d.-]+) ([\d.-]+)/); return [[+m[1], +m[2]], [+m[3], +m[4]]]; };
  for (const t of words) for (const [x, y] of ends(t)) {
    assert.ok(x >= -1 && x <= vp.width + 1 && y >= -1 && y <= vp.height + 1, `${t.textContent} arc end (${x}, ${y}) on the glass`);
  }
  // Under everything: both words and their arcs come before the first disc.
  const firstDisc = kids.findIndex(n => n.tag === 'circle');
  assert.ok(firstDisc > 0);
  for (const t of words) assert.ok(kids.indexOf(t) < firstDisc && kids.indexOf(arcOf(t)) < firstDisc, `${t.textContent} lies under the ring`);
  // The run finder itself: a circle wholly off the glass has no run.
  assert.equal(visibleArc(5000, 5000, 10, 411, 802), null);
});

test('the sheet makes the words faint and leaves their size to the view', () => {
  const css = read('styles/base.css');
  const rule = css.match(/\.secondary-strata-legend\s*\{([^}]*)\}/)[1];
  assert.match(rule, /opacity:\s*var\(--basement-watermark-opacity,\s*0?\.1\)/);
  assert.doesNotMatch(rule, /clamp\(/, 'no clamp: the view measures the glass');
});
