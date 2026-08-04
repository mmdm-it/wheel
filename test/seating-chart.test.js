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

// ——— E3: the chapters ring follows the edition ———
import { chaptersFromSeats } from '../src/navigation/seating-chart.js';
import { buildBibleChapterChain } from '../src/navigation/cousin-builder.js';

describe('the chapters ring holds the edition\'s own chapters (E3)', () => {
  it('a regrouped book offers its own chapters, not the spine\'s', () => {
    const manifest = makeManifest();
    // The edition folds the spine's two chapters into ONE of its own.
    const chart = { edition: 'X', books: { ALPH: [
      { c: '1', s: [
        { l: '1', u: ['1', 1, 1] }, { l: '2', u: ['1', 2, 2] },
        { l: '3', u: ['2', 1, 1] }, { l: '4', u: ['2', 2, 2] }
      ] }
    ] } };
    const seats = expandChart(manifest.Gutenberg_Bible, chart);
    const chapters = chaptersFromSeats(seats);
    assert.equal(chapters.length, 1, 'one chapter, because the edition has one');
    assert.equal(chapters[0].name, '1');
  });

  it('a chapter label that collides with a spine number does NOT merge two chapters', () => {
    // The bug this test exists for: identity chapters key by the spine's
    // number and explicit ones by the edition's label — two namespaces
    // sharing a spelling. Greek Sirach's chapter 30 collided with the spine's
    // chapter 30 and the verse ring silently served them as ONE 44-seat
    // chapter. Silent merging is the display lie this whole model exists to
    // make impossible.
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { ALPH: [
      5,                                              // identity → key ALPH:1
      { c: '1', s: [{ l: '9', u: ['2', 1, 1] }] }     // label '1' → would collide
    ] } };
    const seats = expandChart(manifest.Gutenberg_Bible, chart);
    const keys = [...new Set(seats.map(s => s.chapterKey))];
    assert.equal(keys.length, 2, 'two chapters stay two chapters');
    const chapters = chaptersFromSeats(seats);
    assert.equal(chapters.length, 2);
    assert.equal(new Set(chapters.map(c => c.id)).size, 2, 'and their ids are distinct');
    assert.deepEqual(chapters.map(c => c.name), ['1', '1'],
      'while both still DISPLAY the label their edition gives them');
  });

  it('the display label never wears the disambiguator', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { ALPH: [5, { c: '1', s: [{ l: '9', u: ['2', 1, 1] }] }] } };
    const chapters = chaptersFromSeats(expandChart(manifest.Gutenberg_Bible, chart));
    assert.ok(chapters.every(c => !/#/.test(c.name)), 'a reader must never see a key');
  });

  it('with no chart the chapters ring walks the spine, exactly as before', () => {
    const spine = buildBibleChapterChain(fixtureManifest, {}).items.filter(Boolean);
    assert.ok(spine.length > 0);
    assert.ok(spine.every(c => c.level === 'chapter'));
  });

  it('the two rings cannot disagree — one is derived from the other', () => {
    const manifest = makeManifest();
    const chart = { edition: 'X', books: { ALPH: [5, 3], BETH: [2, 3] } };
    const seats = buildBibleVerseChain(manifest, { chart }).items;
    const chapters = buildBibleChapterChain(manifest, { seats }).items.filter(Boolean);
    const seatKeys = [...new Set(seats.filter(Boolean).map(s => s.chapterKey))];
    assert.equal(chapters.length, seatKeys.length);
    assert.deepEqual(chapters.map(c => c.id), seats.filter(Boolean)
      .map(s => s.meta.chapterId).filter((v, i, a) => a.indexOf(v) === i));
  });
});

// ——— E2: the reader is carried by their utterance ———
describe('an edition change carries the reader by their utterance (E2)', () => {
  // Two artifacts over one spine. X seats the spine 1:1. Y welds spine
  // utterances 2+3 into a single verse of its own, so everything after
  // slides by one — the Genesis 50 shape.
  const CHART_X = { edition: 'X', books: { ALPH: [5, 3] } };
  const CHART_Y = { edition: 'Y', books: { ALPH: [
    { s: [
      { l: '1', u: ['1', 1, 1] },
      { l: '2', u: ['1', 2, 3] },
      { l: '3', u: ['1', 4, 4] },
      { l: '4', u: ['1', 5, 5] }
    ] },
    3
  ] } };

  const seatsOf = chart => expandChart(makeManifest().Gutenberg_Bible, chart);

  it('the SAME WORDS are found under a different number', () => {
    const x = seatsOf(CHART_X);
    const y = seatsOf(CHART_Y);
    // Reading X's verse 4 — spine utterance 4.
    const reading = x.find(i => i.name === '4' && i.chapterKey === 'ALPH:1');
    assert.deepEqual(reading.meta.span, [['1', 4, 4]]);
    const [spineKey, ordinal] = reading.meta.span[0];
    const landed = y[seatIndexForUtterance(y, 'ALPH', spineKey, ordinal)];
    assert.equal(landed.name, '3', "Y calls those words its verse 3, and that is where the reader goes");
    assert.notEqual(landed.name, reading.name, 'the number did NOT travel — the words did');
  });

  it('a fused seat receives BOTH utterances, whole', () => {
    const y = seatsOf(CHART_Y);
    const a = seatIndexForUtterance(y, 'ALPH', '1', 2);
    const b = seatIndexForUtterance(y, 'ALPH', '1', 3);
    assert.equal(a, b, 'two utterances, one seat');
    assert.deepEqual(y[a].meta.span, [['1', 2, 3]]);
    assert.equal(y[a].name, '2', 'and it is shown whole, never split');
  });

  it('where the editions agree the seat is identical — nothing to perform', () => {
    const x = seatsOf(CHART_X);
    const y = seatsOf(CHART_Y);
    const reading = x.find(i => i.name === '1' && i.chapterKey === 'ALPH:1');
    const landed = y[seatIndexForUtterance(y, 'ALPH', ...reading.meta.span[0].slice(0, 2))];
    assert.equal(landed.name, reading.name, 'same number, same words: invisible at rest');
  });

  it('an utterance the new artifact lacks has no seat, and the reader stays put', () => {
    // Y2 asserts spine utterance 3 absent: it simply has no seat for it.
    const y2 = seatsOf({ edition: 'Y2', books: { ALPH: [
      { s: [{ l: '1', u: ['1', 1, 1] }, { l: '2', u: ['1', 2, 2] }, { l: '4', u: ['1', 4, 4] }] }, 3
    ] } });
    assert.equal(seatIndexForUtterance(y2, 'ALPH', '1', 3), -1,
      'no seat means no landing — the caller must leave the reader where they are');
  });

  it('the landing is deterministic: spine to seat is single-valued', () => {
    const y = seatsOf(CHART_Y);
    for (let ordinal = 1; ordinal <= 5; ordinal += 1) {
      const hits = y.filter(i => i.bookKey === 'ALPH'
        && i.meta.span.some(([c, f, l]) => c === '1' && ordinal >= f && ordinal <= l));
      assert.ok(hits.length <= 1, `utterance ${ordinal} is claimed by at most one seat`);
    }
  });
});

// ——— The sky under the ring is seated by the same chart ———
describe('the child pyramid holds the same seats as the ring', () => {
  const haveCorpus = existsSync(new URL('../data/gutenberg/seating/LXX.json', import.meta.url));
  it('offers no verse the edition lacks, and every id it offers can be landed on', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    const { bibleAdapter } = await import('../src/adapters/bible-adapter.js');
    await ensureSeatingChart('LXX');
    const realManifest = JSON.parse(readFileSync(new URL('../data/gutenberg/manifest.json', import.meta.url), 'utf-8'));
    const h = bibleAdapter.createHandlers({
      manifest: realManifest, namesMap: { locale: 'greek' },
      options: { activeEdition: 'LXX', level: 'verse' }
    });
    h.layoutBindings.setBibleMode('verse');
    const { items: chapters } = h.layoutBindings.getBibleChapterChain(null);

    // The Septuagint genuinely lacks 1 Samuel 17:12-31. The sky must not
    // offer a star that the ring beside it refuses to seat.
    const sam17 = chapters.find(c => c && c.bookKey === 'I_SAM' && c.name === '17');
    const sky = h.layoutBindings.getBibleVerseItems(sam17);
    const names = sky.map(v => v.name);
    assert.ok(names.includes('11') && names.includes('32'));
    assert.ok(!names.includes('13'), 'a verse this edition never had must not be in the sky');

    // And every star lands: the bug was that a tap fell through to index 0,
    // which is Genesis 1:1 — the reader thrown across the whole volume.
    for (const star of sky) {
      const { items, selectedIndex } = h.layoutBindings.getBibleVerseChain(star.id);
      assert.equal(items[selectedIndex]?.id, star.id, `tapping ${star.id} must land on it`);
    }
  });

  it('the Sirach Prologue lands too — its chapter is a NAME, not a number', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    const { bibleAdapter } = await import('../src/adapters/bible-adapter.js');
    await ensureSeatingChart('LXX');
    const realManifest = JSON.parse(readFileSync(new URL('../data/gutenberg/manifest.json', import.meta.url), 'utf-8'));
    const h = bibleAdapter.createHandlers({
      manifest: realManifest, namesMap: { locale: 'greek' },
      options: { activeEdition: 'LXX', level: 'verse' }
    });
    h.layoutBindings.setBibleMode('verse');
    const { items: chapters } = h.layoutBindings.getBibleChapterChain(null);
    // Sirach's FIRST chapter, whatever the chart chose to call it. It was
    // named Πρόλογος when the spine's display identity reached the ring; the
    // regenerated chart labels it "0" (reported to Wilbur, O-25). That is a
    // data question — what this test guards is the ENGINE contract: whatever
    // the chapter is called, its stars must land.
    const prologue = chapters.find(c => c && c.bookKey === 'ECCLU');
    assert.ok(prologue, 'Sirach opens on a chapter');
    const sky = h.layoutBindings.getBibleVerseItems(prologue);
    assert.ok(sky.length > 0);
    // The file keys these by sequence ("ECCLU_0_1"); the chart names the
    // chapter, so ids built from the file could never be found in the chain.
    for (const star of sky) {
      const { items, selectedIndex } = h.layoutBindings.getBibleVerseChain(star.id);
      assert.equal(items[selectedIndex]?.id, star.id);
    }
  });

  it('a miss lands in the requested chapter, never at the start of the volume', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    const { bibleAdapter } = await import('../src/adapters/bible-adapter.js');
    await ensureSeatingChart('LXX');
    const realManifest = JSON.parse(readFileSync(new URL('../data/gutenberg/manifest.json', import.meta.url), 'utf-8'));
    const h = bibleAdapter.createHandlers({
      manifest: realManifest, namesMap: { locale: 'greek' }, options: { activeEdition: 'LXX', level: 'verse' }
    });
    h.layoutBindings.setBibleMode('verse');
    // 17:13 does not exist in this edition. Landing must stay in 1 Samuel 17.
    const { items, selectedIndex } = h.layoutBindings.getBibleVerseChain('I_SAM_17_13');
    const landed = items[selectedIndex];
    assert.ok(landed, 'something is selected');
    assert.equal(landed.bookKey, 'I_SAM', 'not thrown to another book');
    assert.equal(landed.meta.chapterLabel, '17', 'and not to another chapter');
  });
});

// ——— The backdoor: returning from an edition that HAS the verse ———
describe('an edition that lacks the reader\'s verse still re-seats them', () => {
  const haveCorpus = existsSync(new URL('../data/gutenberg/seating/LXX.json', import.meta.url));
  const mk = async activeEdition => {
    const { bibleAdapter } = await import('../src/adapters/bible-adapter.js');
    await ensureSeatingChart('LXX');
    const realManifest = JSON.parse(readFileSync(new URL('../data/gutenberg/manifest.json', import.meta.url), 'utf-8'));
    const options = { activeEdition, level: 'verse' };
    const h = bibleAdapter.createHandlers({ manifest: realManifest, namesMap: { locale: 'greek' }, options });
    h.layoutBindings.setBibleMode('verse');
    return { h, options };
  };

  it('Greek → Latin → 17:12 → Greek does not leave Latin seats in a Greek ring', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    // Howell's exact route from the phone, 2026-08-03.
    const { h, options } = await mk('LXX');
    // In Latin, 1 Samuel 17:12 exists and can be rotated to.
    options.activeEdition = 'VUL';
    const latin = h.layoutBindings.getBibleVerseChain('I_SAM_17_12');
    const standing = latin.items[latin.selectedIndex];
    assert.equal(standing.id, 'I_SAM_17_12', 'the Latin genuinely seats it');

    // Back to Greek, which has never had 17:12-31.
    options.activeEdition = 'LXX';
    let handed = null;
    const app = { setPrimaryItems: (items, idx) => { handed = { items, idx }; } };
    assert.equal(h.reseatOnEditionChange({ selected: standing, app }), true,
      'the switch must be honoured, not refused');

    const seats = handed.items.filter(Boolean).filter(i => i.chapterKey === standing.chapterKey);
    const names = seats.map(s => s.name);
    assert.ok(!names.includes('12'), 'no ghost node for a verse this edition lacks');
    assert.ok(!names.includes('31'), 'nor any of the others');
    assert.ok(names.includes('11') && names.includes('32'), 'the honest jump is intact');
    // And they land just BEFORE the gap, so reading forward meets it naturally.
    assert.equal(handed.items[handed.idx].name, '11');
  });

  it('after the re-seat the sky agrees with the ring — no inherited ghosts', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    const { h, options } = await mk('LXX');
    options.activeEdition = 'VUL';
    const latin = h.layoutBindings.getBibleVerseChain('I_SAM_17_20');
    const standing = latin.items[latin.selectedIndex];
    options.activeEdition = 'LXX';
    h.reseatOnEditionChange({ selected: standing, app: { setPrimaryItems: () => {} } });

    const { items: chapters } = h.layoutBindings.getBibleChapterChain(null);
    const sam17 = chapters.find(c => c && c.bookKey === 'I_SAM' && c.name === '17');
    const sky = h.layoutBindings.getBibleVerseItems(sam17).map(v => v.name);
    assert.ok(!sky.includes('20'), 'the pyramid must not inherit the Latin seat either');
    assert.ok(sky.includes('11') && sky.includes('32'));
  });
});

// ——— W-32: a spine chapter that feeds TWO of the edition's own ———
describe('a compressed run names its own source (W-32)', () => {
  // The Latin Psalm 9 is the Hebrew's 9 AND 10. Modelled here: the edition
  // splits spine chapter 1 into its own chapters 1 and 2, so its chapter 3
  // is the spine's chapter 2 — and from the split on, POSITION means
  // nothing. This is the shape that made seven books of LXX and THEOD wrong.
  const SPLIT = { edition: 'X', books: { ALPH: [
    { c: '1', u: ['1', 1, 3] },
    { c: '2', u: ['1', 4, 5] },
    { c: '3', u: ['2', 1, 3] }
  ] } };

  it('one spine chapter deals seats to two of the edition\'s chapters', () => {
    const items = expandChart(makeManifest().Gutenberg_Bible, SPLIT);
    const chapters = [...new Set(items.map(i => i.meta.chapterLabel))];
    assert.deepEqual(chapters, ['1', '2', '3'], 'the edition has THREE chapters over the spine\'s two');
    const byLabel = l => items.filter(i => i.meta.chapterLabel === l);
    assert.deepEqual(byLabel('1').map(i => i.name), ['1', '2', '3']);
    assert.deepEqual(byLabel('2').map(i => i.name), ['1', '2'], 'labelled from 1 in its own chapter');
    assert.deepEqual(byLabel('3').map(i => i.name), ['1', '2', '3']);
  });

  it('the run seats point at the right utterances — the off-by-one that broke it', () => {
    const items = expandChart(makeManifest().Gutenberg_Bible, SPLIT);
    // The edition's 2:1 is the spine's 1:4, NOT the spine's 2:1.
    const seat = items.find(i => i.meta.chapterLabel === '2' && i.name === '1');
    assert.deepEqual(seat.meta.span, [['1', 4, 4]]);
    // And its chapter 3 really is the spine's chapter 2.
    const third = items.find(i => i.meta.chapterLabel === '3' && i.name === '1');
    assert.deepEqual(third.meta.span, [['2', 1, 1]]);
    // Every utterance still lands somewhere, exactly once.
    for (let o = 1; o <= 5; o += 1) {
      assert.ok(seatIndexForUtterance(items, 'ALPH', '1', o) >= 0, `spine 1:${o} is seated`);
    }
  });

  it('a run must be ONE contiguous stretch — a fold is a seat list, not a run', () => {
    const items = expandChart(makeManifest().Gutenberg_Bible, { edition: 'X', books: { ALPH: [
      { c: '1', u: [['1', 1, 1], ['1', 3, 3]] },   // scattered: refused as a run
      3
    ] } });
    assert.ok(items === null || items.every(i => i.meta.chapterLabel !== '1'),
      'a scattered run is refused rather than silently mis-seated');
  });

  it('runs and seat lists agree — the same chapter, written either way', () => {
    const root = makeManifest().Gutenberg_Bible;
    const asRun = expandChart(root, { edition: 'X', books: { ALPH: [{ c: '1', u: ['1', 2, 4] }] } });
    const asSeats = expandChart(root, { edition: 'X', books: { ALPH: [{ c: '1', s: [
      { l: '1', u: ['1', 2, 2] }, { l: '2', u: ['1', 3, 3] }, { l: '3', u: ['1', 4, 4] }
    ] }] } });
    assert.deepEqual(asRun.map(i => [i.name, i.meta.span]), asSeats.map(i => [i.name, i.meta.span]),
      'the compression is only a spelling — it must expand to the identical seats');
  });
});

// ——— A chapter that declines to relabel keeps its SOURCE's name ———
describe('an explicit chapter without `c` resolves through its span', () => {
  it('inherits the display identity of the spine chapter it draws from', () => {
    // The Sirach Prologue's spine chapter is named Πρόλογος, not "0". Under
    // the all-explicit rule position identifies nothing, so a chapter that
    // omits `c` must take its name from the source its seats name — which is
    // how an edition keeps a NAMED chapter without restating the name.
    const root = makeManifest().Gutenberg_Bible;
    const items = expandChart(root, { edition: 'X', books: { BETH: [
      { u: ['0', 1, 2] },   // no `c` — the spine's chapter 0, "Prologus"
      { c: '1', u: ['1', 1, 3] }
    ] } });
    const named = items.filter(i => i.meta.chapterLabel === 'Prologus');
    assert.equal(named.length, 2, 'the prologue keeps its name and its seats');
    assert.equal(named[0].id, 'BETH_Prologus_1');
    assert.deepEqual(named.map(i => i.meta.span), [[['0', 1, 1]], [['0', 2, 2]]]);
  });

  it('does not fall back to whatever sits at the same POSITION', () => {
    // The trap the run form exists to close: an entry's position must not
    // decide what it is. Here entry 0 draws from the spine's SECOND chapter.
    const root = makeManifest().Gutenberg_Bible;
    const items = expandChart(root, { edition: 'X', books: { ALPH: [{ u: ['2', 1, 3] }] } });
    assert.equal(items.length, 3);
    assert.equal(items[0].meta.chapterLabel, '2', 'named by its source, not by position 0');
    assert.deepEqual(items[0].meta.span, [['2', 1, 1]]);
  });
});

// ——— The text belongs to the utterance, not to the label ———
describe('verse text is fetched by the seat\'s span (Howell, from the phone)', () => {
  const haveCorpus = existsSync(new URL('../data/gutenberg/seating/WLC.json', import.meta.url));
  it('a seat whose label has no matching spine slot still finds its words', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    const { slotKeyForOrdinal } = await import('../src/adapters/volume-helpers.js');
    const chapter = JSON.parse(readFileSync(new URL('../data/gutenberg/chapters/I_PARA/011.json', import.meta.url), 'utf-8'));
    // Hebrew 1 Chronicles 11:47 IS the spine's slot "46b" — there is no "47".
    assert.equal(chapter.verses['47'], undefined, 'the label the reader sees does not exist as a slot');
    assert.equal(slotKeyForOrdinal(chapter.verses, 47), '46b', 'the ordinal finds it');
    assert.ok(chapter.verses['46b'].text.WLC, 'and there are words there');
  });

  it('THE SILENT ONE: a label that DOES match a slot must not win over the span', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    const { slotKeyForOrdinal } = await import('../src/adapters/volume-helpers.js');
    const psalm = JSON.parse(readFileSync(new URL('../data/gutenberg/chapters/PSAL/043.json', import.meta.url), 'utf-8'));
    // Hebrew Psalm 44:24 is the spine's slot "23". Looking up the LABEL "24"
    // finds a real verse — the WRONG one. A blank is visible; this is not.
    const byLabel = psalm.verses['24']?.text?.WLC;
    const byOrdinal = psalm.verses[slotKeyForOrdinal(psalm.verses, 24)]?.text?.WLC;
    assert.ok(byLabel && byOrdinal, 'both resolve to real Hebrew');
    assert.notEqual(byLabel, byOrdinal, 'and they are DIFFERENT verses — this is the bug');
    assert.equal(slotKeyForOrdinal(psalm.verses, 24), '23');
  });

  it('the two agree wherever an edition counts as the spine does', async () => {
    const { slotKeyForOrdinal } = await import('../src/adapters/volume-helpers.js');
    const plain = { 1: {}, 2: {}, 3: {} };
    assert.equal(slotKeyForOrdinal(plain, 2), '2', 'no sub-slots, no divergence');
  });

  it('sorts sub-slots after the integer they hang off, stacked ones lexical', async () => {
    const { slotKeyForOrdinal } = await import('../src/adapters/volume-helpers.js');
    // The order the contract fixes — and the order the FILE does not carry.
    const messy = { 19: {}, 20: {}, '19d': {}, '19b': {}, '19c': {} };
    assert.deepEqual(
      [1, 2, 3, 4, 5].map(o => slotKeyForOrdinal(messy, o)),
      ['19', '19b', '19c', '19d', '20']
    );
  });
});

// ——— An uncharted edition keeps its label ———
describe('the identity fallback trusts the LABEL, not its synthetic span', () => {
  const haveCorpus = existsSync(new URL('../data/gutenberg/chapters/PSAL/043.json', import.meta.url));

  it('marks its seats synthetic, because verse_count cannot locate a sub-slot', () => {
    const root = makeManifest().Gutenberg_Bible;
    const identity = identityChartFromManifest(root);
    assert.equal(identity.identity, true);
    assert.ok(expandChart(root, identity).every(i => i.meta.synthetic === true));
    // A real chart is not synthetic and its spans ARE the truth.
    const real = expandChart(root, { edition: 'X', books: { ALPH: [{ c: '1', u: ['1', 1, 3] }] } });
    assert.ok(real.every(i => i.meta.synthetic === false));
  });

  it('REGRESSION: an uncharted English psalm must not walk one verse back', { skip: haveCorpus ? false : 'corpus not present (W-10)' }, async () => {
    // I introduced this fixing the blank at 1 Chronicles 11:47, and Howell
    // caught it within the hour: English Psalm 43 has no chart, so its spans
    // come from verse_count — which cannot know that "22b" sits between 22
    // and 23. Following those spans showed verse 23 empty and verses 24-27
    // each bearing the previous verse's words. The label is the only truth an
    // uncharted edition has.
    const { getVerseTextResolved, slotKeyForOrdinal } = await import('../src/adapters/volume-helpers.js');
    const psalm = JSON.parse(readFileSync(new URL('../data/gutenberg/chapters/PSAL/043.json', import.meta.url), 'utf-8'));
    assert.equal(slotKeyForOrdinal(psalm.verses, 23), '22b', 'the synthetic span points here');
    assert.ok(!psalm.verses['22b'].text.DRA, 'which the English does not have — hence the blank');
    assert.ok(psalm.verses['23'].text.DRA, 'while the label points at real English');
    assert.notEqual(psalm.verses['23'].text.DRA, psalm.verses['24'].text.DRA,
      'and 23 and 24 are different verses, which is what made the slip silent');
  });
});
