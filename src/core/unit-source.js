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
    if (!listed || !Array.isArray(listed.units)) continue;
    for (const id of listed.units) migrated.add(id);
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

// THE THREE LEGACY FIELD HELPERS ARE DELETED (H-14, 2026-08-12).
//
// `legacyTextFile`, `legacyUnitId` and `legacyOrdinal` read `_external_file`,
// `book_key` and `sequence` — the identifiers H-11 retires — and they are
// gone with the last code that called them.
//
// They were worth building. Funnelling six hand-written expressions into one
// looked like tidying at the time; it turned out to be the splice point, and
// then the deletion point, because a field read in one place retires in one
// place. The same six expressions spread across six callers would have made
// this an excavation instead of a diff.
//
// `legacyOrdinal` is the one to remember. Its whole point was the operator:
// its single reader used `??` and not `||`, because a sequence can legitimately
// be 0 and `||` would have discarded it as falsy. Normalising that to the more
// common operator would have been a silent off-by-one in a migration nobody
// was watching — the tempting tidy being the defect, which is what the freeze
// was for.

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

// THE WALK'S ENTRIES FOR A MIGRATED UNIT (O-42/O-44, phase 1a).
//
// The reading-order walk enumerates CONTAINERS. For a legacy unit they come
// from the manifest; for a migrated one they come from here, and the two
// produce the same SHAPE so the walk cannot tell which answered — which is the
// descriptor's whole purpose, applied one level down.
//
// `replaces` is the rig's declared substitution (Howell's ruling (a)): the
// legacy address this unit stands in for, so the entries land where the reader
// already navigates. It is scaffolding and it is passed in, never inferred —
// when 1b makes the unit real, the caller stops supplying it and these entries
// carry the unit's own identity instead.
export function unitEntriesFromChart(descriptor, chart, { replaces = null, leaves = null } = {}) {
  if (!descriptor || descriptor.layout !== 'current') {
    throw new Error('unit-source: entries come from a CURRENT-layout descriptor — a legacy unit is enumerated from the manifest, as it always was');
  }
  const containers = projectContainers(chart, { leaves });
  return containers.map((c, i) => ({
    // The address the reader navigates. Under the rig it is the legacy one, so
    // the diff can be empty; without the rig it is the unit's own.
    unitId: replaces?.unit || descriptor.unitId,
    containerKey: replaces && containers.length === 1 ? replaces.container : c.label,
    // The LABEL is what prints, always the edition's own quotation (H-2) —
    // never the substituted address, which is a routing detail and not
    // something the reader should ever be shown.
    label: c.label,
    from: c.from,
    to: c.to,
    leafCount: c.count,
    order: i,
    layout: 'current'
  }));
}
