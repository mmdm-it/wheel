import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildCalendarYears, buildCalendarMonthsCousinChain, buildCalendarDaysCousinChain, getCalendarMonths,
  getCalendarWeekdayNames, getCalendarWeekdayLetters } from './volume-helpers.js';
import { dayOfWeek } from '../geometry/day-grid.js';
import { localSunTimes } from '../geometry/solar.js';
import { buildCalendarPyramid } from '../pyramid/volume-pyramid.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/calendar/manifest.json';
const schemaUrl = './schemas/calendar.schema.json';

// THE STATION (Howell 2026-07-20, docs/DETAIL_SECTOR_LOADS.md): Fano (PU),
// permanently — the printed legend is the doctrine. Sun times are COMPUTED
// for the whole chain; tides/moon/feasts come from the extracted wall
// calendar (the print edition is the source of truth), bounded to its
// window — outside it the card simply shows less, never invents.
const FANO = { lat: 43.8433, lon: 13.0172, zoneSince: 1893 };
const ephemerisUrl = './data/calendar/ephemeris-2026.json';
const MOON_PRINT = { nuova: 'LUNA NUOVA', primo: 'PRIMO QUARTO', piena: 'LUNA PIENA', ultima: 'ULTIMA QUARTO' };

let ephemerisDays = null;
let ephemerisFetch = null;
// Test seam (and future node path): inject an ephemeris table directly.
export function primeEphemeris(days) { ephemerisDays = days || null; }
function loadEphemeris() {
  if (!isBrowser || ephemerisFetch) return ephemerisFetch;
  ephemerisFetch = fetch(ephemerisUrl)
    .then(r => (r.ok ? r.json() : null))
    .then(json => { ephemerisDays = json?.days || null; })
    .catch(() => { ephemerisDays = null; });
  return ephemerisFetch;
}

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
      // Days claim the leaf (Howell 2026-07-20): a date settling into the
      // magnifier opens the detail sector by itself — this one field is
      // what the host reads to decide that. Months in the ring still get
      // no sector; they get the wedge.
      leafLevel: 'day',
      levels: ['year', 'month', 'day'],
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

  // A DATE in the magnifier (Howell 2026-07-20). The weekday to begin
  // with; the printed wall calendar's sunrise, sunset and tide tables for
  // Fano are where this panel is headed, which is exactly why the sector
  // updates on SETTLE only and never mid-scrub.
  if (selected.level === 'day') {
    const parts = /^d:(-?\d+):(\d+):(\d+)$/.exec(id);
    const yearNumber = Number.isFinite(selected.yearNumber) ? selected.yearNumber : Number(parts?.[1]);
    const monthNumber = Number.isFinite(selected.monthNumber) ? selected.monthNumber : Number(parts?.[2]);
    const dayNumber = Number.isFinite(selected.dayNumber) ? selected.dayNumber : Number(parts?.[3]);
    if (![yearNumber, monthNumber, dayNumber].every(Number.isFinite)) return null;
    const weekday = getCalendarWeekdayNames(manifest)[dayOfWeek(yearNumber, monthNumber, dayNumber)] || '';
    if (!weekday) return null;

    // The wall calendar's day cell, as a card (docs/DETAIL_SECTOR_LOADS.md).
    // NO date — the magnifier already says it (Howell: no redundancy).
    // Sun computed for any date on the chain; tides/moon/festivo only
    // inside the extracted print window.
    const rows = [];
    const sun = localSunTimes(yearNumber, monthNumber, dayNumber, FANO.lat, FANO.lon, FANO.zoneSince);
    if (sun) rows.push(`↑ ${sun.alba}    ↓ ${sun.tramonto}`);
    const key = `${yearNumber}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const eph = ephemerisDays?.[key];
    if (eph) {
      const h = v => Number(v).toFixed(1).replace('.', ',');
      rows.push(`▲ ${eph.alta[0]}  ${h(eph.alta[1])} m`);
      rows.push(`▽ ${eph.bassa[0]}  ${h(eph.bassa[1])} m`);
      if (eph.luna && MOON_PRINT[eph.luna]) rows.push(MOON_PRINT[eph.luna]);
    }
    return {
      type: 'ephemeris',
      title: weekday.toUpperCase(),
      titleAlign: 'center',
      festivo: Boolean(eph?.festivo),
      rows
    };
  }

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

export function createHandlers({ manifest, options, onGatewayReturn = null, gatewayLabel = '', gatewayReturnLabel = '' }) {
  // Years are the top level (millennia removed 2026-07-17 — centuries/
  // millennia are cousin-gap texture in the year chain, not a parent);
  // backing out from years exits through the gateway, if any. The DEFAULT
  // BOOT lands one level down: the months ring on the current month
  // (Howell 2026-07-19), so the handlers must start in the ring the chain
  // builder actually delivered.
  let calendarMode = options?.level === 'year' ? 'year' : 'month';
  let calendarMonthContext = null;

  // The ~86k-link months chain is identical on every entry; build it once
  // per handler set and only re-locate the entry month.
  let monthChainItems = null;
  const monthChain = initialItemId => {
    if (!monthChainItems) {
      monthChainItems = buildCalendarMonthsCousinChain(manifest, {}).items;
    }
    let selectedIndex = 0;
    if (initialItemId) {
      const idx = monthChainItems.findIndex(item => item && item.id === initialItemId);
      if (idx >= 0) selectedIndex = idx;
    }
    return { items: monthChainItems, selectedIndex };
  };

  // The day chain is a ±5-year window around the tapped day (thumb
  // doctrine) — rebuilt only when the center moves, reused across the
  // renders of one visit.
  let dayChainCache = null;
  const getCalendarDayChain = centerId => {
    if (!dayChainCache || dayChainCache.centerId !== centerId) {
      const chain = buildCalendarDaysCousinChain(manifest, { centerId });
      dayChainCache = chain ? { centerId, chain } : null;
    }
    return dayChainCache?.chain ?? null;
  };

  const parentHandler = ({ selected, app }) => {
    if (calendarMode === 'day') {
      // Ascend day ring -> months ring, landing on the magnified day's month.
      const { items: monthItems } = monthChain(null);
      let idx = 0;
      if (Number.isFinite(selected?.yearNumber) && Number.isFinite(selected?.monthNumber)) {
        const found = monthItems.findIndex(it => it
          && it.yearNumber === selected.yearNumber
          && it.monthNumber === selected.monthNumber);
        if (found >= 0) idx = found;
      }
      calendarMode = 'month';
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(monthItems, idx, true);
      }
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return true;
    }
    if (calendarMode === 'month') {
      // The months ring is the whole timeline — the user may have scrubbed
      // far from the year they entered at. Land on the CURRENT month's year;
      // the entry context is only a fallback.
      const yearId = selected?.parentId || calendarMonthContext?.yearId || null;
      const { items: yearItems, selectedIndex: yearSelected } = buildCalendarYears(manifest, {
        arrangement: options?.arrangement,
        initialItemId: yearId
      });
      calendarMode = 'year';
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(yearItems, yearSelected, true);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: Boolean(gatewayReturnLabel) });
      return true;
    }
    if (typeof onGatewayReturn === 'function') return Boolean(onGatewayReturn());
    return false;
  };

  // Parent-button labels (Howell rulings 2026-07-17): months in the ring
  // show the magnified month's YEAR, live-updating as the ring rotates —
  // the same contract as countries over manufacturers. Years in the ring
  // show the gateway-return destination (e.g. the catalog's display name)
  // when there is one, nothing when standalone.
  const getParentLabel = item => {
    if (calendarMode === 'day') {
      if (!item) return '';
      const y = item.yearNumber;
      if (!Number.isFinite(y) || !item.monthName) return '';
      const yearLabel = y < 0 ? `${Math.abs(y)} BC` : String(y);
      return `${String(item.monthName).toUpperCase()} ${yearLabel}`;
    }
    if (calendarMode !== 'month') return gatewayReturnLabel || '';
    if (!item) return '';
    const y = Number.isFinite(item.yearNumber) ? item.yearNumber : Number.parseInt(item.parentId, 10);
    if (!Number.isFinite(y)) return '';
    return y < 0 ? `${Math.abs(y)} BC` : String(y);
  };

  const childrenHandler = ({ selected, app }) => {
    if (calendarMode !== 'year') return false;
    if (!selected?.id) return false;
    // Months mode is the continuous cousin chain (every year's months, year
    // crossings as cousins) entered at January of the chosen year.
    const firstMonthId = getCalendarMonths(manifest, selected, calendarMode)[0]?.id || null;
    const { items: monthItems, selectedIndex } = monthChain(firstMonthId);
    if (!monthItems.length) return false;
    calendarMode = 'month';
    calendarMonthContext = { yearId: selected.id };
    if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(monthItems, selectedIndex, true);
    return true;
  };

  // Boot lands on the year ring — the top. Through a gateway, the parent
  // button names the return destination; standalone there is nothing above,
  // so no button.
  const onBoot = ({ app, renderDetail }) => {
    // Warm the ephemeris table (tides/moon/feasts from the wall calendar)
    // so the day card has it long before any leaf settles. If a slow fetch
    // loses that race, repaint the settled day when the table lands —
    // otherwise a sun-only card sits stale until the user scrubs
    // (Phase C audit L1).
    loadEphemeris()?.then(() => {
      const settled = app?.nav?.getCurrent?.();
      if (settled?.level === 'day' && typeof renderDetail === 'function') renderDetail(settled);
    });
    // Months mode always has an OUT (up to the years ring); the years ring
    // only when a gateway waits behind it.
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: calendarMode === 'month' || Boolean(gatewayReturnLabel) });
    }
  };

  return {
    parentHandler,
    childrenHandler,
    onBoot,
    getParentLabel,
    // Years stay centered on their nodes (numerals); MONTHS align like
    // manufacturers — magnifier centered, ring labels right-aligned
    // (Howell 2026-07-19).
    shouldCenterLabel: ({ item } = {}) => item?.level !== 'month',
    layoutBindings: {
      calendarModeRef: () => calendarMode,
      getCalendarMonthChain: monthId => monthChain(monthId),
      getCalendarDayChain,
      getWeekdayLetters: () => getCalendarWeekdayLetters(manifest),
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
    theming: true,
    // At the leaf the detail sector doubles as a NEXT button
    // (a date leads to the next date).
    detailTapAdvances: true
  }
};
