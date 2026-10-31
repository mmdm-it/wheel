import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, sampleSiblings, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildCalendarYears, buildCalendarMonthsCousinChain, buildCalendarDaysCousinChain, getCalendarMonths,
  getCalendarWeekdayNames, getCalendarWeekdayLetters, buildCalendarDecades, buildCalendarCenturies,
  getCalendarCenturyDecades, getCalendarDecadeYears, yearNumbersForSystem } from './volume-helpers.js';
import { daySerial, serialToDate } from '../geometry/day-grid.js';
import { SYSTEMS, GREGORIAN, systemOf, systemIdOf, todaySerial } from './calendar-systems.js';
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

  // Years are the top level OF THE DATA (millennia removed 2026-07-17); the
  // decades and centuries above them are computed by the ring builders
  // (O-242), as the months are below. Months live in
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
      // The calendar's sky keeps ONE size for its lesser stars: the ring
      // node's own. The two sizes of star (O-199) were ruled looking at
      // the Bible's ranked skies; a year's twelve months at 60% read too
      // small (Howell 2026-10-23, two photographs: "the node labels in the
      // child pyramid have gotten smaller. This is incorrect. The old
      // version has the right size"). The standout keeps the large size.
      smallStarScale: 1,
      // A SKY OF EQUALS (O-240, Howell 2026-10-29): every month of the
      // year, January to December, one size — no featured node, no subset.
      // The calendar diverges from the Bible's ranked, capped skies here.
      equalSky: true,
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
    // THE DAY IS A SERIAL (O-245): whatever calendar named it, the sun and
    // the tides are looked up by the real day — its date in the historical
    // reckoning. A link without a serial (an old-style id) is read as one.
    const parts = /^d:(-?\d+):(\d+):(\d+)$/.exec(id);
    const serial = Number.isFinite(selected.serial)
      ? selected.serial
      : (parts ? daySerial(Number(parts[1]), Number(parts[2]), Number(parts[3])) : NaN);
    if (!Number.isFinite(serial)) return null;
    const civil = serialToDate(serial);
    const yearNumber = civil.yearNumber;
    const monthNumber = civil.month;
    const dayNumber = civil.day;
    // The weekday in the day's own calendar (Hebrew names for a Hebrew day,
    // O-248) — by the day's own week, where the calendar counts its rows
    // otherwise (the French décade, O-251).
    const daySystem = systemOf(systemIdOf(id));
    const dow = typeof daySystem.weekdayOf === 'function' ? daySystem.weekdayOf(serial) : ((serial + 4) % 7 + 7) % 7;
    // A count with no week heads the card otherwise (the Tzolk'in day, O-252).
    const weekday = (typeof daySystem.dayTitle === 'function' && daySystem.dayTitle(serial))
      || (daySystem.id !== GREGORIAN && daySystem.weekdays?.[dow]) || getCalendarWeekdayNames(manifest)[dow] || '';
    if (!weekday) return null;

    // The wall calendar's day cell, as a card (docs/DETAIL_SECTOR_LOADS.md).
    // NO date — the magnifier already says it (Howell: no redundancy).
    // Sun computed for any date on the chain; tides/moon/festivo only
    // inside the extracted print window.
    const rows = [];
    // The day's own name, where its calendar gives every day one (the
    // French rural names, O-251), first on the card.
    if (typeof daySystem.dayWord === 'function') {
      const own = daySystem.dateOf(serial);
      const word = daySystem.dayWord(own.year, own.month, own.day);
      if (word) rows.push(String(word));
    }
    // FANO'S TABLES GO TO THE FOOT OF THE SECTOR (O-255, Howell 2026-10-30:
    // "take all of the sunrise and tide tables for Fano and move them down
    // to the bottom of the detail sector, staying a safe distance away from
    // the dimension slider, and make the font about half as big"). They
    // ride a field of their own; the day's own name stays under the weekday.
    const tables = [];
    const sun = localSunTimes(yearNumber, monthNumber, dayNumber, FANO.lat, FANO.lon, FANO.zoneSince);
    if (sun) tables.push(`↑ ${sun.alba}    ↓ ${sun.tramonto}`);
    const key = `${yearNumber}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const eph = ephemerisDays?.[key];
    if (eph) {
      const h = v => Number(v).toFixed(1).replace('.', ',');
      tables.push(`▲ ${eph.alta[0]}  ${h(eph.alta[1])} m`);
      tables.push(`▽ ${eph.bassa[0]}  ${h(eph.bassa[1])} m`);
      if (eph.luna && MOON_PRINT[eph.luna]) tables.push(MOON_PRINT[eph.luna]);
    }
    // THE PRESENT REACHES THE LEAF (O-247, Howell 2026-10-30): today's card
    // wears the NOW colours — a red disc behind the weekday, the word in
    // yellow — as the one red thing on the glass, the way the ring node and
    // the sky's star do at every other level. No other day is coloured: the
    // Sunday red is gone with it ("there should be no other colored label
    // than the one for the current day").
    return {
      type: 'ephemeris',
      title: weekday.toUpperCase(),
      titleAlign: 'center',
      now: selected.now === true || serial === todaySerial(),
      rows,
      tables
    };
  }

  if (selected.level === 'year') {
    const yearEntry = findYear(manifest, id) || {};
    const yearNumber = selected.yearNumber ?? yearEntry.year_number ?? selected.meta?.yearNumber ?? null;
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

  // A month of another calendar carries its own names (O-245).
  if (selected.level === 'month' && selected.yearName) {
    return { type: 'card', title: selected.name || id, body: String(selected.yearName) };
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
  // Centuries are the top level since O-242 (decades between them and the
  // years; millennia stay cousin-gap texture, removed as a level 2026-07-17);
  // backing out from centuries exits through the gateway, if any. The DEFAULT
  // BOOT lands one level down: the months ring on the current month
  // (Howell 2026-07-19), so the handlers must start in the ring the chain
  // builder actually delivered.
  // Five rings since O-242: century, decade, year, month, day.
  let calendarMode = ['century', 'decade', 'year'].includes(options?.level) ? options.level : 'month';
  let calendarMonthContext = null;
  // THE CALENDAR THE RINGS SPEAK (O-245): the Gregorian at boot; the
  // dimension's plane changes it, and the rings are re-expressed in the new
  // one at the same day. The app is kept from the boot for that.
  let system = SYSTEMS[GREGORIAN];
  let bootedApp = null;
  chosenCalendar = GREGORIAN;

  // The ~86k-link months chain is identical on every entry; build it once
  // per handler set AND SYSTEM, and only re-locate the entry month.
  const monthChains = new Map();
  const monthChain = initialItemId => {
    const sys = initialItemId ? systemOf(systemIdOf(initialItemId)) : system;
    if (!monthChains.has(sys.id)) {
      monthChains.set(sys.id, buildCalendarMonthsCousinChain(manifest, { system: sys }).items);
    }
    const monthChainItems = monthChains.get(sys.id);
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
      // parent state in full view before anything is hidden. A decade waits
      // above every year now (O-242).
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return true;
    }
    // Up through the decades and centuries (O-242), landing on the one that
    // holds the magnified item.
    if (calendarMode === 'year' || calendarMode === 'decade') {
      const toDecades = calendarMode === 'year';
      const y = toDecades ? selected?.yearNumber : selected?.firstYear;
      if (!Number.isFinite(y)) return false;
      const sys = systemOf(selected?.system);
      const { items, selectedIndex } = toDecades
        ? buildCalendarDecades(manifest, { initialItemId: sys.decadeId(sys.decadeKey(y)) })
        : buildCalendarCenturies(manifest, { initialItemId: sys.centuryId(sys.centuryKey(y)) });
      calendarMode = toDecades ? 'decade' : 'century';
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(items, selectedIndex, true);
      }
      if (app?.setParentButtons) app.setParentButtons({ showOuter: toDecades || Boolean(gatewayReturnLabel) });
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
      const yearLabel = item.yearName || (y < 0 ? `${Math.abs(y)} BC` : String(y));
      // As the day's own system phrases it (13.0.14.1 for the Maya, O-252).
      return systemOf(item.system).monthPhrase(yearLabel, item.monthName);
    }
    // Years in the ring: the decade's word; decades: the century's (O-242).
    if (calendarMode === 'year') {
      const sys = systemOf(item?.system);
      return item && Number.isFinite(item.yearNumber) ? sys.decadeWord(sys.decadeDigit(item.yearNumber)) : '';
    }
    if (calendarMode === 'decade') {
      return item && Number.isFinite(item.centuryNumber) ? systemOf(item.system).centuryPhrase(item.centuryNumber, item.era) : '';
    }
    if (calendarMode !== 'month') return gatewayReturnLabel || '';
    if (!item) return '';
    if (item.yearName) return String(item.yearName);   // the year in its own calendar's script (O-248)
    const y = Number.isFinite(item.yearNumber) ? item.yearNumber : Number.parseInt(item.parentId, 10);
    if (!Number.isFinite(y)) return '';
    return y < 0 ? `${Math.abs(y)} BC` : String(y);
  };

  const childrenHandler = ({ selected, app }) => {
    // Down from a century or a decade (O-242), entering at its first child.
    if ((calendarMode === 'century' || calendarMode === 'decade') && selected?.id) {
      const sky = calendarMode === 'century'
        ? getCalendarCenturyDecades(manifest, selected.id)
        : getCalendarDecadeYears(manifest, selected.id);
      if (!sky.length) return false;
      const { items, selectedIndex } = calendarMode === 'century'
        ? buildCalendarDecades(manifest, { initialItemId: sky[0].id })
        : buildCalendarYears(manifest, { arrangement: options?.arrangement, initialItemId: sky[0].id });
      calendarMode = calendarMode === 'century' ? 'decade' : 'year';
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      if (app?.setPrimaryItems) app.setPrimaryItems(items, selectedIndex, true);
      return true;
    }
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

  // The centuries ring is the top (O-242). Through a gateway, its parent
  // button names the return destination; standalone there is nothing above
  // it, so no button. Every lower ring has an OUT.
  // RE-EXPRESSED (O-245): the ring the reader is on, rebuilt in the chosen
  // calendar at the same moment — the day in the lens stays the same real
  // day; a month, year, decade or century is re-entered at the one holding
  // its first day. No migration: the names change, the place does not.
  const reexpress = next => {
    if (!next || next.id === system.id) return;
    const prev = system;
    system = next;
    const app = bootedApp;
    const cur = app?.nav?.getCurrent?.();
    if (!app?.setPrimaryItems || !cur) return;
    // The moment the lens holds: a day is its serial; a span (month, year,
    // decade, century) is TODAY when it holds today, otherwise its MIDDLE —
    // the first day would land a span early in a calendar that runs behind
    // (1 February 1900 is 20 January in the Julian), the middle keeps the
    // span whose name the reader is looking at.
    let serial = null;
    if (cur.level === 'day' && Number.isFinite(cur.serial)) serial = cur.serial;
    else if (cur.now) serial = todaySerial();
    else if (cur.level === 'month' && Number.isFinite(cur.yearNumber)) {
      const m = cur.monthNumber || 1;
      serial = prev.serialOf(cur.yearNumber, m, 1) + Math.floor(prev.reckoning.monthSpan(cur.yearNumber, m) / 2);
    } else if (cur.level === 'year' && Number.isFinite(cur.yearNumber)) serial = prev.serialOf(cur.yearNumber, 7, 1);
    else if ((cur.level === 'decade' || cur.level === 'century') && Number.isFinite(cur.firstYear) && Number.isFinite(cur.lastYear)) {
      let mid = Math.floor((cur.firstYear + cur.lastYear) / 2);
      if (mid === 0) mid = 1;
      serial = prev.serialOf(mid, 7, 1);
    }
    if (!Number.isFinite(serial)) return;
    const d = next.dateOf(serial);
    let chain = null;
    if (calendarMode === 'day') chain = getCalendarDayChain(next.dayId(d.year, d.month, d.day));
    else if (calendarMode === 'month') chain = monthChain(next.monthId(d.year, d.month));
    else if (calendarMode === 'year') chain = buildCalendarYears(manifest, { arrangement: options?.arrangement, initialItemId: next.yearId(d.year) });
    else if (calendarMode === 'decade') chain = buildCalendarDecades(manifest, { initialItemId: next.decadeId(next.decadeKey(d.year)) });
    else if (calendarMode === 'century') chain = buildCalendarCenturies(manifest, { initialItemId: next.centuryId(next.centuryKey(d.year)) });
    if (chain?.items?.length) app.setPrimaryItems(chain.items, chain.selectedIndex, true);
  };
  onCalendarChosen(id => reexpress(systemOf(id)));
  // WARMED IN IDLE MOMENTS (O-253): a calendar whose years cost astronomy
  // (the Chinese: every month a new moon, every year a solstice) is walked
  // a hundred years at a time between frames once it is chosen, so the
  // months ring — every year's months on one chain — opens without a
  // stall. Abandoned the moment another calendar is chosen.
  let warming = 0;
  const warmSystem = sys => {
    const token = ++warming;
    if (typeof sys?.warm !== 'function' || typeof setTimeout !== 'function') return;
    const years = yearNumbersForSystem(manifest, sys);
    let i = 0;
    const step = () => {
      if (token !== warming) return;
      const end = Math.min(years.length, i + 100);
      for (; i < end; i += 1) sys.warm(years[i]);
      if (i < years.length) setTimeout(step, 0);
    };
    setTimeout(step, 0);
  };
  onCalendarChosen(id => warmSystem(systemOf(id)));

  const onBoot = ({ app, renderDetail }) => {
    bootedApp = app;
    // Warm the ephemeris table (tides/moon/feasts from the wall calendar)
    // so the day card has it long before any leaf settles. If a slow fetch
    // loses that race, repaint the settled day when the table lands —
    // otherwise a sun-only card sits stale until the user scrubs
    // (Phase C audit L1).
    loadEphemeris()?.then(() => {
      const settled = app?.nav?.getCurrent?.();
      if (settled?.level === 'day' && typeof renderDetail === 'function') renderDetail(settled);
    });
    if (app?.setParentButtons) {
      app.setParentButtons({ showOuter: calendarMode !== 'century' || Boolean(gatewayReturnLabel) });
    }
  };

  // THE GAP KEEPS THE NEARER SEAT'S NAME (O-168, extended to the calendar
  // by O-236): turned into the gap between two years, the parent seat goes
  // on naming the nearer month's year — 2026 to the middle of the gap, 2027
  // from there — rather than going blank. The gaps in this ring only ever
  // part years (or, among days, months), so the nearer side always has a name.
  const getGapLabel = nearer => getParentLabel(nearer);

  return {
    parentHandler,
    childrenHandler,
    onBoot,
    // The chosen calendar's script runs right to left or not (O-248): the
    // parent seat and the lens's caption take their side from it.
    textDirection: () => system.direction || 'ltr',
    // The NOW disc's word in the chosen calendar's script (Howell: "The
    // NOW button should be in Hebrew letters").
    nowWord: () => system.nowWord || 'NOW',
    getParentLabel,
    getGapLabel,
    // Years stay centered on their nodes (numerals); MONTHS align like
    // manufacturers — magnifier centered, ring labels right-aligned
    // (Howell 2026-07-19).
    // Decades are words too, and align as the months do (O-242).
    shouldCenterLabel: ({ item } = {}) => item?.level !== 'month' && item?.level !== 'decade',
    layoutBindings: {
      calendarModeRef: () => calendarMode,
      getCalendarMonthChain: monthId => monthChain(monthId),
      getCalendarDayChain,
      // The grid's header letters in the chosen calendar's script (O-248).
      getWeekdayLetters: () => (system.id !== GREGORIAN && system.weekdayLetters) || getCalendarWeekdayLetters(manifest),
      // The system an id belongs to (O-245), for the grid's reckoning.
      systemForId: id => systemOf(systemIdOf(id)),
      setCalendarMode: next => { calendarMode = next; },
      setCalendarMonthContext: ctx => { calendarMonthContext = ctx; },
      // THE SKY ABOVE ANY RING: a century's decades, a decade's years, a
      // year's months (O-242). The name is the months' from before.
      getCalendarMonths: (m, selected, mode) => {
        const level = mode || calendarMode;
        if (level === 'century') return selected?.id ? getCalendarCenturyDecades(manifest, selected.id) : [];
        if (level === 'decade') return selected?.id ? getCalendarDecadeYears(manifest, selected.id) : [];
        return getCalendarMonths(m, selected, level);
      },
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
    detailTapAdvances: true,
    // A tap drills (O-234, Howell 2026-10-28): a month or a date in the sky
    // drills in, the parent seat drills out — the calendar reads by tapping.
    // The strokes stay as well.
    drillByTap: true
  }
};

// THE CALENDARS STRATUM (O-244, Howell 2026-10-30): "the secondary stratum
// taking the user through different cultural calendars". One plane, in the
// Bible's secondary geometry (the mirrored ring), holding the calendars the
// volume can speak. The Gregorian is the one it speaks today; the rest are
// placeholder seats — drawn hollow, inert, the snap passes them — until each
// one's arithmetic lands and turns its seat live. The order is the order of
// arrival I proposed: the ones with exact rules first, the astronomical
// Chinese calendar last.
const CALENDARS = [
  { id: 'gregorian', name: 'GREGORIAN', live: true },
  { id: 'julian', name: 'JULIAN', live: true },
  { id: 'hebrew', name: 'HEBREW', live: true },
  { id: 'islamic', name: 'ISLAMIC', live: true },
  { id: 'republican', name: 'FRENCH REPUBLICAN', live: true },
  { id: 'maya', name: 'MAYA', live: true },
  { id: 'chinese', name: 'CHINESE', live: true }
];
const calendarById = id => CALENDARS.find(c => c.id === id) || null;
let chosenCalendar = 'gregorian';
// Whoever holds the rings hears the choice (the handler set, O-245).
const chosenListeners = new Set();
export function onCalendarChosen(fn) { chosenListeners.add(fn); return () => chosenListeners.delete(fn); }
export const calendarStrata = () => [
  { id: 'secondary', mirrored: true,
    items: () => CALENDARS.map(c => c.id),
    // The seat in the calendar's own script where it has one (Howell: "the
    // Hebrew label in the secondary stratum should also be written in
    // Hebrew text"); the plane's English for the rest.
    label: id => SYSTEMS[id]?.nativeName || calendarById(id)?.name || id,
    selected: () => chosenCalendar,
    classFor: id => (calendarById(id)?.live ? '' : 'is-coming'),
    inert: id => !calendarById(id)?.live,
    // THE WATERMARK (O-246): any calendar but the Gregorian — "the standard
    // calendar, it doesn't need a watermark" — writes its name across the
    // glass while it is chosen.
    // In the calendar's own script where it has one (Howell: "the
    // watermark should also be in Hebrew letters").
    watermark: id => (id === GREGORIAN ? '' : (SYSTEMS[id]?.nativeName || calendarById(id)?.name || '')),
    select: id => {
      const c = calendarById(id);
      if (!c || !c.live) return false;
      chosenCalendar = id;
      chosenListeners.forEach(fn => { try { fn(id); } catch (_) { /* a listener's error is its own */ } });
      return true;
    } }
];
export const CALENDAR_SYSTEMS = CALENDARS.map(c => ({ ...c }));
