import { daySerial, serialToDate } from '../geometry/day-grid.js';
import { legacyTextFile, legacyUnitId, legacyOrdinal } from '../core/unit-source.js';
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

// Greek alphabetic numerals, closed by the keraia. ϛ (stigma), ϟ (koppa) and
// ϡ (sampi) are the numeral-only letters.
export function toGreekNumeral(n) {
  if (!Number.isFinite(n) || n <= 0 || n > 999) return String(n);
  const ones  = ['', 'α', 'β', 'γ', 'δ', 'ε', 'ϛ', 'ζ', 'η', 'θ'];
  const tens  = ['', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ϟ'];
  const hunds = ['', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'ϡ'];
  return hunds[Math.floor(n / 100)] + tens[Math.floor((n % 100) / 10)] + ones[n % 10] + 'ʹ';
}

// Hebrew alphabetic numerals. 15 and 16 are written טו/טז rather than יה/יו,
// which would spell the Name. The closing marks — geresh (׳) on a lone
// letter, gershayim (״) before the last of several — are what say "number,
// not word": א is aleph, א׳ is 1.
export function toHebrewNumeral(n) {
  if (!Number.isFinite(n) || n <= 0 || n > 999) return String(n);
  const ones  = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens  = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hunds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  let out = hunds[Math.floor(n / 100)];
  const rem = n % 100;
  if (rem === 15) out += 'טו';
  else if (rem === 16) out += 'טז';
  else out += tens[Math.floor(rem / 10)] + ones[rem % 10];
  if (!out) return String(n);
  return out.length === 1 ? out + '׳' : out.slice(0, -1) + '״' + out.slice(-1);
}

// THE TRADITION'S OWN LETTERS (Howell 2026-08-02). "Chapters are Roman,
// verses are Arabic" (2026-07-20) was never about Rome — Roman numerals are
// LATIN's letter-numerals, and Arabic digits are the tradition-neutral set.
// Generalized: a chapter wears the letters of the tongue the text is in, a
// verse wears the universal digits. The pyramid still tells them apart by
// letters-against-digits, and a Greek Bible stops counting in a Latin hand.
// A tongue with no letter-numerals shows digits — honest, not borrowed.
export function toTraditionNumeral(n, locale) {
  if (!Number.isFinite(n)) return '';
  if (locale === 'latin') return toRomanNumeral(n);
  if (locale === 'greek') return toGreekNumeral(n);
  if (locale === 'hebrew') return toHebrewNumeral(n);
  return String(n);
}

// Uppercase Latin-script labels (as the rings always have), but leave every
// other script in its given form (Howell 2026-07-22): uppercasing strips
// polytonic Greek's breathings and accents, is meaningless for Hebrew, and
// can mangle scripts with their own casing. Invert the test — uppercase ONLY
// when a label is pure Latin (Basic + Latin-1 + Extended-A/B + Additional +
// combining marks, which covers Vietnamese, Turkish, Czech, Welsh …).
// NOTE: src/view/secondary-strata-view.js carries the same rule locally,
// where the view layer cannot reach across into the adapters.
const LATIN_SCRIPT_ONLY = /^[ -ɏ̀-ͯḀ-ỿ]+$/;
export const toDisplayCase = s => {
  const str = String(s ?? '');
  return LATIN_SCRIPT_ONLY.test(str) ? str.toUpperCase() : str;
};

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

  // --- Country-level: the country's manufacturers, as a starfield ---
  // Children carry WORLD-CHAIN ids (market__country__manu), so a tapped star
  // re-enters the one continuous manufacturers chain seeded at that maker —
  // countries index the chain, they never contain it (Howell 2026-07-23).
  if (id.startsWith('country:')) {
    const countryKey = id.slice(8);
    const markets = manifest?.MMdM?.markets || {};
    for (const [marketId, market] of Object.entries(markets)) {
      const country = market?.countries?.[countryKey];
      if (!country) continue;
      return Object.entries(country.manufacturers || {})
        .map(([manuKey, manuVal]) => ({
          id: `${marketId}__${countryKey}__${manuKey}`,
          name: manuKey,
          order: Number.isFinite(manuVal?.sort_number) ? manuVal.sort_number : 0,
          parentId: id,
          parentName: countryKey,
          level: 'manufacturer',
          prominence: manuVal?.prominence // ranked stars, when the data declares tiers
        }))
        .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name))
        .map((child, idx) => ({ ...child, order: idx }));
    }
    return [];
  }

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
    // THE NUMBER TRAVELS, THE NUMERALS ARE WORN AT RENDER (Howell
    // 2026-08-02). This once baked a Roman string into the item name, which
    // meant the label formatter met "XVII" with no number left to convert —
    // so a Greek reader got Latin numerals under a Greek book name. The
    // convention still holds (chapters in the tradition's own letters,
    // verses in Arabic), but it is applied where the reader's language is
    // known, not where the chapter is built. Same bug class as the baked
    // book names (W-16) and the stale-Latin verse.
    const label = Number.isFinite(chapterNum) ? String(chapterNum) : (namesMap?.sections?.[chapterKey] || chapterKey);
    const externalFile = legacyTextFile(chapterVal, `data/gutenberg/chapters/${bookId}/${String(chapterKey).padStart(3, '0')}.json`);
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

// THE VERSION FOOTNOTE (Howell 2026-07-20): a factory stamp at the end of
// the manufacturers chain — four empty links past the last manufacturer,
// then one placebo node carrying the build's version, bare (e.g. "3.12.0").
// Placebo means the engine ignores it everywhere: bounds anchor on the
// last REAL link (so at full stretch the stamp stays two spacings short
// of the magnifier), snap never lands on it, taps pass through it. The
// version is stamped into the bundle at build time; unbundled runs
// (tests, raw source) read 'dev'.
const WHEEL_VERSION = typeof __WHEEL_VERSION__ !== 'undefined' ? __WHEEL_VERSION__ : 'dev';
const VERSION_FOOTNOTE_GAPS = 4;

// THE COUNTRIES RING (Howell 2026-07-23, 5b): a siblings-only index layer
// ABOVE the world chain. Countries never contain makers on any ring — the
// manufacturers chain stays one continuous world (the gentleman's design);
// this ring is how a reader stands somewhere broader (its lens scopes
// search to a country, its pyramid fans the country's makers). Ids match
// the adapter graph (`country:KEY`) so the search scope can walk them.
export function buildCatalogCountries(manifest, { initialItemId } = {}) {
  const markets = manifest?.MMdM?.markets;
  if (!markets) return { items: [], selectedIndex: 0, preserveOrder: true };
  const items = [];
  Object.entries(markets).forEach(([, market]) => {
    Object.entries(market?.countries || {}).forEach(([countryKey]) => {
      items.push({ id: `country:${countryKey}`, name: countryKey, level: 'country', order: 0 });
    });
  });
  // Alphabetical, in the names' own language (Howell 2026-07-23).
  items.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  items.forEach((it, idx) => { it.order = idx; });
  const target = initialItemId ? String(initialItemId).toLowerCase() : null;
  const idx = target
    ? items.findIndex(it => it.name.toLowerCase() === target || it.id.toLowerCase() === target)
    : -1;
  return { items, selectedIndex: idx >= 0 ? idx : 0, preserveOrder: true };
}

export function buildCatalogManufacturers(manifest, { initialItemId, dataStampLetters = [] } = {}) {
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
        if (!item || item.placebo) return false;
        const simple = String(item.name || '').toLowerCase();
        if (simple === target) return true;
        return String(item.id || '').toLowerCase() === target;
      });
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  if (items.length) {
    for (let i = 0; i < VERSION_FOOTNOTE_GAPS; i += 1) items.push(null);
    items.push({ id: 'version-footnote', name: WHEEL_VERSION, placebo: true, order: items.length });
    // THE DATA STAMPS (W-7, Howell 2026-07-25): one blank link below the
    // engine stamp, then a line per volume letter — each showing that
    // volume's volume_data_version, resolved at RUNTIME by the host (data
    // syncs independently of the bundle; a baked stamp would lie exactly
    // when it's used to check whether a data push landed). '…' until the
    // manifests answer; '?' if one never does — a silently absent line
    // would look identical to a volume that's fine (W-6's lesson).
    // TYPOGRAPHIC spacing, not chain spacing (Howell 2026-07-25): the stamp
    // is a block of text, not a run of nodes — its lines sit like a word
    // processor's, measured in line-heights. Orders are FRACTIONAL: position
    // along the arc is order × node-spacing, so a quarter-step reads as
    // "single spaced" at the stamp's small type. One blank line separates
    // the engine version from the data block (the i+2 below).
    const STAMP_LINE_STEP = 0.25; // the "single spacing" — Howell tunes by eye
    const engineStampOrder = items[items.length - 1].order;
    dataStampLetters.forEach((letter, i) => {
      items.push({
        id: `data-stamp-${letter}`,
        name: `${letter} …`,
        placebo: true,
        order: engineStampOrder + STAMP_LINE_STEP * (i + 2)
      });
    });
  }

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

// BOOKS HANG FROM TESTAMENTS, WITH NOTHING BETWEEN (H-14, Howell 2026-08-12).
//
// This walked testaments → SECTIONS → books, and the section was never a
// level the reader could stand on: the engine builds no ring for one and a
// book has always ascended straight to its testament. The section survived
// here only as the book's `parentName`, which is why removing it is visible
// at all — the parent button now says the testament's name, which is the
// level the reader actually returns to.
export function buildBibleBooks(manifest, namesMap = {}) {
  const testaments = manifest?.Gutenberg_Bible?.testaments;
  if (!testaments) return [];
  const bookNames = namesMap.books || namesMap;
  const testamentNames = namesMap.testaments || {};
  const items = [];
  Object.entries(testaments).forEach(([testamentId, testament]) => {
    Object.entries(testament?.books || {}).forEach(([bookId, book]) => {
      items.push({
        id: bookId,
        // A NAME IS A QUOTATION (H-2). Where no tongue names this id the item
        // goes unnamed rather than wearing its own opaque id, which would be
        // the filesystem speaking to the reader.
        name: bookNames?.[bookId] || null,
        sort: Number.isFinite(book?.sort_number) ? book.sort_number : items.length,
        testamentId,
        parentName: testamentNames?.[testamentId] || null
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

// The cache's terminal state for a chapter file: null = never requested,
// 'loading' | 'loaded' | 'error'. Lets callers distinguish "not yet asked"
// from "asked, and the answer is genuinely empty" (the Esther stubs) —
// re-requesting a loaded-empty chapter loops forever (Phase C, the Moto G
// Esther incident).
export function getBibleVerseCacheStatus(externalFile) {
  return _verseCache.get(externalFile)?.status || null;
}

export function prefetchBibleVerses(chapterItem, { onLoaded } = {}) {
  const externalFile = chapterItem?.meta?.externalFile;
  if (!externalFile) return;
  const cached = _verseCache.get(externalFile);
  if (cached?.status === 'loaded') {
    if (typeof onLoaded === 'function') onLoaded();
    return;
  }
  if (cached?.status === 'loading') {
    // Already in flight: QUEUE the callback, never drop it (Phase C audit
    // M1 — the read-ahead's renderDetail and a later pyramid refresh can
    // both be waiting on the same chapter; dropping the second left the
    // verse sky empty until the user nudged the ring).
    if (typeof onLoaded === 'function') cached.waiters = [...(cached.waiters || []), onLoaded];
    return;
  }
  _verseCache.set(externalFile, { status: 'loading', items: [], rawVerses: null, waiters: [] });
  const url = externalFile.startsWith('.') ? externalFile : `./${externalFile}`;
  fetch(url)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => {
      const bookKey = legacyUnitId(data, chapterItem.meta?.bookId || '');
      const chapterLabel = legacyOrdinal(data);
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
      const waiters = _verseCache.get(externalFile)?.waiters || [];
      _verseCache.set(externalFile, { status: 'loaded', items, rawVerses: verses });
      if (typeof onLoaded === 'function') onLoaded();
      waiters.forEach(fn => { try { fn(); } catch { /* a waiter must not break the rest */ } });
    })
    .catch(err => {
      console.warn('[prefetchBibleVerses] failed to load', externalFile, err);
      _verseCache.set(externalFile, { status: 'error', items: [], rawVerses: null });
    });
}

// SEATING A UNIT'S RESOLVED TEXT INTO THE CACHE (O-45, phase 1a).
//
// The H-11 layout stores one file PER EDITION; everything below this line
// reads one record per address holding every edition at once. `unit-text.js`
// performs that conversion, and this is where the result lands — under a
// cache key exactly as a legacy chapter file's path would be, so that
// getBibleVerseItems, getVerseTextForSeat and getVerseTextResolved cannot
// tell which layout answered and need no branch for it.
//
// This is the whole reason the splice is small. The alternative — teaching
// each reader below to recognise the new shape — would put a layout branch at
// every one of them, which is the drift the descriptor (O-42) exists to
// prevent. When the last unit migrates, this function and the shape it
// converts TO retire in the same commit.
//
// It never fetches: the caller has already resolved and normalised, and a
// second fetch path here would be a second place for the two layouts to
// disagree about what "loaded" means.
export function seedVerseCache(cacheKey, rawVerses, items = []) {
  if (!cacheKey || !rawVerses) return false;
  // A waiter queued against a unit that was still loading must still fire —
  // the same dropped-callback defect the Phase C audit found here (M1).
  const waiters = _verseCache.get(cacheKey)?.waiters || [];
  _verseCache.set(cacheKey, { status: 'loaded', items, rawVerses });
  waiters.forEach(fn => { try { fn(); } catch { /* a waiter must not break the rest */ } });
  return true;
}

// Returns the text for a specific verse from cache.  Tries each translation in
// `preferredTranslations` in order, then falls back to the first available one.
// Resolve a verse's text AND say which translation supplied it — the caller
// decides whether that was a substitution worth flagging (W-6). The old
// any-language last resort (`Object.values(verse.text)[0]`) is DEAD,
// unconditionally (Howell ruled 2026-07-24): it served unmarked Greek to
// English readers — a silent lie. Only the declared preference order may
// answer; past it, the honest empty.
// THE SPINE'S OWN SLOT ORDER (the seating-chart contract): integer ids
// ascending, each sub-slot immediately after the integer it hangs off,
// stacked sub-slots lexical. An utterance ORDINAL indexes this sequence.
export function slotKeyForOrdinal(rawVerses, ordinal) {
  if (!rawVerses || !Number.isInteger(ordinal) || ordinal < 1) return null;
  const keys = Object.keys(rawVerses).sort((a, b) => {
    const ai = parseInt(a, 10), bi = parseInt(b, 10);
    if (ai !== bi) return ai - bi;
    const as = a.slice(String(ai).length), bs = b.slice(String(bi).length);
    return as < bs ? -1 : as > bs ? 1 : 0;
  });
  return keys[ordinal - 1] ?? null;
}

// THE TEXT BELONGS TO THE UTTERANCE, NOT TO THE LABEL (Howell from the
// phone, 2026-08-03: "1 Chronicles 11:47 has no text").
//
// A seat wears the EDITION's verse name; the chapter file is keyed by the
// SPINE's slot ids, and after the utterance model those two stopped being
// the same string. Hebrew 1 Chronicles 11:47 is the spine's slot "46b" —
// there is no slot "47", so the lookup found nothing and the reader met a
// blank. Worse, and this is why it had to be fixed before any proofreading:
// Hebrew Psalm 44:24 is the spine's slot "23", so looking up "24" finds a
// real verse that is THE WRONG ONE. A blank is visible; an off-by-one in
// scripture is not.
//
// So the text is fetched by the seat's span — spine chapter and ordinal —
// and a fused seat reads from its FIRST utterance, where the whole text
// lives (W-30). The label is for the reader; the span is for the lookup.
export function getVerseTextForSeat(externalFile, meta, preferredTranslations = ['VUL']) {
  const cached = _verseCache.get(externalFile);
  if (!cached?.rawVerses) return null;
  // AN UNCHARTED EDITION KEEPS ITS LABEL (Howell, from the phone, minutes
  // after the fix above: English Psalm 43 came back off by one). The identity
  // fallback derives its spans from verse_count, which cannot know where a
  // chapter's sub-slots fall — so seat 23 claims utterance 23 while the
  // reader's verse 23 is slot "23", and following the span walked the whole
  // rest of the chapter one place back. Where the chart is synthetic the
  // label is the only truth there is; where it is REAL the span is.
  const span = !meta?.synthetic && Array.isArray(meta?.span) ? meta.span[0] : null;
  const key = span ? slotKeyForOrdinal(cached.rawVerses, span[1]) : null;
  return getVerseTextResolved(externalFile, key ?? meta?.verseKey, preferredTranslations);
}

export function getVerseTextResolved(externalFile, verseKey, preferredTranslations = ['VUL']) {
  const cached = _verseCache.get(externalFile);
  if (!cached?.rawVerses) return null;
  const verse = cached.rawVerses[String(verseKey)];
  if (!verse?.text) return null;
  for (const t of preferredTranslations) {
    if (verse.text[t]) return { text: verse.text[t], translation: t };
  }
  return null;
}

export function getVerseTextFromCache(externalFile, verseKey, preferredTranslations = ['VUL', 'NAB', 'BYZ', 'SYN']) {
  return getVerseTextResolved(externalFile, verseKey, preferredTranslations)?.text || '';
}
