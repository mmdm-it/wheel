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

describe('the globe is live at root (O-96, H-29)', () => {
  it('THE DIVISION RING IS ROOT, AND THE GLOBE SHOWS THERE', () => {
    const h = handlers();
    const [item] = buildBibleTestaments(manifest, {}, { edition: 'HEB' }).items;
    assert.equal(item.level, 'testament', 'the ring root lands on is built at this level');
    assert.equal(Boolean(h.showsDimensionAt(item)), true,
      'no globe here is no way into Dimension Mode from root — Howell, from the LAN');
  });

  it('and it shows for EVERY division, not merely the first', () => {
    const h = handlers();
    for (const item of [{ level: 'testament', id: 'division-0' }, { level: 'testament', id: 'division-1' }]) {
      assert.equal(Boolean(h.showsDimensionAt(item)), true, `${item.id} is root too`);
    }
  });

  it('THE GATEWAY ROOT KEEPS ITS GLOBE — the older door is narrowed, not closed', () => {
    const h = handlers('root');
    assert.equal(Boolean(h.showsDimensionAt({ level: 'bibleRoot' })), true,
      'a host that boots the volume at root still reaches BIBLIA SACRA LATINA');
  });

  it('AND NOWHERE ELSE: the globe stays hidden on the rings between root and the leaf', () => {
    const h = handlers();
    for (const level of ['book', 'chapter']) {
      assert.equal(Boolean(h.showsDimensionAt({ level })), false,
        `${level}: the globe hides while drilling — it is a question only at root and at a leaf`);
    }
    // The leaf's own case is not this predicate's business: the host shows the
    // globe at a settled verse because the Detail Sector is up, which is the
    // OTHER half of O-96's two cases.
    assert.equal(Boolean(h.showsDimensionAt({ level: 'verse' })), false,
      'the verse case is the host\'s (detailSectorVisible), not the front door\'s');
  });
});
