import { createApp, getViewportInfo, buildBibleVerseCousinChain, buildBibleBookCousinChain, validateVolumeRoot } from './index.js';
import { getPlacesLevels, buildPlacesLevel, buildCalendarYears, buildBibleBooks, buildCatalogManufacturers, getCatalogChildren, getCalendarMonths, getBibleChapters } from './adapters/volume-helpers.js';
import { createVolumeLayoutSpec } from './adapters/volume-layout.js';
import { createAdapterRegistry, createAdapterLoader } from './adapters/registry.js';
import { catalogAdapter } from './adapters/catalog-adapter.js';
import { bibleAdapter } from './adapters/bible-adapter.js';
import { calendarAdapter } from './adapters/calendar-adapter.js';
import { placesAdapter } from './adapters/places-adapter.js';
import { DetailPluginRegistry } from './view/detail/plugin-registry.js';
import { TextDetailPlugin } from './view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from './view/detail/plugins/card-plugin.js';

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
      const level = params.get('level') || startup.top_navigation_level || 'book';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-with-gaps';
      const cousinParam = params.get('cousins');
      const cousinMode = cousinParam === null ? arrangement !== 'siblings-only' : cousinParam === '1';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        bookId: params.get('book') || 'GENE',
        testamentId: params.get('testament'),
        chapterId: params.get('chapter'),
        translation: params.get('translation') || 'NAB',
        cousinMode,
        locale: params.get('lang') || null,
        dimensionEnabled: params.get('dimension') === '1'
      };
    },
    formatLabel: ({ level, locale, namesMap }) => makeBibleLabelFormatter({ level, locale, namesMap }),
    buildChain: (manifest, options, namesMap) => buildBibleChain(manifest, options, namesMap),
    createHandlers: params => {
      const adapter = adapterLoader.load('bible');
      return adapter?.createHandlers ? adapter.createHandlers(params) : { parentHandler: () => false, childrenHandler: () => false, secondary: { items: [], selectedIndex: 0 }, layoutBindings: {} };
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

async function loadConfig() {
  const params = new URLSearchParams(window.location.search);
  const path = (window.location.pathname || '').toLowerCase();
  const paramVolume = params.get('volume');
  const resolvedVolume = volumeConfigs[paramVolume]?.id || resolveVolumeFromPath(path) || DEFAULT_VOLUME;
  const config = volumeConfigs[resolvedVolume];
  const manifest = await fetch(config.manifestPath).then(r => r.json());
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
  const themeBackground = {
    catalog: '#868686',
    bible: '#d4a574',
    calendar: '#0c2c44',
    places: '#132a29'
  };
  const bg = themeBackground[theme] || '#f5f5f5';
  root.setAttribute('data-theme', theme);
  root.style.backgroundColor = bg;
  root.style.setProperty('--theme-color-bg', bg);
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
  const { visible, when } = e.detail || {};
  console.log('[detail-sector-change] visible:', visible, 'when:', when, 'panel classes before:', detailPanel.className);
  if (visible) {
    // Show after expand animation completes
    detailPanel.classList.add('detail-panel--visible');
  } else {
    // Hide immediately when collapsing
    detailPanel.classList.remove('detail-panel--visible');
  }
  console.log('[detail-sector-change] panel classes after:', detailPanel.className);
});

function renderDetail(selected, adapterInstance, manifest, adapterNormalized) {
  if (!detailPanel || !detailContent) return;
  while (detailContent.firstChild) detailContent.removeChild(detailContent.firstChild);
  if (!selected) return;
  const payload = adapterInstance?.detailFor
    ? adapterInstance.detailFor(selected, manifest, { normalized: adapterNormalized })
    : { type: 'text', text: selected.name || selected.id || '' };
  console.log('[renderDetail] selected:', selected?.id, 'level:', selected?.level, 'payload:', JSON.stringify(payload));
  if (!payload) return;
  const plugin = detailRegistry.getPlugin(payload);
  console.log('[renderDetail] plugin:', plugin?.getMetadata?.()?.name, 'has description:', !!payload?.description);
  if (!plugin) return;
  const bounds = detailPanel.getBoundingClientRect();
  const node = plugin.render(payload, { width: bounds.width, height: bounds.height }, { createElement: tag => document.createElement(tag) });
  if (node) {
    detailContent.appendChild(node);
    console.log('[renderDetail] appended node, childCount:', detailContent.childNodes.length, 'innerHTML length:', detailContent.innerHTML.length);
  }
}

function makeBibleLabelFormatter({ level, locale, namesMap }) {
  const translations = {
    english: { chapter: 'Chapter', verse: 'Verse', bc: 'B.C.', ad: 'A.D.' }
  };
  const t = key => translations[locale]?.[key] || translations.english[key] || key;
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
    if (context === 'node') return String(chapterVal ?? item?.id ?? '');
    return `${t('chapter')} ${chapterVal ?? item?.id ?? ''}`.trim();
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
    if (context === 'node') return String(verseVal ?? item?.id ?? '');
    return `${t('verse')} ${verseVal ?? item?.id ?? ''}`.trim();
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
    const localizedBook = bookNames?.[item.id];
    if (level === 'chapter') return formatChapter({ item, context });
    if (level === 'verse') return formatVerse({ item, context });
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
  const arrangement = options.arrangement;
  const initialItemId = options.initialItemId;
  if (options.cousinMode && (arrangement || 'cousins-with-gaps') !== 'siblings-only') {
    const level = options.level || 'book';
    if (level === 'verse') {
      return buildBibleVerseCousinChain(manifest, {
        bookId: options.bookId || 'GENE',
        startChapterId: options.chapterId || undefined,
        translation: options.translation || 'NAB'
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


function wireInteractions(app, itemCount) {
  let isDragging = false;
  let isSecondaryDragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  const isInteractionLocked = () => Boolean(app?.isBlurred?.());
  const hasSecondary = () => Boolean(app?.hasSecondary?.());
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
      let suppressNativeClickUntil = 0;
      }
    });
    return nearest;
  };

  const onPointerMove = event => {
    if (!isDragging && !isSecondaryDragging) return;
    if (isInteractionLocked() && !isSecondaryDragging) {
      isDragging = false;
      return;
    }
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
      dragging: isDragging,
      secondaryDragging: isSecondaryDragging
    });
    if (isSecondaryDragging) {
      app.rotateSecondary(delta);
    } else {
      app.choreographer.rotate(delta);
    }
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
    logTap('pointerdown', {
      pointerType: event.pointerType,
      targetClass: event.target?.getAttribute?.('class') || null,
      targetId: event.target?.getAttribute?.('id') || null,
      x: event.clientX,
      y: event.clientY
    });
    const isDimensionButton = event.target && event.target.closest && event.target.closest('.dimension-button');
    if (isDimensionButton) {
      return; // let the Dimension button handle its own toggle without starting a drag
    }
    const blurred = isInteractionLocked();
    if (blurred && hasSecondary()) {
      isSecondaryDragging = true;
      isDragging = false;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      app.beginSecondaryRotation();
      return;
    }
    if (blurred) {
      isDragging = false;
      app.choreographer.stopMomentum();
      return;
    }
    const isNode = event.target && event.target.closest && event.target.closest('.focus-ring-node');
    if (isNode) {
      isDragging = false;
      isSecondaryDragging = false;
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
      isSecondaryDragging = false;
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
        isSecondaryDragging = false;
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
            suppressNativeClickUntil = Date.now() + 450;

    isDragging = true;
    logTap('drag-start', { pointerType: event.pointerType });
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
  });

  svg.addEventListener('pointermove', onPointerMove);

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    svg.addEventListener(type, event => {
      if (isSecondaryDragging) {
        isSecondaryDragging = false;
        logTap(type, { pointerType: event?.pointerType, secondaryDragging: true, action: 'end-secondary' });
        if (app.endSecondaryRotation) app.endSecondaryRotation();
        return;
      }
      // v0 parity: only snap after real drags. For taps/clicks, let the
      // target node's click handler run without a competing snap animation.
      const wasDragging = isDragging;
      isDragging = false;
      logTap(type, {
        pointerType: event?.pointerType,
        wasDragging,
        locked: isInteractionLocked(),
        action: wasDragging ? 'snap-nearest' : 'tap-no-snap'
      });
      if (!wasDragging) return;
      if (isInteractionLocked()) return;
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

const translationsForLanguage = (translationsMeta, language) => {
  const translations = translationsMeta?.translations || {};
  const entries = Object.entries(translations)
    .filter(([, t]) => t?.language === language);
  if (!entries.length) return null;
  const both = entries.find(([, t]) => (t?.testament || '').toLowerCase() === 'both');
  if (both) return both[0];
  return entries[0][0];
};

function buildDimensionPortals(root) {
  const cfg = root?.display_config || {};
  const langs = cfg.languages || {};
  const edits = cfg.editions || {};
  const langIds = Array.isArray(langs.available) ? langs.available : [];
  if (!langIds.length || !edits.available) return null;
  const languageItems = langIds.map((id, idx) => ({
    id,
    name: langs.labels?.[id] || id,
    order: idx
  }));
  return {
    languages: {
      items: languageItems,
      labels: langs.labels || {},
      defaultId: langs.default || languageItems[0]?.id || null
    },
    editions: {
      available: edits.available || {},
      default: edits.default || {},
      labels: edits.labels || {}
    }
  };
}

loadConfig().then(async ({ volume, config, manifest, root, options, supplemental }) => {
  applyTheme(manifest, volume);
  const translationsMeta = supplemental?.translationsMeta || null;
  const fallbackTranslation = translationsForLanguage(translationsMeta, options?.locale || 'english') || 'NAB';
  const translationId = options.translation || fallbackTranslation;
  const translationLang = translationsMeta?.translations?.[translationId]?.language || options.locale || 'english';
  const resolvedLocale = options.locale || translationLang || 'english';
  const localeNames = translationsMeta?.names?.[translationLang] || {};
  const namesMap = {
    books: localeNames.books || localeNames,
    sections: localeNames.sections || {}
  };

  const chainResult = await config.buildChain(manifest, options, namesMap);
  const { items, selectedIndex = 0, preserveOrder = false, meta } = chainResult;
  const handlerSet = config.createHandlers({ manifest, namesMap, options, translationsMeta, chainMeta: chainResult });
  const secondary = handlerSet.secondary || { items: [], selectedIndex: 0 };
  if (!items.length) {
    console.error('No items found for volume', volume);
    return;
  }

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
    getApp: () => app,
    calendarModeRef: layoutBindings.calendarModeRef,
    setCalendarMode: layoutBindings.setCalendarMode,
    setCalendarMonthContext: layoutBindings.setCalendarMonthContext,
    bibleModeRef: layoutBindings.bibleModeRef,
    setBibleMode: layoutBindings.setBibleMode,
    setBibleChapterContext: layoutBindings.setBibleChapterContext,
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

  const onSelectSecondary = handlerSet.onSelectSecondary
    || (secondary?.items?.length
      ? translationId => {
          const url = new URL(window.location.href);
          const currentItem = app?.nav?.getCurrent?.();
          if (currentItem?.id) {
            url.searchParams.set('item', currentItem.id);
          }
          url.searchParams.set('translation', translationId);
          url.searchParams.set('dimension', '1');
          window.location.href = url.toString();
        }
      : undefined);

  const dimensionPortals = buildDimensionPortals(root);

  app = createApp({
    svgRoot: svg,
    items,
    viewport,
    selectedIndex,
    preserveOrder,
    labelFormatter,
    shouldCenterLabel,
    secondaryItems: secondary.items,
    secondarySelectedIndex: secondary.selectedIndex,
    contextOptions: { ...options, locale: resolvedLocale },
    onParentClick: parentHandler,
    getParentLabel: adapterGetParentLabel,
    pyramid: pyramidConfig,
    pyramidLayoutSpec: pyramidLayout,
    pyramidNormalized: adapterNormalized || normalized,
    pyramidAdapter: adapter,
    onSelectSecondary,
    dimensionPortals
  });
  // Expose app to window for console API
  window.app = app;
  if (options.dimensionEnabled && app?.setBlur) {
    app.setBlur(true);
  }
  renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized);
  app?.nav?.onChange?.(() => renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized));
  wireInteractions(app, items.length);
  showVersion();
}).catch(err => {
  console.error('Failed to initialize app', err);
});
