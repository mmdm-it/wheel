import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildBibleTestaments, getBibleChapters, getBibleVerseItems, prefetchBibleVerses, getVerseTextFromCache, toRomanNumeral } from './volume-helpers.js';
import { buildBibleVerseChain, buildBibleChapterChain } from '../navigation/cousin-builder.js';
import { buildBibleBookCousinChain } from '../navigation/cousin-builder.js';
import { buildBiblePyramid } from '../pyramid/volume-pyramid.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/gutenberg/manifest.json';
const schemaUrl = './schemas/gutenberg.schema.json';

let manifestPath = null;
let schemaPath = null;
let nodeReadFile = null;
let nodeReadFileSync = null;
let AjvCtor = null;

let _nodeReady = null;
function _ensureNode() {
  if (isBrowser) return Promise.resolve();
  if (_nodeReady) return _nodeReady;
  _nodeReady = (async () => {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    manifestPath = path.resolve(__dirname, '../../data/gutenberg/manifest.json');
    schemaPath = path.resolve(__dirname, '../../schemas/gutenberg.schema.json');
    nodeReadFile = (await import('fs/promises')).readFile;
    nodeReadFileSync = (await import('fs')).readFileSync;
    AjvCtor = (await import('ajv')).default;
  })();
  return _nodeReady;
}

let validateFn = null;
let ajvInstance = null;

const fetchJson = async url => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
};

const getValidator = () => {
  if (isBrowser) return null;
  if (validateFn) return validateFn;
  if (!nodeReadFileSync || !schemaPath || !AjvCtor) return null;
  if (!ajvInstance) ajvInstance = new AjvCtor({ allErrors: true, strict: false });
  const schemaJson = JSON.parse(nodeReadFileSync(schemaPath, 'utf-8'));
  validateFn = ajvInstance.compile(schemaJson);
  return validateFn;
};

export async function loadManifest() {
  if (isBrowser) return fetchJson(manifestUrl);
  await _ensureNode();
  const raw = await nodeReadFile(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

export function validate(raw) {
  const validator = getValidator();
  if (!validator) return { ok: true, errors: [] };
  const ok = validator(raw);
  const errors = ok ? [] : (validator.errors || []).map(err => `${err.instancePath} ${err.message}`.trim());
  return { ok, errors };
}

export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('normalize: manifest is required');
  const [volumeKey, volumeData] = Object.entries(raw)[0] || [];
  if (!volumeData) throw new Error('normalize: manifest missing volume data');
  const items = [];
  const links = [];
  const levelPalette = {};

  const hierarchyLevels = volumeData?.display_config?.hierarchy_levels || {};
  Object.entries(hierarchyLevels).forEach(([level, cfg]) => {
    if (cfg?.color) levelPalette[level] = cfg.color;
  });

  const addItem = ({ id, name, level, parentId = null, order = 0, meta = {} }) => {
    items.push({ id, name, level, parentId, order, meta });
    if (parentId) links.push({ from: parentId, to: id });
  };

  const rootId = `volume:${volumeKey}`;
  const volumeName = volumeData?.display_config?.volume_name || volumeKey || 'bible';
  addItem({ id: rootId, name: volumeName, level: 'root', parentId: null, order: 0 });

  const testaments = volumeData.testaments || {};
  const displayConfig = volumeData.display_config || {};
  const dimensions = {
    languages: displayConfig.languages || null,
    editions: displayConfig.editions || null
  };
  Object.entries(testaments).forEach(([testamentId, testament], ti) => {
    const testamentOrder = Number.isFinite(testament?.sort_number) ? testament.sort_number : ti;
    addItem({ id: testamentId, name: testament?.name || testamentId, level: 'testament', parentId: rootId, order: testamentOrder });

    const sections = testament?.sections || {};
    Object.entries(sections).forEach(([sectionId, section], si) => {
      const sectionOrder = Number.isFinite(section?.sort_number) ? section.sort_number : si;
      addItem({ id: sectionId, name: section?.name || sectionId, level: 'section', parentId: testamentId, order: sectionOrder, meta: { testamentId } });

      const books = section?.books || {};
      Object.entries(books).forEach(([bookId, book], bi) => {
        const bookOrder = Number.isFinite(book?.sort_number) ? book.sort_number : (Number.isFinite(book?.book_number) ? book.book_number : bi);
        addItem({
          id: bookId,
          name: book?.book_name || book?.name || bookId,
          level: 'book',
          parentId: sectionId,
          order: bookOrder,
          meta: { testamentId, sectionId, bookNumber: book?.book_number ?? null }
        });

        const chapters = book?.chapters || {};
        Object.entries(chapters).forEach(([chapterKey, chapterVal], ci) => {
          const chapterId = chapterVal?.id || `${bookId}:${chapterKey}`;
          const chapterNumber = chapterVal?.chapter_number ?? Number.parseInt(chapterKey, 10);
          const chapterOrder = Number.isFinite(chapterVal?.sort_number) ? chapterVal.sort_number : (Number.isFinite(chapterNumber) ? chapterNumber : ci);
          addItem({
            id: chapterId,
            name: chapterVal?.name || chapterKey,
            level: 'chapter',
            parentId: bookId,
            order: chapterOrder,
            meta: {
              testamentId,
              sectionId,
              bookId,
              chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : null,
              chapterKey,
              externalFile: chapterVal?._external_file
                || `data/gutenberg/chapters/${bookId}/${String(chapterKey).padStart(3, '0')}.json`
            }
          });
        });
      });
    });
  });

  const levelOrder = ['root', 'testament', 'section', 'book', 'chapter', 'verse'];
  items.sort((a, b) => {
    const lo = levelOrder.indexOf(a.level);
    const ro = levelOrder.indexOf(b.level);
    if (lo === ro) {
      if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
      return a.order - b.order;
    }
    return lo - ro;
  });
  items.forEach((item, idx) => { item.order = idx; });

  return {
    items,
    links,
    meta: {
      volumeId: volumeKey,
      leafLevel: 'verse',
      levels: ['testament', 'book', 'chapter', 'verse'],
      colors: levelPalette,
      dimensions
    }
  };
}

export function layoutSpec(normalized, viewport) {
  const levels = normalized?.meta?.levels || ['testament', 'book', 'chapter', 'verse'];
  const vp = viewport?.width && viewport?.height ? viewport : getViewportInfo(1280, 720);
  const pyramidCapacity = calculatePyramidCapacity(vp);
  const palette = normalized?.meta?.colors || {
    testament: '#8b6f47',
    section: '#8b6f47',
    book: '#8b6f47',
    chapter: '#8b6f47'
  };
  return {
    rings: levels.map((lvl, idx) => ({ id: lvl, order: idx })),
    label: item => item?.name ?? '',
    colorByLevel: level => palette[level] || '#555',
    pyramid: {
      capacity: pyramidCapacity,
      place: (siblings, viewport, opts) => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity, logoBounds: opts?.logoBounds })
    },
  };
}

function findBook(manifest, bookId) {
  const testaments = manifest?.Gutenberg_Bible?.testaments || {};
  for (const testament of Object.values(testaments)) {
    const sections = testament?.sections || {};
    for (const section of Object.values(sections)) {
      const books = section?.books || {};
      if (books[bookId]) return books[bookId];
    }
  }
  return null;
}

function findChapter(manifest, chapterId) {
  const testaments = manifest?.Gutenberg_Bible?.testaments || {};
  for (const testament of Object.values(testaments)) {
    const sections = testament?.sections || {};
    for (const section of Object.values(sections)) {
      const books = section?.books || {};
      for (const [bookKey, bookVal] of Object.entries(books)) {
        const chapters = bookVal?.chapters || {};
        for (const [chapterKey, chapterVal] of Object.entries(chapters)) {
          const id = chapterVal?.id || `${bookKey}:${chapterKey}`;
          if (id === chapterId) {
            return { chapter: chapterVal, book: bookVal };
          }
        }
      }
    }
  }
  return null;
}

// READING AHEAD. The verse ring spans the whole volume but verse TEXT
// arrives one chapter-file at a time, so a reader crossing into a new
// chapter would meet a bare reference ("2:1") where the words should be.
// Two habits fix that: load the chapter under the magnifier if it is not
// yet here (and repaint when it lands), and — once the reader is within
// sight of the last verse — quietly fetch the chapter after it, so the
// crossing itself is never a wait.
const VERSES_BEFORE_READING_AHEAD = 5;
const byDeclaredOrder = (a, b) => {
  const rank = entry => (Number.isFinite(entry?.[1]?.sort_number)
    ? entry[1].sort_number
    : (Number.parseInt(entry?.[0], 10) || 0));
  return rank(a) - rank(b);
};
let _renderDetail = null;          // captured at boot; repaints when text lands
const _requestedChapters = new Set(); // asked-for files, so a failure is not re-asked forever
let _chapterOrder = null;          // flat reading order, memoized

function chaptersInReadingOrder(manifest) {
  if (_chapterOrder) return _chapterOrder;
  const bible = manifest?.Gutenberg_Bible;
  const order = [];
  Object.entries(bible?.testaments || {}).sort(byDeclaredOrder).forEach(([, testament]) => {
    Object.entries(testament?.sections || {}).sort(byDeclaredOrder).forEach(([, section]) => {
      Object.entries(section?.books || {}).sort(byDeclaredOrder).forEach(([bookId, book]) => {
        Object.entries(book?.chapters || {}).sort(byDeclaredOrder).forEach(([chapterKey, chapter]) => {
          order.push({
            chapterId: chapter?.id || `${bookId}:${chapterKey}`,
            bookId: book?.book_key || bookId,
            externalFile: chapter?._external_file || chapter?.external_file || '',
            verseCount: Number.isFinite(chapter?.verse_count) ? chapter.verse_count : 0
          });
        });
      });
    });
  });
  _chapterOrder = order;
  return order;
}

function requestChapter(chapterId, bookId, externalFile) {
  if (!externalFile || _requestedChapters.has(externalFile)) return;
  _requestedChapters.add(externalFile);
  prefetchBibleVerses(
    { id: chapterId, meta: { externalFile, bookId } },
    { onLoaded: () => { if (typeof _renderDetail === 'function') _renderDetail(); } }
  );
}

function readAhead(selected, manifest) {
  const meta = selected?.meta;
  if (!meta?.externalFile) return;
  requestChapter(meta.chapterId, meta.bookId, meta.externalFile);
  const order = chaptersInReadingOrder(manifest);
  const here = order.findIndex(c => c.chapterId === meta.chapterId);
  if (here < 0 || here + 1 >= order.length) return;
  const verseKey = Number.parseInt(meta.verseKey, 10);
  const remaining = order[here].verseCount - verseKey;
  if (Number.isFinite(remaining) && remaining <= VERSES_BEFORE_READING_AHEAD) {
    const next = order[here + 1];
    requestChapter(next.chapterId, next.bookId, next.externalFile);
  }
}

export function detailFor(selected, manifest, { normalized, translation } = {}) {
  if (!selected) return null;
  const id = selected.id || '';
  const level = selected.level || '';

  if (level === 'testament') {
    return {
      type: 'card',
      title: selected.name || id,
      body: 'Testament overview'
    };
  }

  if (level === 'section') {
    return {
      type: 'card',
      title: selected.name || id,
      body: 'Section overview'
    };
  }

  if (level === 'book') {
    const book = findBook(manifest, id) || {};
    const chapterCount = Object.keys(book.chapters || {}).length;
    const bookNumber = book.book_number;
    const subtitle = [bookNumber ? `Book ${bookNumber}` : null, chapterCount ? `${chapterCount} chapters` : null]
      .filter(Boolean)
      .join(' · ');
    return {
      type: 'card',
      title: book.book_name || book.name || selected.name || id,
      body: subtitle || 'Book overview'
    };
  }

  if (level === 'chapter') {
    const lookup = findChapter(manifest, id);
    const chapterName = lookup?.chapter?.name || selected.name || id;
    const bookName = lookup?.book?.book_name || lookup?.book?.name || lookup?.book?.id || '';
    return {
      type: 'text',
      text: bookName ? `${bookName}: ${chapterName}` : chapterName
    };
  }

  if (level === 'verse') {
    const externalFile = selected.meta?.externalFile;
    const verseKey = selected.meta?.verseKey;
    if (externalFile && verseKey) {
      // Use the active translation (passed in), then fall back to the URL query
      // string, then to the remaining pool.  Never default to Latin (VUL) over
      // English (NAB) — language only changes when the user explicitly selects one.
      const searchParams = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const urlTranslation = searchParams?.get('translation') || null;
      const activeTranslation = urlTranslation || translation || null;
      const others = ['NAB', 'VUL', 'BYZ', 'SYN'].filter(t => t !== activeTranslation);
      const preferred = activeTranslation ? [activeTranslation, ...others] : others;
      const text = getVerseTextFromCache(externalFile, verseKey, preferred);
      readAhead(selected, manifest);
      if (text) return { type: 'text', text };
      // The chapter is on its way; the repaint comes with it.
      return { type: 'text', text: selected.text || '' };
    }
    return { type: 'text', text: selected.text || selected.name || id || '' };
  }

  return { type: 'text', text: selected.name || id || '' };
}

// Single-item root ring for gateway entry: BIBLIA SACRA LATINA alone in the
// magnifier with the testaments in the child pyramid.
export const buildBibleRootChain = () => ({
  items: [{ id: 'BIBLIA_SACRA_LATINA', name: 'BIBLIA SACRA LATINA', level: 'bibleRoot', order: 0 }],
  selectedIndex: 0,
  preserveOrder: true
});

export function createHandlers({ manifest, namesMap, options, translationsMeta, chainMeta, translationName = '', onGatewayReturn = null, gatewayLabel = '', gatewayReturnLabel = '' }) {
  const initialLevel = options?.level;
  const hasRoot = initialLevel === 'root';
  let bibleMode = (initialLevel === 'chapter' || initialLevel === 'verse') ? initialLevel : (hasRoot ? 'root' : 'book');
  let bibleChapterContext = (initialLevel === 'chapter' && options?.bookId)
    ? { bookId: options.bookId, testamentId: null, sectionId: null }
    : null;
  let bibleVerseContext = null;
  // Pre-populate verse context at startup so OUT navigation works immediately.
  if (initialLevel === 'verse' && options?.bookId && options?.chapterId) {
    const chapterItems = getBibleChapters(manifest, { id: options.bookId }, namesMap, 'book');
    const ch = chapterItems.find(c => c.meta?.chapterKey === String(options.chapterId));
    if (ch) {
      bibleVerseContext = {
        chapterId: ch.id,
        bookId: options.bookId,
        testamentId: ch.meta?.testamentId || null,
        sectionId: ch.meta?.sectionId || null,
        externalFile: ch.meta?.externalFile || null
      };
      // Also pre-populate chapter context so a second OUT (verse→chapter→book) works.
      bibleChapterContext = {
        bookId: options.bookId,
        testamentId: ch.meta?.testamentId || null,
        sectionId: ch.meta?.sectionId || null
      };
    }
  }
  const lastBookByTestament = {};

  // The chapter chain is the same on every entry; build it once.
  let chapterChainItems = null;
  const chapterChain = initialChapterId => {
    if (!chapterChainItems) {
      chapterChainItems = buildBibleChapterChain(manifest, { namesMap }).items;
    }
    let selectedIndex = 0;
    if (initialChapterId) {
      const idx = chapterChainItems.findIndex(item => item && item.id === initialChapterId);
      if (idx >= 0) selectedIndex = idx;
    }
    return { items: chapterChainItems, selectedIndex };
  };

  // The ~34k-link verse chain is the same on every entry; build it once
  // and only re-locate the verse entered at.
  let verseChainItems = null;
  const verseChain = initialVerseId => {
    if (!verseChainItems) {
      verseChainItems = buildBibleVerseChain(manifest, {}).items;
    }
    let selectedIndex = 0;
    if (initialVerseId) {
      const idx = verseChainItems.findIndex(item => item && item.id === initialVerseId);
      if (idx >= 0) selectedIndex = idx;
    }
    return { items: verseChainItems, selectedIndex };
  };

  const parentHandler = ({ selected, app }) => {
    if (bibleMode === 'verse') {
      // The verse ring spans the whole volume, so the reader may be far
      // from the chapter they entered at. Land on the MAGNIFIED verse's
      // own chapter; the entry context is only a fallback (the same live
      // contract the timeline uses for a date over its month).
      const ctx = {
        bookId: selected?.meta?.bookEntryId || selected?.meta?.bookId || bibleVerseContext?.bookId,
        chapterId: selected?.meta?.chapterId || bibleVerseContext?.chapterId,
        testamentId: selected?.meta?.testamentId || bibleVerseContext?.testamentId,
        sectionId: selected?.meta?.sectionId || bibleVerseContext?.sectionId
      };
      if (!ctx?.bookId) return false;
      // Navigate back to the chapter list for this book.
      const chapterItems = getBibleChapters(manifest, { id: ctx.bookId }, namesMap, 'book');
      if (!chapterItems.length) return false;
      const chapterIdx = chapterItems.findIndex(c => c.id === ctx.chapterId);
      bibleMode = 'chapter';
      bibleVerseContext = null;
      bibleChapterContext = { bookId: ctx.bookId, testamentId: ctx.testamentId, sectionId: ctx.sectionId };
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(chapterItems, chapterIdx >= 0 ? chapterIdx : 0, true);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return true;
    }

    if (bibleMode === 'chapter') {
      // The chapters ring spans the volume, so land on the MAGNIFIED
      // chapter's own book rather than the one entered at.
      const ctx = {
        bookId: selected?.meta?.bookId || bibleChapterContext?.bookId,
        testamentId: selected?.meta?.testamentId || bibleChapterContext?.testamentId,
        sectionId: selected?.meta?.sectionId || bibleChapterContext?.sectionId
      };
      const { items: bookItems, selectedIndex: bookSelected, preserveOrder: bookPreserve } = buildBibleBookCousinChain(manifest, {
        bookId: ctx?.bookId,
        testamentId: ctx?.testamentId,
        initialItemId: ctx?.bookId,
        names: namesMap
      });
      if (!bookItems.length) return false;
      bibleMode = 'book';
      bibleChapterContext = null;
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(bookItems, bookSelected, bookPreserve);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return true;
    }
    if (bibleMode === 'book') {
      const testamentId = selected?.testamentId;
      if (testamentId && selected?.id) {
        lastBookByTestament[testamentId] = selected.id;
      }
      const { items: testamentItems, selectedIndex: testamentSelected } = buildBibleTestaments(manifest, namesMap, {
        testamentId,
        translationName
      });
      if (!testamentItems.length) return false;
      bibleMode = 'testament';
      // With a gateway root above, the parent button stays visible
      // (BIBLIA SACRA LATINA); without one, testaments are the top level.
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(testamentItems, testamentSelected, true);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: hasRoot });
      return true;
    }
    if (bibleMode === 'testament' && hasRoot) {
      // Gateway entry: OUT from the testament ring returns to the
      // single-item BIBLIA SACRA LATINA root ring.
      const rootChain = buildBibleRootChain();
      bibleMode = 'root';
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(rootChain.items, rootChain.selectedIndex, rootChain.preserveOrder);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: Boolean(gatewayReturnLabel || gatewayLabel) });
      return true;
    }
    if (bibleMode === 'root') {
      // OUT through the gateway back to the host volume.
      if (typeof onGatewayReturn === 'function') return Boolean(onGatewayReturn());
      return false;
    }
    // bibleMode === 'testament' without a root above: no parent.
    return false;
  };

  const childrenHandler = ({ selected, app }) => {
    if (bibleMode !== 'testament') return false;
    const testamentId = selected?.id;
    const initialBookId = testamentId ? lastBookByTestament[testamentId] : null;
    const { items: bookItems, selectedIndex: bookSelected, preserveOrder: bookPreserve } = buildBibleBookCousinChain(manifest, {
      testamentId,
      initialItemId: initialBookId,
      names: namesMap
    });
    if (!bookItems.length) return false;
    bibleMode = 'book';
    if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(bookItems, bookSelected, bookPreserve);
    return true;
  };

  const getParentLabel = (item) => {
    if (!item) return '';
    // Gateway root ring: parent button points back through the gateway.
    // Top of this volume: the parent button is the way back through the
    // gateway, so it names the DESTINATION volume (Howell 2026-07-18 —
    // same contract as the calendar), not the gateway node came through.
    if (item.level === 'bibleRoot') return gatewayReturnLabel || gatewayLabel || '';
    // Testament ring under a gateway root: parent is the Biblia itself.
    if (item.level === 'testament' && hasRoot) return 'BIBLIA SACRA LATINA';
    // Chapter ring: parent is the book name in the display language
    // (e.g. "MATTHAEUS" — namesMap carries the Latin names under VUL)
    if (item.level === 'chapter') {
      const bookId = item.meta?.bookId || item.parentId;
      if (!bookId) return '';
      const book = findBook(manifest, bookId);
      const localized = namesMap?.books?.[bookId];
      return (localized || book?.book_name || bookId).toUpperCase();
    }
    // Verse ring: the book AND its chapter, live — "IOHANNES III". The
    // ring now runs the whole volume (2026-07-20), so a bare chapter is
    // ambiguous: reading Genesis into Exodus would go L → I with nothing
    // marking the crossing. No word between them: the Roman numeral is
    // already the citation form for a chapter, so "CAP" would only
    // re-state what the numeral says (Howell: "it's redundant").
    if (item.level === 'verse') {
      const chapterId = item.meta?.chapterId || item.parentId || '';
      const chapterKey = chapterId.includes(':') ? chapterId.split(':').pop() : chapterId;
      if (!chapterKey) return '';
      const n = Number.parseInt(chapterKey, 10);
      const chapterLabel = Number.isFinite(n) ? toRomanNumeral(n) : String(chapterKey);
      const bookId = item.meta?.bookEntryId || item.meta?.bookId || '';
      const book = bookId ? findBook(manifest, bookId) : null;
      const bookName = (namesMap?.books?.[bookId] || book?.book_name || bookId || '').toUpperCase();
      return bookName ? `${bookName} ${chapterLabel}` : chapterLabel;
    }
    // Book ring: parent is the testament name (stored mixed-case on items as
    // parentName; uppercased here because the theme no longer transforms —
    // parent labels arrive display-ready so MMdM's lowercase d survives).
    return (item.parentName || '').toUpperCase();
  };

  // Startup-verse prefetch: when the Bible opens on a chapter with a
  // featured verse, fetch the chapter's verse data and re-render the
  // Detail Sector with the verse text once it arrives. (Moved from the
  // host's bootVolume — Phase B audit, H1.)
  const onBoot = ({ app, items, selectedIndex, renderDetail }) => {
    // Held for the whole session: when a chapter's text lands, whatever
    // verse is under the magnifier repaints itself.
    if (typeof renderDetail === 'function') {
      _renderDetail = item => renderDetail(item || app?.nav?.getCurrent?.());
    }
    if (options?.level !== 'chapter' || !options?.verseId) return;
    const initialChapter = items[selectedIndex];
    if (!initialChapter?.meta?.externalFile) return;
    prefetchBibleVerses(initialChapter, {
      onLoaded() {
        const { externalFile, bookId, chapterKey } = initialChapter.meta;
        const verseKey = String(options.verseId);
        const syntheticVerse = {
          id: `${bookId}_${chapterKey}_${verseKey}`,
          name: `${chapterKey}:${verseKey}`,
          level: 'verse',
          parentId: initialChapter.id,
          meta: { bookId, chapterId: initialChapter.id, verseKey, externalFile }
        };
        if (app?.openDetailSector) {
          app.openDetailSector(() => renderDetail(syntheticVerse));
        } else {
          renderDetail(syntheticVerse);
        }
      }
    });
  };

  return {
    parentHandler,
    childrenHandler,
    getParentLabel,
    onBoot,
    // NUMERALS SIT ON THEIR NODES, NAMES SIT BESIDE THEM (Howell
    // 2026-07-20): chapters and verses centre over the node; book and
    // testament NAMES keep the offset that reads well for words — the
    // same instinct the catalog's cylinder counts already follow.
    shouldCenterLabel: ({ item } = {}) => item?.level === 'chapter' || item?.level === 'verse',
    layoutBindings: {
      getBibleTestaments: () => buildBibleTestaments(manifest, namesMap, { translationName }),
      bibleModeRef: () => bibleMode,
      setBibleMode: next => { bibleMode = next; },
      setBibleChapterContext: ctx => { bibleChapterContext = ctx; },
      setBibleVerseContext: ctx => { bibleVerseContext = ctx; },
      getBibleVerseItems,
      getBibleVerseChain: verseId => verseChain(verseId),
      getBibleChapterChain: chapterId => chapterChain(chapterId),
      prefetchBibleVerses,
      getBibleBooksForTestament: (testamentId) =>
        buildBibleBookCousinChain(manifest, { testamentId, names: namesMap }),
      pyramidBuilder: buildBiblePyramid
    }
  };
}

export const bibleAdapter = {
  loadManifest,
  validate,
  normalize,
  layoutSpec,
  detailFor,
  createHandlers,
  capabilities: {
    search: false,
    deepLink: false,
    theming: true,
    // At the leaf the detail sector doubles as a NEXT button
    // (the e-reader gesture: tap the verse, read the next).
    detailTapAdvances: true
  }
};
