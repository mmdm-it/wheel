import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildCalendarYears, getCalendarMonths } from './volume-helpers.js';
import { buildCalendarPyramid } from '../pyramid/volume-pyramid.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/calendar/manifest.json';
const schemaUrl = './schemas/calendar.schema.json';

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
    manifestPath = path.resolve(__dirname, '../../data/calendar/manifest.json');
    schemaPath = path.resolve(__dirname, '../../schemas/calendar.schema.json');
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
  const displayConfig = volumeData.display_config || {};
  const dimensions = {
    languages: displayConfig.languages || null,
    editions: displayConfig.editions || null
  };

  const hierarchyLevels = volumeData?.display_config?.hierarchy_levels || {};
  Object.entries(hierarchyLevels).forEach(([level, cfg]) => {
    if (cfg?.color) levelPalette[level] = cfg.color;
  });

  const addItem = ({ id, name, level, parentId = null, order = 0, meta = {} }) => {
    items.push({ id, name, level, parentId, order, meta });
    if (parentId) links.push({ from: parentId, to: id });
  };

  const rootId = `volume:${volumeKey}`;
  const volumeName = volumeData?.display_config?.volume_name || volumeKey || 'calendar';
  addItem({ id: rootId, name: volumeName, level: 'root', parentId: null, order: 0 });

  // Years are the top level (millennia removed 2026-07-17). Months live in
  // month_template and are synthesized per year on demand — normalize carries
  // year items only; leaf behavior comes from meta.leafLevel.
  const years = volumeData.years || {};
  Object.entries(years).forEach(([yearId, year], idx) => {
    const order = Number.isFinite(year?.sort_number) ? year.sort_number : (Number.isFinite(year?.year_number) ? year.year_number : idx);
    addItem({
      id: yearId,
      name: year?.name || year?.year_display || String(year?.year_number ?? yearId),
      level: 'year',
      parentId: rootId,
      order,
      meta: { yearNumber: year?.year_number ?? null }
    });
  });

  items.sort((a, b) => {
    if (a.level === b.level) {
      if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
      return a.order - b.order;
    }
    const levelOrder = ['root', 'year', 'month'];
    return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
  });
  items.forEach((item, idx) => { item.order = idx; });

  return {
    items,
    links,
    meta: {
      volumeId: volumeKey,
      leafLevel: 'month',
      levels: ['year', 'month'],
      colors: levelPalette,
      dimensions
    }
  };
}

export function layoutSpec(normalized, viewport) {
  const levels = normalized?.meta?.levels || ['year', 'month'];
  const vp = viewport?.width && viewport?.height ? viewport : getViewportInfo(1280, 720);
  const pyramidCapacity = calculatePyramidCapacity(vp);
  const palette = normalized?.meta?.colors || {
    year: '#b8860b',
    month: '#556b2f'
  };
  return {
    rings: levels.map((lvl, idx) => ({ id: lvl, order: idx })),
    label: item => item?.name ?? '',
    colorByLevel: level => palette[level] || '#666',
    pyramid: {
      capacity: pyramidCapacity,
      place: (siblings, viewport, opts) => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity, logoBounds: opts?.logoBounds })
    },
  };
}

function findYear(manifest, yearId) {
  const years = manifest?.Calendar?.years || {};
  return years[yearId] || Object.values(years).find(y => String(y?.id || '') === String(yearId)) || null;
}

function findMonth(manifest, monthId) {
  // Month ids are composed "yearId:monthKey" (months synthesized from the
  // shared template — the yearId prefix is what makes them unique).
  if (!monthId || typeof monthId !== 'string') return null;
  const sep = monthId.lastIndexOf(':');
  if (sep < 1) return null;
  const yearId = monthId.slice(0, sep);
  const monthKey = monthId.slice(sep + 1);
  const year = findYear(manifest, yearId);
  if (!year) return null;
  const month = (year.months || manifest?.Calendar?.month_template || {})[monthKey];
  return month ? { month, year } : null;
}

export function detailFor(selected, manifest) {
  if (!selected) return null;
  const id = selected.id || '';

  if (selected.level === 'year') {
    const yearEntry = findYear(manifest, id) || {};
    const yearNumber = yearEntry.year_number ?? selected.meta?.yearNumber ?? null;
    // Era rule: bare number for AD, "BC" suffix only across the line.
    const label = Number.isFinite(yearNumber)
      ? (yearNumber < 0 ? `${Math.abs(yearNumber)} BC` : String(yearNumber))
      : (yearEntry.name || selected.name || id);
    return {
      type: 'card',
      title: label,
      body: yearEntry.year_display || 'Year overview'
    };
  }

  const monthLookup = findMonth(manifest, id);
  if (monthLookup) {
    const { month, year } = monthLookup;
    const yearLabel = year?.year_display || year?.name || year?.id || '';
    const monthName = month?.name || selected.name || id;
    return {
      type: 'card',
      title: monthName,
      body: yearLabel ? `${yearLabel}` : 'Month overview'
    };
  }

  return { type: 'text', text: selected.name || id || '' };
}

export function createHandlers({ manifest, options, onGatewayReturn = null, gatewayLabel = '' }) {
  // Two modes only: years are the top level (millennia removed 2026-07-17 —
  // centuries/millennia are cousin-gap texture in the year chain, not a
  // parent). Backing out from years exits through the gateway, if any.
  let calendarMode = 'year';
  let calendarMonthContext = null;

  const parentHandler = ({ app }) => {
    if (calendarMode === 'month') {
      const yearId = calendarMonthContext?.yearId;
      const { items: yearItems, selectedIndex: yearSelected } = buildCalendarYears(manifest, {
        arrangement: options?.arrangement,
        initialItemId: yearId
      });
      calendarMode = 'year';
      if (app?.setParentButtons) app.setParentButtons({ showOuter: Boolean(gatewayLabel) });
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(yearItems, yearSelected, true);
      }
      return true;
    }
    if (typeof onGatewayReturn === 'function') return Boolean(onGatewayReturn());
    return false;
  };

  const childrenHandler = ({ selected, app }) => {
    if (calendarMode !== 'year') return false;
    const months = getCalendarMonths(manifest, selected, calendarMode);
    if (!months.length) return false;
    calendarMode = 'month';
    calendarMonthContext = { yearId: selected?.id || null };
    if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(months, 0, true);
    return true;
  };

  // Boot lands on the year ring — the top. The outer button only exists when
  // there is a gateway above us to return through.
  const onBoot = ({ app }) => {
    if (app?.setParentButtons) app.setParentButtons({ showOuter: Boolean(gatewayLabel) });
  };

  return {
    parentHandler,
    childrenHandler,
    onBoot,
    shouldCenterLabel: () => true,
    layoutBindings: {
      calendarModeRef: () => calendarMode,
      setCalendarMode: next => { calendarMode = next; },
      setCalendarMonthContext: ctx => { calendarMonthContext = ctx; },
      getCalendarMonths: (m, selected, mode) => getCalendarMonths(m, selected, mode || calendarMode),
      pyramidBuilder: buildCalendarPyramid
    }
  };
}

export const calendarAdapter = {
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
