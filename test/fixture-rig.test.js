// THE RIG, END TO END (O-45, phase 1a) — the four moves in one run.
//
// Every other test in this repository checks a piece. This one runs the whole
// chain on the REAL fixture files: route → fetch per edition → convert →
// supply → declare → the walk's own resolver → the unchanged verse loader →
// the unchanged text reader. It exists because O-45 was a gap BETWEEN correct
// pieces, and the only thing that catches those is a test that crosses.
//
// The assertion that matters is not "text comes back". It is that the items
// come back wearing the LEGACY shape — because phase 1a's acceptance test is
// an EMPTY reader-level diff, and an id that differs by one character is a
// different chain, a failed lookup and a reader seated in Genesis 1:1.
import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBibleFixtureRig } from '../src/adapters/bible-fixture-rig.js';
import { legacyTextFile, clearTextSubstitution } from '../src/core/unit-source.js';
import {
  prefetchBibleVerses, getBibleVerseItems, getVerseTextResolved, getBibleVerseCacheStatus
} from '../src/adapters/volume-helpers.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = 'data/gutenberg/chapters/GENE/001.json';

// The fixture is served over HTTP in the browser; here the same paths are read
// off disk. Anything the rig asks for that does not exist must 404 rather than
// resolve to something plausible.
const realFetch = globalThis.fetch;
let requested = [];
const install = () => {
  globalThis.fetch = async url => {
    requested.push(url);
    const onDisk = path.join(repoRoot, String(url).replace(/^\.\//, ''));
    try {
      const body = readFileSync(onDisk, 'utf-8');
      return { ok: true, status: 200, json: async () => JSON.parse(body) };
    } catch {
      return { ok: false, status: 404, json: async () => null };
    }
  };
};

describe('the fixture rig — the four moves, on the real files', () => {
  let rig;

  before(async () => {
    install();
    requested = [];
    rig = await installBibleFixtureRig({
      search: '?volume=bible&proofread=true&fixture=h11',
      location: { hostname: '192.168.88.167', protocol: 'http:' }
    });
  });

  after(() => {
    globalThis.fetch = realFetch;
    clearTextSubstitution();
  });

  it('installs, and reports what it rigged rather than merely succeeding', () => {
    assert.ok(rig, 'the rig did not install — the route or the LAN gate refused');
    assert.equal(rig.unitId, 'bc22df');
    assert.equal(rig.addresses, 31);
    assert.deepEqual([...rig.editions].sort(), ['DRA', 'VUL']);
  });

  it('fetched EVERY declared edition eagerly — the policy, observed not assumed', () => {
    const texts = requested.filter(u => u.includes('/text/'));
    assert.equal(texts.length, 2, 'both granted editions load at boot, not on rotation');
    assert.ok(requested.some(u => u.includes('/charts/VUL/bc22df.json')),
      'the chart is fetched at boot — the walk that needs it is synchronous');
  });

  it('MOVE 3 — the walk now resolves the legacy address to the migrated unit', () => {
    assert.equal(legacyTextFile({ _external_file: LEGACY }), rig.cacheKey);
  });

  it('and still resolves every other unit to itself', () => {
    for (const other of ['data/gutenberg/chapters/GENE/002.json',
      'data/gutenberg/chapters/PSAL/117.json',
      'data/gutenberg/chapters/APOC/022.json']) {
      assert.equal(legacyTextFile({ _external_file: other }), other);
    }
  });
});

describe('the fixture rig — the reader cannot tell (the empty diff)', () => {
  let rig;
  // The chapter item exactly as the legacy walk builds it for Genesis 1, with
  // the ONE difference the splice makes: its text address is the substituted
  // one. Everything below is asked to produce legacy output from it.
  let chapterItem;

  before(async () => {
    install();
    rig = await installBibleFixtureRig({
      search: '?fixture=h11',
      location: { hostname: '192.168.88.167', protocol: 'http:' }
    });
    chapterItem = {
      id: 'GENE:1',
      level: 'chapter',
      meta: { bookId: 'GENE', externalFile: legacyTextFile({ _external_file: LEGACY }) }
    };
    await new Promise(resolve => prefetchBibleVerses(chapterItem, { onLoaded: resolve }));
  });

  after(() => {
    globalThis.fetch = realFetch;
    clearTextSubstitution();
  });

  it('the loader reports loaded WITHOUT ever fetching the substituted key', () => {
    assert.equal(getBibleVerseCacheStatus(chapterItem.meta.externalFile), 'loaded');
    assert.ok(!requested.includes(chapterItem.meta.externalFile),
      'a migrated unit arrives already resolved; fetching it would be a second load path');
  });

  it('THE VERSE IDS ARE THE LEGACY ONES — an empty reader-level diff', () => {
    // If these came out as `bc22df_…` the reader would navigate into a chain
    // nothing else knows about, every lookup would miss, and -1 would seat
    // them at Genesis 1:1 — the exact defect E3 was written for.
    const items = getBibleVerseItems(chapterItem);
    assert.equal(items.length, 31);
    assert.equal(items[0].id, 'GENE_1_1');
    assert.equal(items[30].id, 'GENE_1_31');
    assert.deepEqual(items.map(i => i.name).slice(0, 3), ['1', '2', '3']);
    assert.equal(items[0].parentId, 'GENE:1', 'the parent is the real chapter item, not a rig id');
    assert.equal(items[0].meta.chapterId, 'GENE:1');
    assert.equal(items[0].level, 'verse');
  });

  it('the items are ordered, densely, from 0', () => {
    const items = getBibleVerseItems(chapterItem);
    assert.deepEqual(items.map(i => i.order), Array.from({ length: 31 }, (_, i) => i));
  });

  it('THE TEXT ARRIVES, in both granted editions, through the unchanged reader', () => {
    const key = chapterItem.meta.externalFile;
    assert.match(getVerseTextResolved(key, '1', ['VUL']).text, /^In principio/);
    assert.match(getVerseTextResolved(key, '1', ['DRA']).text, /^In the beginning/);
    assert.match(getVerseTextResolved(key, '31', ['DRA']).text, /very good/i);
  });

  it('an edition the fixture does not carry returns the HONEST empty (W-6)', () => {
    // Not the legacy unit's Greek wearing the reader's language — nothing.
    assert.equal(getVerseTextResolved(chapterItem.meta.externalFile, '1', ['WLC']), null);
  });
});

describe('the fixture rig — it is inert unless asked, on the network it was ruled for', () => {
  before(() => { install(); });
  after(() => {
    globalThis.fetch = realFetch;
    clearTextSubstitution();
  });

  it('does nothing OFF-LAN even when explicitly asked', async () => {
    const off = await installBibleFixtureRig({
      search: '?fixture=h11', location: { hostname: 'bibliacatholica.com', protocol: 'https:' }
    });
    assert.equal(off, null, 'the gate fails closed — scaffolding must never reach a public host');
  });

  it('does nothing on the LAN when NOT asked', async () => {
    const unasked = await installBibleFixtureRig({
      search: '?volume=bible&proofread=true', location: { hostname: '192.168.88.167', protocol: 'http:' }
    });
    assert.equal(unasked, null);
  });

  it('and having refused, leaves the walk completely untouched', () => {
    assert.equal(legacyTextFile({ _external_file: LEGACY }), LEGACY,
      'a refused rig that still substituted would be the worst of both');
  });

  it('READS THE WINDOW WHEN CALLED WITH NOTHING — which is how boot calls it', async () => {
    // Every cell above hands the rig its search and location explicitly, so
    // none of them exercises the call the application actually makes. That
    // gap — a boundary tested only in the shape the test chose — is precisely
    // what O-45 was, so it is closed rather than reasoned about.
    const priorWindow = globalThis.window;
    globalThis.window = {
      location: { hostname: '192.168.88.167', protocol: 'http:', search: '?fixture=h11' }
    };
    try {
      const booted = await installBibleFixtureRig();
      assert.ok(booted, 'the zero-argument call must find the URL on the window');
      assert.equal(booted.unitId, 'bc22df');
    } finally {
      if (priorWindow === undefined) delete globalThis.window;
      else globalThis.window = priorWindow;
      clearTextSubstitution();
    }
  });
});
