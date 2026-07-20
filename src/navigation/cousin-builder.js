import { weaveCousinChain } from '../adapters/volume-helpers.js';

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

async function fetchChapterData(chapterMeta) {
  const path = chapterMeta?._external_file || chapterMeta?.external_file;
  if (!path) throw new Error('cousin-builder: chapter has no external file');
  const res = await fetch(path.startsWith('.') ? path : `./${path}`);
  if (!res.ok) throw new Error(`cousin-builder: failed to load chapter ${path}`);
  return res.json();
}

function buildVerseItems(chapterData, { bookId, translation, chapterId }) {
  const verses = chapterData?.verses || {};
  const entries = Object.entries(verses).sort((a, b) => {
    const as = Number.isFinite(a[1]?.seq) ? a[1].seq : parseInt(a[0], 10);
    const bs = Number.isFinite(b[1]?.seq) ? b[1].seq : parseInt(b[0], 10);
    return as - bs;
  });
  const chapterLabel = chapterData?.sequence ?? chapterData?.chapter_id ?? '';
  const bookKey = chapterData?.book_key || bookId;
  return entries.map(([verseId, verse]) => {
    const seq = Number.isFinite(verse?.seq) ? verse.seq : parseInt(verseId, 10) || 0;
    const name = `${chapterLabel}:${verseId}`;
    const text = verse?.text?.[translation] || verse?.text?.NAB || '';
    return {
      id: `${bookKey}_${chapterLabel}_${verseId}`,
      name,
      sort: seq,
      order: undefined, // set by caller
      level: 'verse',
      parentId: chapterId || `${bookKey}:${chapterLabel}`,
      verse: verseId,
      chapter: chapterLabel,
      book: bookKey,
      text,
      translation
    };
  });
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
 * Built from verse_count alone (scripts/add-verse-counts.mjs), so the
 * whole ~31k-link skeleton is synthesized without fetching a single
 * chapter. Verse TEXT is not here and is not wanted here: it arrives per
 * chapter, on demand, and the detail sector reads it from the cache.
 */
export function buildBibleVerseChain(manifest, { initialVerseId = null } = {}) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible?.testaments) return { items: [], selectedIndex: 0, preserveOrder: true };

  const sorted = [];
  Object.entries(bible.testaments).sort(bySortNumber).forEach(([testamentId, testament]) => {
    Object.entries(testament?.sections || {}).sort(bySortNumber).forEach(([sectionId, section]) => {
      Object.entries(section?.books || {}).sort(bySortNumber).forEach(([bookId, book]) => {
        const bookKey = book?.book_key || bookId;
        Object.entries(book?.chapters || {}).sort(bySortNumber).forEach(([chapterKey, chapterMeta]) => {
          const count = Number.isFinite(chapterMeta?.verse_count) ? chapterMeta.verse_count : 0;
          if (count <= 0) return;
          const chapterLabel = chapterMeta?.name ?? chapterKey;
          const chapterId = chapterMeta?.id || `${bookId}:${chapterKey}`;
          const externalFile = chapterMeta?._external_file || chapterMeta?.external_file || '';
          for (let verseKey = 1; verseKey <= count; verseKey += 1) {
            sorted.push({
              // Ids and names match what a loaded chapter produces, so a
              // verse tapped in the pyramid finds its seat in this chain.
              id: `${bookKey}_${chapterLabel}_${verseKey}`,
              name: `${chapterLabel}:${verseKey}`,
              level: 'verse',
              parentId: chapterId,
              chapterKey: `${bookId}:${chapterKey}`,
              bookKey: bookId,
              testamentKey: testamentId,
              meta: {
                bookId: bookKey,
                bookEntryId: bookId,
                chapterId,
                sectionId,
                testamentId,
                verseKey: String(verseKey),
                externalFile
              }
            });
          }
        });
      });
    });
  });

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

export async function buildBibleVerseCousinChain(manifest, { bookId, startChapterId, translation = 'NAB' } = {}) {
  const found = findBibleBook(manifest, bookId);
  if (!found) return { items: [], selectedIndex: 0, preserveOrder: true };
  const { book } = found;
  const chapters = Object.entries(book?.chapters || {}).sort(bySortNumber);
  const startIdx = Math.max(0, startChapterId ? chapters.findIndex(([id]) => id === startChapterId) : 0);
  const chain = [];

  for (let i = startIdx; i < chapters.length; i += 1) {
    const [chapterKey, chapterMeta] = chapters[i];
    const chapterId = chapterMeta?.id || `${bookId}:${chapterKey}`;
    const chapterData = await fetchChapterData(chapterMeta);
    const verseItems = buildVerseItems(chapterData, { bookId, translation, chapterId });
    verseItems.forEach((item, idx) => {
      item.order = chain.length + idx; // preserve cumulative spacing including gaps
    });
    chain.push(...verseItems);
    const isLast = i === chapters.length - 1;
    if (!isLast) {
      chain.push(GAP, GAP);
    }
  }

  const firstReal = chain.findIndex(item => item !== GAP);
  const selectedIndex = firstReal >= 0 ? firstReal : 0;
  return { items: chain, selectedIndex, preserveOrder: true };
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
  const activeTestament = bible.testaments[activeTestamentId];
  const sections = Object.entries(activeTestament?.sections || {}).sort(bySortNumber);
  const testamentNames = names?.testaments || {};
  const bookNames = names?.books || names || {};
  const testamentName = testamentNames[activeTestamentId] || activeTestament?.name || activeTestamentId;
  const chain = [];

  // Books are displayed flat (no section gaps). Section is retained on each item
  // as metadata for back-navigation context but is not shown as a UI level.
  sections.forEach(([sectionKey, section]) => {
    const books = Object.entries(section?.books || {}).sort(bySortNumber);
    books.forEach(([, book]) => {
      const id = book?.book_key || book?.id || book?.name;
      if (!id) return;
      chain.push({
        id,
        name: bookNames?.[id] || book?.book_name || book?.name || id,
        sort: Number.isFinite(book?.sort_number) ? book.sort_number : chain.length,
        order: chain.length,
        level: 'book',
        testamentId: activeTestamentId,
        sectionId: sectionKey,
        parentName: testamentName,
        // Editorial prominence tier (1 featured, 2 notable, absent default):
        // declared in the data, honored by the star field's seating and size.
        prominence: Number.isFinite(book?.prominence) ? book.prominence : undefined
      });
    });
  });

  const selectedIndex = (() => {
    if (initialItemId) {
      const idx = chain.findIndex(item => item && (item.id === initialItemId || item.book_key === initialItemId));
      if (idx >= 0) return idx;
    }
    if (bookId) {
      const idx = chain.findIndex(item => item && item.id === bookId);
      if (idx >= 0) return idx;
    }
    const firstReal = chain.findIndex(item => item !== GAP);
    return firstReal >= 0 ? firstReal : 0;
  })();

  return { items: chain, selectedIndex, preserveOrder: true };
}
