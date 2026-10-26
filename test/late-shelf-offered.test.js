// THE CHOOSER LEARNS EACH SHELF AS IT LANDS (O-223, Howell 2026-10-26).
//
// From the phone, the morning after the Synodal went up: the Russian in the
// lens of the edition ring, the Douay still in the detail sector. "Which
// editions hold where the reader is standing" (O-72) was asked once at boot —
// when only the first edition's charts were in hand (O-175: the others arrive
// behind it) — and asked again only on a change of position. A reader who
// booted at a verse and went straight to the globe was offered every later
// edition HOLLOW, and settling on one committed nothing.
//
// This file boots main.js for real, like the smoke test, against the h11
// fixture plus ONE MORE EDITION the fetch stub manufactures: a twin of the
// Douay under the code DRB whose charts arrive late. The boot sees the Douay
// alone; once the twin's shelf is stocked, the twin must be offered at the
// boot leaf — with no move since boot. Node runs each test file in its own
// process, so the globals here cannot leak into another suite.
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';

const TWIN = 'DRB';
const CHART_DELAY_MS = 250;

describe('an edition whose shelf lands after boot is offered where the reader stands (O-223)', () => {
  let hereAtBoot;
  let D;
  let volume;

  before(async () => {
    // No overture: it stands at the language ring (O-181), and this file
    // asks about a reader who stayed at the text.
    installBrowserGlobals('?volume=bible&proofread=true&overture=0');
    const fixtureFetch = globalThis.fetch;
    globalThis.fetch = async url => {
      const u = String(url);
      // The twin's files are the Douay's, re-labelled. Its charts arrive late.
      if (u.includes(`/${TWIN}/`) || u.includes(`/${TWIN}.`)) {
        const res = await fixtureFetch(u.split(`/${TWIN}/`).join('/DRA/').split(`/${TWIN}.`).join('/DRA.'));
        if (!res.ok) return res;
        const relabel = o => {
          if (o && typeof o === 'object') {
            if (o.edition === 'DRA') o.edition = TWIN;
            for (const v of Object.values(o)) relabel(v);
          }
          return o;
        };
        if (/\/charts\//.test(u)) await new Promise(r => setTimeout(r, CHART_DELAY_MS));
        const data = relabel(await res.json());
        return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
      }
      const res = await fixtureFetch(u);
      if (!res.ok || !/volume\.json$/.test(u)) return res;
      const vol = await res.json();
      const dra = vol.editions.find(e => e.code === 'DRA');
      vol.editions.push({ ...dra, code: TWIN, name: 'Douay-Rheims, the twin' });
      vol.display_config.editions.available.english.push(TWIN);
      vol.display_config.editions.labels[TWIN] = 'Douay twin';
      return { ok: true, status: 200, json: async () => vol, text: async () => JSON.stringify(vol) };
    };
    const realError = console.error;
    console.error = () => {};
    await import('../src/main.js');
    // The boot is done when the reader is at the text with a measured
    // position; a second edition makes it a little longer than the smoke
    // test's fixed wait (O-183: the twin's bundle leaves after the Douay's).
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      D = globalThis.window?.__wheelDimension;
      if (D && D.front() === 0 && Array.isArray(D.here())) break;
      await new Promise(r => setTimeout(r, 20));
    }
    console.error = realError;
    hereAtBoot = D?.here?.();
    const { volumeConfigs } = await import('../src/volume-configs.js');
    volume = (await volumeConfigs.bible.loadManifest()).__wallVolume;
  });

  it('the boot answers from the shelves it has: the Douay, not yet the twin', () => {
    assert.ok(D, 'the booted app exposed no dimension handle');
    assert.ok(Array.isArray(hereAtBoot), 'a leaf has a measured list');
    assert.ok(hereAtBoot.includes('DRA'));
    assert.ok(!hereAtBoot.includes(TWIN), `the twin's charts had not landed at boot; here = ${JSON.stringify(hereAtBoot)}`);
  });

  it('once the twin\'s shelf is stocked it is offered at the boot leaf — with no move since boot', async () => {
    assert.ok(volume.editions.some(e => e.code === TWIN), 'the stub declared the twin');
    await volume.allReady();
    await new Promise(r => setTimeout(r, 50));
    const here = D.here();
    assert.ok(here.includes(TWIN), `the twin holds the boot leaf and must be offered; here = ${JSON.stringify(here)}`);
    assert.equal(D.front(), 0, `and nothing moved: the reader is still at the text (front=${D.front()} min=${D.min?.()})`);
  });

  it('and settling on it commits — the detail sector follows, not just the lens', () => {
    assert.equal(D.set(TWIN), true, 'an edition that is here can be committed');
    assert.equal(D.get().translation, TWIN);
  });
});
