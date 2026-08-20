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

// THE CROSSING MUST NOT SCALE WITH THE PRODUCT OF THE TWO EDITIONS (O-78).
//
// Howell, from the LAN: *"after the first switch of languages, for every
// subsequent switch there is a very long delay (10 seconds) before the
// Magnifier fills and the program becomes responsive. In other words, the
// program hangs."*
//
// THE FIRST SWITCH WAS FAST BECAUSE THE WALK NEVER RAN. The outward walk only
// happens when there is an outgoing chain to walk, and at boot the adapter has
// not built one — so the very first crossing takes the beginning immediately.
// The reseat then keeps the chain it adopted, and every crossing after that
// walks it.
//
// AND WHERE THE EDITIONS SHARE NOTHING, THE WALK NEVER FINDS ANYTHING. It
// probes every seat in the outgoing chain and each probe was a linear scan of
// the incoming one. Measured against the real corpus — 23,213 Hebrew seats and
// 7,958 Greek, sharing not one utterance — that is 185 million comparisons and
// twelve to seventeen seconds on a laptop, all of it spent proving what the
// first probe already implied.
//
// THE BUDGET IS DELIBERATELY LOOSE, because the point is the SHAPE, not the
// clock: the quadratic walk misses this by a factor of five even on a fast
// machine, and the indexed one comes in a hundred times under it. Anything
// between the two is a slow runner, not a regression.
describe('crossing between two large editions is not quadratic (O-78)', () => {
  const HEB_UNITS = 60, GRC_UNITS = 30, SEATS = 200; // 12,000 seats against 6,000
  const bigChart = (unit, n) => ({
    seats: Array.from({ length: n }, (_, i) => ({ label: String(i + 1), utterances: [`${unit}:u${i}`] })),
    groups: [{ label: '1', from: 1, to: n }]
  });
  const hebUnits = Array.from({ length: HEB_UNITS }, (_, i) => `H${i}`);
  const grcUnits = Array.from({ length: GRC_UNITS }, (_, i) => `G${i}`);
  const bigHeld = { HEB: hebUnits, GRC: grcUnits };
  const bigVolume = {
    units: [...hebUnits, ...grcUnits].map(id => ({ id })),
    editions: [{ code: 'HEB' }, { code: 'GRC' }],
    chartFor: (unit, ed) => ((bigHeld[ed] || []).includes(unit) ? bigChart(unit, SEATS) : null),
    spineFor: id => ({ utterances: Array.from({ length: SEATS }, (_, i) => `${id}:u${i}`) }),
    bookOrderFor: ed => [...(bigHeld[ed] || [])],
    divisionsFor: ed => [{ label: ed, image: null, from: 1, to: (bigHeld[ed] || []).length, books: [...(bigHeld[ed] || [])] }]
  };
  const bigManifest = (() => {
    const m = { Gutenberg_Bible: { testaments: {} } };
    Object.defineProperty(m, '__wallVolume', { value: bigVolume, enumerable: false });
    return m;
  })();

  it('carries the reader across in well under a second, both directions', () => {
    const budgetMs = Number(process.env.CI_RESEAT_BUDGET_MS || 1000);
    const chain = ed => buildBibleVerseChain(bigManifest, { edition: ed }).items.filter(Boolean);
    assert.equal(chain('HEB').length, HEB_UNITS * SEATS, 'the outgoing chain is the size claimed');
    assert.equal(chain('GRC').length, GRC_UNITS * SEATS, 'and so is the incoming one');

    for (const [from, to] of [['HEB', 'GRC'], ['GRC', 'HEB']]) {
      // THE HOST MUTATES THIS OBJECT, and the sequence matters: the committed
      // edition changes between the two calls below, exactly as `main.js` does
      // on settle. Handing the adapter a fixed edition instead is what makes
      // this defect invisible — the outgoing chain never becomes the reader's,
      // so the walk has nothing to walk and the cell passes while broken.
      const options = { activeEdition: from, translation: from };
      const h = bibleAdapter.createHandlers({ manifest: bigManifest, namesMap: {}, options });
      let adopted = null;
      const app = { setPrimaryItems: (items, index) => { adopted = { items, index }; }, glideToItem: () => {} };

      // The reader arrives on the outgoing edition and is carried into it —
      // this is the FIRST switch, the one Howell reports as fast.
      const outgoing = chain(from);
      h.reseatOnEditionChange({ selected: outgoing[0], app });
      // ...and now stands in its MIDDLE, so neither leg of the walk can exit
      // on its first step.
      const standing = outgoing[Math.floor(outgoing.length / 2)];
      options.activeEdition = to;
      options.translation = to;

      const started = Date.now();
      h.reseatOnEditionChange({ selected: standing, app });
      const elapsed = Date.now() - started;
      assert.ok(elapsed < budgetMs,
        `${from} → ${to} took ${elapsed}ms (budget ${budgetMs}ms): the crossing is `
        + 'scanning the incoming chain once per outgoing seat again');
      assert.equal(adopted.index, 0, 'and it still lands at the beginning, sharing nothing');
    }
  });
});
