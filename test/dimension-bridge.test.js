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
import { seedVerseCache } from '../src/adapters/volume-helpers.js';
import { normalizeUnitText } from '../src/core/unit-text.js';
// SEEDING FROM THE H-11 FIXTURE (H-14). These cells used to warm the cache by
// FETCHING a legacy chapter file; that file is cargo the engine can no longer
// open, and there is no fetch left in the text path at all — a unit's text is
// converted and seated once at boot.
//
// The fixture carries Genesis 1 in both the Vulgate and the Douay-Rheims,
// which is exactly what these cells need: one address, two traditions, so
// "the same verse in the translation in scope" has something to be scoped to.
const seedGenesisFixture = () => {
  const base = path.resolve(__dirname, 'fixtures/h11/gutenberg/v1');
  const read = rel => JSON.parse(readFileSync(path.join(base, rel), 'utf-8'));
  const declared = ['VUL', 'DRA'];
  const chart = read('charts/VUL/bc22df.json');
  const records = normalizeUnitText({
    editions: Object.fromEntries(declared.map(c => [c, read(`text/${c}/bc22df.json`)])),
    declared,
    order: chart.seats.map(seat => String(seat.label))
  });
  seedVerseCache('bc22df', records);
  return 'bc22df';
};


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

  it('setLanguage defaults to the first SERVABLE edition, skipping the rest (Howell 2026-07-26)', () => {
    // The bug: english listed an unshowable edition before DRA, so the default
    // landed on a translation we cannot display.
    //
    // RE-POINTED AT O-29's GATE. The doctrine is untouched — the default must
    // skip what cannot be shown — but `pendingLicense` and `comingSoon` are
    // retired, and unservable now means failing one of the TWO conditions.
    // The cell is stronger for it: one edition fails each half, so a gate that
    // dropped either would still be caught here.
    const store = createInteractionStore();
    const meta = { translations: {
      UNREAD: { language: 'english', name: 'Not proofread', proofread: false, hasChart: true },
      UNCHARTED: { language: 'english', name: 'No chart', proofread: true, hasChart: false },
      DRA: { language: 'english', name: 'Douay-Rheims', proofread: true, hasChart: true }
    } };
    const bridge = createDimensionBridge({ store, translationsMeta: meta });
    assert.equal(bridge.setLanguage('english'), true);
    assert.equal(bridge.getSelection().translation, 'DRA',
      'lands on the servable edition — not the unproofread one, and not the uncharted one');
  });

  it('a language with NOTHING servable is DISPLAY-ONLY: the reader keeps its edition (W-11)', () => {
    // Howell ruled 2026-07-27 (superseding the earlier first-listed
    // fallback): a language whose every edition is held for licensing must
    // not commit anything — the deploy filter has stripped those texts, so
    // committing one pointed the reader at a blank page wearing a real
    // edition's name. The shelf shows; the reader keeps reading.
    const store = createInteractionStore();
    const meta = { translations: {
      VUL: { language: 'latin', name: 'Vulgate', proofread: true, hasChart: true },
      A: { language: 'italian', name: 'Not proofread', proofread: false, hasChart: true },
      B: { language: 'italian', name: 'No chart', proofread: true, hasChart: false }
    } };
    const bridge = createDimensionBridge({ store, translationsMeta: meta });
    assert.equal(bridge.setTranslation('VUL'), true, 'the reader starts on Latin');
    assert.equal(bridge.setLanguage('italian'), true, 'the unservable language is still browsable');
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
      VUL: { language: 'latin', name: 'Vulgate', proofread: true, hasChart: true },
      SOON: { language: 'latin', name: 'No chart', proofread: true, hasChart: false },
      CEIX: { language: 'italian', name: 'Not proofread', nativeName: 'La Sacra Bibbia CEI', proofread: false, hasChart: true }
    } };
    const langMeta = { languages: [
      { id: 'latin', autonym: 'Latina' },
      { id: 'italian', autonym: 'Italiano', comingSoonText: 'in arrivo' }
    ] };
    const bridge = createDimensionBridge({ store, translationsMeta: meta, languagesMeta: langMeta });
    bridge.setTranslation('VUL');
    assert.deepEqual(bridge.translationsOf('latin'), ['VUL'], 'the uncharted edition is not seated');
    assert.deepEqual(bridge.translationsOf('italian'), ['__coming_soon__'],
      'a language with nothing servable shows the placeholder, not the edition');
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
      translations: { BYZ: { language: 'greek', name: 'Byzantine', proofread: true } }
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
        VUL: { language: 'latin', name: 'Vulgate', proofread: true },
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
    const externalFile = seedGenesisFixture();
    const originalWindow = globalThis.window;
    globalThis.window = { location: { search: '?volume=bible&translation=VUL' } };
    try {
      const verse = { id: 'bc22df_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
      const english = detailFor(verse, manifest, { translation: 'DRA' });
      assert.match(english.text, /beginning/i, 'the store wins; the URL is inert');
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('the same verse renders Latin or English by the translation in scope', async () => {
    const externalFile = seedGenesisFixture();

    const verse = { id: 'bc22df_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
    const latin = detailFor(verse, manifest, { translation: 'VUL' });
    const english = detailFor(verse, manifest, { translation: 'DRA' });

    assert.match(latin.text, /principio/i, 'VUL renders the Latin');
    assert.match(english.text, /beginning/i, 'DRA renders the English');
    assert.notEqual(latin.text, english.text, 'the swap genuinely changes the content');
  });

  it('NO ASTERISKS: a missing edition yields NOTHING, never a substitute', async () => {
    // Howell, RULED 2026-07-30, superseding W-6's flagged Latin entirely:
    // "If a translation is available, it's complete... I do not want to
    // associate myself with any product that makes future promises or
    // excuses." So the reader's own edition or nothing — no Vulgate standing
    // in, no italic voice, no footer. A verse an offered edition lacks was
    // never written, and a gap needs no explanation.
    const externalFile = seedGenesisFixture();

    const verse = { id: 'bc22df_1_1', level: 'verse', meta: { externalFile, verseKey: '1' } };
    // The fixture chapter carries VUL and DRA only — SYN is absent.
    const absent = detailFor(verse, manifest, { translation: 'SYN' });
    assert.equal(absent.text, '', 'no text — the Latin does NOT stand in');
    assert.equal(absent.substituted, undefined, 'and nothing is marked, because nothing was substituted');
    // The reader's own edition still reads.
    const honest = detailFor(verse, manifest, { translation: 'DRA' });
    assert.match(honest.text, /beginning/i, "the reader's own edition renders");
    // And with NO edition at all — nothing certified — there is nothing to show.
    const dark = detailFor(verse, manifest, { translation: null });
    assert.equal(dark.text, '', 'no active edition ⇒ an empty sector');
  });

  it('a live language switch outruns any baked text (the stale-Latin bug, 2026-07-28)', async () => {
    // The boot verse ring used to BAKE each verse's text at chain-build time.
    // The bug: a later language switch repainted that build-time Latin —
    // unflagged — because the baked items carried no cache coordinates and
    // detailFor trusted `selected.text` regardless of language.
    // Boot no longer bakes anything (2026-07-30: it uses the continuous chain,
    // and the baking builder is deleted), so this guards the PROPERTY rather
    // than the old path: if an item ever arrives carrying text — from a cache,
    // a snapshot, a future builder — that text is honored ONLY in its own
    // language. The item is therefore constructed here by hand, exactly as a
    // baking builder produced one.
    const address = seedGenesisFixture();
    const bakedVerse = {
      id: 'bc22df_1_1',
      name: '1',
      level: 'verse',
      translation: 'VUL',                       // the tongue the bake is IN
      text: 'In principio creavit Deus cælum et terram.',
      meta: {
        bookId: 'bc22df', bookEntryId: 'bc22df', chapterId: 'bc22df/1',
        verseKey: '1', externalFile: address
      }
    };
    // The chapter is cached (prefetched by the earlier tests). A live DRA
    // selection must render English through the cache — never the bake.
    const english = detailFor(bakedVerse, manifest, { translation: 'DRA' });
    assert.match(english.text, /beginning/i, 'the live selection wins over the bake');
    // And in its OWN language the bake is still honest.
    const latin = detailFor(bakedVerse, manifest, { translation: 'VUL' });
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
    // Casing moved from CSS into the formatter (2026-08-02): Latin-script
    // names still shout, and the point of the test is unchanged — the name
    // follows the live table rather than the boot value.
    assert.equal(apoc(), 'APOCALYPSIS');
    namesMap.books = { APOC: 'Offenbarung des Johannes' };
    namesMap.locale = 'german';
    assert.equal(apoc(), 'OFFENBARUNG DES JOHANNES',
      'a formatter captured at boot must not freeze the names it reads');
  });

  it('carries the locale with the names — vocabulary and numerals follow', () => {
    // The WORD comes from the registry (the engine holds none); the NUMERAL
    // SYSTEM still follows the locale, so both must travel with the table.
    namesMap.books = { APOC: 'Apocalypsis' };
    namesMap.locale = 'latin';
    namesMap.vocabulary = { chapter: 'Capitulum' };
    assert.equal(chapter3(), 'CAPITULUM III', 'Latin: Roman numerals, and Latin shouts');
    namesMap.locale = 'greek';
    namesMap.vocabulary = { chapter: 'Κεφάλαιον' };
    assert.equal(chapter3(), 'Κεφάλαιον γʹ', 'Greek: Greek numerals');
    namesMap.locale = 'russian';
    namesMap.vocabulary = { chapter: 'Глава' };
    assert.equal(chapter3(), 'Глава 3', 'Russian: Arabic numerals');
  });

  it('the registry is the ONLY source of the word — no English belt', () => {
    // Howell 2026-07-28: "the hard coded list of languages in the engine is
    // very troubling... Manifolds don't have languages." The engine's
    // nine-language table is deleted, so a tongue whose registry entry has no
    // word shows the BARE NUMERAL — never another language's word. That is the
    // form already ruled sufficient (2026-07-20: "the numeral system itself
    // says which is which, so neither wears a word").
    namesMap.locale = 'german';
    namesMap.vocabulary = null;
    assert.equal(chapter3(), '3', 'no word ⇒ the bare numeral, not English');
    namesMap.vocabulary = { chapter: 'Kapitel', verse: 'Vers' };
    assert.equal(chapter3(), 'KAPITEL 3', 'the registry supplies the word');
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
      FIN: { language: 'finnish', name: 'Biblia', proofread: true },
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

// O-29's RULING ITSELF — servable = proofread && hasChart.
//
// Ruled 2026-08-06, landed 2026-08-12 when the 1a exit gate refused without
// it. These cells pin both halves and, just as importantly, the RETIREMENT:
// the two conditions the ruling removed must have no effect at all.
describe('the servable gate (O-29)', () => {
  const bridgeOver = translations => createDimensionBridge({
    store: createInteractionStore(), translationsMeta: { translations }
  });

  it('an UNCHARTED edition is not servable, however proofread', () => {
    // W-38's half: after the migration there is no spine numbering to fall
    // back on, so an edition without a chart cannot be displayed. Going dark
    // is correct behaviour, not a cost to avoid.
    const b = bridgeOver({
      GOOD: { language: 'latin', proofread: true, hasChart: true },
      NOCHART: { language: 'latin', proofread: true, hasChart: false }
    });
    assert.deepEqual(b.translationsOf('latin'), ['GOOD']);
  });

  it('an UNPROOFREAD edition is not servable, however charted', () => {
    const b = bridgeOver({
      GOOD: { language: 'latin', proofread: true, hasChart: true },
      UNREAD: { language: 'latin', proofread: false, hasChart: true }
    });
    assert.deepEqual(b.translationsOf('latin'), ['GOOD']);
  });

  it('THE RETIRED CONDITIONS HAVE NO EFFECT — this is the cell that proves the deletion', () => {
    // `pendingLicense` and `comingSoon` gated this for months and were never
    // once set on any of the fourteen editions: dead code wearing the costume
    // of a safeguard. A licence governs DISTRIBUTION, not display (W-34) — if
    // an unlicensed text is on the device the deploy filter has already
    // failed, and a display check then hides the evidence rather than
    // preventing the leak.
    //
    // So an edition carrying BOTH flags, and satisfying both real conditions,
    // must be offered. If either check crept back this goes red.
    const b = bridgeOver({
      X: { language: 'latin', proofread: true, hasChart: true, pendingLicense: true, comingSoon: true }
    });
    assert.deepEqual(b.translationsOf('latin'), ['X'],
      'a retired condition that still excludes is a gate nobody ruled');
  });

  it('the LAN override lifts proofread and NOT hasChart', () => {
    // Stated and accepted in the ruling: the override becomes TOTAL on the
    // LAN, because proofread is the only human-facing condition left. The
    // chart half is not a judgement about readiness — an edition with no
    // chart has no seats to inspect, so there is nothing for the flag to
    // reveal.
    const priorWindow = globalThis.window;
    globalThis.window = { location: { hostname: '192.168.1.10', protocol: 'http:', search: '?proofread=true' } };
    try {
      const b = bridgeOver({
        UNREAD: { language: 'latin', proofread: false, hasChart: true },
        NOCHART: { language: 'latin', proofread: false, hasChart: false }
      });
      assert.deepEqual(b.translationsOf('latin'), ['UNREAD'],
        'the unproofread edition becomes inspectable; the uncharted one stays unreachable');
    } finally {
      if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
    }
  });
});
