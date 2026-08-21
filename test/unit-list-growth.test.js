// THE UNIT LIST GROWS PAST THE TANAKH'S 39 (O-80, measured 2026-08-20).
//
// H-28 deferred this in 2026-08-17's words: "the Bible's unit list must
// eventually grow beyond the Tanakh's 39 ... that work starts when there is a
// licensed source to design against, and not before." W-123 adopted Swete on
// 2026-08-20, so the precondition is met and the deferral is spent.
//
// WHAT THIS FILE IS FOR. The growth was expected to be a design problem. It is
// mostly not one: the engine counts whatever the volume enumerates, and O-71
// already moved every denominator off the volume and onto the edition. So the
// nine or ten books the Septuagint brings are the case that has ALREADY been
// survived once, when the second edition widened 39 to 66.
//
// The case that has never been met is Ἔσδρας Β — one Greek book covering what
// the Hebrew reads as two, Ezra and Nehemiah. W-86 measured it and W-96's
// superset spine was designed for it; nothing has ever exercised it. The last
// two cells here exercise it, and they do not design anything: they measure
// which of the two available shapes the engine can actually carry, because the
// answer turns out to be already written down rather than open.
//
// These cells drive the REAL loader through an in-memory filesystem. A
// synthetic volume object would prove the fixture, not the engine — and the
// two functions that decide this question, `divisionsFor` and `sectionOf`,
// live inside the object `loadBibleVolume` builds and are not exported.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadBibleVolume, chartedUnitsOf, isEditionFullyConfirmed
} from '../src/adapters/bible-volume.js';
import { buildUtteranceSeatIndex } from '../src/navigation/seating-chart.js';

// The Tanakh's 39, with Ezra and Nehemiah at the two positions that matter.
const EZRA = 'h15';
const NEHEMIAH = 'h16';
const TANAKH = Array.from({ length: 39 }, (_, i) => `h${String(i + 1).padStart(2, '0')}`);

// What the Septuagint brings that the Hebrew does not have, in the list Wilbur
// gave on 2026-08-20. He counted nine; enumerated as units it is ten, because
// 1 and 2 Maccabees are two books. The count is not asserted anywhere below —
// it is the volume's to declare and cargo's to get right — but the discrepancy
// is recorded here rather than quietly reconciled.
const LXX_ONLY = [
  'tobit', 'judith', 'wisdom', 'sirach', 'baruch',
  'epjer', 'macc1', 'macc2', 'susanna', 'bel'
];

const WIDE = [...TANAKH, ...LXX_ONLY];

// ── An in-memory corpus, addressed exactly as the browser addresses it ──────
// Every path a real deployment would serve, and nothing else: a fetch for a
// file this object does not hold must THROW, because that is what a 404 does
// and the loader's fallbacks are all written against a throw.
function corpus({ units, shelves, chartsHeldBy }) {
  const files = new Map();
  files.set('v1/volume.json', {
    display_config: { volume_name: 'Bible' },
    books: units.map(id => ({ id, leaves: 2 })),
    editions: [
      { code: 'HEB', hasChart: true, proofread: false, language: 'hebrew', direction: 'rtl', name: 'Leningrad Codex', proofreadUnits: [...TANAKH] },
      { code: 'GRC', hasChart: true, proofread: false, language: 'greek', direction: 'ltr', name: 'Swete', proofreadUnits: [] }
    ]
  });
  for (const id of units) {
    // W-96: the spine is per-unit and holds every utterance ANY edition
    // attests there. That is what makes an utterance's home unambiguous.
    files.set(`v1/spine/${id}.json`, { utterances: [`${id}:1`, `${id}:2`] });
  }
  for (const [edition, held] of Object.entries(chartsHeldBy)) {
    for (const id of held) {
      files.set(`v1/charts/${edition}/${id}.json`, {
        seats: [
          { label: '1', utterances: [`${id}:1`] },
          { label: '2', utterances: [`${id}:2`] }
        ],
        groups: [{ label: '1', from: 1, to: 2 }]
      });
    }
    files.set(`v1/charts/${edition}/index.json`, shelves[edition]);
  }
  return async p => {
    const key = p.replace(/^\/*/, '');
    if (!files.has(key)) throw new Error(`404 ${key}`);
    return JSON.parse(JSON.stringify(files.get(key)));
  };
}

// The Hebrew shelves its 39 in the Leningrad Codex's order and calls the whole
// of it תנ״ך. The Greek shelves everything it holds under one title.
const shelfFor = (held, label) => ({
  units: [...held],
  groups: [],
  divisions: [{ label, image: null, from: 1, to: held.length }]
});

const wideCorpus = (over = {}) => corpus({
  units: WIDE,
  chartsHeldBy: { HEB: TANAKH, GRC: WIDE },
  shelves: {
    HEB: shelfFor(TANAKH, 'תנ״ך'),
    GRC: shelfFor(WIDE, 'Ἡ Παλαιὰ Διαθήκη')
  },
  ...over
});

describe('the unit list grows past 39 (O-80)', () => {
  it('THE FINISHED HEBREW STAYS FINISHED WHEN THE VOLUME WIDENS — the O-71 guard at the new width', async () => {
    // This is the whole of the "will growth break the Hebrew" question, and
    // the answer is no, for a reason already paid for: O-71 moved the
    // denominator off the volume and onto the edition, after Howell met
    // "39 of 66, NOT PROOFREAD" on a finished edition at the testament ring.
    // Measured at BOTH widths, because a cell that only runs at 49 cannot
    // show that the number did not move.
    const narrow = await loadBibleVolume({
      base: '', version: 'v1',
      fetchJson: corpus({
        units: TANAKH,
        chartsHeldBy: { HEB: TANAKH, GRC: [] },
        shelves: { HEB: shelfFor(TANAKH, 'תנ״ך'), GRC: shelfFor([], 'Swete') }
      })
    });
    const wide = await loadBibleVolume({ base: '', version: 'v1', fetchJson: wideCorpus() });

    assert.equal(narrow.units.length, 39);
    assert.equal(wide.units.length, 49, 'the volume enumerates ten more books');
    assert.equal(isEditionFullyConfirmed(narrow, 'HEB'), true);
    assert.equal(isEditionFullyConfirmed(wide, 'HEB'), true,
      'the Hebrew confirmed 39 of the 39 IT HOLDS — ten books it has never held are not its work');
  });

  it('the deuterocanon appears in the Greek and NOWHERE else', async () => {
    const volume = await loadBibleVolume({ base: '', version: 'v1', fetchJson: wideCorpus() });
    assert.deepEqual([...chartedUnitsOf(volume, 'HEB')].sort(), [...TANAKH].sort());
    assert.deepEqual([...chartedUnitsOf(volume, 'GRC')].sort(), [...WIDE].sort());
    for (const id of LXX_ONLY) {
      assert.equal(chartedUnitsOf(volume, 'HEB').has(id), false,
        `${id}: the Hebrew has never held it, and the enumeration widening does not hand it one`);
    }
  });

  it('the Hebrew\'s door still names 39 books, not 49', async () => {
    const volume = await loadBibleVolume({ base: '', version: 'v1', fetchJson: wideCorpus() });
    const [hebrew] = volume.divisionsFor('HEB');
    assert.equal(hebrew.label, 'תנ״ך');
    assert.equal(hebrew.books.length, 39, 'the door opens on what the edition shelves');
    const [greek] = volume.divisionsFor('GRC');
    assert.equal(greek.books.length, 49);
  });

  // ── Ἔσδρας Β — the case that has never been exercised ───────────────────
  //
  // Two shapes are available. Only one of them is compatible with an
  // invariant the engine already relies on, and this pair of cells is the
  // measurement rather than the ruling.

  it('SHAPE ONE — one name over two books: the engine carries this today', async () => {
    // The Greek shelves Ezra and Nehemiah adjacently and puts ONE section
    // label across the pair. This is exactly how "Prophets" already works
    // (H-26: sections are labels, never levels), so it needs no new machinery.
    const at = WIDE.indexOf(EZRA) + 1;
    const volume = await loadBibleVolume({
      base: '', version: 'v1',
      fetchJson: corpus({
        units: WIDE,
        chartsHeldBy: { HEB: TANAKH, GRC: WIDE },
        shelves: {
          HEB: shelfFor(TANAKH, 'תנ״ך'),
          GRC: {
            units: [...WIDE],
            groups: [{ label: 'Ἔσδρας Β', from: at, to: at + 1 }],
            divisions: [{ label: 'Ἡ Παλαιὰ Διαθήκη', image: null, from: 1, to: WIDE.length }]
          }
        }
      })
    });
    assert.equal(volume.sectionOf('GRC', EZRA), 'Ἔσδρας Β');
    assert.equal(volume.sectionOf('GRC', NEHEMIAH), 'Ἔσδρας Β',
      'one Greek name reaches both Hebrew books');
    assert.equal(volume.sectionOf('HEB', EZRA), null,
      'and the Hebrew, which shelves no such group, is untouched by it');
    // The cost, stated so nobody discovers it on the LAN: the reader still
    // walks TWO doors under that one name. A label spans; it does not merge.
    assert.equal(volume.divisionsFor('GRC')[0].books.filter(
      id => id === EZRA || id === NEHEMIAH).length, 2);
  });

  it('SHAPE TWO — Ἔσδρας Β as a 50th unit breaks an invariant the engine already relies on', () => {
    // `editionSeatsUtterance` is written on this sentence, in
    // src/adapters/bible-volume.js: "An utterance belongs to exactly ONE unit
    // by construction — the spine is per-unit and holds every utterance any
    // edition attests there — so there is no second place to look and no
    // ambiguity about where to look first."
    //
    // A 50th unit carrying Ezra's and Nehemiah's verses under a Greek address
    // puts every one of those utterances in two units at once. Nothing throws.
    // The index built over them silently keeps the FIRST seat it saw and
    // discards the second, which is O-78's index doing exactly what it was
    // written to do — so a reader crossing editions inside Nehemiah lands in
    // whichever book happened to be walked first.
    const items = [
      { id: EZRA, meta: { utterances: [`${EZRA}:1`] } },
      { id: NEHEMIAH, meta: { utterances: [`${NEHEMIAH}:1`] } },
      { id: 'esdrasB', meta: { utterances: [`${EZRA}:1`, `${NEHEMIAH}:1`] } }
    ];
    const index = buildUtteranceSeatIndex(items);
    assert.equal(index.get(`${EZRA}:1`), 0, 'the duplicate is not seen; the first seat wins');
    assert.equal(index.get(`${NEHEMIAH}:1`), 1);
    assert.equal(index.size, 2,
      'three units, two addresses — the 50th unit is unreachable through the index '
      + 'that decides where a reader lands, and it fails silently');
  });
});
