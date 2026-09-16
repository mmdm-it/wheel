// AN EDITION CHANGE AT ROOT (O-95, Howell 2026-08-23).
//
// H-29 ruled the shape of root: the Focus Ring holds the edition's OWN
// division of itself, the Child Pyramid holds its books, and books are never
// on the ring — which is the whole reason the level exists, so that changing
// edition there never animates a rearrangement of books. Both are fixed
// vessels: they empty and refill with the new edition's declaration.
//
// The code did not do it. `reseatOnEditionChange` answered only at a verse or
// a chapter and returned "stay put" at root, while the store, the active
// edition, the names table and the corner emblem all committed — the hybrid
// the function's own comment calls "the one outcome worse than either
// edition", arriving at the top after O-76 fixed it at the leaf.
//
// THE THREE SHAPES, which is how Howell put the question: an OT-only edition,
// an NT-only edition, and one holding both. Six switches between them, and
// the landing rule is O-76's one level up — the division that seats the
// leaves the reader's division seated, else the new edition's first.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';
import { buildBibleTestaments } from '../src/adapters/volume-helpers.js';
import { buildBibleBookCousinChain } from '../src/navigation/cousin-builder.js';

// Books, per edition, with per-edition ids over shared shards (O-92).
// OLD leaves live in shards a/b; NEW leaves in shard c.
const CHART = seats => ({ seats, groups: [{ label: '1', from: 1, to: seats.length }] });
const CHARTS = {
  // A — Old Testament only, one division.
  'h-1|A': CHART([{ label: '1', utterances: ['a1'] }, { label: '2', utterances: ['a2'] }]),
  'h-2|A': CHART([{ label: '1', utterances: ['b1'] }]),
  // B — New Testament only, one division.
  'g-1|B': CHART([{ label: '1', utterances: ['c1'] }, { label: '2', utterances: ['c2'] }]),
  // C — both testaments, its own book ids, over the same leaves as A and B.
  'v-1|C': CHART([{ label: '1', utterances: ['a1'] }, { label: '2', utterances: ['a2'] }]),
  'v-2|C': CHART([{ label: '1', utterances: ['b1'] }]),
  'v-3|C': CHART([{ label: '1', utterances: ['c1'] }, { label: '2', utterances: ['c2'] }])
};
const HELD = { A: ['h-1', 'h-2'], B: ['g-1'], C: ['v-1', 'v-2', 'v-3'] };
const DIVISIONS = {
  A: [{ label: 'תנ״ך', books: ['h-1', 'h-2'] }],
  B: [{ label: 'Ἡ Καινὴ Διαθήκη', books: ['g-1'] }],
  C: [{ label: 'Vetus Testamentum', books: ['v-1', 'v-2'] },
    { label: 'Novum Testamentum', books: ['v-3'] }]
};

const volume = {
  units: ['h-1', 'h-2', 'g-1', 'v-1', 'v-2', 'v-3'].map(id => ({ id })),
  editions: [{ code: 'A' }, { code: 'B' }, { code: 'C' }],
  chartFor: (unit, ed) => CHARTS[`${unit}|${ed}`] || null,
  spineFor: () => ({ utterances: [] }),
  booksFor: ed => (HELD[ed] || []).map(id => ({ id })),
  bookOrderFor: ed => [...(HELD[ed] || [])],
  divisionsFor: ed => (DIVISIONS[ed] || []).map((d, i) => ({
    label: d.label, image: null, from: i + 1, to: i + 1, books: [...d.books]
  }))
};

const manifest = (() => {
  // The book ring walks the legacy scaffold for its roster (cousin-builder)
  // and the wall volume for membership: every edition's books are listed,
  // each edition sees only its own (O-71).
  const m = { Gutenberg_Bible: { testaments: {
    'division-0': { sort_number: 0, books: { 'h-1': { sort_number: 0 }, 'h-2': { sort_number: 1 }, 'v-1': { sort_number: 2 }, 'v-2': { sort_number: 3 } } },
    'division-1': { sort_number: 1, books: { 'g-1': { sort_number: 0 }, 'v-3': { sort_number: 1 } } }
  } } };
  Object.defineProperty(m, '__wallVolume', { value: volume, enumerable: false });
  return m;
})();

// The root ring as the parent handler builds it, for one edition.
const ringOf = edition => buildBibleTestaments(manifest, {}, { edition }).items.filter(Boolean);

// The host's shape: the edition has ALREADY committed when the reseat runs.
const reseatTo = (edition, selected) => {
  const h = bibleAdapter.createHandlers({
    manifest, namesMap: {}, options: { activeEdition: edition, translation: edition }
  });
  let adopted = null;
  const app = {
    setPrimaryItems: (items, index) => { adopted = { items, index, landed: items[index] }; },
    glideToItem: () => {}, refreshPyramid: () => {}
  };
  return { returned: h.reseatOnEditionChange({ selected, app }), adopted };
};

describe('the book ring refills on an edition change (O-129)', () => {
  // Standing on A's book h-1 (leaves a1, a2). C seats the same leaves in
  // v-1, under its Vetus Testamentum; B seats none of them.
  const bookOf = (edition, bookId) => {
    const ring = buildBibleBookCousinChain(manifest, { bookId, testamentId: 'division-0', initialItemId: bookId, names: {}, edition }).items.filter(Boolean);
    return ring.find(b => b.id === bookId) || ring[0];
  };
  it('lands on the book of the new edition that seats the reader\'s book\'s leaves', () => {
    const { returned, adopted } = reseatTo('C', bookOf('A', 'h-1'));
    assert.equal(returned, true, 'adopt — A\'s books must not stand under C');
    // A cousin chain carries null gaps between families; the seats are what count.
    assert.deepEqual(adopted.items.filter(Boolean).map(i => i.id), ['v-1', 'v-2', 'v-3'], 'C\'s books — the ring is the cousin chain of the whole volume');
    assert.equal(adopted.landed?.id, 'v-1', 'the book seating a1');
  });
  it('an edition that seats nothing of it lands on its own first book', () => {
    const { returned, adopted } = reseatTo('B', bookOf('A', 'h-1'));
    assert.equal(returned, true);
    assert.deepEqual(adopted.items.filter(Boolean).map(i => i.id), ['g-1']);
    assert.equal(adopted.landed?.id, 'g-1');
  });
});

describe('the root ring refills on an edition change (O-95)', () => {
  it('THE RING REFILLS WITH THE NEW EDITION\'S OWN DIVISION', () => {
    // Standing at root in A (Old Testament only). Commit C, which has two.
    const { returned, adopted } = reseatTo('C', ringOf('A')[0]);
    assert.equal(returned, true,
      'it must ADOPT — returning false leaves A\'s division on the ring under C');
    assert.deepEqual(adopted.items.map(i => i.name),
      ['Vetus Testamentum', 'Novum Testamentum'],
      'the vessel empties and refills with C\'s own declaration, in C\'s own words');
  });

  it('and lands on the division holding the leaves the reader\'s division held', () => {
    // A → C lands in the Old Testament; B → C lands in the New.
    assert.equal(reseatTo('C', ringOf('A')[0]).adopted.landed.name, 'Vetus Testamentum');
    assert.equal(reseatTo('C', ringOf('B')[0]).adopted.landed.name, 'Novum Testamentum');
  });

  it('C\'s NEW TESTAMENT crossing to the OT-only edition lands at its beginning (O-76 one level up)', () => {
    const novum = ringOf('C')[1];
    assert.equal(novum.name, 'Novum Testamentum');
    const { returned, adopted } = reseatTo('A', novum);
    assert.equal(returned, true, 'adopt, never stay put — A shares nothing with the Novum');
    assert.deepEqual(adopted.items.map(i => i.name), ['תנ״ך']);
    assert.equal(adopted.index, 0, 'the one place A has to offer');
  });

  it('C\'s OLD TESTAMENT crossing to the NT-only edition does the same', () => {
    const { returned, adopted } = reseatTo('B', ringOf('C')[0]);
    assert.equal(returned, true);
    assert.deepEqual(adopted.items.map(i => i.name), ['Ἡ Καινὴ Διαθήκη']);
    assert.equal(adopted.index, 0);
  });

  it('THE MATCHING PAIRS ARE INVISIBLE AT REST: one node out, one node in, same leaves', () => {
    // A → B and B → A: each has exactly one division, and they share nothing.
    for (const [from, to, label] of [['A', 'B', 'Ἡ Καινὴ Διαθήκη'], ['B', 'A', 'תנ״ך']]) {
      const { returned, adopted } = reseatTo(to, ringOf(from)[0]);
      assert.equal(returned, true, `${from} → ${to} adopts`);
      assert.deepEqual(adopted.items.map(i => i.name), [label],
        `${to} shows its own one division and no ghost of ${from}`);
    }
  });

  it('THE DIVISION CARRIES ITS OWN LEAVES, so the landing is never recovered from an id (H-2)', () => {
    // `division-0` means nothing across editions — the ids are positional.
    // What travels is the utterance, exactly as it does at a verse (W-21).
    for (const edition of ['A', 'B', 'C']) {
      for (const item of ringOf(edition)) {
        assert.ok(Array.isArray(item.meta?.utterances) && item.meta.utterances.length,
          `${edition}/${item.name}: a division ring item carries the leaves it seats`);
      }
    }
  });
});

// A CHAPTER RING RESEATS WITHOUT A VERSE CHAIN BEHIND IT (O-146). The reader
// reached the chapter ring in A without entering a verse; the edition changes
// to C. The old code anchored on the previous verse chain, found none, and
// refused — leaving A's chapters under C's names, and the parent button
// reading a raw id.
describe('the chapter ring refills on an edition change with no verse chain (O-146)', () => {
  it('anchors on the chapter\'s own chart and lands on the new edition\'s chapter holding its leaves', () => {
    const selected = { id: 'h-1/1', name: '1', level: 'chapter', parentId: 'h-1', meta: { bookId: 'h-1', chapterKey: '1', chapterLabel: '1' } };
    const { returned, adopted } = reseatTo('C', selected);
    assert.equal(returned, true, 'no verse chain is no reason to leave the old edition\'s chapters standing');
    assert.ok(adopted, 'the ring was refilled');
    const landed = adopted.landed;
    assert.equal(landed?.level, 'chapter');
    assert.equal(landed?.meta?.bookId ?? landed?.parentId, 'v-1', 'C\'s book seating a1');
  });
});
