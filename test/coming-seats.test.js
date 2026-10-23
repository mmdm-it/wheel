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
  it('a language with no declared shelf shows its seated editions alone; one with no seated edition shows its shelf hollow (O-208)', () => {
    const { bridge } = makeBridge();
    assert.deepEqual(bridge.translationsOf('latin'), ['LAT']);
    const { bridge: bare } = (() => {
      let state = { language: 'greek', edition: null };
      const store = { getState: () => state, dispatch: () => {}, subscribe: () => () => {} };
      return { bridge: createDimensionBridge({ store, translationsMeta: { translations: { GRC: { language: 'greek', proofread: false, hasChart: true } }, coming: { greek: ['Someday'] } } }) };
    })();
    // Until 2026-10-23 this read "the shelf dresses only a real ring" and
    // the answer was the sentinel. Howell, the hour the shelf became the
    // roadmap: "I did not expect to see any of the actual text, but I did
    // expect to see all of the editions."
    assert.deepEqual(bare.translationsOf('greek').map(k => (bare.isComing(k) ? `~${bare.translationName(k)}` : k)), ['~Someday']);
    // A shelf naming only real editions that are elsewhere still has
    // nothing to show.
    const { bridge: elsewhere } = (() => {
      let state = { language: 'greek', edition: null };
      const store = { getState: () => state, dispatch: () => {}, subscribe: () => () => {} };
      return { bridge: createDimensionBridge({ store, translationsMeta: { translations: { GRC: { language: 'greek', proofread: false, hasChart: true } }, coming: { greek: ['GRC'] } } }) };
    })();
    assert.deepEqual(elsewhere.translationsOf('greek'), [elsewhere.comingSoonKey]);
  });
});

// EVERY DECLARED TONGUE STANDS ON THE RING (O-208, Howell 2026-10-23): a
// language with a declared shelf and nothing to read here is on the language
// ring hollow — never absent — and settling on it leaves the reader where
// they were. A tongue with neither text nor shelf is still absent (the
// no-promises ruling of 2026-07-30 survives for it).
describe('every declared tongue stands on the ring, hollow (O-208)', () => {
  const TRANSLATIONS = {
    ENG: { language: 'english', proofread: true, hasChart: true, name: 'Douay' },
    HEB: { language: 'hebrew', proofread: true, hasChart: true, name: 'Leningrad' }
  };
  const COMING = { hebrew: ['HEB', 'Delitzsch'], english: ['King James', 'ENG'], french: ['Fillion', 'Jérusalem'], _note: 'ignored' };
  const LANGS = { languages: [
    { id: 'hebrew', autonym: 'עברית' }, { id: 'english', autonym: 'English' },
    { id: 'french', autonym: 'Français' }, { id: 'finnish', autonym: 'Suomi' }
  ] };
  function make() {
    let state = { language: 'english', edition: 'ENG' };
    const dispatched = [];
    const store = { getState: () => state, dispatch: a => { dispatched.push(a); }, subscribe: () => () => {} };
    return { bridge: createDimensionBridge({ store, translationsMeta: { translations: TRANSLATIONS, coming: COMING }, languagesMeta: LANGS }), dispatched };
  }
  it('the ring holds the readable tongues and the promised ones, in registry order; a tongue with neither is absent', () => {
    const { bridge } = make();
    assert.deepEqual(bridge.languagesAvailable(), ['hebrew', 'english', 'french'], 'finnish has neither text nor shelf');
    assert.equal(bridge.isComingLanguage('french'), true);
    assert.equal(bridge.isComingLanguage('english'), false);
    assert.equal(bridge.isComingLanguage('finnish'), false);
  });
  it('a hollow tongue shows its shelf hollow, and settling on it leaves the reader where they were', () => {
    const { bridge, dispatched } = make();
    assert.deepEqual(bridge.translationsOf('french').map(k => `~${bridge.translationName(k)}`), ['~Fillion', '~Jérusalem']);
    assert.equal(bridge.setLanguage('french'), true, 'display-only, like any placeholder tongue');
    assert.deepEqual(dispatched, [], 'nothing committed');
    assert.equal(bridge.getSelection().translation, 'ENG');
  });
  it('a readable tongue whose every edition is elsewhere turns hollow rather than vanishing', () => {
    const { bridge } = make();
    bridge.setEditionsHere(['ENG']);
    assert.deepEqual(bridge.languagesAvailable(), ['hebrew', 'english', 'french']);
    assert.equal(bridge.isComingLanguage('hebrew'), true, 'Hebrew in the New Testament: on the ring, hollow');
    assert.deepEqual(bridge.translationsOf('hebrew').map(k => (bridge.isComing(k) ? `~${bridge.translationName(k)}` : k)), ['~Delitzsch'],
      'the seated edition that is elsewhere is left out; the placeholder shows');
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
