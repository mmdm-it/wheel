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
