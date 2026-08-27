// THE WALL'S READER (H-14, 2026-08-12) — the Bible boots from `volume.json`.
//
// This module is what replaces the manifest walk. It reads ONLY H-11-layout
// cargo, and there is no path through it to the pre-doctrine files: no flag,
// no fallback, no branch. Unmigrated content is not hidden here, it is
// unreachable, which is what makes H-14 a wall rather than a gate.
//
// `volume.json` IS THE SOLE ENUMERATION. Not the first source consulted — the
// only one. Nothing else says what the volume contains: not a manifest, not a
// directory listing, not an index derived from either. A unit absent from it
// does not exist, however many files sit on disk beside it. The Vulgate is the
// standing proof: fully present in `text/VUL/`, unenumerated, unreachable.
//
// THE READER'S LEVELS ARE TESTAMENT, BOOK, CHAPTER, VERSE (Howell,
// 2026-08-12). There is no section, and this module will not invent one — the
// corpus's `hierarchy_levels` still declares one, which is a stale assertion
// the engine has already outlived. A chapter is not a level here either: it is
// the render-time projection O-44 rules it to be, computed from the chart when
// asked and stored nowhere.
//
// WHAT IT NORMALISES TO, and why that is not the coexistence H-14 retired.
// Adapters load, validate and NORMALISE (the adapter contract); an internal
// shape is not cargo. What would have been forbidden is rebuilding the legacy
// shape in memory — `chapters` maps, `_external_file`, `book_key` — which is
// the hub in its last costume. None of those appears below.
import { resolvePath } from '../core/identity.js';
import { loadMargin, blockAt, entriesAt, addressOrder } from '../core/margin-source.js';
import { normalizeUnitText } from '../core/unit-text.js';
import { projectContainers } from '../core/unit-source.js';

// O-42'S PRINCIPLE SURVIVES IN `loadText` BELOW: a unit resolves
// all-or-nothing among the editions whose charts include it, and loudly —
// half a unit renders as success, and across 79 increments the one thing
// that must not happen is a botched increment looking finished. (The
// REQUIRED_PER_UNIT set that stated this died with `loadUnit`, O-65.)

export async function loadBibleVolume({ base, version, fetchJson } = {}) {
  if (typeof fetchJson !== 'function') {
    throw new Error('bible-volume: needs a `fetchJson(path)` — the transport is the caller\'s');
  }
  const at = parts => resolvePath({ base, version, ...parts });
  const volume = await fetchJson(at({ kind: 'volume' }));

  const editions = (volume?.editions || []).filter(e => e?.code);
  if (!editions.length) {
    throw new Error(
      'bible-volume: volume.json declares no editions. Under H-14 this file is the sole '
      + 'enumeration, so a volume with no editions has nothing any reader could be shown — '
      + 'and falling back to the legacy registry is the capability the wall removes.');
  }

  // THE ENUMERATION IS SHARDS AND EDITIONS, AND NOTHING ELSE (O-90/O-92,
  // leaf-and-shard, ruled 2026-08-22 — the completion of H-29's trajectory).
  //
  // The volume used to enumerate BOOKS, and that shape asserted something the
  // volume is not entitled to say: which books exist. A book is a WORD in an
  // edition's vocabulary — the Hebrew has two words (Ezra, Nehemiah) where
  // Swete's Greek has one (Esdras B) — exactly as verse numbers, chapters,
  // sections and divisions were already the edition's. What the volume owns
  // is the LEAVES and the boxes they are stored in: SHARDS, frozen storage
  // partitions named by nobody's tradition and shown to no reader. Every
  // book of every edition is declared in that edition's own chart index.
  const shards = (volume?.shards || []).map((shard, order) => ({
    id: shard.id,
    utterances: Number.isFinite(shard.utterances) ? shard.utterances : null,
    order
  }));
  if (!shards.length) {
    throw new Error('bible-volume: volume.json enumerates no shards — the volume is empty, which is a data state and not a render');
  }

  // NAMES ARE QUOTATIONS (H-2), loaded per language and never manufactured.
  // An id with no name displays unnamed; the engine may not fall back to
  // showing the id, which would be the filesystem speaking to the reader.
  const languages = [...new Set(editions.map(e => e.language).filter(Boolean))];
  const namesByLanguage = {};
  await Promise.all(languages.map(async lang => {
    try {
      namesByLanguage[lang] = await fetchJson(at({ kind: 'names', lang }));
    } catch {
      namesByLanguage[lang] = null;      // a missing tongue is unnamed, not fatal
    }
  }));

  // CHARTS ARE IN HAND BEFORE ANYTHING WALKS (O-45's move 2, which survives).
  //
  // Chapters are projected from the chart (O-44) and the walks that need them
  // — the cousin chain, the reading order, the first-leaf default — are all
  // SYNCHRONOUS. A chart arriving after the walk leaves the unit enumerated by
  // the wrong shape, which is the O-45 failure in another hat.
  //
  // THE COST, STATED: one chart fetch per edition book at boot. The honest
  // fix this comment used to defer — the per-edition chart index — is now
  // the enumeration itself (O-92), so the index tells us exactly what to
  // fetch and nothing 404s by design.
  // THE EDITION'S INDEX IS ITS BOOK ENUMERATION (O-92). It used to order a
  // shared book list; under leaf-and-shard it DECLARES the edition's own
  // books — `books: [{file, shards}]`, where `file` is the edition's book id
  // and `shards` is the build-derived fetch hint naming the storage its
  // seats draw from. Divisions and groups ride it unchanged (H-26/H-29).
  // The stale-shelf tripwire this block used to carry died with the shared
  // list: there is no second enumeration left for an index to disagree with.
  const shelves = new Map();
  await Promise.all(editions.map(async edition => {
    try {
      shelves.set(edition.code, await fetchJson(at({ kind: 'chartIndex', edition: edition.code })));
    } catch {
      shelves.set(edition.code, null);
    }
  }));

  // The books, per edition, in the edition's own order — and the book→edition
  // map that lets a caller name a book without saying whose it is (book ids
  // are minted per edition and globally unique; the suite on the cargo side
  // asserts the three id classes never collide).
  const bookMetaByEdition = new Map();
  const editionOfBook = new Map();
  for (const edition of editions) {
    const idx = shelves.get(edition.code);
    const list = Array.isArray(idx?.books) ? idx.books : [];
    const meta = list.map((b, order) => ({
      id: b.file,
      shards: Array.isArray(b.shards) ? [...b.shards] : [],
      order
    })).filter(b => b.id);
    bookMetaByEdition.set(edition.code, meta);
    for (const b of meta) editionOfBook.set(b.id, edition.code);
  }

  // CHARTS ARE FETCHED FROM THE INDEX, one per edition book. The key
  // separator is '|' and NOT a NUL — a NUL made this file BINARY to grep,
  // and Wilbur lost a real finding to it (test/no-binary-sources.test.js
  // guards the class).
  const charts = new Map();
  await Promise.all(editions.flatMap(edition =>
    (bookMetaByEdition.get(edition.code) || []).map(async book => {
      try {
        charts.set(`${book.id}|${edition.code}`,
          await fetchJson(at({ kind: 'chart', unitId: book.id, edition: edition.code })));
      } catch {
        // LOUD, because the index is the enumeration now (O-92): a book the
        // edition declares whose chart cannot load is a broken increment,
        // not a preference — the heir of the old stale-shelf tripwire.
        console.error(
          `bible-volume: ${edition.code} declares book ${book.id} and its chart failed to load — `
          + 'the book will be absent from every ring, which is a data fault, not a choice.');
        charts.set(`${book.id}|${edition.code}`, null);
      }
    })));

  // SPINES ARE PER SHARD (O-90 point 4) — same files, same ids, same order
  // as when the shard was called a book; only the claim changed. The spine
  // remains W-96's superset: every utterance any edition attests in that
  // shard, in no edition's sequence.
  const spines = new Map();
  await Promise.all(shards.map(async shard => {
    try {
      spines.set(shard.id, await fetchJson(at({ kind: 'spine', unitId: shard.id })));
    } catch {
      spines.set(shard.id, null);
    }
  }));
  // THE TEXT IS LAZY, ONE UNIT AT A TIME (O-52, 2026-08-14).
  //
  // It used to be fetched and converted for EVERY unit here, before the first
  // frame. Against the real corpus that is 39 files and 1,413 KB gzipped, and
  // 38 of them are books the reader is not looking at.
  //
  // MY OWN EAGER ARGUMENT DID NOT SAY WHAT I USED IT FOR. `unit-text.js` gives
  // three reasons to load eagerly — the phase-1 freeze, the cross-edition
  // preference chain, and O-42's all-or-nothing — and every one of them is
  // about the EDITIONS OF ONE UNIT, not about units. I conflated the axes when
  // the volume was a single book and the distinction could not show itself.
  //
  // So the axes separate here, and each keeps its own answer:
  //   - ACROSS EDITIONS, still eager. A unit's editions arrive together or the
  //     unit is incomplete; that is where the preference chain walks and where
  //     "not yet" would be indistinguishable from "not there".
  //   - ACROSS UNITS, lazy. The reader is in one book. The legacy engine
  //     fetched a container's text on demand and repainted when it landed, so
  //     this is CLOSER to the frozen feel than loading all thirty-nine was.
  //
  // The read-ahead becomes real again as a consequence: it warms the next unit
  // so a crossing is never a wait, which is what it was written for and what
  // seeding everything had quietly made inert.
  const texts = new Map();
  const loadText = async bookId => {
    if (texts.has(bookId)) return texts.get(bookId);
    let records = null;
    // A BOOK BELONGS TO EXACTLY ONE EDITION under leaf-and-shard (O-92), so
    // the cross-edition merge this function used to perform has nothing left
    // to merge: the axis O-52 separated ("across editions, eager") dissolved
    // when book ids became the edition's own words. What survives is O-42's
    // all-or-nothing per book, and W-6's honest empty on failure.
    const code = editionOfBook.get(bookId) || null;
    const chart = code ? charts.get(`${bookId}|${code}`) : null;
    try {
      if (!chart) throw new Error(`no chart for ${bookId}`);
      const file = await fetchJson(at({ kind: 'text', unitId: bookId, edition: code }));
      records = normalizeUnitText({
        editions: { [code]: file },
        declared: [code],
        // The order key matches how the cache is KEYED (O-65's second
        // defect, kept fixed): the edition's own seat labels.
        order: (chart.seats || []).map(seat => String(seat.label))
      });
    } catch {
      // A unit whose text did not arrive carries none. It is NOT filled from
      // anywhere else — the honest empty is what stops a silent substitution
      // (W-6), and the reader meets a blank rather than another tradition's
      // words wearing their language.
      records = null;
    }
    texts.set(bookId, records);
    return records;
  };

  const allBookIds = new Set([...editionOfBook.keys()]);
  return {
    version,
    base,
    // The storage layer, named for what it is (O-92). No reader ever meets a
    // shard; every ring is built from an edition's own books.
    shards,
    editions,
    namesByLanguage,
    displayConfig: volume?.display_config || {},
    // Every edition's book ids, plus the shard ids — the two id spaces the
    // H-14 existence check must recognise.
    unitIds: new Set([...allBookIds, ...shards.map(sh => sh.id)]),

    // THE EDITION'S OWN BOOKS, in its own order (O-92): [{id, shards, order}].
    // This is the roster every membership and denominator question walks —
    // there is no volume-level book list left to walk instead.
    booksFor(edition) {
      return bookMetaByEdition.get(edition) || [];
    },
    // Which edition minted this book id, or null — ids are globally unique.
    editionOf(bookId) {
      return editionOfBook.get(bookId) || null;
    },

    // The spine for a unit, or null.
    //
    // IT NO LONGER CARRIES THE ORDER (W-96, 2026-08-18). This comment said
    // "it carries the order, and nothing else does" until Wilbur caught it
    // during the verification of the very PR that retired the doctrine — the
    // same leftover shape as the format spec's line 135, which outlived O-27
    // by five days in both our sightlines. A retired rule surviving in the
    // comment of its own repeal is how it comes back. (That spec left this
    // repository under W-100 and lives with the data now; the lesson is why
    // this comment says so rather than pointing at a path.)
    //
    // What the spine is NOW: the record of every utterance a unit holds,
    // across every edition — under W-96 a SUPERSET, in no edition's sequence.
    // The order a reader moves through is the edition's, declared by its
    // chart's `seats[]`. What survives from the old sentence is only its
    // second half: an opaque id carries no order in its characters, so order
    // is always read from data and never from a name.
    spineFor(unitId) {
      return spines.get(unitId) || null;
    },

    // One record per address, every enumerated edition merged. SYNCHRONOUS and
    // cache-only: null means "not fetched yet", which is a different fact from
    // "this unit has no text", and the caller must not conflate them.
    textFor(unitId) {
      return texts.get(unitId) || null;
    },

    // Fetch-and-convert a unit's text, once. Awaiting it twice is safe; the
    // second caller gets the same promise's result from the map.
    loadTextFor(unitId) {
      return loadText(unitId);
    },

    // THE MARGIN COVERING AN ADDRESS, or null (W-165).
    //
    // Null is the ORDINARY answer and carries no complaint: only one edition
    // has an apparatus at all, only 47 of its books are captured, and 226 of
    // its blocks are held for a reading the page has to settle. W-131 and
    // W-133 put the margin on its own ladder precisely so its absence gates
    // nothing — an edition ships fully proofread with an empty margin, for as
    // long as that takes.
    //
    // The lookup needs the edition's OWN seat order, because a block covers a
    // RUN of verses and "10:2" sorts before "9:1" as a string. The chart is
    // the only thing that knows where an address sits.
    async marginAt(unitId, edition, address) {
      const chart = charts.get(`${unitId}|${edition}`);
      if (!chart) return null;
      const margin = await loadMargin({
        base, version, edition, unitId, fetchJson,
        identityOf: file => file?.book,
      });
      if (!margin) return null;
      // THE ORDER MUST BE IN THE SAME ADDRESS SPACE THE MARGIN USES, and on
      // the first build it was not — see addressOrder's own note for what that
      // cost and why it was invisible.
      const order = addressOrder(chart);
      const block = blockAt(margin, address, order);
      if (!block) return null;
      // The verse's OWN notes, not the whole page's. A block is a page of
      // apparatus and W-166 addressed each of its entries; a reader at one
      // verse wants that verse's, the way a reader looking down at the foot of
      // the page finds the line beginning with the number they are on.
      return { block, entries: entriesAt(block, address, order), source: margin.source };
    },

    // The chart for a (unit, edition), or null. Null is a real answer here —
    // an edition may genuinely not chart a unit — and the caller decides what
    // that means rather than being handed a manufactured one (H-2).
    chartFor(unitId, edition) {
      return charts.get(`${unitId}|${edition}`) || null;
    },

    // The edition's shelf chart, or null — and null means "this edition does
    // not declare an order", a real answer with its own behaviour rather than
    // a failure.
    shelfFor(edition) {
      return shelves.get(edition) || null;
    },

    // THE EDITION'S OWN TOP-LEVEL DIVISION OF ITSELF (H-29).
    //
    // "What is in the focus ring at root?" has one answer — whatever is one
    // level up from books — and there are exactly two possibilities, because
    // sections are not a level: the testaments, for an edition that declares
    // them, or the EDITION'S OWN TITLE, for one that does not. Never nothing,
    // and never a node without a name.
    //
    // Both arrive here in the same shape, a labelled range over the edition's
    // book order, which is why the engine needs no branch for the two cases:
    // the Leningrad Codex declares one division reading תנ״ך over all 39, a
    // Vulgate declares two. Each carries its IMAGE beside its name (H-31), so
    // the corner emblem and the label are one declaration.
    //
    // DIVISIONS TILE, and a gap is a data fault rather than a preference: a
    // division is a DOOR, so a book behind none is unreachable. Section groups
    // need not tile — a label is a label, and the Greek labels four books and
    // no others — which is why only this one screams.
    divisionsFor(edition) {
      const shelf = shelves.get(edition);
      const declared = Array.isArray(shelf?.divisions) ? shelf.divisions : [];
      const order = this.bookOrderFor(edition);
      // NEVER NOTHING, AND NEVER A NODE WITHOUT A NAME (H-29, Howell's
      // clarification the same day). An edition that declares no internal
      // division still gets a DOOR, because a book behind none is unreachable
      // — and the door wears THE EDITION'S OWN TITLE, which is not an
      // invention: what "no division is invented" forbids is manufacturing a
      // TESTAMENT for an edition that has none. The edition always has a name.
      //
      // Centralised here rather than repeated at each ring, so the two cases
      // — declared divisions, and the edition standing for itself — leave
      // this function in one shape and nothing downstream branches on which.
      if (!declared.length) {
        const self = (editions.find(e => e?.code === edition) || {});
        return [{
          label: self.nativeName || self.name || null,
          image: null,
          // O-79: an edition standing for itself declares no colour of its
          // own, so the volume's one detail-sector colour still governs.
          color: null,
          from: 1,
          to: order.length,
          books: [...order]
        }];
      }
      const out = [];
      let expected = 1;
      for (const d of declared) {
        if (!Number.isInteger(d?.from) || !Number.isInteger(d?.to) || d.to < d.from) continue;
        if (d.from !== expected) {
          console.error(
            `bible-volume: ${edition}'s divisions are not contiguous — ${JSON.stringify(d.label)} `
            + `starts at ${d.from}, expected ${expected}. A division is a DOOR (H-29), so a `
            + 'book behind none cannot be reached at all.');
        }
        expected = d.to + 1;
        out.push({
          label: d.label != null ? String(d.label) : null,
          image: d.image || null,
          // THE COLOUR TRAVELS WITH THE EMBLEM (O-79). It is declared beside
          // the image, for the reason this file's own `_divisions` note gives
          // about the image: it is OURS TO CHOOSE and the source cannot tell
          // us. An indigo that means New Testament asserts something about
          // this corpus exactly as a crown of thorns does (W-114), so it
          // belongs to the cargo and not to a renderer that serves every
          // volume alike. Null where none is declared.
          color: d.color || null,
          from: d.from,
          to: d.to,
          books: order.slice(d.from - 1, d.to)
        });
      }
      return out;
    },

    // The edition's BOOK ORDER: its own if it declares one, the volume's
    // otherwise. One place answers this, so nothing can order a ring by one
    // rule and seat it by another.
    //
    // A shelf naming a unit the volume does not enumerate is IGNORED rather
    // than trusted: volume.json is the sole enumeration (H-14), and a shelf
    // orders it — it never extends it. A volume unit the shelf omits keeps
    // its place, appended, so a partial shelf loses nobody.
    bookOrderFor(edition) {
      // The index's books array IS the edition's order (O-92); there is no
      // volume order to fall back to, because the volume no longer has books.
      return (bookMetaByEdition.get(edition) || []).map(b => b.id);
    },

    // Which section holds this unit in this edition, or null (H-26).
    //
    // THE LOOKUP IS BY SHELF ORDINAL, never by position in whatever ring is
    // on screen. The ring is filtered to confirmed units (H-25 point 4), so
    // with eight books showing, Ruth sits at ring position 8 and shelf
    // ordinal 32 — a ring-index lookup labels her Prophets and passes every
    // cell built on an unfiltered ring, because there the two agree.
    // Is every unit this volume enumerates confirmed in this edition?
    // Derived, so the last unit's confirmation finishes the edition with no
    // second act to forget (2026-08-17).
    isFullyConfirmed(edition) {
      return isEditionFullyConfirmed(this, edition);
    },

    sectionOf(edition, bookId) {
      const shelf = shelves.get(edition);
      if (!shelf || !Array.isArray(shelf.groups)) return null;
      const ordinal = this.bookOrderFor(edition).indexOf(bookId) + 1;
      if (!ordinal) return null;
      const group = shelf.groups.find(g => ordinal >= g.from && ordinal <= g.to);
      return (group && group.label) || null;
    },

    // THE INTERNAL ROOT the item builders consume. This is the adapter
    // contract's `normalize`, not a legacy shape rebuilt in memory: the
    // testament→book nesting is the hierarchy Howell ruled kept, and what is
    // deliberately ABSENT is what H-14 retired — no `sections`, no `chapters`
    // map, no `_external_file`, no `book_key`, no `sequence`. Chapters are
    // projected from the chart when asked (O-44) and stored nowhere.
    //
    // Keyed by id with the order carried as data, because ids are opaque and
    // an object's key order is not a place to keep meaning.
    // THE ROOT IS PER EDITION NOW (H-29). It took no argument while the volume
    // asserted one division of itself for everyone; that assertion is what the
    // ruling retired. An edition with no chart yet gets ONE division holding
    // every book and no label, which is the honest degenerate case — the door
    // must exist or nothing is reachable, and a name is not invented for it.
    //
    // The KEY is `division-<n>`, positional and edition-local. It is not an
    // identity: the same body of books is a different key in another edition,
    // and that is correct, because switching edition rebuilds the chain
    // outright. Nothing persists a division key.
    toRoot(edition) {
      // The manifest tree is built ONCE at boot and the reader may change
      // edition later, so this is a SCAFFOLD rather than the answer: every
      // ring that shows divisions asks `divisionsFor` live, with the edition
      // in hand. Defaulting to the first declared edition keeps the scaffold
      // well-formed for the consumers that only need books to exist.
      const code = edition || editions[0]?.code || null;
      const divisions = this.divisionsFor(code);
      const known = new Set(this.bookOrderFor(code));
      // `divisionsFor` always returns at least one, so there is nothing to
      // fall back to here any more. Leaves per book come from the edition's
      // own chart (O-92): a book's size is the count of its seats, since the
      // seat list IS its content declaration.
      const shape = divisions;
      return {
        display_config: this.displayConfig,
        testaments: Object.fromEntries(shape.map((d, order) => [`division-${order}`, {
          sort_number: order,
          name: d.label,
          image: d.image,
          books: Object.fromEntries(d.books
            .filter(id => known.has(id))
            .map((id, i) => [id, {
              leaves: (this.chartFor(id, code)?.seats || []).length || null,
              sort_number: i,
              testamentId: `division-${order}`
            }]))
        }]))
      };
    },

    // THE ENUMERATION ANSWERS THE ONLY MEMBERSHIP QUESTION THERE IS.
    has(unitId) { return this.unitIds.has(unitId); },

    pathFor(kind, unitId, edition) {
      if (!this.has(unitId)) {
        throw new Error(
          `bible-volume: ${JSON.stringify(unitId)} is not in volume.json, so it does not exist (H-14). `
          + 'Files may sit on disk for it; the enumeration is what the engine can see.');
      }
      return at({ kind, unitId, edition });
    }
  };
}

// THE VOLUME'S SEATS, FLAT AND ORDERED (H-14) — what the cousin weaver eats.
//
// This replaces `expandChart`, which existed to reconcile a legacy chart
// format against a manifest that stored chapters. Neither survives the wall,
// and the replacement is markedly simpler because an H-11 chart already says
// what the old one had to be interrogated for: `seats` are the edition's own
// addresses in its own order, and `groups` are its containers over
// book-ordinal ranges.
//
// WHAT IS GONE WITH THE OLD ONE, and it is worth naming because it was real
// work: the identity-chart fallback, the synthetic-span flag, the collision
// suffixing for two chapter namespaces sharing a spelling, and the
// positional-anchor guessing for unlabelled chapters. Every one of those
// existed because the chart and the storage disagreed about shape. Under
// H-11 there is one shape, so the questions are not answered better — they
// stop being askable. Same move as the slot-versus-label off-by-one.
//
// A SEAT BELONGS TO THE CONTAINER HOLDING ITS FIRST UTTERANCE. That rule is
// stated once, here, and it is the only place a seat is assigned: an address
// may span several utterances (W-21), and where it does, the first is where
// the text lives (W-30).
// WHICH BOOKS MAY THE READER REACH IN THIS EDITION? (H-25 point 4's
// carry-out, Howell 2026-08-15.)
//
// The flag is a development instrument. WITHOUT it the reader sees only what
// has been confirmed — the confirmed books entire, and nothing else, not the
// unconfirmed ones marked. WITH it everything KNOWN appears and the NOT
// PROOFREAD mark says which parts are unconfirmed. It is not expected to do
// anything on a public host, because only complete, fully-proofread editions
// are uploaded, so there is nothing there for it to lift.
//
// This joins the doctrine already in this file rather than competing with it.
// `expandVolumeSeats` holds "ABSENT FROM THE CHART IS ABSENT FROM THE
// EDITION"; this is its sibling clause — absent from `proofreadUnits` is
// absent from the READER. Both answer membership, both answer it per edition,
// and both refuse to manufacture what the data does not declare.
//
// An edition that declares NO `proofreadUnits` is unfiltered: it is either
// fully proofread or not yet marked per book, and in neither case may this
// invent a restriction the data did not state.
// DOES THIS EDITION HOLD THIS UNIT? (O-71, ruled 2026-08-19.)
//
// `expandVolumeSeats` has always enforced "ABSENT FROM THE CHART IS ABSENT
// FROM THE EDITION" at the verse level, inline. Nothing above it enforced
// anything: the book ring filtered by PROOFREAD-ness and the testament ring
// filtered by nothing at all, so with two disjoint editions in the volume the
// Greek showed all 39 Tanakh books — named in Greek, sized by prominence,
// entering nothing — and the Hebrew showed all 27 of the New Testament.
//
// Membership is one question and it now has one answer, hoisted out of the
// seat expander so every ring asks the same thing the expander will. A ring
// that offers a book whose verses the expander then refuses is a container
// kept alive for no one, which is the shape the book ring's own comment
// already named while guarding the wrong predicate.
//
// The SPINE is part of the test because the expander requires it: a unit with
// a chart and no spine is an unfinished increment, and it must be absent from
// the ring for the same reason it is absent from the chain.
export function volumeHoldsUnit(volume, edition, bookId) {
  if (!volume || !edition || !bookId) return false;
  // Under leaf-and-shard the seat list IS the book's content declaration
  // (O-90 point 3), so the old per-unit spine clause has nothing further to
  // add: a chart with seats is a book with content, and a chart without one
  // is an unfinished increment exactly as before.
  const chart = typeof volume.chartFor === 'function' ? volume.chartFor(bookId, edition) : null;
  return Boolean(chart && Array.isArray(chart.seats) && chart.seats.length);
}

// DOES THIS EDITION SEAT THIS UTTERANCE? (H-29's carry-out, 2026-08-19.)
//
// Howell's rule for the dimension chooser: it offers the editions that hold
// WHERE THE READER IS STANDING. At the root that is the whole volume, so
// everything is offered; at a leaf it is one utterance, and the Vulgate reader
// in Genesis must be offered the Hebrew and not the Greek, then the Greek and
// not the Hebrew four chapters into Matthew.
//
// A leaf asks a FINER question than a book, and the difference is not
// theoretical: two editions can share a book and disagree about a verse inside
// it. `volumeHoldsUnit` cannot answer that, and answering it by building the
// other edition's whole chain — which is what `reseatOnEditionChange` does,
// and then discards — costs a chain per edition per settle.
//
// The chart already knows. Its seats carry their utterances, so the question
// is a lookup: does any seat in this edition's chart for this unit claim this
// utterance? An utterance belongs to exactly ONE unit by construction — the
// spine is per-unit and holds every utterance any edition attests there — so
// there is no second place to look and no ambiguity about where to look first.
export function editionSeatsUtterance(volume, edition, bookId, utteranceId) {
  return Boolean(bookSeatingUtterance(volume, edition, bookId, utteranceId));
}

// WHERE does this edition seat this utterance? (O-94, 2026-08-23.)
//
// The same lookup as above, answering with the BOOK rather than with yes or
// no — because two callers need the two answers and one instrument should
// serve both. The chooser asks "is this edition here?" and wants a boolean;
// the preview asks "what does the hovered edition call the place I am
// standing?" and wants the book, so it can be named in that edition's own
// tongue.
//
// This is what dissolves the false demand O-94 numbers. Without it the
// preview kept the COMMITTED edition's book id and looked it up in the
// HOVERED tongue's names — asking Hebrew for the name of a Greek book — and
// the only way to make that answer was for every tongue to carry every other
// edition's vocabulary. Through the leaf, a tongue needs the books of its own
// editions and nothing else.
//
// Returns null rather than throwing when the edition does not hold the leaf:
// that is a real answer (the reader is somewhere this edition never went),
// and the caller keeps whatever name it already had.
export function bookSeatingUtterance(volume, edition, bookId, utteranceId) {
  if (!utteranceId) return null;
  // The caller's bookId is usually ANOTHER edition's word for where the
  // reader stands (O-92): the Hebrew's Nehemiah while asking whether the
  // Greek holds the verse. Book ids are per-edition now, so the asked
  // edition's own chart for that id exists only when the editions share the
  // id — try it first as the cheap case, then search the edition's own
  // books. The leaves are the bridge, exactly as W-21 ruled: what travels
  // is the utterance.
  const direct = typeof volume?.chartFor === 'function' ? volume.chartFor(bookId, edition) : null;
  if (direct && Array.isArray(direct.seats)
    && direct.seats.some(seat => Array.isArray(seat?.utterances) && seat.utterances.includes(utteranceId))) {
    return bookId;
  }
  const books = typeof volume?.booksFor === 'function' ? volume.booksFor(edition) : [];
  for (const book of books) {
    if (book.id === bookId) continue; // the direct probe above already asked
    const chart = volume.chartFor(book.id, edition);
    if (chart && Array.isArray(chart.seats)
      && chart.seats.some(seat => Array.isArray(seat?.utterances) && seat.utterances.includes(utteranceId))) {
      return book.id;
    }
  }
  return null;
}

// The units this edition holds, as a set — the ring-shaped form of the answer
// above, for the callers that filter a list rather than test one id.
//
// THREE ANSWERS, AND THE THIRD IS THE ONE THAT MATTERS:
//   a populated Set — these units and no others;
//   an EMPTY Set    — this edition holds nothing, a real answer with real
//                     consequences (an empty ring), not a failure;
//   `null`          — THIS VOLUME CANNOT ANSWER. It carries no enumeration to
//                     walk or no `chartFor` to ask, so it has not been built
//                     to model membership at all. Callers do not filter.
//
// The third case is deliberate and it is `confirmedUnitsOf`'s exact shape, for
// the same reason: a missing instrument must never be read as a measurement of
// zero. Collapsing it into the empty Set would make every fixture that models
// order or sections — and never charts — silently produce an empty ring, and
// a filter that removes everything looks identical to a corpus that holds
// nothing. That is the failure this whole ruling is about, and it would have
// arrived inside the fix for it.
export function chartedUnitsOf(volume, edition) {
  if (!volume || !edition) return null;
  if (typeof volume.chartFor !== 'function') return null;
  // The roster is the EDITION'S own books (O-92); `units` survives only as
  // the fallback for fixtures that still model a shared list.
  const roster = typeof volume.booksFor === 'function'
    ? volume.booksFor(edition)
    : volume.units;
  if (!Array.isArray(roster) || !roster.length) return null;
  const held = new Set();
  for (const book of roster) {
    if (volumeHoldsUnit(volume, edition, book.id)) held.add(book.id);
  }
  return held;
}

export function confirmedUnitsOf(volume, edition) {
  const declared = (volume?.editions || []).find(e => e?.code === edition);
  const units = declared?.proofreadUnits;
  return Array.isArray(units) ? new Set(units) : null;
}

// IS THIS EDITION FINISHED? Derived from the per-unit marks, never declared
// twice (Howell, 2026-08-17, from the LAN).
//
// The Hebrew reached 39 of 39 confirmed while its edition-level `proofread`
// flag was still false, so the data asserted both "no unit is unconfirmed"
// and "the edition is not proofread". At the testament ring — no book in hand
// — the mark fell back to that flag and told him his finished edition was not
// proofread.
//
// The flag could have been flipped in the data instead. That is the wrong fix:
// it makes the same fact live in two places, and the last book's confirmation
// then needs a second, separate act that nobody is reminded to perform. This
// bug IS that omission, arriving the first time it was possible.
//
// So: an edition carrying per-unit marks is finished when those marks cover
// every unit THE EDITION HOLDS. An edition carrying NO marks falls back to its
// declared flag, which is what every other edition still relies on.
//
// THE DENOMINATOR IS THE EDITION'S, NOT THE VOLUME'S (O-71, 2026-08-19). It
// was the volume's enumeration, and that was indistinguishable from correct
// for as long as the volume held one edition. The second edition arrived and
// widened the enumeration from 39 units to 66 without touching the Hebrew, so
// a finished edition began reading 39-of-66 and Howell met NOT PROOFREAD at
// the testament ring of an edition where every book he holds is confirmed.
//
// This is the 2026-08-17 bug returning through a door the fix did not cover:
// then the fault was asking the FLAG instead of deriving; now it is deriving
// against the wrong set. Both are the same mistake about whose question it is.
// An edition is finished when ITS work is finished, and books it has never
// held are not its work.
export function isEditionFullyConfirmed(volume, edition) {
  const confirmed = confirmedUnitsOf(volume, edition);
  if (confirmed === null) {
    const declared = (volume?.editions || []).find(e => e?.code === edition);
    return declared?.proofread === true;
  }
  // A volume that cannot say what the edition holds falls back to its own
  // enumeration — the pre-O-71 denominator, which is right whenever there is
  // no better answer to be had.
  const held = chartedUnitsOf(volume, edition);
  const roster = typeof volume?.booksFor === 'function'
    ? volume.booksFor(edition)
    : (volume?.units || []);
  const denominator = held ? [...held] : roster.map(u => u.id);
  return denominator.length > 0 && denominator.every(id => confirmed.has(id));
}

export function isUnitVisible(volume, edition, unitId, { includeUnconfirmed = false } = {}) {
  if (includeUnconfirmed) return true;
  const confirmed = confirmedUnitsOf(volume, edition);
  return confirmed === null ? true : confirmed.has(unitId);
}

export function expandVolumeSeats(volume, edition, { includeUnconfirmed = false } = {}) {
  if (!volume || !edition) return [];
  const items = [];
  const confirmed = includeUnconfirmed ? null : confirmedUnitsOf(volume, edition);

  // THE EDITION'S OWN ORDER (H-26/W-83). The seats come out in the order the
  // EDITION shelves its books, not the order volume.json enumerates them —
  // the Hebrew is read in the Leningrad Codex's arrangement, where Ruth sits
  // among the Writings rather than after Judges.
  //
  // Walking the shelf rather than the testaments also keeps ONE ordering rule
  // in the system: this is the same `bookOrderFor` the ring reads, so seats
  // and ring cannot disagree about what comes after what. The testament each
  // book belongs to is still carried, because it is the book's parent and the
  // section is not (H-26: sections are labels, never levels).
  // THE PARENT COMES FROM THE EDITION (H-29), not from a stored field. It was
  // read off `volume.testaments`, which no longer exists because a book's
  // division is not a fact about the book.
  const byId = new Map();
  const divisions = typeof volume.divisionsFor === 'function' ? volume.divisionsFor(edition) : [];
  // A volume that answers `divisionsFor` always gives at least one division
  // (H-29). The fallback below is for FIXTURES that model no divisions at all.
  const roster = typeof volume.booksFor === 'function'
    ? volume.booksFor(edition)
    : (volume.units || []);
  const shape = divisions.length
    ? divisions
    : [{ label: null, books: roster.map(u => u.id) }];
  const unitById = new Map(roster.map(u => [u.id, u]));
  shape.forEach((division, order) => {
    for (const id of division.books || []) {
      const book = unitById.get(id);
      if (book) byId.set(id, { book, testament: { id: `division-${order}` } });
    }
  });
  const order = typeof volume.bookOrderFor === 'function'
    ? volume.bookOrderFor(edition)
    : [...byId.keys()];

  for (const unitId of order) {
    const entry = byId.get(unitId);
    if (!entry) continue;
    {
      const { book, testament } = entry;
      // Unconfirmed is UNREACHABLE, not merely marked (H-25 point 4).
      if (confirmed && !confirmed.has(book.id)) continue;
      // ABSENT FROM THE CHART IS ABSENT FROM THE EDITION. The chart's word is
      // law and there is no per-unit fallback — membership is the edition's
      // own, and manufacturing seats for it would be the identity chart
      // returning under another name (H-2).
      //
      // THE TEST MOVED OUT, AND THAT IS THE POINT (O-71). It used to live
      // here, inline, and so answered for the chain alone while the rings
      // above answered differently or not at all. It is now the one predicate
      // every level asks. Its spine clause is unchanged from W-96 / O-69: a
      // unit without one is an unfinished increment, and nothing below reads
      // it — order comes from `seats[]`.
      if (!volumeHoldsUnit(volume, edition, book.id)) continue;
      const chart = volume.chartFor(book.id, edition);

      // CONTAINER RANGES INDEX THE CHART'S OWN SEATS, NOT THE SPINE (W-96,
      // ruled 2026-08-18; O-69 lands the engine half).
      //
      // This filled containers by SPINE ordinal: a seat belonged to the
      // container whose range held its first utterance's position in the
      // spine. That was sound while the spine was one tradition's order and
      // every edition agreed with it. Under a SUPERSET spine — every leaf any
      // edition attests, in no edition's order — it is wrong in a way that
      // does not announce itself. Measured on a four-seat edition whose seats
      // sit at spine ordinals 5, 6, 1, 2: container I took seats 3 and 4,
      // container II took none, and the edition's own first two seats fell
      // outside every container it declared and VANISHED from the chain. Not
      // a wrong order — a silent disappearance.
      //
      // Howell's ruling is the fix: the order a reader moves through belongs
      // to the edition. `seats[]` already ascends in that order (O-27), so
      // indexing it makes contiguity free — and the spine stops being asked a
      // question it was never entitled to answer.
      const containers = projectContainers(chart, { leaves: chart.seats.length });

      for (const container of containers) {
        const chapterId = `${book.id}/${container.label}`;
        for (let seatIndex = 0; seatIndex < chart.seats.length; seatIndex += 1) {
          const seat = chart.seats[seatIndex];
          const label = seat?.label != null ? String(seat.label) : null;
          const ordinal = seatIndex + 1;
          if (!label) continue;
          if (ordinal < container.from || ordinal > container.to) continue;

          items.push({
            id: `${book.id}_${container.label}_${label}`,
            name: label,
            level: 'verse',
            parentId: chapterId,
            chapterKey: chapterId,
            bookKey: book.id,
            testamentKey: testament.id,
            meta: {
              bookId: book.id,
              bookEntryId: book.id,
              chapterId,
              testamentId: testament.id,
              // THE ADDRESS IS COMPOSED FROM TWO QUOTATIONS, NOT PARSED FROM
              // ONE (O-53, 2026-08-14).
              //
              // Text belongs to the (edition, address) pair (W-21), and in a
              // multi-container unit that address is the container's label AND
              // the seat's — "1:1", not "1". The chart says as much in its own
              // provenance note: group from `<c n>`, seat from `<v n>`.
              //
              // THE ONE-BOOK FIXTURE COULD NOT SHOW THIS. Genesis 1 was a
              // single container whose text happened to be keyed by bare seat
              // number, so the seat label and the address coincided and the two
              // contracts were never asked to meet. Same shape as O-45, found
              // the same way — by pointing the reader at real cargo.
              //
              // Composing is not parsing. H-2 forbids reading structure OUT of
              // a label; this builds a key by joining two labels the data
              // stated. Measured across the whole corpus before being relied
              // on: 23,213 of 23,213 seats index their text this way, with
              // nothing unmatched on either side.
              //
              // THE JOINER IS THE UNSTATED PART, flagged rather than hidden:
              // ":" appears in no schema. An edition that addressed differently
              // would have this compose a key that does not exist, and the
              // reader would meet a blank. The durable fix is the seat carrying
              // its own address, or the chart declaring the joiner.
              verseKey: `${container.label}:${label}`,
              seatLabel: label,
              chapterLabel: container.label,
              // The address IS the key into the text this unit carries, so
              // there is no file to name and no span to resolve through. Both
              // of those were consequences of the storage the wall removed.
              //
              // `externalFile` keeps its name and stops being a file: it is
              // the UNIT'S id, used as the text cache's key. Every reader
              // downstream treats that string as opaque, so one seeding at
              // boot serves them all and none of them needed changing — the
              // same reason the funnel was worth building.
              externalFile: book.id,
              unitId: book.id,
              // THE SEAT'S POSITION IN THE EDITION'S OWN READING ORDER (O-67,
              // re-based under W-96 by O-69).
              //
              // O-67 fixed a read-ahead that had never fired: it parsed
              // `verseKey` — a composed ADDRESS, "50:26" — and got 50, the
              // chapter, then compared it against the unit's seat count. So
              // every book crossing was a cold fetch and the detail sector sat
              // blank until it landed.
              //
              // That fix carried the SPINE ordinal, which was the same number
              // while the spine was one tradition's order. Under a superset
              // spine it stops being: the read-ahead would measure the
              // reader's distance from the end of a tradition they are not
              // reading. At 100 leaves, an edition whose last-read seat sits
              // at spine ordinal 60 computes 40 remaining and never fires —
              // O-67 returning silently, for exactly the editions that reorder
              // most. It is now the seat's index in `seats[]`, which is the
              // edition's own order and the only order the reader moves in.
              unitOrdinal: ordinal,
              utterances: seat.utterances || []
            }
          });
        }
      }
    }
  }
  return items;
}

// `loadUnit` LIVED HERE AND IS DELETED (O-65, verified finding; WF-19).
//
// It bundled spine + chart + text per unit and fetched text for EVERY
// declared edition, throwing INCOMPLETE on any miss — the O-65 defect,
// preserved verbatim behind an export with ZERO callers in src/. The app
// was safe only because nothing reached for it; the next person who did
// would reintroduce the bug without touching existing code. Its doctrine
// cells moved to the live path (`loadTextFor`), where the all-or-nothing
// applies among the editions whose charts include the unit.
