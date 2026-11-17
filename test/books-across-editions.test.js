// EACH BOOK IS ITS OWN WORK, AND THE RING SHOWS THEM ALL (O-303, Howell
// 2026-11-15: each catechism is its own book in the Church, and the globe
// chooses the language within it).
//
// A volume whose editions share one set of leaves shows the books of the
// edition up and nothing else (O-71, O-87) — held by its own tests and
// re-asserted here on the same fixture. A volume that declares
// `books_across_editions` is the other case: its editions share no leaf, so
// the ring is the union, in the volume's order, the same ring whatever
// edition is up; and the language ring offers no door to an edition that
// does not hold the reader's place, because that edition is another book.
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

describe('a ring of separate works shows every edition\'s books (O-303)', () => {
  it('is the union, in the volume\'s order, whichever edition is up', async () => {
    const english = await ringFor({ across: true, edition: 'ENG' });
    const italian = await ringFor({ across: true, edition: 'ITA' });
    assert.deepEqual(english.items.map(i => i.id), ['e1', 'i1', 'i2']);
    assert.deepEqual(italian.items.map(i => i.id), ['e1', 'i1', 'i2'], 'the ring does not change with the language');
    assert.deepEqual(english.items.map(i => i.name), ['First', 'Primo', 'Secondo'], 'a book of another edition is still named');
    for (const i of [...english.items, ...italian.items]) assert.equal(i.level, 'book');
  });

  it('knows which edition each book belongs to, so the edition can follow the book', async () => {
    const { volume, items } = await ringFor({ across: true, edition: 'ENG' });
    assert.deepEqual(items.map(i => volume.editionOf(i.id)), ['ENG', 'ITA', 'ITA']);
  });

  it('leaves a volume that declares nothing exactly as it was', async () => {
    const english = await ringFor({ across: false, edition: 'ENG' });
    const italian = await ringFor({ across: false, edition: 'ITA' });
    assert.deepEqual(english.items.map(i => i.id), ['e1']);
    assert.deepEqual(italian.items.map(i => i.id), ['i1', 'i2']);
  });
});

describe('the language ring offers no door to another book (O-303)', () => {
  const meta = across => ({
    booksAcrossEditions: across,
    translations: {
      ENG: { code: 'ENG', language: 'english', hasChart: true, cleared: true },
      ITA: { code: 'ITA', language: 'italian', hasChart: true, cleared: true }
    }
  });
  it('an edition that does not hold the place is a door in a shared volume and absent in a volume of works', () => {
    for (const across of [false, true]) {
      const bridge = createDimensionBridge({ store: createInteractionStore(), translationsMeta: meta(across) });
      bridge.setEditionsHere(['ENG']);
      assert.equal(bridge.isElsewhere('ITA'), !across, across ? 'no door where the books are separate works' : 'a door, as before');
      assert.equal(bridge.isElsewhereLanguage('italian'), !across);
      assert.equal(bridge.isElsewhere('ENG'), false, 'the edition that holds the place is never elsewhere');
    }
  });
});
