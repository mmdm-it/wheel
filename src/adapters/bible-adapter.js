import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildBibleSections } from './volume-helpers.js';
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

if (!isBrowser) {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  manifestPath = path.resolve(__dirname, '../../data/gutenberg/manifest.json');
  schemaPath = path.resolve(__dirname, '../../schemas/gutenberg.schema.json');
  nodeReadFile = (await import('fs/promises')).readFile;
  nodeReadFileSync = (await import('fs')).readFileSync;
  AjvCtor = (await import('ajv')).default;
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
              chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : null
            }
          });
        });
      });
    });
  });

  const levelOrder = ['root', 'testament', 'section', 'book', 'chapter'];
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
      leafLevel: 'chapter',
      levels: ['testament', 'section', 'book', 'chapter'],
      colors: levelPalette,
      dimensions
    }
  };
}

export function layoutSpec(normalized, viewport) {
  const levels = normalized?.meta?.levels || ['testament', 'section', 'book', 'chapter'];
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
      sample: siblings => sampleSiblings(siblings, pyramidCapacity.total),
      place: siblings => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity })
    }
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

export function createHandlers({ manifest, namesMap, options, translationsMeta, chainMeta }) {
  let bibleMode = 'book';
  let bibleChapterContext = null;
  const lastBookBySection = {};
  const secondary = translationsMeta ? buildSecondaryLanguages(translationsMeta, options?.translation) : { items: [], selectedIndex: 0 };

  const parentHandler = ({ selected, app }) => {
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
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true, showInner: true });
      if (app?.setPrimaryItems) app.setPrimaryItems(bookItems, bookSelected, bookPreserve);
      return true;
    }
    if (bibleMode !== 'book') return false;
    const sectionId = selected?.sectionId;
    if (sectionId && selected?.id) {
      lastBookBySection[sectionId] = selected.id;
    }
    const testamentId = selected?.testamentId;
    const { items: sectionItems, selectedIndex: sectionSelected } = buildBibleSections(manifest, {
      testamentId,
      sectionId,
      namesMap
    });
    if (!sectionItems.length) return false;
    bibleMode = 'section';
    if (app?.setParentButtons) app.setParentButtons({ showOuter: true, showInner: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(sectionItems, sectionSelected, true);
    return true;
  };

  const childrenHandler = ({ selected, app }) => {
    if (bibleMode !== 'section') return false;
    const sectionId = selected?.id;
    const testamentId = selected?.testamentId;
    const initialBookId = sectionId ? lastBookBySection[sectionId] : null;
    const { items: bookItems, selectedIndex: bookSelected, preserveOrder: bookPreserve } = buildBibleBookCousinChain(manifest, {
      testamentId,
      initialItemId: initialBookId,
      names: namesMap
    });
    if (!bookItems.length) return false;
    bibleMode = 'book';
    if (app?.setParentButtons) app.setParentButtons({ showOuter: true, showInner: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(bookItems, bookSelected, bookPreserve);
    return true;
  };

  return {
    parentHandler,
    childrenHandler,
    secondary,
    layoutBindings: {
      bibleModeRef: () => bibleMode,
      setBibleMode: next => { bibleMode = next; },
      setBibleChapterContext: ctx => { bibleChapterContext = ctx; },
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
