// WHERE THE EDITIONS SHARE NO LEAF (O-313, Howell 2026-11-18, retiring
// O-303's ring of every edition's books: "Switching between languages or
// editions should only be allowed in the secondary and tertiary strata").
//
// A volume that declares `books_across_editions` has editions that share no
// leaf. Its ring of books is the edition's own, as in every volume (O-71,
// O-87); what the declaration changes is the edition and language rings,
// which offer every edition wherever the reader stands, since a filter by
// place would leave them with one seat each.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBibleVolume } from '../src/adapters/bible-volume.js';
import { buildBibleBookCousinChain } from '../src/navigation/cousin-builder.js';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';
import { createInteractionStore } from '../src/core/interaction-store.js';

function corpus({ across }) {
  const files = new Map();
  const works = [['ENG', 'english', ['e1']], ['ITA', 'italian', ['i1', 'i2']]];
  files.set('v1/volume.json', {
    display_config: { volume_name: 'Works', structure_type: 'leaf_and_shard', ...(across ? { books_across_editions: true } : {}) },
    shards: works.flatMap(([, , books]) => books.map(id => ({ id: `s-${id}`, utterances: 2 }))),
    editions: works.map(([code, language]) => ({ code, hasChart: true, proofread: false, language, direction: 'ltr', name: code, proofreadUnits: [] }))
  });
  for (const [code, , books] of works) {
    for (const id of books) {
      files.set(`v1/spine/s-${id}.json`, { shard: `s-${id}`, utterances: [`${id}:1`, `${id}:2`] });
      files.set(`v1/charts/${code}/${id}.json`, {
        book: id, shards: [`s-${id}`],
        seats: [{ label: '1', utterances: [`${id}:1`] }, { label: '2', utterances: [`${id}:2`] }],
        groups: [{ label: '1', from: 1, to: 2 }]
      });
    }
    files.set(`v1/charts/${code}/index.json`, {
      edition: code, books: books.map(id => ({ file: id, shards: [`s-${id}`] })), groups: [],
      divisions: [{ label: `Doctrine (${code})`, image: null, from: 1, to: books.length }]
    });
  }
  return async p => {
    const key = p.replace(/^\/*/, '');
    if (!files.has(key)) throw new Error(`404 ${key}`);
    return JSON.parse(JSON.stringify(files.get(key)));
  };
}

async function ringFor({ across, edition }) {
  const volume = await loadBibleVolume({ base: '', version: 'v1', fetchJson: corpus({ across }) });
  // The manifest as volume-configs.js builds it: toRoot() bare.
  const manifest = { Gutenberg_Bible: volume.toRoot() };
  Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
  const names = { books: { e1: 'First', i1: 'Primo', i2: 'Secondo' } };
  const { items, selectedIndex } = buildBibleBookCousinChain(manifest, { edition, names });
  return { volume, items: items.filter(i => i && i.id), selectedIndex };
}

describe('the ring of books is the edition\'s own, whatever the volume declares (O-313)', () => {
  for (const across of [true, false]) {
    it(`shows only the books of the edition up (declared: ${across})`, async () => {
      const english = await ringFor({ across, edition: 'ENG' });
      const italian = await ringFor({ across, edition: 'ITA' });
      assert.deepEqual(english.items.map(i => i.id), ['e1']);
      assert.deepEqual(italian.items.map(i => i.id), ['i1', 'i2']);
    });
  }
});

describe('the edition and language rings offer every edition where no leaf is shared (O-313)', () => {
  const meta = across => ({
    booksAcrossEditions: across,
    translations: {
      ENG: { code: 'ENG', language: 'english', hasChart: true, cleared: true },
      ITA: { code: 'ITA', language: 'italian', hasChart: true, cleared: true }
    }
  });
  it('an edition that does not hold the place is a door in a shared volume and a plain seat where no leaf is shared', () => {
    for (const across of [false, true]) {
      const bridge = createDimensionBridge({ store: createInteractionStore(), translationsMeta: meta(across) });
      bridge.setEditionsHere(['ENG']);
      assert.equal(bridge.isElsewhere('ITA'), !across);
      assert.equal(bridge.isElsewhereLanguage('italian'), !across);
      assert.deepEqual([...bridge.languagesAvailable()].sort(), ['english', 'italian'], 'both tongues stand on the ring');
      assert.equal(bridge.setTranslation('ITA'), across, across ? 'the other edition commits from the ring' : 'refused, as before: it is crossed to by its door');
    }
  });
});
