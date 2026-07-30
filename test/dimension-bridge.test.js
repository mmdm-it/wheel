import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInteractionStore, interactionEvents } from '../src/core/interaction-store.js';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';
import { detailFor, createHandlers } from '../src/adapters/bible-adapter.js';
import { volumeConfigs } from '../src/volume-configs.js';
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

  it('an all-pending language is DISPLAY-ONLY: the reader keeps its edition (W-11)', () => {
    // Howell ruled 2026-07-27 (superseding the earlier first-listed
    // fallback): a language whose every edition is held for licensing must
    // not commit anything — the deploy filter has stripped those texts, so
    // committing one pointed the reader at a blank page wearing a real
    // edition's name. The shelf shows; the reader keeps reading.
    const store = createInteractionStore();
    const meta = { translations: {
      VUL: { language: 'latin', name: 'Vulgate' },
      A: { language: 'italian', name: 'Held A', pendingLicense: true },
      B: { language: 'italian', name: 'Held B', pendingLicense: true }
    } };
    const bridge = createDimensionBridge({ store, translationsMeta: meta });
    assert.equal(bridge.setTranslation('VUL'), true, 'the reader starts on Latin');
    assert.equal(bridge.setLanguage('italian'), true, 'the pending language is browsable');
    assert.deepEqual(bridge.getSelection(), { language: 'italian', translation: 'VUL' },
      'display follows the shelf; the reader keeps the Vulgate');
  });

  it('the shelf shows ONLY what opens; an empty shelf says coming soon (W-4 + W-11, final ruling)', () => {
    // Howell 2026-07-27, superseding the seated-but-unselectable draft: a
    // pendingLicense notice "doesn't concern the user — too inside baseball."
    // Held and unsourced editions alike have no seat; a language with
    // nothing servable shows its native "coming soon" placeholder.
    const store = createInteractionStore();
    const meta = { translations: {
      VUL: { language: 'latin', name: 'Vulgate' },
      SOON: { language: 'latin', name: 'Unsourced', comingSoon: true },
      CEIX: { language: 'italian', name: 'Held', nativeName: 'La Sacra Bibbia CEI', pendingLicense: true }
    } };
    const langMeta = { languages: [
      { id: 'latin', autonym: 'Latina' },
      { id: 'italian', autonym: 'Italiano', comingSoonText: 'in arrivo' }
    ] };
    const bridge = createDimensionBridge({ store, translationsMeta: meta, languagesMeta: langMeta });
    bridge.setTranslation('VUL');
    assert.deepEqual(bridge.translationsOf('latin'), ['VUL'], 'the unsourced edition is not seated');
    assert.deepEqual(bridge.translationsOf('italian'), ['__coming_soon__'],
      'an all-held language shows the placeholder, not the held edition');
    bridge.setLanguage('italian');
    assert.equal(bridge.translationName('__coming_soon__'), 'in arrivo',
      'the placeholder speaks the language\'s own tongue');
    assert.equal(bridge.setTranslation('CEIX'), false, 'a held edition never commits');
    assert.equal(bridge.getSelection().translation, 'VUL', 'the reader is untouched');
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

  it('an edition declares how its script runs (W-1)', () => {
    // The registry says WLC is rtl; the engine must READ that, never guess
    // from the language. The CSS's RTL rules keyed on [lang="he"] existed
    // since the D-era with nothing to trigger them — this is the hookup.
    const bridge = createDimensionBridge({ store: createInteractionStore(), translationsMeta: {
      translations: {
        WLC: { language: 'hebrew', name: 'Leningrad Codex', direction: 'rtl' },
        VUL: { language: 'latin', name: 'Vulgate' },
        CUSTOM: { language: 'greek', name: 'Override', lang: 'grc' }
      }
    } });
    assert.equal(bridge.editionDirection('WLC'), 'rtl', 'the registry\'s declaration wins');
    assert.equal(bridge.editionLang('WLC'), 'he', 'and the script tag the CSS keys on');
    assert.equal(bridge.editionDirection('VUL'), 'ltr');
    assert.equal(bridge.editionLang('VUL'), 'la');
    assert.equal(bridge.editionLang('CUSTOM'), 'grc', 'a per-edition lang overrides the language map');
    assert.equal(bridge.editionDirection('NOSUCH'), 'ltr', 'an unknown edition reads left-to-right');
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

  it('a missing edition falls to the Vulgate — FLAGGED, never passed off (W-6)', async () => {
    const externalFile = 'test/fixtures/data/gutenberg/chapters/GENE/001.json';
    const chapterItem = { id: 'GENE:1', level: 'chapter', meta: { externalFile, bookId: 'GENE' } };
    await new Promise(resolve => prefetchBibleVerses(chapterItem, { onLoaded: resolve }));

    const verse = { id: 'GENE_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
    // The fixture chapter carries VUL and DRA only — SYN is absent, as NAB
    // is from every deployed chapter since the PD filter.
    const substituted = detailFor(verse, manifest, { translation: 'SYN' });
    assert.match(substituted.text, /principio/i, 'the Latin stands in');
    assert.deepEqual(substituted.substituted, { edition: 'VUL' },
      'and the payload SAYS so — the render wears the mark');
    // The honest match wears no flag.
    const honest = detailFor(verse, manifest, { translation: 'DRA' });
    assert.equal(honest.substituted, undefined, 'a served edition is no substitute');
  });

  it('a live language switch outruns the chain\'s baked text (the stale-Latin bug, 2026-07-28)', async () => {
    // The boot verse ring bakes each verse's text at CHAIN-BUILD time. The
    // bug: a later language switch repainted that build-time Latin —
    // unflagged — because the baked items carried no cache coordinates and
    // detailFor trusted selected.text regardless of language. Now the items
    // carry meta and the bake is honored only in its own language.
    const { buildBibleVerseCousinChain } = await import('../src/navigation/cousin-builder.js');
    const manifest2 = JSON.parse(readFileSync(
      path.resolve(__dirname, '../test/fixtures/data/gutenberg/manifest.json'), 'utf-8'));
    // The fixture ships only GENE/001; the builder walks the whole book, so
    // serve chapter 001 for every GENE chapter — the regression needs only
    // the first verse's bake.
    const realFetch = globalThis.fetch;
    globalThis.fetch = async url => realFetch(
      /chapters\/GENE\//.test(String(url)) ? './test/fixtures/data/gutenberg/chapters/GENE/001.json' : url);
    let items;
    try {
      ({ items } = await buildBibleVerseCousinChain(manifest2, { bookId: 'GENE', translation: 'VUL' }));
    } finally {
      globalThis.fetch = realFetch;
    }
    const bootVerse = items.find(v => v && v.id === 'GENE_1_1');
    assert.match(bootVerse.text, /principio/i, 'the chain baked Latin at build time');
    assert.ok(bootVerse.meta?.externalFile, 'boot-ring verses now carry cache coordinates');
    // The chapter is cached (prefetched by the earlier tests). A live DRA
    // selection must render English through the cache — never the bake.
    const english = detailFor(bootVerse, manifest2, { translation: 'DRA' });
    assert.match(english.text, /beginning/i, 'the live selection wins over the bake');
    // And in its OWN language the bake is still honest.
    const latin = detailFor(bootVerse, manifest2, { translation: 'VUL' });
    assert.match(latin.text, /principio/i);
  });
});

// W-16 (2026-07-29): book and testament names froze at the boot language.
// The names table is now LIVE — one stable reference whose CONTENTS are
// replaced on a language change — so a formatter built once at boot still
// follows the reader. This has been the same bug three times (stale verse
// text, English substitution footers, frozen names), so it gets a guard:
// the formatter must be built BEFORE the switch, exactly as bootVolume
// builds it, and must still repaint after.
describe('the shelf follows the reader — a live names table', () => {
  const namesMap = {
    books: { APOC: 'Apocalypsis' }, sections: {}, testaments: {},
    bookAbbreviations: {}, locale: 'latin'
  };
  const fmt = volumeConfigs.bible.formatLabel({ level: 'book', locale: 'latin', namesMap });
  const apoc = () => fmt({ item: { id: 'APOC', level: 'book', name: 'Apocalypsis' }, context: 'magnifier' });
  const chapter3 = () => fmt({ item: { id: 'GENE:3', level: 'chapter', name: '3' }, context: 'magnifier' });

  it('repaints book names when the table changes under a boot-built formatter', () => {
    assert.equal(apoc(), 'Apocalypsis');
    namesMap.books = { APOC: 'Offenbarung des Johannes' };
    namesMap.locale = 'german';
    assert.equal(apoc(), 'Offenbarung des Johannes',
      'a formatter captured at boot must not freeze the names it reads');
  });

  it('carries the locale with the names — vocabulary and numerals follow', () => {
    namesMap.books = { APOC: 'Apocalypsis' };
    namesMap.locale = 'latin';
    namesMap.vocabulary = null;
    assert.equal(chapter3(), 'Capitulum III', 'Latin: Roman numerals');
    namesMap.locale = 'greek';
    assert.equal(chapter3(), 'Κεφάλαιον γʹ', 'Greek: Greek numerals');
    namesMap.locale = 'russian';
    assert.equal(chapter3(), 'Глава 3', 'Russian: Arabic numerals');
  });

  it('lets the registry supply vocabulary the engine table lacks', () => {
    // The engine's VOCAB knows 9 languages; every import beyond them fell
    // to English. The registry now leads (W-15's lesson generalized).
    namesMap.locale = 'german';
    namesMap.vocabulary = null;
    assert.equal(chapter3(), 'Chapter 3', 'unknown to the engine table → English belt');
    namesMap.vocabulary = { chapter: 'Kapitel', verse: 'Vers' };
    assert.equal(chapter3(), 'Kapitel 3', 'registry vocabulary wins');
    namesMap.vocabulary = null;
  });
});

// A placeholder language's "coming soon" node is a single sentinel carrying no
// language of its own, so its WORDS come from context. While a language is
// merely PREVIEWED — passing under the lens as the reader turns the ring, not
// yet committed — that context is the previewed language, not the committed
// one. Without the hint, Italian's held shelf wore Finnish's promise (Howell
// caught it on the phone, 2026-07-30).
describe('the coming-soon node speaks the language it belongs to', () => {
  const meta = {
    translations: {
      FIN: { language: 'finnish', name: 'Biblia' },
      CEI: { language: 'italian', name: 'CEI', pendingLicense: true }
    }
  };
  const langMeta = {
    languages: [
      { id: 'finnish', autonym: 'Suomi', comingSoonText: 'Tulossa pian' },
      { id: 'italian', autonym: 'Italiano', comingSoonText: 'Prossimamente' }
    ]
  };
  const build = () => {
    const store = createInteractionStore();
    const bridge = createDimensionBridge({ store, translationsMeta: meta, languagesMeta: langMeta });
    bridge.setLanguage('finnish'); // committed: a language that HAS an edition
    return bridge;
  };

  it('labels a previewed placeholder in the PREVIEWED tongue', () => {
    const bridge = build();
    const key = bridge.comingSoonKey;
    assert.equal(bridge.translationName(key, 'italian'), 'Prossimamente');
    assert.equal(bridge.translationAbbrev(key, 'italian'), 'Prossimamente');
  });

  it('falls back to the committed language when no hint is given', () => {
    const bridge = build();
    assert.equal(bridge.translationName(bridge.comingSoonKey), 'Tulossa pian');
  });
});
