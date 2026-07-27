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
  before(async () => { translationsMeta = await readJson('test/fixtures/data/gutenberg/translations.json'); });

  const makeBridge = () => {
    const store = createInteractionStore();
    return { store, bridge: createDimensionBridge({ store, translationsMeta }) };
  };

  it('setLanguage adopts the language with its default translation', () => {
    const { bridge } = makeBridge();
    // Document order stands in for the prominence tier until translations
    // carry it: the fixture registry is public-domain-only (VUL for latin,
    // DRA for english), so english's default edition is DRA.
    assert.equal(bridge.setLanguage('english'), true);
    assert.deepEqual(bridge.getSelection(), { language: 'english', translation: 'DRA' });
    assert.equal(bridge.setLanguage('latin'), true);
    assert.deepEqual(bridge.getSelection(), { language: 'latin', translation: 'VUL' });
  });

  it('setLanguage defaults to the first SERVABLE edition, skipping pending/coming-soon (Howell 2026-07-26)', () => {
    // The bug: english lists NAB (pendingLicense) before DRA, so the default
    // landed on a translation we cannot show. The default must skip
    // pendingLicense (held for licensing) and comingSoon (unsourced) editions.
    const store = createInteractionStore();
    const meta = { translations: {
      NABX: { language: 'english', name: 'Pending', pendingLicense: true },
      SOONX: { language: 'english', name: 'Unsourced', comingSoon: true },
      DRA: { language: 'english', name: 'Douay-Rheims' }
    } };
    const bridge = createDimensionBridge({ store, translationsMeta: meta });
    assert.equal(bridge.setLanguage('english'), true);
    assert.equal(bridge.getSelection().translation, 'DRA',
      'lands on the servable edition, not the pending or coming-soon ones');
  });

  it('setLanguage falls back to the first listed when NO edition is servable yet', () => {
    // A language with editions but all pendingLicense (a W-11 pending state):
    // no servable default exists, so keep the first listed rather than break.
    const store = createInteractionStore();
    const meta = { translations: {
      A: { language: 'italian', name: 'Held A', pendingLicense: true },
      B: { language: 'italian', name: 'Held B', pendingLicense: true }
    } };
    const bridge = createDimensionBridge({ store, translationsMeta: meta });
    assert.equal(bridge.setLanguage('italian'), true);
    assert.equal(bridge.getSelection().translation, 'A');
  });

  it('translationAbbrev shows the native-script abbreviation when present (Howell 2026-07-26)', () => {
    // The unselected Greek option must read as Greek (Οʹ), not the Latin key
    // (LXX) — mirroring the magnified node's Greek nativeName. Falls back to
    // the key until the registry carries nativeAbbrev (O-6).
    const withNative = createDimensionBridge({ store: createInteractionStore(), translationsMeta: {
      translations: { LXX: { language: 'greek', name: 'Septuagint', nativeName: 'Οἱ Ἑβδομήκοντα', nativeAbbrev: 'Οʹ' } }
    } });
    assert.equal(withNative.translationAbbrev('LXX'), 'Οʹ', 'Greek abbreviation, not the Latin key');
    const withoutNative = createDimensionBridge({ store: createInteractionStore(), translationsMeta: {
      translations: { BYZ: { language: 'greek', name: 'Byzantine' } }
    } });
    assert.equal(withoutNative.translationAbbrev('BYZ'), 'BYZ', 'falls back to the key, no regression');
  });

  it('setTranslation adopts the translation and implies its language', () => {
    // DRA is the fixture's public-domain english edition; setting it adopts
    // english as its implied language.
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
    assert.deepEqual(bridge.getSelection(), { language: 'english', translation: 'DRA' });
  });

  it('onSettle fires once per committed change, never on a repeat', () => {
    const { bridge } = makeBridge();
    const settled = [];
    bridge.onSettle(t => settled.push(t));
    bridge.setLanguage('english');
    bridge.setLanguage('english'); // same value — no settle
    bridge.setTranslation('DRA');  // still the same translation — no settle
    bridge.setLanguage('latin');   // a real change — one settle
    assert.deepEqual(settled, ['DRA', 'VUL']);
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
    assert.deepEqual(second, ['DRA']);
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
    manifest = await readJson('test/fixtures/data/gutenberg/manifest.json');
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
    const externalFile = 'test/fixtures/data/gutenberg/chapters/GENE/001.json';
    const chapterItem = { id: 'GENE:1', level: 'chapter', meta: { externalFile, bookId: 'GENE' } };
    await new Promise(resolve => prefetchBibleVerses(chapterItem, { onLoaded: resolve }));
    const originalWindow = globalThis.window;
    globalThis.window = { location: { search: '?volume=bible&translation=VUL' } };
    try {
      const verse = { id: 'GENE_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
      const english = detailFor(verse, manifest, { translation: 'DRA' });
      assert.match(english.text, /beginning/i, 'the store wins; the URL is inert');
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('the same verse renders Latin or English by the translation in scope', async () => {
    const externalFile = 'test/fixtures/data/gutenberg/chapters/GENE/001.json';
    const chapterItem = { id: 'GENE:1', level: 'chapter', meta: { externalFile, bookId: 'GENE' } };
    await new Promise(resolve => prefetchBibleVerses(chapterItem, { onLoaded: resolve }));

    const verse = { id: 'GENE_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
    const latin = detailFor(verse, manifest, { translation: 'VUL' });
    const english = detailFor(verse, manifest, { translation: 'DRA' });

    assert.match(latin.text, /principio/i, 'VUL renders the Latin');
    assert.match(english.text, /beginning/i, 'DRA renders the English');
    assert.notEqual(latin.text, english.text, 'the swap genuinely changes the content');
  });
});
