// O-325 (Howell 2026-11-21): an edition the volume stamps wears the volume's
// words across its text. The engine names no edition and holds no words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the stamp is the volume\'s: which editions and what words come from its declaration, in the edition\'s own tongue', () => {
  const main = read('src/main.js');
  assert.match(main, /editionStampWords = root\?\.display_config\?\.edition_stamp \|\| null;/);
  const fn = main.slice(main.indexOf('function updateEditionStamp'), main.indexOf('// AN EMPTY PAGE (O-323)'));
  assert.match(fn, /edition\?\.stamp === true && table/, 'only an edition declared so');
  assert.match(fn, /table\[edition\.language\] \?\? table\.default/, 'in the tongue of the edition it is on');
  assert.match(fn, /if \(!word \|\| !lines\.length\) \{ hide\(\); return; \}/, 'an empty page wears none');
  assert.match(fn, /detailPanel\.appendChild\(editionStampEl\)/, 'in the text\'s panel, so it recedes and fades with the text');
  assert.doesNotMatch(fn, /getBoundingClientRect/, 'laid out from layout boxes, whatever scale the stack wears');
});

test('every paint of the text settles the stamp: cleared with the lines, laid over them, gone with an empty page', () => {
  const main = read('src/main.js');
  const render = main.slice(main.indexOf('function renderDetail('), main.indexOf('let marginRenderSeq'));
  assert.ok(render.indexOf('updateEditionStamp(null);') > 0 && render.indexOf('updateEditionStamp(null);') < render.indexOf('updateEditionStamp(translation);'));
  assert.match(render, /if \(node\) detailContent\.appendChild\(node\);\n  updateEditionStamp\(translation\);/);
  const blank = main.slice(main.indexOf('function blankDetail'), main.indexOf('// Whether the page behind the glass'));
  assert.match(blank, /updateEditionStamp\(null\);/);
  assert.match(read('styles/base.css'), /#edition-stamp \{[^}]*pointer-events: none;[^}]*\}/, 'and it never takes a touch');
});
