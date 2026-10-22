import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBibleVolume, bookSeatingUtterance, primeSeatIndex } from '../src/adapters/bible-volume.js';
import { buildBibleVerseChain } from '../src/navigation/cousin-builder.js';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';

// THE DEAD START (O-205). The first drill of a session launched a third of a
// second late, and most of it was the volume's seats being expanded a second
// and a third time for answers the boot had already computed. These pin the
// three remedies: the woven chain is one object per edition; the seat lookup
// the globe asks is an index, not a walk; and the adapter's chapter chain is
// cut from the chain the ring already holds.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(repoRoot, 'test/fixtures/h11/gutenberg');
const ED = 'DRA';

// The same volume with ONE chart swapped out from under it — what a shelf
// stocked after boot looks like (O-175): the object changes, nothing else.
function withChart(volume, bookId, edition, chart) {
  const override = new Map([[`${bookId}|${edition}`, chart]]);
  return Object.create(volume, {
    chartFor: { value: (u, e) => (override.has(`${u}|${e}`) ? override.get(`${u}|${e}`) : volume.chartFor(u, e)) },
    swap: { value: (c) => override.set(`${bookId}|${edition}`, c) }
  });
}

describe('the dead start: one expansion per edition, answered from indexes', () => {
  let volume, manifest, bookId, chart;
  before(async () => {
    volume = await loadBibleVolume({ base: BASE, version: 'v1', fetchJson: async p => JSON.parse(readFileSync(p, 'utf-8')) });
    manifest = { Gutenberg_Bible: volume.toRoot() };
    Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
    bookId = volume.booksFor(ED)[0].id;
    chart = volume.chartFor(bookId, ED);
  });

  it('the woven verse chain is the same object on every ask', () => {
    const a = buildBibleVerseChain(manifest, { edition: ED }).items;
    const b = buildBibleVerseChain(manifest, { edition: ED, initialVerseId: a.find(Boolean).id }).items;
    assert.ok(a.length > 0);
    assert.equal(a, b, 'identity, not merely equality: every cache downstream compares chains');
  });

  it('a chart that lands later weaves the chain again', () => {
    const w = withChart(volume, bookId, ED, chart);
    const m = { Gutenberg_Bible: volume.toRoot() };
    Object.defineProperty(m, '__wallVolume', { value: w, enumerable: false });
    const a = buildBibleVerseChain(m, { edition: ED }).items;
    assert.equal(buildBibleVerseChain(m, { edition: ED }).items, a);
    // The same seats in a NEW chart object: the shelf was restocked.
    w.swap({ ...chart, seats: chart.seats.map(s => ({ ...s })) });
    const b = buildBibleVerseChain(m, { edition: ED }).items;
    assert.notEqual(b, a, 'a new chart object is a new weave');
    assert.deepEqual(b.filter(Boolean).map(i => i.id), a.filter(Boolean).map(i => i.id), 'with the same seats, the same chain');
  });

  it('the seat lookup answers from an index, and the index agrees with the walk', () => {
    const walk = (u) => {
      for (const book of volume.booksFor(ED)) {
        const c = volume.chartFor(book.id, ED);
        if (c?.seats?.some(seat => seat?.utterances?.includes(u))) return book.id;
      }
      return null;
    };
    assert.equal(primeSeatIndex(volume, ED), true);
    const utterances = chart.seats.flatMap(s => s.utterances || []);
    assert.ok(utterances.length >= 31);
    for (const u of utterances) assert.equal(bookSeatingUtterance(volume, ED, null, u), walk(u));
    assert.equal(bookSeatingUtterance(volume, ED, bookId, 'no-such-utterance'), null);
    assert.equal(bookSeatingUtterance(volume, 'no-such-edition', bookId, utterances[0]), null);
  });

  it('a chart that lands later is in the index on the next ask', () => {
    const w = withChart(volume, bookId, ED, chart);
    assert.equal(bookSeatingUtterance(w, ED, null, 'late:u'), null);
    w.swap({ ...chart, seats: [...chart.seats, { label: '99', utterances: ['late:u'] }] });
    assert.equal(bookSeatingUtterance(w, ED, null, 'late:u'), bookId);
  });

  it('a volume with no shelf to index keeps the walk', () => {
    const bare = { chartFor: (u, e) => (u === 'X' && e === 'E' ? { seats: [{ label: '1', utterances: ['x:1'] }] } : null) };
    assert.equal(bookSeatingUtterance(bare, 'E', 'X', 'x:1'), 'X');
    assert.equal(bookSeatingUtterance(bare, 'E', 'X', 'x:2'), null);
  });

  it("the adapter's chapter chain is cut from the chain the ring holds", () => {
    const h = bibleAdapter.createHandlers({ manifest, namesMap: { locale: 'latin', books: {} }, options: { activeEdition: ED, translation: ED } });
    const chapters = h.layoutBindings.getBibleChapterChain(null).items;
    assert.ok(chapters.filter(Boolean).length > 0);
    const ring = h.layoutBindings.getBibleVerseChain(null).items;
    assert.equal(ring, buildBibleVerseChain(manifest, { edition: ED }).items, 'the ring holds the one woven chain');
  });
});
