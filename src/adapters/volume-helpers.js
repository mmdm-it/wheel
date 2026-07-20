import { daySerial, serialToDate } from '../geometry/day-grid.js';
// Volume-specific chain/build helpers extracted from the host page.
// These remain pure functions over manifests and options.

// Roman numerals for the Bible volume's Latin identity (Psalms reach CL,
// Psalm 118's verses reach CLXXVI).
export function toRomanNumeral(n) {
  if (!Number.isFinite(n) || n <= 0 || n > 3999) return String(n);
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let out = '', rem = n;
  for (let i = 0; i < vals.length; i++) while (rem >= vals[i]) { out += syms[i]; rem -= vals[i]; }
  return out;
}

// Resolve the manufacturer object from a parentId containing market__country
function resolveManufacturer(manifest, manufacturerId, parentId) {
  // Walk up through parentId chain or search all markets
  if (parentId) {
    // parentId may be a compound "market__country__manufacturer" or we can extract market/country
    const segments = parentId.includes('__') ? parentId.split('__') : [];
    if (segments.length >= 2) {
      const [marketId, countryId] = segments;
      const found = manifest?.MMdM?.markets?.[marketId]?.countries?.[countryId]?.manufacturers?.[manufacturerId];
      if (found) return found;
    }
  }
  // Fallback: search all markets
  const markets = manifest?.MMdM?.markets || {};
  for (const marketVal of Object.values(markets)) {
    for (const countryVal of Object.values(marketVal?.countries || {})) {
      if (countryVal?.manufacturers?.[manufacturerId]) return countryVal.manufacturers[manufacturerId];
    }
  }
  return null;
}

// Build child items from a models array (orphans or family/subfamily models)
function modelsToItems(models, idPrefix, parentId, parentName, cylKey) {
  if (!Array.isArray(models)) return [];
  return models.map((model, idx) => ({
    id: `${idPrefix}${model.engine_model || idx}`,
    name: model.engine_model || `Model ${idx + 1}`,
    order: model.sort_number ?? idx,
    parentId,
    parentName,
    cylinder: cylKey,
    level: 'model'
  }));
}

export function getCatalogChildren(manifest, selected) {
  const id = selected?.id;
  if (!id) return [];

  // --- Subfamily-level: return models under that subfamily ---
  if (id.startsWith('subfam:')) {
    // id = "subfam:manufacturer:cyl:family:subfamily"
    const parts = id.split(':');
    const manufacturerId = parts[1];
    const cylKey = parts[2];
    const familyName = parts[3];
    const subfamilyName = parts[4];
    const manufacturer = resolveManufacturer(manifest, manufacturerId, selected.parentId);
    if (!manufacturer) return [];
    const cylVal = manufacturer.cylinders?.[cylKey];
    const subfamily = cylVal?.families?.[familyName]?.subfamilies?.[subfamilyName];
    if (!subfamily) return [];
    const prefix = `model:${manufacturerId}:${cylKey}:${familyName}:${subfamilyName}:`;
    return modelsToItems(subfamily.models, prefix, id, familyName, cylKey)
      .sort((a, b) => a.order - b.order)
      .map((child, idx) => ({ ...child, order: idx }));
  }

  // --- Family-level: return orphan models + subfamilies ---
  if (id.startsWith('fam:')) {
    // id = "fam:manufacturer:cyl:family"
    const parts = id.split(':');
    const manufacturerId = parts[1];
    const cylKey = parts[2];
    const familyName = parts[3];
    const manufacturer = resolveManufacturer(manifest, manufacturerId, selected.parentId);
    if (!manufacturer) return [];
    const cylVal = manufacturer.cylinders?.[cylKey];
    const family = cylVal?.families?.[familyName];
    if (!family) return [];

    const children = [];
    // Orphan models first (models at family level without a subfamily)
    const prefix = `model:${manufacturerId}:${cylKey}:${familyName}:`;
    children.push(...modelsToItems(family.models, prefix, id, familyName, cylKey));

    // Then subfamilies
    const subfamilies = family.subfamilies || {};
    Object.entries(subfamilies).forEach(([subName, subVal]) => {
      children.push({
        id: `subfam:${manufacturerId}:${cylKey}:${familyName}:${subName}`,
        name: subName,
        order: subVal.sort_number ?? children.length,
        parentId: id,
        parentName: familyName,
        cylinder: cylKey,
        level: 'subfamily'
      });
    });

    return children
      .sort((a, b) => {
        // Orphan models first, then subfamilies
        const aIsLeaf = a.level === 'model' ? 0 : 1;
        const bIsLeaf = b.level === 'model' ? 0 : 1;
        if (aIsLeaf !== bIsLeaf) return aIsLeaf - bIsLeaf;
        return a.order - b.order;
      })
      .map((child, idx) => ({ ...child, order: idx }));
  }

  // --- Cylinder-level: return orphan models + families ---
  if (id.startsWith('cyl:')) {
    // id = "cyl:manufacturerId:cylKey"
    const parts = id.split(':');
    const manufacturerId = parts[1];
    const cylKey = parts[2];
    const manufacturer = resolveManufacturer(manifest, manufacturerId, selected.parentId);
    if (!manufacturer) return [];
    const cylVal = manufacturer.cylinders?.[cylKey];
    if (!cylVal) return [];

    const children = [];
    // Orphan models first (models at cylinder level without a family)
    const prefix = `model:${manufacturerId}:${cylKey}:`;
    children.push(...modelsToItems(cylVal.models, prefix, id, manufacturerId, cylKey));

    // Then families
    const families = cylVal.families || {};
    Object.entries(families).forEach(([famName, famVal]) => {
      children.push({
        id: `fam:${manufacturerId}:${cylKey}:${famName}`,
        name: famName,
        order: famVal.sort_number ?? children.length,
        parentId: id,
        parentName: manufacturerId,
        cylinder: cylKey,
        level: 'family'
      });
    });

    return children
      .sort((a, b) => {
        // Orphan models first, then families
        const aIsLeaf = a.level === 'model' ? 0 : 1;
        const bIsLeaf = b.level === 'model' ? 0 : 1;
        if (aIsLeaf !== bIsLeaf) return aIsLeaf - bIsLeaf;
        return a.order - b.order;
      })
      .map((child, idx) => ({ ...child, order: idx }));
  }

  // --- Manufacturer-level: return cylinders (or gateway children) ---
  const [marketId, countryId, manufacturerId] = id.split('__');
  const manufacturer = manifest?.MMdM?.markets?.[marketId]?.countries?.[countryId]?.manufacturers?.[manufacturerId];
  if (!manufacturer) return [];
  // Gateway children: data-declared doors into another volume. The target
  // volume id comes from the data, never from code (data-agnostic).
  if (Array.isArray(manufacturer.gateway_children)) {
    return manufacturer.gateway_children.map((gw, idx) => ({
      id: `gateway:${gw.volume}:${idx}`,
      name: gw.name,
      order: Number.isFinite(gw.sort_number) ? gw.sort_number : idx,
      parentId: id,
      parentName: manufacturerId,
      level: 'gateway',
      gateway: { volume: gw.volume, returnItemId: id }
    }));
  }
  const cylinders = manufacturer.cylinders || {};
  return Object.entries(cylinders)
    .map(([cylKey, cylVal]) => {
      // Count all models at all depths for this cylinder
      let modelCount = Array.isArray(cylVal.models) ? cylVal.models.length : 0;
      const families = cylVal.families || {};
      for (const famVal of Object.values(families)) {
        modelCount += Array.isArray(famVal.models) ? famVal.models.length : 0;
        for (const subVal of Object.values(famVal.subfamilies || {})) {
          modelCount += Array.isArray(subVal.models) ? subVal.models.length : 0;
        }
      }
      return {
        id: `cyl:${manufacturerId}:${cylKey}`,
        name: cylKey,
        order: Number.isFinite(cylVal.sort_number) ? cylVal.sort_number : parseInt(cylKey, 10) || 0,
        parentId: id,
        parentName: manufacturerId,
        modelCount,
        level: 'cylinder'
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((child, idx) => ({ ...child, order: idx }));
}

export function getCalendarMonths(manifest, selected, calendarMode) {
  if (calendarMode !== 'year') return [];
  const yearId = selected?.id;
  if (!yearId) return [];
  const years = manifest?.Calendar?.years || {};
  const yearEntry = years[yearId] || Object.values(years).find(y => String(y.id || '') === String(yearId));
  if (!yearEntry) return [];
  // Months live once in month_template and are synthesized per year
  // (composed ids keep them unique across years); per-year months, if a
  // manifest ever carries them, take precedence.
  const months = yearEntry.months || manifest?.Calendar?.month_template;
  if (!months) return [];
  // The month we are living through wears the present moment's colors in
  // the pyramid, exactly as today does in the day grid — but only inside
  // its own year (Howell 2026-07-20).
  const present = presentMoment();
  const isThisYear = yearEntry.year_number === present.yearNumber;
  const currentMonthNumber = present.monthNumber;
  return Object.entries(months).map(([monthKey, monthVal], idx) => ({
    id: `${yearId}:${monthVal?.id || monthKey}`,
    name: monthVal?.name || monthKey,
    order: Number.isFinite(monthVal?.month_number) ? monthVal.month_number : idx,
    parentId: yearId,
    level: 'month',
    now: isThisYear && monthVal?.month_number === currentMonthNumber
  })).sort((a, b) => {
    if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
    return a.order - b.order;
  }).map((item, idx) => ({ ...item, order: idx }));
}

export function getBibleChapters(manifest, selected, namesMap, bibleMode) {
  if (bibleMode !== 'book') return [];
  const bookId = selected?.id;
  if (!bookId) return [];
  const testaments = manifest?.Gutenberg_Bible?.testaments || {};
  let bookEntry = null;
  Object.values(testaments).some(testament => {
    const sections = testament?.sections || {};
    return Object.values(sections).some(section => {
      const books = section?.books || {};
      if (books[bookId]) {
        bookEntry = books[bookId];
        return true;
      }
      return false;
    });
  });
  if (!bookEntry?.chapters) return [];
  return Object.entries(bookEntry.chapters).map(([chapterKey, chapterVal], idx) => {
    const chapterNum = Number.parseInt(chapterKey, 10);
    // CHAPTERS ARE ROMAN, VERSES ARE ARABIC (Howell 2026-07-20) — the
    // convention Latin scripture has always cited by (Ioh. III, 16). The
    // numeral system itself says which is which, so neither wears a word
    // ("Capitulum") nor a colon to explain itself.
    const label = Number.isFinite(chapterNum) ? toRomanNumeral(chapterNum) : (namesMap?.sections?.[chapterKey] || chapterKey);
    const externalFile = chapterVal?._external_file
      || `data/gutenberg/chapters/${bookId}/${String(chapterKey).padStart(3, '0')}.json`;
    return {
      id: chapterVal?.id || `${bookId}:${chapterKey}`,
      // The manifest's own "name" for a chapter is just its number as a
      // string, so the numeral form we chose has to win it. A chapter
      // keyed by something other than a number keeps whatever name it has.
      name: Number.isFinite(chapterNum) ? label : (chapterVal?.name || label),
      order: Number.isFinite(chapterVal?.sort_number) ? chapterVal.sort_number : idx,
      parentId: bookId,
      level: 'chapter',
      meta: { bookId, chapterKey, externalFile }
    };
  }).sort((a, b) => {
    if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
    return a.order - b.order;
  }).map((item, idx) => ({ ...item, order: idx }));
}

export function getPlacesLevels(manifest) {
  const levels = manifest?.Places?.display_config?.hierarchy_levels;
  if (!levels) return [];
  return Object.keys(levels);
}

function pluralizeLevel(level) {
  if (!level) return '';
  if (level.endsWith('y')) return `${level.slice(0, -1)}ies`;
  if (level.endsWith('s')) return `${level}es`;
  return `${level}s`;
}

// Builds ordered items for a Places hierarchy level using optional parent context.
export function buildPlacesLevel(manifest, levels, levelIndex, { selectedId, parentItem, contextParentId } = {}) {
  const places = manifest?.Places;
  if (!places || !levels?.length || levelIndex < 0 || levelIndex >= levels.length) {
    return { items: [], selectedIndex: 0, preserveOrder: true };
  }
  const levelName = levels[levelIndex];
  const levelKey = pluralizeLevel(levelName);
  const parentLevelName = levelIndex > 0 ? levels[levelIndex - 1] : null;
  const parentLevelKey = parentLevelName ? pluralizeLevel(parentLevelName) : null;
  const collection = places[levelKey] || {};
  const parentCollection = parentLevelKey ? places[parentLevelKey] || {} : {};
  const parent = parentItem || (parentLevelName && contextParentId ? parentCollection[contextParentId] : null);
  const filterParentId = parent?.id || contextParentId || null;
  const rootChildren = places.root?.children || [];
  const ids = (() => {
    if (parent && Array.isArray(parent[levelKey])) {
      return parent[levelKey];
    }
    if (filterParentId && parentLevelName) {
      const parentProp = `${parentLevelName}_id`;
      return Object.values(collection)
        .filter(entry => (entry?.[parentProp] ?? entry?.parent_id) === filterParentId)
        .sort((a, b) => {
          const as = Number.isFinite(a?.sort_number) ? a.sort_number : 0;
          const bs = Number.isFinite(b?.sort_number) ? b.sort_number : 0;
          if (as === bs) return (a?.name || '').localeCompare(b?.name || '');
          return as - bs;
        })
        .map(entry => entry.id);
    }
    if (levelIndex === 0 && rootChildren.length) {
      return rootChildren;
    }
    return Object.keys(collection);
  })();
  const items = ids
    .map((id, idx) => {
      const raw = collection[id] || { id, name: id };
      const sort = Number.isFinite(raw.sort_number) ? raw.sort_number : idx;
      return {
        id: raw.id || id,
        name: raw.name || raw.id || id,
        sort,
        order: sort,
        parentId: parent?.id ?? filterParentId ?? raw[`${parentLevelName}_id`] ?? raw.parent_id ?? null,
        parentName: parent?.name || null,
        level: levelName
      };
    })
    .sort((a, b) => {
      if (a.sort === b.sort) return (a.name || '').localeCompare(b.name || '');
      return a.sort - b.sort;
    })
    .map((item, idx) => ({ ...item, order: idx }));
  const selectedIndex = (() => {
    if (selectedId) {
      const idx = items.findIndex(item => item?.id === selectedId);
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  return { items, selectedIndex, preserveOrder: true };
}

export function buildCatalogManufacturers(manifest, { initialItemId } = {}) {
  const markets = manifest?.MMdM?.markets;
  if (!markets) return { items: [], selectedIndex: 0, preserveOrder: false };
  const items = [];
  const target = initialItemId ? String(initialItemId).toLowerCase() : null;
  Object.entries(markets).forEach(([marketId, market]) => {
    const countries = market?.countries || {};
    Object.entries(countries).forEach(([countryId, country]) => {
      const manufacturers = country?.manufacturers || {};
      Object.entries(manufacturers).forEach(([manufacturerId, manufacturer]) => {
        items.push({
          id: `${marketId}__${countryId}__${manufacturerId}`,
          name: manufacturerId,
          sort: Number.isFinite(manufacturer?.sort_number) ? manufacturer.sort_number : items.length + 1
        });
      });
    });
  });

  items.sort((a, b) => {
    const as = a.sort || 0;
    const bs = b.sort || 0;
    if (as === bs) return (a.name || '').localeCompare(b.name || '');
    return as - bs;
  });
  items.forEach((item, idx) => { item.order = idx; });

  const selectedIndex = (() => {
    if (target) {
      const idx = items.findIndex(item => {
        const simple = String(item.name || '').toLowerCase();
        if (simple === target) return true;
        return String(item.id || '').toLowerCase() === target;
      });
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  return { items, selectedIndex, preserveOrder: true };
}

// The cousin-gap grammar (Howell rulings 2026-07-17). Whatever level rides
// the focus ring, each ancestor boundary above it is a cousin rank, and a
// crossing inserts empty chain links — gaps occupy node slots and rotate
// with the chain (the sprocket has empty links, not stretched spacing).
// Rank ladder: 1st/2nd/3rd/4th cousins -> 2/4/6/8 links. Years ring:
// century = cousins, millennium = second cousins. Months ring adds year as
// cousins (century/millennium shift up a rank), days will add month.
export const COUSIN_GAP_LINKS = [2, 4, 6, 8];

// Grouping keys. Historical numbering: no year zero, so centuries run
// 1..100, 101..200 (and -100..-1); the era crossing -1 -> 1 is itself a
// millennium boundary and gets that rank's gap.
// THE PRESENT MOMENT (Howell 2026-07-20): the year, the month and the day
// we are living through carry a mark wherever they ride the focus ring, so
// the reader can always find where they are standing at any depth. Only
// ring NODES wear it — the magnifier stays its ordinary self, which is the
// view's business, not the data's.
const presentMoment = () => {
  const wallClock = new Date();
  return {
    yearNumber: wallClock.getFullYear(),
    monthNumber: wallClock.getMonth() + 1,
    dayNumber: wallClock.getDate()
  };
};

const centuryKey = y => (y > 0 ? Math.ceil(y / 100) : -Math.ceil(-y / 100));
const millenniumKey = y => (y > 0 ? Math.ceil(y / 1000) : -Math.ceil(-y / 1000));

// Weave sorted items into a chain with cousin gaps. rankKeys: one key
// function per cousin rank, nearest first (e.g. [year, century, millennium]
// for a months ring). The HIGHEST crossed rank wins the gap size.
export function weaveCousinChain(sorted, rankKeys) {
  const items = [];
  let prev = null;
  sorted.forEach(item => {
    if (prev !== null) {
      let gap = 0;
      rankKeys.forEach((keyOf, rank) => {
        const a = keyOf(prev);
        const b = keyOf(item);
        if (a !== null && b !== null && a !== b) gap = COUSIN_GAP_LINKS[rank] || 0;
      });
      for (let i = 0; i < gap; i += 1) items.push(null);
    }
    item.order = items.length;
    items.push(item);
    prev = item;
  });
  return items;
}

function selectIndexIn(items, initialItemId) {
  if (initialItemId) {
    const idx = items.findIndex(item => item && item.id === initialItemId);
    if (idx >= 0) return idx;
  }
  const firstReal = items.findIndex(item => item !== null);
  return firstReal >= 0 ? firstReal : 0;
}

export function buildCalendarYears(manifest, { arrangement, initialItemId } = {}) {
  const years = manifest?.Calendar?.years;
  if (!years) return { items: [], selectedIndex: 0, preserveOrder: false };
  const present = presentMoment();
  const sorted = [];
  Object.entries(years).forEach(([yearId, year]) => {
    sorted.push({
      id: yearId,
      name: year.name || year.year_display || String(year.year_number || yearId),
      sort: year?.sort_number || year?.year_number || sorted.length + 1,
      yearNumber: year.year_number,
      parentId: null,
      level: 'year',
      now: year.year_number === present.yearNumber
    });
  });

  sorted.sort((a, b) => {
    if ((arrangement || '').startsWith('descending')) {
      return (b.sort || 0) - (a.sort || 0);
    }
    const as = a.sort || 0;
    const bs = b.sort || 0;
    if (as === bs) return (a.name || '').localeCompare(b.name || '');
    return as - bs;
  });

  // Years are the top level; centuries and millennia are cousin texture.
  const yearKey = item => (Number.isFinite(item.yearNumber) ? item.yearNumber : null);
  const items = weaveCousinChain(sorted, [
    item => { const y = yearKey(item); return y === null ? null : centuryKey(y); },
    item => { const y = yearKey(item); return y === null ? null : millenniumKey(y); }
  ]);

  return { items, selectedIndex: selectIndexIn(items, initialItemId), preserveOrder: true };
}

// The months cousin chain: EVERY year's months on one ring, year crossings
// as cousins, centuries as second cousins, millennia as third — the
// hierarchy is one timeline at a deeper zoom, not a place you climb out of.
// ~86k links for 6000 years; built on entry to months mode, not at boot.
export function buildCalendarMonthsCousinChain(manifest, { initialItemId } = {}) {
  const cal = manifest?.Calendar;
  const years = cal?.years;
  if (!years) return { items: [], selectedIndex: 0, preserveOrder: false };
  const template = cal?.month_template || {};
  const monthEntries = Object.entries(template)
    .sort((a, b) => (a[1]?.month_number || 0) - (b[1]?.month_number || 0));
  if (!monthEntries.length) return { items: [], selectedIndex: 0, preserveOrder: false };

  const sortedYears = Object.values(years)
    .filter(y => Number.isFinite(y?.year_number))
    .sort((a, b) => (a.sort_number || 0) - (b.sort_number || 0));

  const present = presentMoment();
  const sorted = [];
  sortedYears.forEach(year => {
    const months = year.months
      ? Object.entries(year.months).sort((a, b) => (a[1]?.month_number || 0) - (b[1]?.month_number || 0))
      : monthEntries;
    months.forEach(([monthKey, monthVal]) => {
      sorted.push({
        id: `${year.id}:${monthVal?.id || monthKey}`,
        name: monthVal?.name || monthKey,
        parentId: year.id,
        yearNumber: year.year_number,
        monthNumber: monthVal?.month_number || 0,
        level: 'month',
        now: year.year_number === present.yearNumber
          && (monthVal?.month_number || 0) === present.monthNumber
      });
    });
  });

  const items = weaveCousinChain(sorted, [
    item => (Number.isFinite(item.yearNumber) ? item.yearNumber : null),
    item => (Number.isFinite(item.yearNumber) ? centuryKey(item.yearNumber) : null),
    item => (Number.isFinite(item.yearNumber) ? millenniumKey(item.yearNumber) : null)
  ]);

  return { items, selectedIndex: selectIndexIn(items, initialItemId), preserveOrder: true };
}

/**
 * Weekday names, indexed 0 = Sunday .. 6 = Saturday (the week starts on
 * Sunday, Howell 2026-07-19). ONE source: the wedge's header letters and
 * the detail sector's weekday both read this, so a translation moves them
 * together instead of drifting apart.
 */
export function getCalendarWeekdayNames(manifest) {
  const template = manifest?.Calendar?.weekday_template;
  if (!template) return [];
  const names = [];
  Object.values(template).forEach(day => {
    if (Number.isFinite(day?.weekday_number)) names[day.weekday_number] = day?.name || '';
  });
  return names;
}

/** The wedge's column headers: one letter per weekday, from those names. */
export function getCalendarWeekdayLetters(manifest) {
  const names = getCalendarWeekdayNames(manifest);
  if (names.length !== 7 || names.some(n => !n)) return null; // let the lattice keep its default
  return names.map(n => n.charAt(0).toUpperCase());
}

/**
 * The DAYS ring chain (C.6 opener, Howell's thumb doctrine 2026-07-19):
 * days spanning ±5 years around the entered date — "scanning six thousand
 * years by the day is ridiculous" — woven with the full cousin ladder:
 * month 2, year 4, century 6, millennium 8. Plain array (~3,900 links).
 * Ids match the wedge grid's cells: d:<year>:<month>:<day>.
 */
export function buildCalendarDaysCousinChain(manifest, { centerId } = {}) {
  const m = /^d:(-?\d+):(\d+):(\d+)$/.exec(centerId || '');
  if (!m) return { items: [], selectedIndex: 0, preserveOrder: true };
  const cy = Number(m[1]);
  const cm = Number(m[2]);
  const cd = Number(m[3]);

  const template = manifest?.Calendar?.month_template || {};
  const monthNameByNumber = {};
  Object.values(template).forEach(mv => {
    if (Number.isFinite(mv?.month_number)) monthNameByNumber[mv.month_number] = mv?.name || '';
  });

  const HALF_SPAN_DAYS = 1826; // five years, thumb-doctrine cap
  const center = daySerial(cy, cm, cd);
  // A date that never happened (Gregory's ten, or a hand-typed id) has no
  // link of its own; the serial resolves it to the day the count resumed,
  // and the ring must magnify THAT day rather than fall back to link zero.
  const centerDate = serialToDate(center);
  const resolvedCenterId = `d:${centerDate.yearNumber}:${centerDate.month}:${centerDate.day}`;
  const first = Math.max(center - HALF_SPAN_DAYS, daySerial(-3000, 1, 1));
  const last = Math.min(center + HALF_SPAN_DAYS, daySerial(3000, 12, 31));

  const present = presentMoment();
  const sorted = [];
  for (let serial = first; serial <= last; serial += 1) {
    const date = serialToDate(serial);
    sorted.push({
      id: `d:${date.yearNumber}:${date.month}:${date.day}`,
      name: String(date.day),
      dayNumber: date.day,
      monthNumber: date.month,
      yearNumber: date.yearNumber,
      monthName: monthNameByNumber[date.month] || '',
      level: 'day',
      now: date.yearNumber === present.yearNumber
        && date.month === present.monthNumber
        && date.day === present.dayNumber
    });
  }

  const items = weaveCousinChain(sorted, [
    item => `${item.yearNumber}:${item.monthNumber}`,
    item => item.yearNumber,
    item => centuryKey(item.yearNumber),
    item => millenniumKey(item.yearNumber)
  ]);

  return { items, selectedIndex: selectIndexIn(items, resolvedCenterId), preserveOrder: true };
}

export function buildBibleSections(manifest, { testamentId, sectionId, namesMap } = {}) {
  const testaments = manifest?.Gutenberg_Bible?.testaments;
  if (!testaments) return { items: [], selectedIndex: 0, preserveOrder: false };
  const items = [];
  let activeTestament = testaments[testamentId];
  if (!activeTestament) {
    const fallbackTestaments = Object.values(testaments);
    activeTestament = fallbackTestaments[0];
    testamentId = Object.keys(testaments)[0];
  }
  const sections = activeTestament?.sections || {};
  const activeTestamentId = testamentId || Object.keys(testaments)[0];
  Object.entries(sections).forEach(([sectionKey, sectionVal], idx) => {
    items.push({
      id: sectionKey,
      name: namesMap?.sections?.[sectionKey] || sectionVal?.name || sectionKey,
      sort: sectionVal?.sort_number || idx,
      order: sectionVal?.sort_number || idx,
      testamentId: activeTestamentId
    });
  });
  items.sort((a, b) => {
    if (a.sort === b.sort) return (a.name || '').localeCompare(b.name || '');
    return a.sort - b.sort;
  });
  items.forEach((item, idx) => { item.order = idx; });

  const selectedIndex = (() => {
    if (sectionId) {
      const idx = items.findIndex(item => item.id === sectionId);
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  const activeTestamentIdValue = activeTestamentId;

  return {
    items,
    selectedIndex,
    preserveOrder: true,
    meta: {
      testament: activeTestament,
      testamentId: activeTestamentIdValue
    }
  };
}

export function buildBibleBooks(manifest, namesMap = {}) {
  const testaments = manifest?.Gutenberg_Bible?.testaments;
  if (!testaments) return [];
  const bookNames = namesMap.books || namesMap;
  const sectionNames = namesMap.sections || {};
  const items = [];
  Object.entries(testaments).forEach(([testamentId, testament]) => {
    const sections = testament?.sections || {};
    Object.entries(sections).forEach(([sectionId, section]) => {
      const books = section?.books || {};
      Object.entries(books).forEach(([bookId, book]) => {
        items.push({
          id: bookId,
          name: bookNames?.[bookId] || book?.book_name || book?.name || bookId,
          sort: book?.sort_number || items.length + 1,
          sectionId,
          parentName: sectionNames?.[sectionId] || section?.name || sectionId
        });
      });
    });
  });
  return items;
}

export function buildBibleTestaments(manifest, namesMap = {}, { testamentId, translationName = '' } = {}) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible) return { items: [], selectedIndex: 0, preserveOrder: true };
  const testamentNames = namesMap?.testaments || {};
  const items = Object.entries(bible.testaments || {})
    .sort(([, a], [, b]) => (a?.sort_number ?? 0) - (b?.sort_number ?? 0))
    .map(([tid, testament], idx) => ({
      id: tid,
      name: testamentNames[tid] || testament?.name || tid,
      sort: testament?.sort_number ?? idx,
      order: idx,
      level: 'testament',
      parentName: translationName
    }));
  const selectedIndex = testamentId
    ? Math.max(0, items.findIndex(i => i.id === testamentId))
    : 0;
  return { items, selectedIndex, preserveOrder: true };
}

// ── Bible Verse Cache ────────────────────────────────────────────────────────
// Verse items and raw text are fetched on demand and stored keyed by the
// chapter's external file path.  getBibleVerseItems() returns synchronously
// from cache; prefetchBibleVerses() triggers the async load and calls onLoaded
// once complete so callers can trigger a re-render (e.g. app.refreshPyramid).

const _verseCache = new Map(); // externalFile → { status, items, rawVerses }

export function getBibleVerseItems(chapterItem) {
  const externalFile = chapterItem?.meta?.externalFile;
  if (!externalFile) return [];
  const cached = _verseCache.get(externalFile);
  return cached?.status === 'loaded' ? cached.items : [];
}

export function prefetchBibleVerses(chapterItem, { onLoaded } = {}) {
  const externalFile = chapterItem?.meta?.externalFile;
  if (!externalFile) return;
  const cached = _verseCache.get(externalFile);
  if (cached?.status === 'loaded') {
    if (typeof onLoaded === 'function') onLoaded();
    return;
  }
  if (cached?.status === 'loading') return; // already in flight
  _verseCache.set(externalFile, { status: 'loading', items: [], rawVerses: null });
  const url = externalFile.startsWith('.') ? externalFile : `./${externalFile}`;
  fetch(url)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => {
      const bookKey = data.book_key || chapterItem.meta?.bookId || '';
      const chapterLabel = data.sequence ?? '';
      const verses = data.verses || {};
      const items = Object.entries(verses)
        .map(([verseKey, verse]) => {
          const seq = Number.isFinite(verse?.seq) ? verse.seq : (parseInt(verseKey, 10) || 0);
          return {
            id: `${bookKey}_${chapterLabel}_${verseKey}`,
            // The verse number alone: the parent button carries the book
            // and chapter, live, so the ring need not repeat them.
            name: String(verseKey),
            order: seq,
            parentId: chapterItem.id,
            level: 'verse',
            meta: { bookId: bookKey, chapterId: chapterItem.id, verseKey, externalFile }
          };
        })
        .sort((a, b) => a.order - b.order)
        .map((item, idx) => ({ ...item, order: idx }));
      _verseCache.set(externalFile, { status: 'loaded', items, rawVerses: verses });
      if (typeof onLoaded === 'function') onLoaded();
    })
    .catch(err => {
      console.warn('[prefetchBibleVerses] failed to load', externalFile, err);
      _verseCache.set(externalFile, { status: 'error', items: [], rawVerses: null });
    });
}

// Returns the text for a specific verse from cache.  Tries each translation in
// `preferredTranslations` in order, then falls back to the first available one.
export function getVerseTextFromCache(externalFile, verseKey, preferredTranslations = ['VUL', 'NAB', 'BYZ', 'SYN']) {
  const cached = _verseCache.get(externalFile);
  if (!cached?.rawVerses) return '';
  const verse = cached.rawVerses[String(verseKey)];
  if (!verse?.text) return '';
  for (const t of preferredTranslations) {
    if (verse.text[t]) return verse.text[t];
  }
  return Object.values(verse.text)[0] || '';
}
