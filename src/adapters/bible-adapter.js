import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { calculatePyramidCapacity, placePyramidNodes } from '../geometry/child-pyramid.js';
import { buildBibleTestaments, getBibleChapters, getBibleVerseItems, getBibleVerseCacheStatus, prefetchBibleVerses, getVerseTextResolved, getVerseTextForSeat, toTraditionNumeral, toDisplayCase } from './volume-helpers.js';
import { buildBibleVerseChain, buildBibleChapterChain } from '../navigation/cousin-builder.js';
import { seatIndexForUtterance } from '../navigation/seating-chart.js';
import { buildBibleBookCousinChain } from '../navigation/cousin-builder.js';
import { buildBiblePyramid } from '../pyramid/volume-pyramid.js';

const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';
const manifestUrl = './data/gutenberg/manifest.json';
const schemaUrl = './schemas/gutenberg.schema.json';

let manifestPath = null;
let schemaPath = null;
let nodeReadFile = null;
let nodeReadFileSync = null;
let AjvCtor = null;

let _nodeReady = null;
function _ensureNode() {
  if (isBrowser) return Promise.resolve();
  if (_nodeReady) return _nodeReady;
  _nodeReady = (async () => {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    manifestPath = path.resolve(__dirname, '../../data/gutenberg/manifest.json');
    schemaPath = path.resolve(__dirname, '../../schemas/gutenberg.schema.json');
    nodeReadFile = (await import('fs/promises')).readFile;
    nodeReadFileSync = (await import('fs')).readFileSync;
    AjvCtor = (await import('ajv')).default;
  })();
  return _nodeReady;
}

let validateFn = null;
let ajvInstance = null;

const fetchJson = async url => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
};

const getValidator = () => {
  if (isBrowser) return null;
  if (validateFn) return validateFn;
  if (!nodeReadFileSync || !schemaPath || !AjvCtor) return null;
  if (!ajvInstance) ajvInstance = new AjvCtor({ allErrors: true, strict: false });
  const schemaJson = JSON.parse(nodeReadFileSync(schemaPath, 'utf-8'));
  validateFn = ajvInstance.compile(schemaJson);
  return validateFn;
};

export async function loadManifest() {
  if (isBrowser) return fetchJson(manifestUrl);
  await _ensureNode();
  const raw = await nodeReadFile(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

// THE SEATING CHART (E1 of W-21, docs/SEATING-CHART-CONTRACT.md): the
// generated per-artifact truth about which seats exist. Fetched once per
// edition and cached — including the MISS (an artifact whose chart has not
// been generated yet caches null and the chain falls back to verse_count
// identity; W-31: LXX and THEOD chart today, the rest land as Wilbur's
// generator clears them). buildChain is awaited at launch, so the chart is
// on hand — or definitively absent — before the first chain is built.
const seatingChartCache = new Map();

// Q3 (0c): boot AWAITS a chart fetch for the default edition, and the default
// edition has no chart — so every cold boot spends a full round trip learning
// a 404 whose answer never changes. Three artifacts are charted (LXX, THEOD,
// WLC) out of fourteen editions.
//
// The fix has two halves and this is the engine's: if the data DECLARES which
// editions are charted, we never ask about the others. `setChartedEditions`
// takes that list from the supplemental fetch at boot. Until the data carries
// it the set stays null and behaviour is exactly as before — an unknown list
// means "ask", never "assume absent", because guessing an edition is
// uncharted would silently unseat a reader whose chart does exist.
//
// The data half is O-39: one field in translations.json, Wilbur's.
let chartedEditions = null;

export function setChartedEditions(codes) {
  chartedEditions = Array.isArray(codes) && codes.length ? new Set(codes) : null;
}

export async function ensureSeatingChart(code) {
  if (!code) return null;
  if (seatingChartCache.has(code)) return seatingChartCache.get(code);
  if (chartedEditions && !chartedEditions.has(code)) {
    seatingChartCache.set(code, null);   // declared uncharted: no request at all
    return null;
  }
  let chart = null;
  try {
    if (isBrowser) {
      chart = await fetchJson(`./data/gutenberg/seating/${code}.json`);
    } else {
      await _ensureNode();
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const dir = path.dirname(fileURLToPath(import.meta.url));
      chart = JSON.parse(await nodeReadFile(path.resolve(dir, `../../data/gutenberg/seating/${code}.json`), 'utf-8'));
    }
  } catch {
    chart = null;
  }
  // A chart wearing the wrong edition is a deployment accident, not data —
  // refuse it and fall back rather than seat a reader by another's chart.
  if (chart && chart.edition !== code) chart = null;
  seatingChartCache.set(code, chart);
  return chart;
}

// Synchronous read of an already-fetched chart, for chain builds that happen
// mid-session (descent to the verse ring). Boot's awaited ensureSeatingChart
// has normally populated this; a miss just means identity fallback.
export const getSeatingChart = code => (code && seatingChartCache.get(code)) || null;

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
  Object.entries(testaments).forEach(([testamentId, testament], ti) => {
    const testamentOrder = Number.isFinite(testament?.sort_number) ? testament.sort_number : ti;
    addItem({ id: testamentId, name: testament?.name || testamentId, level: 'testament', parentId: rootId, order: testamentOrder });

    // SECTIONS ARE NOT A LEVEL (Howell 2026-07-30). They were introduced only
    // to subdivide a testament's books so they would fit the child pyramid;
    // the star field solved that, and nothing has navigated them since — the
    // volume enters testament, book, chapter and verse, never section. Books
    // therefore hang directly off their testament, which is what the reader
    // has always seen. The manifest keeps its sections (they are real
    // scholarly divisions and Wilbur's to own) and `sectionId` still rides in
    // item metadata as provenance; only the navigable LEVEL is retired.
    const sections = testament?.sections || {};
    Object.entries(sections).forEach(([sectionId, section]) => {
      const books = section?.books || {};
      Object.entries(books).forEach(([bookId, book], bi) => {
        const bookOrder = Number.isFinite(book?.sort_number) ? book.sort_number : (Number.isFinite(book?.book_number) ? book.book_number : bi);
        addItem({
          id: bookId,
          name: book?.book_name || book?.name || bookId,
          level: 'book',
          parentId: testamentId,
          order: bookOrder,
          meta: { testamentId, sectionId, bookNumber: book?.book_number ?? null }
        });

        const chapters = book?.chapters || {};
        Object.entries(chapters).forEach(([chapterKey, chapterVal], ci) => {
          const chapterId = chapterVal?.id || `${bookId}:${chapterKey}`;
          const chapterNumber = chapterVal?.chapter_number ?? Number.parseInt(chapterKey, 10);
          const chapterOrder = Number.isFinite(chapterVal?.sort_number) ? chapterVal.sort_number : (Number.isFinite(chapterNumber) ? chapterNumber : ci);
          addItem({
            id: chapterId,
            name: chapterVal?.name || chapterKey,
            level: 'chapter',
            parentId: bookId,
            order: chapterOrder,
            meta: {
              testamentId,
              sectionId,
              bookId,
              chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : null,
              chapterKey,
              externalFile: chapterVal?._external_file
                || `data/gutenberg/chapters/${bookId}/${String(chapterKey).padStart(3, '0')}.json`
            }
          });
        });
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

function findBook(manifest, bookId) {
  const testaments = manifest?.Gutenberg_Bible?.testaments || {};
  for (const testament of Object.values(testaments)) {
    const sections = testament?.sections || {};
    for (const section of Object.values(sections)) {
      const books = section?.books || {};
      if (books[bookId]) return books[bookId];
    }
  }
  return null;
}

function findChapter(manifest, chapterId) {
  const testaments = manifest?.Gutenberg_Bible?.testaments || {};
  for (const testament of Object.values(testaments)) {
    const sections = testament?.sections || {};
    for (const section of Object.values(sections)) {
      const books = section?.books || {};
      for (const [bookKey, bookVal] of Object.entries(books)) {
        const chapters = bookVal?.chapters || {};
        for (const [chapterKey, chapterVal] of Object.entries(chapters)) {
          const id = chapterVal?.id || `${bookKey}:${chapterKey}`;
          if (id === chapterId) {
            return { chapter: chapterVal, book: bookVal };
          }
        }
      }
    }
  }
  return null;
}

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

function chaptersInReadingOrder(manifest) {
  if (_chapterOrder) return _chapterOrder;
  const bible = manifest?.Gutenberg_Bible;
  const order = [];
  Object.entries(bible?.testaments || {}).sort(byDeclaredOrder).forEach(([, testament]) => {
    Object.entries(testament?.sections || {}).sort(byDeclaredOrder).forEach(([, section]) => {
      Object.entries(section?.books || {}).sort(byDeclaredOrder).forEach(([bookId, book]) => {
        Object.entries(book?.chapters || {}).sort(byDeclaredOrder).forEach(([chapterKey, chapter]) => {
          order.push({
            chapterId: chapter?.id || `${bookId}:${chapterKey}`,
            bookId: book?.book_key || bookId,
            externalFile: chapter?._external_file || chapter?.external_file || '',
            verseCount: Number.isFinite(chapter?.verse_count) ? chapter.verse_count : 0
          });
        });
      });
    });
  });
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
  const here = order.findIndex(c => c.chapterId === meta.chapterId);
  if (here < 0 || here + 1 >= order.length) return;
  const verseKey = Number.parseInt(meta.verseKey, 10);
  const remaining = order[here].verseCount - verseKey;
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
    const chapterCount = Object.keys(book.chapters || {}).length;
    const bookNumber = book.book_number;
    const subtitle = [bookNumber ? `Book ${bookNumber}` : null, chapterCount ? `${chapterCount} chapters` : null]
      .filter(Boolean)
      .join(' · ');
    return {
      type: 'card',
      title: book.book_name || book.name || selected.name || id,
      body: subtitle || 'Book overview'
    };
  }

  if (level === 'chapter') {
    const lookup = findChapter(manifest, id);
    const chapterName = lookup?.chapter?.name || selected.name || id;
    const bookName = lookup?.book?.book_name || lookup?.book?.name || lookup?.book?.id || '';
    return {
      type: 'text',
      text: bookName ? `${bookName}: ${chapterName}` : chapterName
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
    const chapterItems = getBibleChapters(manifest, { id: options.bookId }, namesMap, 'book');
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
  let chapterChainChart;
  const chapterChain = initialChapterId => {
    const chart = getSeatingChart(options?.activeEdition || options?.translation || null);
    if (!chapterChainItems || chapterChainChart !== chart) {
      chapterChainItems = buildBibleChapterChain(manifest, {
        namesMap,
        seats: chart ? buildBibleVerseChain(manifest, { chart }).items : null
      }).items;
      chapterChainChart = chart;
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
  let verseChainChart;
  const verseChain = initialVerseId => {
    const chart = getSeatingChart(options?.activeEdition || options?.translation || null);
    if (!verseChainItems || verseChainChart !== chart) {
      verseChainItems = buildBibleVerseChain(manifest, { chart }).items;
      verseChainChart = chart;
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
    if (level !== 'verse' && level !== 'chapter') return false;

    const previousSeats = Array.isArray(verseChainItems) ? verseChainItems : [];
    const chart = getSeatingChart(options?.activeEdition || options?.translation || null);
    const rebuilt = buildBibleVerseChain(manifest, { chart }).items;
    if (!rebuilt.length) return false;

    // The reader is standing on a verse, or on a chapter — in which case the
    // thing that travels is its first verse, since a chapter is only a name
    // for the utterances under it.
    const anchor = level === 'verse'
      ? selected
      : previousSeats.find(it => it
          && (it.meta?.chapterId === selected.id || it.chapterKey === selected.id));
    if (!Array.isArray(anchor?.meta?.span)) return false;

    const seatFor = it => {
      if (!it || !Array.isArray(it.meta?.span) || !it.meta.span.length) return -1;
      const [k, o] = it.meta.span[0];
      return seatIndexForUtterance(rebuilt, it.bookKey, k, o);
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
    if (target < 0) return false;

    // Adopt the rebuilt chain, and drop the chapters cache so the ring above
    // — and the sky under it — are rebuilt from these same seats (E3).
    verseChainItems = rebuilt;
    verseChainChart = chart;
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
    const chart = getSeatingChart(options?.activeEdition || options?.translation || null);
    if (!chart || !chapterItem) return getBibleVerseItems(chapterItem);
    const chain = verseChainItems || buildBibleVerseChain(manifest, { chart }).items;
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
    // A chapter the chart does not seat at all falls back rather than
    // emptying the sky — the reader is never shown a blank where the data
    // simply has not caught up.
    return seats.length ? seats : getBibleVerseItems(chapterItem);
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
        names: namesMap
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
        translationName
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
      names: namesMap
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
    const chapterId = item.meta?.chapterId || item.parentId || '';
    const chapterKey = chapterId.includes(':') ? chapterId.split(':').pop() : chapterId;
    if (!chapterKey) return '';
    const n = Number.parseInt(chapterKey, 10);
    const numeral = Number.isFinite(n) ? toTraditionNumeral(n, namesMap?.locale) : String(chapterKey);
    // Only a suffix if the label actually carries a name in front of it.
    return getParentLabel(item) === numeral ? '' : numeral;
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
      const chapterId = item.meta?.chapterId || item.parentId || '';
      const chapterKey = chapterId.includes(':') ? chapterId.split(':').pop() : chapterId;
      if (!chapterKey) return '';
      const n = Number.parseInt(chapterKey, 10);
      // The parent button names the reader's chapter, so it counts in the
      // reader's own letters — namesMap carries the live locale (W-16), the
      // same table this line's book name comes from. Hardcoded Roman here
      // was why 'Αʹ ΣΑΜΟΥΗΛ XVII' wore two traditions at once.
      const chapterLabel = Number.isFinite(n) ? toTraditionNumeral(n, namesMap?.locale) : String(chapterKey);
      const bookId = item.meta?.bookEntryId || item.meta?.bookId || '';
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
    showsDimensionAt: item => item?.level === 'bibleRoot',
    // NUMERALS SIT ON THEIR NODES, NAMES SIT BESIDE THEM (Howell
    // 2026-07-20): chapters and verses centre over the node; book and
    // testament NAMES keep the offset that reads well for words — the
    // same instinct the catalog's cylinder counts already follow.
    shouldCenterLabel: ({ item } = {}) => item?.level === 'chapter' || item?.level === 'verse',
    layoutBindings: {
      getBibleTestaments: () => buildBibleTestaments(manifest, namesMap, { translationName }),
      bibleModeRef: () => bibleMode,
      setBibleMode: next => { bibleMode = next; },
      setBibleChapterContext: ctx => { bibleChapterContext = ctx; },
      setBibleVerseContext: ctx => { bibleVerseContext = ctx; },
      getBibleVerseItems: verseItemsForChapter,
      getBibleVerseCacheStatus,
      getBibleVerseChain: verseId => verseChain(verseId),
      getBibleChapterChain: chapterId => chapterChain(chapterId),
      prefetchBibleVerses,
      getBibleBooksForTestament: (testamentId) =>
        buildBibleBookCousinChain(manifest, { testamentId, names: namesMap }),
      pyramidBuilder: buildBiblePyramid
    }
  };
}

export const bibleAdapter = {
  loadManifest,
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
