// THE EARLY LOADER (O-317): what src/early.js puts on the line before the
// app's own script has arrived, and what it must leave alone.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chooseFirstEdition } from '../src/core/first-edition.js';
import { WALL_ROOTS } from '../src/volume-roots.js';

// The Bible's data root as the engine declares it, so a new data version does not break these.
const R = `${WALL_ROOTS.bible.base}/${WALL_ROOTS.bible.version}`;

const volume = {
  editions: [{ code: 'HEB' }, { code: 'ITA' }, { code: 'ENG' }, { code: 'OFF', hasChart: false }],
  display_config: { languages: { default: 'english' }, editions: { default: { english: 'ENG', italian: 'ITA', hebrew: 'HEB' } } }
};

describe('which edition the boot waits for, asked once for the app and the early loader (O-175, O-317)', () => {
  it('the edition last read, before anything else', () => {
    assert.equal(chooseFirstEdition(volume, { remembered: 'HEB', named: 'ITA', languages: ['en-US'] }), 'HEB');
  });
  it('then the one the address names', () => {
    assert.equal(chooseFirstEdition(volume, { named: 'ITA', languages: ['en-US'] }), 'ITA');
  });
  it('then the phone\'s own tongue — an Italian phone waits for the Italian, not the volume\'s default', () => {
    assert.equal(chooseFirstEdition(volume, { languages: ['it-IT', 'en'] }), 'ITA');
  });
  it('then the volume\'s default, then the first thing offered', () => {
    assert.equal(chooseFirstEdition(volume, { languages: ['ja'] }), 'ENG');
    assert.equal(chooseFirstEdition({ editions: [{ code: 'OFF', hasChart: false }, { code: 'X' }] }, {}), 'X');
  });
  it('never an edition the volume does not offer', () => {
    assert.equal(chooseFirstEdition(volume, { remembered: 'OFF', named: 'GONE', languages: [] }), 'ENG');
  });
});

describe('the early loader, run against a page that is not there', () => {
  const run = async ({ search = '', hostname = 'localhost', pathname = '/', memory = null, booting = false } = {}) => {
    const asked = [];
    const files = {
      [`${R}/volume.json`]: { ...volume, display_config: { ...volume.display_config, boot: { first_visit: [{ utterance: 'u-first' }] } } },
      [`${R}/charts/ENG/all.json`]: { edition: 'ENG', charts: { bone: { seats: [{ utterances: ['u-a'] }] }, btwo: { seats: [{ utterances: ['u-first'] }] } } },
      [`${R}/charts/ITA/all.json`]: { edition: 'ITA', charts: { bita: { seats: [{ utterances: ['u-first'] }] } } }
    };
    const saved = { window: globalThis.window, fetch: globalThis.fetch, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
    globalThis.window = {
      location: { search, hostname, pathname },
      localStorage: { getItem: () => (memory ? JSON.stringify({ bible: memory }) : null), setItem() {} },
      ...(booting ? { __wheelBooting: true } : {})
    };
    Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en-US'] }, configurable: true });
    globalThis.fetch = async path => { asked.push(path); const body = files[path]; return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body }; };
    try {
      await import(`../src/early.js?case=${Math.random()}`);
      for (let i = 0; i < 10; i += 1) await new Promise(r => setTimeout(r, 2));
      return { asked, early: globalThis.window.__wheelEarly };
    } finally {
      globalThis.window = saved.window; globalThis.fetch = saved.fetch;
      if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator); else delete globalThis.navigator;
    }
  };
  it('a first visit: the manifest, the first edition\'s charts, then the book of the first visit\'s verse', async () => {
    const { asked, early } = await run({ search: '?volume=bible' });
    assert.deepEqual(asked, [
      `${R}/volume.json`,
      `${R}/charts/ENG/index.json`,
      `${R}/charts/ENG/all.json`,
      `${R}/text/ENG/btwo.json`
    ]);
    assert.equal(early.size, 4, 'each waits under its path for the app\'s loader');
  });
  it('a reader coming back: the edition and the book they were reading', async () => {
    const { asked } = await run({ search: '?volume=bible', memory: { edition: 'ITA', itemId: 'bita_3_4', placeLevel: 'verse' } });
    assert.ok(asked.includes(`${R}/charts/ITA/all.json`));
    assert.ok(asked.includes(`${R}/text/ITA/bita.json`));
  });
  it('no text where the app will open on a ring above the verses, or the address names a place', async () => {
    const left = await run({ search: '?volume=bible', memory: { edition: 'ENG', itemId: 'bone_1_1', placeLevel: 'chapter' } });
    assert.ok(!left.asked.some(p => p.includes('/text/')));
    const linked = await run({ search: '?volume=bible&book=bone' });
    assert.ok(!linked.asked.some(p => p.includes('/text/')));
  });
  it('nothing at all for a volume with no data root here, with no door at this address, or after the app has begun', async () => {
    assert.deepEqual((await run({ search: '?volume=calendar' })).asked, []);
    assert.deepEqual((await run({ search: '' })).asked, []);
    assert.deepEqual((await run({ search: '?volume=bible', booting: true })).asked, []);
  });
  it('the public door boots its volume with no word in the address', async () => {
    const { asked } = await run({ hostname: 'bibliacatholica.com', pathname: '/' });
    assert.equal(asked[0], `${R}/volume.json`);
  });
});
