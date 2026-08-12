import { weaveCousinChain } from '../adapters/volume-helpers.js';
import { chaptersFromSeats } from './seating-chart.js';
import { expandVolumeSeats } from '../adapters/bible-volume.js';

const GAP = null;

const bySortNumber = (a, b) => {
  const as = Number.isFinite(a[1]?.sort_number) ? a[1].sort_number : parseInt(a[0], 10) || 0;
  const bs = Number.isFinite(b[1]?.sort_number) ? b[1].sort_number : parseInt(b[0], 10) || 0;
  return as - bs;
};

// Books hang from testaments with nothing between (H-14): the section was
// never a level a reader could stand on, and it is gone from the enumeration.
function findBibleBook(manifest, bookId) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible) return null;
  for (const [testamentId, testament] of Object.entries(bible.testaments || {})) {
    const book = (testament?.books || {})[bookId];
    if (book) return { book, testamentId };
  }
  return null;
}

/**
 * THE CONTINUOUS VERSE CHAIN — every verse in the volume, in order, woven
 * with cousin gaps (Howell 2026-07-20: "the Bible should have cousin gaps
 * and second cousin gaps just like the calendar"). The reader finishes a
 * chapter and keeps reading; they no longer have to back out to the
 * chapters ring to cross a boundary.
 *
 * GAP LADDER, by the established grammar: a chapter crossing is a COUSIN
 * gap, a book crossing a SECOND cousin, a testament crossing a THIRD —
 * 2 / 4 / 6 empty links, the same ranks the timeline uses for month,
 * year and century.
 *
 * Built without fetching a single chapter. Verse TEXT is not here and is
 * not wanted here: it arrives per chapter, on demand, and the detail
 * sector reads it from the cache.
 *
 * SINCE W-21 the chain's source is the SEATING CHART
 * (docs/SEATING-CHART-CONTRACT.md): membership and labels are the active
 * artifact's own, not the spine's. Pass the artifact's chart and the chain
 * holds exactly its seats — welds, regroupings, absences and all. With no
 * chart (none generated yet, or fetch missed), the identity chart derived
 * from verse_count reproduces the old behaviour EXACTLY (proven by test) —
 * phantom seats included, by design: data first, engine tolerant.
 */
export function buildBibleVerseChain(manifest, { initialVerseId = null, edition = null } = {}) {
  // THE SEATS COME FROM THE VOLUME (H-14). This took a legacy chart and
  // expanded it against a manifest that stored chapters; both are gone, and
  // with them the identity-chart fallback that stood behind them.
  //
  // THAT FALLBACK'S ABSENCE IS THE POINT, not an omission. It manufactured
  // labels from a verse count — which H-2 rules is manufacture — and it was
  // reached whenever a chart was missing, so an edition with no chart quietly
  // got a plausible invented one. Under the wall an edition that does not
  // chart a unit simply does not seat it, and the reader is shown nothing
  // rather than a fiction.
  const volume = manifest?.__wallVolume;
  const sorted = volume ? expandVolumeSeats(volume, edition) : [];
  if (!sorted.length) return { items: [], selectedIndex: 0, preserveOrder: true };

  const items = weaveCousinChain(sorted, [
    item => item.chapterKey,
    item => item.bookKey,
    item => item.testamentKey
  ]);

  let selectedIndex = 0;
  if (initialVerseId) {
    const idx = items.findIndex(item => item && item.id === initialVerseId);
    if (idx >= 0) selectedIndex = idx;
  }
  return { items, selectedIndex, preserveOrder: true };
}

export function buildBibleBookCousinChain(manifest, { testamentId, bookId, initialItemId, names = {} } = {}) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible) return { items: [], selectedIndex: 0, preserveOrder: true };
  const testaments = Object.entries(bible.testaments || {});
  const resolveTestamentId = () => {
    if (bookId) {
      const located = findBibleBook(manifest, bookId);
      if (located?.testamentId) return located.testamentId;
    }
    if (testamentId && (bible.testaments || {})[testamentId]) return testamentId;
    const sorted = [...testaments].sort(bySortNumber);
    return sorted[0]?.[0];
  };

  const activeTestamentId = resolveTestamentId();
  if (!activeTestamentId) return { items: [], selectedIndex: 0, preserveOrder: true };
  const testamentNames = names?.testaments || {};
  const bookNames = names?.books || names || {};

  // EVERY book in the volume, not just one testament's (Howell 2026-07-20:
  // "the same complete sweep needs to work with chapters and books"). A
  // double-flick runs Genesis to Apocalypse at this level too, and the
  // testament crossing is a COUSIN gap — one rank up from the ring, the
  // same grammar the timeline uses for a year over its months.
  //
  // Books stay FLAT across sections: the section is carried as metadata for
  // back-navigation but is not a UI level and earns no gap.
  const sorted = [];
  Object.entries(bible.testaments || {}).sort(bySortNumber).forEach(([testamentKey, testament]) => {
    const testamentName = testamentNames[testamentKey] || null;
    Object.entries(testament?.books || {}).sort(bySortNumber).forEach(([bookKey, book]) => {
      sorted.push({
        id: bookKey,
        // A NAME IS A QUOTATION (H-2). The old chain fell back to the book's
        // own `book_name`, then to its id — and under opaque ids that last
        // step would print `bc22df` at the reader. Unnamed is honest; the
        // filesystem's spelling is not a name.
        name: bookNames?.[bookKey] || null,
        sort: Number.isFinite(book?.sort_number) ? book.sort_number : sorted.length,
        level: 'book',
        testamentId: testamentKey,
        parentName: testamentName,
        // Editorial prominence tier (1 featured, 2 notable, absent default):
        // declared in the data, honored by the star field's seating and size.
        prominence: Number.isFinite(book?.prominence) ? book.prominence : undefined
      });
    });
  });

  const chain = weaveCousinChain(sorted, [item => item.testamentId]);

  const selectedIndex = (() => {
    const findId = wanted => chain.findIndex(item => item && item.id === wanted);
    if (initialItemId) {
      const idx = findId(initialItemId);
      if (idx >= 0) return idx;
    }
    if (bookId) {
      const idx = findId(bookId);
      if (idx >= 0) return idx;
    }
    // No book named: open at the first book of the testament asked for.
    const idx = chain.findIndex(item => item && item.testamentId === activeTestamentId);
    if (idx >= 0) return idx;
    const firstReal = chain.findIndex(item => item !== GAP);
    return firstReal >= 0 ? firstReal : 0;
  })();

  return { items: chain, selectedIndex, preserveOrder: true };
}

/**
 * THE CONTINUOUS CHAPTER CHAIN — every chapter in the volume, so the
 * chapters ring sweeps Genesis I to Apocalypse XXII exactly as the verse
 * ring does. Gap ladder, one rank per level above the ring: a BOOK
 * crossing is a cousin gap (2), a TESTAMENT crossing a second cousin (4).
 *
 * Item shape matches getBibleChapters(), so descent, ascent and the
 * chapter prefetch all keep working on ids they already understand.
 */
export function buildBibleChapterChain(manifest, { initialChapterId = null, edition = null, seats = null } = {}) {
  // THE CHAPTERS RING IS COLLAPSED FROM THE SEATS (E3 of W-21), and under the
  // wall that is the ONLY way it is built.
  //
  // It used to have a second path: walk the manifest's stored chapters when
  // no chart had been generated. That path was the whole reason the two rings
  // could disagree — the chapters ring showing what the SPINE holds while the
  // verse ring showed what the EDITION holds — and E3 exists because they
  // did, offering a Greek reader chapters that edition has never had.
  //
  // H-11 removes the choice rather than the bug: chapters are not stored, so
  // there is nothing else to walk. One ring is derived from the other by
  // construction, which is what E3 was reaching for.
  const source = seats
    || (manifest?.__wallVolume ? expandVolumeSeats(manifest.__wallVolume, edition) : null);
  const fromSeats = source ? chaptersFromSeats(source) : null;
  if (!fromSeats) return { items: [], selectedIndex: 0, preserveOrder: true };
  return weaveChapters(fromSeats, initialChapterId);
}

function weaveChapters(sorted, initialChapterId) {
  const items = weaveCousinChain(sorted, [
    item => item.bookKey,
    item => item.testamentKey
  ]);

  let selectedIndex = 0;
  if (initialChapterId) {
    const idx = items.findIndex(item => item && item.id === initialChapterId);
    if (idx >= 0) selectedIndex = idx;
  }
  return { items, selectedIndex, preserveOrder: true };
}
