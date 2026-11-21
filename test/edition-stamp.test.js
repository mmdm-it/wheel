// O-325 (Howell 2026-11-21): an edition the volume stamps is named so, quietly,
// in a small line beside its own name on the ring; never across the text.
// The engine names no edition and holds no words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layWatermark, layWatermarkNote, WATERMARK_NOTE_SIZE } from '../src/view/focus-ring-view.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const arc = { hubX: 620, hubY: -140, radius: 760 };

test('the note lies one step hubward of the watermark, smaller, resting where the watermark rests', () => {
  const mark = layWatermark('KING JAMES', arc, 360, 707, 360, 'foot');
  const note = layWatermarkNote('non-catholic', arc, 360, 707, 360, 'foot');
  assert.ok(mark && note);
  const radiusOf = d => Number(d.match(/A ([\d.]+) /)[1]);
  assert.ok(radiusOf(note.d) < radiusOf(mark.d), 'nearer the hub than the name');
  assert.ok(radiusOf(mark.d) - radiusOf(note.d) < mark.size * 1.2, 'and close beside it');
  assert.ok(Math.abs(note.size - layWatermark('M', arc, 360, 707, 360, 'foot').size * WATERMARK_NOTE_SIZE) < 0.01);
  assert.equal(note.anchor, mark.anchor);
  assert.equal(note.offset, mark.offset);
  assert.equal(note.text, 'non-catholic', 'in the case the volume wrote it');
  assert.equal(layWatermarkNote('', arc, 360, 707, 360, 'foot'), null);
  assert.ok(layWatermarkNote('non-catholic', arc, 360, 707, 360), 'and it needs no watermark to stand beside');
});

test('the word is the volume\'s: which editions and what words come from its declaration, in the edition\'s own tongue', () => {
  const main = read('src/main.js');
  assert.match(main, /editionStampWords = root\?\.display_config\?\.edition_stamp \|\| null;/);
  const fn = main.slice(main.indexOf('function editionStampWord'), main.indexOf('// AN EMPTY PAGE (O-323)'));
  assert.match(fn, /edition\?\.stamp !== true \|\| !table\) return ''/, 'only an edition declared so');
  assert.match(fn, /table\[edition\.language\] \?\? table\.default/, 'in the tongue of the edition it is on');
  assert.match(main, /getWatermarkNote: \(\) => \(options\?\.previewHollow \? '' : editionStampWord\(options\?\.previewEdition \|\| /, 'the edition under the lens while a ring turns; none over an empty page');
});

test('nothing is laid across the text any more, and the note takes no touch', () => {
  const main = read('src/main.js');
  assert.doesNotMatch(main, /updateEditionStamp|edition-stamp/);
  const css = read('styles/base.css');
  assert.doesNotMatch(css, /#edition-stamp/);
  assert.match(css, /\.focus-ring-watermark-note \{[^}]*pointer-events: none;[^}]*\}/);
  const view = read('src/view/focus-ring-view.js');
  assert.match(view, /this\.watermarkNote\.setAttribute\('pointer-events', 'none'\)/);
});
