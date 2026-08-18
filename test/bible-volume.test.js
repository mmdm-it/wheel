// THE WALL'S READER (H-14) — on the real fixture, through the real module.
//
// The cells that earn their keep are the REFUSALS and the ABSENCES. A reader
// that loads Genesis proves very little; a reader that cannot reach the
// Vulgate sitting complete on disk beside it proves the enumeration is sole.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bibleVolumeModule from '../src/adapters/bible-volume.js';
import { projectContainers } from '../src/core/unit-source.js';

const { loadBibleVolume } = bibleVolumeModule;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(repoRoot, 'test/fixtures/h11/gutenberg');
const VERSION = 'v1';

// Reads off disk exactly as the browser reads over HTTP. A path that does not
// exist must fail, never resolve to something plausible.
const fetchJson = async p => {
  const body = readFileSync(p, 'utf-8');
  return JSON.parse(body);
};
const load = () => loadBibleVolume({ base: BASE, version: VERSION, fetchJson });

describe('the wall reader — volume.json is the sole enumeration', () => {
  it('boots from volume.json and enumerates one book', async () => {
    const volume = await load();
    assert.equal(volume.units.length, 1);
    assert.equal(volume.testaments.length, 1);
    assert.equal(volume.testaments[0].books.length, 1);
    assert.equal(volume.units[0].leaves, 31);
  });

  it('offers Douay-Rheims and nothing else (O-46b)', async () => {
    const volume = await load();
    assert.deepEqual(volume.editions.map(e => e.code), ['DRA']);
  });

  it('THE VULGATE IS ON DISK AND UNREACHABLE — the enumeration is sole, not first', async () => {
    // Present, complete, granted — and invisible. `loadUnit`, which once took
    // an edition by name and could be asked for VUL, is DELETED (O-65): the
    // per-edition door does not exist, so the only text path is the volume's
    // own loader — and it must never touch an unenumerated edition's files.
    assert.ok(existsSync(path.join(BASE, VERSION, 'text/VUL/bc22df.json')),
      'the fixture really does carry VUL on disk');
    assert.equal(bibleVolumeModule.loadUnit, undefined,
      'loadUnit is deleted — it preserved the O-65 defect behind an export with no callers');
    const touched = [];
    const volume = await loadBibleVolume({
      base: BASE, version: VERSION,
      fetchJson: async p => { touched.push(p); return fetchJson(p); }
    });
    await volume.loadTextFor('bc22df');
    assert.deepEqual(touched.filter(p => p.includes('/VUL/')), [],
      'no fetch may name VUL: unenumerated means unreachable, whatever is on disk');
  });

  it('a unit absent from the enumeration does not exist, whatever is on disk', async () => {
    const volume = await load();
    assert.equal(volume.has('bc22df'), true);
    assert.equal(volume.has('GENE'), false, 'the legacy id is not an address here');
    assert.throws(() => volume.pathFor('spine', 'GENE'), /does not exist \(H-14\)/);
  });

  it('carries NO section level — the reader cannot stand there', async () => {
    const volume = await load();
    assert.equal(volume.testaments[0].sections, undefined);
    assert.ok(!JSON.stringify(volume.testaments).includes('section'));
  });

  it('takes its order from the DATA, never from the ids', async () => {
    const volume = await load();
    // The fixture's ids are hashed so alphabetical order disagrees with spine
    // order. If anything here sorted by id text it would pass on one book and
    // fail on the first real testament.
    assert.equal(volume.testaments[0].order, 0);
    assert.equal(volume.units[0].order, 0);
    assert.equal(volume.units[0].testamentId, volume.testaments[0].id);
  });
});

describe('the wall reader — names are quotations (H-2)', () => {
  it('loads names per language, from the volume rather than the legacy registry', async () => {
    const volume = await load();
    const english = volume.namesByLanguage.english;
    assert.equal(english.books[volume.units[0].id], 'Genesis');
    assert.equal(english.testaments[volume.testaments[0].id], 'Old Testament');
  });

  it('a language with no names file is unnamed, not fatal', async () => {
    // Missing names must never take the volume down: the reader meets an
    // unnamed thing, which is honest, rather than a blank app.
    const volume = await loadBibleVolume({
      base: BASE,
      version: VERSION,
      fetchJson: async p => (p.includes('/names/') ? Promise.reject(new Error('404')) : fetchJson(p))
    });
    assert.equal(volume.namesByLanguage.english, null);
    assert.equal(volume.units.length, 1, 'the volume still loads');
  });
});

describe('the wall reader — a unit resolves all-or-nothing, loudly', () => {
  // These cells ran through `loadUnit` until O-65 deleted it: it fetched text
  // for EVERY declared edition and threw INCOMPLETE on any miss — the O-65
  // defect preserved verbatim behind an export nothing in src/ called. The
  // doctrine it guarded survives; the door does not. The live path is the
  // volume's own pieces — `spineFor`/`chartFor` (eager, absence is a data
  // state) and `loadTextFor` (all-or-nothing among charted editions, where a
  // failure is the HONEST NULL rather than a throw: the unit renders blank,
  // never partially).
  it('loads Genesis 1 whole through the live path: spine, chart, text agree', async () => {
    const volume = await load();
    const spine = volume.spineFor('bc22df');
    const chart = volume.chartFor('bc22df', 'DRA');
    const records = await volume.loadTextFor('bc22df');
    assert.equal(spine.utterances.length, 31);
    assert.equal(chart.seats.length, 31);
    assert.equal(Object.keys(records).length, 31);
    assert.match(records['1'].text.DRA, /^In the beginning/);
  });

  it('CHAPTERS ARE PROJECTED FROM THE CHART, not stored (O-44)', async () => {
    const volume = await load();
    const containers = projectContainers(volume.chartFor('bc22df', 'DRA'),
      { leaves: volume.spineFor('bc22df').utterances.length });
    assert.equal(containers.length, 1, 'Genesis 1 is one container');
    assert.equal(containers[0].label, '1');
    assert.equal(containers[0].count, 31);
  });

  // A SECOND WAY TO BE ABSENT rides with the first in each pair below: a
  // fetch that REJECTS lands in a catch, while one that RESOLVES to nothing
  // takes a different branch entirely — an empty file, a 200 with no body, a
  // JSON `null`. Both must produce the honest null, never a partial unit.
  for (const [how, breakFetch] of [
    ['FAILS', p => Promise.reject(new Error(`404 ${p}`))],
    ['arrives EMPTY — resolved, not rejected', () => Promise.resolve(null)]
  ]) {
    it(`the unit is the HONEST NULL when a charted edition's text ${how}`, async () => {
      const volume = await loadBibleVolume({
        base: BASE, version: VERSION,
        fetchJson: async p => (p.includes('/text/') ? breakFetch(p) : fetchJson(p))
      });
      assert.equal(await volume.loadTextFor('bc22df'), null,
        'half a unit renders as success, which is the one outcome 79 increments cannot afford');
    });
  }
});

describe('the wall reader — it refuses what it cannot do', () => {
  it('REFUSES to run without a transport', async () => {
    await assert.rejects(() => loadBibleVolume({ base: BASE, version: VERSION }), /needs a `fetchJson/);
  });

  it('REFUSES a volume that enumerates no editions rather than reaching for the registry', async () => {
    await assert.rejects(
      () => loadBibleVolume({
        base: BASE,
        version: VERSION,
        fetchJson: async p => (p.endsWith('volume.json') ? { testaments: [], editions: [] } : fetchJson(p))
      }),
      /sole enumeration/);
  });

  it('REFUSES a volume that enumerates no books — empty is a data state, not a render', async () => {
    await assert.rejects(
      () => loadBibleVolume({
        base: BASE,
        version: VERSION,
        fetchJson: async p => (p.endsWith('volume.json')
          ? { testaments: [], editions: [{ code: 'DRA', language: 'english' }] }
          : fetchJson(p))
      }),
      /enumerates no books/);
  });
});

// THE INTERNAL ROOT — the adapter contract's `normalize`, and the cells that
// matter are what it REFUSES to bring back.
describe('the wall reader — toRoot() normalises without rebuilding the legacy shape', () => {
  it('carries the ruled hierarchy: testament to book', async () => {
    const volume = await load();
    const root = volume.toRoot();
    const testamentId = volume.testaments[0].id;
    assert.ok(root.testaments[testamentId]);
    assert.ok(root.testaments[testamentId].books[volume.units[0].id]);
    assert.equal(root.testaments[testamentId].books[volume.units[0].id].leaves, 31);
  });

  it('BRINGS BACK NOTHING H-14 RETIRED — this is the cell that keeps it honest', async () => {
    const volume = await load();
    const serialized = JSON.stringify(volume.toRoot());
    for (const dead of ['sections', 'chapters', '_external_file', 'book_key', 'sequence', 'chapter_id']) {
      assert.ok(!serialized.includes(dead),
        `${dead} is back in the internal root — that is the legacy shape in its last costume`);
    }
  });

  it('carries the presentation config the engine needs, narrowed to what is offered', async () => {
    const volume = await load();
    const dc = volume.toRoot().display_config;
    assert.deepEqual(Object.keys(dc.hierarchy_levels), ['testament', 'book', 'chapter', 'verse']);
    assert.equal(dc.editions.registry, undefined,
      'the registry pointer is the legacy file itself — the wall removes it');
    assert.deepEqual(dc.languages.available, ['english']);
  });

  it('order is DATA in the root, not the object key order', async () => {
    const volume = await load();
    const t = volume.toRoot().testaments[volume.testaments[0].id];
    assert.equal(t.sort_number, 0);
    assert.equal(t.books[volume.units[0].id].sort_number, 0);
  });
});

describe('the wall reader — A PARTIAL EDITION MUST NOT POISON THE FULL ONE (O-65)', () => {
  // The morning after the first partial edition entered the corpus, the
  // reader showed Genesis's chapter ring and no text. The loader fetched a
  // unit's text for EVERY declared edition in one Promise.all, so a book the
  // partial edition lacks 404'd, the catch nulled the whole unit, and the
  // Hebrew went down with the Greek it never had. These cells are the
  // synthetic twin of that morning: edition FULL charts both units, edition
  // PART charts only u1.
  const VOLUME = {
    display_config: {},
    testaments: [{ id: 't1', books: [{ id: 'u1', leaves: 2 }, { id: 'u2', leaves: 2 }] }],
    editions: [
      { code: 'FULL', language: 'hebrew', hasChart: true, proofread: true },
      { code: 'PART', language: 'greek', hasChart: true, proofread: false }
    ]
  };
  const chart = unitId => ({ edition: 'x', unit: unitId, seats: [{ label: '1' }, { label: '2' }] });
  const text = (edition, unitId) => ({
    edition, unit: unitId,
    text: { '1:1': `${edition} ${unitId} one`, '1:2': `${edition} ${unitId} two` }
  });
  // PART has no chart and no text for u2 — absence declared by the data, the
  // BRENT shape. Every other path answers.
  const partialFetch = async p => {
    if (p.endsWith('volume.json')) return VOLUME;
    if (p.includes('/names/')) throw new Error(`404 ${p}`);
    if (p.includes('/spine/')) throw new Error(`404 ${p}`);
    if (p.includes('charts/FULL/index.json')) throw new Error(`404 ${p}`);
    if (p.includes('charts/PART/index.json')) throw new Error(`404 ${p}`);
    if (p.includes('charts/FULL/u1.json')) return chart('u1');
    if (p.includes('charts/FULL/u2.json')) return chart('u2');
    if (p.includes('charts/PART/u1.json')) return chart('u1');
    if (p.includes('text/FULL/u1.json')) return text('FULL', 'u1');
    if (p.includes('text/FULL/u2.json')) return text('FULL', 'u2');
    if (p.includes('text/PART/u1.json')) return text('PART', 'u1');
    throw new Error(`404 ${p}`);
  };
  const loadPartial = () => loadBibleVolume({ base: 'b', version: 'v', fetchJson: partialFetch });

  it('a book the partial edition lacks still carries the full edition\'s text', async () => {
    const volume = await loadPartial();
    const records = await volume.loadTextFor('u2');
    assert.ok(records, 'u2 came back null — the partial edition nulled a book it never contained');
    const flat = JSON.stringify(records);
    assert.ok(flat.includes('FULL u2 one'), 'the full edition\'s words must be there');
    assert.ok(!flat.includes('PART u2'), 'and no text was invented for the edition that lacks it');
  });

  it('a book both editions contain carries both', async () => {
    const volume = await loadPartial();
    const records = await volume.loadTextFor('u1');
    assert.ok(records, 'the shared book must load');
    const flat = JSON.stringify(records);
    assert.ok(flat.includes('FULL u1 one') && flat.includes('PART u1 one'),
      'both editions chart u1, so both must arrive together (O-42, on the right axis)');
  });

  it('O-42 SURVIVES ON ITS OWN AXIS: a charted edition whose text fails still nulls the unit', async () => {
    // PART charts u1 but its text does not arrive — that is a FAULT, not a
    // membership fact, and rendering FULL alone would silently drop a
    // tradition the reader was never told was absent.
    const faultyFetch = async p => {
      if (p.includes('text/PART/u1.json')) throw new Error('503 mid-deploy');
      return partialFetch(p);
    };
    const volume = await loadBibleVolume({ base: 'b', version: 'v', fetchJson: faultyFetch });
    const records = await volume.loadTextFor('u1');
    assert.equal(records, null,
      'a charted edition failing to arrive must null the unit — arrival faults stay loud');
  });

  it('the verse order actually reaches the records — the chart key must HIT (O-65 second defect)', async () => {
    // The order lookup built its key with a space while the cache keys on a
    // pipe, so it missed every time and nobody noticed: order fell back
    // silently for every book in every edition. The chart below seats the
    // addresses in REVERSE, so if the chart's order reaches the records,
    // 1:2 seats BEFORE 1:1 — and if the lookup misses, insertion order wins
    // and this fails.
    const reversedFetch = async p => {
      if (p.includes('charts/FULL/u2.json')) {
        return { edition: 'x', unit: 'u2', seats: [{ label: '1:2' }, { label: '1:1' }] };
      }
      return partialFetch(p);
    };
    const volume = await loadBibleVolume({ base: 'b', version: 'v', fetchJson: reversedFetch });
    const records = await volume.loadTextFor('u2');
    assert.ok(records, 'u2 must load at all before its order can be judged');
    assert.ok(records['1:1'] && records['1:2'], 'both addresses present');
    assert.ok(records['1:2'].seq < records['1:1'].seq,
      'the chart seats 1:2 first, so its seq must be lower — the order never arriving is the silent miss');
  });
});
