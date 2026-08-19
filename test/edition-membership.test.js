// AN EDITION SHOWS ONLY WHAT IT CHARTS (O-71, ruled 2026-08-19).
//
// THE DEFECT THIS FIXES, in Howell's two screenshots from the LAN: the Greek
// edition — which charts the twenty-seven books of the New Testament and
// nothing else — displayed a Παλαιὰ Διαθήκη whose sky held all thirty-nine
// books of the Tanakh, named in Greek, sized by prominence, entering nothing.
// The Hebrew, symmetrically, displayed a הברית החדשה holding the whole New
// Testament in Hebrew. Neither edition has ever held one leaf of the other's.
//
// WHY IT SURVIVED. `expandVolumeSeats` has enforced "absent from the chart is
// absent from the edition" since the wall went up — but it enforced it inline,
// for the verse chain alone. The book ring filtered by PROOFREAD-ness, which
// is a different fact that coincided perfectly for as long as the volume held
// one edition; the testament ring took no edition argument at all. Three
// levels, three answers to one question, and no cell compared them, because
// every cell asked one builder and passed it the edition the author was
// thinking about.
//
// SO THIS FILE IS AN OUTPUT CELL, not three builder cells. One fixture, two
// editions that share nothing, and the assertion that every level names the
// same books. That is the shape that catches a filter going missing at one
// level — which is what happened — and it is the same shape as "the book ring
// IS the shelf order", written after the same class of miss.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chartedUnitsOf, volumeHoldsUnit, isEditionFullyConfirmed
} from '../src/adapters/bible-volume.js';
import { buildBibleBookCousinChain, buildBibleVerseChain } from '../src/navigation/cousin-builder.js';
import { buildBibleTestaments } from '../src/adapters/volume-helpers.js';

// Two testaments, four books, two editions — and the editions are DISJOINT,
// which is the whole point. HEB charts A and B; GRC charts C and D. Any level
// that answers "both testaments" or "four books" is answering the volume's
// question where the edition's was asked.
const OLD = ['A', 'B'];
const NEW = ['C', 'D'];
const CHARTS = { HEB: OLD, GRC: NEW };

// A chart declares its seats AND its containers (O-44) — both, or the seat
// expander refuses the unit outright.
const seatsFor = () => ({
  seats: [{ label: '1' }, { label: '2' }],
  groups: [{ label: '1', from: 1, to: 2 }]
});

const makeVolume = (over = {}) => ({
  units: [...OLD, ...NEW].map(id => ({ id, leaves: 2 })),
  testaments: [
    { id: 'T_OLD', order: 0, books: OLD.map((id, i) => ({ id, order: i, leaves: 2 })) },
    { id: 'T_NEW', order: 1, books: NEW.map((id, i) => ({ id, order: i, leaves: 2 })) }
  ],
  editions: [
    { code: 'HEB', proofread: false, proofreadUnits: [...OLD] },
    { code: 'GRC', proofread: false, proofreadUnits: [] }
  ],
  chartFor: (unitId, edition) =>
    ((CHARTS[edition] || []).includes(unitId) ? seatsFor(unitId) : null),
  spineFor: unitId => ({ utterances: [`${unitId}:1`, `${unitId}:2`] }),
  // A shelf that orders only its own half — the real ones do, and
  // `bookOrderFor` appends the rest, which is how the other half reached the
  // ring in the first place.
  bookOrderFor: edition => {
    const mine = CHARTS[edition] || [];
    return [...mine, ...[...OLD, ...NEW].filter(id => !mine.includes(id))];
  },
  sectionOf: () => null,
  ...over
});

const makeManifest = volume => {
  const manifest = {
    Gutenberg_Bible: {
      testaments: {
        T_OLD: { sort_number: 0, books: Object.fromEntries(OLD.map((id, i) => [id, { sort_number: i }])) },
        T_NEW: { sort_number: 1, books: Object.fromEntries(NEW.map((id, i) => [id, { sort_number: i }])) }
      }
    }
  };
  Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
  return manifest;
};

// The flag is read off window.location, and without it the proofread filter
// would hide the Greek entirely — so the defect's own conditions need it on.
// This is the state Howell was in: the Greek is not servable without it.
const withOverride = fn => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  globalThis.window = { location: { hostname: '192.168.88.167', search: '?proofread=true' } };
  try { return fn(); } finally {
    if (had) globalThis.window = prev; else delete globalThis.window;
  }
};

describe('an edition shows only what it charts (O-71)', () => {
  it('membership is the chart, per edition, and the two do not overlap', () => {
    const v = makeVolume();
    assert.deepEqual([...chartedUnitsOf(v, 'HEB')].sort(), OLD);
    assert.deepEqual([...chartedUnitsOf(v, 'GRC')].sort(), NEW);
    assert.equal(volumeHoldsUnit(v, 'GRC', 'A'), false, 'the Greek has never held Genesis');
    assert.equal(volumeHoldsUnit(v, 'HEB', 'C'), false, 'nor the Hebrew Matthew');
  });

  it('A UNIT WITH NO SPINE IS NOT HELD — an unfinished increment is not a book', () => {
    const v = makeVolume({ spineFor: id => (id === 'B' ? null : { utterances: ['x'] }) });
    assert.deepEqual([...chartedUnitsOf(v, 'HEB')], ['A']);
  });

  it('A VOLUME THAT CANNOT ANSWER RETURNS null, never an empty set', () => {
    // The distinction that keeps this fix from becoming the bug it repairs: a
    // missing instrument must not read as a measurement of zero, or every
    // ring built on a fixture that models order and not charts goes silently
    // empty — a filter removing everything looks exactly like a corpus
    // holding nothing.
    assert.equal(chartedUnitsOf({ bookOrderFor: () => OLD }, 'HEB'), null,
      'no chartFor: the volume was not built to answer this');
    assert.equal(chartedUnitsOf(makeVolume({ units: [] }), 'HEB'), null,
      'nothing to walk: no answer, rather than the answer "nothing"');
    assert.equal(chartedUnitsOf(makeVolume(), null), null, 'no edition, no question');
    assert.ok(chartedUnitsOf(makeVolume({ chartFor: () => null }), 'HEB') instanceof Set,
      'but a volume that CAN answer and holds nothing gets the empty set, a real answer');
    assert.equal(chartedUnitsOf(makeVolume({ chartFor: () => null }), 'HEB').size, 0);
  });

  it('THE TESTAMENT RING HOLDS ONLY THE TESTAMENTS THE EDITION REACHES', () => {
    const manifest = makeManifest(makeVolume());
    assert.deepEqual(
      buildBibleTestaments(manifest, {}, { edition: 'HEB' }).items.map(i => i.id),
      ['T_OLD'], 'the Hebrew reaches no New Testament');
    assert.deepEqual(
      buildBibleTestaments(manifest, {}, { edition: 'GRC' }).items.map(i => i.id),
      ['T_NEW'], 'and the Greek no Old — this is the second screenshot');
    assert.deepEqual(
      buildBibleTestaments(manifest, {}, {}).items.map(i => i.id),
      ['T_OLD', 'T_NEW'], 'with no edition committed nothing is filtered');
  });

  it('THE BOOK RING HOLDS ONLY THE BOOKS THE EDITION CHARTS — flag or no flag', () => {
    const manifest = makeManifest(makeVolume());
    const ring = () => buildBibleBookCousinChain(manifest, { names: {}, edition: 'GRC' })
      .items.filter(Boolean).map(i => i.id);
    // Without the flag the proofread filter also applies, and the Greek has
    // confirmed nothing — so the honest ring is empty.
    assert.deepEqual(ring(), [], 'nothing confirmed and nothing offered');
    // WITH the flag — Howell's state — the proofread filter lifts and the
    // MEMBERSHIP filter must not. This is the assertion that fails on the
    // pre-O-71 engine: it returned all four books.
    withOverride(() => {
      assert.deepEqual(ring(), NEW,
        'the flag lifts proofread-ness, never membership: a book the edition '
        + 'has never held has nothing to show anyone');
    });
    withOverride(() => {
      assert.deepEqual(
        buildBibleBookCousinChain(manifest, { names: {}, edition: 'HEB' })
          .items.filter(Boolean).map(i => i.id),
        OLD, 'and symmetrically for the Hebrew — this is the first screenshot');
    });
  });

  it('THE RING AND THE CHAIN NAME THE SAME BOOKS — the cell no single builder could be', () => {
    const manifest = makeManifest(makeVolume());
    for (const edition of ['HEB', 'GRC']) {
      withOverride(() => {
        const ring = buildBibleBookCousinChain(manifest, { names: {}, edition })
          .items.filter(Boolean).map(i => i.id);
        const chain = [...new Set(buildBibleVerseChain(manifest, { edition })
          .items.filter(Boolean).map(i => i.bookKey))];
        assert.deepEqual(ring, chain,
          `${edition}: a book on the ring whose verses the chain refuses to `
          + 'produce is a container kept alive for no one');
      });
    }
  });

  it('AN EDITION IS FINISHED WHEN ITS OWN WORK IS — not the volume\'s', () => {
    const v = makeVolume();
    // The Hebrew has confirmed both books it holds. Measured against the
    // volume's four units it reads unfinished, which is what put NOT
    // PROOFREAD under a finished edition on Howell's phone the moment a
    // second edition widened the enumeration.
    assert.equal(isEditionFullyConfirmed(v, 'HEB'), true,
      'every book this edition holds is confirmed — it is finished');
    assert.equal(isEditionFullyConfirmed(v, 'GRC'), false,
      'the Greek has confirmed none of its own');
  });

  it('the pre-O-71 denominator survives where no chart can be consulted', () => {
    // FN-4's fixtures model marks and nothing else. They must keep answering.
    const bare = { units: [{ id: 'A' }, { id: 'B' }], editions: [{ code: 'E', proofread: false, proofreadUnits: ['A', 'B'] }] };
    assert.equal(isEditionFullyConfirmed(bare, 'E'), true);
  });
});
