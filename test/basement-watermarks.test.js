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
import { basementGround, basementPalette, setBasementDepth } from '../src/view/basement-light.js';
import { legendLines } from '../src/view/secondary-strata-view.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');

test('the ground deepens in its own hue: every channel scaled alike, the theme untouched at depth 0', () => {
  assert.equal(basementGround('#d9a877', 0), 'rgb(217, 168, 119)');
  const deep = basementGround('#d9a877', 1).match(/\d+/g).map(Number);
  const ratio = deep.map((v, i) => v / [217, 168, 119][i]);
  assert.ok(ratio.every(r => Math.abs(r - ratio[0]) < 0.01), `one scale for all channels (${ratio.map(r => r.toFixed(3))})`);
  assert.ok(ratio[0] > 0.45 && ratio[0] < 0.55, `a lot darker — about half (${ratio[0].toFixed(3)})`);
  // Halfway through the dissolve, halfway down.
  const mid = basementGround('rgb(217, 168, 119)', 0.5).match(/\d+/g).map(Number);
  assert.ok(mid[0] > deep[0] && mid[0] < 217);
  assert.equal(basementGround('', 1), null, 'no theme, no ground');
});

test('the depth paints the root\'s inline ground — the one the theme paints — and the theme\'s own colour back on the floors above', () => {
  const root = { style: (() => { const s = {}; Object.defineProperties(s, {
    setProperty: { value(n, v) { s[n] = v; } }, getPropertyValue: { value(n) { return s[n] ?? ''; } }, removeProperty: { value(n) { delete s[n]; } } }); return s; })() };
  root.style.setProperty('--theme-color-bg', '#d9a877');
  root.style.setProperty('--theme-color-band', '#6c5339');
  root.style.setProperty('--theme-color-text', '#2a1a0f');
  root.style.setProperty('--theme-color-orbital', '#8b6f47');
  root.style.setProperty('--theme-color-node', '#8b6f47');
  root.style.backgroundColor = '#d9a877';   // as applyTheme paints it
  setBasementDepth(1, root);
  assert.equal(root.style.backgroundColor, basementGround('#d9a877', 1));
  for (const v of ['--color-bg', '--color-orbital', '--color-nodes']) assert.equal(root.style[v], undefined, `${v} untouched: the seats are the theme's own, and the sideways page reads --color-bg`);
  const theme = { bg: '#d9a877', band: '#6c5339', text: '#2a1a0f' };
  const deep = basementPalette(theme, 1);
  const lum = c => c.match(/\d+/g).map(Number).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  // THE BAND IS THE WATERMARK'S TONE (O-278): the theme's ink on the deep ground at the watermark's faintness — a little darker than the ground, not nearly black.
  assert.equal(root.style['--color-band'], deep.band);
  const bandRatio = lum(deep.band) / lum(root.style.backgroundColor);
  assert.ok(bandRatio > 0.75 && bandRatio < 0.95, `the band a quiet shade under the ground (${bandRatio.toFixed(3)})`);
  const ground = root.style.backgroundColor.match(/\d+/g).map(Number);
  const wm = ground.map((g, i) => Math.round(g + ([42, 26, 15][i] - g) * 0.18));
  assert.equal(deep.band, `rgb(${wm.join(', ')})`, 'exactly the ink at 0.18 over the ground');
  // THE INK INVERTS: the names and the globe take the tan the floors above are painted with; the on-seat lettering keeps the theme's ink.
  assert.equal(root.style['--color-text'], 'rgb(217, 168, 119)');
  assert.equal(root.style['--color-globe'], 'rgb(217, 168, 119)');
  assert.equal(root.style['--color-orbital-label'], '#2a1a0f');
  assert.ok(lum(root.style['--color-text']) / lum(root.style.backgroundColor) > 1.9, 'the names stand well off the ground');
  // Halfway: every value between its theme and its basement, so the glide is continuous at both ends.
  setBasementDepth(0.5, root);
  assert.equal(root.style.backgroundColor, basementGround('#d9a877', 0.5));
  const mid = basementPalette(theme, 0.5);
  assert.equal(root.style['--color-band'], mid.band);
  assert.ok(lum(mid.band) > lum(deep.band) && lum(mid.band) < lum('rgb(108, 83, 57)'));
  assert.ok(lum(mid.ink) > lum('rgb(42, 26, 15)') && lum(mid.ink) < lum('rgb(217, 168, 119)'));
  assert.equal(basementPalette(theme, 0).band, 'rgb(108, 83, 57)', 'the theme\'s own band at depth 0');
  setBasementDepth(0, root);
  assert.equal(root.style.backgroundColor, 'rgb(217, 168, 119)', 'the theme\'s own colour painted back');
  for (const v of ['--color-band', '--color-text', '--color-orbital-label', '--color-globe']) assert.equal(root.style[v], undefined, `${v} is the theme's own again`);
  // A theme without a band or text still gets its ground, and nothing else is painted.
  const bare = basementPalette({ bg: '#d9a877' }, 1);
  assert.ok(bare.ground && !bare.band && !bare.ink);
});

test('the host hands the glide the floor\'s dissolve and the settle the floor it stands on', () => {
  const main = read('src/main.js');
  assert.match(main, /if \(toFront < 0 \|\| fromFront < 0\) setBasementDepth\(1 - primaryOpacity\);/, 'the ground rides the floor\'s own dissolve');
  assert.match(main, /setBasementDepth\(1\);/, 'deep when the basement is front');
  assert.match(main, /setBasementDepth\(0\);/, 'the theme\'s own above it');
});

test('the host leads the bookmarks word with the tongue\'s "and", the ampersand by default', () => {
  const main = read('src/main.js');
  assert.match(main, /const BASEMENT_AND = '&';/);
  assert.match(main, /\[MARK_BOOKMARK, basementWords\.bookmark \? `\$\{basementWords\.and \|\| BASEMENT_AND\} \$\{basementWords\.bookmark\}` : null, 1\]/);
  assert.match(main, /and: namesMap\.vocabulary\.and \|\| null/);
});

test('a word breaks at its spaces and after its hyphens', () => {
  assert.deepEqual(legendLines('OFT-QUOTED'), ['OFT-', 'QUOTED']);
  assert.deepEqual(legendLines('USEIN LAINATUT'), ['USEIN', 'LAINATUT']);
  assert.deepEqual(legendLines('BOOKMARKS'), ['BOOKMARKS']);
  assert.deepEqual(legendLines('  '), []);
});

test('each word fills the visible stretch of its arc, is sized by the view, and lies under the ring', async () => {
  installBrowserGlobals();
  const { renderStratum, visibleArc } = await import('../src/view/secondary-strata-view.js');
  const vp = getViewportInfo(411, 802);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const items = Array.from({ length: 20 }, (_, i) => `s${i}`);
  const outer = renderStratum(svg, { id: 'wm', viewport: vp, items, selectedIndex: 5, mirrored: true, labelsBeside: true, labelFor: k => k,
    legend: [['is-landmark', 'Oft-quoted', -1], ['is-bookmark', '& Bookmarks', 1]] });
  const kids = [...outer.__inner.children];
  const words = kids.filter(n => (n.getAttribute('class') || '').startsWith('secondary-strata-legend '));
  assert.equal(words.length, 2);
  const [oft, book] = words;
  // Much larger than the title they replace, and set by the view, not the sheet.
  const px = n => parseFloat(n.style.fontSize);
  assert.ok(px(oft) > 40 && px(book) > 40, `watermark sizes (${px(oft)}, ${px(book)})`);
  assert.ok(px(oft) <= 0.17 * vp.SSd + 0.1 && px(book) <= 0.17 * vp.SSd + 0.1, 'under the ceiling');
  // The hyphenated word is two lines, each on its own arc; the first line's arc is the farther from the hub.
  assert.equal(oft.dataset.lines, '2');
  assert.equal(book.dataset.lines, '2');
  assert.deepEqual([...oft.children].map(tp => tp.textContent), ['OFT-', 'QUOTED']);
  assert.deepEqual([...book.children].map(tp => tp.textContent), ['&', 'BOOKMARKS'], 'the conjunction leads');
  const arcs = t => [...t.children].map(tp => kids.find(n => n.getAttribute('id') === tp.getAttribute('href').slice(1)));
  const radiusOf = a => Number(a.getAttribute('d').split(' A ')[1].split(' ')[0]);
  const [oftTop, oftLow] = arcs(oft).map(radiusOf);
  assert.ok(oftTop > oftLow, 'OFT- rides the outer of the two arcs');
  assert.ok(oftTop - oftLow > px(oft) && oftTop - oftLow < 1.5 * px(oft), 'one line pitch apart');
  // Nearer the band than the first cut (0.55 of the short side): the inner WORD's arc within 0.4 of it, the "&" a pitch nearer the band still.
  const [andR, bookR] = arcs(book).map(radiusOf);
  assert.ok(andR > bookR && andR - bookR > px(book), 'the & stands between the word and the band');
  const { radius } = (await import('../src/geometry/secondary-strata-geometry.js')).computeStrataLayout(vp, 20, 5, true, { lensShift: 0 }).arc;
  assert.ok(radius - bookR < 0.4 * vp.SSd && radius - bookR > 0.25 * vp.SSd, `bookmarks ${(radius - bookR).toFixed(0)} px inside the band`);
  // Each arc's ends lie on the glass: every line is centred on what the reader can see.
  const ends = a => { const m = a.getAttribute('d').match(/M ([\d.-]+) ([\d.-]+) A [\d.]+ [\d.]+ 0 0 1 ([\d.-]+) ([\d.-]+)/); return [[+m[1], +m[2]], [+m[3], +m[4]]]; };
  for (const t of words) for (const a of arcs(t)) for (const [x, y] of ends(a)) {
    assert.ok(x >= -1 && x <= vp.width + 1 && y >= -1 && y <= vp.height + 1, `${t.textContent} arc end (${x}, ${y}) on the glass`);
  }
  // Under everything: both words and their arcs come before the first disc.
  const firstDisc = kids.findIndex(n => n.tag === 'circle');
  assert.ok(firstDisc > 0);
  for (const t of words) assert.ok(kids.indexOf(t) < firstDisc && arcs(t).every(a => kids.indexOf(a) < firstDisc), `${t.textContent} lies under the ring`);
  // The run finder itself: a circle wholly off the glass has no run.
  assert.equal(visibleArc(5000, 5000, 10, 411, 802), null);
});

test('the sheet paints the words in the band\'s own tone, leaves their size to the view, and lets the globe take the room\'s ink', () => {
  const css = read('styles/base.css');
  const rule = css.match(/\.secondary-strata-legend\s*\{([^}]*)\}/)[1];
  assert.match(rule, /fill:\s*var\(--color-band\b/, 'the watermark is the band\'s colour by construction');
  assert.doesNotMatch(rule, /opacity:/, 'opaque: its faintness is the band\'s tone, not a translucency');
  assert.doesNotMatch(rule, /clamp\(/, 'no clamp: the view measures the glass');
  assert.match(css, /#dimension-button svg,\s*#search-button svg\s*\{[^}]*color:\s*var\(--color-globe,\s*#363636\)/, 'the globe reads --color-globe');
});
