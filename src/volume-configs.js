// Volume wiring: the ONE file where volume-specific literals live.
// Everything the host needs to know about a volume — its adapter, manifest
// path, theme, option parsing, label formatting, and chain building — is
// declared here; src/main.js stays volume-agnostic and is scanned by
// test/forbidden-literals.test.js (Phase B audit, H1/M5).
import { buildBibleVerseChain, buildBibleBookCousinChain } from './navigation/cousin-builder.js';
import { getPlacesLevels, buildPlacesLevel, buildCalendarYears, buildCalendarMonthsCousinChain, buildBibleBooks, buildCatalogManufacturers, getBibleChapters, toRomanNumeral } from './adapters/volume-helpers.js';
import { createAdapterRegistry, createAdapterLoader } from './adapters/registry.js';
import { recall } from './core/session-memory.js';

import { catalogAdapter } from './adapters/catalog-adapter.js';
import { bibleAdapter, buildBibleRootChain } from './adapters/bible-adapter.js';
import { calendarAdapter } from './adapters/calendar-adapter.js';
import { placesAdapter } from './adapters/places-adapter.js';

// A remembered verse id (BOOK_CHAPTER_VERSE, e.g. GENE_1_1) split back into
// the coordinates the bible chain boots from. Anything that does not match
// the shape — a stale id from an older scheme, a corrupted value — returns
// null and the caller falls through to the pinned default.
function parseVerseId(id) {
  const m = /^([A-Z][A-Z_]*)_(\d+)_(\d+)$/.exec(String(id || ''));
  return m ? { bookId: m[1], chapterId: m[2], verseId: m[3] } : null;
}

const adapterRegistry = createAdapterRegistry();
adapterRegistry.register('catalog', () => ({ ...catalogAdapter, volumeId: 'catalog' }));
adapterRegistry.register('bible', () => ({ ...bibleAdapter, volumeId: 'bible' }));
adapterRegistry.register('calendar', () => ({ ...calendarAdapter, volumeId: 'calendar' }));
adapterRegistry.register('places', () => ({ ...placesAdapter, volumeId: 'places' }));
const adapterLoader = createAdapterLoader(adapterRegistry);

// Shared handler factory — the four volume blocks used to carry identical
// copies of this closure (Phase B audit, M5).
function makeAdapterHandlers(volumeId) {
  return params => {
    const adapter = adapterLoader.load(volumeId);
    return adapter?.createHandlers ? adapter.createHandlers(params) : { parentHandler: () => false, childrenHandler: () => false, layoutBindings: {} };
  };
}

const DEFAULT_VOLUME = 'catalog';
const volumeConfigs = {
  bible: {
    id: 'bible',
    paths: ['/bible'],
    manifestPath: './data/gutenberg/manifest.json',
    theme: 'bible',
    palette: {
      bg: '#d4a574',
      node: '#8b5a2b',
      text: '#2a1a0f',
      band: '#8a6a49',
      accent: '#8b5a2b',
      magnifierStroke: '#2a1a0f'
    },
    stampLetter: 'B', // the factory stamp's data line (W-7)
    extractRoot: manifest => manifest?.Gutenberg_Bible,
    async loadSupplemental() {
      const [translationsMeta, languagesMeta] = await Promise.all([
        fetch('./data/gutenberg/translations.json').then(r => r.json()).catch(() => null),
        fetch('./data/gutenberg/languages.json').then(r => r.json()).catch(() => null)
      ]);
      return { translationsMeta, languagesMeta };
    },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      const level = params.get('level') || startup.top_navigation_level || 'verse';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-with-gaps';
      const cousinParam = params.get('cousins');
      const cousinMode = cousinParam === null ? arrangement !== 'siblings-only' : cousinParam === '1';
      // THE READER RESUMES WHERE THEY STOPPED (Howell ruling 3, 2026-07-30):
      // first visit opens at the pinned default (Matthew 16:18, Vulgate);
      // thereafter at the verse they were last on. An EXPLICIT deep link wins
      // wholesale — if any of book/chapter/verse is named in the URL, memory
      // is ignored entirely rather than blended with it, since a half-honoured
      // link ("their book, my chapter") would be worse than either.
      const deepLinked = params.get('book') || params.get('chapter') || params.get('verse');
      const resumed = deepLinked ? null : parseVerseId(recall('bible').itemId);
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        bookId: params.get('book') || resumed?.bookId || 'MATHE',
        testamentId: params.get('testament'),
        chapterId: params.get('chapter') || resumed?.chapterId || '16',
        verseId: params.get('verse') || resumed?.verseId || '18',
        // Single-stratum era: the Bible is pinned to the Latin Vulgate.
        // Dimension development is paused, not cancelled (see docs/ROADMAP.md).
        translation: 'VUL',
        cousinMode,
        locale: params.get('lang') || null
      };
    },
    formatLabel: ({ level, locale, namesMap }) => makeBibleLabelFormatter({ level, locale, namesMap }),
    buildChain: (manifest, options, namesMap) => buildBibleChain(manifest, options, namesMap),
    createHandlers: makeAdapterHandlers('bible')
  },
  catalog: {
    id: 'catalog',
    paths: ['/catalog'],
    manifestPath: './data/mmdm/catalog-lite.json',
    // Shown by other volumes' top-ring OUT button as the place a gateway
    // return lands (Howell ruling 2026-07-17).
    gatewayReturnLabel: 'MMdM CATALOGO',
    theme: 'catalog',
    palette: {
      bg: '#868686',
      node: '#f1b800',
      text: '#000000',
      band: '#7a7979',
      accent: '#f1b800',
      magnifierStroke: '#000000'
    },
    stampLetter: 'M', // the factory stamp's data line (W-7)
    // The "instrument arrives" line-drawing reveal (C.4) plays HERE only —
    // the Bible boots into its strata funnel instead and wants a reveal of
    // its own before it opts back in (Howell 2026-07-30).
    bootSplash: true,
    extractRoot: manifest => manifest?.MMdM,
    async loadSupplemental() { return { translationsMeta: null }; },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      const level = params.get('level') || startup.top_navigation_level || 'manufacturer';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-flat';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        // The boot reveal's overture (data-declared): the item the splash
        // DRAWS at before its rotation beat glides the ring home to
        // initialItemId. Volumes without the key boot the classic reveal.
        splashOvertureItem: startup.splash_overture_item || null,
        locale: params.get('lang') || null,
        cousinMode: arrangement !== 'siblings-only'
      };
    },
    formatLabel: () => ({ item, context }) => {
      if (!item) return '';
      const name = item.name || item.id || '';
      // Cylinder items: number only in nodes, "N CIL" in magnifier
      if (item.level === 'cylinder' || (item.id && (item.id.startsWith('cyl:') || item.id.startsWith('cylinder:')))) {
        const num = name.replace(/[^0-9]/g, '') || name;
        return context === 'magnifier' ? `${num} CIL` : num;
      }
      return name;
    },
    buildChain: (manifest, options) => buildCatalogManufacturers(manifest, { initialItemId: options.initialItemId, dataStampLetters: ['M', 'B', 'C'] }),
    createHandlers: makeAdapterHandlers('catalog'),
    // Search (the navigator's dividers) exists only here: this volume's
    // model namespace is flat and arbitrary — the index beats the walk.
    // Structured volumes (scripture's ordered books, the calendar's dates)
    // are already optimally served by the wheel itself (Howell 2026-07-22).
    hasSearch: true
  },
  calendar: {
    id: 'calendar',
    paths: ['/calendar'],
    manifestPath: './data/calendar/manifest.json',
    theme: 'calendar',
    palette: {
      bg: '#0c2c44',
      node: '#443300',
      text: '#f5f7fb',
      band: '#194567',
      accent: '#f5f7fb',
      magnifierStroke: '#f5f7fb'
    },
    centerLabel: true,
    stampLetter: 'C', // the factory stamp's data line (W-7)
    extractRoot: manifest => manifest?.Calendar,
    async loadSupplemental() { return { translationsMeta: null }; },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      // Default entry is the MONTHS ring on the current month (Howell
      // 2026-07-19) — gateway transits arrive with level=root, which is
      // "the volume's front door", not a level request. ?level=year still
      // boots the years ring explicitly. The manifest's
      // top_navigation_level states what the TOP of the hierarchy is
      // (years) — it does not pick the front door, so it is deliberately
      // not consulted here.
      const rawLevel = params.get('level');
      const level = (rawLevel && rawLevel !== 'root') ? rawLevel : 'month';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-with-gaps';
      const cousinParam = params.get('cousins');
      const cousinMode = cousinParam === null ? arrangement !== 'siblings-only' : cousinParam === '1';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        locale: params.get('lang') || null,
        cousinMode
      };
    },
    formatLabel: ({ locale }) => makeCalendarLabelFormatter({ locale }),
    // A calendar must see the future — and it boots on today, not on a
    // hardcoded date that goes stale. Default entry: the months ring with
    // the CURRENT month magnified; ?level=year gives the years ring.
    buildChain: (manifest, options) => {
      if (options.level === 'year') {
        return buildCalendarYears(manifest, {
          arrangement: options.arrangement,
          initialItemId: options.initialItemId || String(new Date().getFullYear())
        });
      }
      const now = new Date();
      const monthEntries = Object.entries(manifest?.Calendar?.month_template || {})
        .sort((a, b) => (a[1]?.month_number || 0) - (b[1]?.month_number || 0));
      const monthKey = monthEntries[now.getMonth()]?.[0];
      return buildCalendarMonthsCousinChain(manifest, {
        initialItemId: options.initialItemId || `${now.getFullYear()}:${monthKey}`
      });
    },
    createHandlers: makeAdapterHandlers('calendar')
  },
  places: {
    id: 'places',
    paths: ['/places'],
    manifestPath: './data/places/manifest.json',
    theme: 'places',
    palette: {
      bg: '#132a29',
      node: '#e2b46c',
      text: '#f4f1e9',
      band: '#1f413f',
      accent: '#e2b46c',
      magnifierStroke: '#f4f1e9'
    },
    extractRoot: manifest => manifest?.Places,
    async loadSupplemental() { return { translationsMeta: null }; },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      const level = params.get('level') || startup.top_navigation_level || null;
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-flat';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        locale: params.get('lang') || null,
        cousinMode: arrangement !== 'siblings-only'
      };
    },
    formatLabel: () => ({ item }) => item?.name || item?.id || '',
    buildChain: (manifest, options) => buildPlacesChain(manifest, options),
    createHandlers: makeAdapterHandlers('places')
  }
};

function makeBibleLabelFormatter({ level, locale, namesMap }) {
  // THE ENGINE HOLDS NO HUMAN LANGUAGE (Howell ruled 2026-07-28; finished
  // 2026-07-30). A nine-language VOCAB table lived here — the words for
  // "chapter" and "verse" and the era marks — so every tongue imported beyond
  // those nine silently fell out onto English ("Chapter 3" under a German
  // shelf). Wilbur's registry now carries `vocabulary` per language, and it is
  // the ONLY source: a new language is spoken correctly the moment its data
  // lands, with no engine patch behind it.
  //
  // LIVE locale (W-16): the names table carries the reader's current language,
  // so the vocabulary and the numeral system below follow a language switch
  // instead of freezing at the boot value.
  const loc = () => namesMap?.locale || locale;
  // No word, no substitute — NEVER another language's. A tongue whose registry
  // entry lacks a word simply shows the bare numeral, which is the form Howell
  // already ruled sufficient (2026-07-20: chapters are Roman, verses Arabic,
  // "the numeral system itself says which is which, so neither wears a word").
  // Honest, language-neutral, and it cannot leak English into a German shelf.
  const t = key => namesMap?.vocabulary?.[key] ?? '';

  // ── Numeral converters ───────────────────────────────────────────────────────
  const toRoman = n => toRomanNumeral(n);
  const toHebrew = n => {
    if (!Number.isFinite(n) || n <= 0 || n > 1200) return String(n);
    const ones    = ['','\u05d0','\u05d1','\u05d2','\u05d3','\u05d4','\u05d5','\u05d6','\u05d7','\u05d8'];
    const tens    = ['','\u05d9','\u05db','\u05dc','\u05de','\u05e0','\u05e1','\u05e2','\u05e4','\u05e6'];
    const hundreds= ['','\u05e7','\u05e8','\u05e9','\u05ea','\u05ea\u05e7','\u05ea\u05e8','\u05ea\u05e9','\u05ea\u05ea','\u05ea\u05ea\u05e7'];
    let r = '', rem = n;
    if (rem >= 1000) { r += ones[Math.floor(rem / 1000)] + '\u05f3'; rem %= 1000; }
    if (rem >= 100)  { r += hundreds[Math.floor(rem / 100)]; rem %= 100; }
    if (rem === 15)  { r += '\u05d8\u05d5'; }
    else if (rem === 16) { r += '\u05d8\u05d6'; }
    else { if (rem >= 10) { r += tens[Math.floor(rem / 10)]; rem %= 10; } if (rem) r += ones[rem]; }
    return r;
  };
  const toGreek = n => {
    if (!Number.isFinite(n) || n <= 0 || n > 999) return String(n);
    const ones  = ['','\u03b1','\u03b2','\u03b3','\u03b4','\u03b5','\u03db','\u03b6','\u03b7','\u03b8'];
    const tns   = ['','\u03b9','\u03ba','\u03bb','\u03bc','\u03bd','\u03be','\u03bf','\u03c0','\u03df'];
    const hunds = ['','\u03c1','\u03c3','\u03c4','\u03c5','\u03c6','\u03c7','\u03c8','\u03c9','\u03e1'];
    const h = Math.floor(n / 100), ten = Math.floor((n % 100) / 10), o = n % 10;
    return (hunds[h] + tns[ten] + ones[o]) + '\u02b9';
  };
  const toNumeral = n => {
    if (!Number.isFinite(n)) return '';
    const l = loc();
    if (l === 'latin')  return toRoman(n);
    if (l === 'greek')  return toGreek(n);
    if (l === 'hebrew') return toHebrew(n);
    return String(n);
  };

  const getYearNumber = item => {
    if (Number.isFinite(item?.yearNumber)) return item.yearNumber;
    const parsed = Number.parseInt(item?.id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const formatChapter = ({ item, context }) => {
    const chapterVal = item?.chapter ?? (() => {
      const asNumber = Number.parseInt(item?.name, 10);
      if (Number.isFinite(asNumber)) return asNumber;
      return item?.name;
    })();
    const n = Number(chapterVal);
    const numStr = Number.isFinite(n) ? toNumeral(n) : String(chapterVal ?? item?.id ?? '');
    if (context === 'node') return numStr;
    return `${t('chapter')} ${numStr}`.trim();  // no word ⇒ the bare numeral
  };
  const formatVerse = ({ item, context }) => {
    const extract = () => {
      if (item?.verse !== undefined) return item.verse;
      if (typeof item?.name === 'string' && item.name.includes(':')) {
        const parts = item.name.split(':');
        return parts[parts.length - 1];
      }
      return item?.name;
    };
    const verseVal = extract();
    const n = Number(verseVal);
    const numStr = Number.isFinite(n) ? toNumeral(n) : String(verseVal ?? item?.id ?? '');
    if (context === 'node') return numStr;
    return `${t('verse')} ${numStr}`.trim();  // no word ⇒ the bare numeral
  };
  return ({ item, context }) => {
    if (!item) return '';
    // Read the table INSIDE the closure (W-16): hoisting this out captured
    // the boot language's books and no live update could reach it.
    const bookNames = namesMap?.books || namesMap;
    const yearNumber = getYearNumber(item);
    if (Number.isFinite(yearNumber)) {
      if (context === 'node') return String(Math.abs(yearNumber));
      const era = yearNumber < 0 ? t('bc') : t('ad');
      return `${Math.abs(yearNumber)} ${era}`;
    }
    // Route by item.level first so the formatter works correctly when the focus
    // ring transitions between book → chapter → verse levels at runtime.
    const itemLevel = item?.level || level;
    if (itemLevel === 'chapter') return formatChapter({ item, context });
    if (itemLevel === 'verse') return formatVerse({ item, context });
    const localizedBook = bookNames?.[item.id];
    return localizedBook || item.name || item.id || '';
  };
}

function makeCalendarLabelFormatter({ locale }) {
  // Era rule (Howell, 2026-07-17): AD years are bare numbers everywhere —
  // "most people refer to any AD year simply by its number". The BC suffix
  // appears only across the line, making the era crossing legible at any
  // scrub speed.
  const translations = { english: { bc: 'BC' } };
  const t = key => translations[locale]?.[key] || translations.english[key] || key;
  const getYearNumber = item => {
    if (Number.isFinite(item?.yearNumber)) return item.yearNumber;
    const parsed = Number.parseInt(item?.id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const formatYear = yearNumber => (
    yearNumber < 0 ? `${Math.abs(yearNumber)} ${t('bc')}` : String(yearNumber)
  );
  return ({ item, context }) => {
    if (!item) return '';
    // Month items: nodes carry the month name alone; the magnifier appends
    // the year — on the continuous months chain every January looks alike.
    if (item.level === 'month') {
      const name = item?.name || item?.id || '';
      const y = Number.isFinite(item?.yearNumber) ? item.yearNumber : Number.parseInt(item?.parentId, 10);
      if (context === 'magnifier' && Number.isFinite(y)) return `${name} ${formatYear(y)}`;
      return name;
    }
    // Only year items get era formatting — composed ids ("2026:jan") would
    // otherwise fool the parseInt fallback.
    if (item.level && item.level !== 'year') return item?.name || item?.id || '';
    const yearNumber = getYearNumber(item);
    if (!Number.isFinite(yearNumber)) return item?.name || item?.id || '';
    return formatYear(yearNumber);
  };
}

function makeLabelFormatter({ config, volume, level, locale, namesMap, options, manifest, meta }) {
  const factory = config?.formatLabel || (() => ({ item }) => item?.name || item?.id || '');
  return factory({ volume, level, locale, namesMap, options, manifest, meta });
}

function buildBibleChain(manifest, options, namesMap) {
  // Gateway entry: BIBLIA SACRA LATINA alone on the ring, testaments in the pyramid.
  if (options.level === 'root') return buildBibleRootChain();
  const arrangement = options.arrangement;
  const initialItemId = options.initialItemId;
  if (options.cousinMode && (arrangement || 'cousins-with-gaps') !== 'siblings-only') {
    const level = options.level || 'book';
    if (level === 'chapter') {
      const bookId = options.bookId || 'MATHE';
      const chapterItems = getBibleChapters(manifest, { id: bookId }, namesMap, 'book');
      const targetKey = options.chapterId || '16';
      let chapterSelected = chapterItems.findIndex(ch => ch.meta?.chapterKey === targetKey);
      if (chapterSelected < 0) chapterSelected = 0;
      return { items: chapterItems, selectedIndex: chapterSelected, preserveOrder: true };
    }
    if (level === 'verse') {
      // THE WHOLE VOLUME RIDES THE RING FROM THE FIRST FRAME (2026-07-30).
      // Boot used to build its own verse ring with buildBibleVerseCousinChain,
      // which walked ONE book from the entry chapter to that book's end — so a
      // reader who booted at Matthew 16:18 could rotate no earlier than
      // Matthew 16:1 and no later than Matthew 28:20. Everything before the
      // current chapter and after the current book was unreachable until they
      // backed out and descended again, which silently rebuilt the ring with
      // the continuous chain. Now boot uses that same continuous chain, so the
      // ring is Genesis to Apocalypse from the start.
      // Two things fall out: it is SYNCHRONOUS (the old builder fetched every
      // chapter from the entry point to the end of the book before the first
      // paint — thirteen files to open at Matthew 16), and it bakes no verse
      // text, retiring the last site of the stale-language bug class (W-6).
      // Verse text arrives from the chapter cache and repaints on landing.
      const bookId = options.bookId || 'MATHE';
      const chapterId = options.chapterId || '16';
      const verseId = options.verseId || '1';
      return buildBibleVerseChain(manifest, {
        initialVerseId: `${bookId}_${chapterId}_${verseId}`
      });
    }
    const chain = buildBibleBookCousinChain(manifest, {
      testamentId: options.testamentId,
      bookId: options.bookId || 'GENE',
      initialItemId,
      names: namesMap
    });
    if (namesMap && typeof namesMap === 'object') {
      const bookNames = namesMap.books || namesMap;
      chain.items = chain.items.map(item => item ? { ...item, name: bookNames[item.id] || item.name } : item);
    }
    return chain;
  }
  const items = buildBibleBooks(manifest, namesMap)
    .sort((a, b) => {
      const as = a.sort || 0;
      const bs = b.sort || 0;
      if (as === bs) return (a.name || '').localeCompare(b.name || '');
      return as - bs;
    })
    .map((item, idx) => ({ ...item, order: idx }));
  const selectedIndex = (() => {
    if (initialItemId) {
      const idx = items.findIndex(item => item && (item.id === initialItemId));
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  return { items, selectedIndex, preserveOrder: false };
}

function buildPlacesChain(manifest, options) {
  const levels = getPlacesLevels(manifest);
  if (!levels.length) return { items: [], selectedIndex: 0, preserveOrder: true, meta: null };
  const startLevel = levels.includes(options.level) ? options.level : levels[0];
  const levelIndex = Math.max(0, levels.indexOf(startLevel));
  const { items, selectedIndex, preserveOrder } = buildPlacesLevel(manifest, levels, levelIndex, {
    selectedId: options.initialItemId || null
  });
  const selections = { [startLevel]: items[selectedIndex]?.id || options.initialItemId || null };
  return { items, selectedIndex, preserveOrder, meta: { levels, levelIndex, selections } };
}

// The probe's drop box (telemetry.php on the production host). Deployment
// layout is a literal like any other — it lives here, not in diagnostics.
const PROBE_SINK = {
  relative: '/mmdm/telemetry.php',
  absolute: 'https://howellgibbens.com/mmdm/telemetry.php',
  lan: '/probe-drop' // the LAN dev server writes these to files (2026-07-27)
};

export { adapterLoader, volumeConfigs, DEFAULT_VOLUME, makeLabelFormatter, PROBE_SINK };
