// FOUR TIERS AND ONE STANDOUT (O-133, O-134): the sky's stars are sized
// against each other, not against the volume, and exactly one leads.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { relativeTiers, largestChildIndex, dayKey } from '../src/pyramid/volume-pyramid.js';

const items = ranks => ranks.map((r, i) => ({ id: `n${i}`, order: i, r }));
const rankOf = it => it.r;
const tiers = out => out.map(it => it.prominence ?? '-').join('');
const nodes = out => out.map(item => ({ item }));

describe('four tiers and one standout (O-134)', () => {
  it('one standout, its equals, the rest of the ranked, the never-read', () => {
    const out = relativeTiers(items([40, 28, 51, 33, 30, null, 45, 33]), rankOf, { day: 'd' });
    assert.equal(tiers(out), '31333433', 'best is the standout; every other ranked node 3; the unranked 4');
    assert.equal(largestChildIndex(nodes(out)), 1, 'and the down-swipe drills into it');
  });

  it('a block read at Mass: the day picks ONE of the tied verses, the others are its equals', () => {
    const out = relativeTiers(items([7, 7, 7, null, 12]), rankOf, { day: '2026-9-15' });
    const t = tiers(out);
    assert.equal(t.split('1').length - 1, 1, 'exactly one standout');
    assert.match(t, /^[12][12][12]43$/, 'the tied three are 1 or 2; the unread 4; the lesser-read 3');
    assert.equal(largestChildIndex(nodes(out)) < 3, true);
  });

  it('the same day picks the same standout; another day may pick another', () => {
    const one = tiers(relativeTiers(items([7, 7, 7, 7, 7, 7, 7, 7]), rankOf, { day: '2026-9-15' }));
    assert.equal(one, tiers(relativeTiers(items([7, 7, 7, 7, 7, 7, 7, 7]), rankOf, { day: '2026-9-15' })), 'stable within the day');
    const days = new Set(Array.from({ length: 40 }, (_, k) => tiers(relativeTiers(items([7, 7, 7, 7, 7, 7, 7, 7]), rankOf, { day: `2026-10-${k + 1}` }))));
    assert.ok(days.size > 1, 'and the standout moves across days');
    assert.match(dayKey(new Date(2026, 8, 15)), /^2026-9-15$/, 'the day is the local calendar day');
  });

  it('a sky with no ranks is untouched; a node already wearing an editorial tier keeps it', () => {
    const bare = items([null, null]);
    assert.equal(relativeTiers(bare, rankOf), bare);
    assert.equal(relativeTiers(bare, null), bare);
    const out = relativeTiers([{ id: 'a', prominence: 2, r: 1 }, { id: 'b', r: 5 }, { id: 'c', r: 6 }], rankOf, { day: 'd' });
    assert.equal(tiers(out), '213', 'the declared tier stands; the standout is chosen among the rest');
  });
});
