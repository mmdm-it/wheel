// THE BASEMENT TELLS A LANDMARK BY ITS FACE, NOT ITS COLOUR (O-275, Howell
// 2026-11-08: "I don't like the blue and red coding for landmarks and
// bookmarks. I want all the labels to be black"). A landmark's name and
// legend word slant; a bookmark's stand upright; and a name in a script
// that has no italic — Hebrew, Arabic, Syriac — stays upright, its disc
// alone carrying the distinction, rather than wearing a browser-made oblique.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, '..', f), 'utf8');

test('the stylesheet slants a landmark and colours nothing', () => {
  const css = read('styles/base.css');
  assert.match(css, /\.secondary-strata-label\.is-landmark, \.secondary-strata-legend\.is-landmark \{ font-style: italic; \}/);
  assert.match(css, /\.secondary-strata-label\.is-upright-script, \.secondary-strata-legend\.is-upright-script \{ font-style: normal; \}/);
  assert.doesNotMatch(css, /is-(landmark|bookmark)[^\n]*fill:/, 'no mark carries a colour');
  assert.doesNotMatch(css, /#7f1d1d|#16337a/, 'the dark red and dark blue are gone');
});

test('the page asks Google for the italic faces the slant needs', () => {
  const html = read('index.html');
  assert.match(html, /Montserrat:ital,wght@0,500;0,700;1,500;1,700/);
  assert.match(html, /Noto\+Sans:ital,wght@0,500;0,700;1,500;1,700/);
});

test('a Hebrew landmark name and legend word are kept upright; a Latin one is not', async () => {
  installBrowserGlobals();
  const { renderStratum } = await import('../src/view/secondary-strata-view.js');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const items = ['kept', 'heb', 'lat'];   // the seat under the lens shows its name in the lens, not beside its disc
  const names = { heb: 'בראשית א׳ 1', lat: 'Genesis 1:1', kept: 'John 3:16' };
  const opts = selectedIndex => ({
    id: 'basement', viewport: { width: 400, height: 800 }, items, selectedIndex, labelsBeside: true,
    labelFor: k => names[k],
    markFor: k => (k === 'kept' ? 'is-bookmark' : 'is-landmark'),
    legend: [['is-landmark', 'ציוני דרך'], ['is-bookmark', 'סימניות']]
  });
  const cls = n => n.getAttribute('class');
  let outer = renderStratum(svg, opts(0));
  assert.match(cls(outer.__seats[1].label), /is-landmark is-upright-script/, 'the Hebrew landmark stays upright');
  assert.match(cls(outer.__seats[2].label), /is-landmark(?! is-upright)/, 'the Latin landmark slants');
  assert.match(cls(outer.__lensLabel), /is-bookmark(?! is-upright)/, 'a bookmark needs no exemption');
  outer = renderStratum(svg, opts(1));
  assert.match(cls(outer.__lensLabel), /is-landmark is-upright-script/, 'in the lens too');
  const legend = [...outer.__inner.children].filter(n => (cls(n) || '').includes('secondary-strata-legend')).map(cls);
  assert.deepEqual(legend, ['secondary-strata-legend is-landmark is-upright-script', 'secondary-strata-legend is-bookmark is-upright-script'], 'Hebrew legend words both wear the exemption; on the upright word it is idle');
});
