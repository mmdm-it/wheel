// THE FIRST VISIT'S VERSE, AND THE VERSE LAST READ (O-179, Howell 2026-09-29):
// "I would rather boot to Psalm 22:1 when the New Testament is not available.
// And when the New Testament is available, I'd like to boot to Matthew 16:18
// ... Later visits should return to the verse last read."
//
// The volume declares its first-visit verses by UTTERANCE — the one id every
// edition's chart shares — and the engine seats the first one the boot
// edition charts. These cells drive the resolver with a synthetic volume, so
// they hold without the corpus: two editions, one holding a "Matthew" and one
// not, the psalm numbered differently in each, exactly the shape of the shelf.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSeatId, seatOfUtterance, firstVisitSeat } from '../src/volume-configs.js';
import { buildBibleVerseChain } from '../src/navigation/cousin-builder.js';

// A chart in the volume's own shape: groups are label + 1-based seat ranges.
const chart = (chapters) => {
  const seats = [], groups = [];
  chapters.forEach(([label, verses]) => {
    const from = seats.length + 1;
    verses.forEach(([v, ...utterances]) => seats.push({ label: v, utterances }));
    groups.push({ label, from, to: seats.length });
  });
  return { groups, seats };
};
const PETRUS = 'u45c67095', SHEPHERD = 'uecb7bab1';
const charts = {
  'bPS-eng|eng': chart([['21', [['1', 'ua'], ['2', 'ub']]], ['22', [['1', SHEPHERD], ['2', 'uc']]]]),
  'bMT-eng|eng': chart([['16', [['17', 'ud'], ['18', PETRUS], ['19', 'ue']]]]),
  'bPS-heb|heb': chart([['22', [['1', 'ua'], ['2', 'ub']]], ['23', [['1', SHEPHERD], ['2', 'uc']]]])
};
const volume = {
  booksFor: ed => ed === 'eng' ? [{ id: 'bPS-eng', testamentId: 'ot' }, { id: 'bMT-eng', testamentId: 'nt' }] : ed === 'heb' ? [{ id: 'bPS-heb', testamentId: 'ot' }] : [],
  chartFor: (book, ed) => charts[`${book}|${ed}`] || null
};
const manifest = { __wallVolume: volume };
const FIRST = [PETRUS, SHEPHERD];

describe('the first visit\'s verse (O-179)', () => {
  it('an edition holding the New Testament opens on Matthew 16:18, in its own labels', () => {
    assert.deepEqual(firstVisitSeat(manifest, 'eng', FIRST), { bookId: 'bMT-eng', testamentId: 'nt', chapterId: '16', verseId: '18' });
  });
  it('an edition without it opens on the psalm — under ITS number, 23 in the Hebrew', () => {
    assert.deepEqual(firstVisitSeat(manifest, 'heb', FIRST), { bookId: 'bPS-heb', testamentId: 'ot', chapterId: '23', verseId: '1' });
    assert.equal(seatOfUtterance(volume, 'heb', PETRUS), null, 'the Hebrew seats no Matthew');
  });
  it('a volume declaring no first visit resolves nothing, and the caller falls to the first leaf', () => {
    assert.equal(firstVisitSeat(manifest, 'eng', []), null);
    assert.equal(firstVisitSeat(manifest, 'eng', undefined), null);
    assert.equal(firstVisitSeat({ __wallVolume: null }, 'eng', FIRST), null);
  });
  it('an unknown edition seats nothing rather than throwing', () => {
    assert.equal(firstVisitSeat(manifest, 'grc', FIRST), null);
  });
});

describe('the verse last read (O-179)', () => {
  it('a seat id reads back into book, chapter and verse — the chain\'s own minting', () => {
    assert.deepEqual(parseSeatId('b05841959_16_18'), { bookId: 'b05841959', chapterId: '16', verseId: '18' });
    assert.deepEqual(parseSeatId('b05841959_22a_1'), { bookId: 'b05841959', chapterId: '22a', verseId: '1' });
  });
  it('anything that is not a seat is not resumed', () => {
    for (const bad of [null, undefined, 42, '', 'b05841959', 'b05841959_16', 'b05841959_16_', '_16_18']) {
      assert.equal(parseSeatId(bad), null, String(bad));
    }
  });
  it('a remembered seat the edition no longer charts lands on the first visit\'s verse, never the first seat', async () => {
    // The real chain over the fixture volume (one book, Genesis, as boot-smoke
    // has it): the first visit is declared by an utterance the chart seats
    // at 1:5; the remembered seat names a chapter the edition has not got.
    const { installBrowserGlobals } = await import('./helpers/browser-globals.mjs');
    installBrowserGlobals('?volume=bible&proofread=true');
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const manifest = await volumeConfigs.bible.loadManifest();
    const vol = manifest.__wallVolume;
    const edition = vol.editions[0].code;
    const unitId = vol.booksFor(edition)[0].id;
    const fifth = vol.chartFor(unitId, edition).seats[4].utterances[0];
    const base = { level: 'verse', cousinMode: true, arrangement: 'cousins-with-gaps', translation: edition, firstVisit: [fifth] };

    const resumedGone = await volumeConfigs.bible.buildChain(manifest, { ...base, bookId: unitId, chapterId: '9', verseId: '9' }, {});
    assert.equal(resumedGone.items[resumedGone.selectedIndex]?.id, `${unitId}_1_5`, 'the first visit\'s verse, not 1:1');

    const firstVisit = await volumeConfigs.bible.buildChain(manifest, base, {});
    assert.equal(firstVisit.items[firstVisit.selectedIndex]?.id, `${unitId}_1_5`, 'nothing remembered: the first visit\'s verse');

    const resumed = await volumeConfigs.bible.buildChain(manifest, { ...base, bookId: unitId, chapterId: '1', verseId: '7' }, {});
    assert.equal(resumed.items[resumed.selectedIndex]?.id, `${unitId}_1_7`, 'remembered and charted: the verse last read');

    const undeclared = await volumeConfigs.bible.buildChain(manifest, { ...base, firstVisit: [] }, {});
    assert.equal(undeclared.items[undeclared.selectedIndex]?.id, `${unitId}_1_1`, 'no first visit declared: the first leaf, as before');
  });
});
