import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildBibleTestaments, getBibleChapters, getBibleVerseItems, prefetchBibleVerses, getVerseTextFromCache } from './volume-helpers.js';
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

export function detailFor(selected, manifest) {
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
      // Prefer the translation from the URL query string; fall back to VUL then NAB.
      const searchParams = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const urlTranslation = searchParams?.get('translation') || null;
      const preferred = urlTranslation ? [urlTranslation, 'VUL', 'NAB', 'BYZ', 'SYN'] : ['VUL', 'NAB', 'BYZ', 'SYN'];
      const text = getVerseTextFromCache(externalFile, verseKey, preferred);
      if (text) return { type: 'text', text };
    }
    return { type: 'text', text: selected.text || selected.name || id || '' };
  }

  return { type: 'text', text: selected.name || id || '' };
}

const translationsForLanguage = (translationsMeta, language) => {
  const translations = translationsMeta?.translations || {};
  const entries = Object.entries(translations).filter(([, t]) => t?.language === language);
  if (!entries.length) return null;
  const both = entries.find(([, t]) => (t?.testament || '').toLowerCase() === 'both');
  if (both) return both[0];
  return entries[0][0];
};

const buildSecondaryLanguages = (translationsMeta, currentTranslation) => {
  const nativeNames = {
    latin: 'Latina',
    greek: 'Ελληνικά',
    hebrew: 'עברית',
    english: 'English',
    french: 'Français',
    spanish: 'Español',
    italian: 'Italiano',
    portuguese: 'Português',
    russian: 'Русский'
  };
  const desiredOrder = ['hebrew', 'greek', 'latin', 'french', 'spanish', 'english', 'italian', 'portuguese', 'russian'];
  const normalize = lang => (lang || '').toLowerCase().trim() === 'portugese' ? 'portuguese' : (lang || '').toLowerCase().trim();
  const translations = translationsMeta?.translations || {};
  const items = desiredOrder.map((lang, idx) => {
    const normalizedLang = normalize(lang);
    const translation = translationsForLanguage(translationsMeta, normalizedLang) || currentTranslation || 'NAB';
    const name = nativeNames[normalizedLang]
      || (translations[translation]?.language_name)
      || (normalizedLang ? `${normalizedLang.charAt(0).toUpperCase()}${normalizedLang.slice(1)}` : 'Language');
    return {
      id: normalizedLang,
      name,
      order: idx,
      translation
    };
  });
  const currentLang = translations?.[currentTranslation]?.language;
  const selectedIndex = (() => {
    if (currentLang) {
      const idx = items.findIndex(item => item.id === currentLang);
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  return { items, selectedIndex };
};

export function createHandlers({ manifest, namesMap, options, translationsMeta, chainMeta, translationName = '' }) {
  const initialLevel = options?.level;
  let bibleMode = (initialLevel === 'chapter' || initialLevel === 'verse') ? initialLevel : 'book';
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
  const secondary = translationsMeta ? buildSecondaryLanguages(translationsMeta, options?.translation) : { items: [], selectedIndex: 0 };

  const parentHandler = ({ selected, app }) => {
    if (bibleMode === 'verse') {
      const ctx = bibleVerseContext;
      if (!ctx?.bookId) return false;
      // Navigate back to the chapter list for this book.
      const chapterItems = getBibleChapters(manifest, { id: ctx.bookId }, namesMap, 'book');
      if (!chapterItems.length) return false;
      const chapterIdx = chapterItems.findIndex(c => c.id === ctx.chapterId);
      bibleMode = 'chapter';
      bibleVerseContext = null;
      bibleChapterContext = { bookId: ctx.bookId, testamentId: ctx.testamentId, sectionId: ctx.sectionId };
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(chapterItems, chapterIdx >= 0 ? chapterIdx : 0, true);
      }
      return true;
    }

    if (bibleMode === 'chapter') {
      const ctx = bibleChapterContext;
      const { items: bookItems, selectedIndex: bookSelected, preserveOrder: bookPreserve } = buildBibleBookCousinChain(manifest, {
        testamentId: ctx?.testamentId,
        initialItemId: ctx?.bookId,
        names: namesMap
      });
      if (!bookItems.length) return false;
      bibleMode = 'book';
      bibleChapterContext = null;
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(bookItems, bookSelected, bookPreserve);
      }
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
      if (app?.setParentButtons) app.setParentButtons({ showOuter: false });
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(testamentItems, testamentSelected, true);
      }
      return true;
    }
    // bibleMode === 'testament': no parent above this level.
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
    // Chapter ring: parent is the book name (e.g. "MATTHEW")
    if (item.level === 'chapter') {
      const bookId = item.meta?.bookId || item.parentId;
      if (!bookId) return '';
      const book = findBook(manifest, bookId);
      return (book?.book_name || bookId).toUpperCase();
    }
    // Verse ring: parent is the chapter number (e.g. "Chapter 16")
    if (item.level === 'verse') {
      const chapterId = item.meta?.chapterId || item.parentId || '';
      const chapterKey = chapterId.includes(':') ? chapterId.split(':').pop() : chapterId;
      return chapterKey ? `Chapter ${chapterKey}` : '';
    }
    // Book ring: parent is the testament name (already stored on items as parentName)
    return item.parentName || '';
  };

  return {
    parentHandler,
    childrenHandler,
    secondary,
    getParentLabel,
    layoutBindings: {
      bibleModeRef: () => bibleMode,
      setBibleMode: next => { bibleMode = next; },
      setBibleChapterContext: ctx => { bibleChapterContext = ctx; },
      setBibleVerseContext: ctx => { bibleVerseContext = ctx; },
      getBibleVerseItems,
      prefetchBibleVerses,
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
    theming: true
  }
};
