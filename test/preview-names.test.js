// THE PREVIEW ASKS THE WRONG EDITION FOR A NAME (O-94, Howell 2026-08-23).
//
// While the reader turns the Tertiary Stratum, the Primary behind the glass
// follows the lens (Howell 2026-07-30) — and the parent button is part of
// what repaints: "GENESIS I" becomes "בראשית א" as Hebrew passes under it.
//
// The engine painted that by swapping the name table to the hovered tongue
// while leaving the CURRENT edition's book ids in the chain — so it looked up
// a GREEK book id in `hebrew.json`. It only ever worked because cargo had
// filled every tongue's names file with every other edition's books: 448 of
// them in one commit, sourced from nowhere (W-76's defect, thirty times over).
//
// The leaf is the bridge (W-21, O-89). The hovered edition seats the reader's
// utterance under ITS OWN book, so the preview resolves that book through the
// leaf and names it from the hovered tongue's own-edition names. Then a tongue
// names only the books of editions written in that tongue, and nothing else is
// called for.
//
// THE FIXTURE IS THE REAL SHAPE: two editions with DISJOINT book ids over
// SHARED shards, and two names files that know only their own edition's books
// — which is exactly what cargo would hold after the false demand is lifted.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBibleVolume, bookSeatingUtterance, editionSeatsUtterance } from '../src/adapters/bible-volume.js';

// One shard standing for the stretch both editions carry, one for a book only
// the Greek has. Book ids are per-edition and share nothing (O-92).
const SHARDS = [{ id: 'sh-a', utterances: 2 }, { id: 'sh-b', utterances: 2 }];
const UTT = { 'sh-a': ['u-a1', 'u-a2'], 'sh-b': ['u-b1', 'u-b2'] };

function corpus() {
  const files = new Map();
  files.set('v1/volume.json', {
    display_config: { volume_name: 'Bible', structure_type: 'leaf_and_shard' },
    shards: SHARDS,
    editions: [
      { code: 'HEB', hasChart: true, proofread: true, language: 'hebrew', direction: 'rtl', name: 'Leningrad Codex' },
      { code: 'GRC', hasChart: true, proofread: true, language: 'greek', direction: 'ltr', name: 'Patriarchal Text' }
    ]
  });
  for (const s of SHARDS) files.set(`v1/spine/${s.id}.json`, { shard: s.id, utterances: [...UTT[s.id]] });
  // The Hebrew holds only the first shard, under its own book id.
  files.set('v1/charts/HEB/index.json', {
    edition: 'HEB', books: [{ file: 'h-alef', shards: ['sh-a'] }], groups: [],
    divisions: [{ label: 'תנ״ך', image: null, from: 1, to: 1 }]
  });
  files.set('v1/charts/HEB/h-alef.json', {
    book: 'h-alef', shards: ['sh-a'], groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['u-a1'] }, { label: '2', utterances: ['u-a2'] }]
  });
  // The Greek holds BOTH shards, and calls the first one something else.
  files.set('v1/charts/GRC/index.json', {
    edition: 'GRC',
    books: [{ file: 'g-alpha', shards: ['sh-a'] }, { file: 'g-beta', shards: ['sh-b'] }],
    groups: [], divisions: [{ label: 'Ἡ Παλαιὰ Διαθήκη', image: null, from: 1, to: 2 }]
  });
  files.set('v1/charts/GRC/g-alpha.json', {
    book: 'g-alpha', shards: ['sh-a'], groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['u-a1'] }, { label: '2', utterances: ['u-a2'] }]
  });
  files.set('v1/charts/GRC/g-beta.json', {
    book: 'g-beta', shards: ['sh-b'], groups: [{ label: '1', from: 1, to: 2 }],
    seats: [{ label: '1', utterances: ['u-b1'] }, { label: '2', utterances: ['u-b2'] }]
  });
  return async p => {
    const key = p.replace(/^\/*/, '');
    if (!files.has(key)) throw new Error(`404 ${key}`);
    return JSON.parse(JSON.stringify(files.get(key)));
  };
}
const load = () => loadBibleVolume({ base: '', version: 'v1', fetchJson: corpus() });

// The names files as they stand once the false demand is lifted: each tongue
// knows the books of the editions written in that tongue, and no others.
const NAMES = {
  hebrew: { 'h-alef': 'ספר אלף' },
  greek: { 'g-alpha': 'Ἄλφα', 'g-beta': 'Βῆτα' }
};

// What the parent button does, reduced to its one question: the reader stands
// on an utterance while the tongue LANG is under the lens; what name is shown?
// `chainBookId` is the book id the ring was built with — the COMMITTED
// edition's word, which is what the preview leaves in place.
function previewName(volume, { chainBookId, utterance, previewEdition, language }) {
  const bookId = bookSeatingUtterance(volume, previewEdition, chainBookId, utterance) || chainBookId;
  return NAMES[language]?.[bookId] || null;
}

describe('the preview names the hovered edition\'s own book (O-94)', () => {
  it('A GREEK READER PREVIEWING HEBREW IS NAMED IN THE HEBREW\'S OWN BOOK', async () => {
    const volume = await load();
    // Standing in the Greek's Ἄλφα, first verse; Hebrew passes under the lens.
    const shown = previewName(volume, {
      chainBookId: 'g-alpha', utterance: 'u-a1', previewEdition: 'HEB', language: 'hebrew'
    });
    assert.equal(shown, 'ספר אלף',
      'the Hebrew names ITS OWN book for this leaf — asking hebrew.json for a Greek book id is the defect');
  });

  it('and the mirror: a Hebrew reader previewing Greek', async () => {
    const volume = await load();
    const shown = previewName(volume, {
      chainBookId: 'h-alef', utterance: 'u-a1', previewEdition: 'GRC', language: 'greek'
    });
    assert.equal(shown, 'Ἄλφα');
  });

  it('NO TONGUE IS ASKED FOR ANOTHER EDITION\'S BOOK: every preview resolves to a book that tongue knows', async () => {
    const volume = await load();
    const cases = [
      { chainBookId: 'g-alpha', utterance: 'u-a1', previewEdition: 'HEB', language: 'hebrew' },
      { chainBookId: 'g-beta', utterance: 'u-b1', previewEdition: 'GRC', language: 'greek' },
      { chainBookId: 'h-alef', utterance: 'u-a2', previewEdition: 'GRC', language: 'greek' }
    ];
    for (const c of cases) {
      const resolved = bookSeatingUtterance(volume, c.previewEdition, c.chainBookId, c.utterance);
      assert.ok(resolved, `${c.previewEdition} seats ${c.utterance} somewhere`);
      assert.ok(NAMES[c.language][resolved],
        `${c.language} knows ${resolved} without holding any other edition's vocabulary`);
    }
  });

  it('a leaf the hovered edition does not hold answers NULL, and the caller keeps what it had', async () => {
    const volume = await load();
    // The Hebrew has no second shard at all. Nothing to name, and no guess.
    assert.equal(bookSeatingUtterance(volume, 'HEB', 'g-beta', 'u-b1'), null);
    assert.equal(previewName(volume, {
      chainBookId: 'g-beta', utterance: 'u-b1', previewEdition: 'HEB', language: 'hebrew'
    }), null, 'no Hebrew name is invented for scripture the Hebrew does not carry');
  });

  it('THE OLDER YES/NO CALL IS THE SAME LOOKUP — one instrument, not two (O-94)', async () => {
    const volume = await load();
    const probes = [
      ['HEB', 'g-alpha', 'u-a1'], ['HEB', 'g-beta', 'u-b1'],
      ['GRC', 'h-alef', 'u-a1'], ['GRC', 'h-alef', 'u-zz9']
    ];
    for (const [edition, bookId, utterance] of probes) {
      assert.equal(
        editionSeatsUtterance(volume, edition, bookId, utterance),
        Boolean(bookSeatingUtterance(volume, edition, bookId, utterance)),
        `${edition}/${bookId}/${utterance}: the boolean is the book lookup, read as yes or no`
      );
    }
  });
});
