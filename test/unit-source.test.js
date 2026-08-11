// The coexistence seam (O-42). The cell that matters most is the SCREAM.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createUnitSource } from '../src/core/unit-source.js';

const LEVELS = ['unit', 'group', 'leaf'];
const EDITIONS = ['AAA', 'BBB'];

// A probe over a declared set of paths. `read: true` returns parsed content
// for the index; everything else is a presence question.
const probeOver = present => (p, opts) => {
  if (opts?.read) return present.has(p) ? { units: ['migrated-1'] } : null;
  return present.has(p);
};

const complete = () => new Set([
  'charts/AAA/index.json', 'charts/BBB/index.json',
  'spine/migrated-1.json',
  'text/AAA/migrated-1.json', 'text/BBB/migrated-1.json',
  'charts/AAA/migrated-1.json', 'charts/BBB/migrated-1.json'
]);

const make = present => createUnitSource({
  levels: LEVELS, editions: EDITIONS, exists: probeOver(present)
});

describe('unit-source — the descriptor hides which layout answered', () => {
  it('a migrated unit describes itself in the current layout', () => {
    const d = make(complete()).describe('migrated-1');
    assert.equal(d.layout, 'current');
    assert.equal(d.textAt('AAA'), 'text/AAA/migrated-1.json');
    assert.equal(d.chartAt('BBB'), 'charts/BBB/migrated-1.json');
  });

  it('an unmigrated unit describes itself in the legacy layout, same shape', () => {
    const d = make(complete()).describe('old-7', { file: 'chapters/OLD/007.json', leaves: 12 });
    assert.equal(d.layout, 'legacy');
    assert.equal(d.textAt('AAA'), 'chapters/OLD/007.json');
    // The surfaces match, which is what lets 41 sites stop caring.
    for (const key of ['unitId', 'layout', 'leaves', 'textAt', 'chartAt', 'spineAt']) {
      assert.ok(key in d, `legacy descriptor is missing ${key}`);
    }
  });

  it('migration is DERIVED from the index, not declared by the caller', () => {
    const src = make(complete());
    assert.equal(src.isMigrated('migrated-1'), true);
    assert.equal(src.isMigrated('old-7'), false);
  });
});

describe('unit-source — a half-present unit is IMPOSSIBLE to render', () => {
  // Howell, 2026-08-11: all-or-nothing, loudly. The tempting kindness — fall
  // back to the old layout — would render a unit the increment did not
  // finish, from the data it was replacing, and it would look like success.
  const withoutOne = missing => {
    const s = complete(); s.delete(missing); return s;
  };

  it('SCREAMS when the spine is missing', () => {
    assert.throws(() => make(withoutOne('spine/migrated-1.json')).describe('migrated-1'),
      /INCOMPLETE — missing spine/);
  });

  it('SCREAMS when one edition\'s text is missing', () => {
    assert.throws(() => make(withoutOne('text/BBB/migrated-1.json')).describe('migrated-1'),
      /INCOMPLETE — missing text\/BBB/);
  });

  it('SCREAMS when one edition\'s chart is missing', () => {
    assert.throws(() => make(withoutOne('charts/AAA/migrated-1.json')).describe('migrated-1'),
      /INCOMPLETE — missing chart\/AAA/);
  });

  it('NEVER falls back to legacy for a listed-but-incomplete unit', () => {
    // Even handed a perfectly good legacy source, it must refuse.
    assert.throws(
      () => make(withoutOne('spine/migrated-1.json'))
        .describe('migrated-1', { file: 'chapters/OLD/001.json', leaves: 31 }),
      /all-or-nothing/);
  });
});

describe('unit-source — the surface is volume-neutral by construction', () => {
  it('REFUSES to be built without declared levels', () => {
    // The unit is declared, never assumed: assuming one is how a volume's own
    // word for its addressing level gets into engine-general code.
    assert.throws(() => createUnitSource({ editions: EDITIONS, exists: () => true }),
      /must DECLARE its levels/);
  });

  it('takes its unit level from the declaration, whatever the volume calls it', () => {
    const a = createUnitSource({ levels: ['unit', 'group'], editions: [], exists: () => true });
    const b = createUnitSource({ levels: ['era', 'cycle'], editions: [], exists: () => true });
    assert.equal(a.unitLevel, 'unit');
    assert.equal(b.unitLevel, 'era', 'a different volume declares a different unit, and the seam simply believes it');
  });

  it('REFUSES to be built without a presence probe — presence is measured, not declared', () => {
    assert.throws(() => createUnitSource({ levels: LEVELS, editions: EDITIONS }),
      /presence is measured/);
  });
});
