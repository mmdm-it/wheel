// THE BASEMENT RANKS A BOOK BY ITS SHELF, NOT BY THE SHARD LIST (O-275,
// Howell's sketch 2026-11-08: "the two Maccabees bookmarks are not sorted
// correctly. They should be further up the ring as the last of the Old
// Testament books"). The shard list is W-96's superset in no order; the
// shelf is the edition's own order. A seat the edition up holds is ranked on
// the edition up's shelf, so a bookmark kept in another edition and a
// landmark seated here are measured with one rule; a book the edition up
// lacks falls back to its own shelf. And the adapter places a bare LEAF on
// the edition up (seatPlace), so a kept seat's old place can be asked again.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';

const CHART = seats => ({ seats, groups: [{ label: '1', from: 1, to: seats.length }] });
// Two editions, three books, and a shard list in the WRONG order on purpose.
const CHARTS = {
  'gen|A': CHART([{ label: '1', utterances: ['u-gen' ] }]),
  'mac|A': CHART([{ label: '1', utterances: ['u-mac' ] }]),
  'mat|A': CHART([{ label: '1', utterances: ['u-mat' ] }]),
  'gen|B': CHART([{ label: '1', utterances: ['u-gen' ] }]),
  'mac|B': CHART([{ label: '1', utterances: ['u-mac' ] }]),
  'mat|B': CHART([{ label: '1', utterances: ['u-mat' ] }]),
  'tob|B': CHART([{ label: '1', utterances: ['u-tob' ] }])
};
const SHELF = {
  A: [{ id: 'gen', shards: ['s-gen'], order: 0 }, { id: 'mac', shards: ['s-mac'], order: 1 }, { id: 'mat', shards: ['s-mat'], order: 2 }],
  B: [{ id: 'gen', shards: ['s-gen'], order: 0 }, { id: 'tob', shards: ['s-tob'], order: 1 }, { id: 'mac', shards: ['s-mac'], order: 2 }, { id: 'mat', shards: ['s-mat'], order: 3 }]
};
const volume = {
  shards: ['s-mat', 'u', 's-gen', 's-tob', 's-mac'].map(id => ({ id })),   // chance order, as the real list stands
  editions: [{ code: 'A' }, { code: 'B' }],
  chartFor: (u, e) => CHARTS[`${u}|${e}`] || null,
  spineFor: () => ({ utterances: [] }),
  booksFor: e => SHELF[e] || [],
  editionOf: id => (id === 'tob' ? 'B' : 'A'),
  bookOrderFor: e => (SHELF[e] || []).map(b => b.id),
  divisionsFor: e => [{ label: 'all', image: null, from: 1, to: (SHELF[e] || []).length, books: (SHELF[e] || []).map(b => b.id) }]
};
const manifest = (() => {
  const m = { Gutenberg_Bible: { testaments: {} } };
  Object.defineProperty(m, '__wallVolume', { value: volume, enumerable: false });
  return m;
})();
const handlers = (edition = 'A') => bibleAdapter.createHandlers({ manifest, namesMap: {}, options: { level: 'verse', activeEdition: edition, translation: edition } });
const land = (h, leaf) => { let landed = null; h.seatAtLeaf(leaf, { setPrimaryItems: (items, index) => { landed = items[index]; }, setParentButtons() {} }); return landed; };

describe('the basement\'s order comes from the shelf (O-275)', () => {
  it('ranks books in the edition\'s own order, whatever the shard list says', () => {
    const h = handlers('A');
    const ranks = ['u-gen', 'u-mac', 'u-mat'].map(leaf => h.seatOrder(land(h, leaf)).rank[0]);
    assert.deepEqual(ranks, [0, 1, 2], 'Genesis, Maccabees, Matthew — not the shard list\'s Matthew, Genesis, Maccabees');
  });
  it('places a bare leaf on the edition up, and answers null for one it does not hold', () => {
    const h = handlers('A');
    assert.deepEqual(h.seatPlace('u-mac').rank, [1, 1, 1]);
    assert.equal(h.seatPlace('u-tob'), null, 'edition A has no Tobit');
    assert.equal(h.seatPlace(null), null);
  });
  it('with another edition up, the same leaf is ranked on THAT shelf', () => {
    const h = handlers('B');
    assert.equal(h.seatPlace('u-mac').rank[0], 2, 'Maccabees is third on B\'s shelf, after Tobit');
    assert.equal(h.seatPlace('u-tob').rank[0], 1);
  });
});
