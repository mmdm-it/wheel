import { createApp, getViewportInfo, buildBibleVerseCousinChain, buildBibleBookCousinChain, validateVolumeRoot } from './index.js';
import { getPlacesLevels, buildPlacesLevel, buildCalendarYears, buildBibleBooks, buildCatalogManufacturers, getCatalogChildren, getCalendarMonths, getBibleChapters, toRomanNumeral } from './adapters/volume-helpers.js';
import { createVolumeLayoutSpec } from './adapters/volume-layout.js';
import { createAdapterRegistry, createAdapterLoader } from './adapters/registry.js';
import { catalogAdapter } from './adapters/catalog-adapter.js';
import { bibleAdapter, buildBibleRootChain } from './adapters/bible-adapter.js';
import { calendarAdapter } from './adapters/calendar-adapter.js';
import { placesAdapter } from './adapters/places-adapter.js';
import { DetailPluginRegistry } from './view/detail/plugin-registry.js';
import { TextDetailPlugin } from './view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from './view/detail/plugins/card-plugin.js';
import { computeDetailSectorBounds } from './geometry/detail-sector-geometry.js';

const svg = document.getElementById('app');
const viewport = getViewportInfo(window.innerWidth, window.innerHeight);
const tapDebugEnabled = new URLSearchParams(window.location.search).get('tapdebug') === '1';

if (tapDebugEnabled && typeof window !== 'undefined') {
  window.__tapLog = [];
  window.__tapDebugLog = (event, payload = {}) => {
    const row = {
      ts: new Date().toISOString(),
      event,
      ...payload
    };
    window.__tapLog.push(row);
    console.log('[tapdebug]', row);
  };
  window.__tapDebugDownload = () => {
    const text = JSON.stringify(window.__tapLog || [], null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `tapdebug-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
}

// Detect iframe zoom-out (e.g. GoDaddy "Forward with Masking" on mobile).
// Mobile browsers ignore the iframe's viewport meta tag, defaulting to a
// ~980 px layout viewport which is then scaled down to fit the screen.
// CSS clamp floors (in px) resolve pre-zoom, so fonts appear tiny.
// Multiply clamp min/max by this factor to compensate.
const _physSSd = Math.min(screen.width, screen.height);
const _cssSSd  = Math.min(window.innerWidth, window.innerHeight);
if (_physSSd > 0 && _cssSSd > _physSSd * 1.2) {
  document.documentElement.style.setProperty(
    '--iframe-scale', (_cssSSd / _physSSd).toFixed(3));
}
const adapterRegistry = createAdapterRegistry();
adapterRegistry.register('catalog', () => ({ ...catalogAdapter, volumeId: 'catalog' }));
adapterRegistry.register('bible', () => ({ ...bibleAdapter, volumeId: 'bible' }));
adapterRegistry.register('calendar', () => ({ ...calendarAdapter, volumeId: 'calendar' }));
adapterRegistry.register('places', () => ({ ...placesAdapter, volumeId: 'places' }));
const adapterLoader = createAdapterLoader(adapterRegistry);

const DEFAULT_VOLUME = 'catalog';
const volumeConfigs = {
  bible: {
    id: 'bible',
    paths: ['/bible'],
    manifestPath: './data/gutenberg/manifest.json',
    theme: 'bible',
    extractRoot: manifest => manifest?.Gutenberg_Bible,
    async loadSupplemental() {
      const translationsMeta = await fetch('./data/gutenberg/translations.json').then(r => r.json()).catch(() => null);
      return { translationsMeta };
    },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      const level = params.get('level') || startup.top_navigation_level || 'verse';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-with-gaps';
      const cousinParam = params.get('cousins');
      const cousinMode = cousinParam === null ? arrangement !== 'siblings-only' : cousinParam === '1';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        bookId: params.get('book') || 'MATHE',
        testamentId: params.get('testament'),
        chapterId: params.get('chapter') || '16',
        verseId: params.get('verse') || '18',
        // Single-stratum era: the Bible is pinned to the Latin Vulgate.
        // Dimension development is paused, not cancelled (see docs/ROADMAP.md).
        translation: 'VUL',
        cousinMode,
        locale: params.get('lang') || null
      };
    },
    formatLabel: ({ level, locale, namesMap }) => makeBibleLabelFormatter({ level, locale, namesMap }),
    buildChain: (manifest, options, namesMap) => buildBibleChain(manifest, options, namesMap),
    createHandlers: params => {
      const adapter = adapterLoader.load('bible');
      return adapter?.createHandlers ? adapter.createHandlers(params) : { parentHandler: () => false, childrenHandler: () => false, layoutBindings: {} };
    }
  },
  catalog: {
    id: 'catalog',
    paths: ['/catalog'],
    manifestPath: './data/mmdm/mmdm_catalog.json',
    theme: 'catalog',
    extractRoot: manifest => manifest?.MMdM,
    async loadSupplemental() { return { translationsMeta: null }; },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      const level = params.get('level') || startup.top_navigation_level || 'manufacturer';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-flat';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
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
    buildChain: (manifest, options) => buildCatalogManufacturers(manifest, { initialItemId: options.initialItemId }),
    createHandlers: params => {
      const adapter = adapterLoader.load('catalog');
      return adapter?.createHandlers ? adapter.createHandlers(params) : { parentHandler: () => false, childrenHandler: () => false, layoutBindings: {} };
    }
  },
  calendar: {
    id: 'calendar',
    paths: ['/calendar'],
    manifestPath: './data/calendar/manifest.json',
    theme: 'calendar',
    centerLabel: true,
    extractRoot: manifest => manifest?.Calendar,
    async loadSupplemental() { return { translationsMeta: null }; },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      const level = params.get('level') || startup.top_navigation_level || 'year';
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
    buildChain: (manifest, options) => buildCalendarYears(manifest, { arrangement: options.arrangement, initialItemId: options.initialItemId }),
    createHandlers: params => {
      const adapter = adapterLoader.load('calendar');
      return adapter?.createHandlers ? adapter.createHandlers(params) : { parentHandler: () => false, childrenHandler: () => false, layoutBindings: {} };
    }
  },
  places: {
    id: 'places',
    paths: ['/places'],
    manifestPath: './data/places/manifest.json',
    theme: 'places',
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
    createHandlers: params => {
      const adapter = adapterLoader.load('places');
      return adapter?.createHandlers ? adapter.createHandlers(params) : { parentHandler: () => false, childrenHandler: () => false, layoutBindings: {} };
    }
  }
};

function resolveVolumeFromPath(path) {
  const lower = (path || '').toLowerCase();
  const match = Object.values(volumeConfigs).find(cfg => cfg.paths?.some(p => lower.includes(p)));
  return match?.id || null;
}

async function loadConfig(volumeOverride = null, searchOverride = null) {
  const params = new URLSearchParams(searchOverride ?? window.location.search);
  const path = (window.location.pathname || '').toLowerCase();
  const paramVolume = params.get('volume');
  const resolvedVolume = volumeConfigs[volumeOverride]?.id || volumeConfigs[paramVolume]?.id || resolveVolumeFromPath(path) || DEFAULT_VOLUME;
  const config = volumeConfigs[resolvedVolume];
  const manifest = await fetch(config.manifestPath).then(r => {
    if (!r.ok) throw new Error(`manifest missing for volume "${config.id}" (${config.manifestPath}: HTTP ${r.status})`);
    return r.json();
  });
  const root = config.extractRoot(manifest);
  const validation = validateVolumeRoot(root);
  if (!validation.ok) {
    console.error('[wheel] volume validation failed', { errors: validation.errors, warnings: validation.warnings });
    throw new Error('Invalid volume manifest');
  }
  const startup = root?.display_config?.focus_ring_startup || {};
  const arrangements = root?.display_config?.focus_ring_arrangements || {};
  const supplemental = await config.loadSupplemental(root, manifest, params);
  const debugFlag = params.get('debug') === '1' || localStorage.getItem('wheel-debug') === '1';
  const options = {
    ...config.buildOptions({ params, startup, arrangements }),
    debug: debugFlag
  };
  return { volume: resolvedVolume, config, manifest, root, options, supplemental };
}

function applyTheme(manifest, volume) {
  const theme = volumeConfigs[volume]?.theme || volume;
  const root = document.documentElement;
  const palette = {
    catalog: {
      bg: '#868686',
      node: '#f1b800',
      text: '#000000',
      band: '#7a7979',
      accent: '#f1b800',
      magnifierStroke: '#000000'
    },
    bible: {
      bg: '#d4a574',
      node: '#8b5a2b',
      text: '#2a1a0f',
      band: '#8a6a49',
      accent: '#8b5a2b',
      magnifierStroke: '#2a1a0f'
    },
    calendar: {
      bg: '#0c2c44',
      node: '#443300',
      text: '#f5f7fb',
      band: '#194567',
      accent: '#f5f7fb',
      magnifierStroke: '#f5f7fb'
    },
    places: {
      bg: '#132a29',
      node: '#e2b46c',
      text: '#f4f1e9',
      band: '#1f413f',
      accent: '#e2b46c',
      magnifierStroke: '#f4f1e9'
    }
  };
  const active = palette[theme] || {
    bg: '#f5f5f5',
    node: '#555555',
    text: '#111111',
    band: '#7a7979',
    accent: '#1f6feb',
    magnifierStroke: '#000000'
  };
  const bg = active.bg;
  root.setAttribute('data-theme', theme);
  root.style.backgroundColor = bg;
  // Set ALL theme CSS variables inline so the first render has correct
  // colors even before the async volume stylesheet finishes loading.
  root.style.setProperty('--theme-color-bg', bg);
  root.style.setProperty('--theme-color-node', active.node);
  root.style.setProperty('--theme-color-text', active.text);
  root.style.setProperty('--theme-color-band', active.band);
  root.style.setProperty('--theme-color-accent', active.accent);
  root.style.setProperty('--theme-color-magnifier-stroke', active.magnifierStroke);
  if (document.body) {
    document.body.style.backgroundColor = bg;
  }
  if (svg) {
    svg.style.backgroundColor = bg;
  }
  const link = document.getElementById('volume-style');
  if (link) {
    link.setAttribute('href', `./styles/themes/${theme}.css`);
  }
}

const detailRegistry = new DetailPluginRegistry();
detailRegistry.register(new TextDetailPlugin());
detailRegistry.register(new CardDetailPlugin());
const detailPanel = document.getElementById('detail-panel');
const detailContent = document.getElementById('detail-content');

// Toggle detail panel visibility in sync with the Detail Sector animation.
// The panel fades in after the blue circle has finished expanding,
// and hides immediately when the circle begins collapsing.
window.addEventListener('detail-sector-change', (e) => {
  if (!detailPanel) return;
  const { visible } = e.detail || {};
  if (visible) {
    detailPanel.classList.add('detail-panel--visible');
  } else {
    detailPanel.classList.remove('detail-panel--visible');
  }
});

function renderDetail(selected, adapterInstance, manifest, adapterNormalized, { translation } = {}) {
  if (!detailPanel || !detailContent) return;
  while (detailContent.firstChild) detailContent.removeChild(detailContent.firstChild);
  if (!selected) return;

  const payload = adapterInstance?.detailFor
    ? adapterInstance.detailFor(selected, manifest, { normalized: adapterNormalized, translation })
    : { type: 'text', text: selected.name || selected.id || '' };
  if (!payload) return;

  const plugin = detailRegistry.getPlugin(payload);
  if (!plugin) return;

  // Build arc-aware bounds (DSUA — full area, no logo exclusion).
  // The logo moves to the centre as a watermark when the circle expands,
  // so its collapsed upper-right position does not restrict detail text.
  const arcBounds = computeDetailSectorBounds(window.innerWidth, window.innerHeight);
  const panelRect = detailPanel.getBoundingClientRect();
  const renderBounds = { ...arcBounds, width: panelRect.width, height: panelRect.height };


  const node = plugin.render(payload, renderBounds, { createElement: tag => document.createElement(tag) });
  if (node) detailContent.appendChild(node);
}

function makeBibleLabelFormatter({ level, locale, namesMap }) {
  // ── Vocabulary table (9 languages) ──────────────────────────────────────────
  const VOCAB = {
    latin:      { chapter: 'Capitulum',  verse: 'Versus',    bc: 'a.C.n.',      ad: 'p.C.n.'       },
    greek:      { chapter: '\u039a\u03b5\u03c6\u03ac\u03bb\u03b1\u03b9\u03bf\u03bd', verse: '\u03a3\u03c4\u03af\u03c7\u03bf\u03c2',   bc: '\u03c0.\u03a7.',        ad: '\u03bc.\u03a7.'          },
    hebrew:     { chapter: '\u05e4\u05bc\u05b6\u05bc\u05e8\u05b6\u05e7',     verse: '\u05e4\u05b8\u05bc\u05e1\u05d5\u05bc\u05e7',   bc: '\u05dc\u05e4\u05e0\u05d4"\u05e1', ad: '\u05dc\u05e1\u05e4\u05d4"\u05e0'  },
    french:     { chapter: 'Chapitre',   verse: 'Verset',    bc: 'av. J.-C.',   ad: 'ap. J.-C.'    },
    spanish:    { chapter: 'Cap\u00edtulo',  verse: 'Vers\u00edculo', bc: 'a.C.',       ad: 'd.C.'         },
    english:    { chapter: 'Chapter',    verse: 'Verse',     bc: 'B.C.',        ad: 'A.D.'         },
    italian:    { chapter: 'Capitolo',   verse: 'Versetto',  bc: 'a.C.',        ad: 'd.C.'         },
    portuguese: { chapter: 'Cap\u00edtulo',  verse: 'Vers\u00edculo', bc: 'a.C.',       ad: 'd.C.'         },
    russian:    { chapter: '\u0413\u043b\u0430\u0432\u0430',      verse: '\u0421\u0442\u0438\u0445',      bc: '\u0434\u043e \u043d.\u044d.',    ad: '\u043d.\u044d.'          }
  };
  const t = key => VOCAB[locale]?.[key] ?? VOCAB.english[key] ?? key;

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
    if (locale === 'latin')  return toRoman(n);
    if (locale === 'greek')  return toGreek(n);
    if (locale === 'hebrew') return toHebrew(n);
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
    return `${t('chapter')} ${numStr}`.trim();
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
    return `${t('verse')} ${numStr}`.trim();
  };
  const bookNames = namesMap?.books || namesMap;
  return ({ item, context }) => {
    if (!item) return '';
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
  const translations = { english: { bc: 'B.C.', ad: 'A.D.' } };
  const t = key => translations[locale]?.[key] || translations.english[key] || key;
  const getYearNumber = item => {
    if (Number.isFinite(item?.yearNumber)) return item.yearNumber;
    const parsed = Number.parseInt(item?.id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return ({ item, context }) => {
    if (!item) return '';
    const yearNumber = getYearNumber(item);
    if (!Number.isFinite(yearNumber)) return item?.name || item?.id || '';
    if (context === 'node') return String(Math.abs(yearNumber));
    const era = yearNumber < 0 ? t('bc') : t('ad');
    return `${Math.abs(yearNumber)} ${era}`;
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
      return buildBibleVerseCousinChain(manifest, {
        bookId: options.bookId || 'MATHE',
        startChapterId: options.chapterId || undefined,
        translation: options.translation || 'VUL'
      }).then(chain => {
        const verseId = options.verseId;
        if (verseId && chain.items.length) {
          const idx = chain.items.findIndex(item => item && item.verse === String(verseId));
          if (idx >= 0) chain.selectedIndex = idx;
        }
        return chain;
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


function wireInteractions(getApp) {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let suppressNativeClickUntil = 0;
  const sensitivity = Math.PI / 4 / 100; // 100px → 45°
  const velocityThreshold = 0.4; // px/ms below this → no gain
  const gainSlope = 1.1; // linear slope past threshold
  const baseQuickNodes = 60; // empirical baseline nodes per quick swipe at gain 1
  const targetSpinNodes = 350; // fixed quick-flick span for consistency across devices
  const baseMaxGain = Math.max(1, targetSpinNodes / baseQuickNodes);
  const logTap = (event, payload = {}) => {
    if (typeof window !== 'undefined' && typeof window.__tapDebugLog === 'function') {
      window.__tapDebugLog(event, payload);
    }
  };

  const nearestRingNode = event => {
    if (!svg || typeof svg.createSVGPoint !== 'function') return null;
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return null;

    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const p = pt.matrixTransform(ctm.inverse());

    const nodes = svg.querySelectorAll('.focus-ring-node');
    let nearest = null;
    let nearestDist = Infinity;
    nodes.forEach(node => {
      const cx = Number(node.getAttribute('cx'));
      const cy = Number(node.getAttribute('cy'));
      const r = Number(node.getAttribute('r')) || 0;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy);
      const threshold = Math.max(r * 4, 36);
      if (dist <= threshold && dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    });
    return nearest;
  };

  const onPointerMove = event => {
    if (!isDragging) return;
    const app = getApp();
    if (!app) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const dt = event.timeStamp - lastTime;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;

    const distance = Math.abs(dx) + Math.abs(dy);
    const velocity = dt > 0 ? distance / dt : 0;
    const maxGain = baseMaxGain;
    const gain = velocity <= velocityThreshold
      ? 1
      : Math.min(maxGain, 1 + (velocity - velocityThreshold) * gainSlope);

    const delta = -(dx + dy) * sensitivity * gain;
    logTap('pointermove', {
      pointerType: event.pointerType,
      dx,
      dy,
      dt,
      velocity: Number(velocity.toFixed(3)),
      gain: Number(gain.toFixed(3)),
      dragging: isDragging
    });
    app.choreographer.rotate(delta);
  };

  // When touch pointerdown manually dispatches a node onclick, suppress the
  // browser's delayed native click so the same node doesn't rotate twice.
  svg.addEventListener('click', event => {
    const now = Date.now();
    if (now < suppressNativeClickUntil) {
      logTap('native-click-suppressed', {
        targetClass: event.target?.getAttribute?.('class') || null,
        targetId: event.target?.getAttribute?.('id') || null
      });
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  svg.addEventListener('pointerdown', event => {
    const app = getApp();
    if (!app) return;
    logTap('pointerdown', {
      pointerType: event.pointerType,
      targetClass: event.target?.getAttribute?.('class') || null,
      targetId: event.target?.getAttribute?.('id') || null,
      x: event.clientX,
      y: event.clientY
    });
    const isNode = event.target && event.target.closest && event.target.closest('.focus-ring-node');
    if (isNode) {
      isDragging = false;
      logTap('node-hit', {
        pointerType: event.pointerType,
        nodeIndex: isNode.dataset?.index ?? null,
        nodeId: isNode.getAttribute?.('id') || null
      });
      // Touch reliability: trigger immediately on pointerdown instead of
      // waiting for delayed/sometimes-missed synthetic click on tiny targets.
      if ((event.pointerType === 'touch' || event.pointerType === 'pen') && typeof isNode.onclick === 'function') {
        isNode.onclick();
        logTap('node-hit-manual-onclick', {
          pointerType: event.pointerType,
          nodeIndex: isNode.dataset?.index ?? null
        });
        event.preventDefault();
      }
      return; // click handler on node will manage rotation
    }

    // Parent/magnifier controls: don't start drag and don't near-miss redirect.
    // Let their native click handlers run.
    const isControlTarget = event.target && event.target.closest && event.target.closest('.focus-ring-magnifier-circle, .focus-ring-magnifier-label');
    if (isControlTarget) {
      isDragging = false;
      logTap('control-hit', {
        pointerType: event.pointerType,
        targetClass: event.target?.getAttribute?.('class') || null,
        targetId: event.target?.getAttribute?.('id') || null
      });
      return;
    }
    suppressNativeClickUntil = Date.now() + 450;
    // Child pyramid node — delegate to the app's pyramid click handler
    const isPyramidNode = event.target && event.target.closest && event.target.closest('.child-pyramid-node');
    if (isPyramidNode) {
      const attrIndex = isPyramidNode.getAttribute && isPyramidNode.getAttribute('data-index');
      const rawIndex = isPyramidNode.dataset?.index ?? attrIndex;
      const idx = Number.parseInt(rawIndex, 10);
      logTap('pyramid-hit', { pointerType: event.pointerType, nodeIndex: Number.isFinite(idx) ? idx : null, rawIndex: rawIndex ?? null });
      if (Number.isFinite(idx)) {
        if (app.handlePyramidNodeClick) {
          app.handlePyramidNodeClick(idx);
        }
        return; // don't start drag
      }
      // No valid index on this pyramid-shaped target (e.g. transient clone).
      // Fall through to near-miss ring targeting instead of swallowing the tap.
      logTap('pyramid-hit-no-index-fallback', { pointerType: event.pointerType });
    }

    // Touch near-miss support: if the tap lands close to a tiny ring node,
    // trigger its click handler instead of starting a drag.
    const isBackgroundLikeTarget = (
      event.target === svg
      || (event.target && event.target.closest && event.target.closest('.focus-ring-band'))
      || Boolean(isPyramidNode)
    );
    if ((event.pointerType === 'touch' || event.pointerType === 'pen') && isBackgroundLikeTarget) {
      const nearby = nearestRingNode(event);
      if (nearby && typeof nearby.onclick === 'function') {
        isDragging = false;
        logTap('near-miss-manual-onclick', {
          pointerType: event.pointerType,
          nodeIndex: nearby.dataset?.index ?? null,
          nodeId: nearby.getAttribute?.('id') || null
        });
        nearby.onclick();
        event.preventDefault();
        return;
      }
    }

    isDragging = true;
    logTap('drag-start', { pointerType: event.pointerType });
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
  });

  svg.addEventListener('pointermove', onPointerMove);

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    svg.addEventListener(type, event => {
      // v0 parity: only snap after real drags. For taps/clicks, let the
      // target node's click handler run without a competing snap animation.
      const app = getApp();
      if (!app) return;
      const wasDragging = isDragging;
      isDragging = false;
      logTap(type, {
        pointerType: event?.pointerType,
        wasDragging,
        action: wasDragging ? 'snap-nearest' : 'tap-no-snap'
      });
      if (!wasDragging) return;
      app.selectNearest();
      app.choreographer.stopMomentum();
    });
  });
}

async function showVersion() {
  const badge = document.getElementById('version-badge');
  if (!badge) return;
  try {
    const pkg = await fetch('./package.json').then(r => r.json());
    const name = pkg?.name || 'wheel';
    const version = pkg?.version ? `v${pkg.version}` : 'v?';
    badge.textContent = `${name} ${version}`;
  } catch (err) {
    console.warn('Version load failed', err);
    badge.textContent = 'version unavailable';
  }
}

let currentApp = null;
let currentVolumeId = null;
let gatewayReturnContext = null;
let interactionsWired = false;

function gatewayLabelFromItemId(itemId) {
  if (typeof itemId !== 'string') return '';
  const segments = itemId.split('__');
  return (segments[segments.length - 1] || '').toUpperCase();
}

// Data-declared door into another volume: boot it in-app, remembering the
// way back. The browser URL gains a history entry so Back exits the door.
function showBootError(message) {
  // Minimal visible error surface: the console-only failures of the past
  // left black screens (Phase B audit, H4/M1).
  const el = document.getElementById('detail-content');
  if (el) el.textContent = message;
  console.error('[wheel]', message);
}

function launchGateway(gateway) {
  if (!gateway?.volume || !volumeConfigs[gateway.volume]) {
    console.warn('[wheel] gateway names unknown volume', gateway?.volume);
    return;
  }
  const returnContext = { volume: currentVolumeId, itemId: gateway.returnItemId || null };
  const search = `?volume=${encodeURIComponent(gateway.volume)}&level=root`;
  // Boot first; only a successful boot earns the history entry (H4).
  bootVolume(gateway.volume, search, returnContext)
    .then(() => {
      try {
        window.history.pushState({ wheelGateway: true, gatewayReturn: returnContext }, '', search);
      } catch (err) { /* history unavailable (e.g. file://) */ }
    })
    .catch(err => showBootError(`gateway boot failed: ${err.message}`));
}

function returnThroughGateway() {
  const ctx = gatewayReturnContext;
  if (!ctx?.volume || !volumeConfigs[ctx.volume]) return false;
  const params = new URLSearchParams();
  params.set('volume', ctx.volume);
  if (ctx.itemId) params.set('item', ctx.itemId);
  const search = `?${params.toString()}`;
  bootVolume(ctx.volume, search, null)
    .then(() => {
      try { window.history.pushState({ wheelGateway: true }, '', search); } catch (err) { /* ignore */ }
    })
    .catch(err => showBootError(`gateway return failed: ${err.message}`));
  return true;
}

// Browser Back across a gateway pushState: reload resolves the URL cleanly.
window.addEventListener('popstate', () => window.location.reload());

// M4: history.state survives reloads — a refresh inside a gateway volume
// restores its way back instead of stranding the visitor.
function restoredGatewayReturn() {
  try {
    const st = window.history.state;
    if (st?.gatewayReturn?.volume && volumeConfigs[st.gatewayReturn.volume]) return st.gatewayReturn;
  } catch (err) { /* history unavailable */ }
  return null;
}

async function bootVolume(volumeOverride = null, searchOverride = null, gatewayReturn = null) {
  const { volume, config, manifest, root, options, supplemental } = await loadConfig(volumeOverride, searchOverride);
  const translationsMeta = supplemental?.translationsMeta || null;
  const translationId = options.translation || null;
  const translationLang = translationsMeta?.translations?.[translationId]?.language || options.locale || 'english';
  const resolvedLocale = options.locale || translationLang || 'english';
  const localeNames = translationsMeta?.names?.[translationLang] || {};
  const namesMap = {
    books: localeNames.books || localeNames,
    sections: localeNames.sections || {},
    testaments: localeNames.testaments || {}
  };

  const translationName = translationsMeta?.translations?.[translationId]?.name || translationId;

  const chainResult = await config.buildChain(manifest, options, namesMap);
  const { items, selectedIndex = 0, preserveOrder = false, meta } = chainResult;
  const handlerSet = config.createHandlers({
    manifest,
    namesMap,
    options,
    translationsMeta,
    chainMeta: chainResult,
    translationName,
    onGatewayReturn: returnThroughGateway,
    gatewayLabel: gatewayReturn ? gatewayLabelFromItemId(gatewayReturn.itemId) : ''
  });
  if (!items.length) throw new Error(`no items found for volume "${volume}"`);

  // ── Point of no return ── the new volume built successfully; only now
  // tear down the previous instance (Phase B audit, M1: a late failure
  // above leaves the old volume intact instead of a black screen).
  // Teardown any previous volume instance — gateway reboots reuse the SVG.
  // Clear only the detail CONTENT: #detail-panel's inner skeleton
  // (#detail-content, #version-badge) is owned by index.html and must survive.
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const detailContentEl = document.getElementById('detail-content');
  if (detailContentEl) detailContentEl.innerHTML = '';
  const detailPanelEl = document.getElementById('detail-panel');
  if (detailPanelEl) detailPanelEl.classList.remove('detail-panel--visible');
  currentApp = null;
  currentVolumeId = volume;
  gatewayReturnContext = gatewayReturn;
  applyTheme(manifest, volume);

  const adapter = adapterLoader.load(volume);
  let adapterNormalized = null;
  let adapterLayoutSpec = null;
  if (adapter) {
    try {
      adapterNormalized = adapter.normalize(manifest);
      adapterLayoutSpec = adapter.layoutSpec(adapterNormalized, viewport);
      // Attach manifest to adapter for logo configuration
      adapter.manifest = manifest;
    } catch (err) {
      console.warn('[wheel] adapter layoutSpec failed, falling back to host config', err);
      adapterNormalized = null;
      adapterLayoutSpec = null;
    }
  }

  const configLabel = makeLabelFormatter({ config, volume, level: options.level, locale: resolvedLocale, namesMap, options, manifest, meta });
  const adapterLabel = adapterLayoutSpec?.label;
  // Prefer the config's formatter when it is context-aware (receives { item, context }),
  // otherwise fall back to the adapter's plain label, then the config formatter.
  const configIsContextAware = config?.formatLabel?.length === 0; // zero-arg factory returns (item, context) => ...
  const labelFormatter = configIsContextAware
    ? configLabel
    : adapterLabel
      ? ({ item }) => adapterLabel(item)
      : configLabel;
  const shouldCenterLabel = handlerSet.shouldCenterLabel || (({ item } = {}) => {
    if (Boolean(config?.centerLabel)) return true;
    // Cylinder items (short numeric labels) should always be centered
    if (item?.level === 'cylinder') return true;
    return false;
  });
  let app;

  const parentHandler = params => (handlerSet.parentHandler ? handlerSet.parentHandler({ ...params, app }) : false);
  const childrenHandler = params => (handlerSet.childrenHandler ? handlerSet.childrenHandler({ ...params, app }) : false);
  const adapterGetParentLabel = typeof handlerSet.getParentLabel === 'function' ? handlerSet.getParentLabel : null;

  const layoutBindings = handlerSet.layoutBindings || {};
  const layoutSpec = createVolumeLayoutSpec({
    volume,
    manifest,
    namesMap,
    placesState: layoutBindings.placesState,
    buildPlacesLevel,
    placesChildrenHandler: layoutBindings.placesChildrenHandler,
    getCatalogChildren: layoutBindings.getCatalogChildren || ((m, selected) => getCatalogChildren(manifest, selected)),
    getCalendarMonths: layoutBindings.getCalendarMonths || ((m, selected, mode) => getCalendarMonths(manifest, selected, mode)),
    getBibleChapters: layoutBindings.getBibleChapters || ((m, selected, nm, mode) => getBibleChapters(manifest, selected, nm, mode)),
    getBibleVerseItems: layoutBindings.getBibleVerseItems,
    prefetchBibleVerses: layoutBindings.prefetchBibleVerses,
    getBibleBooksForTestament: layoutBindings.getBibleBooksForTestament,
    getBibleTestaments: layoutBindings.getBibleTestaments,
    getApp: () => app,
    launchGateway,
    calendarModeRef: layoutBindings.calendarModeRef,
    setCalendarMode: layoutBindings.setCalendarMode,
    setCalendarMonthContext: layoutBindings.setCalendarMonthContext,
    bibleModeRef: layoutBindings.bibleModeRef,
    setBibleMode: layoutBindings.setBibleMode,
    setBibleChapterContext: layoutBindings.setBibleChapterContext,
    setBibleVerseContext: layoutBindings.setBibleVerseContext,
    catalogModeRef: layoutBindings.catalogModeRef,
    setCatalogMode: layoutBindings.setCatalogMode,
    savePreInState: layoutBindings.savePreInState,
    pyramidBuilder: layoutBindings.pyramidBuilder
  });
  const pyramidConfig = {
    ...(layoutSpec?.pyramid || {}),
    ...(adapterLayoutSpec?.pyramid || {})
  };
  const pyramidLayout = adapterLayoutSpec || layoutSpec;
  const normalized = {
    items,
    links: (items || [])
      .filter(item => item?.parentId)
      .map(item => ({ from: item.parentId, to: item.id })),
    meta: { volumeId: volume }
  };

  app = createApp({
    svgRoot: svg,
    items,
    viewport,
    selectedIndex,
    preserveOrder,
    labelFormatter,
    shouldCenterLabel,
    contextOptions: { ...options, locale: resolvedLocale },
    onParentClick: parentHandler,
    getParentLabel: adapterGetParentLabel,
    pyramid: pyramidConfig,
    pyramidLayoutSpec: pyramidLayout,
    pyramidNormalized: adapterNormalized || normalized,
    pyramidAdapter: adapter
  });
  currentApp = app;
  // Expose app to window for console API
  window.app = app;
  renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: translationId });
  app?.nav?.onChange?.(() => renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: translationId }));
  // Generic post-boot hook: adapters may schedule volume-specific startup
  // work (e.g. the Bible's featured-verse prefetch) without the host
  // carrying volume literals (Phase B audit, H1).
  if (typeof handlerSet.onBoot === 'function') {
    handlerSet.onBoot({
      app,
      items,
      selectedIndex,
      renderDetail: item => renderDetail(item, adapter, manifest, adapterNormalized, { translation: translationId })
    });
  }
  if (!interactionsWired) {
    wireInteractions(() => currentApp);
    interactionsWired = true;
  }
  showVersion();

}

bootVolume(null, null, restoredGatewayReturn()).catch(err => {
  showBootError(`Failed to initialize app: ${err.message}`);
});
