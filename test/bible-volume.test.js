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
import { buildBibleVerseChain } from '../src/navigation/cousin-builder.js';
import { getBibleChapters } from '../src/adapters/volume-helpers.js';

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
    // THE ENUMERATION IS SHARDS AND EDITIONS (O-92). The volume no longer
    // says which books exist — a book is the edition's own word, declared in
    // its chart index, exactly as its divisions already were (H-29).
    assert.equal(volume.shards.length, 1, 'one shard');
    assert.equal(volume.booksFor('DRA').length, 1, 'one DRA book');
    assert.equal(volume.divisionsFor('DRA').length, 1, 'the edition declares one division');
    assert.deepEqual(volume.divisionsFor('DRA')[0].books, ['bdra9e1']);
    assert.equal(volume.shards[0].utterances, 31);
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
    await volume.loadTextFor('bdra9e1');
    assert.deepEqual(touched.filter(p => p.includes('/VUL/')), [],
      'no fetch may name VUL: unenumerated means unreachable, whatever is on disk');
  });

  it('a unit absent from the enumeration does not exist, whatever is on disk', async () => {
    const volume = await load();
    assert.equal(volume.has('bc22df'), true, 'the shard id exists');
    assert.equal(volume.has('bdra9e1'), true, 'the edition book id exists');
    assert.equal(volume.has('GENE'), false, 'the legacy id is not an address here');
    assert.throws(() => volume.pathFor('spine', 'GENE'), /does not exist \(H-14\)/);
  });

  it('carries NO section level — the reader cannot stand there', async () => {
    const volume = await load();
    assert.ok(!JSON.stringify(volume.booksFor('DRA')).includes('section'));
    assert.ok(!JSON.stringify(volume.divisionsFor('DRA')).includes('section'));
  });

  it('takes its order from the DATA, never from the ids', async () => {
    const volume = await load();
    // The fixture's ids are hashed so alphabetical order disagrees with spine
    // order. If anything here sorted by id text it would pass on one book and
    // fail on the first real testament.
    assert.equal(volume.shards[0].order, 0);
    assert.equal(volume.booksFor('DRA')[0].order, 0);
    // A BOOK CARRIES NO DIVISION (H-29): "which testament is Genesis in" is not
    // a question about Genesis. The parent is projected from the edition.
    assert.equal(volume.booksFor('DRA')[0].testamentId, undefined,
      'a stored parent is exactly what the ruling retired');
  });
});

describe('the wall reader — names are quotations (H-2)', () => {
  it('loads names per language, from the volume rather than the legacy registry', async () => {
    const volume = await load();
    const english = volume.namesByLanguage.english;
    assert.equal(english.books.DRA[volume.booksFor('DRA')[0].id], 'Genesis',
      'names carry the edition axis (W-129)');
    // The names table no longer carries a division name — the label is the
    // edition's own, quoted from its chart (H-29/H-2), not translated per
    // language out of our vocabulary.
    assert.equal(volume.divisionsFor('DRA')[0].label, 'Holy Bible');
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
    assert.equal(volume.shards.length, 1, 'the volume still loads');
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
    const chart = volume.chartFor('bdra9e1', 'DRA');
    const records = await volume.loadTextFor('bdra9e1');
    assert.equal(spine.utterances.length, 31);
    assert.equal(chart.seats.length, 31);
    assert.equal(Object.keys(records).length, 31);
    assert.match(records['1'].text.DRA, /^In the beginning/);
  });

  it('CHAPTERS ARE PROJECTED FROM THE CHART, not stored (O-44)', async () => {
    const volume = await load();
    const containers = projectContainers(volume.chartFor('bdra9e1', 'DRA'),
      { leaves: volume.chartFor('bdra9e1', 'DRA').seats.length });
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
      assert.equal(await volume.loadTextFor('bdra9e1'), null,
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
        fetchJson: async p => (p.endsWith('volume.json') ? { books: [], editions: [] } : fetchJson(p))
      }),
      /sole enumeration/);
  });

  it('REFUSES a volume that enumerates no books — empty is a data state, not a render', async () => {
    await assert.rejects(
      () => loadBibleVolume({
        base: BASE,
        version: VERSION,
        fetchJson: async p => (p.endsWith('volume.json')
          ? { books: [], editions: [{ code: 'DRA', language: 'english' }] }
          : fetchJson(p))
      }),
      /enumerates no shards/);
  });
});

// THE INTERNAL ROOT — the adapter contract's `normalize`, and the cells that
// matter are what it REFUSES to bring back.
describe('the wall reader — toRoot() normalises without rebuilding the legacy shape', () => {
  it('carries the ruled hierarchy: testament to book', async () => {
    const volume = await load();
    const root = volume.toRoot();
    const [testamentId] = Object.keys(root.testaments);
    assert.equal(testamentId, 'division-0', 'the key is positional and edition-local');
    const draBook = volume.booksFor('DRA')[0].id;
    assert.ok(root.testaments[testamentId].books[draBook]);
    assert.equal(root.testaments[testamentId].books[draBook].leaves, 31);
    assert.equal(root.testaments[testamentId].name, 'Holy Bible', 'the edition names it');
    assert.equal(root.testaments[testamentId].image, 'torah_scroll', 'and declares its emblem (H-31)');
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
    const t = volume.toRoot().testaments['division-0'];
    assert.equal(t.sort_number, 0);
    assert.equal(t.books[volume.booksFor('DRA')[0].id].sort_number, 0);
  });
});

describe('the wall reader — ONE BOOK, ONE EDITION, and O-42 survives per book (O-65 rewritten under O-92)', () => {
  // The O-65 morning — a partial edition's 404 nulling a book the full
  // edition held — CANNOT RECUR under leaf-and-shard, and these cells are
  // its rewritten twin (W-102): a book belongs to exactly one edition, so
  // the loader never fetches across editions for one book and there is no
  // Promise.all left to poison. What survives of O-42 is per book: a
  // declared book whose text fails still nulls, loudly and honestly.
  const VOLUME = {
    display_config: {},
    shards: [{ id: 's1', utterances: 2 }, { id: 's2', utterances: 2 }],
    editions: [
      { code: 'FULL', language: 'hebrew', hasChart: true, proofread: true },
      { code: 'PART', language: 'greek', hasChart: true, proofread: false }
    ]
  };
  const chart = (bookId, shards, seats) => ({
    book: bookId, shards, edition: 'x',
    groups: [{ label: '1', from: 1, to: seats.length }],
    seats: seats.map(l => ({ label: l, utterances: [`u-${bookId}-${l}`] }))
  });
  const text = (edition, bookId) => ({
    edition, book: bookId,
    text: { '1:1': `${edition} ${bookId} one`, '1:2': `${edition} ${bookId} two` }
  });
  // FULL declares two books; PART declares one, over the same first shard —
  // the partial-edition shape, restated in the edition's own words.
  const makeFetch = (over = {}) => async p => {
    if (over.intercept) { const hit = over.intercept(p); if (hit !== undefined) return hit; }
    if (p.endsWith('volume.json')) return VOLUME;
    if (p.includes('/names/')) throw new Error(`404 ${p}`);
    if (p.includes('/spine/s1')) return { shard: 's1', utterances: ['u-f1-1', 'u-f1-2'] };
    if (p.includes('/spine/s2')) return { shard: 's2', utterances: ['u-f2-1', 'u-f2-2'] };
    if (p.includes('charts/FULL/index.json')) return { edition: 'FULL', books: [{ file: 'f1', shards: ['s1'] }, { file: 'f2', shards: ['s2'] }], groups: [], divisions: [] };
    if (p.includes('charts/PART/index.json')) return { edition: 'PART', books: [{ file: 'p1', shards: ['s1'] }], groups: [], divisions: [] };
    if (p.includes('charts/FULL/f1.json')) return chart('f1', ['s1'], ['1', '2']);
    if (p.includes('charts/FULL/f2.json')) return chart('f2', ['s2'], ['1:2', '1:1']);
    if (p.includes('charts/PART/p1.json')) return chart('p1', ['s1'], ['1', '2']);
    if (p.includes('text/FULL/f1.json')) return text('FULL', 'f1');
    if (p.includes('text/FULL/f2.json')) return text('FULL', 'f2');
    if (p.includes('text/PART/p1.json')) return text('PART', 'p1');
    throw new Error(`404 ${p}`);
  };
  const loadPartial = (over = {}) => loadBibleVolume({ base: 'b', version: 'v', fetchJson: makeFetch(over) });

  it('a book only the full edition declares loads whole — nothing else is asked', async () => {
    const volume = await loadPartial();
    const records = await volume.loadTextFor('f2');
    assert.ok(records, 'the full edition\'s own book must load');
    const flat = JSON.stringify(records);
    assert.ok(flat.includes('FULL f2'), 'its own edition\'s words');
    assert.ok(!flat.includes('PART'), 'and no other edition is consulted at all (O-92)');
  });

  it('two editions over one shard are two books, each carrying only its own text', async () => {
    const volume = await loadPartial();
    const full = await volume.loadTextFor('f1');
    const part = await volume.loadTextFor('p1');
    assert.ok(JSON.stringify(full).includes('FULL f1') && !JSON.stringify(full).includes('PART'));
    assert.ok(JSON.stringify(part).includes('PART p1') && !JSON.stringify(part).includes('FULL'));
  });

  it('O-42 SURVIVES PER BOOK: a declared book whose text fails nulls honestly', async () => {
    const volume = await loadPartial({
      intercept: p => (p.includes('text/PART/p1.json') ? (() => { throw new Error('boom'); })() : undefined)
    });
    assert.equal(await volume.loadTextFor('p1'), null,
      'a fault is an honest empty (W-6), never another edition\'s words');
    assert.ok(await volume.loadTextFor('f1'), 'and the other edition\'s book is untouched by it');
  });

  it('the verse order actually reaches the records — the chart key must HIT (O-65 second defect, kept fixed)', async () => {
    const volume = await loadPartial();
    const records = await volume.loadTextFor('f2');
    assert.ok(records, 'f2 must load at all before its order can be judged');
    assert.ok(records['1:1'] && records['1:2'], 'both addresses present');
    assert.ok(records['1:2'].seq < records['1:1'].seq,
      'the chart seats 1:2 first, so its seq must be lower — the order never arriving is the silent miss');
  });
});

// THE SPINE IS A SUPERSET AND THE ORDER IS THE EDITION'S (W-96, ruled by
// Howell 2026-08-18; engine half O-69).
//
// The spine holds every leaf ANY edition attests, in no edition's order. Three
// places in the engine read a seat's position out of the spine, and every one
// of them was right only while the spine was a single tradition's order:
//
//   1. containers were filled by SPINE ordinal, so a reordering edition's own
//      chapters fell outside every container it declared and vanished;
//   2. the coverage check counted the SPINE's leaves, so any edition holding
//      fewer than the superset threw and failed the boot;
//   3. `unitOrdinal` carried the SPINE ordinal, so the read-ahead measured the
//      reader's distance from the end of a tradition they are not reading.
//
// This fixture is the smallest one that can tell the two coordinate systems
// apart: a spine of six leaves, an edition seating four of them IN A DIFFERENT
// ORDER — its seats sit at spine positions 5, 6, 1, 2. Under the old rule the
// chain lost half the edition; under the new one it reads 1,2,3,4.
describe('a SUPERSET spine, and an edition that reorders it (W-96 / O-69)', () => {
  const SUPERSET = ['u-a', 'u-b', 'u-c', 'u-d', 'u-e', 'u-f'];
  const SEATS = [
    { label: '1', utterances: ['u-e'] },   // spine position 5
    { label: '2', utterances: ['u-f'] },   // 6
    { label: '3', utterances: ['u-a'] },   // 1
    { label: '4', utterances: ['u-b'] }    // 2
  ];
  const CHART = { groups: [{ label: 'I', from: 1, to: 2 }, { label: 'II', from: 3, to: 4 }], seats: SEATS };
  const book = { id: 'U1', leaves: 6, order: 0, testamentId: 'T1' };
  const volume = {
    units: [book],
    bookOrderFor: () => ['U1'],
    divisionsFor: () => [{ label: 'First', image: null, from: 1, to: 1, books: ['U1'] }],
    units: [book],
    editions: [{ code: 'ED', language: 'english', hasChart: true, proofread: true }],
    namesByLanguage: { english: { books: { U1: 'Unit' } } },
    displayConfig: {},
    spineFor: () => ({ utterances: SUPERSET }),
    chartFor: (id, ed) => (ed === 'ED' ? CHART : null),
    textFor: () => null,
    has: id => id === 'U1',
    isFullyConfirmed: () => true,
    bookOrderFor: () => ['U1'],
    sectionOf: () => null,
    toRoot: () => ({ display_config: {}, testaments: { 'division-0': { sort_number: 0, name: 'First', books: { U1: { sort_number: 0 } } } } })
  };
  const manifest = { Gutenberg_Bible: volume.toRoot() };
  Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });

  const seats = () => (buildBibleVerseChain(manifest, { edition: 'ED' }).items || []).filter(Boolean);

  it('EVERY SEAT SURVIVES — the old rule dropped the ones the spine ordered late', () => {
    const got = seats().map(s => s.name);
    assert.deepEqual(got, ['1', '2', '3', '4'],
      'all four of the edition\'s seats must appear, in the edition\'s own order');
  });

  it('containers hold what the EDITION says, not what the spine implies', () => {
    const byContainer = {};
    for (const s of seats()) {
      const key = s.meta.chapterLabel;
      (byContainer[key] ||= []).push(s.name);
    }
    assert.deepEqual(byContainer, { I: ['1', '2'], II: ['3', '4'] },
      'container I holds the edition\'s first two seats — by spine position it took its last two');
  });

  it('unitOrdinal counts the EDITION\'s seats, so the read-ahead measures the right distance', () => {
    const got = seats().map(s => s.meta.unitOrdinal);
    assert.deepEqual(got, [1, 2, 3, 4],
      'spine positions here are 5,6,1,2 — carrying those would misfire the read-ahead');
  });

  it('THE COVERAGE CHECK COUNTS THIS EDITION, not the superset it sits in', () => {
    // Four seats, four leaves covered, six in the spine. Counting the spine
    // threw "containers cover 4 leaves but the unit has 6" and failed the boot.
    assert.equal(seats().length, 4);
    assert.equal(getBibleChapters(manifest, { id: 'U1' }, null, 'book', 'ED').length, 2,
      'both containers project; counting the spine would have thrown instead');
  });
});

// THE DIVISION'S COLOUR TRAVELS WITH ITS EMBLEM (O-79).
//
// Howell asked for the circle under the corner art — the one that becomes the
// detail sector's background — to change as the reader crosses between a
// volume's divisions. The colour is declared in the cargo beside the image,
// for the reason that file already gives about the image: it is ours to
// choose and the source cannot tell us, and a colour that means New Testament
// asserts something about THIS corpus exactly as a crown of thorns does
// (W-114).
//
// THIS IS THE SEAM, and it is the one the adapter's cells cannot see: they
// hand in their own `divisionsFor`, so they would go on passing while this
// function silently dropped the field. `divisionsFor` builds an explicit
// shape and discards everything it does not name — which is the right
// behaviour and exactly why a new field has to be added here on purpose.
describe('the division carries its colour (O-79)', () => {
  // The fixture's chart index declares no colour, so one is injected on the
  // way past — the same JSON the browser would receive, with the field the
  // cargo will carry.
  const loadWithColour = colour => loadBibleVolume({
    base: BASE,
    version: VERSION,
    fetchJson: async p => {
      const body = JSON.parse(readFileSync(p, 'utf-8'));
      if (String(p).includes('/charts/DRA/index.json') && Array.isArray(body.divisions)) {
        body.divisions = body.divisions.map(d => ({ ...d, color: colour }));
      }
      return body;
    }
  });

  it('carries a declared colour through to the reader', async () => {
    const volume = await loadWithColour('#362e6a');
    assert.equal(volume.divisionsFor('DRA')[0].color, '#362e6a',
      'dropped between the cargo and the badge — the field must be named here');
  });

  it('and answers null where none is declared, which is the fixture as it stands', async () => {
    const volume = await load();
    assert.equal(volume.divisionsFor('DRA')[0].color, null,
      'null, not undefined: the absence is answered rather than left blank');
  });
});
