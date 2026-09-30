// Volume wiring: the ONE file where volume-specific literals live.
// Everything the host needs to know about a volume — its adapter, manifest
// path, theme, option parsing, label formatting, and chain building — is
// declared here; src/main.js stays volume-agnostic and is scanned by
// test/forbidden-literals.test.js (Phase B audit, H1/M5).
import { buildBibleVerseChain, buildBibleBookCousinChain } from './navigation/cousin-builder.js';
import { buildCalendarYears, buildCalendarMonthsCousinChain, buildBibleBooks, buildCatalogManufacturers, getBibleChapters, toTraditionNumeral, toDisplayCase } from './adapters/volume-helpers.js';
import { proofreadDeepLink } from './core/lan-gate.js';
import { recall } from './core/session-memory.js';
import { firstOfferedLanguage, phoneLanguages } from './core/tongue.js';
import { createAdapterRegistry, createAdapterLoader } from './adapters/registry.js';

import { catalogAdapter } from './adapters/catalog-adapter.js';
import { bibleAdapter, buildBibleRootChain } from './adapters/bible-adapter.js';
import { loadBibleVolume } from './adapters/bible-volume.js';
import { setUnitTextLoader } from './adapters/volume-helpers.js';

// WHERE THE BIBLE'S CARGO LIVES UNDER THE WALL (H-14), and since 2026-08-14
// that is the REAL corpus: the Hebrew, 39 books, verified 23,213 of 23,213
// against UXLC 2.5.
//
// The fixture served here from the day the wall went up until today. It was
// built to be deleted and this is the day — the reader now reads the thing
// itself, which is what H-22 needs before proofreading can start on Genesis.
//
// The data version rides the path (H-11 item 4), so a push changes a path
// rather than the world.
const BIBLE_VOLUME_BASE = './data/gutenberg';
const BIBLE_VOLUME_VERSION = '2026.08.22'; // leaf-and-shard (O-92/W-129)
import { calendarAdapter } from './adapters/calendar-adapter.js';

// `parseVerseId` lived here and is DELETED under O-47, not left for later.
//
// It split a remembered id (`GENE_1_1`) back into boot coordinates, and its
// pattern demanded an uppercase legacy book key — so under opaque ids it
// matched nothing and resume had been silently falling through since the wall
// went up. With resume suspended it has no caller at all.
//
// Keeping it "for when resume returns" would keep a parser that is wrong for
// the ids it would then meet: the coordinates it produces are the retired
// shape. When resume comes back at phase 4 it needs a reader of opaque ids,
// which is a different function wearing the same name — and the worst version
// of this is the old one still sitting here looking usable.
const adapterRegistry = createAdapterRegistry();
adapterRegistry.register('catalog', () => ({ ...catalogAdapter, volumeId: 'catalog' }));
adapterRegistry.register('bible', () => ({ ...bibleAdapter, volumeId: 'bible' }));
adapterRegistry.register('calendar', () => ({ ...calendarAdapter, volumeId: 'calendar' }));
const adapterLoader = createAdapterLoader(adapterRegistry);

// Shared handler factory — the four volume blocks used to carry identical
// copies of this closure (Phase B audit, M5).
function makeAdapterHandlers(volumeId) {
  return params => {
    const adapter = adapterLoader.load(volumeId);
    return adapter?.createHandlers ? adapter.createHandlers(params) : { parentHandler: () => false, childrenHandler: () => false, layoutBindings: {} };
  };
}

const DEFAULT_VOLUME = 'catalog';
const volumeConfigs = {
  bible: {
    // The formatter answers a 'caption' context — the level's word beside the
    // lens (O-144). A volume whose formatter does not declare this is never
    // asked, since an unknown context answers the item's own name.
    levelCaptions: true,
    id: 'bible',
    paths: ['/bible'],
    // THE BIBLE IS BEHIND THE WALL (H-14, 2026-08-12). It no longer reads
    // `data/gutenberg/manifest.json` or `translations.json` — the engine has
    // no path to either, which is the capability the ruling removes. It boots
    // from the H-11 enumeration instead, and `loadManifest` is how a volume
    // behind its own wall says so.
    //
    // The other three volumes keep their manifests and their reader until
    // each raises its own wall at its own doctrine migration. That is what
    // makes the scope per-volume rather than a flag day.
    manifestPath: BIBLE_VOLUME_BASE,
    // THE IMAGES ARE CARGO'S (W-114, Howell 2026-08-19): *"It should be on the
    // Cargo side. It is cargo. The engine is agnostic. A crown of thorns is
    // not agnostic in the least."*
    //
    // `display_config.detail_sector.logo_base_path` still reads `assets/` and
    // the STRING does not change. What changes is what it resolves AGAINST:
    // the volume's own data root rather than the app root. So the emblem is
    // version-pinned like every other artifact beside it — immutable and
    // cacheable forever at its data-version URL — and the engine ships no
    // picture that asserts anything about a corpus.
    assetBase: `${BIBLE_VOLUME_BASE}/${BIBLE_VOLUME_VERSION}/`,
    loadManifest: async () => {
      // WHICH EDITION THE BOOT WAITS FOR (O-175): the one the reader chose
      // last time; failing that, on a proofread deep link, the one the address
      // names; failing that, the one the phone's own languages point to
      // (O-176); failing that, the volume's default. The same order the boot
      // itself settles on below, so the edition shown is the edition waited
      // for. Everything else is fetched behind it.
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const named = proofreadDeepLink(['book', 'chapter', 'verse']) ? params.get('edition') : null;
      const chooseFirst = volumeJson => {
        const cfg = volumeJson?.display_config || {};
        const offered = new Set((volumeJson?.editions || []).map(e => e.code));
        const remembered = recall('bible').edition;
        if (remembered && offered.has(remembered)) return remembered;
        if (named && offered.has(named)) return named;
        const lang = firstOfferedLanguage(phoneLanguages(), Object.keys(cfg.editions?.available || {}));
        const byTongue = lang ? cfg.editions?.default?.[lang] : null;
        if (byTongue && offered.has(byTongue)) return byTongue;
        const dflt = cfg.editions?.default?.[cfg.languages?.default];
        return dflt && offered.has(dflt) ? dflt : null;
      };
      const volume = await loadBibleVolume({
        base: BIBLE_VOLUME_BASE,
        version: BIBLE_VOLUME_VERSION,
        firstEdition: chooseFirst,
        // The manifest, the moment it is parsed and before the bundles are
        // waited for — the boot card listens (O-181).
        onVolume: v => { try { document.dispatchEvent(new CustomEvent('wheel:volume-early', { detail: v })); } catch { /* no DOM */ } },
        fetchJson: async path => {
          const response = await fetch(path);
          if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
          return response.json();
        }
      });
      // THE TEXT ARRIVES ONE UNIT AT A TIME (O-52). This seeded every unit
      // here, which was right for a one-book fixture and wrong the moment the
      // volume became 39 books: 1,413 KB gzipped before the first frame, all
      // but one book of it unread.
      //
      // Registering the loader keeps the dependency pointing the way the
      // layering does — the host's cache machinery is volume-agnostic and asks
      // the volume, rather than importing its way across.
      setUnitTextLoader(unitId => volume.loadTextFor(unitId));
      // The wall volume rides along so the builders can reach charts, spines
      // and text without a second load. It is not a manifest wearing a new
      // name: `toRoot()` brings back nothing H-14 retired, and the suite
      // asserts that rather than trusting the comment.
      //
      // IT RIDES NON-ENUMERABLY, and that is not fastidiousness — it is a
      // defect Howell's phone found. `index.js` decides whether a manifest
      // needs unwrapping by COUNTING ITS KEYS: exactly one means "this is a
      // wrapper, take what is inside". Adding a plain sibling key made the
      // count two, so it stopped unwrapping, `display_config` came back
      // undefined, and the volume logo and the colour scheme disappeared
      // together — they are read from adjacent lines.
      //
      // Non-enumerable says what is true: this is a handle for the builders,
      // not part of the manifest's content. Nothing that walks, counts or
      // serialises the manifest can see it.
      // THE ROOT IS PER EDITION (H-29), and this call cannot know which one:
      // the manifest loads before the reader's choice is committed. So it
      // builds the SCAFFOLD from the first declared edition, and every ring
      // that shows divisions asks the volume live with the edition in hand.
      // Nothing downstream reads a division off this tree.
      const manifest = { Gutenberg_Bible: volume.toRoot() };
      Object.defineProperty(manifest, '__wallVolume', { value: volume, enumerable: false });
      return manifest;
    },
    theme: 'bible',
    palette: {
      bg: '#d4a574',
      // O-166's shades, declared (O-178): every node the lighter brown, the
      // band that brown one step darker.
      node: '#8a6a49',
      text: '#2a1a0f',
      band: '#6c5339',
      accent: '#8b5a2b',
      magnifierStroke: '#2a1a0f'
    },
    stampLetter: 'B', // the factory stamp's data line (W-7)
    extractRoot: manifest => manifest?.Gutenberg_Bible,
    // THE REGISTRY IS BEHIND THE WALL (H-14). `translations.json` was the
    // second pre-doctrine file the Bible read, and it carried two things the
    // engine still needs: which editions exist and are servable, and the
    // display names per language. Both now come from the volume itself —
    // `volume.json`'s `editions` array and `names/{lang}.json`.
    //
    // WHY THIS TAKES PARAMETERS NOW, stated because it costs something. The
    // early-start optimisation beside it depends on `loadSupplemental`
    // declaring none, so its fetches can begin before the manifest lands.
    // Under the wall this genuinely DEPENDS on the volume — the editions and
    // the languages are in it — so it declares that dependency and pays one
    // round trip for it. The arity test in `loadConfig` is exactly the promise
    // it was built to check, and it does the safe thing without being told.
    async loadSupplemental(root, manifest) {
      const volume = manifest?.__wallVolume;
      if (!volume) {
        throw new Error(
          '[wheel] the Bible booted without its wall volume. Under H-14 there is no legacy '
          + 'registry to fall back to — that capability is gone — so this is a boot failure '
          + 'rather than a degraded mode.');
      }

      // The registry shape the engine already speaks, populated from
      // doctrine-conformant cargo. `names.sections` is deliberately absent —
      // and under H-26 that sentence needs its correction rather than its
      // deletion. A section is still not a LEVEL and still has no node, so
      // nothing here names one. But sections are no longer nameless: H-26
      // gives them the tradition's own word, carried in the EDITION's shelf
      // chart as `groups[].label`, because the name belongs to the edition's
      // arrangement and not to a language's book table.
      // THE EDITION IS PASSED THROUGH WHOLE, NOT CHERRY-PICKED (O-54).
      //
      // This listed five fields by hand and so DROPPED the two the bridge also
      // reads: `nativeName`, which is why WLC still shows in Latin script, and
      // `vocabulary`. Neither is in the cargo today — which is exactly what
      // makes hand-listing dangerous, because the drop is invisible until the
      // data grows the field and nothing changes on screen.
      //
      // Howell would have had Wilbur add `nativeName` and seen no difference,
      // and we would both have gone looking in the wrong repository.
      //
      // Spreading first and normalising after means a field the data adds
      // tomorrow arrives without anyone remembering to notice. The
      // normalisations below are the ones with a DEFAULT the engine depends on;
      // everything else is the volume's word, carried intact.
      const translationsMeta = {
        // THE DECLARED SHELVES (O-184): per language, the edition ring's order
        // with placeholder names between the seated editions. The volume's
        // word; the `_` keys are its notes to itself.
        coming: Object.fromEntries(Object.entries(volume.displayConfig?.editions?.coming || {}).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v))),
        translations: Object.fromEntries(volume.editions.map(edition => [edition.code, {
          ...edition,
          name: edition.name || edition.code,
          language: edition.language || null,
          direction: edition.direction || 'ltr',
          hasChart: edition.hasChart === true,
          proofread: edition.proofread === true
        }])),
        names: Object.fromEntries(Object.entries(volume.namesByLanguage)
          .filter(([, names]) => names)
          .map(([lang, names]) => [lang, {
            // SPREAD FIRST, as the edition above is (O-54) — this listed four
            // fields by hand and DROPPED `vocabulary` the day the kits grew it
            // (O-144, 2026-09-16): the words were served and the caption
            // stayed empty, the invisible drop the note above warned of.
            ...names,
            // THE NAMES CARRY AN EDITION AXIS under leaf-and-shard (W-129):
            // books[editionCode][editionBookId]. Flattened here — and only
            // here — into one id→name map, which loses nothing because book
            // ids are minted per edition and globally unique, so every
            // downstream lookup (`namesMap.books[bookId]`) keeps its shape.
            books: flattenEditionAxis(names.books),
            testaments: names.testaments || {},
            book_abbreviations: flattenEditionAxis(names.book_abbreviations),
            title: names.title || null
          }]))
      };

      // THE SECONDARY STRATUM SPEAKS ITS OWN TONGUE (O-54, Howell's phone
      // 2026-08-14: "HEBREW ... should be in Hebrew").
      //
      // I returned `languagesMeta: null` at the repoint, which left the
      // language ring with no autonym to show and falling through to the id —
      // so the reader met the English word HEBREW where עברית belongs. The
      // volume declares it: `display_config.languages.labels`.
      //
      // Shaped into the `{ languages: [{ id, autonym }] }` the bridge already
      // reads, rather than teaching the bridge a second shape. A label is a
      // QUOTATION (H-2): every autonym here is the volume's own word, and a
      // language the volume does not name gets no invented one.
      const langCfg = root?.display_config?.languages || {};
      const languagesMeta = {
        languages: (langCfg.available || [])
          .filter(id => langCfg.labels?.[id])
          .map(id => ({ id, autonym: langCfg.labels[id] }))
      };
      return { translationsMeta, languagesMeta };
    },
    buildOptions: ({ params, startup = {}, arrangements = {}, root = null, memory = null }) => {
      // The parameters that together name one exact seat in THIS volume — the
      // proofreading bypass's key list (O-122). Named here because the engine
      // core may not speak a volume's level names (O-43).
      const POSITION_KEYS = ['book', 'chapter', 'verse'];
      const level = params.get('level') || startup.top_navigation_level || 'verse';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-with-gaps';
      const cousinParam = params.get('cousins');
      const cousinMode = cousinParam === null ? arrangement !== 'siblings-only' : cousinParam === '1';
      // WHERE THE VOLUME OPENS (O-179, Howell 2026-09-29), three answers in
      // order. An EXPLICIT deep link wins wholesale — if any of
      // book/chapter/verse is named in the URL it is honoured, because that is
      // the reader asking rather than the engine remembering, and it is how
      // the volume is tested from a phone. Then THE VERSE LAST READ (ruling 3
      // of 2026-07-30, back in force): the seat main.js remembers on every
      // landing, an id in the edition's own labels. Then THE FIRST VISIT'S
      // VERSE, which the volume declares by utterance — Matthew 16:18 where
      // the edition holds the New Testament, the psalm where it does not —
      // resolved in buildBibleChain where the charts are in hand, because the
      // same line wears a different number in each edition. O-47's
      // development boot to the first verse (Genesis 1:1) is retired; it
      // survives only as the last fallback, for a volume that declares no
      // first visit.
      //
      // The remembered seat is consulted here and nowhere else: `parseSeatId`
      // reads the id the chain itself mints (`<book>_<chapter>_<verse>`), so
      // it cannot fall out of step with the chain the way the legacy parser
      // O-47 removed once did.
      const deepLinked = params.get('book') || params.get('chapter') || params.get('verse');
      const resumed = deepLinked ? null : parseSeatId(memory?.itemId);
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        firstVisit: (root?.display_config?.boot?.first_visit || []).map(e => e?.utterance).filter(Boolean),
        bookId: params.get('book') || resumed?.bookId || null,
        testamentId: params.get('testament'),
        chapterId: params.get('chapter') || resumed?.chapterId || null,
        verseId: params.get('verse') || resumed?.verseId || null,
        // The committed edition comes from the volume's own declaration, not
        // from a literal: under the wall the Vulgate is not enumerated, and
        // naming it here would pin the reader to an edition that does not
        // exist. Language default first, then the single offered edition.
        translation: (() => {
          // NAMED OUTRIGHT ON A PROOFREAD DEEP LINK (O-122). The driver used
          // to boot into the volume's default tongue and then commit the
          // edition through the dimension bridge, waiting on the shelf to
          // stock — seconds per verse, forty times an hour. Under the LAN
          // override the address may simply say which edition it wants.
          // Gated by `proofreadDeepLink`, so a public URL naming an edition
          // is ignored exactly as before.
          const named = params.get('edition');
          if (named && proofreadDeepLink(POSITION_KEYS)) return named;
          const editions = root?.display_config?.editions || {};
          const language = root?.display_config?.languages?.default;
          return editions.default?.[language]
            || Object.values(editions.default || {})[0]
            || null;
        })(),
        cousinMode,
        locale: params.get('lang') || null,
        // The host skips the boot funnel on this, and asks no volume
        // vocabulary to learn that it should (O-122).
        deepLinked: proofreadDeepLink(POSITION_KEYS)
      };
    },
    formatLabel: ({ level, locale, namesMap }) => makeBibleLabelFormatter({ level, locale, namesMap }),
    // NO ASTERISKS, all the way down (Howell 2026-07-30). The rings and the
    // pyramid are built from the manifest, which is edition-agnostic — so the
    // volume displayed its whole skeleton (testaments, 67 books, 1215
    // chapters) even with nothing certified to read. The structure the reader
    // sees must be what the OFFERED editions actually contain.
    //
    // Today only the ZERO case is answerable: the union of no editions is
    // empty, so the volume shows nothing at any level. Partial pruning — the
    // Esperanto case, where a Genesis-only edition should show one book and
    // two chapters — needs the per-edition coverage index (HANDOFF O-16);
    // this is the seam it will fill.
    // PRUNING MUST REACH THE VOLUME, NOT ONLY THE ROOT (H-14).
    //
    // This emptied `testaments` and trusted every builder to read the root.
    // Under the wall the verse chain reads the wall volume directly, so it
    // walked straight past the prune: with NO servable edition the reader
    // would still have been shown the text. The honesty gate was inert and
    // nothing said so — the same defect the servable ruling exists to prevent,
    // wearing the wall's clothes.
    //
    // Found because a non-enumerable handle stopped surviving the spread
    // below, which turned an invisible bypass into a visible empty. Fixing it
    // by relying on that spread would have left the gate depending on an
    // accident of property descriptors, so the withdrawal is now explicit:
    // nothing offered means the volume itself is withheld, and every builder
    // gets the same answer because there is only one answer to get.
    pruneToOffered: (manifest, offeredEditions) => {
      if (offeredEditions.length) return manifest;
      const root = manifest?.Gutenberg_Bible;
      if (!root) return manifest;
      return { Gutenberg_Bible: { ...root, testaments: {} } };
    },
    buildChain: (manifest, options, namesMap) => buildBibleChain(manifest, options, namesMap),
    createHandlers: makeAdapterHandlers('bible')
  },
  catalog: {
    id: 'catalog',
    paths: ['/catalog'],
    manifestPath: './data/mmdm/catalog-lite.json',
    // W-114 again, and the catalogue has no data VERSION to pin to — its
    // artifacts sit at the volume root. Same rule, one fewer segment.
    assetBase: './data/mmdm/',
    // Shown by other volumes' top-ring OUT button as the place a gateway
    // return lands (Howell ruling 2026-07-17).
    gatewayReturnLabel: 'MMdM CATALOGO',
    theme: 'catalog',
    palette: {
      bg: '#868686',
      node: '#f1b800',
      text: '#000000',
      band: '#7a7979',
      accent: '#f1b800',
      magnifierStroke: '#000000'
    },
    stampLetter: 'M', // the factory stamp's data line (W-7)
    // The "instrument arrives" line-drawing reveal (C.4) plays HERE only —
    // the Bible boots into its strata funnel instead and wants a reveal of
    // its own before it opts back in (Howell 2026-07-30).
    bootSplash: true,
    extractRoot: manifest => manifest?.MMdM,
    async loadSupplemental() { return { translationsMeta: null }; },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      const level = params.get('level') || startup.top_navigation_level || 'manufacturer';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-flat';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        // The boot reveal's overture (data-declared): the item the splash
        // DRAWS at before its rotation beat glides the ring home to
        // initialItemId. Volumes without the key boot the classic reveal.
        splashOvertureItem: startup.splash_overture_item || null,
        locale: params.get('lang') || null,
        cousinMode: arrangement !== 'siblings-only'
      };
    },
    formatLabel: () => ({ item, context }) => {
      if (!item) return '';
      const name = item.name || item.id || '';
      // Cylinder items: number only in nodes, "N CIL" in magnifier
      if (item.level === 'cylinder' || (item.id && (item.id.startsWith('cyl:') || item.id.startsWith('cylinder:')))) {
        const num = name.replace(/[^0-9]/g, '') || name;
        return context === 'magnifier' ? `${num} CIL` : num;
      }
      return name;
    },
    buildChain: (manifest, options) => buildCatalogManufacturers(manifest, { initialItemId: options.initialItemId, dataStampLetters: ['M', 'B', 'C'] }),
    createHandlers: makeAdapterHandlers('catalog'),
    // Search (the navigator's dividers) exists only here: this volume's
    // model namespace is flat and arbitrary — the index beats the walk.
    // Structured volumes (scripture's ordered books, the calendar's dates)
    // are already optimally served by the wheel itself (Howell 2026-07-22).
    hasSearch: true
  },
  calendar: {
    id: 'calendar',
    paths: ['/calendar'],
    manifestPath: './data/calendar/manifest.json',
    theme: 'calendar',
    palette: {
      bg: '#0c2c44',
      node: '#443300',
      text: '#f5f7fb',
      band: '#194567',
      accent: '#f5f7fb',
      magnifierStroke: '#f5f7fb'
    },
    centerLabel: true,
    stampLetter: 'C', // the factory stamp's data line (W-7)
    extractRoot: manifest => manifest?.Calendar,
    async loadSupplemental() { return { translationsMeta: null }; },
    buildOptions: ({ params, startup = {}, arrangements = {} }) => {
      // Default entry is the MONTHS ring on the current month (Howell
      // 2026-07-19) — gateway transits arrive with level=root, which is
      // "the volume's front door", not a level request. ?level=year still
      // boots the years ring explicitly. The manifest's
      // top_navigation_level states what the TOP of the hierarchy is
      // (years) — it does not pick the front door, so it is deliberately
      // not consulted here.
      const rawLevel = params.get('level');
      const level = (rawLevel && rawLevel !== 'root') ? rawLevel : 'month';
      const arrangement = params.get('arrangement') || arrangements[level] || startup.arrangement || 'cousins-with-gaps';
      const cousinParam = params.get('cousins');
      const cousinMode = cousinParam === null ? arrangement !== 'siblings-only' : cousinParam === '1';
      return {
        level,
        arrangement,
        initialItemId: params.get('item') || startup.initial_magnified_item || null,
        locale: params.get('lang') || null,
        cousinMode
      };
    },
    formatLabel: ({ locale }) => makeCalendarLabelFormatter({ locale }),
    // A calendar must see the future — and it boots on today, not on a
    // hardcoded date that goes stale. Default entry: the months ring with
    // the CURRENT month magnified; ?level=year gives the years ring.
    buildChain: (manifest, options) => {
      if (options.level === 'year') {
        return buildCalendarYears(manifest, {
          arrangement: options.arrangement,
          initialItemId: options.initialItemId || String(new Date().getFullYear())
        });
      }
      const now = new Date();
      const monthEntries = Object.entries(manifest?.Calendar?.month_template || {})
        .sort((a, b) => (a[1]?.month_number || 0) - (b[1]?.month_number || 0));
      const monthKey = monthEntries[now.getMonth()]?.[0];
      return buildCalendarMonthsCousinChain(manifest, {
        initialItemId: options.initialItemId || `${now.getFullYear()}:${monthKey}`
      });
    },
    createHandlers: makeAdapterHandlers('calendar')
  },
};

function makeBibleLabelFormatter({ level, locale, namesMap }) {
  // THE ENGINE HOLDS NO HUMAN LANGUAGE (Howell ruled 2026-07-28; finished
  // 2026-07-30). A nine-language VOCAB table lived here — the words for
  // "chapter" and "verse" and the era marks — so every tongue imported beyond
  // those nine silently fell out onto English ("Chapter 3" under a German
  // shelf). Wilbur's registry now carries `vocabulary` per language, and it is
  // the ONLY source: a new language is spoken correctly the moment its data
  // lands, with no engine patch behind it.
  //
  // LIVE locale (W-16): the names table carries the reader's current language,
  // so the vocabulary and the numeral system below follow a language switch
  // instead of freezing at the boot value.
  const loc = () => namesMap?.locale || locale;
  // No word, no substitute — NEVER another language's. A tongue whose registry
  // entry lacks a word simply shows the bare numeral, which is the form Howell
  // already ruled sufficient (2026-07-20: chapters are Roman, verses Arabic,
  // "the numeral system itself says which is which, so neither wears a word").
  // Honest, language-neutral, and it cannot leak English into a German shelf.
  // CASING IS OWNED HERE, NOT BY CSS (2026-08-02). A blanket
  // `text-transform: uppercase` on the ring re-uppercased every native script
  // — the strata ring hit this first (Русский → РУССКИЙ) and moved its casing
  // into JS; the focus ring carried the same rule and the same bug, visible
  // the moment the volume spoke Greek: Κεφάλαιον came out ΚΕΦΆΛΑΙΟΝ, wearing
  // an accent that Greek uppercase drops.
  //
  // The line is NAMES AND WORDS SHOUT, ADDRESSES NEVER CHANGE. A vocabulary
  // word is cased (Latin CAPITULUM, Greek Κεφάλαιον left alone); a numeral or
  // an edition's own verse address is passed through untouched, so a
  // sub-verse stays "30b" and never becomes "30B".
  const t = key => toDisplayCase(namesMap?.vocabulary?.[key] ?? '');

  // ── Numeral converters ───────────────────────────────────────────────────────
  // THE TRADITION'S OWN LETTERS — chapters only (Howell 2026-08-02).
  //
  // The rule was written on 2026-07-20 as "chapters are Roman, verses are
  // Arabic", and read as a Latin habit because Latin was the only tradition
  // on the shelf. It never was: Roman numerals ARE Latin's letter-numerals,
  // and Arabic digits are the tradition-neutral set. So the rule generalizes
  // without losing anything — CHAPTERS WEAR THE TRADITION'S OWN LETTERS,
  // VERSES WEAR THE UNIVERSAL DIGITS. Latin XVII / 17, Greek ιζʹ / 17,
  // Hebrew י״ז / 17.
  //
  // What that buys: the child pyramid still tells a chapter from a verse at
  // a glance — letters against digits — while a Greek Bible stops numbering
  // its chapters in a Latin hand. Neither wears a WORD, so the "no
  // Capitulum" ruling stands. A tongue with no letter-numerals of its own
  // simply shows digits, which is honest rather than borrowed.
  const traditionNumeral = n => toTraditionNumeral(n, loc());

  const getYearNumber = item => {
    if (Number.isFinite(item?.yearNumber)) return item.yearNumber;
    const parsed = Number.parseInt(item?.id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const formatChapter = ({ item, context }) => {
    const chapterVal = item?.chapter ?? (() => {
      const asNumber = Number.parseInt(item?.name, 10);
      if (Number.isFinite(asNumber)) return asNumber;
      return item?.name;
    })();
    const n = Number(chapterVal);
    const numStr = Number.isFinite(n) ? traditionNumeral(n) : String(chapterVal ?? item?.id ?? '');
    // THE WORD IS A CAPTION BESIDE THE LENS, NEVER PART OF ITS LABEL (O-144):
    // the merge flights and the bookmark labels read the lens's text as the
    // bare numeral and must keep doing so. 'caption' answers the level's word
    // in the reader's tongue, or nothing when the kit has none.
    if (context === 'caption') return t('chapter');
    return numStr;
  };
  const formatVerse = ({ item, context }) => {
    const extract = () => {
      if (item?.verse !== undefined) return item.verse;
      if (typeof item?.name === 'string' && item.name.includes(':')) {
        const parts = item.name.split(':');
        return parts[parts.length - 1];
      }
      return item?.name;
    };
    const verseVal = extract();
    // VERSES ARE ARABIC IN EVERY TONGUE — the universal digits, against the
    // tradition's letters on the chapter. This is the discriminator the
    // pyramid reads, and it must not vary by language or it stops
    // discriminating. A non-numeric label (a sub-verse like "30b", an
    // edition's own lettered address) passes through untouched.
    const numStr = String(verseVal ?? item?.id ?? '');
    if (context === 'caption') return t('verse');
    return numStr;
  };
  return ({ item, context }) => {
    if (!item) return '';
    // Read the table INSIDE the closure (W-16): hoisting this out captured
    // the boot language's books and no live update could reach it.
    const bookNames = namesMap?.books || namesMap;
    const yearNumber = getYearNumber(item);
    if (Number.isFinite(yearNumber)) {
      if (context === 'node') return String(Math.abs(yearNumber));
      const era = yearNumber < 0 ? t('bc') : t('ad');
      return `${Math.abs(yearNumber)} ${era}`;
    }
    // Route by item.level first so the formatter works correctly when the focus
    // ring transitions between book → chapter → verse levels at runtime.
    const itemLevel = item?.level || level;
    // THE CAPTION IS A LEVEL'S WORD OR NOTHING (O-144). Only the two levels
    // that have one answer it; a book, a testament or the door answers an
    // empty caption — never its own name, which the lens already wears.
    if (context === 'caption') {
      if (itemLevel === 'chapter') return t('chapter');
      if (itemLevel === 'verse') return t('verse');
      return '';
    }
    // THE DOOR'S NAME follows the reader live (W-27): the root item's baked
    // name is only the boot value; the live table wins at render, so switching
    // to Hebrew in the funnel retitles the door to כתבי הקודש with no rebuild.
    if (itemLevel === 'bibleRoot') return toDisplayCase(namesMap?.title || item.name || item.id || '');
    if (itemLevel === 'chapter') return formatChapter({ item, context });
    if (itemLevel === 'verse') return formatVerse({ item, context });
    // THE PYRAMID'S SHORT FORMS ARE WORN AS THE KIT WRITES THEM (W-256,
    // Howell 2026-09-05). The child pyramid renames a book to its
    // abbreviation and flags it; re-localizing it by id here put the full
    // name straight back, so the sky read ΣΟΦΙΑ ΣΑΛΩΜΩΝΟΣ where it should
    // read Σοφ Σαλ. The abbreviation is not passed through toDisplayCase:
    // Γέν, not ΓΕΝ — the kit's own form, on the same ruling that caps the ring.
    if (item?.abbreviated && item.name) return item.name;
    const localizedBook = bookNames?.[item.id];
    return toDisplayCase(localizedBook || item.name || item.id || '');
  };
}

function makeCalendarLabelFormatter({ locale }) {
  // Era rule (Howell, 2026-07-17): AD years are bare numbers everywhere —
  // "most people refer to any AD year simply by its number". The BC suffix
  // appears only across the line, making the era crossing legible at any
  // scrub speed.
  const translations = { english: { bc: 'BC' } };
  const t = key => translations[locale]?.[key] || translations.english[key] || key;
  const getYearNumber = item => {
    if (Number.isFinite(item?.yearNumber)) return item.yearNumber;
    const parsed = Number.parseInt(item?.id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const formatYear = yearNumber => (
    yearNumber < 0 ? `${Math.abs(yearNumber)} ${t('bc')}` : String(yearNumber)
  );
  return ({ item, context }) => {
    if (!item) return '';
    // Month items: nodes carry the month name alone; the magnifier appends
    // the year — on the continuous months chain every January looks alike.
    if (item.level === 'month') {
      const name = item?.name || item?.id || '';
      const y = Number.isFinite(item?.yearNumber) ? item.yearNumber : Number.parseInt(item?.parentId, 10);
      if (context === 'magnifier' && Number.isFinite(y)) return `${name} ${formatYear(y)}`;
      return name;
    }
    // Only year items get era formatting — composed ids ("2026:jan") would
    // otherwise fool the parseInt fallback.
    if (item.level && item.level !== 'year') return item?.name || item?.id || '';
    const yearNumber = getYearNumber(item);
    if (!Number.isFinite(yearNumber)) return item?.name || item?.id || '';
    return formatYear(yearNumber);
  };
}

function makeLabelFormatter({ config, volume, level, locale, namesMap, options, manifest, meta }) {
  const factory = config?.formatLabel || (() => ({ item }) => item?.name || item?.id || '');
  return factory({ volume, level, locale, namesMap, options, manifest, meta });
}

// THE VOLUME'S OWN FIRST LEAF (H-14) — where a first visit opens now.
//
// Under the wall there is no literal that can name a starting place: the
// corpus is whatever `volume.json` enumerates, and it grows one increment at
// a time. So the start is DERIVED — the first enumerated book, its first
// projected container, that container's first seat — and it resolves to
// something real by construction however much or little has landed.
//
// It reads the enumeration, never the ids: an opaque id carries no order in
// its characters, and `volume.json` states the order as data.
// Collapse {editionCode: {bookId: name}} to {bookId: name}; a legacy flat
// map passes through untouched (fixtures, other volumes).
function flattenEditionAxis(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const values = Object.values(obj);
  if (!values.length || values.some(v => typeof v !== 'object' || v === null)) return obj;
  return Object.assign({}, ...values);
}

// A SEAT ID, READ BACK (O-179). The chain mints `<bookId>_<chapter>_<verse>`
// for every seat (bible-volume's expandVolumeSeats); book ids carry no
// underscore, so the first cut is the book and the last the verse, and a
// chapter label is whatever lies between. Anything else is not a seat.
export function parseSeatId(id) {
  if (typeof id !== 'string') return null;
  const a = id.indexOf('_'), b = id.lastIndexOf('_');
  if (a <= 0 || b <= a + 1 || b === id.length - 1) return null;
  return { bookId: id.slice(0, a), chapterId: id.slice(a + 1, b), verseId: id.slice(b + 1) };
}

// THE SEAT AN UTTERANCE HOLDS IN AN EDITION (O-179): walk the edition's own
// books and charts for the seat carrying it, and name that seat in the
// edition's own labels. Null when the edition does not seat it — the Hebrew
// has no Matthew — and the caller tries the next.
export function seatOfUtterance(volume, edition, utterance) {
  if (!volume || !utterance || typeof volume.booksFor !== 'function' || typeof volume.chartFor !== 'function') return null;
  for (const book of volume.booksFor(edition) || []) {
    const chart = volume.chartFor(book.id, edition);
    const seats = chart?.seats || [];
    const idx = seats.findIndex(seat => Array.isArray(seat?.utterances) && seat.utterances.includes(utterance));
    if (idx < 0) continue;
    const group = (chart.groups || []).find(g => idx >= g.from - 1 && idx <= g.to - 1);
    if (!group) return null;
    return { bookId: book.id, testamentId: book.testamentId, chapterId: String(group.label), verseId: String(seats[idx].label) };
  }
  return null;
}

// THE FIRST VISIT'S VERSE (O-179): the first declared utterance this edition
// seats — Matthew 16:18 for an edition holding the New Testament, the psalm
// for one that does not. Null when the volume declares none.
export function firstVisitSeat(manifest, edition, utterances) {
  const volume = manifest?.__wallVolume;
  for (const u of utterances || []) {
    const seat = seatOfUtterance(volume, edition, u);
    if (seat) return seat;
  }
  return null;
}

function firstLeafOf(manifest, edition) {
  const volume = manifest?.__wallVolume;
  // The first book is the EDITION'S first (O-92) — there is no volume book
  // list, and the boot position belongs to what the reader will actually see.
  const unit = typeof volume?.booksFor === 'function'
    ? volume.booksFor(edition)[0]
    : volume?.units?.[0];
  if (!unit) return {};
  const chart = volume.chartFor?.(unit.id, edition);
  const container = chart?.groups?.[0];
  const firstSeat = chart?.seats?.[0];
  return {
    bookId: unit.id,
    testamentId: unit.testamentId,
    chapterId: container ? String(container.label) : null,
    verseId: firstSeat ? String(firstSeat.label) : null
  };
}

function buildBibleChain(manifest, options, namesMap) {
  // Gateway entry: BIBLIA SACRA LATINA alone on the ring, testaments in the pyramid.
  if (options.level === 'root') return buildBibleRootChain(namesMap);
  // Anything the URL or the reader's memory did not supply comes from the
  // volume itself, resolved here because this is where the enumeration is in
  // hand. A null that reached the builders below would paint a blank screen.
  // The first visit's verse where the volume declares one (O-179); the
  // edition's first leaf where it does not.
  const edition = options.activeEdition || options.translation || null;
  const firstVisit = firstVisitSeat(manifest, edition, options.firstVisit);
  const fallback = firstVisit || firstLeafOf(manifest, edition);
  options = {
    ...options,
    bookId: options.bookId || fallback.bookId,
    testamentId: options.testamentId || fallback.testamentId,
    chapterId: options.chapterId || fallback.chapterId,
    verseId: options.verseId || fallback.verseId
  };
  const arrangement = options.arrangement;
  const initialItemId = options.initialItemId;
  if (options.cousinMode && (arrangement || 'cousins-with-gaps') !== 'siblings-only') {
    const level = options.level || 'book';
    if (level === 'chapter') {
      const bookId = options.bookId;
      const chapterItems = getBibleChapters(manifest, { id: bookId }, namesMap, 'book',
        options.activeEdition || options.translation || null);
      const targetKey = options.chapterId || '16';
      let chapterSelected = chapterItems.findIndex(ch => ch.meta?.chapterKey === targetKey);
      if (chapterSelected < 0) chapterSelected = 0;
      return { items: chapterItems, selectedIndex: chapterSelected, preserveOrder: true };
    }
    if (level === 'verse') {
      // THE WHOLE VOLUME RIDES THE RING FROM THE FIRST FRAME (2026-07-30).
      // Boot used to build its own verse ring with buildBibleVerseCousinChain,
      // which walked ONE book from the entry chapter to that book's end — so a
      // reader who booted at Matthew 16:18 could rotate no earlier than
      // Matthew 16:1 and no later than Matthew 28:20. Everything before the
      // current chapter and after the current book was unreachable until they
      // backed out and descended again, which silently rebuilt the ring with
      // the continuous chain. Now boot uses that same continuous chain, so the
      // ring is Genesis to Apocalypse from the start.
      // Two things fall out: it is SYNCHRONOUS (the old builder fetched every
      // chapter from the entry point to the end of the book before the first
      // paint — thirteen files to open at Matthew 16), and it bakes no verse
      // text, retiring the last site of the stale-language bug class (W-6).
      // Verse text arrives from the chapter cache and repaints on landing.
      const bookId = options.bookId;
      const chapterId = options.chapterId || '16';
      const verseId = options.verseId || '1';
      // THE SEATING CHART (E1 of W-21): the chain's membership is the
      // committed edition's own. buildChain is awaited at launch, so the
      // chart fetch rides here — present or definitively absent before the
      // first frame; absent means identity fallback (today's behaviour).
      // The COMMITTED edition, not the volume's pinned default: `translation`
      // is the config's fallback (VUL), while `activeEdition` is what the
      // reader actually chose at the funnel or carried in from a previous
      // launch. Reading the default here meant a Greek reader was seated by
      // a Latin chart — caught before it reached the bench.
      return Promise.resolve().then(() =>
        buildBibleVerseChain(manifest, {
          initialVerseId: `${bookId}_${chapterId}_${verseId}`,
          // A remembered seat this edition no longer charts (the reader's
          // edition changed under it) lands on the first visit's verse,
          // never silently on the first verse (O-179).
          fallbackVerseId: firstVisit ? `${firstVisit.bookId}_${firstVisit.chapterId}_${firstVisit.verseId}` : null,
          edition: options.activeEdition || options.translation || null
        }));
    }
    const chain = buildBibleBookCousinChain(manifest, {
      testamentId: options.testamentId,
      bookId: options.bookId,
      initialItemId,
      names: namesMap,
      edition: options.activeEdition || options.translation || null
    });
    if (namesMap && typeof namesMap === 'object') {
      const bookNames = namesMap.books || namesMap;
      chain.items = chain.items.map(item => item ? { ...item, name: bookNames[item.id] || item.name } : item);
    }
    return chain;
  }
  const items = buildBibleBooks(manifest, namesMap)
    .sort((a, b) => {
      const as = a.sort || 0;
      const bs = b.sort || 0;
      if (as === bs) return (a.name || '').localeCompare(b.name || '');
      return as - bs;
    })
    .map((item, idx) => ({ ...item, order: idx }));
  const selectedIndex = (() => {
    if (initialItemId) {
      const idx = items.findIndex(item => item && (item.id === initialItemId));
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  return { items, selectedIndex, preserveOrder: false };
}


// The probe's drop box (telemetry.php on the production host). Deployment
// layout is a literal like any other — it lives here, not in diagnostics.
const PROBE_SINK = {
  relative: '/mmdm/telemetry.php',
  absolute: 'https://howellgibbens.com/mmdm/telemetry.php',
  lan: '/probe-drop' // the LAN dev server writes these to files (2026-07-27)
};

export { adapterLoader, volumeConfigs, DEFAULT_VOLUME, makeLabelFormatter, PROBE_SINK };

// THE THREE VENUES (O-136, O-137, Howell 2026-09-15): the catalog at the root
// of mmdm.it, with its Gutenberg gateway, is the ARCHIVAL BACKUP and is not
// synced again; the wheel-v3 directory on the same server is THE SCREENING
// ROOM, for friends and family — the LAN bench reached over the internet,
// serving the same tree; and bibliacatholica.com is LEICESTER SQUARE, for
// strangers, under the CHECKED gate. This is the one file that may name a
// site (H1); main.js declares it to lan-gate.
export const VENUES = {
  screeningRoom: { hosts: ['mmdm.it', 'www.mmdm.it'], pathPrefix: '/wheel-v3/' }
};
