import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildCalendarYears, buildCalendarMillennia, getCalendarMonths } from './volume-helpers.js';
import { buildCalendarPyramid } from '../pyramid/volume-pyramid.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/calendar/manifest.json';
const schemaUrl = './schemas/calendar.schema.json';

let manifestPath = null;
let schemaPath = null;
let nodeReadFile = null;
let nodeReadFileSync = null;
let AjvCtor = null;

if (!isBrowser) {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  manifestPath = path.resolve(__dirname, '../../data/calendar/manifest.json');
  schemaPath = path.resolve(__dirname, '../../schemas/calendar.schema.json');
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
  const volumeName = volumeData?.display_config?.volume_name || volumeKey || 'calendar';
  addItem({ id: rootId, name: volumeName, level: 'root', parentId: null, order: 0 });

  const millennia = volumeData.millennia || {};
  Object.entries(millennia).forEach(([milliId, milli], idx) => {
    const order = Number.isFinite(milli?.sort_number) ? milli.sort_number : idx;
    addItem({ id: milliId, name: milli?.name || milliId, level: 'millennium', parentId: rootId, order });
  });

  const years = volumeData.years || {};
  Object.entries(years).forEach(([yearId, year], idx) => {
    const parentId = year.millennium_id || year.millenniumId || null;
    const order = Number.isFinite(year?.sort_number) ? year.sort_number : (Number.isFinite(year?.year_number) ? year.year_number : idx);
    addItem({
      id: yearId,
      name: year?.name || year?.year_display || String(year?.year_number ?? yearId),
      level: 'year',
      parentId: parentId || rootId,
      order,
      meta: { yearNumber: year?.year_number ?? null }
    });

    const months = year?.months || {};
    Object.entries(months).forEach(([monthKey, monthVal], monthIdx) => {
      const monthId = monthVal?.id || `${yearId}:${monthKey}`;
      const monthOrder = Number.isFinite(monthVal?.sort_number) ? monthVal.sort_number : monthIdx;
      addItem({
        id: monthId,
        name: monthVal?.name || monthKey,
        level: 'month',
        parentId: yearId,
        order: monthOrder,
        meta: { monthNumber: monthVal?.month_number ?? null, yearId }
      });
    });
  });

  items.sort((a, b) => {
    if (a.level === b.level) {
      if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
      return a.order - b.order;
    }
    const levelOrder = ['root', 'millennium', 'year', 'month'];
    return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
  });
  items.forEach((item, idx) => { item.order = idx; });

  return {
    items,
    links,
    meta: {
      volumeId: volumeKey,
      leafLevel: 'month',
      levels: ['millennium', 'year', 'month'],
      colors: levelPalette
    }
  };
}

export function layoutSpec(normalized, viewport) {
  const levels = normalized?.meta?.levels || ['millennium', 'year', 'month'];
  const vp = viewport?.width && viewport?.height ? viewport : getViewportInfo(1280, 720);
  const pyramidCapacity = calculatePyramidCapacity(vp);
  const palette = normalized?.meta?.colors || {
    millennium: '#5d3fd3',
    year: '#b8860b',
    month: '#556b2f'
  };
  return {
    rings: levels.map((lvl, idx) => ({ id: lvl, order: idx })),
    label: item => item?.name ?? '',
    colorByLevel: level => palette[level] || '#666',
    pyramid: {
      capacity: pyramidCapacity,
      sample: siblings => sampleSiblings(siblings, pyramidCapacity.total),
      place: siblings => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity })
    }
  };
}

function findYear(manifest, yearId) {
  const years = manifest?.Calendar?.years || {};
  return years[yearId] || Object.values(years).find(y => String(y?.id || '') === String(yearId)) || null;
}

function findMonth(manifest, monthId) {
  const years = manifest?.Calendar?.years || {};
  for (const year of Object.values(years)) {
    const months = year?.months || {};
    for (const val of Object.values(months)) {
      const id = val?.id || '';
      if (id && id === monthId) return { month: val, year };
      const composed = `${year?.id || ''}:${val?.id || ''}`;
      if (monthId && composed === monthId) return { month: val, year };
    }
  }
  return null;
}

export function detailFor(selected, manifest) {
  if (!selected) return null;
  const id = selected.id || '';
  const calendar = manifest?.Calendar || {};

  if (selected.level === 'millennium' || id.startsWith('millennium')) {
    const milli = calendar.millennia?.[id];
    const span = [milli?.start_year, milli?.end_year].filter(v => v !== undefined && v !== null);
    const subtitle = span.length === 2 ? `${span[0]} – ${span[1]}` : null;
    return {
      type: 'card',
      title: milli?.name || selected.name || id,
      body: subtitle || 'Millennium overview'
    };
  }

  if (selected.level === 'year') {
    const yearEntry = findYear(manifest, id) || {};
    const yearNumber = yearEntry.year_number ?? selected.meta?.yearNumber ?? null;
    const era = Number.isFinite(yearNumber) ? (yearNumber < 0 ? 'B.C.' : 'A.D.') : '';
    const label = Number.isFinite(yearNumber) ? `${Math.abs(yearNumber)} ${era}`.trim() : (yearEntry.name || selected.name || id);
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

export function createHandlers({ manifest, options }) {
  let calendarMode = 'year';
  let calendarMonthContext = null;
  const lastYearByMillennium = {};

  const parentHandler = ({ selected, app }) => {
    if (calendarMode === 'month') {
      const yearId = calendarMonthContext?.yearId;
      const milliId = calendarMonthContext?.millenniumId;
      const { items: yearItems, selectedIndex: yearSelected } = buildCalendarYears(manifest, {
        arrangement: options?.arrangement,
        initialItemId: yearId,
        filterMillenniumId: milliId
      });
      calendarMode = 'year';
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true, showInner: true });
      if (app?.setPrimaryItems) app.setPrimaryItems(yearItems, yearSelected, true);
      return true;
    }
    if (calendarMode !== 'year') return false;
    const millenniumId = selected?.parentId || selected?.parent_id || null;
    if (millenniumId && selected?.id) {
      lastYearByMillennium[millenniumId] = selected.id;
    }
    const { items: milliItems, selectedIndex: milliSelected } = buildCalendarMillennia(manifest, { initialItemId: millenniumId });
    calendarMode = 'millennium';
    if (app?.setParentButtons) app.setParentButtons({ showOuter: false, showInner: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(milliItems, milliSelected, true);
    return true;
  };

  const childrenHandler = ({ selected, app }) => {
    if (calendarMode === 'year') {
      const months = getCalendarMonths(manifest, selected, calendarMode);
      if (!months.length) return false;
      calendarMode = 'month';
      calendarMonthContext = {
        yearId: selected?.id || null,
        millenniumId: selected?.parentId || selected?.parent_id || null
      };
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true, showInner: true });
      if (app?.setPrimaryItems) app.setPrimaryItems(months, 0, true);
      return true;
    }
    if (calendarMode !== 'millennium') return false;
    const millenniumId = selected?.id;
    if (!millenniumId) return true;
    const preferredYear = lastYearByMillennium[millenniumId];
    const { items: yearItems, selectedIndex: yearSelected } = buildCalendarYears(manifest, {
      arrangement: options?.arrangement,
      initialItemId: preferredYear,
      filterMillenniumId: millenniumId
    });
    calendarMode = 'year';
    if (app?.setParentButtons) app.setParentButtons({ showOuter: true, showInner: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(yearItems, yearSelected, true);
    return true;
  };

  return {
    parentHandler,
    childrenHandler,
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
