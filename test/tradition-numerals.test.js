// THE TRADITION'S OWN LETTERS (Howell 2026-08-02).
//
// "Chapters are Roman, verses are Arabic" (2026-07-20) was never about Rome:
// Roman numerals are LATIN's letter-numerals, and Arabic digits are the
// tradition-neutral set. Generalized — a chapter wears the letters of the
// tongue the text is in, a verse wears the universal digits. The child
// pyramid still tells a chapter from a verse at a glance (letters against
// digits), and a Greek Bible stops counting in a Latin hand.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toTraditionNumeral, toGreekNumeral, toHebrewNumeral, toRomanNumeral } from '../src/adapters/volume-helpers.js';
import { makeLabelFormatter, volumeConfigs } from '../src/volume-configs.js';

const formatterFor = locale => {
  const namesMap = { books: { IOHA: 'x' }, locale, vocabulary: null };
  const f = makeLabelFormatter({
    config: volumeConfigs.bible, volume: 'bible', level: 'verse',
    locale, namesMap, options: {}, manifest: {}, meta: {}
  });
  return { f, namesMap };
};

describe('the tradition supplies the chapter numerals', () => {
  it('each tongue counts in its own letters', () => {
    assert.equal(toTraditionNumeral(17, 'latin'), 'XVII');
    assert.equal(toTraditionNumeral(17, 'greek'), 'ιζʹ');
    assert.equal(toTraditionNumeral(17, 'hebrew'), 'י״ז');
  });

  it('a tongue without letter-numerals shows digits — honest, not borrowed', () => {
    assert.equal(toTraditionNumeral(17, 'russian'), '17');
    assert.equal(toTraditionNumeral(17, 'finnish'), '17');
    assert.equal(toTraditionNumeral(17, null), '17');
  });

  it('Hebrew wears its numeral marks, and never spells the Name', () => {
    assert.equal(toHebrewNumeral(1), 'א׳', 'geresh on a lone letter');
    assert.equal(toHebrewNumeral(17), 'י״ז', 'gershayim before the last of several');
    assert.equal(toHebrewNumeral(15), 'ט״ו', 'not יה');
    assert.equal(toHebrewNumeral(16), 'ט״ז', 'not יו');
    assert.equal(toHebrewNumeral(150), 'ק״נ', 'Psalms reach 150');
  });

  it('Greek closes with the keraia and uses the numeral-only letters', () => {
    assert.equal(toGreekNumeral(1), 'αʹ');
    assert.equal(toGreekNumeral(6), 'ϛʹ', 'stigma');
    assert.equal(toGreekNumeral(90), 'ϟʹ', 'koppa');
    assert.equal(toGreekNumeral(150), 'ρνʹ');
  });

  it('THE DISCRIMINATOR: chapters in letters, verses in digits, every tongue', () => {
    for (const [locale, chapter] of [['latin', 'XVII'], ['greek', 'ιζʹ'], ['hebrew', 'י״ז']]) {
      const { f } = formatterFor(locale);
      assert.equal(f({ item: { level: 'chapter', name: '17' }, context: 'node' }), chapter, locale);
      assert.equal(f({ item: { level: 'verse', name: '17' }, context: 'node' }), '17',
        `${locale}: a verse is Arabic or the pyramid stops discriminating`);
    }
  });

  it('the numerals follow a live language switch, with no rebuild', () => {
    const { f, namesMap } = formatterFor('latin');
    const chapter = () => f({ item: { level: 'chapter', name: '3' }, context: 'node' });
    assert.equal(chapter(), 'III');
    namesMap.locale = 'greek';
    assert.equal(chapter(), 'γʹ', 'the same formatter, the reader having moved');
    namesMap.locale = 'hebrew';
    assert.equal(chapter(), 'ג׳');
  });

  it("an edition's own lettered verse label passes through untouched", () => {
    // Sub-verses and lettered addresses (W-30) are the edition's own names,
    // not numbers we may convert. "30b" stays "30b" in any tongue.
    for (const locale of ['latin', 'greek', 'hebrew']) {
      const { f } = formatterFor(locale);
      assert.equal(f({ item: { level: 'verse', name: '30b' }, context: 'node' }), '30b');
    }
  });

  it('Latin is unchanged by the generalization — the old rule still reads', () => {
    assert.equal(toTraditionNumeral(3, 'latin'), toRomanNumeral(3));
    const { f } = formatterFor('latin');
    assert.equal(f({ item: { level: 'chapter', name: '16' }, context: 'node' }), 'XVI');
    assert.equal(f({ item: { level: 'verse', name: '18' }, context: 'node' }), '18');
  });
});

// NAMES AND WORDS SHOUT, ADDRESSES NEVER CHANGE (2026-08-02).
//
// The ring's casing used to be a blanket CSS `text-transform: uppercase`,
// which cannot tell one script from another. The strata ring hit this first
// (Русский → РУССКИЙ) and moved its casing into JS; the focus ring carried
// the same rule and the same bug, and the Bible exposed it the moment it
// spoke Greek — Κεφάλαιον rendered ΚΕΦΆΛΑΙΟΝ, keeping an accent that Greek
// uppercase drops.
describe('casing follows the script, not the habit', () => {
  const fmt = (locale, vocabulary, books) => {
    const namesMap = { books: books || {}, locale, vocabulary };
    return makeLabelFormatter({
      config: volumeConfigs.bible, volume: 'bible', level: 'verse',
      locale, namesMap, options: {}, manifest: {}, meta: {}
    });
  };

  it('Latin-script names and words shout', () => {
    const f = fmt('latin', { chapter: 'Capitulum' }, { GENE: 'Genesis' });
    assert.equal(f({ item: { id: 'GENE', level: 'book', name: 'Genesis' }, context: 'magnifier' }), 'GENESIS');
    assert.equal(f({ item: { level: 'chapter', name: '17' }, context: 'magnifier' }), 'CAPITULUM XVII');
  });

  it('every other script keeps the form its own tradition writes', () => {
    const g = fmt('greek', { chapter: 'Κεφάλαιον' }, { GENE: 'Γένεσις' });
    assert.equal(g({ item: { id: 'GENE', level: 'book', name: 'x' }, context: 'magnifier' }), 'Γένεσις');
    assert.equal(g({ item: { level: 'chapter', name: '17' }, context: 'magnifier' }), 'Κεφάλαιον ιζʹ',
      'not ΚΕΦΆΛΑΙΟΝ — Greek uppercase drops the accent this would keep');

    const h = fmt('hebrew', { chapter: 'פרק' }, { GENE: 'בראשית' });
    assert.equal(h({ item: { level: 'chapter', name: '17' }, context: 'magnifier' }), 'פרק י״ז');

    const r = fmt('russian', { chapter: 'Глава' }, { GENE: 'Бытие' });
    assert.equal(r({ item: { id: 'GENE', level: 'book', name: 'x' }, context: 'magnifier' }), 'Бытие',
      'the case that started this: Русский must not become РУССКИЙ');
  });

  it("an edition's own verse address is never re-cased, in any tongue", () => {
    for (const locale of ['latin', 'greek', 'hebrew', 'russian']) {
      assert.equal(fmt(locale, {}, {})({ item: { level: 'verse', name: '30b' }, context: 'node' }), '30b',
        `${locale}: a sub-verse is data, not a name to shout`);
    }
  });
});
