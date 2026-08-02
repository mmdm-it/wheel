// THE SEATING CHART (E1 of W-21) — docs/SEATING-CHART-CONTRACT.md.
//
// The chart is the generated per-artifact truth about which seats exist.
// These tests hold the module to the contract's hard cases, measured from
// the real corpus in W-30: the Genesis 50 weld, Hebrew Malachi's three
// chapters drawing on the spine's fourth, the non-contiguous many-to-one
// folds, a chapter sequence that opens at 0 (the Sirach Prologue), asserted
// absences as the absence of a seat, and the two-recension convention flag.
//
// And one equivalence proof: the identity chart derived from verse_count,
// expanded and woven, reproduces the legacy chain EXACTLY — same seats,
// same gaps, same ids. The fallback is today's behaviour by construction.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  identityChartFromManifest,
  expandChart,
  seatIndexForUtterance
} from '../src/navigation/seating-chart.js';
import { buildBibleVerseChain } from '../src/navigation/cousin-builder.js';
import { weaveCousinChain } from '../src/adapters/volume-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureManifest = JSON.parse(readFileSync(
  path.join(__dirname, 'fixtures/data/gutenberg/manifest.json'), 'utf-8'
));
const fixtureRoot = fixtureManifest.Gutenberg_Bible;

// A purpose-built manifest exercising the shapes the fixture corpus lacks.
// Spine truth: ALPH has chapters 1 (5 utterances) and 2 (3 utterances);
// BETH opens at chapter 0 (the prologue shape, 2 utterances) then 1 (3).
const makeManifest = () => ({
  Gutenberg_Bible: {
    testaments: {
      T1: {
        name: 'T1', sort_number: 1,
        sections: {
          S1: {
            name: 'S1', sort_number: 1,
            books: {
              ALPH: {
                book_key: 'ALPH', sort_number: 1,
                chapters: {
                  1: { sort_number: 1, name: '1', _external_file: 'chapters/ALPH/001.json', verse_count: 5 },
                  2: { sort_number: 2, name: '2', _external_file: 'chapters/ALPH/002.json', verse_count: 3 }
                }
              },
              BETH: {
                book_key: 'BETH', sort_number: 2,
                chapters: {
                  0: { sort_number: 0, name: 'Prologus', _external_file: 'chapters/BETH/000.json', verse_count: 2 },
                  1: { sort_number: 1, name: '1', _external_file: 'chapters/BETH/001.json', verse_count: 3 }
                }
              }
            }
          }
        }
      }
    }
  }
});

describe('seating chart (E1 of W-21)', () => {
  it('identity chart expands to the legacy chain exactly — the fallback IS today', () => {
    const chart = identityChartFromManifest(fixtureRoot);
    const items = expandChart(fixtureRoot, chart);
    assert.ok(Array.isArray(items) && items.length > 0);
    const woven = weaveCousinChain(items, [
      i => i.chapterKey, i => i.bookKey, i => i.testamentKey
    ]);
    const legacy = buildBibleVerseChain(fixtureManifest).items;
    assert.equal(woven.length, legacy.length);
    for (let i = 0; i < legacy.length; i += 1) {
      if (legacy[i] === null) { assert.equal(woven[i], null, `gap expected at ${i}`); continue; }
      assert.equal(woven[i]?.id, legacy[i].id, `id mismatch at ${i}`);
      assert.equal(woven[i]?.chapterKey, legacy[i].chapterKey);
      assert.equal(woven[i]?.meta?.externalFile, legacy[i].meta.externalFile);
    }
  });

  it('a weld: one seat spans two utterances, later labels slide, membership shrinks', () => {
    const manifest = makeManifest();
    // The edition welds spine 1:2+1:3 into its own verse 2 (the Genesis 50
    // shape): five utterances, four seats, labels 1,2,3,4.
    const chart = { edition: 'X', books: { ALPH: [
      { s: [
        { l: '1', u: ['1', 1, 1] },
        { l: '2', u: ['1', 2, 3] },
        { l: '3', u: ['1', 4, 4] },
        { l: '4', u: ['1', 5, 5] }
      ] },
      3
    ] } };
    const items = expandChart(manifest.Gutenberg_Bible, chart);
    const alph1 = items.filter(i => i.chapterKey === 'ALPH:1');
    assert.deepEqual(alph1.map(i => i.name), ['1', '2', '3', '4']);
    assert.deepEqual(alph1[1].meta.span, [['1', 2, 3]]);
    // The rotation kernel: utterances 2 AND 3 land on the same whole seat.
    assert.equal(seatIndexForUtterance(items, 'ALPH', '1', 2), items.indexOf(alph1[1]));
    assert.equal(seatIndexForUtterance(items, 'ALPH', '1', 3), items.indexOf(alph1[1]));
  });

  it('edition chapter grouping departs from the spine: the Malachi shape', () => {
    const manifest = makeManifest();
    // The edition has ONE chapter where the spine has two: its chapter 1
    // runs eight seats, the last three drawing from spine chapter 2. And no
    // second chapter — membership is the edition's own.
    const chart = { edition: 'X', books: { ALPH: [
      { c: '1', s: [
        { l: '1', u: ['1', 1, 1] }, { l: '2', u: ['1', 2, 2] },
        { l: '3', u: ['1', 3, 3] }, { l: '4', u: ['1', 4, 4] },
        { l: '5', u: ['1', 5, 5] },
        { l: '6', u: ['2', 1, 1] }, { l: '7', u: ['2', 2, 2] },
        { l: '8', u: ['2', 3, 3] }
      ] }
    ] } };
    const items = expandChart(manifest.Gutenberg_Bible, chart);
    const alph = items.filter(i => i.bookKey === 'ALPH');
    assert.equal(alph.length, 8);
    // ONE grouping key — the cousin grammar sees no chapter crossing.
    assert.equal(new Set(alph.map(i => i.chapterKey)).size, 1);
    // The tail seats fetch from the spine's second chapter file.
    assert.equal(alph[5].meta.externalFile, 'chapters/ALPH/002.json');
    assert.deepEqual(alph[7].meta.span, [['2', 3, 3]]);
  });

  it('a non-contiguous fold: one seat, a list of ranges (W-30, eleven cases)', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { ALPH: [
      { s: [
        { l: '1', u: ['1', 1, 1] },
        { l: '2', u: [['1', 2, 2], ['1', 5, 5]] },  // the ECCLU 31:32+31:35 shape
        { l: '3', u: ['1', 3, 3] },
        { l: '4', u: ['1', 4, 4] }
      ] },
      3
    ] } };
    const items = expandChart(manifest.Gutenberg_Bible, chart);
    const folded = items.find(i => i.bookKey === 'ALPH' && i.name === '2');
    assert.deepEqual(folded.meta.span, [['1', 2, 2], ['1', 5, 5]]);
    // Both spine utterances land on the one seat; the ones between do not.
    assert.equal(items[seatIndexForUtterance(items, 'ALPH', '1', 2)].name, '2');
    assert.equal(items[seatIndexForUtterance(items, 'ALPH', '1', 5)].name, '2');
    assert.equal(items[seatIndexForUtterance(items, 'ALPH', '1', 3)].name, '3');
  });

  it('identity is positional against the spine SEQUENCE — a book opening at chapter 0', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { BETH: [2, 3] } };
    const items = expandChart(manifest.Gutenberg_Bible, chart);
    const beth = items.filter(i => i.bookKey === 'BETH');
    assert.equal(beth.length, 5);
    // Position 0 is the spine's FIRST chapter — key "0", wearing its own
    // display identity (the Prologue renders as a name, not a number).
    assert.equal(beth[0].chapterKey, 'BETH:0');
    assert.equal(beth[0].id, 'BETH_Prologus_1');
    assert.equal(beth[2].chapterKey, 'BETH:1');
  });

  it('an asserted absence is the absence of a seat; the labels carry the gap', () => {
    const manifest = makeManifest();
    // The edition's own reckoning runs 1, 2, 4, 5 — verse 3 demonstrably
    // never held (the LXX 1 Samuel 17 shape). No seat, no filler.
    const chart = { edition: 'X', books: { ALPH: [
      { s: [
        { l: '1', u: ['1', 1, 1] }, { l: '2', u: ['1', 2, 2] },
        { l: '4', u: ['1', 4, 4] }, { l: '5', u: ['1', 5, 5] }
      ] },
      3
    ] } };
    const items = expandChart(manifest.Gutenberg_Bible, chart);
    const alph1 = items.filter(i => i.chapterKey === 'ALPH:1');
    assert.deepEqual(alph1.map(i => i.name), ['1', '2', '4', '5']);
    // Nothing spans the absent utterance: the language forecloses there.
    assert.equal(seatIndexForUtterance(items, 'ALPH', '1', 3), -1);
  });

  it('a book absent from the chart is absent from the artifact', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { BETH: [2, 3] } };
    const items = expandChart(manifest.Gutenberg_Bible, chart);
    assert.ok(items.every(i => i.bookKey !== 'ALPH'));
  });

  it('convention: true rides every seat of a two-recension book', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: {
      ALPH: { convention: true, chapters: [5, 3] },
      BETH: [2, 3]
    } };
    const items = expandChart(manifest.Gutenberg_Bible, chart);
    assert.ok(items.filter(i => i.bookKey === 'ALPH').every(i => i.meta.convention === true));
    assert.ok(items.filter(i => i.bookKey === 'BETH').every(i => i.meta.convention === false));
  });

  it('a malformed chart yields null — the caller falls back to identity', () => {
    const manifest = makeManifest();
    assert.equal(expandChart(manifest.Gutenberg_Bible, null), null);
    assert.equal(expandChart(manifest.Gutenberg_Bible, { books: null }), null);
    assert.equal(expandChart(manifest.Gutenberg_Bible, { books: {} }), null);
    // A seat with a garbage span is dropped, not invented.
    const items = expandChart(manifest.Gutenberg_Bible, { books: { ALPH: [
      { s: [{ l: '1', u: ['1', 0, 0] }, { l: '2', u: ['1', 2, 2] }] }, 3
    ] } });
    assert.deepEqual(items.filter(i => i.chapterKey === 'ALPH:1').map(i => i.name), ['2']);
  });
});

// ——— E1 wiring: the chain builder itself now eats the chart ———
import { buildBibleVerseChain as chainWithChart } from '../src/navigation/cousin-builder.js';
import { ensureSeatingChart, getSeatingChart } from '../src/adapters/bible-adapter.js';
import { existsSync } from 'node:fs';

describe('verse chain from the chart (E1 wiring)', () => {
  it('chart membership governs the chain: absences out, welds in, gaps intact', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { ALPH: [
      { s: [
        { l: '1', u: ['1', 1, 1] },
        { l: '2', u: ['1', 2, 3] },   // weld
        { l: '5', u: ['1', 5, 5] }    // 4 asserted absent — no seat
      ] },
      3
    ] } };
    const { items } = chainWithChart(manifest, { chart });
    const seats = items.filter(Boolean).filter(i => i.chapterKey === 'ALPH:1');
    assert.deepEqual(seats.map(i => i.name), ['1', '2', '5']);
    // The chapter crossing is still a cousin gap (2 empty links).
    const lastCh1 = items.findIndex(i => i && i.chapterKey === 'ALPH:1' && i.name === '5');
    assert.equal(items[lastCh1 + 1], null);
    assert.equal(items[lastCh1 + 2], null);
    assert.ok(items[lastCh1 + 3]?.chapterKey === 'ALPH:2');
    // BETH is not in the chart — not in the chain.
    assert.ok(items.filter(Boolean).every(i => i.bookKey !== 'BETH'));
  });

  it('no chart = identity fallback, byte-identical to the legacy chain', () => {
    const { items } = chainWithChart(fixtureManifest, {});
    const viaIdentity = expandChart(fixtureRoot, identityChartFromManifest(fixtureRoot));
    assert.equal(items.filter(Boolean).length, viaIdentity.length);
  });

  it('a malformed chart falls back to identity instead of an empty ring', () => {
    const { items } = chainWithChart(fixtureManifest, { chart: { books: {} } });
    assert.ok(items.filter(Boolean).length > 0);
  });

  it('initialVerseId still locates the boot seat under a chart', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { ALPH: [5, 3], BETH: [2, 3] } };
    const { items, selectedIndex } = chainWithChart(manifest, { initialVerseId: 'ALPH_2_2', chart });
    assert.equal(items[selectedIndex]?.id, 'ALPH_2_2');
  });
});

describe('seating-chart loader', () => {
  it('no edition, no chart; unknown edition caches the miss as null', async () => {
    assert.equal(await ensureSeatingChart(null), null);
    assert.equal(await ensureSeatingChart('NOT_AN_EDITION'), null);
    assert.equal(getSeatingChart('NOT_AN_EDITION'), null);
  });

  // The real charts live with the corpus (cargo, W-10) — exercised on
  // benches that hold a checkout, skipped where there is none (CI).
  const chartOnDisk = existsSync(new URL('../data/gutenberg/seating/LXX.json', import.meta.url));
  it('the real LXX chart loads, matches its edition, and expands', { skip: chartOnDisk ? false : 'corpus not present (W-10)' }, async () => {
    const chart = await ensureSeatingChart('LXX');
    assert.equal(chart?.edition, 'LXX');
    assert.equal(getSeatingChart('LXX'), chart);
    const realManifest = JSON.parse(readFileSync(new URL('../data/gutenberg/manifest.json', import.meta.url), 'utf-8'));
    const items = expandChart(realManifest.Gutenberg_Bible, chart);
    assert.ok(items.length > 20000, `LXX expanded to ${items.length} seats`);
  });
});

// The defect this test exists for: the verse branch read the volume's PINNED
// DEFAULT (`options.translation`, VUL) instead of the reader's committed
// edition, so a Greek reader was seated by a Latin chart — silently, since
// the fallback is a working chain. Found on the bench, before the phone.
describe('the committed edition seats the reader (not the pinned default)', () => {
  const haveCorpus = existsSync(new URL('../data/gutenberg/seating/LXX.json', import.meta.url));
  it('activeEdition drives the chart; the pinned default does not override it', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const realManifest = JSON.parse(readFileSync(new URL('../data/gutenberg/manifest.json', import.meta.url), 'utf-8'));
    const base = { level: 'verse', cousinMode: true, bookId: 'I_SAM', chapterId: '17', verseId: '1' };

    const greek = await volumeConfigs.bible.buildChain(realManifest, { ...base, translation: 'VUL', activeEdition: 'LXX' }, {});
    const greekSeats = greek.items.filter(Boolean).filter(i => i.chapterKey === 'I_SAM:17').map(i => i.name);
    // The Septuagint genuinely lacks 1 Samuel 17:12-31: the labels say so.
    assert.ok(greekSeats.includes('11') && greekSeats.includes('32'));
    assert.ok(!greekSeats.includes('12'), 'Greek chart must not seat an absence');

    const latin = await volumeConfigs.bible.buildChain(realManifest, { ...base, translation: 'VUL' }, {});
    const latinSeats = latin.items.filter(Boolean).filter(i => i.chapterKey === 'I_SAM:17').map(i => i.name);
    assert.ok(latinSeats.includes('12'), 'uncharted edition keeps the identity chain');
  });
});
