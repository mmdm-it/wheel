// ONE SEAT AT EVERY LEVEL BUT THE LAST — the real fixture, not a synthetic one.
//
// Howell, 2026-08-12, correcting me twice on where the risk actually is. One
// TRANSLATION is not novel: outside Greek most languages carry exactly one, so
// a single seat on the secondary stratum is the normal case the engine has
// always run. The novel state is the PRIMARY stratum, and it is broader than I
// first named — under the wall it has ONE testament, ONE book and ONE
// container, and only the leaf ring has anywhere to go.
//
// None of that has ever been exercised. The corpus has always carried two
// testaments, eight sections and seventy-nine books, so the cousin weave, the
// gap ladder, the seat scatter and the ring's wrap-around have only ever run
// against many seats. Degenerate-case failure lives here — a wrap that assumes
// a next neighbour, a division by a count that is now one.
//
// The synthetic volume in wall-seating and cousin-grammar proves the GRAMMAR
// with real boundaries. This proves the volume Howell actually holds.
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBibleVolume, expandVolumeSeats } from '../src/adapters/bible-volume.js';
import { buildBibleVerseChain, buildBibleBookCousinChain, buildBibleChapterChain } from '../src/navigation/cousin-builder.js';
import { computeChildPyramidGeometry } from '../src/geometry/child-pyramid-geometry.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(repoRoot, 'test/fixtures/h11/gutenberg');

describe('the single-seat primary stratum, on the real fixture', () => {
  let manifest;
  let volume;

  before(async () => {
    volume = await loadBibleVolume({
      base: BASE,
      version: 'v1',
      fetchJson: async p => JSON.parse(readFileSync(p, 'utf-8'))
    });
    manifest = { Gutenberg_Bible: volume.toRoot() };
    Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
  });

  it('one testament, one book, one container — and thirty-one seats', () => {
    assert.equal(volume.testaments.length, 1);
    assert.equal(volume.units.length, 1);
    assert.equal(expandVolumeSeats(volume, 'DRA').length, 31);
  });

  it('THE BOOK RING HOLDS ONE SEAT and weaves without a neighbour', () => {
    // The weave inserts gaps BETWEEN members. With one member there is no
    // between, and a weave that assumed a next neighbour would either throw
    // or emit a trailing gap the reader could rotate into.
    const { items, selectedIndex } = buildBibleBookCousinChain(manifest, { names: {} });
    const real = items.filter(Boolean);
    assert.equal(real.length, 1);
    assert.equal(real[0].id, volume.units[0].id);
    assert.equal(items[selectedIndex]?.id, volume.units[0].id, 'the one seat is the selected one');
    assert.ok(!items.some(i => i === null), 'no gap can precede or follow a lone member');
  });

  it('THE CONTAINER RING HOLDS ONE SEAT, likewise', () => {
    const { items, selectedIndex } = buildBibleChapterChain(manifest, { edition: 'DRA' });
    const real = items.filter(Boolean);
    assert.equal(real.length, 1);
    assert.equal(items[selectedIndex]?.id, real[0].id);
    assert.ok(!items.some(i => i === null));
  });

  it('THE LEAF RING IS THE ONLY ONE THAT ROTATES — 31 seats, no gaps at all', () => {
    // Every gap in the ladder marks a crossing, and this volume has no
    // crossings to mark: one container, one book, one testament. A gap here
    // would be the weave inventing a boundary that does not exist.
    const { items } = buildBibleVerseChain(manifest, { edition: 'DRA' });
    assert.equal(items.filter(Boolean).length, 31);
    assert.ok(!items.some(i => i === null), 'no crossing exists, so no gap may appear');
  });

  it('the ring seats the FIRST leaf when asked for it, and the last', () => {
    const unitId = volume.units[0].id;
    const first = buildBibleVerseChain(manifest, { edition: 'DRA', initialVerseId: `${unitId}_1_1` });
    const last = buildBibleVerseChain(manifest, { edition: 'DRA', initialVerseId: `${unitId}_1_31` });
    assert.equal(first.items[first.selectedIndex].id, `${unitId}_1_1`);
    assert.equal(last.items[last.selectedIndex].id, `${unitId}_1_31`);
  });

  it('THE SKY SEATS A LONE CHILD without dividing by a count of one', () => {
    // The scatter spaces stars by their true radii and tapers by position;
    // with one child several of those are divisions or interpolations over a
    // set of size one. A NaN here would place the star nowhere.
    const vp = { width: 412, height: 915, SSd: 412, cx: 206, cy: 457 };
    const geo = computeChildPyramidGeometry(
      vp,
      { x: 206, y: 700, r: 40, angle: -1.2 },
      { hubX: -100, hubY: 900, radius: 700 },
      { parentId: volume.units[0].id, parentSortNumber: 0, childCount: 1,
        labelLengths: [2], sizeScales: [1], labelBaseFontPx: 14 }
    );
    assert.ok(geo, 'a sky of one must still be computable');
    for (const p of geo.intersections || []) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y),
        `a lone star landed at a non-finite point: ${JSON.stringify(p)}`);
    }
  });
});
