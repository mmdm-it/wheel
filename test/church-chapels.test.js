// THE CHAPELS ARE A STRATUM (O-297, Howell 2026-11-12: "Chapel is a different
// kind of sorting. It's not a layer in a hierarchy. It's a room"). The
// Church's tertiary stratum is its rooms in his order; its secondary is the
// chosen room's own option; a room not yet built stands hollow, and settling
// on it changes nothing but the plane shown behind it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { churchStrata, CHURCH_CHAPELS } from '../src/adapters/calendar-adapter.js';
import { volumeConfigs, CHURCH_DRESSES } from '../src/volume-configs.js';

describe('the Church\'s chapels', () => {
  it('are its tertiary stratum, in the order Howell approved, the calendar alone built', () => {
    const [, chapels] = churchStrata();
    assert.equal(chapels.id, 'tertiary');
    assert.deepEqual(chapels.items(), ['calendar', 'prayers', 'catechism', 'dictionary', 'atlas', 'whoswho']);
    assert.deepEqual(CHURCH_CHAPELS.filter(c => c.live).map(c => c.id), ['calendar']);
    assert.equal(chapels.classFor('calendar'), '');
    assert.equal(chapels.classFor('atlas'), 'is-coming');
    assert.equal(volumeConfigs.church.strata, churchStrata);
  });
  it('the secondary is the shown chapel\'s options: the reckonings under the calendar, nothing under a room not built', () => {
    const [options, chapels] = churchStrata();
    assert.equal(options.id, 'secondary');
    assert.ok(options.items().includes('gregorian'));
    assert.equal(chapels.select('prayers'), true, 'the lens may rest on a room not built');
    assert.deepEqual(options.items(), []);
    assert.equal(chapels.selected(), 'prayers');
    chapels.select('calendar');
    assert.ok(options.items().includes('julian'));
  });
  it('wears colours of its own, never the Bible\'s parchment', () => {
    for (const d of Object.values(CHURCH_DRESSES)) assert.notEqual(d.bg, volumeConfigs.bible.palette.bg);
    assert.ok(CHURCH_DRESSES[Object.keys(CHURCH_DRESSES)[0]]);
  });
});
