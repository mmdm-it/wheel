// PLACEHOLDER SEATS ON THE EDITION RING (O-184, Howell 2026-09-30). The
// volume declares a language's shelf in order — placeholder names between the
// seated editions' codes — and the ring shows it: seated editions in place,
// placeholders hollow and inert, never committed, the snap passing them for
// the nearest real seat. These cells drive the bridge alone; the host's snap
// rule is exercised by the boot suites through the real ring.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';

const TRANSLATIONS = {
  ENG: { language: 'english', proofread: true, hasChart: true, name: 'Douay', nativeName: 'Douay-Rheims' },
  LAT: { language: 'latin', proofread: true, hasChart: true, name: 'Vulgata' },
  OLD: { language: 'english', proofread: false, hasChart: true, name: 'Not yet servable' }
};
const COMING = {
  english: ['King James', 'Westminster', 'ENG', 'OLD', 'Revised Standard'],
  latin: []
};
function makeBridge() {
  let state = { language: 'english', edition: 'ENG' };
  const store = {
    getState: () => state,
    dispatch: action => { if (action.type === 'SET_LANGUAGE') state = { language: action.language, edition: action.defaultEdition }; },
    subscribe: () => () => {}
  };
  return { store, bridge: createDimensionBridge({ store, translationsMeta: { translations: TRANSLATIONS, coming: COMING } }) };
}

describe('placeholder seats on the edition ring (O-184)', () => {
  it('the declared shelf, in its order: the seated edition by its code, placeholders by their names', () => {
    const { bridge } = makeBridge();
    const ring = bridge.translationsOf('english');
    assert.deepEqual(ring.map(k => (bridge.isComing(k) ? `~${bridge.translationAbbrev(k)}` : k)),
      ['~King James', '~Westminster', 'ENG', '~Revised Standard'],
      'placeholders wear their names; an unservable real edition on the shelf is simply absent');
  });
  it('a placeholder is labelled with its name, magnified or not', () => {
    const { bridge } = makeBridge();
    const kj = bridge.translationsOf('english')[0];
    assert.ok(bridge.isComing(kj));
    assert.equal(bridge.translationName(kj), 'King James');
    assert.equal(bridge.translationAbbrev(kj), 'King James');
  });
  it('a placeholder is never committed', () => {
    const { bridge, store } = makeBridge();
    const kj = bridge.translationsOf('english')[0];
    assert.equal(bridge.setTranslation(kj), false);
    assert.equal(store.getState().edition, 'ENG', 'the reader keeps reading the Douay');
    assert.equal(bridge.setTranslation('ENG'), true, 'the real seat commits as ever');
  });
  it('a language with no declared shelf shows its seated editions alone; one with no seated edition keeps its sentinel', () => {
    const { bridge } = makeBridge();
    assert.deepEqual(bridge.translationsOf('latin'), ['LAT']);
    const { bridge: bare } = (() => {
      let state = { language: 'greek', edition: null };
      const store = { getState: () => state, dispatch: () => {}, subscribe: () => () => {} };
      return { bridge: createDimensionBridge({ store, translationsMeta: { translations: { GRC: { language: 'greek', proofread: false, hasChart: true } }, coming: { greek: ['Someday'] } } }) };
    })();
    const ring = bare.translationsOf('greek');
    assert.equal(ring.length, 1);
    assert.equal(ring[0], bare.comingSoonKey, 'the shelf dresses only a real ring');
  });
  it('a seated edition the shelf forgot is appended, never lost', () => {
    let state = { language: 'english', edition: 'ENG' };
    const store = { getState: () => state, dispatch: () => {}, subscribe: () => () => {} };
    const bridge = createDimensionBridge({ store, translationsMeta: { translations: TRANSLATIONS, coming: { english: ['King James'] } } });
    assert.deepEqual(bridge.translationsOf('english').map(k => (bridge.isComing(k) ? '~' : k)), ['~', 'ENG']);
  });
  it('THE DECLARED SHELF REACHES THE BRIDGE through the volume config (the field is the loader\'s, not the file\'s)', async () => {
    // The first build read `volume.display_config` where the loader exposes
    // `displayConfig`, and every cell above passed because they hand the
    // shelf straight to the bridge. This one walks the real path: the
    // fixture volume's supplemental meta, as the boot builds it. LAST in the
    // file: installing the browser globals lifts the proofread gate for
    // every cell after it, which changes what is servable.
    const { installBrowserGlobals } = await import('./helpers/browser-globals.mjs');
    installBrowserGlobals('?volume=bible&proofread=true');
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const manifest = await volumeConfigs.bible.loadManifest();
    const root = volumeConfigs.bible.extractRoot(manifest);
    const { translationsMeta } = await volumeConfigs.bible.loadSupplemental(root, manifest);
    const declared = manifest.__wallVolume.displayConfig?.editions?.coming || {};
    const shelves = Object.keys(declared).filter(k => !k.startsWith('_'));
    if (!shelves.length) return;   // a fixture declaring no shelf has nothing to carry
    for (const lang of shelves) assert.deepEqual(translationsMeta.coming[lang], declared[lang], `${lang}: the shelf as declared`);
  });
});
