// THE SEATS OF ONE VERSE STAND IN THE RINGS' ORDER (O-283, Howell 2026-11-09):
// a verse kept in several tongues sorts on the basement ring as the language
// ring sorts its tongues, and within a tongue as the edition ring sorts its
// editions — not by the volume's declaration, a list no reader sees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';
import { inOrder } from '../src/core/bookmarks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(here, '..', p), 'utf8');

// Declared in one order (the volume's list), ringed in another (the registry's).
const TRANSLATIONS = {
  ENG1: { language: 'english', proofread: true, hasChart: true, name: 'First English' },
  HEB:  { language: 'hebrew', proofread: true, hasChart: true, name: 'Hebrew' },
  SYC:  { language: 'syriac', proofread: true, hasChart: true, name: 'Syriac' },
  ENG2: { language: 'english', proofread: true, hasChart: true, name: 'Second English' },
  GRC:  { language: 'greek', proofread: true, hasChart: true, name: 'Greek' },
  LAT:  { language: 'latin', proofread: true, hasChart: true, name: 'Latin' },
  ENG3: { language: 'english', proofread: true, hasChart: true, name: 'Third English' }
};
const LANGUAGES = { languages: ['hebrew', 'greek', 'latin', 'syriac', 'english'].map(id => ({ id, autonym: id })) };

const makeBridge = () => {
  let state = { language: 'english', edition: 'ENG1' };
  const subs = [];
  const store = { getState: () => state, dispatch: a => { state = { language: a.language, edition: a.defaultEdition }; subs.forEach(fn => fn(state)); }, subscribe: fn => { subs.push(fn); } };
  return createDimensionBridge({ store, translationsMeta: { translations: TRANSLATIONS }, languagesMeta: LANGUAGES });
};

test('the rank follows the language ring, then the edition ring within a tongue, not the declaration', () => {
  const bridge = makeBridge();
  bridge.setEditionsHere(null);
  assert.deepEqual(bridge.languagesAvailable(), ['hebrew', 'greek', 'latin', 'syriac', 'english'], 'the registry\'s order, not the declaration\'s');
  const rank = bridge.editionRank();
  const byRank = Object.keys(TRANSLATIONS).sort((a, b) => rank(a) - rank(b));
  assert.deepEqual(byRank, ['HEB', 'GRC', 'LAT', 'SYC', 'ENG1', 'ENG2', 'ENG3']);
  assert.deepEqual(bridge.translationsOf('english'), ['ENG1', 'ENG2', 'ENG3'], 'and within English the ring\'s own order');
  assert.equal(rank('no-such'), Number.POSITIVE_INFINITY, 'an edition of no known tongue comes last');
  assert.equal(rank(null), Number.POSITIVE_INFINITY);
});

test('an edition that is elsewhere ranks in its place on the ring (O-284); one on no ring at all still ranks under its tongue, after the ring', () => {
  const bridge = makeBridge();
  bridge.setEditionsHere(['HEB', 'ENG2', 'ENG3']);   // the reader's place: not in ENG1, nor Greek, Latin, Syriac
  const rank = bridge.editionRank();
  assert.ok(rank('HEB') < rank('GRC'), 'Greek holds nothing here and stands hollow, yet after Hebrew');
  assert.ok(rank('GRC') < rank('LAT') && rank('LAT') < rank('SYC'), 'in the registry\'s order of tongues');
  assert.ok(rank('SYC') < rank('ENG1') && rank('ENG1') < rank('ENG2') && rank('ENG2') < rank('ENG3'), 'the English ring in its order, the hollow seat in its place');
  // An edition on no ring (nothing to serve yet) still has a tongue to be ranked under: after that tongue's ring.
  let state = { language: 'english', edition: 'ENG1' };
  const store = { getState: () => state, dispatch: a => { state = { language: a.language, edition: a.defaultEdition }; }, subscribe: () => () => {} };
  const withUnserved = createDimensionBridge({ store, translationsMeta: { translations: { ...TRANSLATIONS, ENG0: { language: 'english', proofread: false, hasChart: false, name: 'Unserved English' } } }, languagesMeta: LANGUAGES });
  withUnserved.setEditionsHere(null);
  const r = withUnserved.editionRank();
  assert.ok(r('ENG3') < r('ENG0'), 'after its tongue\'s ring');
  assert.ok(Number.isFinite(r('ENG0')), 'but ranked, under its tongue');
});

test('seats of one verse, shuffled, come out in the rings\' order through the bookmarks\' sort', () => {
  const bridge = makeBridge();
  bridge.setEditionsHere(null);
  const rank = bridge.editionRank();
  const shuffled = ['ENG3', 'SYC', 'HEB', 'ENG1', 'LAT', 'GRC', 'ENG2'];
  const seats = shuffled.map(code => ({ id: `leaf-${code}`, edition: code, at: { rank: [18, 12, 12], tail: '', edition: rank(code) }, kept: '2026-11-09' }));
  assert.deepEqual(inOrder(seats).map(s => s.edition), ['HEB', 'GRC', 'LAT', 'SYC', 'ENG1', 'ENG2', 'ENG3']);
});

test('the host re-ranks every placed seat before the sort, with a bare edition as the one up', () => {
  const main = read('src/main.js');
  const items = main.slice(main.indexOf('const BASEMENT = {'), main.indexOf('label: key => keptSeat(key)'));
  assert.match(items, /const rankEdition = basementEditionRank\(\);/);
  assert.match(items, /edition: rankEdition\(b\.edition \?\? up\)/, 'a bare edition is the one up');
  assert.match(items, /return inOrder\(ranked\)\.map\(b => seatKey\(b\.id, b\.edition\)\);/);
  assert.match(main, /dimensionBridge\.editionRank\?\.\(\)/, 'the rank is the bridge\'s, which owns both rings');
});
