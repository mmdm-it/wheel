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
// ten books the Septuagint brings are the case that has ALREADY been survived
// once, when the Greek New Testament widened the volume from 39 units to 66.
//
// THE NUMBERS ARE CARGO'S, DECLARED IN W-126: sixty-six spine units become
// SEVENTY-SIX. Ten books answer to no Hebrew unit — Tobit, Judith, Wisdom,
// Sirach, Baruch, the Epistle of Jeremiah, 1 and 2 Maccabees, Susanna, and Bel
// and the Dragon. This file asserts the shape and cites the count; it does not
// measure it, because the enumeration is cargo's to make and the engine's only
// to carry.
//
// The case that has never been met is Ἔσδρας Β — one Greek book covering what
// the Hebrew reads as two, Ezra and Nehemiah, and per W-126 the only book in
// the edition that is not one-to-one. W-86 measured it and W-96's superset
// spine was designed for it; nothing has ever exercised it. The last two cells
// exercise it, and they design nothing: they measure which of the two
// available shapes the engine can carry, because the answer turns out to be
// already written down rather than open.
//
// These cells drive the REAL loader through an in-memory filesystem. A
// synthetic volume object would prove the fixture, not the engine — and the
// two functions that decide this question, `divisionsFor` and `sectionOf`,
// live inside the object `loadBibleVolume` builds and are not exported.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadBibleVolume, chartedUnitsOf, confirmedUnitsOf, isEditionFullyConfirmed
} from '../src/adapters/bible-volume.js';
import { buildUtteranceSeatIndex } from '../src/navigation/seating-chart.js';

// The Tanakh's 39, with Ezra and Nehemiah at the two positions that matter.
const EZRA = 'h15';
const NEHEMIAH = 'h16';
const TANAKH = Array.from({ length: 39 }, (_, i) => `h${String(i + 1).padStart(2, '0')}`);

// The Greek New Testament's 27 — the edition that already took the volume from
// 39 units to 66, and whose arrival is what O-71 was written for.
const NEW_TESTAMENT = Array.from({ length: 27 }, (_, i) => `n${String(i + 1).padStart(2, '0')}`);

// The ten the Septuagint adds, in W-126's order. Wilbur first wrote nine over
// this same list of ten; the cause was arithmetic and nothing else, which is
// worth stating because the obvious guess — that 1 and 2 Maccabees had been
// counted as one book — is wrong, and a guess left in a comment outlives the
// thing it guessed at.
const LXX_ONLY = [
  'tobit', 'judith', 'wisdom', 'sirach', 'baruch',
  'epjer', 'macc1', 'macc2', 'susanna', 'bel'
];

const SIXTY_SIX = [...TANAKH, ...NEW_TESTAMENT];
const SEVENTY_SIX = [...SIXTY_SIX, ...LXX_ONLY];
const SWETE_HOLDS = [...TANAKH, ...LXX_ONLY];

// ── An in-memory corpus, addressed exactly as the browser addresses it ──────
// Every path a real deployment would serve, and nothing else: a fetch for a
// file this object does not hold must THROW, because that is what a 404 does
// and the loader's fallbacks are all written against a throw.
function corpus({ units, editions, shelves, chartsHeldBy }) {
  const files = new Map();
  files.set('v1/volume.json', {
    display_config: { volume_name: 'Bible' },
    books: units.map(id => ({ id, leaves: 2 })),
    editions
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

const shelfFor = (held, label, groups = []) => ({
  units: [...held],
  groups,
  divisions: [{ label, image: null, from: 1, to: held.length }]
});

// THREE EDITIONS, THREE DIFFERENT DENOMINATORS, and that is the point. The
// Hebrew has finished its 39; the Greek New Testament and Swete have confirmed
// nothing yet. All three answers must be right at once, against one volume
// that enumerates 76.
const EDITIONS = [
  { code: 'HEB', hasChart: true, proofread: false, language: 'hebrew', direction: 'rtl', name: 'Leningrad Codex', proofreadUnits: [...TANAKH] },
  { code: 'GNT', hasChart: true, proofread: false, language: 'greek', direction: 'ltr', name: 'Greek New Testament', proofreadUnits: [] },
  { code: 'LXX', hasChart: true, proofread: false, language: 'greek', direction: 'ltr', name: 'Swete', proofreadUnits: [] }
];

const build = ({ units, held, shelves }) => loadBibleVolume({
  base: '', version: 'v1',
  fetchJson: corpus({ units, editions: EDITIONS, chartsHeldBy: held, shelves })
});

// Before Swete: 66 units, and Swete holds nothing yet.
const atSixtySix = () => build({
  units: SIXTY_SIX,
  held: { HEB: TANAKH, GNT: NEW_TESTAMENT, LXX: [] },
  shelves: {
    HEB: shelfFor(TANAKH, 'תנ״ך'),
    GNT: shelfFor(NEW_TESTAMENT, 'Greek New Testament'),
    LXX: shelfFor([], 'Swete')
  }
});

// After Swete: 76 units, and Swete holds the 39 plus its own ten.
const atSeventySix = (over = {}) => build({
  units: SEVENTY_SIX,
  held: { HEB: TANAKH, GNT: NEW_TESTAMENT, LXX: SWETE_HOLDS },
  shelves: {
    HEB: shelfFor(TANAKH, 'תנ״ך'),
    GNT: shelfFor(NEW_TESTAMENT, 'Greek New Testament'),
    LXX: shelfFor(SWETE_HOLDS, 'Swete'),
    ...over
  }
});

describe('the unit list grows past 39 (O-80)', () => {
  it('66 UNITS TO 76 AND THE FINISHED HEBREW STAYS FINISHED — the O-71 guard at the new width', async () => {
    // This is the whole of the "will growth break the Hebrew" question, and
    // the answer is no, for a reason already paid for: O-71 moved the
    // denominator off the volume and onto the edition, after Howell met
    // "39 of 66, NOT PROOFREAD" on a finished edition at the testament ring.
    const before = await atSixtySix();
    const after = await atSeventySix();

    assert.equal(before.units.length, 66);
    assert.equal(after.units.length, 76, 'W-126: the Septuagint adds ten');
    assert.equal(isEditionFullyConfirmed(before, 'HEB'), true);
    assert.equal(isEditionFullyConfirmed(after, 'HEB'), true,
      'the Hebrew confirmed 39 of the 39 IT HOLDS — books it has never held are not its work');

    // THE CELL PROVES ITSELF WITHOUT MUTATION, and it has to.
    //
    // This assertion first proved itself by reversion: revert line 667 of
    // src/adapters/bible-volume.js to the pre-O-71 denominator and watch the
    // line above go red. That worked, and it was a check NO NON-AUTHOR COULD
    // EVER RUN — WF-15 makes the wall read-only both ways, so the brother
    // cannot edit a source file in this tree even for a second, and he was
    // right to refuse when asked (2026-08-20). A check only its author can
    // run is not a check under WF-17.
    //
    // So both answers are computed here instead, read-only, from exported
    // functions. The one O-71 deleted is on the left; the one it installed is
    // on the right. Anyone can re-run this, from either side of the wall.
    const confirmed = confirmedUnitsOf(after, 'HEB');
    const volumeWide = after.units.map(u => u.id);          // what O-71 removed
    const editionsOwn = [...chartedUnitsOf(after, 'HEB')];  // what O-71 installed
    assert.equal(volumeWide.length, 76);
    assert.equal(editionsOwn.length, 39);
    assert.equal(volumeWide.every(id => confirmed.has(id)), false,
      "the volume's denominator answers NOT PROOFREAD — this is the bug Howell met");
    assert.equal(editionsOwn.every(id => confirmed.has(id)), true,
      "the edition's own denominator answers FINISHED — and the shipped code takes this one");
  });

  it('the deuterocanon appears in Swete and NOWHERE else', async () => {
    const volume = await atSeventySix();
    assert.deepEqual([...chartedUnitsOf(volume, 'HEB')].sort(), [...TANAKH].sort());
    assert.deepEqual([...chartedUnitsOf(volume, 'GNT')].sort(), [...NEW_TESTAMENT].sort());
    assert.deepEqual([...chartedUnitsOf(volume, 'LXX')].sort(), [...SWETE_HOLDS].sort());
    for (const id of LXX_ONLY) {
      assert.equal(chartedUnitsOf(volume, 'HEB').has(id), false,
        `${id}: the Hebrew has never held it, and widening the enumeration does not hand it one`);
      assert.equal(chartedUnitsOf(volume, 'GNT').has(id), false,
        `${id}: nor has the Greek New Testament`);
    }
  });

  it('each edition\'s door names what that edition shelves, not what the volume enumerates', async () => {
    const volume = await atSeventySix();
    assert.equal(volume.divisionsFor('HEB')[0].books.length, 39);
    assert.equal(volume.divisionsFor('GNT')[0].books.length, 27);
    assert.equal(volume.divisionsFor('LXX')[0].books.length, 49);
    assert.equal(volume.divisionsFor('HEB')[0].label, 'תנ״ך');
  });

  // ── Ἔσδρας Β — the case that has never been exercised ───────────────────
  //
  // Two shapes are available. Only one is compatible with an invariant the
  // engine already relies on, and this pair of cells is the measurement
  // rather than the ruling.

  it('SHAPE ONE — one name over two books: the engine carries this today', async () => {
    // Swete shelves Ezra and Nehemiah adjacently and puts ONE section label
    // across the pair. This is exactly how "Prophets" already works (H-26:
    // sections are labels, never levels), so it needs no new machinery.
    const at = SWETE_HOLDS.indexOf(EZRA) + 1;
    assert.equal(SWETE_HOLDS[at], NEHEMIAH, 'the two are adjacent on this shelf, which the label requires');
    const volume = await atSeventySix({
      LXX: shelfFor(SWETE_HOLDS, 'Swete', [{ label: 'Ἔσδρας Β', from: at, to: at + 1 }])
    });
    assert.equal(volume.sectionOf('LXX', EZRA), 'Ἔσδρας Β');
    assert.equal(volume.sectionOf('LXX', NEHEMIAH), 'Ἔσδρας Β',
      'one Greek name reaches both Hebrew books');
    assert.equal(volume.sectionOf('HEB', EZRA), null,
      'and the Hebrew, which shelves no such group, is untouched by it');
    // The cost, stated so nobody discovers it on the LAN: the reader still
    // walks TWO doors under that one name. A label spans; it does not merge.
    assert.equal(volume.divisionsFor('LXX')[0].books.filter(
      id => id === EZRA || id === NEHEMIAH).length, 2);
  });

  it('SHAPE TWO — Ἔσδρας Β as a 77th unit breaks an invariant the engine already relies on', () => {
    // `editionSeatsUtterance` is written on this sentence, in
    // src/adapters/bible-volume.js: "An utterance belongs to exactly ONE unit
    // by construction — the spine is per-unit and holds every utterance any
    // edition attests there — so there is no second place to look and no
    // ambiguity about where to look first."
    //
    // A 77th unit carrying Ezra's and Nehemiah's verses under a Greek address
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
      'three units, two addresses — the 77th unit is unreachable through the index '
      + 'that decides where a reader lands, and it fails silently');
  });
});
