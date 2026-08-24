import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildBibleTestaments, getBibleChapters, getBibleVerseItems, getBibleVerseCacheStatus, prefetchBibleVerses, getVerseTextResolved, getVerseTextForSeat, toTraditionNumeral, toDisplayCase, bookIdOf } from './volume-helpers.js';
import { buildBibleVerseChain, buildBibleChapterChain } from '../navigation/cousin-builder.js';
import { buildUtteranceSeatIndex } from '../navigation/seating-chart.js';
import { buildBibleBookCousinChain } from '../navigation/cousin-builder.js';
import { buildBiblePyramid } from '../pyramid/volume-pyramid.js';
import { volumeHoldsUnit, editionSeatsUtterance, bookSeatingUtterance } from './bible-volume.js';

// THE ADAPTER NO LONGER LOADS CARGO (H-14, 2026-08-12).
//
// Deleted here: `loadManifest` and its manifest URL/path, the Node
// file-reading and Ajv scaffolding that served it, and `ensureSeatingChart`
// with its cache and its `setChartedEditions` companion.
//
// Every one addressed a pre-doctrine file — the legacy manifest, or a
// per-edition chart under `seating/`. The volume behind the wall loads itself
// and carries its charts, so these were not merely unused: they were the
// capability H-14 removes, still sitting here with working code inside them.
//
// `setChartedEditions` earns its own line. It existed so boot would not spend
// a round trip learning a 404 for editions with no chart (O-39's engine half).
// Under H-11 every enumerated edition declares `hasChart` in `volume.json`, so
// the question is answered by the enumeration and the round trip is saved by
// construction rather than by a list that could go stale.

export function validate(raw) {
  const validator = getValidator();
  if (!validator) return { ok: true, errors: [] };
  const ok = validator(raw);
  const errors = ok ? [] : (validator.errors || []).map(err => `${err.instancePath} ${err.message}`.trim());
  return { ok, errors };
}

export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('normalize: manifest is required');
  const [volumeKey, volumeData] = Object.entries(raw)[0] || [];
  if (!volumeData) throw new Error('normalize: manifest missing volume data');
  const items = [];
  const links = [];
  const levelPalette = {};

  const hierarchyLevels = volumeData?.display_config?.hierarchy_levels || {};
  Object.entries(hierarchyLevels).forEach(([level, cfg]) => {
    if (cfg?.color) levelPalette[level] = cfg.color;
  });

  const addItem = ({ id, name, level, parentId = null, order = 0, meta = {} }) => {
    items.push({ id, name, level, parentId, order, meta });
    if (parentId) links.push({ from: parentId, to: id });
  };

  const rootId = `volume:${volumeKey}`;
  const volumeName = volumeData?.display_config?.volume_name || volumeKey || 'bible';
  addItem({ id: rootId, name: volumeName, level: 'root', parentId: null, order: 0 });

  const testaments = volumeData.testaments || {};
  const displayConfig = volumeData.display_config || {};
  const dimensions = {
    languages: displayConfig.languages || null,
    editions: displayConfig.editions || null
  };
  // BOOKS HANG FROM TESTAMENTS, AND CHAPTERS ARE NOT HERE (H-14).
  //
  // This walked testament → section → book → chapter. Sections were retired as
  // a navigable level in July and are still not one — H-26 brought back the
  // NAME and not the level: a section is now a labelled range over the
  // edition's book order, the chart-chapter shape one level up (O-44), drawn
  // beside the ring and never entered. The enumeration below is unchanged;

  // chapters ceased to be a storage level under H-11, so there is nothing to
  // walk into — a container is projected from the edition's chart at render,
  // which is what O-44 rules and what `getBibleChapters` now does.
  //
  // The normalized set is therefore volume → testament → book. That is not a
  // reduction in what the reader can reach: the rings below a book are built
  // per edition from its chart, which one stored tree could never have
  // expressed for fourteen traditions at once.
  Object.entries(testaments).forEach(([testamentId, testament], ti) => {
    const testamentOrder = Number.isFinite(testament?.sort_number) ? testament.sort_number : ti;
    addItem({ id: testamentId, name: testament?.name || testamentId, level: 'testament', parentId: rootId, order: testamentOrder });
    Object.entries(testament?.books || {}).forEach(([bookId, book], bi) => {
      addItem({
        id: bookId,
        // A name is a QUOTATION (H-2), and the names table is the only place
        // one lives now — an unnamed id displays unnamed rather than wearing
        // its own opaque spelling at the reader.
        name: book?.name || null,
        level: 'book',
        parentId: testamentId,
        order: Number.isFinite(book?.sort_number) ? book.sort_number : bi,
        meta: { testamentId, leaves: book?.leaves ?? null }
      });
    });
  });

  const levelOrder = ['root', 'testament', 'book', 'chapter', 'verse'];
  items.sort((a, b) => {
    const lo = levelOrder.indexOf(a.level);
    const ro = levelOrder.indexOf(b.level);
    if (lo === ro) {
      if (a.order === b.order) return (a.name || '').localeCompare(b.name || '');
      return a.order - b.order;
    }
    return lo - ro;
  });
  items.forEach((item, idx) => { item.order = idx; });

  return {
    items,
    links,
    meta: {
      volumeId: volumeKey,
      leafLevel: 'verse',
      levels: ['testament', 'book', 'chapter', 'verse'],
      colors: levelPalette,
      dimensions
    }
  };
}

export function layoutSpec(normalized, viewport) {
  const levels = normalized?.meta?.levels || ['testament', 'book', 'chapter', 'verse'];
  const vp = viewport?.width && viewport?.height ? viewport : getViewportInfo(1280, 720);
  const pyramidCapacity = calculatePyramidCapacity(vp);
  const palette = normalized?.meta?.colors || {
    testament: '#8b6f47',
    book: '#8b6f47',
    chapter: '#8b6f47'
  };
  return {
    rings: levels.map((lvl, idx) => ({ id: lvl, order: idx })),
    label: item => item?.name ?? '',
    colorByLevel: level => palette[level] || '#555',
    pyramid: {
      capacity: pyramidCapacity,
      place: (siblings, viewport, opts) => placePyramidNodes(siblings, vp, { capacity: pyramidCapacity, logoBounds: opts?.logoBounds })
    },
  };
}

// Books hang from testaments with nothing between (H-14): the section was
// never a level a reader could stand on, and it is gone from the enumeration.
function findBook(manifest, bookId) {
  const testaments = manifest?.Gutenberg_Bible?.testaments || {};
  for (const testament of Object.values(testaments)) {
    const book = (testament?.books || {})[bookId];
    if (book) return book;
  }
  return null;
}

// `findChapter` LIVED HERE AND IS DELETED (H-14).
//
// It searched the manifest's stored chapter tree for an id, and there is no
// such tree: a container is projected from the edition's chart at render
// (O-44), so the same book yields different containers to different
// traditions and no single stored answer could be right for all of them.
//
// Its one caller wanted a chapter's title for the detail sector, and the
// selected ITEM already carries that — built by the ring, from the chart, in
// the reader's own tongue. Reaching back into storage for it was how a stale
// name outlived the language that chose it (W-16).

// READING AHEAD. The verse ring spans the whole volume but verse TEXT
// arrives one chapter-file at a time, so a reader crossing into a new
// chapter would meet a bare reference ("2:1") where the words should be.
// Two habits fix that: load the chapter under the magnifier if it is not
// yet here (and repaint when it lands), and — once the reader is within
// sight of the last verse — quietly fetch the chapter after it, so the
// crossing itself is never a wait.
const VERSES_BEFORE_READING_AHEAD = 5;
const byDeclaredOrder = (a, b) => {
  const rank = entry => (Number.isFinite(entry?.[1]?.sort_number)
    ? entry[1].sort_number
    : (Number.parseInt(entry?.[0], 10) || 0));
  return rank(a) - rank(b);
};
let _renderDetail = null;          // captured at boot; repaints when text lands
const _requestedChapters = new Set(); // asked-for files, so a failure is not re-asked forever
let _chapterOrder = null;          // flat reading order, memoized

// THE READING ORDER, FROM THE ENUMERATION (H-14).
//
// This walked testament → section → book → chapter and read `_external_file`
// off each stored chapter. None of those survive: sections are not a level,
// containers are not stored, and a container has no file of its own.
//
// The read-ahead's job is unchanged — know what comes next so a reader
// crossing a boundary never waits — but under the wall a UNIT is the fetch
// granularity, because its text arrives whole. So the order is the order of
// the units the volume enumerates, and the read-ahead warms the next unit
// rather than the next chapter file.
function chaptersInReadingOrder(manifest) {
  if (_chapterOrder) return _chapterOrder;
  const volume = manifest?.__wallVolume;
  // FLAT, because the enumeration is flat now (H-29). This walked
  // `testaments[].books[]`; the volume no longer says which division a book is
  // in, and the read-ahead never needed to know — it warms the NEXT unit, and
  // units have an order without having a parent.
  // Every edition's books, in each edition's own order (O-92): book ids are
  // globally unique, and the read-ahead only needs a stable sequence to warm
  // the next fetch — a book of another edition is simply never requested.
  const order = typeof volume?.booksFor === 'function'
    ? (volume.editions || []).flatMap(e =>
      volume.booksFor(e.code).map(book => ({
        chapterId: book.id,
        bookId: book.id,
        // The text address IS the book's id: there is no file to name.
        externalFile: book.id,
        verseCount: (volume.chartFor?.(book.id, e.code)?.seats || []).length
      })))
    // Fixtures that still model a shared roster walk it unchanged.
    : (volume?.units || []).map(book => ({
      chapterId: book.id,
      bookId: book.id,
      externalFile: book.id,
      verseCount: Number.isFinite(book.leaves) ? book.leaves : 0
    }));
  _chapterOrder = order;
  return order;
}

function requestChapter(chapterId, bookId, externalFile) {
  if (!externalFile || _requestedChapters.has(externalFile)) return;
  _requestedChapters.add(externalFile);
  prefetchBibleVerses(
    { id: chapterId, meta: { externalFile, bookId } },
    { onLoaded: () => { if (typeof _renderDetail === 'function') _renderDetail(); } }
  );
}

function readAhead(selected, manifest) {
  const meta = selected?.meta;
  if (!meta?.externalFile) return;
  requestChapter(meta.chapterId, meta.bookId, meta.externalFile);
  const order = chaptersInReadingOrder(manifest);
  // BY THE UNIT, NOT THE CONTAINER (O-67, the second of two defects here and
  // the more absolute of them). This matched `meta.chapterId` — which is a
  // container address like "GENE/50" — against a list keyed by UNIT id
  // ("GENE"). It never matched, so `here` was always -1 and this returned
  // before reaching the next-unit branch AT ALL. Either defect alone disabled
  // the read-ahead; both had to be fixed for the crossing to warm.
  const here = order.findIndex(c => c.chapterId === (meta.unitId || meta.externalFile));
  if (here < 0 || here + 1 >= order.length) return;
  // THE POSITION MUST BE UNIT-SCOPED, AND `verseKey` NEVER WAS (O-67).
  //
  // This read `Number.parseInt(meta.verseKey, 10)`, and `verseKey` is a
  // COMPOSED ADDRESS — "50:26" — so the parse returned 50, the chapter
  // number. Compared against the unit's total seat count (1,533 for Genesis)
  // the remainder was never within five, so THE READ-AHEAD NEVER FIRED AT A
  // BOOK BOUNDARY, which is the only boundary it exists for. Every crossing
  // was a cold fetch of the next unit's entire text, and the detail sector
  // sat blank until it landed. Howell found it between Genesis and Exodus.
  //
  // `unitOrdinal` is the seat's position among its unit's seats, carried from
  // the chart walk that already computes it. A synthetic item (the ?verseId
  // deep link) has none: it warms the unit it is in and does not guess at the
  // next, which is the honest degradation rather than a wrong number.
  const unitOrdinal = Number(meta.unitOrdinal);
  if (!Number.isFinite(unitOrdinal)) return;
  const remaining = order[here].verseCount - unitOrdinal;
  if (Number.isFinite(remaining) && remaining <= VERSES_BEFORE_READING_AHEAD) {
    const next = order[here + 1];
    requestChapter(next.chapterId, next.bookId, next.externalFile);
  }
}

export function detailFor(selected, manifest, { normalized, translation } = {}) {
  if (!selected) return null;
  const id = selected.id || '';
  const level = selected.level || '';

  if (level === 'testament') {
    return {
      type: 'card',
      title: selected.name || id,
      body: 'Testament overview'
    };
  }

  if (level === 'book') {
    const book = findBook(manifest, id) || {};
    // A BOOK'S SIZE IS ITS LEAVES (H-14). This counted the book's stored
    // chapters, and there are none: containers are projected per edition from
    // the chart, so a single count would have to pick one tradition's division
    // and present it as the book's own. The utterance count is edition-neutral
    // and is what `volume.json` actually enumerates.
    const subtitle = Number.isFinite(book.leaves) ? `${book.leaves} verses` : '';
    return {
      type: 'card',
      // The name comes from the ITEM, which the ring built from the names
      // table in the reader's tongue. Reaching into the root for a baked name
      // is what served a stale language (W-16).
      title: selected.name || id,
      body: subtitle || 'Book overview'
    };
  }

  if (level === 'chapter') {
    // THE ITEM ALREADY KNOWS ITS OWN NAME (H-14). This searched the manifest's
    // stored chapter tree, which no longer exists — and would not have been
    // right if it did, since a container is projected per edition and the
    // stored answer could only ever be one tradition's.
    //
    // The selected item was built by the ring, from the chart, in the reader's
    // tongue. Reaching back into storage is how a stale name outlived the
    // language that chose it (W-16).
    const chapterName = selected.name || id;
    const bookName = selected.meta?.bookName || '';
    return {
      type: 'text',
      text: bookName ? `${bookName}: ${chapterName}` : String(chapterName)
    };
  }

  if (level === 'verse') {
    const externalFile = selected.meta?.externalFile;
    const verseKey = selected.meta?.verseKey;
    // Baked chain text is trustworthy ONLY in the language it was baked in
    // (the 2026-07-28 stale-Latin bug: a live language switch repainted the
    // boot ring's build-time Latin, unflagged, because this fallback didn't
    // check). No live selection = any bake serves; otherwise they must match.
    const bakedOk = selected.text && (!translation || selected.translation === translation);
    const bakedText = bakedOk ? selected.text : '';
    if (externalFile && verseKey) {
      // The translation comes from the dimension state, passed in — the ONE
      // source of truth (D.2). The old URL-param fallback is gone: Phase A
      // retired ?translation= reading, but a vestige survived here and let a
      // stale bookmark override the dimension store (found when the first
      // live swap demo stayed Latin, 2026-07-21).
      const activeTranslation = translation || null;
      // NO FALLBACK, NO SUBSTITUTE, NO MARK (Howell, RULED 2026-07-30 — see
      // HANDOFF CONTRACT, "NO ASTERISKS"). The reader's own edition or
      // NOTHING. W-6's flagged Latin is retired entirely: it showed a verse in
      // a tongue the reader did not ask for and apologised for it in the
      // middle of scripture, which is the excuse this ruling forbids. An
      // offered edition is complete, so a verse it lacks was never written —
      // and a gap needs no explanation.
      //
      // With NO edition certified there is no active translation at all, so
      // nothing resolves and the sector stays empty. That is the honest face
      // of a volume with nothing to read.
      // By the seat's SPAN, not its label — see getVerseTextForSeat. The
      // two agree everywhere the edition counts as the spine does, and
      // differ exactly where this model exists to help.
      const resolved = activeTranslation
        ? getVerseTextForSeat(externalFile, selected?.meta, [activeTranslation])
        : null;
      readAhead(selected, manifest);
      // uniform: every verse shares the longest verse's type size (Howell
      // 2026-07-21) — a constant reading page, not size-by-length.
      if (resolved) return { type: 'text', text: resolved.text, uniform: true };
      // The chapter may still be in flight; the repaint comes with it. Baked
      // text is honoured only in its own language (the stale-Latin lesson).
      return { type: 'text', text: bakedText, uniform: true };
    }
    return { type: 'text', text: bakedText || selected.name || id || '', uniform: true };
  }

  return { type: 'text', text: selected.name || id || '' };
}

// Single-item root ring for gateway entry: BIBLIA SACRA LATINA alone in the
// magnifier with the testaments in the child pyramid.
// The door's name comes from the registry (`names[lang].title` — W-27,
// Howell 2026-07-31): the gateway reads כתבי הקודש when the reader's tongue
// is Hebrew. The Latin string is the FALLBACK for languages without a title
// yet (names.latin.title carries the identical string, so Latin cannot
// regress). Live switches at the door are handled by the label formatter,
// which re-reads the live names table at render; this bake only seats the
// boot value.
export const buildBibleRootChain = (namesMap = null) => ({
  items: [{ id: 'BIBLIA_SACRA_LATINA', name: namesMap?.title || 'BIBLIA SACRA LATINA', level: 'bibleRoot', order: 0 }],
  selectedIndex: 0,
  preserveOrder: true
});

export function createHandlers({ manifest, namesMap, options, translationsMeta, chainMeta, translationName = '', onGatewayReturn = null, gatewayLabel = '', gatewayReturnLabel = '' }) {
  const initialLevel = options?.level;
  const hasRoot = initialLevel === 'root';
  let bibleMode = (initialLevel === 'chapter' || initialLevel === 'verse') ? initialLevel : (hasRoot ? 'root' : 'book');
  let bibleChapterContext = (initialLevel === 'chapter' && options?.bookId)
    ? { bookId: options.bookId, testamentId: null, sectionId: null }
    : null;
  let bibleVerseContext = null;
  // Pre-populate verse context at startup so OUT navigation works immediately.
  if (initialLevel === 'verse' && options?.bookId && options?.chapterId) {
    const chapterItems = getBibleChapters(manifest, { id: options.bookId }, namesMap, 'book',
      options?.activeEdition || options?.translation || null);
    const ch = chapterItems.find(c => c.meta?.chapterKey === String(options.chapterId));
    if (ch) {
      bibleVerseContext = {
        chapterId: ch.id,
        bookId: options.bookId,
        testamentId: ch.meta?.testamentId || null,
        sectionId: ch.meta?.sectionId || null,
        externalFile: ch.meta?.externalFile || null
      };
      // Also pre-populate chapter context so a second OUT (verse→chapter→book) works.
      bibleChapterContext = {
        bookId: options.bookId,
        testamentId: ch.meta?.testamentId || null,
        sectionId: ch.meta?.sectionId || null
      };
    }
  }
  const lastBookByTestament = {};

  // The chapter chain is the same on every entry FOR A GIVEN ARTIFACT —
  // since E3 the ring holds the chapters the active edition actually has,
  // collapsed from the very seats the verse ring is built from, so the two
  // levels cannot disagree. Keyed by chart for the same reason the verse
  // chain is: a switched edition rebuilds rather than serving another
  // artifact's chapters.
  let chapterChainItems = null;
  let chapterChainEdition;
  const chapterChain = initialChapterId => {
    const edition = options?.activeEdition || options?.translation || null;
    // KEYED BY THE EDITION, which is what decides the seats. It was keyed by
    // the fetched chart object, and under the wall there is no such object —
    // the edition names the chart the volume already holds.
    if (!chapterChainItems || chapterChainEdition !== edition) {
      chapterChainItems = buildBibleChapterChain(manifest, {
        edition,
        namesMap,
        seats: buildBibleVerseChain(manifest, { edition }).items
      }).items;
      chapterChainEdition = edition;
    }
    let selectedIndex = 0;
    if (initialChapterId) {
      const idx = chapterChainItems.findIndex(item => item && item.id === initialChapterId);
      if (idx >= 0) selectedIndex = idx;
    }
    return { items: chapterChainItems, selectedIndex };
  };

  // The verse chain is the same on every entry FOR A GIVEN ARTIFACT; build
  // it once per chart and only re-locate the verse entered at. Since W-21
  // the chain's membership is the active edition's own (its seating chart),
  // so the cache is keyed by the chart it was built with — an edition
  // switched mid-session rebuilds on the next descent instead of serving
  // another artifact's seats. The chart read is synchronous: boot's awaited
  // fetch populated the cache, and a miss means identity fallback.
  let verseChainItems = null;
  let verseChainEdition;
  const verseChain = initialVerseId => {
    const edition = options?.activeEdition || options?.translation || null;
    if (!verseChainItems || verseChainEdition !== edition) {
      verseChainItems = buildBibleVerseChain(manifest, { edition }).items;
      verseChainEdition = edition;
    }
    let selectedIndex = 0;
    if (initialVerseId) {
      const idx = verseChainItems.findIndex(item => item && item.id === initialVerseId);
      if (idx >= 0) selectedIndex = idx;
      else {
        // A MISS MUST NOT TELEPORT (Howell from the phone, 2026-08-02). An id
        // this artifact does not seat used to fall through to index 0 — and
        // index 0 is Genesis 1:1, so a tap in Sirach landed the reader at the
        // start of the Bible with nothing to say it had gone wrong. Land in
        // the requested CHAPTER instead: a near miss the reader can see and
        // correct, rather than a silent journey across the whole volume.
        // AND IT WORKS ONLY BY ACCIDENT — recorded, deliberately not fixed
        // (O-51; Howell: "Record it, don't fix it now"). This recovers the
        // container by PARSING THE ID, stripping the last `_`-delimited
        // segment — reading meaning out of the text of an id, which H-2
        // forbids and which `core/identity.js` exists to end. It still finds
        // what it looks for only because `expandVolumeSeats` happened to keep
        // the legacy `unit_container_seat` SHAPE when it was written under
        // the wall. Nothing requires that shape. The day a unit id contains
        // an underscore, or the composition changes, the prefix matches the
        // wrong seats or none — and the failure is the original one
        // returning: the reader moved somewhere they did not ask to go, with
        // nothing on the glass to say so.
        //
        // The fix is to CARRY the container on the item rather than recover
        // it, exactly as H-2 made the chapter label travel. *(Comment landed
        // 2026-08-23 under W-139's sweep; the hazard had lived only in a
        // ledger body.)*
        const chapterPrefix = String(initialVerseId).replace(/_[^_]*$/, '_');
        const near = verseChainItems.findIndex(item => item && item.id.startsWith(chapterPrefix));
        if (near >= 0) selectedIndex = near;
      }
    }
    return { items: verseChainItems, selectedIndex };
  };

  // THE READER IS CARRIED BY THEIR UTTERANCE, NOT BY A NUMBER (E2 of W-21).
  //
  // An edition change is not a jump: the reader is standing on a particular
  // piece of scripture, and that piece exists in the new artifact too — it is
  // only SEATED differently. So the position that travels is the spine
  // utterance, and the landing seat is whichever seat of the new artifact
  // spans it. Spine→seat is single-valued (the folds are many-to-one, never
  // one-to-many), so the landing is deterministic.
  //
  // THE CHOREOGRAPHY (Howell's rulings, 2026-08-02). A fusion, or any
  // re-seating, must be "legible as an event and invisible at rest" — and a
  // persistent badge would be an asterisk. So the event IS the movement: the
  // ring is laid down where the reader's own NUMBER falls in the new
  // artifact, then glides to where their WORDS actually are. Where the two
  // traditions agree the seats coincide and nothing moves, which is the
  // invisible-at-rest half. Where they disagree — Malachi, Sirach, a Latin
  // weld — the wheel turns, and the turn is the explanation.
  //
  // A landing seat lands WHOLE (his other ruling): we never split a verse, so
  // we never show half of one. And under `convention: true` no choreography
  // is played at all — those books share coordinates by convention only, and
  // the animation asserts "same words, different seat", which would be a lie.
  const reseatOnEditionChange = ({ selected, app }) => {
    if (!selected || !app?.setPrimaryItems) return false;
    const level = selected.level;

    // AT ROOT THE VESSELS EMPTY AND REFILL (O-95, Howell 2026-08-23).
    //
    // This function answered only at a verse or a chapter and returned "stay
    // put" at root — while the store, the active edition, the names table and
    // the corner emblem had all committed. That is the hybrid the comments
    // below call the one outcome worse than either edition, arriving at the
    // top after O-76 fixed it at the leaf.
    //
    // H-29 already ruled the shape: the ring holds the edition's own division
    // of itself and books are never on it, precisely so that changing edition
    // here never animates a rearrangement of books. So the ring is rebuilt
    // from the new edition's declaration and the reader lands on the division
    // that seats the leaves theirs seated — O-76's landing rule, one level up,
    // walking the anchors the division carries (O-95, in volume-helpers).
    if (level === 'testament') {
      const edition = options?.activeEdition || options?.translation || null;
      const { items } = buildBibleTestaments(manifest, namesMap, {
        translationName, edition
      });
      if (!items.length) return false;
      const volume = manifest?.__wallVolume;
      let target = -1;
      const anchors = Array.isArray(selected.meta?.utterances) ? selected.meta.utterances : [];
      for (const utterance of anchors) {
        target = items.findIndex(item => (item.meta?.utterances || []).includes(utterance));
        if (target >= 0) break;
        // The new edition may seat the same leaf under a book of its own,
        // whose FIRST verse is not this one — so ask the charts, not the
        // anchors, before giving up on this leaf.
        const book = volume ? bookSeatingUtterance(volume, edition, null, utterance) : null;
        if (book) {
          target = items.findIndex(item => (item.meta?.books || []).includes(book));
          if (target >= 0) break;
        }
      }
      // AND IF IT SHARES NOTHING AT ALL, THE READER LANDS AT ITS BEGINNING —
      // O-76's rule, for the same reason: they asked for this edition, and an
      // edition's beginning is where an arrival belongs.
      if (target < 0) target = 0;
      app.setPrimaryItems(items, target, true);
      return true;
    }

    if (level !== 'verse' && level !== 'chapter') return false;

    const previousSeats = Array.isArray(verseChainItems) ? verseChainItems : [];
    const edition = options?.activeEdition || options?.translation || null;
    const rebuilt = buildBibleVerseChain(manifest, { edition }).items;
    if (!rebuilt.length) return false;

    // The reader is standing on a verse, or on a chapter — in which case the
    // thing that travels is its first verse, since a chapter is only a name
    // for the utterances under it.
    const anchor = level === 'verse'
      ? selected
      : previousSeats.find(it => it
          && (it.meta?.chapterId === selected.id || it.chapterKey === selected.id));
    // WHAT TRAVELS IS THE UTTERANCE (W-21). The reader's position is the
    // stretch of scripture they are standing on, not a number naming it — so
    // the crossing carries an opaque id rather than a book, a chapter key and
    // an ordinal that could match in the wrong place.
    if (!Array.isArray(anchor?.meta?.utterances) || !anchor.meta.utterances.length) return false;

    // INDEXED ONCE, NOT SCANNED PER PROBE (O-78). The outward walk below asks
    // "where does this utterance sit in the new edition?" once per seat the
    // reader passes, and where the two editions share nothing it asks for
    // every seat in the chain. As a scan that was 185 million comparisons and
    // twelve to seventeen seconds; as a map it is one pass and a lookup each.
    const seatOf = buildUtteranceSeatIndex(rebuilt);
    const seatFor = it => {
      const utterance = it?.meta?.utterances?.[0];
      if (utterance == null) return -1;
      const at = seatOf.get(utterance);
      return at === undefined ? -1 : at;
    };

    // THE NEAREST SCRIPTURE THIS EDITION ACTUALLY HOLDS (Howell from the
    // phone, 2026-08-03). This used to give up when the new artifact had no
    // seat for the reader's verse — "stay put" — which was the wrong refusal
    // and made a far worse state than a wrong landing: the app committed to
    // the new edition while the ring kept the OLD one's seats. Rotating into
    // Latin 1 Samuel 17:12 and returning to Greek left Greek holding nodes
    // 12–31 that the Septuagint has never had, with no text under them, and
    // the sky inherited the same ghosts on the way out. A hybrid is the one
    // outcome worse than either edition.
    //
    // So the chain is ALWAYS adopted, and the landing is found by walking the
    // reader's own reading order outward — backward first, so they land just
    // BEFORE the gap and meet the jump again by reading forward, exactly as
    // they would have on entering. Latin 17:12 lands on Greek 17:11. Only if
    // the new artifact shares no scripture at all with where they stand does
    // this refuse, and then nothing has been disturbed.
    let target = seatFor(anchor);
    if (target < 0 && previousSeats.length) {
      const at = previousSeats.findIndex(it => it && it.id === anchor.id);
      if (at >= 0) {
        for (let i = at - 1; i >= 0 && target < 0; i -= 1) target = seatFor(previousSeats[i]);
        for (let i = at + 1; i < previousSeats.length && target < 0; i += 1) target = seatFor(previousSeats[i]);
      }
    }
    // AND IF IT SHARES NOTHING AT ALL, THE READER LANDS AT ITS BEGINNING
    // (O-76). This returned false — "stay put" — and the comment above said
    // "then nothing has been disturbed". That was true only while such a
    // commit was impossible.
    //
    // O-72 made it impossible at a LEAF by never offering an edition that
    // cannot seat the reader's verse, and I recorded the clause as dissolved.
    // O-75 then reopened it deliberately: the LAUNCH funnel must offer every
    // edition, because the reader has not chosen where to stand yet — so a
    // reader booting into Genesis can now commit the Greek New Testament,
    // which shares not one utterance with it.
    //
    // What "stay put" actually produced, measured on Howell's phone and then
    // in a probe: the store, the active edition, the names table and the
    // corner emblem all committed to the Greek while the ring kept the
    // Hebrew's seats — the hybrid this function's own comment calls the one
    // outcome worse than either edition. And the position filter then read
    // the reader's UNCHANGED Hebrew verse and struck the Greek off the
    // chooser, so the edition they had just chosen disappeared. "After
    // switching between the two languages a few times, the Greek disappears."
    //
    // Landing at seat 0 is the only non-broken answer and it is also the
    // right one: the reader asked for this edition from the launch plane, and
    // an edition's beginning is where a launch belongs.
    if (target < 0) target = 0;

    // Adopt the rebuilt chain, and drop the chapters cache so the ring above
    // — and the sky under it — are rebuilt from these same seats (E3).
    verseChainItems = rebuilt;
    verseChainEdition = edition;
    chapterChainItems = null;

    // A reader standing on the CHAPTER ring stays there: rebuild that ring
    // from the new artifact and land on the chapter holding their utterance.
    if (level === 'chapter') {
      const landedId = rebuilt[target]?.meta?.chapterId;
      const { items, selectedIndex } = chapterChain(landedId);
      if (!items.length) return false;
      app.setPrimaryItems(items, selectedIndex, true);
      return true;
    }

    // Where the reader's own NUMBER falls in the new artifact — the seat they
    // would have been given if the two traditions counted alike.
    const byNumber = rebuilt.findIndex(it => it && it.bookKey === anchor.bookKey
      && it.name === anchor.name
      && it.meta?.chapterLabel === anchor.meta?.chapterLabel);
    const staged = byNumber >= 0 && byNumber !== target;
    const noPerformance = Boolean(anchor.meta?.convention || rebuilt[target]?.meta?.convention);

    if (staged && !noPerformance && typeof app.glideToItem === 'function') {
      app.setPrimaryItems(rebuilt, byNumber, true);
      app.glideToItem(rebuilt[target].id, 900);
      return true;
    }
    app.setPrimaryItems(rebuilt, target, true);
    return true;
  };

  // THE PYRAMID IS SEATED BY THE CHART TOO (E3, second half — Howell from
  // the phone, 2026-08-02). The sky under the ring was built straight from
  // the chapter FILE: every slot the spine holds, for every edition at once,
  // with ids keyed by the spine's chapter number. Two failures fell out of
  // that, and they were the same failure.
  //
  // First, it offered verses the reader's edition does not have — Greek
  // 1 Samuel 17:13 sat in the sky while the ring beside it honestly ran
  // 11 → 32. Second, and worse, tapping ANY of those stars landed the reader
  // in Genesis 1:1: the tapped id was not in the chart-built chain, the
  // lookup returned -1, and -1 became index 0. The Sirach Prologue failed
  // even for its REAL verses, because the file keys them by sequence
  // ("ECCLU_0_1") while the chart names the chapter Πρόλογος.
  //
  // The cure is the same one E3 used a level up: the sky is drawn from the
  // very seats the ring holds, so the two cannot disagree and a tap always
  // finds its verse. Without a chart it falls back to the file, unchanged.
  const verseItemsForChapter = chapterItem => {
    if (!chapterItem) return [];
    // THE SKY IS DRAWN FROM THE SEATS THE RING HOLDS (E3 of W-21), and under
    // the wall there is no second source to fall back to.
    //
    // This used to ask whether a legacy chart had been fetched and, if not,
    // read the container's file instead — the two-source arrangement that let
    // the ring and the sky disagree, which is the defect E3 exists for. There
    // is one source now: the same chain the ring is built from.
    const edition = options?.activeEdition || options?.translation || null;
    const chain = verseChainItems || buildBibleVerseChain(manifest, { edition }).items;
    const wanted = chapterItem.id;
    const seats = [];
    for (const it of chain) {
      if (!it || it.level !== 'verse') continue;
      if (it.meta?.chapterId !== wanted && it.chapterKey !== wanted) continue;
      seats.push({
        id: it.id,
        name: it.name,
        order: seats.length,
        parentId: chapterItem.id,
        level: 'verse',
        meta: { ...it.meta, chapterId: chapterItem.id }
      });
    }
    // A container the edition does not seat has no verses, and that is the
    // honest answer rather than a blank to be filled from elsewhere.
    return seats;
  };

  const parentHandler = ({ selected, app }) => {
    if (bibleMode === 'verse') {
      // The verse ring spans the whole volume, so the reader may be far
      // from the chapter they entered at. Land on the MAGNIFIED verse's
      // own chapter; the entry context is only a fallback (the same live
      // contract the timeline uses for a date over its month).
      const ctx = {
        bookId: selected?.meta?.bookEntryId || selected?.meta?.bookId || bibleVerseContext?.bookId,
        chapterId: selected?.meta?.chapterId || bibleVerseContext?.chapterId,
        testamentId: selected?.meta?.testamentId || bibleVerseContext?.testamentId,
        sectionId: selected?.meta?.sectionId || bibleVerseContext?.sectionId
      };
      if (!ctx?.bookId) return false;
      // Back to the chapters ring — the VOLUME-SPANNING cousin chain, the same
      // one descent builds, landing on the chapter just left. Using
      // getBibleChapters here (one book, no gaps) was the bug: ascending out
      // of a leaf stranded the ring on the parent book's chapters alone, so
      // rotating never crossed into the next book (Howell 2026-07-21).
      const { items: chapterItems, selectedIndex: chapterIdx } = chapterChain(ctx.chapterId);
      if (!chapterItems.length) return false;
      bibleMode = 'chapter';
      bibleVerseContext = null;
      bibleChapterContext = { bookId: ctx.bookId, testamentId: ctx.testamentId, sectionId: ctx.sectionId };
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(chapterItems, chapterIdx >= 0 ? chapterIdx : 0, true);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return true;
    }

    if (bibleMode === 'chapter') {
      // The chapters ring spans the volume, so land on the MAGNIFIED
      // chapter's own book rather than the one entered at.
      const ctx = {
        bookId: selected?.meta?.bookId || bibleChapterContext?.bookId,
        testamentId: selected?.meta?.testamentId || bibleChapterContext?.testamentId,
        sectionId: selected?.meta?.sectionId || bibleChapterContext?.sectionId
      };
      const { items: bookItems, selectedIndex: bookSelected, preserveOrder: bookPreserve } = buildBibleBookCousinChain(manifest, {
        bookId: ctx?.bookId,
        testamentId: ctx?.testamentId,
        initialItemId: ctx?.bookId,
        names: namesMap,
        edition: options?.activeEdition || options?.translation || null
      });
      if (!bookItems.length) return false;
      bibleMode = 'book';
      bibleChapterContext = null;
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(bookItems, bookSelected, bookPreserve);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
      return true;
    }
    if (bibleMode === 'book') {
      const testamentId = selected?.testamentId;
      if (testamentId && selected?.id) {
        lastBookByTestament[testamentId] = selected.id;
      }
      const { items: testamentItems, selectedIndex: testamentSelected } = buildBibleTestaments(manifest, namesMap, {
        testamentId,
        translationName,
        // O-71: the ring holds the testaments this edition reaches.
        edition: options?.activeEdition || options?.translation || null
      });
      if (!testamentItems.length) return false;
      bibleMode = 'testament';
      // With a gateway root above, the parent button stays visible
      // (BIBLIA SACRA LATINA); without one, testaments are the top level.
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(testamentItems, testamentSelected, true);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: hasRoot });
      return true;
    }
    if (bibleMode === 'testament' && hasRoot) {
      // Gateway entry: OUT from the testament ring returns to the
      // single-item BIBLIA SACRA LATINA root ring.
      const rootChain = buildBibleRootChain();
      bibleMode = 'root';
      if (app?.setPrimaryItems) {
        const migrateOrSet = app.migrateOut || app.setPrimaryItems;
        migrateOrSet(rootChain.items, rootChain.selectedIndex, rootChain.preserveOrder);
      }
      // After the migration starts — an earlier call renders the post-ascent
      // parent state in full view before anything is hidden.
      if (app?.setParentButtons) app.setParentButtons({ showOuter: Boolean(gatewayReturnLabel || gatewayLabel) });
      return true;
    }
    if (bibleMode === 'root') {
      // OUT through the gateway back to the host volume.
      if (typeof onGatewayReturn === 'function') return Boolean(onGatewayReturn());
      return false;
    }
    // bibleMode === 'testament' without a root above: no parent.
    return false;
  };

  const childrenHandler = ({ selected, app }) => {
    if (bibleMode !== 'testament') return false;
    const testamentId = selected?.id;
    const initialBookId = testamentId ? lastBookByTestament[testamentId] : null;
    const { items: bookItems, selectedIndex: bookSelected, preserveOrder: bookPreserve } = buildBibleBookCousinChain(manifest, {
      testamentId,
      initialItemId: initialBookId,
      names: namesMap,
      edition: options?.activeEdition || options?.translation || null
    });
    if (!bookItems.length) return false;
    bibleMode = 'book';
    if (app?.setParentButtons) app.setParentButtons({ showOuter: true });
    if (app?.setPrimaryItems) app.setPrimaryItems(bookItems, bookSelected, bookPreserve);
    return true;
  };

  // THE NUMERIC SUFFIX, DECLARED (Howell 2026-08-02). The verse-level parent
  // label is a compound — book name plus the chapter it is open at — and the
  // placement rules were written for the NAME. Rather than have the view
  // guess where a name ends (a trailing-token split would cut PALMER
  // BROTHERS in half), the volume that builds the compound says what it
  // appended. Every other level returns '' and keeps the original rules.
  const getParentLabelSuffix = (item) => {
    if (item?.level !== 'verse') return '';
    const chapterKey = item.meta?.chapterLabel;
    if (!chapterKey) return '';
    const n = Number.parseInt(chapterKey, 10);
    const numeral = Number.isFinite(n) ? toTraditionNumeral(n, namesMap?.locale) : String(chapterKey);
    // Only a suffix if the label actually carries a name in front of it.
    return getParentLabel(item) === numeral ? '' : numeral;
  };

  // WHOSE BOOK IS BEING NAMED? (O-94, Howell 2026-08-23.)
  //
  // While the reader turns a stratum, the Primary behind the glass follows
  // the lens — so the parent button must say what the HOVERED edition calls
  // the place they are standing, in the hovered tongue. The ring itself is
  // not rebuilt (the paint is thrown away and redone by the settle), so its
  // items still carry the COMMITTED edition's book ids, and naming one of
  // those out of another tongue's names file is asking Hebrew for the name of
  // a Greek book. It only ever answered because every tongue had been made to
  // carry every other edition's vocabulary — the false demand O-94 retires.
  //
  // The leaf is the bridge (W-21): the hovered edition seats this utterance
  // under a book of its own, and that is the book to name. Where it holds no
  // such leaf there is nothing to say, so the committed id stands and the
  // caller's own fallbacks apply.
  const displayBookIdFor = (item, bookId) => {
    const preview = options?.previewEdition || null;
    if (!preview || preview === (options?.activeEdition || options?.translation)) return bookId;
    const utterance = item?.meta?.utterances?.[0];
    if (!utterance) return bookId;
    const volume = manifest?.__wallVolume;
    if (!volume) return bookId;
    return bookSeatingUtterance(volume, preview, bookId, utterance) || bookId;
  };

  const getParentLabel = (item) => {
    if (!item) return '';
    // Gateway root ring: parent button points back through the gateway.
    // Top of this volume: the parent button is the way back through the
    // gateway, so it names the DESTINATION volume (Howell 2026-07-18 —
    // same contract as the calendar), not the gateway node came through.
    if (item.level === 'bibleRoot') return gatewayReturnLabel || gatewayLabel || '';
    // Testament ring under a gateway root: parent is the Biblia itself.
    if (item.level === 'testament' && hasRoot) return namesMap?.title || 'BIBLIA SACRA LATINA';
    // Chapter ring: parent is the book name in the display language
    // (e.g. "MATTHAEUS" — namesMap carries the Latin names under VUL)
    if (item.level === 'chapter') {
      const bookId = item.meta?.bookId || item.parentId;
      if (!bookId) return '';
      const book = findBook(manifest, bookId);
      const localized = namesMap?.books?.[bookId];
      return toDisplayCase(localized || book?.book_name || bookId);
    }
    // Verse ring: the book AND its chapter, live — "IOHANNES III". The
    // ring now runs the whole volume (2026-07-20), so a bare chapter is
    // ambiguous: reading Genesis into Exodus would go L → I with nothing
    // marking the crossing. No word between them: the Roman numeral is
    // already the citation form for a chapter, so "CAP" would only
    // re-state what the numeral says (Howell: "it's redundant").
    if (item.level === 'verse') {
      // THE LABEL IS CARRIED, NEVER RECOVERED FROM THE ID (H-2).
      //
      // This read `chapterId.split(':').pop()` — parsing an id to get back a
      // label, which is reading meaning out of the text of an id and is the
      // exact habit `core/identity.js` exists to end. It worked only because
      // ids happened to spell `GENE:1`. Against an opaque id there is nothing
      // to parse, and Howell's phone showed the result: the parent button read
      // "GENESIS bc22df/1" — the filesystem talking to the reader.
      //
      // Changing the separator would have made it work again by luck and left
      // the parser in place. The label travels on the item instead, put there
      // by whoever knew it.
      const chapterKey = item.meta?.chapterLabel;
      if (!chapterKey) return '';
      const n = Number.parseInt(chapterKey, 10);
      // The parent button names the reader's chapter, so it counts in the
      // reader's own letters — namesMap carries the live locale (W-16), the
      // same table this line's book name comes from. Hardcoded Roman here
      // was why 'Αʹ ΣΑΜΟΥΗΛ XVII' wore two traditions at once.
      const chapterLabel = Number.isFinite(n) ? toTraditionNumeral(n, namesMap?.locale) : String(chapterKey);
      // O-94: named in the tongue under the lens, through the leaf.
      const bookId = displayBookIdFor(item, item.meta?.bookEntryId || item.meta?.bookId || '');
      const book = bookId ? findBook(manifest, bookId) : null;
      // UPPERCASE ONLY WHAT UPPERCASES (Howell 2026-07-22, ruled for the
      // strata ring and true here for the same reason): toUpperCase mangles
      // polytonic Greek's breathings and accents, and means nothing at all
      // for Hebrew. Latin-script names still shout; every other script is
      // left in the form its own tradition writes it.
      const bookName = toDisplayCase(namesMap?.books?.[bookId] || book?.book_name || bookId || '');
      return bookName ? `${bookName} ${chapterLabel}` : chapterLabel;
    }
    // Book ring: parent is the testament name (stored mixed-case on items as
    // parentName; cased here because the theme no longer transforms — parent
    // labels arrive display-ready so MMdM's lowercase d survives). Latin
    // shouts; Παλαιὰ Διαθήκη and הברית הישנה are left as their own
    // traditions write them.
    return toDisplayCase(item.parentName || '');
  };

  // Startup-verse prefetch: when the Bible opens on a chapter with a
  // featured verse, fetch the chapter's verse data and re-render the
  // Detail Sector with the verse text once it arrives. (Moved from the
  // host's bootVolume — Phase B audit, H1.)
  const onBoot = ({ app, items, selectedIndex, renderDetail }) => {
    // Held for the whole session: when a chapter's text lands, whatever
    // verse is under the magnifier repaints itself.
    if (typeof renderDetail === 'function') {
      _renderDetail = item => renderDetail(item || app?.nav?.getCurrent?.());
    }
    if (options?.level !== 'chapter' || !options?.verseId) return;
    const initialChapter = items[selectedIndex];
    if (!initialChapter?.meta?.externalFile) return;
    prefetchBibleVerses(initialChapter, {
      onLoaded() {
        const { externalFile, bookId, chapterKey } = initialChapter.meta;
        const verseKey = String(options.verseId);
        const syntheticVerse = {
          id: `${bookId}_${chapterKey}_${verseKey}`,
          name: `${chapterKey}:${verseKey}`,
          level: 'verse',
          parentId: initialChapter.id,
          meta: { bookId, chapterId: initialChapter.id, verseKey, externalFile }
        };
        if (app?.openDetailSector) {
          app.openDetailSector(() => renderDetail(syntheticVerse));
        } else {
          renderDetail(syntheticVerse);
        }
      }
    });
  };

  return {
    parentHandler,
    childrenHandler,
    getParentLabel,
    getParentLabelSuffix,
    reseatOnEditionChange,
    onBoot,
    // THE FRONT-DOOR GLOBE (Howell 2026-07-27): the dimension globe shows at
    // the volume's threshold — the root item magnified, testaments in the
    // pyramid — as well as at a leaf. The two moments where language is a
    // live question: "what is this book? — in my tongue" at the door, "what
    // did the original say?" at the verse. Between them it is clutter; the
    // host hides it while drilling. The adapter names the door (its own
    // dialect); the host stays volume-agnostic.
    // WHICH EMBLEM BELONGS WHERE THE READER IS STANDING (H-31).
    //
    // Howell's report was that the Torah scroll never became a crown of thorns
    // for the New Testament. Two causes: the image was declared once for the
    // whole VOLUME, and it was painted once at boot. The declaration moved to
    // the division under H-31; this is the reading half.
    //
    // The answer is the division holding the reader's BOOK, so in an edition
    // spanning both halves the corner changes as they cross into Matthew — and
    // in an edition holding one, it is simply that edition's own emblem. Null
    // when nothing is declared, which leaves whatever the volume config
    // painted rather than blanking the corner.
    cornerImageFor: item => {
      const volume = manifest?.__wallVolume;
      const edition = options?.activeEdition || options?.translation || null;
      if (!volume || !edition || typeof volume.divisionsFor !== 'function') return null;
      const divisions = volume.divisionsFor(edition);
      if (!divisions.length) return null;
      const unitId = bookIdOf(item);
      const holding = unitId
        ? divisions.find(d => Array.isArray(d.books) && d.books.includes(unitId))
        : null;
      // No book in hand — the root, a division ring — so the emblem is the
      // one the reader is about to enter, which is the first this edition has.
      //
      // THREE ANSWERS, AND THE THIRD IS WHY THIS IS NOT `|| null` (2026-08-24).
      // `null` above means THIS VOLUME CANNOT ANSWER — it declares no emblems
      // at all — and the host leaves the corner alone, which is right for the
      // catalog and the calendar. An EDITION that declares no emblem is a
      // different answer entirely: it is a measurement, and returning null for
      // it made the host keep whatever was already there. So a reader in the
      // Hebrew who committed the Greek Old Testament went on reading Swete
      // under a TORAH SCROLL, because Swete's division declares no image and
      // the badge was never told to clear.
      //
      // The empty string is that third answer: "asked, and there is none".
      // Same shape as `chartedUnitsOf`'s populated / empty / null, for the
      // same reason — a missing instrument must never read as a measurement,
      // and a measurement of nothing must never read as a missing instrument.
      const image = (holding || divisions[0]).image;
      return image || '';
    },

    // AND THE CIRCLE UNDER IT (O-79, Howell 2026-08-20): *"the color of the
    // circle under the image file (which becomes the Detail Sector
    // background) should change between testaments."*
    //
    // Same question, same signal, same answer shape as the emblem above —
    // which division holds the reader's book — because it is the same badge:
    // the emblem sits ON this circle and expands with it into the leaf's
    // background. Splitting them across two signals would let the crown of
    // thorns arrive over the Old Testament's blue for a frame.
    //
    // Null where the division declares no colour, and null means the volume's
    // own `color_scheme.detail_sector` still governs — so every other volume,
    // and this one before its cargo declares anything, is untouched.
    detailSectorColorFor: item => {
      const volume = manifest?.__wallVolume;
      const edition = options?.activeEdition || options?.translation || null;
      if (!volume || !edition || typeof volume.divisionsFor !== 'function') return null;
      const divisions = volume.divisionsFor(edition);
      if (!divisions.length) return null;
      const unitId = bookIdOf(item);
      const holding = unitId
        ? divisions.find(d => Array.isArray(d.books) && d.books.includes(unitId))
        : null;
      return (holding || divisions[0]).color || null;
    },

    // WHICH EDITIONS HOLD WHERE THE READER IS STANDING (H-29's carry-out,
    // Howell 2026-08-19).
    //
    // His rule in one sentence: the chooser offers the editions that hold
    // where you are standing. *"If I'm reading Genesis 1:1 in the Vulgate and
    // tap the dimension button, I should see Hebrew as an option but not
    // Greek… if I'm reading Matthew 1:1, I should see Greek but not Hebrew."*
    // And from the other side: *"if I'm at root and tap the dimension button,
    // I should see Hebrew Greek and Latin as options."*
    //
    // So there are exactly two answers and the level chooses between them:
    //   - at the root the reader stands on the whole volume, and NOTHING is
    //     filtered — `null`, meaning no restriction, not "no editions";
    //   - at a leaf the reader stands on ONE UTTERANCE, and the answer is the
    //     editions whose chart seats it.
    //
    // The levels between are neither, and they are also the levels where the
    // globe does not appear (Howell's first statement the same day). They
    // answer by BOOK anyway rather than returning null, because a filter that
    // silently vanishes at an unreached level is how it comes back wrong.
    //
    // THE HOST CANNOT COMPUTE THIS and must not learn to. Which editions hold
    // a verse is a question about charts, utterances and units — everything
    // the wall put behind the volume — and `dimension-bridge` is deliberately
    // volume-agnostic. The adapter answers; the host carries the answer.
    editionsHoldingItem: item => {
      const volume = manifest?.__wallVolume;
      if (!volume || !item) return null;
      if (item.level === 'bibleRoot' || item.level === 'testament') return null;
      const codes = (volume.editions || []).map(e => e?.code).filter(Boolean);
      if (!codes.length) return null;
      const unitId = bookIdOf(item);
      if (!unitId) return null;
      const utterance = item.level === 'verse' ? item.meta?.utterances?.[0] : null;
      // A verse with no utterance recorded is not a reason to offer
      // everything: it is a seat we cannot place, so it falls back to its
      // book — and under leaf-and-shard (O-92) a book id is one edition's
      // word, so the book-level question also crosses on the LEAVES: another
      // edition holds the reader's book if it seats that book's first
      // utterance, whatever it calls the book it seats it in.
      const probe = utterance
        || (volume.chartFor?.(unitId, volume.editionOf?.(unitId) || null)
          ?.seats?.[0]?.utterances?.[0])
        || null;
      return probe
        ? codes.filter(code => editionSeatsUtterance(volume, code, unitId, probe))
        : codes.filter(code => volumeHoldsUnit(volume, code, unitId));
    },
    // WHERE THE GLOBE IS A LIVE QUESTION (O-96's spec, H-29's definition of
    // root; fixed 2026-08-23 on Howell's report from the LAN, "I don't see
    // the Dimension Button Globe when I migrate OUT to root").
    //
    // His spec has two cases and no third: the Dimension Button is visible
    // and functional AT ROOT, or AT A LEAF. The leaf half is the host's — it
    // shows the globe while the Detail Sector is up — so this predicate owns
    // the root half alone.
    //
    // THE BUG WAS ONE WORD OF VOCABULARY. This answered `bibleRoot` only, and
    // `bibleRoot` is the single-node gateway ring (BIBLIA SACRA LATINA) that
    // H-29 left behind when it ruled root to be the level whose child pyramid
    // holds books — the edition's own division of itself, built at level
    // `testament`. `bibleRoot` is reachable only when the host boots the
    // volume at `level: 'root'`; this volume's data declares no `startup`, so
    // the level falls through to `verse`, `hasRoot` is false, and the
    // division ring IS the top. The globe therefore had no home on the one
    // ring the reader reaches by migrating all the way out.
    //
    // Both are accepted rather than swapped: a host that does boot at root
    // still has its gateway door, and under H-29 the division ring is root in
    // either arrangement, since it is the level whose pyramid holds books.
    showsDimensionAt: item => item?.level === 'bibleRoot' || item?.level === 'testament',
    // NUMERALS SIT ON THEIR NODES, NAMES SIT BESIDE THEM (Howell
    // 2026-07-20): chapters and verses centre over the node; book and
    // testament NAMES keep the offset that reads well for words — the
    // same instinct the catalog's cylinder counts already follow.
    shouldCenterLabel: ({ item } = {}) => item?.level === 'chapter' || item?.level === 'verse',
    layoutBindings: {
      getBibleTestaments: () => buildBibleTestaments(manifest, namesMap, {
        translationName,
        // O-71: same question, same answer, wherever it is asked.
        edition: options?.activeEdition || options?.translation || null
      }),
      bibleModeRef: () => bibleMode,
      setBibleMode: next => { bibleMode = next; },
      setBibleChapterContext: ctx => { bibleChapterContext = ctx; },
      setBibleVerseContext: ctx => { bibleVerseContext = ctx; },
      // THE CHAPTERS BINDING CARRIES THE EDITION (H-14). Containers are
      // projected from the committed edition's chart (O-44), so a caller with
      // no edition gets no chapters — which is exactly what the child pyramid
      // showed on Howell's phone: Genesis in the magnifier and an empty sky
      // beneath it.
      //
      // The host cannot supply the edition; it is volume-agnostic by design
      // and this is a per-edition question. So the adapter binds it here,
      // once, and every caller downstream — the pyramid's chapters, its
      // book-level preview — asks the same bound function. Threading a fifth
      // argument through each call site instead is how one of them stays
      // wrong.
      getBibleChapters: (m, selected, nm, mode) => getBibleChapters(
        m || manifest, selected, nm || namesMap, mode,
        options?.activeEdition || options?.translation || null
      ),
      getBibleVerseItems: verseItemsForChapter,
      getBibleVerseCacheStatus,
      getBibleVerseChain: verseId => verseChain(verseId),
      getBibleChapterChain: chapterId => chapterChain(chapterId),
      prefetchBibleVerses,
      // THE PYRAMID IS A RING TOO, and it must obey the same filter (H-25
      // point 4). This called the chain WITHOUT an edition, so `visible` was
      // null and all 39 books came back — the ring showed the three confirmed
      // books while the pyramid behind it scattered the other 36 as nodes.
      // Caught on Howell's phone, not by any cell: every test asked the
      // builder directly and passed it an edition, because that is what the
      // author writing the test remembers to do.
      getBibleBooksForTestament: (testamentId) =>
        buildBibleBookCousinChain(manifest, {
          testamentId,
          names: namesMap,
          edition: options?.activeEdition || options?.translation || null
        }),
      pyramidBuilder: buildBiblePyramid
    }
  };
}

export const bibleAdapter = {
  validate,
  normalize,
  layoutSpec,
  detailFor,
  createHandlers,
  capabilities: {
    search: false,
    deepLink: false,
    theming: true,
    // At the leaf the detail sector doubles as a NEXT button
    // (the e-reader gesture: tap the verse, read the next).
    detailTapAdvances: true
  }
};
