// THE CHOOSER OFFERS THE EDITIONS THAT HOLD WHERE YOU ARE STANDING.
//
// Howell's rule, 2026-08-19, in both directions:
//   *"If I'm reading Genesis 1:1 in the Vulgate, and tap the dimension button,
//    I should see Hebrew as an option but not Greek. If I'm reading Matthew
//    1:1 in the Vulgate and tap the dimension button, I should see Greek but
//    not Hebrew as an option."*
//   *"if I'm at root and tap the dimension button, I should see Hebrew Greek
//    and Latin as options."*
//
// Two facts about this file's shape, both deliberate:
//
// THE ANSWER IS SPLIT ACROSS TWO MODULES ON PURPOSE. The adapter computes it,
// because which editions seat a verse is a question about charts and
// utterances; `dimension-bridge` only compares strings, because the suite
// forbids it from naming a volume at all. So the cells below test the two
// halves separately AND test that the strings one produces are the strings the
// other consumes — the seam is where a defect of this kind would live.
//
// NULL IS NOT THE EMPTY ARRAY. Null means no restriction (the root); an empty
// array would mean the reader is somewhere no edition reaches. Confusing them
// empties the language ring at the root, which is the same failure O-71's
// `chartedUnitsOf` had to be written twice to avoid.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';
import { editionSeatsUtterance } from '../src/adapters/bible-volume.js';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';

// Three editions over two books. LAT spans both. HEB holds only the first,
// GRC only the second — and inside the shared book LAT seats one utterance
// (`A:u3`) that HEB does not, which is the case a book-level answer gets wrong
// and a leaf-level one gets right.
const CHARTS = {
  'A|LAT': { seats: [
    { label: '1', utterances: ['A:u1'] },
    { label: '2', utterances: ['A:u2'] },
    { label: '3', utterances: ['A:u3'] }
  ] },
  'A|HEB': { seats: [
    { label: '1', utterances: ['A:u1'] },
    { label: '2', utterances: ['A:u2'] }
  ] },
  'B|LAT': { seats: [{ label: '1', utterances: ['B:u1'] }] },
  'B|GRC': { seats: [{ label: '1', utterances: ['B:u1'] }] }
};

const volume = {
  units: [{ id: 'A' }, { id: 'B' }],
  editions: [{ code: 'LAT' }, { code: 'HEB' }, { code: 'GRC' }],
  chartFor: (unitId, edition) => CHARTS[`${unitId}|${edition}`] || null,
  spineFor: () => ({ utterances: ['x'] })
};

describe('does this edition seat this utterance', () => {
  it('answers from the chart, per edition', () => {
    assert.equal(editionSeatsUtterance(volume, 'HEB', 'A', 'A:u1'), true);
    assert.equal(editionSeatsUtterance(volume, 'GRC', 'A', 'A:u1'), false,
      'the Greek does not chart that book at all');
  });

  it('A LEAF IS FINER THAN A BOOK — the case a book-level answer gets wrong', () => {
    // Both editions hold book A. Only one holds this verse in it.
    assert.equal(editionSeatsUtterance(volume, 'LAT', 'A', 'A:u3'), true);
    assert.equal(editionSeatsUtterance(volume, 'HEB', 'A', 'A:u3'), false,
      'sharing a book is not holding every verse in it');
  });

  it('refuses rather than guessing when there is nothing to ask', () => {
    assert.equal(editionSeatsUtterance(volume, 'HEB', 'A', null), false);
    assert.equal(editionSeatsUtterance(volume, 'HEB', 'NOSUCH', 'A:u1'), false);
    assert.equal(editionSeatsUtterance({}, 'HEB', 'A', 'A:u1'), false,
      'a volume with no chartFor answers no, never throws');
  });
});

// The bridge half. It must not know what a chart is — it compares the codes
// the host handed it — so these cells drive it entirely through its own API.
const TRANSLATIONS = {
  LAT: { language: 'latin', proofread: true, hasChart: true, name: 'Vulgata' },
  HEB: { language: 'hebrew', proofread: true, hasChart: true, name: 'Leningrad' },
  GRC: { language: 'greek', proofread: true, hasChart: true, name: 'Patriarchal' }
};

const makeBridge = () => {
  let state = { language: 'latin', edition: 'LAT' };
  const subs = [];
  const store = {
    getState: () => state,
    dispatch: action => {
      state = { language: action.language, edition: action.defaultEdition };
      subs.forEach(fn => fn(state));
    },
    subscribe: fn => { subs.push(fn); }
  };
  return createDimensionBridge({ store, translationsMeta: { translations: TRANSLATIONS } });
};

describe('the chooser offers the editions that hold where you stand', () => {
  it('AT ROOT EVERY LANGUAGE IS OFFERED — null is no restriction', () => {
    const bridge = makeBridge();
    bridge.setEditionsHere(null);
    assert.deepEqual(bridge.languagesAvailable().sort(), ['greek', 'hebrew', 'latin']);
  });

  it('IN THE FIRST BOOK THE HEBREW IS OFFERED AND THE GREEK IS NOT', () => {
    const bridge = makeBridge();
    bridge.setEditionsHere(['LAT', 'HEB']);
    assert.deepEqual(bridge.languagesAvailable().sort(), ['hebrew', 'latin']);
  });

  it('IN THE SECOND THE GREEK IS OFFERED AND THE HEBREW IS NOT', () => {
    const bridge = makeBridge();
    bridge.setEditionsHere(['LAT', 'GRC']);
    assert.deepEqual(bridge.languagesAvailable().sort(), ['greek', 'latin']);
  });

  it('the EDITION plane is filtered by the same answer, not just the language ring', () => {
    const bridge = makeBridge();
    // TWO LANGUAGES SURVIVE HERE, so the filter is in force and reaches both
    // planes. (Its behaviour where only ONE survives is O-78's, below.)
    bridge.setEditionsHere(['LAT', 'GRC']);
    assert.deepEqual(bridge.translationsOf('hebrew'), [bridge.comingSoonKey],
      'a language with no edition here has nothing on its shelf');
    assert.deepEqual(bridge.translationsOf('latin'), ['LAT']);
  });

  it('AN EDITION THAT IS NOT HERE CANNOT BE COMMITTED, even if asked directly', () => {
    const bridge = makeBridge();
    bridge.setEditionsHere(['LAT', 'GRC']);
    assert.equal(bridge.setTranslation('HEB'), false,
      'a stale preview or a deep link must not land the reader off the map');
    assert.equal(bridge.getSelection().translation, 'LAT', 'and nothing moved');
  });
});

// THE FILTER NARROWS A CHOICE; IT MAY NEVER REMOVE ONE (O-78).
//
// Howell, from the LAN: *"upon return to the Tertiary Stratum the unselected
// language disappears, leaving only the selected language in the Magnifier,
// with no option to change to another language."*
//
// H-29 is not wrong — its corpus has not arrived. It was ruled against a shelf
// with a Latin spanning everything, where Genesis offers Hebrew+Latin and
// Matthew offers Greek+Latin: two nodes and a way onward either way. The shelf
// today holds two editions sharing not one utterance, so the filter always
// leaves exactly ONE language and the ring stops being a chooser at the first
// leaf the reader reaches.
//
// The harm it guarded is answered elsewhere now: it existed because there was
// no good landing for an edition that cannot seat you, and O-76 supplied one.
describe('the position filter never leaves the reader with one door', () => {
  it('WIDENS BACK TO EVERYTHING when only the reader\'s own language survives', () => {
    const bridge = makeBridge();
    bridge.setEditionsHere(['LAT']);
    assert.deepEqual(bridge.languagesAvailable().sort(), ['greek', 'hebrew', 'latin'],
      'a language ring holding one node is not a chooser, it is a dead end');
  });

  it('and what the ring offers is COMMITTABLE — an offer that refuses is worse', () => {
    const bridge = makeBridge();
    bridge.setEditionsHere(['LAT']);
    assert.deepEqual(bridge.translationsOf('hebrew'), ['HEB'],
      'the edition plane must stock what the language plane just offered');
    assert.equal(bridge.setTranslation('HEB'), true,
      'and the commit must land — a node that swallows the tap is the same trap');
    assert.equal(bridge.getSelection().translation, 'HEB');
  });

  it('THE CLAUSE RETIRES ITSELF the day a spanning edition lands', () => {
    const bridge = makeBridge();
    // Exactly H-29's own example: the Latin spans, so two languages survive
    // and the filter governs unchanged. Nothing here needs revisiting when
    // that edition arrives.
    bridge.setEditionsHere(['LAT', 'GRC']);
    assert.deepEqual(bridge.languagesAvailable().sort(), ['greek', 'latin'],
      'the Hebrew is gone, which is the ruling working');
  });

  it('an empty measurement is not a locked door either', () => {
    const bridge = makeBridge();
    // `[]` still means something different from `null` INSIDE the bridge — a
    // measurement that found nothing, against no measurement at all. What
    // changed under O-78 is the consequence: an empty ring strands the reader
    // exactly as a one-node ring does, so the filter does not apply.
    bridge.setEditionsHere([]);
    assert.deepEqual(bridge.languagesAvailable().sort(), ['greek', 'hebrew', 'latin'],
      'nowhere reaches here, so the reader may go anywhere — O-76 lands them');
    bridge.setEditionsHere(null);
    assert.equal(bridge.languagesAvailable().length, 3,
      'and null restores everything rather than sticking at empty');
  });
});

describe('the chooser offers the editions that hold where you stand (cont.)', () => {

  it('a volume whose adapter never answers is never filtered', () => {
    const bridge = makeBridge();
    assert.equal(bridge.languagesAvailable().length, 3,
      'the default is no restriction — every other volume behaves as before');
  });
});

// THE GLUE, WHICH IS WHERE A DEFECT OF THIS KIND WOULD ACTUALLY LIVE.
//
// The two halves above can both be right while the piece joining them asks the
// wrong question at the wrong level — offers everything at a leaf, or filters
// at the root and empties the ring. Nothing above can see that, because each
// half is tested through its own front door. This drives the adapter binding
// the host actually calls, with the items the host actually hands it.
const manifest = (() => {
  const spines = {
    A: { utterances: ['A:u1', 'A:u2', 'A:u3'] },
    B: { utterances: ['B:u1'] }
  };
  const wall = {
    units: [{ id: 'A' }, { id: 'B' }],
    testaments: [
      { id: 'T1', order: 0, books: [{ id: 'A', order: 0 }] },
      { id: 'T2', order: 1, books: [{ id: 'B', order: 0 }] }
    ],
    editions: [{ code: 'LAT' }, { code: 'HEB' }, { code: 'GRC' }],
    chartFor: (unitId, edition) => CHARTS[`${unitId}|${edition}`] || null,
    spineFor: id => spines[id] || null
  };
  const m = { Gutenberg_Bible: { testaments: {} } };
  Object.defineProperty(m, '__wallVolume', { value: wall, enumerable: false });
  return m;
})();

const handlers = () => bibleAdapter.createHandlers({
  manifest, namesMap: {}, options: { activeEdition: 'LAT', translation: 'LAT' }
});

describe('the adapter answers where the reader is standing', () => {
  it('AT THE ROOT IT REFUSES TO FILTER — null, not a list of everything', () => {
    const answer = handlers().editionsHoldingItem({ id: 'X', level: 'bibleRoot' });
    assert.equal(answer, null,
      'the root means no restriction; returning all three codes would be the '
      + 'same on screen today and wrong the day an edition is unservable');
    assert.equal(handlers().editionsHoldingItem({ id: 'T1', level: 'testament' }), null);
  });

  it('AT A LEAF IT ANSWERS BY UTTERANCE — Howell\'s two sentences, in order', () => {
    const h = handlers();
    // "reading Genesis 1:1 in the Vulgate… I should see Hebrew but not Greek"
    assert.deepEqual(
      h.editionsHoldingItem({
        level: 'verse', bookKey: 'A', meta: { utterances: ['A:u1'] }
      }).sort(),
      ['HEB', 'LAT']);
    // "reading Matthew 1:1… I should see Greek but not Hebrew"
    assert.deepEqual(
      h.editionsHoldingItem({
        level: 'verse', bookKey: 'B', meta: { utterances: ['B:u1'] }
      }).sort(),
      ['GRC', 'LAT']);
  });

  it('AND FINER THAN THE BOOK — a verse the other edition lacks inside a book it holds', () => {
    assert.deepEqual(
      handlers().editionsHoldingItem({
        level: 'verse', bookKey: 'A', meta: { utterances: ['A:u3'] }
      }),
      ['LAT'], 'sharing the book is not holding the verse');
  });

  it('a verse carrying no utterance falls back to its BOOK, never to everything', () => {
    assert.deepEqual(
      handlers().editionsHoldingItem({ level: 'verse', bookKey: 'A', meta: {} }).sort(),
      ['HEB', 'LAT'], 'the coarser true answer beats no answer');
  });

  it('the levels between answer by book rather than vanishing', () => {
    // The globe does not appear here, which is exactly why the filter must not
    // quietly become "no restriction" at these levels — an unreached branch is
    // where the next regression hides.
    assert.deepEqual(handlers().editionsHoldingItem({ level: 'book', id: 'B' }).sort(),
      ['GRC', 'LAT']);
  });

  it('THE SEAM: what the adapter emits is what the bridge consumes', () => {
    const codes = handlers().editionsHoldingItem({
      level: 'verse', bookKey: 'B', meta: { utterances: ['B:u1'] }
    });
    const bridge = makeBridge();
    bridge.setEditionsHere(codes);
    assert.deepEqual(bridge.languagesAvailable().sort(), ['greek', 'latin'],
      'edition CODES on one side, edition KEYS on the other — if those ever '
      + 'stop being the same string the ring empties and both halves stay green');
  });
});
