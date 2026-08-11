// The dev fixture route. It is scaffolding, so the cells are mostly about it
// staying OFF — an inert rig is the normal state and the only safe default.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readDevFixtureRoute } from '../src/core/dev-fixture-route.js';

const DECLARE = { unitId: 'bc22df', replaces: { unit: 'GENE', container: '1' }, edition: 'DRA' };
const lan = { hostname: '192.168.88.167' };
const pub = { hostname: 'mmdm.it' };

describe('dev-fixture-route — on only when everything says so', () => {
  it('turns on for a declared fixture, on the LAN, when asked', () => {
    const r = readDevFixtureRoute({ search: '?fixture=h11', location: lan, declare: DECLARE });
    assert.equal(r.unitId, 'bc22df');
    assert.deepEqual(r.replaces, { unit: 'GENE', container: '1' });
  });

  it('PINS the edition — the fixture has two, the corpus has fourteen', () => {
    // Falling through to the legacy unit on an edition the fixture lacks would
    // make a unit half-present along the EDITION dimension: a coexistence mode
    // O-42's all-or-nothing rule never contemplated.
    const r = readDevFixtureRoute({ search: '?fixture=h11', location: lan, declare: DECLARE });
    assert.equal(r.edition, 'DRA');
    assert.equal(r.pinned, true);
  });
});

describe('dev-fixture-route — inert is the normal state', () => {
  const off = (why, opts) => it(why, () => assert.equal(readDevFixtureRoute(opts), null));

  off('OFF the LAN, even when asked and declared',
    { search: '?fixture=h11', location: pub, declare: DECLARE });
  off('with NO location at all — the gate fails closed',
    { search: '?fixture=h11', location: null, declare: DECLARE });
  off('on the LAN but not asked',
    { search: '', location: lan, declare: DECLARE });
  off('asked with the wrong value',
    { search: '?fixture=1', location: lan, declare: DECLARE });
  off('asked on the LAN but nothing declared — no rig without a declaration',
    { search: '?fixture=h11', location: lan, declare: null });
  off('a declaration missing its substitution is not a rig',
    { search: '?fixture=h11', location: lan, declare: { unitId: 'bc22df', edition: 'DRA' } });
  off('a declaration missing its edition, since the edition is pinned by ruling',
    { search: '?fixture=h11', location: lan, declare: { unitId: 'bc22df', replaces: { unit: 'GENE' } } });
});

describe('dev-fixture-route — the join is DECLARED, never inferred', () => {
  it('takes the legacy address it stands in for from the declaration alone', () => {
    // Nothing derives the join from an id, a name or a count. It is
    // scaffolding, written down as scaffolding, and it dies with this file.
    const r = readDevFixtureRoute({
      search: '?fixture=h11', location: lan,
      declare: { unitId: 'zzz', replaces: { unit: 'SOMETHING_ELSE', container: '9' }, edition: 'VUL' }
    });
    assert.deepEqual(r.replaces, { unit: 'SOMETHING_ELSE', container: '9' });
    assert.equal(r.edition, 'VUL', 'the rig believes what it is told, and tells nobody a story about ids');
  });
});
