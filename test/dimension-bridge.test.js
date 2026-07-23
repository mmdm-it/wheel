import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInteractionStore, interactionEvents } from '../src/core/interaction-store.js';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';
import { detailFor, createHandlers } from '../src/adapters/bible-adapter.js';
import { prefetchBibleVerses } from '../src/adapters/volume-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = async rel => JSON.parse(await readFile(path.resolve(__dirname, '..', rel), 'utf-8'));

// D.2 — the swap, headless (docs/DIMENSION_SYSTEM.md). The dimension bridge
// connects a chooser selection to the store; the render side regenerates on
// settle. No visuals exist yet: these tests ARE the chooser.

describe('dimension bridge — selection and defaults', () => {
  let translationsMeta;
  before(async () => { translationsMeta = await readJson('data/gutenberg/translations.json'); });

  const makeBridge = () => {
    const store = createInteractionStore();
    return { store, bridge: createDimensionBridge({ store, translationsMeta }) };
  };

  it('setLanguage adopts the language with its default translation', () => {
    const { bridge } = makeBridge();
    // Document order stands in for the prominence tier until translations
    // carry it: VUL before NEO, NAB before DRA.
    assert.equal(bridge.setLanguage('english'), true);
    assert.deepEqual(bridge.getSelection(), { language: 'english', translation: 'NAB' });
    assert.equal(bridge.setLanguage('latin'), true);
    assert.deepEqual(bridge.getSelection(), { language: 'latin', translation: 'VUL' });
  });

  it('setTranslation adopts the translation and implies its language', () => {
    // English is the registry's first two-edition language (NAB, DRA) —
    // the real pyramid case. (NEO is the French Crampon, a D.2 discovery
    // that corrected the canon's draft.)
    const { bridge } = makeBridge();
    assert.equal(bridge.setTranslation('DRA'), true);
    assert.deepEqual(bridge.getSelection(), { language: 'english', translation: 'DRA' });
  });

  it('unknown ids are refused without touching state', () => {
    const { bridge } = makeBridge();
    bridge.setLanguage('latin');
    assert.equal(bridge.setLanguage('klingon'), false);
    assert.equal(bridge.setTranslation('KJV'), false);
    assert.deepEqual(bridge.getSelection(), { language: 'latin', translation: 'VUL' });
  });

  it('the choice survives a volume change (gateway round trip)', () => {
    const { store, bridge } = makeBridge();
    bridge.setLanguage('english');
    store.dispatch({ type: interactionEvents.SET_VOLUME, volume: 'away' });
    store.dispatch({ type: interactionEvents.SET_VOLUME, volume: 'home' });
    assert.deepEqual(bridge.getSelection(), { language: 'english', translation: 'NAB' });
  });

  it('onSettle fires once per committed change, never on a repeat', () => {
    const { bridge } = makeBridge();
    const settled = [];
    bridge.onSettle(t => settled.push(t));
    bridge.setLanguage('english');
    bridge.setLanguage('english'); // same value — no settle
    bridge.setTranslation('NAB');  // still the same translation — no settle
    bridge.setTranslation('DRA');
    assert.deepEqual(settled, ['NAB', 'DRA']);
  });

  it('re-registering the settle hook replaces it (gateway reboots rehook)', () => {
    const { bridge } = makeBridge();
    const first = [];
    const second = [];
    bridge.onSettle(t => first.push(t));
    bridge.setLanguage('latin');
    bridge.onSettle(t => second.push(t));
    bridge.setLanguage('english');
    assert.deepEqual(first, ['VUL'], 'the replaced hook must not keep firing');
    assert.deepEqual(second, ['NAB']);
  });

  it('lists available languages from the registry', () => {
    const { bridge } = makeBridge();
    const langs = bridge.languagesAvailable();
    assert.ok(langs.includes('latin') && langs.includes('english'));
  });
});

describe('the headless swap — Latin ↔ English at a verse', () => {
  const originalFetch = globalThis.fetch;
  let manifest;

  before(async () => {
    manifest = await readJson('data/gutenberg/manifest.json');
    // The verse cache loads chapter files by fetch; serve them from disk.
    globalThis.fetch = async url => {
      const rel = String(url).replace(/^\.\//, '');
      try {
        const raw = readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');
        return { ok: true, json: async () => JSON.parse(raw) };
      } catch {
        return { ok: false, status: 404, json: async () => ({}) };
      }
    };
  });
  after(() => { globalThis.fetch = originalFetch; });

  it('a URL translation param can NOT override the dimension state', async () => {
    // Phase A retired ?translation= reading; a vestige in detailFor let a
    // stale bookmark pin the text to Latin against the store's choice —
    // exactly what the first live swap demo hit. The URL must be inert.
    const externalFile = 'data/gutenberg/chapters/GENE/001.json';
    const chapterItem = { id: 'GENE:1', level: 'chapter', meta: { externalFile, bookId: 'GENE' } };
    await new Promise(resolve => prefetchBibleVerses(chapterItem, { onLoaded: resolve }));
    const originalWindow = globalThis.window;
    globalThis.window = { location: { search: '?volume=bible&translation=VUL' } };
    try {
      const verse = { id: 'GENE_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
      const english = detailFor(verse, manifest, { translation: 'NAB' });
      assert.match(english.text, /beginning/i, 'the store wins; the URL is inert');
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('the same verse renders Latin or English by the translation in scope', async () => {
    const externalFile = 'data/gutenberg/chapters/GENE/001.json';
    const chapterItem = { id: 'GENE:1', level: 'chapter', meta: { externalFile, bookId: 'GENE' } };
    await new Promise(resolve => prefetchBibleVerses(chapterItem, { onLoaded: resolve }));

    const verse = { id: 'GENE_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
    const latin = detailFor(verse, manifest, { translation: 'VUL' });
    const english = detailFor(verse, manifest, { translation: 'NAB' });

    assert.match(latin.text, /principio/i, 'VUL renders the Latin');
    assert.match(english.text, /beginning/i, 'NAB renders the English');
    assert.notEqual(latin.text, english.text, 'the swap genuinely changes the content');
  });
});
