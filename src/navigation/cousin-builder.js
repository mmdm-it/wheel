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

function buildVerseItems(chapterData, { bookId, translation }) {
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
      verse: verseId,
      chapter: chapterLabel,
      book: bookKey,
      text,
      translation
    };
  });
}

export async function buildBibleVerseCousinChain(manifest, { bookId, startChapterId, translation = 'NAB' } = {}) {
  const found = findBibleBook(manifest, bookId);
  if (!found) return { items: [], selectedIndex: 0, preserveOrder: true };
  const { book } = found;
  const chapters = Object.entries(book?.chapters || {}).sort(bySortNumber);
  const startIdx = Math.max(0, startChapterId ? chapters.findIndex(([id]) => id === startChapterId) : 0);
  const chain = [];

  for (let i = startIdx; i < chapters.length; i += 1) {
    const [chapterId, chapterMeta] = chapters[i];
    const chapterData = await fetchChapterData(chapterMeta);
    const verseItems = buildVerseItems(chapterData, { bookId, translation });
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
  const sectionNames = names?.sections || {};
  const bookNames = names?.books || names || {};
  const chain = [];

  sections.forEach(([sectionKey, section], sectionIdx) => {
    const books = Object.entries(section?.books || {}).sort(bySortNumber);
    books.forEach(([, book]) => {
      const id = book?.book_key || book?.id || book?.name;
      if (!id) return;
      chain.push({
        id,
        name: bookNames?.[id] || book?.book_name || book?.name || id,
        sort: Number.isFinite(book?.sort_number) ? book.sort_number : chain.length,
        order: chain.length,
        testamentId: activeTestamentId,
        sectionId: sectionKey,
        parentName: sectionNames?.[sectionKey] || section?.name || sectionKey
      });
    });
    const isLastSection = sectionIdx === sections.length - 1;
    if (!isLastSection) {
      chain.push(GAP, GAP);
    }
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
