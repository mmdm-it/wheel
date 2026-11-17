import { weaveCousinChain } from '../adapters/volume-helpers.js';
import { chaptersFromSeats } from './seating-chart.js';
import { expandVolumeSeats, chartedUnitsOf } from '../adapters/bible-volume.js';

const GAP = null;

const bySortNumber = (a, b) => {
  const as = Number.isFinite(a[1]?.sort_number) ? a[1].sort_number : parseInt(a[0], 10) || 0;
  const bs = Number.isFinite(b[1]?.sort_number) ? b[1].sort_number : parseInt(b[0], 10) || 0;
  return as - bs;
};

// Books hang from testaments with nothing between (H-14): the section was
// never a level a reader could stand on, and it is gone from the enumeration.
function findBibleBook(manifest, bookId) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible) return null;
  for (const [testamentId, testament] of Object.entries(bible.testaments || {})) {
    const book = (testament?.books || {})[bookId];
    if (book) return { book, testamentId };
  }
  return null;
}

/**
 * THE CONTINUOUS VERSE CHAIN — every verse in the volume, in order, woven
 * with cousin gaps (Howell 2026-07-20: "the Bible should have cousin gaps
 * and second cousin gaps just like the calendar"). The reader finishes a
 * chapter and keeps reading; they no longer have to back out to the
 * chapters ring to cross a boundary.
 *
 * GAP LADDER, by the established grammar: a chapter crossing is a COUSIN
 * gap, a book crossing a SECOND cousin, a testament crossing a THIRD —
 * 2 / 4 / 6 empty links, the same ranks the timeline uses for month,
 * year and century.
 *
 * Built without fetching a single chapter. Verse TEXT is not here and is
 * not wanted here: it arrives per chapter, on demand, and the detail
 * sector reads it from the cache.
 *
 * SINCE W-21 the chain's source is the SEATING CHART
 * (docs/SEATING-CHART-CONTRACT.md): membership and labels are the active
 * artifact's own, not the spine's. Pass the artifact's chart and the chain
 * holds exactly its seats — welds, regroupings, absences and all. With no
 * chart (none generated yet, or fetch missed), the identity chart derived
 * from verse_count reproduces the old behaviour EXACTLY (proven by test) —
 * phantom seats included, by design: data first, engine tolerant.
 */
// ONE EXPANSION PER EDITION (O-205, 2026-10-22). Expanding the whole
// volume's seats — every leaf of every book, tens of thousands — and weaving
// them is the single largest cost in the engine, and it was paid at boot,
// again on the first drill out (the chapter chain asked for the seats
// afresh), and again for the verse index behind the sky: three times for one
// answer, and two of them under the reader's thumb. The woven chain is kept
// here per volume and edition and handed out by identity, so every cache
// downstream that compares chains finds the same one. The charts it was woven
// from are remembered: a chart that lands later (O-175) is a new object, and
// the chain is woven again. Nothing in the engine mutates a chain's items —
// the adapter has shared one array across its callers since W-21.
const chainMemo = new WeakMap();
function chartStamp(volume, edition) {
  const books = typeof volume.booksFor === 'function' ? (volume.booksFor(edition) || []) : (volume.units || []);
  return typeof volume.chartFor === 'function' ? books.map(b => volume.chartFor(b.id, edition)) : [];
}
function wovenVerseChain(volume, edition) {
  const proofread = false;   // O-229: the flag is retired; includeUnconfirmed was inert since O-124
  const key = `${edition}|${proofread ? 1 : 0}`;
  const stamp = chartStamp(volume, edition);
  let perVolume = chainMemo.get(volume);
  if (!perVolume) { perVolume = new Map(); chainMemo.set(volume, perVolume); }
  const kept = perVolume.get(key);
  if (kept && kept.stamp.length === stamp.length && kept.stamp.every((c, i) => c === stamp[i])) return kept.items;
  const sorted = expandVolumeSeats(volume, edition, { includeUnconfirmed: proofread });
  // The seats arrive in the EDITION'S OWN ORDER already: expandVolumeSeats
  // walks bookOrderFor. Nothing to re-sort here, and a sort here was actively
  // wrong — see the note on the book chain below.
  const items = weaveCousinChain(sorted, [
    item => item.chapterKey,
    item => item.bookKey,
    item => item.testamentKey
  ]);
  perVolume.set(key, { stamp, items });
  return items;
}

export function buildBibleVerseChain(manifest, { initialVerseId = null, fallbackVerseId = null, edition = null } = {}) {
  // THE SEATS COME FROM THE VOLUME (H-14). This took a legacy chart and
  // expanded it against a manifest that stored chapters; both are gone, and
  // with them the identity-chart fallback that stood behind them.
  //
  // THAT FALLBACK'S ABSENCE IS THE POINT, not an omission. It manufactured
  // labels from a verse count — which H-2 rules is manufacture — and it was
  // reached whenever a chart was missing, so an edition with no chart quietly
  // got a plausible invented one. Under the wall an edition that does not
  // chart a unit simply does not seat it, and the reader is shown nothing
  // rather than a fiction.
  const volume = manifest?.__wallVolume;
  const items = volume ? wovenVerseChain(volume, edition) : [];
  if (!items.length) return { items: [], selectedIndex: 0, preserveOrder: true };

  // The entry seat; failing that the fallback (the first visit's verse,
  // O-179); failing both, the first seat.
  let selectedIndex = 0;
  for (const wanted of [initialVerseId, fallbackVerseId]) {
    if (!wanted) continue;
    const idx = items.findIndex(item => item && item.id === wanted);
    if (idx >= 0) { selectedIndex = idx; break; }
  }
  return { items, selectedIndex, preserveOrder: true };
}

export function buildBibleBookCousinChain(manifest, { testamentId, bookId, initialItemId, names = {}, edition = null } = {}) {
  const bible = manifest?.Gutenberg_Bible;
  if (!bible) return { items: [], selectedIndex: 0, preserveOrder: true };
  // WHAT THIS RING MAY OFFER IS TWO QUESTIONS, AND IT ONLY ASKED ONE.
  //
  // UNCONFIRMED BOOKS ARE NOT ON THE RING (H-25 point 4, Howell 2026-08-15).
  // Without the flag the reader reaches the confirmed books and nothing else.
  // With the flag, or for an edition declaring no per-book marks, that filter
  // lifts — and until O-71 the lifting left NOTHING behind it.
  //
  // BOOKS THE EDITION DOES NOT HOLD ARE NOT ON THE RING EITHER (O-71,
  // 2026-08-19). This comment already stated the standard — "must not offer a
  // book whose verses the seat expander will refuse to produce" — and then
  // guarded proofread-ness, which is a different fact that happened to
  // coincide while the volume held one edition. With the Hebrew and the Greek
  // in the volume, and the proofread flag on (the Greek is not servable
  // without it), the filter was null and the ring offered all sixty-six: the
  // Greek showed the whole Tanakh named in Greek, the Hebrew the whole New
  // Testament named in Hebrew, every node dressed and sized and entering
  // nothing. Precisely the container kept alive for no one.
  //
  // The membership filter is UNCONDITIONAL — it is not a development view's
  // concern, and no flag may lift it, because a book the edition has never
  // held has nothing to show anyone.
  //
  // THE PROOFREAD FILTER THAT NARROWED IT IS GONE (O-124, Howell 2026-09-01).
  // Off the house network the ring used to seat confirmed books only; now it
  // seats every book the edition holds, and the NOT PROOFREAD mark says which
  // of them — and which chapters of them (W-231) — are not yet read against
  // the page. Reachable and marked, in place of unreachable.
  const held = edition ? chartedUnitsOf(manifest?.__wallVolume, edition) : null;
  const visible = held;
  const testaments = Object.entries(bible.testaments || {});
  const resolveTestamentId = () => {
    if (bookId) {
      const located = findBibleBook(manifest, bookId);
      if (located?.testamentId) return located.testamentId;
    }
    if (testamentId && (bible.testaments || {})[testamentId]) return testamentId;
    const sorted = [...testaments].sort(bySortNumber);
    return sorted[0]?.[0];
  };

  const activeTestamentId = resolveTestamentId();
  if (!activeTestamentId) return { items: [], selectedIndex: 0, preserveOrder: true };
  const testamentNames = names?.testaments || {};
  const bookNames = names?.books || names || {};

  // EVERY book in the volume, not just one testament's (Howell 2026-07-20:
  // "the same complete sweep needs to work with chapters and books"). A
  // double-flick runs Genesis to Apocalypse at this level too, and the
  // testament crossing is a COUSIN gap — one rank up from the ring, the
  // same grammar the timeline uses for a year over its months.
  //
  // Books stay FLAT across sections: the section is carried as metadata for
  // back-navigation but is not a UI level and earns no gap.
  // EACH ITEM CARRIES ITS OWN SECTION (H-26). The label must follow the ring
  // LIVE as it turns, the way the child pyramid does — not wait for a settle —
  // so the view reads the section off whichever node is nearest the magnifier
  // on every frame. It can only do that if the answer travels WITH the item.
  //
  // It also means the view needs no vocabulary of its own: an item that has a
  // section shows one, an item that has none shows nothing, so chapters and
  // verses turn the label off without the view knowing what a chapter is.
  const sectionOf = edition && manifest?.__wallVolume?.sectionOf
    ? id => manifest.__wallVolume.sectionOf(edition, id)
    : () => null;

  // THE BOOKS COME FROM THE EDITION, LIVE — never from the boot scaffold
  // (O-87, found by Howell on the LAN 2026-08-22). `toRoot()` is called once,
  // with no argument, and defaults its `testaments` tree to the FIRST
  // declared edition — its own comment calls it a scaffold and says every
  // ring that shows divisions must ask `divisionsFor` live. This builder was
  // the one still walking the scaffold to enumerate BOOKS, so every book of
  // any later edition was invisible to it: the Greek chain came back empty,
  // the parent handler returned false, and migrating out of the chapters
  // ring did nothing at all. The Hebrew never showed it, being first.
  //
  // The scaffold walk below survives as the FALLBACK, because fixtures and
  // any manifest without a wall volume build their testaments by hand.
  const wall = manifest?.__wallVolume;
  const liveDivisions = wall && edition && typeof wall.divisionsFor === 'function'
    ? wall.divisionsFor(edition)
    : null;

  const sorted = [];
  if (Array.isArray(liveDivisions) && liveDivisions.length) {
    const roster = typeof wall.booksFor === 'function' ? wall.booksFor(edition) : (wall.units || []);
    const unitById = new Map(roster.map(u => [u.id, u]));
    liveDivisions.forEach((d, order) => {
      (d.books || []).forEach((id, i) => {
        if (visible && !visible.has(id)) return;
        const unit = unitById.get(id);
        sorted.push({
          id,
          section: sectionOf(id),
          // A NAME IS A QUOTATION (H-2): unnamed is honest, an id is not.
          name: bookNames?.[id] || null,
          sort: i,
          level: 'book',
          // The division key is positional and edition-local, exactly as
          // toRoot() names it — nothing persists it (H-29).
          testamentId: `division-${order}`,
          parentName: d.label || null,
          prominence: Number.isFinite(unit?.prominence) ? unit.prominence : undefined
        });
      });
    });
    // EVERY BOOK OF EVERY EDITION STANDS ON THIS RING, WHERE THE VOLUME SAYS
    // ITS BOOKS ARE SEPARATE WORKS (O-303, Howell 2026-11-15: each catechism
    // is its own book in the Church, and the globe chooses the language
    // within it). The Bible's editions seat one set of leaves, so its ring
    // shows the books of the edition up and nothing else (O-71, above) — a
    // rule that stands untouched, because the Bible declares nothing here. A
    // volume of catechisms is the other case: its editions share no leaf, a
    // book is a work of its own, and a ring that showed only the edition up
    // would change its books whenever the reader changed language — the
    // arrangement the ruling refused. So the volume declares
    // `books_across_editions`, and the ring is the union, in the volume's own
    // order of editions and never the reader's, so that it is the same ring
    // whatever tongue is up.
    //
    // A work is known by its first leaf: two editions seating the same first
    // leaf are two tongues of one book and take one seat, held by the edition
    // up if it has the work, else by one in the reader's tongue, else by the
    // first declared. (Until an edition's chart has arrived its book stands
    // for itself; no two editions share a leaf today.)
    if (wall.displayConfig?.books_across_editions === true) {
      const firstLeaf = (id, code) => wall.chartFor?.(id, code)?.seats?.[0]?.utterances?.[0] || `book:${id}`;
      const tongueOf = code => (wall.editions || []).find(e => e?.code === code)?.language || null;
      const mine = new Map(sorted.map(b => [firstLeaf(b.id, edition), b]));
      const home = liveDivisions[0];
      const foreign = (id, code) => ({
        id, section: null, name: bookNames?.[id] || null, level: 'book',
        testamentId: 'division-0', parentName: home?.label || null, prominence: undefined
      });
      const union = [];
      for (const e of wall.editions || []) {
        for (const unit of wall.booksFor(e.code) || []) {
          const work = firstLeaf(unit.id, e.code);
          const at = union.findIndex(u => u.work === work);
          if (at < 0) {
            union.push(mine.has(work) ? { work, code: edition, item: mine.get(work) } : { work, code: e.code, item: foreign(unit.id, e.code) });
          } else if (!mine.has(work) && tongueOf(e.code) === tongueOf(edition) && tongueOf(union[at].code) !== tongueOf(edition)) {
            union[at] = { work, code: e.code, item: foreign(unit.id, e.code) };
          }
        }
      }
      sorted.length = 0;
      union.forEach((u, i) => sorted.push({ ...u.item, sort: i }));
    }
  } else {
    Object.entries(bible.testaments || {}).sort(bySortNumber).forEach(([testamentKey, testament]) => {
      const testamentName = testamentNames[testamentKey] || null;
      Object.entries(testament?.books || {}).sort(bySortNumber).forEach(([bookKey, book]) => {
        if (visible && !visible.has(bookKey)) return;
        sorted.push({
          id: bookKey,
          section: sectionOf(bookKey),
          // A NAME IS A QUOTATION (H-2). The old chain fell back to the book's
          // own `book_name`, then to its id — and under opaque ids that last
          // step would print `bc22df` at the reader. Unnamed is honest; the
          // filesystem's spelling is not a name.
          name: bookNames?.[bookKey] || null,
          sort: Number.isFinite(book?.sort_number) ? book.sort_number : sorted.length,
          level: 'book',
          testamentId: testamentKey,
          parentName: testamentName,
          // Editorial prominence tier (1 featured, 2 notable, absent default):
          // declared in the data, honored by the star field's seating and size.
          prominence: Number.isFinite(book?.prominence) ? book.prominence : undefined
        });
      });
    });
  }

  // THE EDITION'S OWN ORDER (H-26/W-83) — and this is where it belongs.
  //
  // The list above comes out in VOLUME order, sort_number within testament,
  // and the edition may shelve its books differently: the Leningrad Codex
  // opens the Writings with Chronicles and seats Ruth among them, where the
  // Vulgate's order puts her after Judges.
  //
  // IT WAS PUT IN THE VERSE CHAIN BY MISTAKE and sat there through three
  // merges. The seats never needed it — expandVolumeSeats already walks
  // bookOrderFor — so verses read correctly while the BOOK RING kept volume
  // order, and the section label, which was wired correctly, faithfully
  // painted the disagreement: rotating Ezra→Nehemiah→Esther→Job in Vulgate
  // order made the label flap between Prophets and Writings, because in that
  // order the shelf's sections really do alternate. The label did not fail;
  // it reported.
  //
  // Books the shelf does not name keep their volume position, appended, so a
  // partial shelf loses nobody. Without a shelf nothing moves at all.
  const shelfOrder = edition && manifest?.__wallVolume?.bookOrderFor
    ? manifest.__wallVolume.bookOrderFor(edition)
    : null;
  // A ring of separate works keeps the volume's order (O-303): the shelf is
  // one edition's, and would pull that edition's books to the front.
  if (shelfOrder && wall?.displayConfig?.books_across_editions !== true) {
    const rank = new Map(shelfOrder.map((id, i) => [id, i]));
    const tail = shelfOrder.length;
    const rankOf = it => (rank.has(it.id) ? rank.get(it.id) : tail + (it.sort || 0));
    sorted.sort((a, b) => rankOf(a) - rankOf(b));
  }

  const chain = weaveCousinChain(sorted, [item => item.testamentId]);

  const selectedIndex = (() => {
    const findId = wanted => chain.findIndex(item => item && item.id === wanted);
    if (initialItemId) {
      const idx = findId(initialItemId);
      if (idx >= 0) return idx;
    }
    if (bookId) {
      const idx = findId(bookId);
      if (idx >= 0) return idx;
    }
    // No book named: open at the first book of the testament asked for.
    const idx = chain.findIndex(item => item && item.testamentId === activeTestamentId);
    if (idx >= 0) return idx;
    const firstReal = chain.findIndex(item => item !== GAP);
    return firstReal >= 0 ? firstReal : 0;
  })();

  return { items: chain, selectedIndex, preserveOrder: true };
}

/**
 * THE CONTINUOUS CHAPTER CHAIN — every chapter in the volume, so the
 * chapters ring sweeps Genesis I to Apocalypse XXII exactly as the verse
 * ring does. Gap ladder, one rank per level above the ring: a BOOK
 * crossing is a cousin gap (2), a TESTAMENT crossing a second cousin (4).
 *
 * Item shape matches getBibleChapters(), so descent, ascent and the
 * chapter prefetch all keep working on ids they already understand.
 */
export function buildBibleChapterChain(manifest, { initialChapterId = null, edition = null, seats = null } = {}) {
  // THE CHAPTERS RING IS COLLAPSED FROM THE SEATS (E3 of W-21), and under the
  // wall that is the ONLY way it is built.
  //
  // It used to have a second path: walk the manifest's stored chapters when
  // no chart had been generated. That path was the whole reason the two rings
  // could disagree — the chapters ring showing what the SPINE holds while the
  // verse ring showed what the EDITION holds — and E3 exists because they
  // did, offering a Greek reader chapters that edition has never had.
  //
  // H-11 removes the choice rather than the bug: chapters are not stored, so
  // there is nothing else to walk. One ring is derived from the other by
  // construction, which is what E3 was reaching for.
  const source = seats
    || (manifest?.__wallVolume ? expandVolumeSeats(manifest.__wallVolume, edition, { includeUnconfirmed: false }) : null);
  const fromSeats = source ? chaptersFromSeats(source) : null;
  if (!fromSeats) return { items: [], selectedIndex: 0, preserveOrder: true };
  return weaveChapters(fromSeats, initialChapterId);
}

function weaveChapters(sorted, initialChapterId) {
  const items = weaveCousinChain(sorted, [
    item => item.bookKey,
    item => item.testamentKey
  ]);

  let selectedIndex = 0;
  if (initialChapterId) {
    const idx = items.findIndex(item => item && item.id === initialChapterId);
    if (idx >= 0) selectedIndex = idx;
  }
  return { items, selectedIndex, preserveOrder: true };
}
