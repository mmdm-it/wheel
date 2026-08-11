// THE H-11 FIXTURE — its shape, and the two boundaries it must not cross.
//
// This is phase 1a's target: opaque Genesis 1 in the post-migration layout,
// beside a corpus that is still Vulgate-shaped. The cells below pin what the
// fixture IS, so that wiring the engine to it later cannot quietly redefine it.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePath } from '../src/core/identity.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'test/fixtures/h11/gutenberg';
const VERSION = 'v1';
const at = rel => path.join(root, BASE, VERSION, rel);
const read = rel => JSON.parse(readFileSync(at(rel), 'utf-8'));

const volume = read('volume.json');
const unitId = volume.books[0].id;

describe('the H-11 fixture — shape', () => {
  it('carries one book, opaque, with its leaf count', () => {
    assert.equal(volume.books.length, 1);
    assert.equal(volume.books[0].leaves, 31, 'Genesis 1 has 31 verses');
    assert.doesNotMatch(unitId, /GEN|genesis/i,
      'the filesystem must stop spelling out what a thing IS (H-11)');
  });

  it('the spine holds the order, and NOTHING else does', () => {
    const spine = read(`spine/${unitId}.json`);
    assert.equal(spine.utterances.length, 31);
    assert.equal(new Set(spine.utterances).size, 31, 'ids are unique');
  });

  it('ORDER IS NOT RECOVERABLE FROM THE IDS — this is what makes it a proof', () => {
    // If these sorted into spine order, an engine that still ordered by id
    // text would pass every test here and fail on the first real book. The
    // fixture is built adversarially on purpose.
    const spine = read(`spine/${unitId}.json`).utterances;
    const alphabetical = [...spine].sort();
    assert.notDeepEqual(alphabetical, spine,
      'alphabetical order must DISAGREE with spine order, or the fixture proves nothing');
  });

  it('NO chapter level exists anywhere — chapters are a render-time projection', () => {
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const files = walk(path.join(root, BASE, VERSION));
    assert.ok(files.length, 'fixture exists');
    for (const f of files) {
      assert.doesNotMatch(path.basename(path.dirname(f)), /^chapters?$/i,
        `${f} sits under a chapter directory, which H-11 abolished`);
    }
  });

  it('none of the retired identifiers survives', () => {
    const raw = JSON.stringify([volume, read(`spine/${unitId}.json`), read(`text/DRA/${unitId}.json`)]);
    for (const dead of ['chapter_id', 'book_key', 'sequence', '_external_file', 'chapter_in']) {
      assert.doesNotMatch(raw, new RegExp(dead), `${dead} retires under H-11`);
    }
  });
});

describe('the H-11 fixture — the grant boundary', () => {
  it('carries ONLY the granted editions', () => {
    // H-1 grants Genesis 1 in the Douay-Rheims and the Vulgate. The source
    // chapter also holds WLC, LXX, SYN and others; copying them here would
    // publish corpus text the grant does not cover.
    const editions = readdirSync(at('text')).sort();
    assert.deepEqual(editions, ['DRA', 'VUL']);
    assert.deepEqual(readdirSync(at('charts')).sort(), ['DRA', 'VUL']);
  });

  it('both granted editions carry all 31 verses', () => {
    for (const code of ['DRA', 'VUL']) {
      const text = read(`text/${code}/${unitId}.json`).text;
      assert.equal(Object.keys(text).length, 31, `${code} is complete`);
    }
  });

  it('Genesis 1 is an identity run in both — which is WHY it cannot show a merge', () => {
    // W-52's limit, pinned here so nobody later "improves" the fixture by
    // adding a merge example to it: there is no merge in Genesis 1 to show.
    for (const code of ['DRA', 'VUL']) {
      const seats = read(`charts/${code}/${unitId}.json`).seats;
      assert.equal(seats.length, 31);
      assert.ok(seats.every(s => s.utterances.length === 1),
        `${code}: every seat spans exactly one utterance`);
    }
  });
});

describe('the H-11 fixture — identity.js addresses it', () => {
  it('every path resolvePath builds actually exists', () => {
    // The module and the layout must agree, or one of them is describing a
    // world the other does not live in.
    const opts = { base: path.join(root, BASE), version: VERSION };
    const paths = [
      resolvePath({ ...opts, kind: 'volume' }),
      resolvePath({ ...opts, kind: 'spine', unitId }),
      resolvePath({ ...opts, kind: 'text', edition: 'DRA', unitId }),
      resolvePath({ ...opts, kind: 'text', edition: 'VUL', unitId }),
      resolvePath({ ...opts, kind: 'chart', edition: 'DRA', unitId }),
      resolvePath({ ...opts, kind: 'chartIndex', edition: 'VUL' })
    ];
    for (const p of paths) assert.ok(existsSync(p), `resolvePath built a path that does not exist: ${p}`);
  });
});
