// WHERE THE READER LANDS WHEN THE EDITION CHANGES (W-21, O-76).
//
// NOTHING HAS EVER TESTED THIS FUNCTION, which is why it has now produced two
// reader-visible defects that both reached Howell's phone before anyone here
// saw them. It is the piece that carries a reader across a change of edition,
// and it is exactly the piece a fixture-shaped suite skips: it needs two
// editions, a real chain from each, and a reader standing somewhere.
//
// THE CASE THAT BROKE. The Greek New Testament and the Hebrew Bible share not
// one utterance. A reader booting into Genesis and choosing the Greek from the
// launch plane asks this function to carry them somewhere that does not exist.
// It used to answer "stay put" and return false — leaving the store, the
// active edition, the names table and the corner emblem committed to the Greek
// while the ring still held the Hebrew's seats. That is the hybrid this
// function's own comment calls the one outcome worse than either edition, and
// the position filter then struck the edition the reader had just chosen off
// the chooser, because it read their unchanged Hebrew verse.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';
import { buildBibleVerseChain } from '../src/navigation/cousin-builder.js';

// Two editions over four books. HEB holds A and B, GRC holds C and D, and no
// utterance is in both — the corpus as it actually stands today.
const CHART = seats => ({ seats, groups: [{ label: '1', from: 1, to: seats.length }] });
const CHARTS = {
  'A|HEB': CHART([{ label: '1', utterances: ['A:u1'] }, { label: '2', utterances: ['A:u2'] }]),
  'B|HEB': CHART([{ label: '1', utterances: ['B:u1'] }]),
  'C|GRC': CHART([{ label: '1', utterances: ['C:u1'] }, { label: '2', utterances: ['C:u2'] }]),
  'D|GRC': CHART([{ label: '1', utterances: ['D:u1'] }]),
  // A third edition that OVERLAPS the Hebrew, so the ordinary carry still has
  // a case: it holds A, and one of the two verses in it.
  'A|LAT': CHART([{ label: '1', utterances: ['A:u2'] }])
};
const HELD = { HEB: ['A', 'B'], GRC: ['C', 'D'], LAT: ['A'] };

const volume = {
  units: ['A', 'B', 'C', 'D'].map(id => ({ id })),
  editions: [{ code: 'HEB' }, { code: 'GRC' }, { code: 'LAT' }],
  chartFor: (unit, ed) => CHARTS[`${unit}|${ed}`] || null,
  spineFor: id => ({ utterances: [`${id}:u1`, `${id}:u2`] }),
  bookOrderFor: ed => [...(HELD[ed] || [])],
  divisionsFor: ed => [{ label: ed, image: null, from: 1, to: (HELD[ed] || []).length, books: [...(HELD[ed] || [])] }]
};

const manifest = (() => {
  const m = { Gutenberg_Bible: { testaments: {} } };
  Object.defineProperty(m, '__wallVolume', { value: volume, enumerable: false });
  return m;
})();

const chainFor = edition => buildBibleVerseChain(manifest, { edition }).items.filter(Boolean);

// The host's shape: `options.activeEdition` has ALREADY committed by the time
// the reseat runs, which is what makes "stay put" a hybrid rather than a
// refusal.
const reseatTo = (edition, selected) => {
  const h = bibleAdapter.createHandlers({
    manifest, namesMap: {}, options: { activeEdition: edition, translation: edition }
  });
  let adopted = null;
  const app = {
    setPrimaryItems: (items, index) => { adopted = { items, index, landed: items[index] }; },
    glideToItem: () => {}
  };
  // Prime the outgoing chain the way the host does, by asking for it first.
  h.reseatOnEditionChange({ selected, app });
  return { returned: h.reseatOnEditionChange({ selected, app }), adopted };
};

describe('the reader is carried across a change of edition (W-21)', () => {
  it('AN EDITION SHARING NOTHING LANDS THE READER AT ITS BEGINNING (O-76)', () => {
    const standing = chainFor('HEB')[0];
    assert.equal(standing.bookKey, 'A', 'the reader starts in the first Hebrew book');
    const { returned, adopted } = reseatTo('GRC', standing);
    assert.equal(returned, true, 'it must ADOPT — refusing leaves the ring on the old edition');
    assert.ok(adopted, 'and it must actually hand the ring its new seats');
    assert.equal(adopted.landed.bookKey, 'C',
      'the Greek begins at its own first book, not nowhere');
    assert.equal(adopted.index, 0, 'and at its beginning, which is where a launch belongs');
  });

  it('THE ADOPTED RING IS THE NEW EDITION\'S, not a survivor of the old', () => {
    const { adopted } = reseatTo('GRC', chainFor('HEB')[0]);
    const books = new Set(adopted.items.filter(Boolean).map(i => i.bookKey));
    assert.deepEqual([...books].sort(), ['C', 'D'],
      'a single Hebrew book surviving here is the hybrid state by another name');
  });

  it('and it still CARRIES the reader where the editions do overlap', () => {
    // The ordinary case must not be traded away for the degenerate one: a
    // reader on the verse both editions attest lands on that verse, not at
    // the beginning.
    const standing = chainFor('HEB').find(i => i.meta?.utterances?.includes('A:u2'));
    const { returned, adopted } = reseatTo('LAT', standing);
    assert.equal(returned, true);
    assert.ok(adopted.landed.meta.utterances.includes('A:u2'),
      'what travels is the UTTERANCE (W-21), not an ordinal');
  });

  it('lands just BEFORE the gap rather than at the beginning, when it can', () => {
    // The Latin holds A:u2 and not A:u1. A reader on A:u1 has no seat of their
    // own, but the walk outward finds one — so the beginning is the LAST
    // resort, never the first answer.
    const standing = chainFor('HEB').find(i => i.meta?.utterances?.includes('A:u1'));
    const { adopted } = reseatTo('LAT', standing);
    assert.ok(adopted.landed.meta.utterances.includes('A:u2'),
      'the nearest scripture this edition actually holds');
  });
});
