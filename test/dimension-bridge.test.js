import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInteractionStore, interactionEvents } from '../src/core/interaction-store.js';
import { createDimensionBridge } from '../src/core/dimension-bridge.js';
import { detailFor, createHandlers } from '../src/adapters/bible-adapter.js';
import { buildBibleBookCousinChain } from '../src/navigation/cousin-builder.js';
import { isEditionFullyConfirmed } from '../src/adapters/bible-volume.js';
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
    // O-92: the DRA's text file wears the edition's own book id; the VUL
    // files on disk keep the pre-doctrine id, unreachable as ever.
    editions: Object.fromEntries(declared.map(c => [c, read(`text/${c}/${c === 'DRA' ? 'bdra9e1' : 'bc22df'}.json`)])),
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

  it('THE RING SPEAKS SHORT, IN ITS OWN SCRIPT — and never falls back to the key (O-97)', () => {
    // Rewritten, not amended (W-102): the doctrine under this cell moved
    // twice. It was written for Howell's 2026-07-26 ruling, then 2026-08-01
    // retired the whole mechanism in favour of full native names, then
    // 2026-08-23 chose the short native form over BOTH that and Map.
    const withNative = createDimensionBridge({ store: createInteractionStore(), translationsMeta: {
      translations: { LXX: { language: 'greek', name: 'Septuagint', nativeName: 'Οἱ Ἑβδομήκοντα', nativeAbbrev: 'Οʹ' } }
    } });
    assert.equal(withNative.translationAbbrev('LXX'), 'Οʹ',
      'the short form in the edition\'s own script — not Map, which is Latin');

    // THE FALLBACK CHANGED, and this is the cell that says so. It used to be
    // the KEY, so an edition with no short form read "50grc" on the ring —
    // a filing label of the worst kind, and exactly what Howell has now
    // rejected twice. A long TRUE name beats a short false one, and the
    // collision it causes is the visible reminder that the data is owed.
    const noAbbrev = createDimensionBridge({ store: createInteractionStore(), translationsMeta: {
      translations: { '50grc': { language: 'greek', name: 'Patriarchal Text', nativeName: 'Ἡ Καινὴ Διαθήκη', proofread: true } }
    } });
    assert.equal(noAbbrev.translationAbbrev('50grc'), 'Ἡ Καινὴ Διαθήκη',
      'the full native name stands in — never the key');

    // And with neither, the English name before the key, for the same reason.
    const bare = createDimensionBridge({ store: createInteractionStore(), translationsMeta: {
      translations: { BYZ: { language: 'greek', name: 'Byzantine', proofread: true } }
    } });
    assert.equal(bare.translationAbbrev('BYZ'), 'Byzantine');
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

// EVERY STRATUM SPEAKS ITS OWN TONGUE (O-54, Howell's phone 2026-08-14:
// "HEBREW ... should be in Hebrew").
describe('the strata name things in their own script', () => {
  const bridgeOver = (translations, languages) => createDimensionBridge({
    store: createInteractionStore(),
    translationsMeta: { translations },
    languagesMeta: { languages }
  });

  it('THE LANGUAGE RING SHOWS THE AUTONYM, not the English name', () => {
    // I returned `languagesMeta: null` at the repoint, so the ring had no
    // autonym to show and fell through to the id — the reader met the English
    // word HEBREW where עברית belongs. The volume declared it the whole time.
    const b = bridgeOver(
      { WLC: { language: 'hebrew', name: 'Westminster Leningrad Codex', proofread: true, hasChart: true } },
      [{ id: 'hebrew', autonym: 'עברית' }]
    );
    assert.equal(b.languageLabel('hebrew'), 'עברית');
  });

  it('a language the volume does not name gets NO invented one (H-2)', () => {
    // A label is a quotation. Falling back to a manufactured autonym would be
    // the engine speaking for a tradition it has not been told about.
    const b = bridgeOver(
      { X: { language: 'coptic', name: 'Something', proofread: true, hasChart: true } },
      [{ id: 'hebrew', autonym: 'עברית' }]
    );
    assert.equal(b.languageLabel('coptic'), 'coptic', 'the id stands in, and nothing is invented');
  });

  it('THE EDITION RING SHOWS nativeName WHEN THE DATA CARRIES ONE', () => {
    // Currently it does not for WLC, which is why Howell still reads
    // "WESTMINSTER LENINGRAD CODEX" in Latin script. That half is the data's:
    // the engine cannot manufacture כתב יד לנינגרד out of an English string.
    // This cell proves the engine is ready for it the day it lands.
    const withNative = bridgeOver(
      { WLC: { language: 'hebrew', name: 'Westminster Leningrad Codex',
               nativeName: 'כתב יד לנינגרד', proofread: true, hasChart: true } },
      [{ id: 'hebrew', autonym: 'עברית' }]
    );
    assert.equal(withNative.translationName('WLC'), 'כתב יד לנינגרד');

    const without = bridgeOver(
      { WLC: { language: 'hebrew', name: 'Westminster Leningrad Codex', proofread: true, hasChart: true } },
      [{ id: 'hebrew', autonym: 'עברית' }]
    );
    assert.equal(without.translationName('WLC'), 'Westminster Leningrad Codex',
      'without a native name the English one stands — honest, and visibly wrong to a Hebrew reader');
  });
});

// AND THE VOLUME MUST ACTUALLY SUPPLY THEM (O-54).
//
// The cells above construct the bridge by hand and so prove only that it READS
// an autonym. Breaking the volume config — putting `languagesMeta: null` back,
// which is the exact defect Howell saw — left every one of them GREEN.
//
// Third time this shape has caught me: the helper is tested, the WIRING is not,
// and the wiring is where the defect lives. So this asks the volume config the
// way boot asks it.
describe('the volume supplies its own autonyms (O-54)', () => {
  it('loadSupplemental returns languages shaped for the ring', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const root = {
      display_config: {
        languages: { available: ['hebrew'], default: 'hebrew', labels: { hebrew: 'עברית' } }
      }
    };
    const volume = {
      editions: [{ code: 'WLC', language: 'hebrew', hasChart: true, proofread: false, name: 'Westminster Leningrad Codex' }],
      namesByLanguage: { hebrew: { books: {}, testaments: {} } }
    };
    const manifest = {};
    Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });

    const supp = await volumeConfigs.bible.loadSupplemental(root, manifest);
    assert.ok(supp.languagesMeta, 'null here is what showed the reader the English word HEBREW');
    assert.deepEqual(supp.languagesMeta.languages, [{ id: 'hebrew', autonym: 'עברית' }]);
  });

  it('a language the volume lists but does not NAME is left out, never invented', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const root = {
      display_config: {
        languages: { available: ['hebrew', 'coptic'], default: 'hebrew', labels: { hebrew: 'עברית' } }
      }
    };
    const volume = {
      editions: [{ code: 'WLC', language: 'hebrew', hasChart: true, proofread: false }],
      namesByLanguage: {}
    };
    const manifest = {};
    Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });

    const supp = await volumeConfigs.bible.loadSupplemental(root, manifest);
    assert.deepEqual(supp.languagesMeta.languages.map(l => l.id), ['hebrew'],
      'an unnamed language carries no manufactured autonym into the ring (H-2)');
  });
});

// THE VOLUME'S WORD REACHES THE RING INTACT (O-54).
//
// The registry synthesis listed five fields by hand and dropped the two the
// bridge also reads — `nativeName` and `vocabulary`. Neither is in the cargo
// today, which is precisely what made it dangerous: the drop is invisible
// until the data grows the field, and then nothing changes on screen and the
// hunt starts in the wrong repository.
describe('the synthesised registry carries the edition whole (O-54)', () => {
  it('passes through a field the engine did not think to list', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const volume = {
      editions: [{
        code: 'WLC', language: 'hebrew', hasChart: true, proofread: false,
        name: 'Westminster Leningrad Codex',
        nativeName: 'כתב יד לנינגרד',
        somethingAddedLater: 'must survive'
      }],
      namesByLanguage: {}
    };
    const manifest = {};
    Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
    const supp = await volumeConfigs.bible.loadSupplemental(
      { display_config: { languages: { available: [], labels: {} } } }, manifest);
    const wlc = supp.translationsMeta.translations.WLC;
    assert.equal(wlc.nativeName, 'כתב יד לנינגרד', 'the Hebrew title must reach the ring');
    assert.equal(wlc.somethingAddedLater, 'must survive',
      'a field added to the data tomorrow arrives without anyone remembering to list it');
    assert.equal(wlc.proofread, false, 'and the normalised fields keep their defaults');
  });
});

// H-25, Howell 2026-08-15: the NOT PROOFREAD badge flips per BOOK now, as he
// confirms one seat per book and needs to see where he left off. The cells
// that matter most are the ones proving the SHELF did not come along for the
// ride — the proposal was a single line that would have changed both.
describe('per-book certification (H-25) — and the shelf that must not follow', () => {
  const bridgeOver = translations => createDimensionBridge({
    store: createInteractionStore(), translationsMeta: { translations }
  });

  const WLC = {
    language: 'hebrew', name: 'Unicode/XML Leningrad Codex', hasChart: true,
    proofread: false,                       // the EDITION is not finished
    proofreadUnits: ['b372f374a', 'bb4e6180a']   // Genesis, Exodus confirmed
  };

  it('a confirmed book is certified; an unconfirmed one is not', () => {
    const b = bridgeOver({ WLC });
    assert.equal(b.isCertifiedUnit('WLC', 'b372f374a'), true, 'Genesis was confirmed');
    assert.equal(b.isCertifiedUnit('WLC', 'bf9cb53f9'), false, 'Leviticus was not');
  });

  it('AN EDITION EARNS THE SHELF WITH ITS FIRST CONFIRMED BOOK', () => {
    // Howell opened the LAN Bible with no ?proofread=true and got nothing:
    // WLC is proofread:false with three books he had personally OK'd, and the
    // shelf gate refused it outright. Three confirmed books unreachable
    // without a debug flag.
    const b = bridgeOver({ WLC });
    assert.equal(b.isServableEdition('WLC'), true, 'one confirmed book is enough to be offered');
    assert.deepEqual(b.translationsOf('hebrew'), ['WLC']);
  });

  it('an edition with NO confirmed book stays off the shelf', () => {
    const b = bridgeOver({
      NONE: { language: 'greek', hasChart: true, proofread: false, proofreadUnits: [] },
      NEVER: { language: 'greek', hasChart: true, proofread: false }
    });
    assert.equal(b.isServableEdition('NONE'), false, 'an empty list is not a confirmation');
    assert.equal(b.isServableEdition('NEVER'), false, 'and neither is no list at all');
  });

  it('an uncharted edition is still refused, however many books are confirmed', () => {
    // O-29's other half is untouched: without a chart there is no seating, so
    // there is nothing to display whatever the proofreading says.
    const b = bridgeOver({
      NOCHART: { language: 'hebrew', hasChart: false, proofread: false, proofreadUnits: ['b372f374a'] }
    });
    assert.equal(b.isServableEdition('NOCHART'), false);
  });

  it('THE SHELF STILL DOES NOT MOVE PER BOOK — servability is edition-level', () => {
    // The distinction that survived the 2026-08-15 amendment, and the reason
    // the badge query stayed separate. The shelf asks whether the EDITION is
    // fit to offer — answered once, the same wherever the reader stands. It
    // never asks about the book in hand, so an edition cannot appear in
    // Genesis and vanish in Numbers.
    const b = bridgeOver({ WLC });
    const servable = b.isServableEdition('WLC');
    assert.equal(b.isServableEdition('WLC'), servable, 'the answer does not depend on position');
    assert.equal(b.isCertifiedUnit('WLC', 'b372f374a'), true, 'while the BADGE does vary by book:');
    assert.equal(b.isCertifiedUnit('WLC', 'bf9cb53f9'), false, '  confirmed here, not there');
    assert.equal(servable, true, 'and the edition is offered whole either way');
  });

  it('the edition-level question is untouched by per-book marks', () => {
    const b = bridgeOver({ WLC });
    assert.equal(b.isCertifiedEdition('WLC'), false,
      'isCertifiedEdition still reads the edition flag and only that');
  });

  it('an edition with NO per-book marks behaves exactly as it did', () => {
    // The fallback. Nothing regresses for the editions that never grow the
    // field — which is every edition but one on the day this lands.
    const b = bridgeOver({
      DONE: { language: 'latin', proofread: true, hasChart: true },
      NOTDONE: { language: 'latin', proofread: false, hasChart: true }
    });
    assert.equal(b.isCertifiedUnit('DONE', 'anything'), true);
    assert.equal(b.isCertifiedUnit('NOTDONE', 'anything'), false);
    assert.equal(b.isCertifiedUnit('DONE', null), true, 'with no book in hand the edition answers');
  });

  it('an unknown edition is never certified', () => {
    const b = bridgeOver({ WLC });
    assert.equal(b.isCertifiedUnit('NOPE', 'b372f374a'), false);
  });

  it('WITH NO BOOK IN HAND the edition flag answers, marked or not', () => {
    // The contract matches the call site, which falls back to the edition
    // when the ring holds no book. They disagreed in the first cut: the
    // function said false for a marked edition asked about no book while the
    // caller said "ask the edition". Nothing exercised it because the caller
    // never passed null — and a second caller would have inherited the
    // disagreement, putting NOT PROOFREAD on the root ring of an edition that
    // is genuinely finished. Wilbur's flag on review of #181.
    const b = bridgeOver({
      WLC,                                                  // proofread: false + units
      FINISHED: { language: 'greek', hasChart: true,
                  proofread: true, proofreadUnits: ['b372f374a'] }
    });
    assert.equal(b.isCertifiedUnit('WLC', null), false, 'an unfinished edition, no book: false');
    assert.equal(b.isCertifiedUnit('FINISHED', null), true,
      'a FINISHED edition with per-book marks must not read as uncertified off-book');
    assert.equal(b.isCertifiedUnit('FINISHED', 'bf9cb53f9'), false,
      'but asked about a book it has not marked, it still answers per book');
  });
});

// H-25 point 4, THE LEAK HOWELL'S PHONE FOUND. The ring showed the three
// confirmed books while the pyramid behind it scattered the other 36 as
// nodes: `getBibleBooksForTestament` called the chain WITHOUT an edition, so
// the filter had nothing to filter by and returned everything.
//
// EVERY EXISTING CELL PASSED, and that is the point. They all called
// `buildBibleBookCousinChain` directly and passed it an edition, because
// passing the edition is what the author writing the test remembers to do —
// the same author who forgot it at one call site out of four. So this cell
// tests THE SEAM rather than the builder: it asks the handler the app
// actually calls, the way the app calls it.
describe('the pyramid seats every held book, marked not hidden (O-124 retires H-25 point 4)', () => {
  const VOLUME = {
    editions: [{ code: 'WLC', proofreadUnits: ['bGEN'] }],
    testaments: [{ id: 'T1', books: [{ id: 'bGEN' }, { id: 'bEXO' }, { id: 'bLEV' }] }]
  };
  const manifest = {
    Gutenberg_Bible: {
      testaments: { T1: { sort_number: 0, books: {
        bGEN: { sort_number: 0 }, bEXO: { sort_number: 1 }, bLEV: { sort_number: 2 }
      } } }
    }
  };
  Object.defineProperty(manifest, '__wallVolume', { value: VOLUME, enumerable: false });

  // Until 2026-09-01 this asserted ['bGEN'] — unconfirmed books were
  // UNREACHABLE off the flag. Howell retired that: the Greek goes public
  // unproofread, wearing the NOT PROOFREAD mark, so the chain now seats every
  // book the edition HOLDS and the mark says which are unread. Membership
  // still filters (O-71); the proofread record no longer does.
  it('WITH an edition, the chain carries every held book — confirmed or not', () => {
    const chain = buildBibleBookCousinChain(manifest, { names: {}, edition: 'WLC' });
    assert.deepEqual(chain.items.filter(Boolean).map(i => i.id), ['bGEN', 'bEXO', 'bLEV']);
  });

  it('the handler the app calls passes one — the defect was here, not in the builder', () => {
    const handlers = createHandlers({
      manifest, namesMap: {}, options: { activeEdition: 'WLC', level: 'book' }, translationsMeta: null
    });
    const supplier = handlers?.layoutBindings?.getBibleBooksForTestament;
    assert.equal(typeof supplier, 'function', 'the pyramid asks this for its nodes');
    const chain = supplier('T1');
    assert.deepEqual(chain.items.filter(Boolean).map(i => i.id), ['bGEN', 'bEXO', 'bLEV'],
      'the pyramid seats what the ring seats — all held books, since O-124');
  });
});

// H-26/W-83 — the shelf chart: the edition's own book order, and its sections
// as labelled ranges over that order.
//
// THE REQUIRED CELL is the filtered-ring one, recorded in W-83 at Orville's
// request. Group lookup by RING POSITION passes every unfiltered-ring test,
// because in an unfiltered ring the ring index and the shelf ordinal agree.
// They stop agreeing the moment H-25's filter hides an unconfirmed book — and
// then Ruth, who sits at shelf ordinal 32 among the Writings, is ring item 8
// and reads as Prophets.
describe('the shelf chart — order and sections (H-26)', () => {
  // A miniature Tanakh: five Torah, two Prophets, one Writing, shelved in the
  // codex's order, with Ruth late as she is there.
  const SHELF = {
    edition: 'WLC',
    units: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'CHR', 'RUT'],
    groups: [
      { label: 'תורה', from: 1, to: 5 },
      { label: 'נביאים', from: 6, to: 7 },
      { label: 'כתובים', from: 8, to: 9 }
    ]
  };
  // volume.json enumerates in the OTHER order — Ruth right after Judges, as
  // the Vulgate has her. The shelf must win.
  const volumeOrder = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', 'CHR'];
  const volume = {
    units: volumeOrder.map(id => ({ id })),
    // Only three confirmed, and Ruth one of them — so the ring is short and
    // her position in it falls in a DIFFERENT group from her shelf ordinal.
    // The first draft of this cell confirmed eight of nine, which left ring
    // ordinal 8 and shelf ordinal 9 both inside the Writings: the assertion
    // passed while testing nothing, exactly the shape it exists to forbid.
    editions: [{ code: 'WLC', proofreadUnits: ['GEN', 'EXO', 'RUT'] }],
    testaments: [{ id: 'T1', books: volumeOrder.map(id => ({ id, testamentId: 'T1' })) }],
    shelfFor: () => SHELF,
    bookOrderFor() {
      const known = new Set(volumeOrder);
      const ordered = SHELF.units.filter(id => known.has(id));
      const seen = new Set(ordered);
      return ordered.concat(volumeOrder.filter(id => !seen.has(id)));
    },
    sectionOf(edition, unitId) {
      const ordinal = SHELF.units.indexOf(unitId) + 1;
      if (!ordinal) return null;
      const g = SHELF.groups.find(x => ordinal >= x.from && ordinal <= x.to);
      return (g && g.label) || null;
    }
  };

  it('the edition shelves its own order — Ruth moves to the Writings', () => {
    assert.deepEqual(volume.bookOrderFor('WLC'), SHELF.units,
      'the shelf wins over volume order');
    assert.notEqual(volumeOrder.indexOf('RUT'), SHELF.units.indexOf('RUT'),
      'and the two orders genuinely differ, or this cell proves nothing');
  });

  it('sections are labelled ranges: each book resolves to its own division', () => {
    assert.equal(volume.sectionOf('WLC', 'GEN'), 'תורה');
    assert.equal(volume.sectionOf('WLC', 'JOS'), 'נביאים', 'the break is AT Joshua');
    assert.equal(volume.sectionOf('WLC', 'RUT'), 'כתובים');
    assert.equal(volume.sectionOf('WLC', 'NOSUCH'), null, 'a book off the shelf has no section');
  });

  it('REQUIRED (W-83): the section survives a FILTERED ring — Ruth is not a Prophet', () => {
    // The ring as the reader sees it: Chronicles unconfirmed and therefore
    // absent (H-25 point 4), so Ruth is the EIGHTH item on screen while her
    // shelf ordinal is NINE.
    const confirmed = new Set(volume.editions[0].proofreadUnits);
    const ring = volume.bookOrderFor('WLC').filter(id => confirmed.has(id));
    assert.equal(ring.indexOf('RUT'), 2, 'third on screen (0-based 2)');
    assert.equal(SHELF.units.indexOf('RUT'), 8, 'ninth on the shelf (0-based 8)');

    // Keyed on the shelf, she is where the tradition puts her.
    assert.equal(volume.sectionOf('WLC', 'RUT'), 'כתובים');

    // Keyed on the ring — the bug this cell exists to forbid — she is not.
    const byRingIndex = ord => (SHELF.groups.find(g => ord >= g.from && ord <= g.to) || {}).label || null;
    assert.equal(byRingIndex(ring.indexOf('RUT') + 1), 'תורה',
      'the wrong lookup really does mislabel her, which is why the right one is asserted above');
  });

  it('an edition with no shelf chart keeps volume order and shows no label', () => {
    const plain = {
      units: volumeOrder.map(id => ({ id })),
      shelfFor: () => null,
      bookOrderFor: () => volumeOrder,
      sectionOf: () => null
    };
    assert.deepEqual(plain.bookOrderFor('X'), volumeOrder);
    assert.equal(plain.sectionOf('X', 'GEN'), null, 'absence, not an empty string');
  });
});

// The stale-shelf tripwire (Wilbur's ruling on his contract, 2026-08-16).
// Fired rather than read: a guard that cannot be shown firing is not a guard.
describe('a declared book that cannot load is LOUD (O-92 — the heir of the stale-shelf tripwire)', () => {
  // The H-26 drift suite guarded a shelf disagreeing with the volume's book
  // list. Under leaf-and-shard there is no second enumeration left to
  // disagree with — the edition's index IS its book list — so that whole
  // failure class died structurally (rewritten, not amended: W-102). What
  // can still break is an increment: an index declaring a book whose chart
  // does not load, which would silently vanish from every ring. That is the
  // loud line these cells pin.
  const loadWith = async (indexBooks, chartsThatLoad) => {
    const { loadBibleVolume } = await import('../src/adapters/bible-volume.js');
    const errs = [];
    const realError = console.error;
    console.error = (...a) => errs.push(a.join(' '));
    let volume;
    try {
      volume = await loadBibleVolume({
        base: '/x', version: 'v1',
        fetchJson: async p => {
          if (p.endsWith('volume.json')) {
            return {
              editions: [{ code: 'ED', language: 'l', hasChart: true }],
              shards: [{ id: 'S1', utterances: 2 }]
            };
          }
          if (p.endsWith('index.json')) {
            return { edition: 'ED', books: indexBooks.map(id => ({ file: id, shards: ['S1'] })), groups: [], divisions: [] };
          }
          if (p.includes('/spine/')) return { shard: 'S1', utterances: ['u1'] };
          if (p.includes('/charts/')) {
            const id = p.split('/').pop().replace('.json', '');
            if (!chartsThatLoad.includes(id)) throw new Error('no such chart ' + p);
            return { book: id, shards: ['S1'], seats: [{ label: '1', utterances: ['u1'] }], groups: [{ label: '1', from: 1, to: 1 }] };
          }
          if (p.includes('/names/')) return { books: {} };
          throw new Error('no such file ' + p);
        }
      });
    } finally { console.error = realError; }
    return { errs, volume };
  };

  it('a declared book whose chart fails to load is reported, by name', async () => {
    const { errs, volume } = await loadWith(['A', 'B'], ['A']);
    const hit = errs.find(e => e.includes('chart failed to load'));
    assert.ok(hit, 'the broken increment is reported: ' + JSON.stringify(errs));
    assert.match(hit, /\bB\b/, 'and the book is named, not merely counted');
    // The book stays DECLARED — the index is the enumeration — but held
    // nowhere: absent from every ring, present in the report.
    assert.deepEqual(volume.booksFor('ED').map(b => b.id), ['A', 'B']);
    assert.equal(volume.chartFor('B', 'ED'), null);
  });

  it('a clean index is silent, and its books are exactly what it declares', async () => {
    const { errs, volume } = await loadWith(['A', 'B'], ['A', 'B']);
    assert.deepEqual(errs, [], 'nothing to report');
    assert.deepEqual(volume.booksFor('ED').map(b => b.id), ['A', 'B'],
      'no second list filters the edition\'s own declaration (O-92)');
  });
});

// H-26: the label follows the ring LIVE, as the child pyramid does — it does
// not wait for a settle. That is only possible if the answer travels WITH the
// item, so the view can read it off whichever node is nearest the magnifier on
// any frame. This cell pins the carrying; the seat itself is view geometry.
describe('each ring item carries its own section (H-26)', () => {
  const SHELF = {
    units: ['GEN', 'EXO', 'JOS'],
    groups: [{ label: 'תורה', from: 1, to: 2 }, { label: 'נביאים', from: 3, to: 3 }]
  };
  const manifest = {
    Gutenberg_Bible: {
      testaments: { T: { sort_number: 0, books: {
        GEN: { sort_number: 0 }, EXO: { sort_number: 1 }, JOS: { sort_number: 2 }
      } } }
    }
  };
  const volume = {
    bookOrderFor: () => SHELF.units,
    sectionOf: (ed, id) => {
      const o = SHELF.units.indexOf(id) + 1;
      const g = SHELF.groups.find(x => o >= x.from && o <= x.to);
      return (g && g.label) || null;
    }
  };
  Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });

  it('every item arrives with its section attached', () => {
    const items = buildBibleBookCousinChain(manifest, { names: {}, edition: 'WLC' })
      .items.filter(Boolean);
    assert.deepEqual(items.map(i => [i.id, i.section]),
      [['GEN', 'תורה'], ['EXO', 'תורה'], ['JOS', 'נביאים']]);
  });

  it('THE BREAK IS AN EVENT: consecutive items differ exactly at the boundary', () => {
    // What the reader is meant to see while turning — the label holding
    // through the Torah and flipping as Joshua arrives.
    const items = buildBibleBookCousinChain(manifest, { names: {}, edition: 'WLC' })
      .items.filter(Boolean);
    const flips = items.slice(1)
      .map((it, i) => (it.section !== items[i].section ? it.id : null))
      .filter(Boolean);
    assert.deepEqual(flips, ['JOS'], 'exactly one change, and it lands on Joshua');
  });

  it('with no shelf chart the items carry no section at all', () => {
    const bare = { Gutenberg_Bible: manifest.Gutenberg_Bible };
    Object.defineProperty(bare, '__wallVolume', {
      value: { bookOrderFor: () => SHELF.units }, enumerable: false
    });
    const items = buildBibleBookCousinChain(bare, { names: {}, edition: 'WLC' })
      .items.filter(Boolean);
    assert.ok(items.every(i => !i.section), 'absence, so the view shows nothing');
  });
});

// THE OUTPUT CELL (Wilbur's ask, 2026-08-16, after Howell's first rotation).
//
// The shelf sort was written into the VERSE chain by mistake and sat there
// through three merges. Verses read correctly — expandVolumeSeats already
// walks bookOrderFor — so nothing went red, while the BOOK RING kept volume
// order and the section label faithfully painted the disagreement: rotating
// Ezra→Nehemiah→Esther→Job in Vulgate order made the label flap between
// Prophets and Writings, because in that order the shelf's sections really do
// alternate.
//
// Every per-builder cell passed. So this one asserts the OUTPUT: whatever the
// ring is built from, its id sequence must equal bookOrderFor. One cell on the
// answer catches a sort that went missing, went to the wrong function, or was
// undone downstream — none of which a cell aimed at one builder can see.
describe('the book ring IS the shelf order (H-26)', () => {
  const SHELF = ['GEN', 'JOS', 'CHR', 'RUT', 'EZR'];
  // volume.json enumerates the Vulgate way — Ruth after Joshua, Chronicles
  // late — so the two orders genuinely disagree.
  const VOLUME = ['GEN', 'JOS', 'RUT', 'EZR', 'CHR'];
  const manifest = {
    Gutenberg_Bible: {
      testaments: { T: { sort_number: 0, books: Object.fromEntries(
        VOLUME.map((id, i) => [id, { sort_number: i }])) } }
    }
  };
  Object.defineProperty(manifest, '__wallVolume', {
    value: { bookOrderFor: () => SHELF, sectionOf: () => null },
    enumerable: false
  });

  it('the ring comes out in shelf order, not volume order', () => {
    const ring = buildBibleBookCousinChain(manifest, { names: {}, edition: 'WLC' })
      .items.filter(Boolean).map(i => i.id);
    assert.deepEqual(ring, SHELF, 'the ring must equal bookOrderFor exactly');
    assert.notDeepEqual(ring, VOLUME, 'and the two orders differ, or this proves nothing');
  });

  it('with no edition named, the ring keeps volume order rather than guessing', () => {
    const ring = buildBibleBookCousinChain(manifest, { names: {} })
      .items.filter(Boolean).map(i => i.id);
    assert.deepEqual(ring, VOLUME);
  });
});

// H-25/FN-4: an edition is FINISHED when its per-unit marks cover everything
// the volume enumerates — derived, never declared twice.
//
// Howell found this at the testament ring: the Hebrew had reached 39 of 39
// confirmed while its edition-level `proofread` flag was still false, so the
// data asserted both "nothing is unconfirmed" and "not proofread", and the
// mark believed the wrong one. Flipping the flag in the data fixes the symptom
// and keeps the same fact in two places — where the second one is updated by a
// separate act nobody is reminded to perform. This bug IS that omission,
// arriving the first time it was possible.
describe('an edition is finished when its marks cover the volume (FN-4)', () => {
  const volumeWith = (units, ed) => ({
    units: units.map(id => ({ id })),
    editions: [ed]
  });

  it('every unit confirmed means finished, even with proofread:false', () => {
    const v = volumeWith(['A', 'B'], { code: 'E', proofread: false, proofreadUnits: ['A', 'B'] });
    assert.equal(isEditionFullyConfirmed(v, 'E'), true,
      'the marks cover the volume — the stale flag does not get to say otherwise');
  });

  it('one unit short is NOT finished', () => {
    const v = volumeWith(['A', 'B'], { code: 'E', proofread: false, proofreadUnits: ['A'] });
    assert.equal(isEditionFullyConfirmed(v, 'E'), false);
  });

  it('an edition with NO marks falls back to its declared flag', () => {
    const yes = volumeWith(['A'], { code: 'E', proofread: true });
    const no = volumeWith(['A'], { code: 'E', proofread: false });
    assert.equal(isEditionFullyConfirmed(yes, 'E'), true, 'unmarked editions still rely on the flag');
    assert.equal(isEditionFullyConfirmed(no, 'E'), false);
  });

  it('an empty marks list is not a finished edition', () => {
    const v = volumeWith(['A'], { code: 'E', proofread: false, proofreadUnits: [] });
    assert.equal(isEditionFullyConfirmed(v, 'E'), false, 'nothing confirmed is not everything confirmed');
  });
});

// W-239 (Howell, 2026-09-02): "KNOWN, CHECKED, and PROOFREAD it is." CHECKED —
// first, last and a middle verse of every book, by his eye — is what opens the
// shelf. The proofread list, once the record splits, holds chapters the pass
// has read, and a pass over some chapters puts nothing online.
describe('CHECKED opens the shelf; the pass does not (W-239)', () => {
  const bridgeOver = translations => createDimensionBridge({
    store: createInteractionStore(), translationsMeta: { translations }
  });

  it('an edition checked in every book is offered, with nothing yet proofread', () => {
    const b = bridgeOver({ E: { language: 'greek', hasChart: true, proofread: false, checked: true, proofreadUnits: [] } });
    assert.equal(b.isServableEdition('E'), true, 'checked is the gate');
  });

  it('a pass over some chapters does NOT open the shelf while a book is unchecked', () => {
    const b = bridgeOver({ E: { language: 'greek', hasChart: true, proofread: false, checked: false,
      proofreadUnits: ['bGEN/1', 'bGEN/2', 'bGEN/3'] } });
    assert.equal(b.isServableEdition('E'), false, 'three proofread chapters are not a checked edition');
  });

  it('the seam: with `checked` ABSENT the old one-unit rule still decides', () => {
    const b = bridgeOver({ E: { language: 'greek', hasChart: true, proofread: false, proofreadUnits: ['bGEN'] } });
    assert.equal(b.isServableEdition('E'), true, 'the corpus has not baked the field yet — yesterday\'s rule holds');
  });

  it('proofread:true and the override are still doors of their own', () => {
    const b = bridgeOver({ DONE: { language: 'greek', hasChart: true, proofread: true, checked: false, proofreadUnits: [] } });
    assert.equal(b.isServableEdition('DONE'), true);
  });

  it('checked without a chart is still refused', () => {
    const b = bridgeOver({ E: { language: 'greek', hasChart: false, proofread: false, checked: true } });
    assert.equal(b.isServableEdition('E'), false);
  });
});
