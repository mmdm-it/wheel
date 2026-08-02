import { weaveCousinChain, toRomanNumeral } from '../adapters/volume-helpers.js';
import { expandChart, identityChartFromManifest } from './seating-chart.js';

const GAP = null;

const bySortNumber = (a, b) => {
  const as = Number.isFinite(a[1]?.sort_number) ? a[1].sort_number : parseInt(a[0], 10) || 0;
  const bs = Number.isFinite(b[1]?.sort_number) ? b[1].sort_number : parseInt(b[0], 10) || 0;
  return as - bs;
};

function findBibleBook(manifest, bookId) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible) return null;
  const testaments = bible.testaments || {};
  for (const [testamentId, testament] of Object.entries(testaments)) {
    const sections = testament?.sections || {};
    for (const [sectionId, section] of Object.entries(sections)) {
      const books = section?.books || {};
      const book = books[bookId];
      if (book) {
        return { book, testamentId, sectionId };
      }
    }
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
export function buildBibleVerseChain(manifest, { initialVerseId = null, chart = null } = {}) {
  const root = manifest?.Gutenberg_Bible;
  if (!root?.testaments) return { items: [], selectedIndex: 0, preserveOrder: true };

  let sorted = chart ? expandChart(root, chart) : null;
  if (!sorted) sorted = expandChart(root, identityChartFromManifest(root)) || [];

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
    const testamentName = testamentNames[testamentKey] || testament?.name || testamentKey;
    Object.entries(testament?.sections || {}).sort(bySortNumber).forEach(([sectionKey, section]) => {
      Object.entries(section?.books || {}).sort(bySortNumber).forEach(([, book]) => {
        const id = book?.book_key || book?.id || book?.name;
        if (!id) return;
        sorted.push({
          id,
          name: bookNames?.[id] || book?.book_name || book?.name || id,
          sort: Number.isFinite(book?.sort_number) ? book.sort_number : sorted.length,
          level: 'book',
          testamentId: testamentKey,
          sectionId: sectionKey,
          parentName: testamentName,
          // Editorial prominence tier (1 featured, 2 notable, absent default):
          // declared in the data, honored by the star field's seating and size.
          prominence: Number.isFinite(book?.prominence) ? book.prominence : undefined
        });
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
export function buildBibleChapterChain(manifest, { initialChapterId = null, namesMap = null } = {}) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible?.testaments) return { items: [], selectedIndex: 0, preserveOrder: true };

  const sorted = [];
  Object.entries(bible.testaments).sort(bySortNumber).forEach(([testamentKey, testament]) => {
    Object.entries(testament?.sections || {}).sort(bySortNumber).forEach(([sectionKey, section]) => {
      Object.entries(section?.books || {}).sort(bySortNumber).forEach(([bookId, book]) => {
        Object.entries(book?.chapters || {}).sort(bySortNumber).forEach(([chapterKey, chapterVal]) => {
          const chapterNum = Number.parseInt(chapterKey, 10);
          // Chapters are ROMAN (see getBibleChapters — same rule, one source
          // of truth for the numeral form would be better still).
          const label = Number.isFinite(chapterNum)
            ? toRomanNumeral(chapterNum)
            : (namesMap?.sections?.[chapterKey] || chapterKey);
          sorted.push({
            id: chapterVal?.id || `${bookId}:${chapterKey}`,
            name: label,
            level: 'chapter',
            parentId: bookId,
            bookKey: bookId,
            testamentKey: testamentKey,
            meta: {
              bookId,
              chapterKey,
              sectionId: sectionKey,
              testamentId: testamentKey,
              externalFile: chapterVal?._external_file
                || `data/gutenberg/chapters/${bookId}/${String(chapterKey).padStart(3, '0')}.json`
            }
          });
        });
      });
    });
  });

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
