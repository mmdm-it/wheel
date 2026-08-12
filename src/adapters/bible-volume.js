// THE WALL'S READER (H-14, 2026-08-12) — the Bible boots from `volume.json`.
//
// This module is what replaces the manifest walk. It reads ONLY H-11-layout
// cargo, and there is no path through it to the pre-doctrine files: no flag,
// no fallback, no branch. Unmigrated content is not hidden here, it is
// unreachable, which is what makes H-14 a wall rather than a gate.
//
// `volume.json` IS THE SOLE ENUMERATION. Not the first source consulted — the
// only one. Nothing else says what the volume contains: not a manifest, not a
// directory listing, not an index derived from either. A unit absent from it
// does not exist, however many files sit on disk beside it. The Vulgate is the
// standing proof: fully present in `text/VUL/`, unenumerated, unreachable.
//
// THE READER'S LEVELS ARE TESTAMENT, BOOK, CHAPTER, VERSE (Howell,
// 2026-08-12). There is no section, and this module will not invent one — the
// corpus's `hierarchy_levels` still declares one, which is a stale assertion
// the engine has already outlived. A chapter is not a level here either: it is
// the render-time projection O-44 rules it to be, computed from the chart when
// asked and stored nowhere.
//
// WHAT IT NORMALISES TO, and why that is not the coexistence H-14 retired.
// Adapters load, validate and NORMALISE (the adapter contract); an internal
// shape is not cargo. What would have been forbidden is rebuilding the legacy
// shape in memory — `chapters` maps, `_external_file`, `book_key` — which is
// the hub in its last costume. None of those appears below.
import { resolvePath } from '../core/identity.js';
import { normalizeUnitText } from '../core/unit-text.js';
import { projectContainers } from '../core/unit-source.js';

// EVERY ARTIFACT A UNIT NEEDS, CHECKED AS A SET (O-42's principle, which
// survives H-14 even though its seam did not). A unit resolves all-or-nothing
// and loudly: half a unit renders as success, and across 79 increments the one
// thing that must not happen is a botched increment looking finished.
const REQUIRED_PER_UNIT = ['spine', 'chart', 'text'];

export async function loadBibleVolume({ base, version, fetchJson } = {}) {
  if (typeof fetchJson !== 'function') {
    throw new Error('bible-volume: needs a `fetchJson(path)` — the transport is the caller\'s');
  }
  const at = parts => resolvePath({ base, version, ...parts });
  const volume = await fetchJson(at({ kind: 'volume' }));

  const editions = (volume?.editions || []).filter(e => e?.code);
  if (!editions.length) {
    throw new Error(
      'bible-volume: volume.json declares no editions. Under H-14 this file is the sole '
      + 'enumeration, so a volume with no editions has nothing any reader could be shown — '
      + 'and falling back to the legacy registry is the capability the wall removes.');
  }

  // The testaments, in declared order. Order is DATA, never read off an id:
  // ids are opaque under H-11 and carry no order in their characters.
  const testaments = (volume?.testaments || []).map((testament, order) => ({
    id: testament.id,
    order,
    books: (testament.books || []).map((book, bookOrder) => ({
      id: book.id,
      leaves: Number.isFinite(book.leaves) ? book.leaves : null,
      order: bookOrder,
      testamentId: testament.id
    }))
  }));

  const units = testaments.flatMap(t => t.books);
  if (!units.length) {
    throw new Error('bible-volume: volume.json enumerates no books — the volume is empty, which is a data state and not a render');
  }

  // NAMES ARE QUOTATIONS (H-2), loaded per language and never manufactured.
  // An id with no name displays unnamed; the engine may not fall back to
  // showing the id, which would be the filesystem speaking to the reader.
  const languages = [...new Set(editions.map(e => e.language).filter(Boolean))];
  const namesByLanguage = {};
  await Promise.all(languages.map(async lang => {
    try {
      namesByLanguage[lang] = await fetchJson(at({ kind: 'names', lang }));
    } catch {
      namesByLanguage[lang] = null;      // a missing tongue is unnamed, not fatal
    }
  }));

  return {
    version,
    base,
    testaments,
    units,
    editions,
    namesByLanguage,
    unitIds: new Set(units.map(u => u.id)),

    // THE ENUMERATION ANSWERS THE ONLY MEMBERSHIP QUESTION THERE IS.
    has(unitId) { return this.unitIds.has(unitId); },

    pathFor(kind, unitId, edition) {
      if (!this.has(unitId)) {
        throw new Error(
          `bible-volume: ${JSON.stringify(unitId)} is not in volume.json, so it does not exist (H-14). `
          + 'Files may sit on disk for it; the enumeration is what the engine can see.');
      }
      return at({ kind, unitId, edition });
    }
  };
}

// ONE UNIT, FULLY RESOLVED, OR A SCREAM (H-14 + O-42's surviving principle).
//
// Spine, chart and text land together. The tempting kindness — render what
// arrived — would show a unit the increment did not finish, and every layer
// above would report success.
export async function loadUnit(volume, unitId, edition, { fetchJson } = {}) {
  if (typeof fetchJson !== 'function') throw new Error('bible-volume: loadUnit needs a `fetchJson(path)`');
  const codes = volume.editions.map(e => e.code);
  if (!codes.includes(edition)) {
    throw new Error(
      `bible-volume: ${JSON.stringify(edition)} is not an enumerated edition (have: ${codes.join(', ') || 'none'}). `
      + 'volume.json is the sole enumeration — an edition absent from it is absent, whatever is on disk.');
  }

  const missing = [];
  const settle = async (kind, path) => {
    try {
      const got = await fetchJson(path);
      if (!got) missing.push(kind);
      return got;
    } catch {
      missing.push(kind);
      return null;
    }
  };

  const [spine, chart, ...texts] = await Promise.all([
    settle('spine', volume.pathFor('spine', unitId)),
    settle('chart', volume.pathFor('chart', unitId, edition)),
    ...codes.map(code => settle(`text/${code}`, volume.pathFor('text', unitId, code)))
  ]);

  if (missing.length) {
    throw new Error(
      `bible-volume: ${JSON.stringify(unitId)} is enumerated but INCOMPLETE — missing ${missing.join(', ')}.\n`
      + `  A unit resolves all-or-nothing. Rendering the parts that arrived would show a unit this `
      + `increment did not finish, and it would look like success.\n`
      + `  Required per unit: ${REQUIRED_PER_UNIT.join(', ')} (text for every enumerated edition).`);
  }

  const seats = (chart.seats || []).map(seat => String(seat.label));
  const records = normalizeUnitText({
    editions: Object.fromEntries(codes.map((code, i) => [code, texts[i]])),
    declared: codes,
    order: seats
  });

  return {
    unitId,
    edition,
    spine,
    chart,
    seats,
    text: records,
    // CHAPTERS ARE PROJECTED, NOT STORED (O-44). The chart declares them per
    // edition over book-ordinal ranges, and nothing reconciles two editions
    // that divide differently — both are right.
    containers: projectContainers(chart, { leaves: (spine.utterances || []).length })
  };
}
