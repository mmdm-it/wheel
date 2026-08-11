// THE COEXISTENCE SEAM (O-42, phase 1a) — one engine, two layouts, one branch.
//
// Phase 1a's acceptance test is that a migrated unit renders WHILE every other
// unit stays in the old layout beside it. That is not a cutover: both shapes
// are live in the same session, and phase 1b then flips units one at a time
// across 79 increments. So the engine must be LAYOUT-BLIND everywhere except
// here.
//
// A boolean "is this migrated?" would put a branch at all forty-one id-shape
// sites, and every one of those branches would be a place the two layouts
// could drift apart. This returns a DESCRIPTOR instead. Downstream code asks
// the descriptor for what it needs and never learns which layout answered.
//
// VOLUME-NEUTRAL SURFACE (Howell, 2026-08-11). The engine-facing vocabulary is
// `unit`, never any volume's own word for its addressing level. THE UNIT IS
// DECLARED, NOT ASSUMED: a volume states its levels and the first is its unit.
// An adapter may speak its own language internally — adapters own semantics —
// but nothing crosses this boundary wearing one volume's vocabulary.
import { resolvePath } from './identity.js';

// PRESENCE IS CHECKED ACROSS ALL THREE ARTIFACTS, AND DISAGREEMENT IS FATAL
// (Howell, 2026-08-11). A unit resolves all-or-nothing, loudly.
//
// The tempting kindness — index says migrated, spine missing, quietly fall
// back to the old layout — is the worst option available. It renders a unit
// the increment did not finish, from data the increment was replacing, and it
// looks like success. A half-present unit is a botched increment and must be
// IMPOSSIBLE to render, not merely discouraged. 79 increments will pass
// through this check; it is the reason a bad one stops at the first unit
// instead of being discovered at the seventy-ninth.
const REQUIRED = ['spine', 'text', 'chart'];

export function createUnitSource({ levels, editions, exists, base = '', version = '' } = {}) {
  if (!Array.isArray(levels) || !levels.length) {
    throw new Error('unit-source: the volume must DECLARE its levels — the unit is the first, and assuming one is how a volume word gets into the engine');
  }
  if (typeof exists !== 'function') {
    throw new Error('unit-source: needs an `exists(path)` probe — presence is measured, never declared');
  }
  const unitLevel = levels[0];
  const codes = Array.isArray(editions) ? editions : [];

  // Which units have migrated is DERIVED from the chart index, never declared
  // by a flag in the old manifest. A flag is a second source of truth that can
  // disagree with the files; an index is a reading of what exists. Same
  // principle that made W-48's hasChart safe.
  const migrated = new Set();
  for (const edition of codes) {
    const indexPath = resolvePath({ base, version, kind: 'chartIndex', edition });
    const listed = exists(indexPath, { read: true });
    if (!listed || !Array.isArray(listed.units || listed.books)) continue;
    for (const id of (listed.units || listed.books)) migrated.add(id);
  }

  function assertComplete(unitId) {
    const missing = [];
    for (const kind of REQUIRED) {
      if (kind === 'spine') {
        if (!exists(resolvePath({ base, version, kind: 'spine', unitId }))) missing.push('spine');
        continue;
      }
      for (const edition of codes) {
        if (!exists(resolvePath({ base, version, kind, unitId, edition }))) {
          missing.push(`${kind}/${edition}`);
        }
      }
    }
    if (missing.length) {
      throw new Error(
        `unit-source: ${JSON.stringify(unitId)} is listed as migrated but is INCOMPLETE — missing `
        + `${missing.join(', ')}.\n`
        + '  A unit resolves all-or-nothing (O-42, Howell 2026-08-11). Falling back to the old '
        + 'layout here would render a unit this increment did not finish, from the data it was '
        + 'replacing, and it would look like success.\n'
        + '  Finish the increment or withdraw it from the chart index. There is no third option.');
    }
  }

  return {
    unitLevel,
    isMigrated: unitId => migrated.has(unitId),

    // The descriptor. Its shape is the same whichever layout answers, which is
    // the entire point — a caller cannot tell, and therefore cannot drift.
    describe(unitId, legacy = null) {
      if (migrated.has(unitId)) {
        assertComplete(unitId);
        return {
          unitId,
          layout: 'current',
          leaves: null,   // the spine holds the order; nothing else may claim it
          textAt: edition => resolvePath({ base, version, kind: 'text', unitId, edition }),
          chartAt: edition => resolvePath({ base, version, kind: 'chart', unitId, edition }),
          spineAt: () => resolvePath({ base, version, kind: 'spine', unitId })
        };
      }
      if (!legacy) return null;
      return {
        unitId,
        layout: 'legacy',
        leaves: Number.isFinite(legacy.leaves) ? legacy.leaves : null,
        textAt: () => legacy.file || '',
        chartAt: () => legacy.chart || '',
        spineAt: () => null
      };
    }
  };
}

// THE LEGACY TEXT FILE, read in ONE place instead of six (O-42, phase 1a).
//
// Six sites spelled this out by hand, in two variants that differed only in
// their fallback. Measured before merging them: `_external_file` occurs 1,435
// times in the manifest — once per chapter — and `external_file` without the
// underscore occurs ZERO times. The second check was dead in both variants,
// so honouring it everywhere is provably inert rather than a quiet widening.
//
// The fallback stays a CALLER'S argument, because the two variants genuinely
// disagreed: three built a path, three yielded an empty string, and under the
// phase-1 freeze a merged default would have changed behaviour at three sites
// while looking like tidying.
//
// This exists to be deleted. `_external_file` retires under H-11, and when the
// last unit migrates the descriptor answers instead — at which point one
// function goes rather than six expressions.
export function legacyTextFile(meta, fallback = '') {
  return meta?._external_file || meta?.external_file || fallback;
}

// THE LEGACY UNIT ID, read in one place instead of five (O-42, phase 1a).
//
// Five sites reached for `book_key` by hand, each with its own fallback chain
// — and the chains genuinely differ, so the fallback stays the caller's to
// supply. One site falls back to the map key, one to `id || name`, one to a
// meta field, one to an empty string. A merged default would have changed
// four of them while reading as tidying, which is the freeze's worst shape.
//
// The FIELD is what belongs here: `book_key` retires under H-11, and when the
// last unit migrates the descriptor supplies the id instead. One function goes
// then, not five expressions — and the field name stops appearing in
// engine-general code, which O-43 now polices.
export function legacyUnitId(meta, fallback = '') {
  return meta?.book_key || fallback;
}

// THE LEGACY ORDINAL, and the operator is the whole point (O-42, phase 1a).
//
// `sequence` retires under H-11. Its one remaining reader used `??`, not `||`,
// and the difference is not stylistic: a sequence can legitimately be 0, and
// `||` would discard it as falsy and substitute the fallback. Preserved
// exactly here rather than normalised to the more common operator — under the
// phase-1 freeze the tempting tidy is the defect.
export function legacyOrdinal(meta, fallback = '') {
  return meta?.sequence ?? fallback;
}

// PROJECT CONTAINERS FROM A CHART (O-44, ruled 2026-08-11).
//
// Containers below the declared unit are the CHART's, per edition. This is the
// projection H-11 promised when it abolished the container as a storage level,
// and it is deliberately trivial: read the groups the edition declared, in the
// order it declared them. There is no inference here and there must not be.
//
// WHAT IT DOES NOT DO, AND WHY THAT IS THE POINT:
//
//   - it never parses a LABEL. A label is a quotation (H-2) — what this
//     edition calls the container. Splitting "3:16" to learn a structure is
//     reading meaning out of text, which is the habit `identity.js` exists to
//     end. The RANGE says what belongs; the label says only what to print.
//   - it never consults the spine. The spine is flat by ruling; a default
//     grouping there would be the hub in its last costume, and an edition that
//     divides differently would silently inherit the Vulgate's shape.
//   - it never repairs. A chart whose groups leave a gap or overlap is a
//     botched increment, and it SCREAMS rather than rendering the part that
//     happens to be coherent. Same doctrine as the all-or-nothing check above:
//     79 increments pass through here, and a partial render looks like success.
export function projectContainers(chart, { leaves } = {}) {
  const groups = chart?.groups;
  if (!Array.isArray(groups) || !groups.length) {
    throw new Error(
      'unit-source: this chart declares no containers (O-44). Containers come from the '
      + 'chart alone — the spine is flat by ruling — so a unit whose chart omits them '
      + 'has nothing to render, and inventing a default here would make every edition '
      + 'silently agree with the spine\'s shape.');
  }
  const out = [];
  let expected = 1;
  for (const g of groups) {
    if (typeof g?.label !== 'string' || !Number.isInteger(g.from) || !Number.isInteger(g.to)) {
      throw new Error(`unit-source: malformed container ${JSON.stringify(g)} — needs a label and an integer range`);
    }
    if (g.to < g.from) {
      throw new Error(`unit-source: container ${JSON.stringify(g.label)} runs backwards (${g.from}..${g.to})`);
    }
    if (g.from !== expected) {
      throw new Error(
        `unit-source: containers are not contiguous — ${JSON.stringify(g.label)} starts at ${g.from}, `
        + `expected ${expected}. A ${g.from > expected ? 'gap leaves leaves unrenderable' : 'overlap renders leaves twice'}, `
        + 'and a chart that does either is a botched increment (O-44).');
    }
    out.push({ label: g.label, from: g.from, to: g.to, count: g.to - g.from + 1 });
    expected = g.to + 1;
  }
  if (Number.isInteger(leaves) && expected - 1 !== leaves) {
    throw new Error(
      `unit-source: containers cover ${expected - 1} leaves but the unit has ${leaves}. `
      + 'Every leaf belongs to exactly one container or the increment is unfinished.');
  }
  return out;
}
