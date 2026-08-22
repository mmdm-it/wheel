// GROWTH UNDER LEAF-AND-SHARD (O-92, rewriting O-80's cells — W-102: cells
// are rewritten, not amended, when the doctrine under them moves).
//
// O-80 measured how the SHARED unit list would grow past 39 and found one
// case it could not carry: Ἔσδρας Β, one Greek book over two Hebrew ones,
// which under a shared book layer put every one of its verses in two books
// at once. O-89 ruled that layer out of existence — books are edition
// vocabulary, the volume owns leaves and shards — and O-90/O-92 built it.
// These cells prove the dissolve on the new machinery:
//
//   growth is PER EDITION now (there is no shared list to widen);
//   a finished edition stays finished whatever other editions declare;
//   and Esdras B is simply ONE BOOK of the Greek, natively, over two
//   shards, while the Hebrew reads the same leaves as two books — neither
//   edition knowing the other exists, exactly as their verse numbers
//   already do not.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadBibleVolume, chartedUnitsOf, confirmedUnitsOf, isEditionFullyConfirmed,
  editionSeatsUtterance
} from '../src/adapters/bible-volume.js';

// Two shards standing for Ezra and Nehemiah, plus one for a Greek-only book.
const SHARDS = [
  { id: 'sh-ezra', utterances: 2 },
  { id: 'sh-nehe', utterances: 2 },
  { id: 'sh-tobit', utterances: 2 }
];
const UTT = {
  'sh-ezra': ['u-ez1', 'u-ez2'],
  'sh-nehe': ['u-ne1', 'u-ne2'],
  'sh-tobit': ['u-to1', 'u-to2']
};

// The Hebrew: two books, one shard each, both confirmed. The Greek: TWO
// books — Esdras B over BOTH of the Hebrew's shards with chapters running
// straight through, and Tobit over the shard the Hebrew never touches.
function corpus() {
  const files = new Map();
  files.set('v1/volume.json', {
    display_config: { volume_name: 'Bible', structure_type: 'leaf_and_shard' },
    shards: SHARDS,
    editions: [
      { code: 'HEB', hasChart: true, proofread: false, language: 'hebrew', direction: 'rtl', name: 'Leningrad Codex', proofreadUnits: ['h-ezra', 'h-nehe'] },
      { code: 'GRC', hasChart: true, proofread: false, language: 'greek', direction: 'ltr', name: 'Swete', proofreadUnits: [] }
    ]
  });
  for (const s of SHARDS) files.set(`v1/spine/${s.id}.json`, { shard: s.id, utterances: [...UTT[s.id]] });
  files.set('v1/charts/HEB/index.json', {
    edition: 'HEB',
    books: [{ file: 'h-ezra', shards: ['sh-ezra'] }, { file: 'h-nehe', shards: ['sh-nehe'] }],
    groups: [], divisions: [{ label: 'תנ״ך', image: null, from: 1, to: 2 }]
  });
  files.set('v1/charts/HEB/h-ezra.json', {
    book: 'h-ezra', shards: ['sh-ezra'],
    groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['u-ez1'] }, { label: '2', utterances: ['u-ez2'] }]
  });
  files.set('v1/charts/HEB/h-nehe.json', {
    book: 'h-nehe', shards: ['sh-nehe'],
    groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['u-ne1'] }, { label: '2', utterances: ['u-ne2'] }]
  });
  files.set('v1/charts/GRC/index.json', {
    edition: 'GRC',
    books: [{ file: 'g-esdrasB', shards: ['sh-ezra', 'sh-nehe'] }, { file: 'g-tobit', shards: ['sh-tobit'] }],
    groups: [], divisions: [{ label: 'Ἡ Παλαιὰ Διαθήκη', image: null, from: 1, to: 2 }]
  });
  // ONE BOOK, chapters numbered straight through both shards — the numbering
  // is the edition's own, exactly as verse numbers always were.
  files.set('v1/charts/GRC/g-esdrasB.json', {
    book: 'g-esdrasB', shards: ['sh-ezra', 'sh-nehe'],
    groups: [{ label: '1', from: 1, to: 2 }, { label: '2', from: 3, to: 4 }],
    seats: [
      { label: '1', utterances: ['u-ez1'] }, { label: '2', utterances: ['u-ez2'] },
      { label: '1', utterances: ['u-ne1'] }, { label: '2', utterances: ['u-ne2'] }
    ]
  });
  files.set('v1/charts/GRC/g-tobit.json', {
    book: 'g-tobit', shards: ['sh-tobit'],
    groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['u-to1'] }, { label: '2', utterances: ['u-to2'] }]
  });
  return async p => {
    const key = p.replace(/^\/*/, '');
    if (!files.has(key)) throw new Error(`404 ${key}`);
    return JSON.parse(JSON.stringify(files.get(key)));
  };
}
const load = () => loadBibleVolume({ base: '', version: 'v1', fetchJson: corpus() });

describe('growth is per edition, and Esdras B dissolves (O-92, was O-80)', () => {
  it('EACH EDITION COUNTS ITS OWN BOOKS — there is no shared list to widen', async () => {
    const volume = await load();
    assert.equal(volume.shards.length, 3, 'the volume owns storage, not vocabulary');
    assert.deepEqual(volume.booksFor('HEB').map(b => b.id), ['h-ezra', 'h-nehe']);
    assert.deepEqual(volume.booksFor('GRC').map(b => b.id), ['g-esdrasB', 'g-tobit']);
    assert.deepEqual([...chartedUnitsOf(volume, 'HEB')].sort(), ['h-ezra', 'h-nehe']);
    assert.deepEqual([...chartedUnitsOf(volume, 'GRC')].sort(), ['g-esdrasB', 'g-tobit']);
  });

  it('THE FINISHED HEBREW STAYS FINISHED whatever the Greek declares — the O-71 guard, per edition by construction', async () => {
    const volume = await load();
    assert.equal(isEditionFullyConfirmed(volume, 'HEB'), true,
      'the Hebrew confirmed both books IT declares; Greek vocabulary is not its work');
    assert.equal(isEditionFullyConfirmed(volume, 'GRC'), false,
      'and the Greek has confirmed nothing of its own');
    // The old bug needed a shared denominator to exist. It does not:
    const confirmed = confirmedUnitsOf(volume, 'HEB');
    for (const id of ['g-esdrasB', 'g-tobit']) {
      assert.ok(!confirmed.has(id), `${id} is another edition's word and cannot enter the Hebrew's ledger`);
    }
  });

  it('ESDRAS B IS ONE BOOK, natively — two shards, chapters straight through, no spanning trick', async () => {
    const volume = await load();
    const chart = volume.chartFor('g-esdrasB', 'GRC');
    assert.deepEqual(chart.shards, ['sh-ezra', 'sh-nehe'], 'one book over two storage boxes');
    assert.deepEqual(chart.groups.map(g => g.label), ['1', '2'],
      "chapters are the edition's own numbering across both shards");
    assert.equal(volume.divisionsFor('GRC')[0].books.filter(id => id === 'g-esdrasB').length, 1,
      'ONE door on the ring — the two-doors cost O-80 measured is gone');
  });

  it('THE CROSSING GOES THROUGH THE LEAVES: a Hebrew verse finds its Greek home, whatever the books are called', async () => {
    const volume = await load();
    // The reader stands on Nehemiah's first verse in the Hebrew. Does the
    // Greek hold it? The Greek has no book called Nehemiah — the answer
    // crosses on the utterance, and it is yes, inside Esdras B.
    assert.equal(editionSeatsUtterance(volume, 'GRC', 'h-nehe', 'u-ne1'), true,
      'the Greek seats the leaf, under its own word for the book');
    assert.equal(editionSeatsUtterance(volume, 'HEB', 'g-tobit', 'u-to1'), false,
      'and the Hebrew honestly does not seat a leaf it never carried');
  });

  it('THE OLD AMBIGUITY IS STRUCTURALLY GONE: each edition claims every leaf exactly once', async () => {
    const volume = await load();
    // O-80's cell 5 showed a 77th shared unit silently losing the seat-index
    // race. Per-edition trees cannot race: count, per edition, how many of
    // its books seat each utterance.
    for (const edition of ['HEB', 'GRC']) {
      const claims = new Map();
      for (const book of volume.booksFor(edition)) {
        const chart = volume.chartFor(book.id, edition);
        for (const seat of chart.seats) {
          for (const u of seat.utterances) claims.set(u, (claims.get(u) || 0) + 1);
        }
      }
      for (const [u, n] of claims) {
        assert.equal(n, 1, `${edition} claims ${u} ${n} times — one home per leaf, per edition`);
      }
    }
  });
});
