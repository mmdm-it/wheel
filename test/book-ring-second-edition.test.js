// THE BOOK RING AND THE SECOND EDITION (O-87, Howell from the LAN,
// 2026-08-22): in the Greek New Testament it was impossible to migrate out
// of the chapters ring — the reader could not change books except by
// rotating through every chapter between them. The Hebrew was fine.
//
// THE MECHANISM. `toRoot()` is called once, at manifest load, with no
// argument — and it defaults its scaffold to the FIRST declared edition, so
// the manifest's `testaments` tree holds only that edition's books.
// `buildBibleBookCousinChain` was the one builder still walking that
// scaffold to enumerate books; every book of any LATER edition was invisible
// to it, the membership filter then had nothing to keep, and the chain came
// back empty — which makes the parent handler return false, which is
// "migration impossible" on the glass.
//
// WHY NO CELL EVER SAW IT: the O-71 fixture hand-built a scaffold carrying
// BOTH editions' books, which is exactly what the real `toRoot()` does not
// do. These cells build the manifest the way `volume-configs.js` actually
// does — `toRoot()` with no argument, first edition Hebrew — so the trap is
// in the fixture because the trap is in the app.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadBibleVolume } from '../src/adapters/bible-volume.js';
import { buildBibleBookCousinChain } from '../src/navigation/cousin-builder.js';

const HEB_BOOKS = Array.from({ length: 5 }, (_, i) => `h${i + 1}`);
const GRC_BOOKS = Array.from({ length: 3 }, (_, i) => `g${i + 1}`);

function corpus() {
  const files = new Map();
  const ALL = [...HEB_BOOKS, ...GRC_BOOKS];
  files.set('v1/volume.json', {
    display_config: { volume_name: 'Bible', structure_type: 'leaf_and_shard' },
    // O-92: shards and editions, nothing else. One shard per fixture book,
    // sharing the book's string for brevity — the classes are distinct in
    // real data and nothing here depends on the coincidence.
    shards: ALL.map(id => ({ id: `s-${id}`, utterances: 2 })),
    editions: [
      { code: 'HEB', hasChart: true, proofread: false, language: 'hebrew', direction: 'rtl', name: 'Leningrad Codex', proofreadUnits: [...HEB_BOOKS] },
      { code: 'GRC', hasChart: true, proofread: false, language: 'greek', direction: 'ltr', name: 'Patriarchal Text', proofreadUnits: [] }
    ]
  });
  for (const id of ALL) {
    files.set(`v1/spine/s-${id}.json`, { shard: `s-${id}`, utterances: [`${id}:1`, `${id}:2`] });
  }
  const chart = id => ({
    book: id, shards: [`s-${id}`],
    seats: [{ label: '1', utterances: [`${id}:1`] }, { label: '2', utterances: [`${id}:2`] }],
    groups: [{ label: '1', from: 1, to: 2 }]
  });
  for (const id of HEB_BOOKS) files.set(`v1/charts/HEB/${id}.json`, chart(id));
  for (const id of GRC_BOOKS) files.set(`v1/charts/GRC/${id}.json`, chart(id));
  files.set('v1/charts/HEB/index.json', {
    edition: 'HEB', books: HEB_BOOKS.map(id => ({ file: id, shards: [`s-${id}`] })), groups: [],
    divisions: [{ label: 'תנ״ך', image: null, from: 1, to: HEB_BOOKS.length }]
  });
  files.set('v1/charts/GRC/index.json', {
    edition: 'GRC', books: GRC_BOOKS.map(id => ({ file: id, shards: [`s-${id}`] })), groups: [],
    divisions: [{ label: 'Ἡ Καινὴ Διαθήκη', image: null, from: 1, to: GRC_BOOKS.length }]
  });
  return async p => {
    const key = p.replace(/^\/*/, '');
    if (!files.has(key)) throw new Error(`404 ${key}`);
    return JSON.parse(JSON.stringify(files.get(key)));
  };
}

// The manifest EXACTLY as volume-configs.js builds it: toRoot() bare.
async function realManifest() {
  const volume = await loadBibleVolume({ base: '', version: 'v1', fetchJson: corpus() });
  const manifest = { Gutenberg_Bible: volume.toRoot() };
  Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
  return manifest;
}

// The proofread override, as the phone runs (the Greek is dark without it).
const withOverride = async fn => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  globalThis.window = { location: { hostname: '192.168.88.167', search: '?proofread=true' } };
  try { return await fn(); } finally {
    if (had) globalThis.window = prev; else delete globalThis.window;
  }
};

describe('the book ring exists for the SECOND edition too (O-87)', () => {
  it('THE MIGRATION-OUT CALL, exactly as parentHandler makes it, is non-empty for the Greek', async () => {
    const manifest = await realManifest();
    await withOverride(async () => {
      // This is the precise call bible-adapter's parentHandler makes when the
      // reader taps the parent button on the chapters ring. Empty items means
      // it returns false, and false on the glass is "nothing happens".
      const { items } = buildBibleBookCousinChain(manifest, {
        bookId: 'g2', initialItemId: 'g2', names: {}, edition: 'GRC'
      });
      const ids = items.filter(Boolean).map(i => i.id);
      assert.deepEqual(ids, GRC_BOOKS,
        'the Greek books, in the Greek shelf order — an empty ring here is the bug on the glass');
    });
  });

  it('and still lands on the book the reader is leaving', async () => {
    const manifest = await realManifest();
    await withOverride(async () => {
      const { items, selectedIndex } = buildBibleBookCousinChain(manifest, {
        bookId: 'g2', initialItemId: 'g2', names: {}, edition: 'GRC'
      });
      assert.equal(items[selectedIndex]?.id, 'g2', 'ascent lands where the reader was');
    });
  });

  it('the ring wears the edition\'s OWN division as its parent name', async () => {
    const manifest = await realManifest();
    await withOverride(async () => {
      const { items } = buildBibleBookCousinChain(manifest, { names: {}, edition: 'GRC' });
      const parents = [...new Set(items.filter(Boolean).map(i => i.parentName))];
      assert.deepEqual(parents, ['Ἡ Καινὴ Διαθήκη'],
        'the Greek books hang under the Greek division, not under a scaffold borrowed from the Hebrew');
    });
  });

  it('the FIRST edition is untouched — same books, same order as the scaffold walk gave it', async () => {
    const manifest = await realManifest();
    await withOverride(async () => {
      const { items } = buildBibleBookCousinChain(manifest, { names: {}, edition: 'HEB' });
      assert.deepEqual(items.filter(Boolean).map(i => i.id), HEB_BOOKS);
    });
  });

  it('membership still governs: the proofread flag lifts NOTHING into the wrong edition', async () => {
    const manifest = await realManifest();
    await withOverride(async () => {
      const { items } = buildBibleBookCousinChain(manifest, { names: {}, edition: 'GRC' });
      const ids = new Set(items.filter(Boolean).map(i => i.id));
      for (const id of HEB_BOOKS) {
        assert.ok(!ids.has(id), `${id}: the Hebrew has no seat on the Greek ring (O-71 unbroken)`);
      }
    });
  });

  it('a manifest WITHOUT a wall volume still walks its scaffold — fixtures and other volumes unchanged', () => {
    // The legacy path is the fallback, not dead code: plain fixtures build
    // their testaments by hand and carry no __wallVolume.
    const manifest = {
      Gutenberg_Bible: {
        testaments: {
          T1: { sort_number: 0, books: { a: { sort_number: 0 }, b: { sort_number: 1 } } }
        }
      }
    };
    const { items } = buildBibleBookCousinChain(manifest, { names: {} });
    assert.deepEqual(items.filter(Boolean).map(i => i.id), ['a', 'b']);
  });
});
