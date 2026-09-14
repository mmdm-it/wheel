// NO DIMENSION BUTTON AT ROOT (Howell from the LAN, 2026-08-23: "I don't see
// the Dimension Button Globe when I migrate OUT to root").
//
// O-96 carries his spec in his own words: **the Dimension Button is visible
// and functional at root, or at a leaf** — two cases, and root is the first
// of them. H-29 says what root IS: the level whose child pyramid holds books,
// whose focus ring holds the edition's own top-level division of itself.
// Those ring items are `level: 'testament'`.
//
// The adapter answered `item.level === 'bibleRoot'`, and `bibleRoot` is the
// SINGLE-NODE gateway ring (BIBLIA SACRA LATINA) from before H-29 — reachable
// only when the host boots the volume at `level: 'root'`. This volume's data
// declares no `startup`, so the level falls through to `'verse'`, `hasRoot`
// is false, and the ascent from the division ring has nowhere further to go.
// The division ring IS the top, and the one line that decides whether the
// globe appears had never been told.
//
// It is H-29's vocabulary failing to reach a line that H-29 made decisive —
// the same shape as O-87, where `toRoot()`'s default edition left the second
// edition's book ring empty.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';
import { buildBibleTestaments } from '../src/adapters/volume-helpers.js';

const CHART = seats => ({ seats, groups: [{ label: '1', from: 1, to: seats.length }] });
const CHARTS = {
  'h-1|HEB': CHART([{ label: '1', utterances: ['a1'] }]),
  'h-2|HEB': CHART([{ label: '1', utterances: ['b1'] }])
};
const HELD = { HEB: ['h-1', 'h-2'] };
const volume = {
  units: ['h-1', 'h-2'].map(id => ({ id })),
  editions: [{ code: 'HEB' }],
  chartFor: (u, e) => CHARTS[`${u}|${e}`] || null,
  spineFor: () => ({ utterances: [] }),
  booksFor: e => (HELD[e] || []).map(id => ({ id })),
  bookOrderFor: e => [...(HELD[e] || [])],
  divisionsFor: () => [{ label: 'תנ״ך', image: null, from: 1, to: 2, books: ['h-1', 'h-2'] }]
};
const manifest = (() => {
  const m = { Gutenberg_Bible: { testaments: {} } };
  Object.defineProperty(m, '__wallVolume', { value: volume, enumerable: false });
  return m;
})();

// The options the host actually builds for this volume: the data declares no
// `startup`, so `level` falls through to 'verse' — which is what makes the
// division ring the top of the chain.
const handlers = (level = 'verse') => bibleAdapter.createHandlers({
  manifest, namesMap: {}, options: { level, activeEdition: 'HEB', translation: 'HEB' }
});

describe('the globe is at every level (O-129) — the front door of O-96 is retired', () => {
  it('the adapter declares no front door: the host shows the globe wherever the volume has a dimension', () => {
    const h = handlers();
    assert.equal(h.showsDimensionAt, undefined,
      'O-96 gave the globe two homes, root and the leaf; under O-129 it is at every level, and the predicate that owned the root half is gone');
  });

  it('SEATS THE PRIMARY AT A LEAF FROM ANYWHERE — the basement\'s jump when the ring up does not hold the bookmark', () => {
    const h = handlers('verse');
    let adopted = null, parents = null;
    const app = { setPrimaryItems: (items, index) => { adopted = { items, index, landed: items[index] }; }, setParentButtons: p => { parents = p; } };
    assert.equal(h.seatAtLeaf('b1', app), true, 'HEB seats leaf b1');
    assert.ok(adopted.landed?.meta?.utterances?.includes('b1'), 'the ring is set at the item carrying the leaf');
    assert.equal(adopted.landed.level, 'verse');
    assert.deepEqual(parents, { showOuter: true });
    adopted = null;
    assert.equal(h.seatAtLeaf('nope', app), false, 'a leaf this edition does not seat: false, and the ring is left alone');
    assert.equal(adopted, null);
    assert.equal(h.seatAtLeaf('a1', null), false, 'no app, no seating');
  });
});
