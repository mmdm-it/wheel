// TIERS AMONG SIBLINGS (O-133): the sky's stars are sized against each other,
// not against the volume — the best rank in the sky is the large star
// wherever on the volume's scale it falls.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { relativeTiers, largestChildIndex } from '../src/pyramid/volume-pyramid.js';

const items = ranks => ranks.map((r, i) => ({ id: `n${i}`, order: i, r }));
const rankOf = it => it.r;
const tiers = out => out.map(it => it.prominence ?? '-').join('');

describe('relative tiers (O-133)', () => {
  it('a sky whose best rank is 28 still has a largest star, and the next three are medium', () => {
    const out = relativeTiers(items([40, 28, 51, 33, 30, null, 45, 33]), rankOf);
    assert.equal(tiers(out), '-1-22--2', 'best is tier 1; 30, 33, 33 are tier 2 (a tie at the cut is kept); 40, 45, 51 and the unranked wear nothing');
    assert.equal(largestChildIndex(out.map(item => ({ item }))), 1, 'and the down-swipe drills into it');
  });

  it('a sky read whole in one reading — every sibling the same rank — has no largest star', () => {
    const out = relativeTiers(items([7, 7, 7, null]), rankOf);
    assert.equal(tiers(out), '----');
    assert.equal(largestChildIndex(out.map(item => ({ item }))), 0, 'the swipe falls to the first');
  });

  it('two ranked siblings: one large, one medium; a sky with no ranks is untouched', () => {
    assert.equal(tiers(relativeTiers(items([null, 12, null, 9]), rankOf)), '-2-1');
    const bare = items([null, null]);
    assert.equal(relativeTiers(bare, rankOf), bare);
    assert.equal(relativeTiers(bare, null), bare);
  });

  it('a node that already wears an editorial tier keeps it and does not enter the ranking', () => {
    const out = relativeTiers([{ id: 'a', prominence: 1, r: 99 }, { id: 'b', r: 5 }, { id: 'c', r: 6 }], rankOf);
    assert.equal(tiers(out), '112');
  });
});
