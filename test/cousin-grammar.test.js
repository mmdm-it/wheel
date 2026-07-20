import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { weaveCousinChain, buildCalendarMonthsCousinChain, buildCalendarDaysCousinChain, COUSIN_GAP_LINKS } from '../src/adapters/volume-helpers.js';
import { buildBibleVerseChain, buildBibleChapterChain, buildBibleBookCousinChain } from '../src/navigation/cousin-builder.js';
import { calculateNodePositions, getViewportInfo, getNodeSpacing, getViewportWindow, getBaseAngleForOrder } from '../src/geometry/focus-ring-geometry.js';

// The cousin-gap grammar (Howell, 2026-07-17): whatever level rides the
// ring, ancestor boundaries above it gap by rank — 2/4/6/8 empty links for
// 1st..4th cousins, highest crossed rank wins.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../data/calendar/manifest.json'), 'utf-8'));

describe('cousin gap grammar', () => {
  it('ladder is 2/4/6/8', () => {
    assert.deepEqual(COUSIN_GAP_LINKS, [2, 4, 6, 8]);
  });

  it('highest crossed rank wins the gap', () => {
    const items = weaveCousinChain(
      [{ id: 'a', g1: 1, g2: 1 }, { id: 'b', g1: 2, g2: 1 }, { id: 'c', g1: 3, g2: 2 }],
      [item => item.g1, item => item.g2]
    );
    // a [2 gaps: rank1] b [4 gaps: rank2 crossing wins] c
    assert.deepEqual(items.map(i => (i ? i.id : '·')).join(''), 'a··b····c');
  });

  it('orders equal indices, gaps included (fast-path contract)', () => {
    const items = weaveCousinChain(
      [{ id: 'a', g: 1 }, { id: 'b', g: 2 }],
      [item => item.g]
    );
    items.forEach((item, idx) => { if (item) assert.equal(item.order, idx); });
  });
});

describe('months cousin chain', () => {
  const { items } = buildCalendarMonthsCousinChain(manifest, { initialItemId: '1969:jan' });

  const gapRunBefore = id => {
    const idx = items.findIndex(item => item && item.id === id);
    let run = 0;
    for (let i = idx - 1; i >= 0 && items[i] === null; i -= 1) run += 1;
    return run;
  };

  it('holds every month of every year on one chain', () => {
    assert.equal(items.filter(Boolean).length, 72000);
  });

  it('gaps by cousin rank: year 2, century 4, millennium 6', () => {
    assert.equal(gapRunBefore('1969:jan'), 2, 'Dec 1968 → Jan 1969 = cousins');
    assert.equal(gapRunBefore('1969:feb'), 0, 'no gap inside a year');
    assert.equal(gapRunBefore('1901:jan'), 4, 'century crossing = second cousins');
    assert.equal(gapRunBefore('2001:jan'), 6, 'millennium crossing = third cousins');
    assert.equal(gapRunBefore('1:jan'), 6, 'the BC/AD line is a millennium crossing');
  });

  it('lands the requested month', () => {
    const { items: chain, selectedIndex } = buildCalendarMonthsCousinChain(manifest, { initialItemId: '1969:jul' });
    assert.equal(chain[selectedIndex]?.id, '1969:jul');
  });
});

describe('day cousin chain (thumb doctrine)', () => {
  const { items, selectedIndex } = buildCalendarDaysCousinChain(manifest, { centerId: 'd:2026:7:19' });
  const days = items.filter(Boolean);

  it('lands the tapped day at the exact center of a ±5-year window', () => {
    assert.equal(items[selectedIndex]?.id, 'd:2026:7:19');
    assert.equal(days[0].id, 'd:2021:7:19', 'five years back');
    assert.equal(days[days.length - 1].id, 'd:2031:7:19', 'five years forward');
    assert.equal(days.length, 3653, 'every day in the window, leap days included');
  });

  it('gaps months at rank 1 and years at rank 2', () => {
    const gapRunBefore = id => {
      const idx = items.findIndex(item => item && item.id === id);
      let run = 0;
      for (let i = idx - 1; i >= 0 && items[i] === null; i -= 1) run += 1;
      return run;
    };
    assert.equal(gapRunBefore('d:2026:7:2'), 0, 'no gap inside a month');
    assert.equal(gapRunBefore('d:2026:8:1'), 2, 'month crossing = first cousins');
    assert.equal(gapRunBefore('d:2027:1:1'), 4, 'year crossing = second cousins');
  });

  it('carries the fields the ring and parent button need', () => {
    const center = items[selectedIndex];
    assert.equal(center.name, '19');
    assert.equal(center.level, 'day');
    assert.equal(center.monthName, 'July');
    assert.deepEqual(
      [center.yearNumber, center.monthNumber, center.dayNumber],
      [2026, 7, 19]
    );
  });

  it('clamps the window at the calendar horizon', () => {
    const { items: edge } = buildCalendarDaysCousinChain(manifest, { centerId: 'd:2999:6:15' });
    const edgeDays = edge.filter(Boolean);
    assert.equal(edgeDays[edgeDays.length - 1].id, 'd:3000:12:31', 'no days past the horizon');
  });

  it('carries the day ring across Gregory\'s seam without a phantom link', () => {
    const { items: reform, selectedIndex: idx } = buildCalendarDaysCousinChain(manifest, { centerId: 'd:1582:10:4' });
    const real = reform.filter(Boolean);
    assert.equal(reform[idx]?.id, 'd:1582:10:4', 'the last Julian day magnified');
    // The chain is elapsed days, so 4 and 15 October are neighbors in it —
    // separated only by the gap links their shared month does not create.
    const at = id => reform.findIndex(item => item && item.id === id);
    assert.equal(at('d:1582:10:15') - at('d:1582:10:4'), 1, 'adjacent links, as they were adjacent days');
    assert.ok(!real.some(d => d.yearNumber === 1582 && d.monthNumber === 10
      && d.dayNumber >= 5 && d.dayNumber <= 14), 'no ghost day ever enters the ring');
  });

  it('magnifies the resumption day when handed a date that never happened', () => {
    const { items, selectedIndex } = buildCalendarDaysCousinChain(manifest, { centerId: 'd:1582:10:7' });
    assert.equal(items[selectedIndex]?.id, 'd:1582:10:15',
      'a ghost id lands on the day the reckoning resumed, not on link zero');
  });

  it('refuses ids that are not dates (weekday headers stay inert)', () => {
    const { items: none } = buildCalendarDaysCousinChain(manifest, { centerId: 'wd:3' });
    assert.equal(none.length, 0);
  });
});

describe('the continuous verse chain', () => {
  // Howell 2026-07-20: "the Bible should have cousin gaps and second
  // cousin gaps just like the calendar." Before this, the verse ring held
  // ONE chapter — reaching the end of Genesis 1 meant backing out to the
  // chapters ring to enter Genesis 2.
  const bibleManifest = JSON.parse(readFileSync(
    path.resolve(__dirname, '../data/gutenberg/manifest.json'), 'utf-8'));
  const { items } = buildBibleVerseChain(bibleManifest, {});
  const at = id => items.findIndex(x => x && x.id === id);
  const gapBefore = id => {
    let run = 0;
    for (let i = at(id) - 1; i >= 0 && items[i] === null; i -= 1) run += 1;
    return run;
  };

  it('runs unbroken from the first verse to the last', () => {
    const verses = items.filter(Boolean);
    assert.equal(verses[0].id, 'GENE_1_1', 'it begins at the beginning');
    assert.equal(verses[verses.length - 1].id, 'APOC_22_21', 'and ends at the end');
    assert.ok(verses.length > 30000, `the whole volume rides the ring (${verses.length})`);
  });

  it('wears the cousin ladder at every kind of boundary', () => {
    assert.equal(gapBefore('GENE_1_2'), 0, 'no gap inside a chapter');
    assert.equal(gapBefore('GENE_2_1'), 2, 'a chapter crossing is a cousin gap');
    assert.equal(gapBefore('EXO_1_1'), 4, 'a book crossing is a second cousin');
    assert.equal(gapBefore('MATHE_1_1'), 6, 'a testament crossing is a third cousin');
  });

  it('reads on past the end of a chapter — the whole point', () => {
    // The reader finishing Genesis 1:31 must find Genesis 2:1 ahead of
    // them in the chain, with only empty links between.
    const from = at('GENE_1_31');
    const next = items.slice(from + 1).find(Boolean);
    assert.equal(next.id, 'GENE_2_1', 'the next verse is simply next');
    assert.equal(at('GENE_2_1') - from, 3, 'two empty links, then the new chapter');
  });

  it('names verses exactly as a loaded chapter does', () => {
    // The descent taps a verse rendered from its chapter file and must
    // find that same id seated in this chain.
    const v = items[at('IOHA_3_16')];
    assert.ok(v, 'a famous verse is present');
    // Chapters are Roman, verses Arabic and BARE (Howell 2026-07-20) —
    // the parent button carries book and chapter, live, so the ring says
    // only which verse.
    assert.equal(v.name, '16');
    assert.equal(v.level, 'verse');
    assert.equal(v.meta.verseKey, '16');
    assert.ok(v.meta.externalFile.endsWith('IOHA/003.json'), 'and knows where its words live');
  });

  it('carries enough context to ascend from wherever reading led', () => {
    const v = items[at('EXO_3_4')];
    assert.equal(v.meta.bookEntryId, 'EXO');
    assert.equal(v.meta.chapterId, 'EXO:3');
    assert.equal(v.meta.testamentId, 'Vetus_Testamentum');
  });
});

describe('the sweep works at every level, not just verses', () => {
  // Howell 2026-07-20: a double-flick already ran Genesis I,1 to
  // Apocalypse XXII,21 in the VERSE ring — "the same complete sweep needs
  // to work with chapters and books". Before this, books stopped at the
  // end of their testament (and carried no gaps at all despite the
  // builder's name) and chapters covered a single book.
  const bibleManifest = JSON.parse(readFileSync(
    path.resolve(__dirname, '../data/gutenberg/manifest.json'), 'utf-8'));
  const gapBefore = (items, id) => {
    const i = items.findIndex(x => x && x.id === id);
    let run = 0;
    for (let j = i - 1; j >= 0 && items[j] === null; j -= 1) run += 1;
    return run;
  };

  it('the BOOKS ring runs the whole volume, gapping at the testament', () => {
    const { items } = buildBibleBookCousinChain(bibleManifest, {});
    const books = items.filter(Boolean);
    assert.equal(books.length, 67, 'every book rides the ring');
    assert.equal(books[0].id, 'GENE');
    assert.equal(books[books.length - 1].id, 'APOC', 'the sweep reaches the end');
    assert.equal(gapBefore(items, 'EXO'), 0, 'no gap between books of one testament');
    assert.equal(gapBefore(items, 'MATHE'), 2, 'the testament crossing is a cousin gap');
  });

  it('the CHAPTERS ring runs the whole volume, book then testament', () => {
    const { items } = buildBibleChapterChain(bibleManifest, {});
    const chapters = items.filter(Boolean);
    assert.equal(chapters.length, 1215);
    assert.equal(chapters[0].id, 'GENE:1');
    assert.equal(chapters[chapters.length - 1].id, 'APOC:22');
    assert.equal(gapBefore(items, 'GENE:2'), 0, 'no gap inside a book');
    assert.equal(gapBefore(items, 'EXO:1'), 2, 'a book crossing is a cousin gap');
    assert.equal(gapBefore(items, 'MATHE:1'), 4, 'a testament crossing is a second cousin');
  });

  it('each level gaps one rank shallower than the level below it', () => {
    // The grammar the timeline established: the gap rank is how far above
    // the ring the boundary sits. Verses see chapter/book/testament as
    // 2/4/6; chapters see book/testament as 2/4; books see testament as 2.
    const verses = buildBibleVerseChain(bibleManifest, {}).items;
    const chapters = buildBibleChapterChain(bibleManifest, {}).items;
    const books = buildBibleBookCousinChain(bibleManifest, {}).items;
    assert.equal(gapBefore(verses, 'MATHE_1_1'), 6);
    assert.equal(gapBefore(chapters, 'MATHE:1'), 4);
    assert.equal(gapBefore(books, 'MATHE'), 2);
  });

  it('chapters in the ring keep their Roman numerals', () => {
    const { items } = buildBibleChapterChain(bibleManifest, {});
    const byId = id => items.find(x => x && x.id === id);
    assert.equal(byId('GENE:1').name, 'I');
    assert.equal(byId('APOC:22').name, 'XXII');
    assert.equal(byId('MATHE:1').meta.testamentId, 'Novum_Testamentum', 'and know where they sit');
  });
});

describe('long-chain render fast path', () => {
  it('windowed scan matches a naive full sweep on the months chain', () => {
    const { items } = buildCalendarMonthsCousinChain(manifest, {});
    const vp = getViewportInfo(412, 915); // Moto G viewport
    const spacing = getNodeSpacing(vp);
    const windowInfo = getViewportWindow(vp, spacing);

    // Naive reference: the same window filter, walked over the whole chain.
    const naiveVisible = rotation => {
      const out = [];
      items.forEach((item, index) => {
        if (item === null) return;
        const order = Number.isFinite(item.order) ? item.order : index;
        const angle = getBaseAngleForOrder(order, vp, spacing) + rotation;
        if (angle >= windowInfo.startAngle && angle <= windowInfo.endAngle) out.push(index);
      });
      return out;
    };

    // Chain start, deep middle, and chain end (positive rotation advances
    // the chain past the magnifier).
    [0, 40000 * spacing, (items.length - 5) * spacing].forEach(rotation => {
      const fast = calculateNodePositions(items, vp, rotation, 10, spacing);
      assert.deepEqual(fast.map(n => n.index), naiveVisible(rotation), `rotation ${rotation}`);
      fast.forEach(node => assert.equal(items[node.index], node.item));
    });
  });
});
