// A HOLLOW EDITION LEADS TO ITS SHELF (O-284, Howell 2026-11-09). From Hebrew
// Genesis there was no way to the Greek Mark but out to the root or through
// a third edition: at a leaf the ring offered only the editions holding it
// (his rule of 2026-08-19, which stands for the FILLED seats). Now an
// edition that is real and does not hold the place stands HOLLOW in its
// place on its tongue's ring — a door, not a page — and a tongue whose every
// edition is elsewhere stands hollow on the language ring. Choosing the
// hollow edition takes the reader to the volume's top ring first and commits
// the edition there, where nothing is filtered, so they arrive at its shelf
// and never at a verse it lacks. Nothing apologises: the seat said beforehand what it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');

const TRANSLATIONS = {
  HEB: { language: 'hebrew', proofread: true, hasChart: true, name: 'Hebrew' },           // the first division only
  LXX: { language: 'greek', proofread: true, hasChart: true, name: 'Septuagint' },        // the first division only
  NTG: { language: 'greek', proofread: true, hasChart: true, name: 'Greek Testament' },   // the second division only
  LAT: { language: 'latin', proofread: true, hasChart: true, name: 'Vulgate' }            // both
};
const LANGS = { languages: ['hebrew', 'greek', 'latin'].map(id => ({ id, autonym: id })) };
const make = () => {
  let state = { language: 'hebrew', edition: 'HEB' };
  const dispatched = [];
  const store = { getState: () => state, dispatch: a => { dispatched.push(a); state = { language: a.language, edition: a.defaultEdition }; }, subscribe: () => () => {} };
  return { bridge: createDimensionBridge({ store, translationsMeta: { translations: TRANSLATIONS }, languagesMeta: LANGS }), dispatched };
};
const shape = (bridge, lang) => bridge.translationsOf(lang).map(k => (bridge.isElsewhere(k) ? `○${k}` : bridge.isComing(k) ? `~${k}` : k));

test('in the first division the Greek Testament stands hollow in its place; at the root nothing is hollow', () => {
  const { bridge } = make();
  bridge.setEditionsHere(['HEB', 'LXX', 'LAT']);   // Genesis
  assert.deepEqual(shape(bridge, 'greek'), ['LXX', '○NTG'], 'the Septuagint filled, the Testament hollow, in the editions\' order');
  assert.equal(bridge.isElsewhere('NTG'), true);
  assert.equal(bridge.isElsewhere('LXX'), false);
  assert.equal(bridge.isComing('NTG'), false, 'hollow, but not a placeholder: it is real');
  bridge.setEditionsHere(null);   // the root
  assert.deepEqual(shape(bridge, 'greek'), ['LXX', 'NTG'], 'nothing is filtered at the root, so nothing is elsewhere');
  assert.equal(bridge.isElsewhere('NTG'), false);
});

test('a tongue whose every edition is elsewhere stands hollow on the language ring, never absent', () => {
  const { bridge } = make();
  bridge.setEditionsHere(['NTG', 'LAT']);   // Mark
  assert.deepEqual(bridge.languagesAvailable(), ['hebrew', 'greek', 'latin'], 'Hebrew is on the ring');
  assert.equal(bridge.isElsewhereLanguage('hebrew'), true, 'hollow');
  assert.equal(bridge.isElsewhereLanguage('greek'), false, 'Greek holds Mark');
  assert.equal(bridge.isComingLanguage('hebrew'), false, 'not a roadmap tongue: a real one, elsewhere');
  assert.deepEqual(shape(bridge, 'hebrew'), ['○HEB'], 'its plane shows its edition hollow');
  assert.deepEqual(shape(bridge, 'greek'), ['○LXX', 'NTG']);
});

test('settling the language ring on a hollow tongue is display-only; the filter refuses the edition at the leaf and commits it at the top, where nothing is filtered', () => {
  const { bridge, dispatched } = make();
  bridge.setEditionsHere(['NTG', 'LAT']);
  assert.equal(bridge.setLanguage('hebrew'), true, 'the lens may rest on it');
  assert.deepEqual(dispatched, [], 'nothing committed by the tongue alone');
  assert.equal(bridge.setTranslation('HEB'), false, 'the filter stands at the leaf for every caller (a stale preview, a deep link, the door before it has moved)');
  bridge.setEditionsHere(null);   // the host has seated the primary at the top ring
  assert.equal(bridge.isElsewhere('HEB'), false, 'nothing is elsewhere at the top');
  assert.equal(bridge.setTranslation('HEB'), true, 'so the ordinary commit is the door');
  assert.deepEqual(dispatched.map(a => a.defaultEdition), ['HEB']);
  assert.equal(bridge.getSelection().translation, 'HEB');
});

test('the host draws the door, keeps it live, previews around it, and walks through it to the shelf', () => {
  const main = read('src/main.js');
  const secondary = main.slice(main.indexOf("{ id: 'secondary'"), main.indexOf("{ id: 'tertiary'"));
  assert.match(secondary, /dimensionBridge\.isElsewhere\?\.\(key\) \? 'is-elsewhere'/, 'hollow on the edition ring');
  assert.match(secondary, /inert: key => Boolean\(dimensionBridge\.isComing\?\.\(key\)\)/, 'but not inert: the lens may rest on it and the finger choose it');
  assert.match(secondary, /dimensionBridge\.isElsewhere\?\.\(key\) \? goToShelf\(key\) : dimensionBridge\.setTranslation\(key\)/, 'chosen, it leads to the shelf');
  const tertiary = main.slice(main.indexOf("{ id: 'tertiary'"), main.indexOf('// THE VOLUME\'S OWN STRATA'));
  assert.match(tertiary, /dimensionBridge\.isElsewhereLanguage\?\.\(id\) \? 'is-elsewhere'/, 'hollow on the language ring');
  const door = main.slice(main.indexOf('function goToShelf'), main.indexOf('function leaveBasement'));
  assert.match(door, /seatAtShelf\(currentApp\)/, 'the top ring first, in the edition being left');
  assert.match(door, /if \(!shelved\) return false;[\s\S]*refreshEditionsHere\(\);\s*return dimensionBridge\.setTranslation\(key\);/, 'then the position re-asked and the ordinary commit, so the reseat refills the top ring in the new edition');
  assert.match(main, /seatAtShelf = typeof handlerSet\.seatAtShelf === 'function' \? handlerSet\.seatAtShelf : \(\) => false;/, 'the adapter\'s, bound per volume');
  // The preview never paints the reader's place in an edition that lacks it.
  assert.match(main, /editions\.find\(k => !dimensionBridge\.isComing\?\.\(k\) && !dimensionBridge\.isElsewhere\?\.\(k\)\)/, 'a passing tongue previews a filled seat first');
  assert.match(main, /dimensionBridge\.isComing\?\.\(edition\) \|\| dimensionBridge\.isElsewhere\?\.\(edition\)\) \{/, 'a hollow seat under the lens leaves the committed reading');
  const adapter = read('src/adapters/bible-adapter.js');
  const shelf = adapter.slice(adapter.indexOf('seatAtShelf: app => {'), adapter.indexOf('seatAtLeaf: (leaf, app) => {'));
  assert.match(shelf, /buildBibleTestaments\(manifest, namesMap, \{ translationName, edition \}\)/, 'the volume\'s top ring');
  assert.match(shelf, /app\.setPrimaryItems\(items, 0, true\)/, 'set, not migrated');
  assert.match(shelf, /verseChainItems = null;/, 'the old edition\'s chains dropped');
  assert.match(shelf, /bibleMode = 'testament';/, 'and the level travels with the ring, so the sky fills with the division\'s books');
  const css = read('styles/base.css');
  assert.match(css, /\.secondary-strata-node\.is-elsewhere \{ fill: none; stroke: var\(--color-orbital\); stroke-width: 1\.5; \}/, 'hollow');
  assert.doesNotMatch(css, /\.is-elsewhere \+ \.secondary-strata-label/, 'its name at full strength: it can be chosen');
});
