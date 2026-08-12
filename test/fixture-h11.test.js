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
import { normalizeUnitText } from '../src/core/unit-text.js';
import { seedVerseCache, getVerseTextResolved } from '../src/adapters/volume-helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'test/fixtures/h11/gutenberg';
const VERSION = 'v1';
const at = rel => path.join(root, BASE, VERSION, rel);
const read = rel => JSON.parse(readFileSync(at(rel), 'utf-8'));

const volume = read('volume.json');
const testament = volume.testaments[0];
const unitId = testament.books[0].id;

describe('the H-11 fixture — shape', () => {
  it('carries one book, opaque, with its leaf count', () => {
    assert.equal(testament.books.length, 1);
    assert.equal(testament.books[0].leaves, 31, 'Genesis 1 has 31 verses');
    assert.doesNotMatch(unitId, /GEN|genesis/i,
      'the filesystem must stop spelling out what a thing IS (H-11)');
  });

  it('CARRIES THE TESTAMENT — the reader keeps its levels (Howell, 2026-08-12)', () => {
    // The wall must not quietly flatten the reader's world. With one book the
    // testament has one child, which is degenerate and correct, and it is the
    // shape 79 books will hang from.
    assert.equal(volume.testaments.length, 1);
    assert.equal(testament.books.length, 1);
    assert.doesNotMatch(testament.id, /Testamentum/i,
      'the testament id goes opaque like every other id (H-11 item 2)');
  });

  it('CARRIES NO SECTION LEVEL — the reader cannot stand there', () => {
    // Howell, 2026-08-12, correcting me: the reader's levels are testament,
    // book, chapter, verse. This fixture briefly carried a section because I
    // read the level list off the corpus's `hierarchy_levels`, which STILL
    // declares `section` with a display name and focus-ring properties as
    // though it were navigable. It is not, and the engine is the truth:
    // ascending from a book goes straight to its testament, and no ring is
    // ever built at section level.
    //
    // Emitting one would have put a dead level into the sole enumeration on
    // the strength of a stale declaration — a derived-view failure with a
    // straight face, and precisely the kind this month keeps producing.
    assert.equal(testament.sections, undefined,
      'a section here is a level the reader can never reach');
    assert.ok(!JSON.stringify(volume).includes('section'),
      'nothing in the sole enumeration may mention a retired level');
    assert.equal(read('names/english.json').sections, undefined,
      'and nothing names one');
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

// THE WALL (H-14). `volume.json` is the SOLE enumeration — not the first
// source consulted, the only one. These cells are what make that word mean
// something, and the Vulgate is the instrument: it is present on disk, fully
// formed, and must be unreachable.
describe('the H-11 fixture — volume.json is the sole enumeration', () => {
  it('offers Douay-Rheims and NOTHING else (Howell, 2026-08-12)', () => {
    assert.deepEqual(volume.editions.map(e => e.code), ['DRA']);
  });

  it('THE VULGATE IS ON DISK AND NOT ENUMERATED — present, and invisible', () => {
    // If a reader can ever reach VUL, it consulted something other than
    // volume.json, and "sole" was never true. An enumeration is only sole if
    // something genuinely present is provably out of reach.
    assert.ok(existsSync(at(`text/VUL/${unitId}.json`)), 'the file is really there');
    assert.ok(!volume.editions.some(e => e.code === 'VUL'), 'and the volume does not offer it');
  });

  it('carries servability itself — the legacy registry is behind the wall', () => {
    // Under H-14 the engine cannot read translations.json, so proofread state
    // has to live here. `false` is the corpus's own value for DRA, and it is
    // what makes the ruled behaviour true: dark without ?proofread=true.
    const dra = volume.editions.find(e => e.code === 'DRA');
    assert.equal(dra.proofread, false, 'DRA is not proofread in the corpus; the fixture must not claim it is');
    assert.equal(dra.language, 'english');
  });

  it('names are QUOTATIONS, carried per language, never manufactured (H-2)', () => {
    const names = read('names/english.json');
    assert.equal(names.books[unitId], 'Genesis');
    assert.equal(names.testaments[testament.id], 'Old Testament');
    // Every enumerated id has a name, or the reader meets a raw opaque id.
    for (const id of [unitId, testament.id]) {
      const found = names.books[id] || names.testaments[id];
      assert.ok(found, `${id} is enumerated with no name in any category`);
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

// CONTAINERS ARE THE CHART'S, PER EDITION (O-44, ruled 2026-08-11).
describe('the H-11 fixture — containers come from the chart', () => {
  it('every edition declares its own groups over BOOK-ORDINAL ranges', () => {
    for (const code of ['DRA', 'VUL']) {
      const chart = read(`charts/${code}/${unitId}.json`);
      assert.ok(Array.isArray(chart.groups) && chart.groups.length,
        `${code} declares no groups — under O-44 it has no containers to render`);
      for (const g of chart.groups) {
        assert.equal(typeof g.label, 'string', 'a container label is a quotation (H-2)');
        assert.ok(Number.isInteger(g.from) && Number.isInteger(g.to),
          'the range is a BOOK-ORDINAL range (H-11 item 3), not a spine chapter plus an offset');
      }
    }
  });

  it('the groups cover every leaf exactly once', () => {
    for (const code of ['DRA', 'VUL']) {
      const { groups } = read(`charts/${code}/${unitId}.json`);
      const covered = groups.flatMap(g => Array.from({ length: g.to - g.from + 1 }, (_, i) => g.from + i));
      assert.deepEqual(covered, Array.from({ length: 31 }, (_, i) => i + 1),
        `${code}: a gap or an overlap would leave a leaf unrenderable or rendered twice`);
    }
  });

  it('THE SPINE DECLARES NO CONTAINERS — a default grouping would be the hub in its last costume', () => {
    const spine = read(`spine/${unitId}.json`);
    for (const forbidden of ['groups', 'chapters', 'containers']) {
      assert.equal(spine[forbidden], undefined,
        `the spine carries ${forbidden}; O-44 rules containers are the chart's alone`);
    }
  });
});

// THE CROSSING (O-45). Every test above this line checks one contract against
// itself, and every one of them passed while the two layouts could not meet.
// The gap was BETWEEN contracts: the descriptor resolved correct paths and the
// reader at the end of them could not read what was there, so the unit would
// have enumerated perfectly and rendered nothing.
//
// So this describe block is deliberately different in kind. It runs the REAL
// fixture through the REAL adapter into the REAL downstream reader, and asks
// the only question that matters: does a verse come back.
describe('the H-11 fixture — it reaches the reader (the crossing)', () => {
  const DECLARED = ['DRA', 'VUL'];
  const chart = read(`charts/VUL/${unitId}.json`);
  const order = chart.seats.map(s => String(s.label));
  const editions = Object.fromEntries(DECLARED.map(c => [c, read(`text/${c}/${unitId}.json`)]));

  it('the per-edition files become one record per address', () => {
    const records = normalizeUnitText({ editions, declared: DECLARED, order });
    assert.equal(Object.keys(records).length, 31);
    assert.deepEqual(Object.keys(records[order[0]].text).sort(), ['DRA', 'VUL'],
      'both granted traditions meet at the same address');
  });

  it('THE DOWNSTREAM READER ANSWERS, UNMODIFIED — this is the cell O-45 was missing', () => {
    const records = normalizeUnitText({ editions, declared: DECLARED, order });
    const key = `${BASE}/${VERSION}/${unitId}`;
    seedVerseCache(key, records);

    // getVerseTextResolved has no idea the H-11 layout exists, and must not.
    const latin = getVerseTextResolved(key, '1', ['VUL']);
    assert.equal(latin.translation, 'VUL');
    assert.match(latin.text, /^In principio/, 'the Vulgate opens Genesis 1 this way');

    const english = getVerseTextResolved(key, '1', ['DRA']);
    assert.equal(english.translation, 'DRA');
    assert.match(english.text, /^In the beginning/);
  });

  it('every one of the 31 addresses resolves in both editions — no silent hole', () => {
    const records = normalizeUnitText({ editions, declared: DECLARED, order });
    const key = `${BASE}/${VERSION}/${unitId}-full`;
    seedVerseCache(key, records);
    for (const address of order) {
      for (const code of DECLARED) {
        const got = getVerseTextResolved(key, address, [code]);
        assert.ok(got?.text?.length, `${code} ${address} came back empty through the crossing`);
        assert.equal(got.translation, code, `${code} ${address} was answered by another tradition`);
      }
    }
  });

  it('WITHOUT the adapter the reader gets nothing — the defect O-45 recorded', () => {
    // This cell is the load-bearing one. It seats the H-11 file RAW, exactly
    // as the splice would have done had the fourth move not been noticed, and
    // pins the failure: the descriptor resolves, the walk enumerates, the
    // reader comes back empty. A blank page with every check upstream green.
    //
    // If someone later "simplifies" the adapter away, this goes red first.
    const key = `${BASE}/${VERSION}/${unitId}-raw`;
    seedVerseCache(key, read(`text/VUL/${unitId}.json`).text);
    assert.equal(getVerseTextResolved(key, '1', ['VUL']), null,
      'the raw H-11 file is a string per address; the reader wants a record per address');
  });

  it('the preference chain still returns the HONEST empty past its end (W-6)', () => {
    // The three silent fallbacks died for this. An edition the unit does not
    // carry must yield nothing, never another tradition's words wearing the
    // reader's language.
    const records = normalizeUnitText({ editions, declared: DECLARED, order });
    const key = `${BASE}/${VERSION}/${unitId}-honest`;
    seedVerseCache(key, records);
    assert.equal(getVerseTextResolved(key, '1', ['WLC']), null,
      'an ungranted edition must come back empty, not filled from a neighbour');
  });
});
