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
import { loadBibleVolume, loadUnit } from '../src/adapters/bible-volume.js';

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
    const volume = await load();
    // Present, complete, granted — and invisible.
    assert.ok(existsSync(path.join(BASE, VERSION, 'text/VUL/bc22df.json')),
      'the fixture really does carry VUL on disk');
    await assert.rejects(
      () => loadUnit(volume, 'bc22df', 'VUL', { fetchJson }),
      /not an enumerated edition/,
      'reaching a file that exists but is unenumerated must be impossible, not merely discouraged');
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
  it('loads Genesis 1 whole: spine, chart, text, projected containers', async () => {
    const volume = await load();
    const unit = await loadUnit(volume, 'bc22df', 'DRA', { fetchJson });
    assert.equal(unit.seats.length, 31);
    assert.equal(unit.spine.utterances.length, 31);
    assert.equal(Object.keys(unit.text).length, 31);
    assert.match(unit.text['1'].text.DRA, /^In the beginning/);
  });

  it('CHAPTERS ARE PROJECTED FROM THE CHART, not stored (O-44)', async () => {
    const volume = await load();
    const unit = await loadUnit(volume, 'bc22df', 'DRA', { fetchJson });
    assert.equal(unit.containers.length, 1, 'Genesis 1 is one container');
    assert.equal(unit.containers[0].label, '1');
    assert.equal(unit.containers[0].count, 31);
  });

  for (const [what, hides] of [
    ['the spine', '/spine/'],
    ['the chart', '/charts/'],
    ['the text', '/text/']
  ]) {
    it(`SCREAMS when ${what} FAILS rather than rendering the rest`, async () => {
      const volume = await load();
      await assert.rejects(
        () => loadUnit(volume, 'bc22df', 'DRA', {
          fetchJson: async p => (p.includes(hides) ? Promise.reject(new Error('404')) : fetchJson(p))
        }),
        /INCOMPLETE/,
        'half a unit renders as success, which is the one outcome 79 increments cannot afford');
    });

    // A SECOND WAY TO BE ABSENT, and the tests above do not reach it.
    //
    // Found by deliberately breaking the check and watching NOTHING go red:
    // the cells above reject the promise, which lands in the catch, while a
    // fetch that RESOLVES to nothing takes a different branch entirely. That
    // is not hypothetical — an empty file, a server answering 200 with no
    // body, or a JSON `null` all arrive this way, and every one of them would
    // have produced a unit rendering from whatever else turned up.
    it(`SCREAMS when ${what} arrives EMPTY — resolved, not rejected`, async () => {
      const volume = await load();
      await assert.rejects(
        () => loadUnit(volume, 'bc22df', 'DRA', {
          fetchJson: async p => (p.includes(hides) ? null : fetchJson(p))
        }),
        /INCOMPLETE/,
        'a fetch that succeeds and returns nothing is still a missing artifact');
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
