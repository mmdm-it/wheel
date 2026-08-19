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

  // The testaments, in declared order. Order is DATA, never read off an id:
  // ids are opaque under H-11 and carry no order in their characters.
  const testaments = (volume?.testaments || []).map((testament, order) => ({
    id: testament.id,
    order,
    books: (testament.books || []).map((book, bookOrder) => ({
      id: book.id,
      leaves: Number.isFinite(book.leaves) ? book.leaves : null,
      order: bookOrder,
      testamentId: testament.id
    }))
  }));

  const units = testaments.flatMap(t => t.books);
  if (!units.length) {
    throw new Error('bible-volume: volume.json enumerates no books — the volume is empty, which is a data state and not a render');
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
  // THE COST, STATED RATHER THAN DISCOVERED LATER: this is one fetch per
  // (unit × edition). Today that is one, because the volume is one book and
  // one edition. At 79 books it is 79 per edition at boot, which is NOT
  // acceptable and is not what this will be — the honest fix is a per-edition
  // chart index, which H-11 item 1 already declares and which nothing reads
  // yet. Filed as 1b's, deliberately not invented here: a rig that guesses at
  // the answer would be a second policy to unpick.
  // The key separator is '|' and NOT a NUL, which is what it used to be.
  // A NUL is a perfectly good separator — unit ids are hex and edition codes
  // are alphanumeric, so neither can contain one — and it made this file
  // BINARY as far as grep is concerned. Searches across src/ returned nothing
  // from a 500-line core file, with no warning and exit 1, so "not found"
  // read as "not present" instead of "not searched". Wilbur lost a real
  // finding to it; the guard in test/no-binary-sources.test.js keeps it out.
  const charts = new Map();
  await Promise.all(units.flatMap(unit => editions.map(async edition => {
    try {
      charts.set(`${unit.id}|${edition.code}`,
        await fetchJson(at({ kind: 'chart', unitId: unit.id, edition: edition.code })));
    } catch {
      charts.set(`${unit.id}|${edition.code}`, null);
    }
  })));

  // The spine rides with the chart because a seat is placed by its first
  // utterance's ORDINAL, and only the spine knows that. Order is data.
  // THE SHELF CHART (H-26/W-83) — the edition's own BOOK ORDER and its
  // section labels, one small file per edition.
  //
  // It is the chart-chapter shape one level up (O-44): `units[]` is the order
  // and `groups[]` are {label, from, to} over it, a labelled range and never a
  // node. The Hebrew ships the Leningrad Codex's own arrangement, which even
  // BHS declined — Writings opening with Chronicles, Ruth deep among them
  // rather than after Judges.
  //
  // IT RIDES THE HANDLE rather than being fetched wherever it is wanted, and
  // that was the reviewed decision: ORDER and MEMBERSHIP must come from the
  // same place or they can disagree. The seat expander and the confirmed-unit
  // filter already read this volume; the ring's order now does too.
  //
  // An edition without one is not an error. It shelves in volume order, which
  // is every edition's behaviour before this existed.
  const shelves = new Map();
  await Promise.all(editions.map(async edition => {
    try {
      shelves.set(edition.code, await fetchJson(at({ kind: 'chartIndex', edition: edition.code })));
    } catch {
      shelves.set(edition.code, null);
    }
  }));

  // A STALE SHELF MUST NOT BE QUIET (Wilbur's ruling on his own contract,
  // 2026-08-16). The asymmetry is his and it is right.
  //
  // A shelf that OMITS units is fine and silent: an edition may shelve what
  // it has charted so far, and `bookOrderFor` appends the rest, so a partial
  // shelf loses nobody. That is H-14 read correctly — the volume enumerates,
  // the shelf orders.
  //
  // A shelf naming units the volume does NOT enumerate is the opposite case,
  // and the reason it cannot be a silent skip is specific: the realistic
  // cause is a STALE SHELF after an id change, and W-71 changed every id in
  // the corpus once already. Filter the unknowns quietly and you find nothing
  // left to order, append everything in volume order, and the Hebrew reverts
  // to the Vulgate's arrangement with every cell green on both sides of the
  // wall. THE FEATURE VANISHING IS THE FAILURE, and it reads as nothing —
  // which is the shape this whole week has been about, arriving inside the
  // feature built because of it.
  //
  // So it is loud and then falls back: the reader keeps working on volume
  // order rather than losing the volume to a boot error. Checked once here,
  // at load, rather than in `bookOrderFor`, which answers on every ring build.
  //
  // Cargo's permutation cell refuses set-inequality at commit time, so this
  // should never fire. That is what a tripwire is.
  {
    const enumerated = new Set(units.map(u => u.id));
    for (const [code, shelf] of shelves) {
      const declared = shelf && Array.isArray(shelf.units) ? shelf.units : null;
      if (!declared || !declared.length) continue;
      const matched = declared.filter(id => enumerated.has(id));
      const unknown = declared.filter(id => !enumerated.has(id));
      if (!matched.length) {
        console.error(
          `bible-volume: the shelf chart for ${code} matches NO enumerated unit `
          + `(${declared.length} declared). This is the stale-shelf signature — ids `
          + 'changed under it. Book order falls back to volume order, which means the '
          + "edition's own arrangement is silently NOT being shown.");
      } else if (unknown.length) {
        console.error(
          `bible-volume: the shelf chart for ${code} names ${unknown.length} unit(s) the `
          + `volume does not enumerate: ${unknown.join(', ')}. They are ignored — a shelf `
          + 'orders the enumeration and never extends it (H-14) — but a shelf drifting from '
          + 'the volume is a data fault, not a preference.');
      }
    }
  }

  const spines = new Map();
  await Promise.all(units.map(async unit => {
    try {
      spines.set(unit.id, await fetchJson(at({ kind: 'spine', unitId: unit.id })));
    } catch {
      spines.set(unit.id, null);
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
  const codes = editions.map(e => e.code);
  const texts = new Map();
  const loadText = async unitId => {
    if (texts.has(unitId)) return texts.get(unitId);
    let records = null;
    // ABSENT FROM THE CHART IS ABSENT FROM THE EDITION (O-65, the same clause
    // `expandVolumeSeats` already holds). O-42's all-or-nothing conflated two
    // absences the first morning a PARTIAL edition existed: "this edition's
    // file did not ARRIVE" (a fault — all-or-nothing is right) and "this
    // edition does not CONTAIN this book" (a fact, declared by the chart).
    // Fetching every declared edition meant a book the partial edition lacks
    // 404'd, the Promise.all rejected, and the catch nulled the WHOLE unit —
    // the Hebrew went down with the Greek it never had. So membership is
    // asked of the chart first, and O-42 applies among the members.
    const present = codes.filter(code => charts.get(`${unitId}|${code}`));
    try {
      if (!present.length) throw new Error(`no edition charts ${unitId}`);
      const files = await Promise.all(present.map(code =>
        fetchJson(at({ kind: 'text', unitId, edition: code }))));
      records = normalizeUnitText({
        editions: Object.fromEntries(present.map((code, i) => [code, files[i]])),
        declared: present,
        // The order key matches how the cache is KEYED — it read
        // `${unitId} ${code}` (a space) against keys built with '|', so it
        // missed on every book of every edition and the order silently never
        // arrived (O-65's second defect).
        order: (charts.get(`${unitId}|${present[0]}`)?.seats || []).map(seat => String(seat.label))
      });
    } catch {
      // A unit whose text did not arrive carries none. It is NOT filled from
      // anywhere else — the honest empty is what stops a silent substitution
      // (W-6), and the reader meets a blank rather than another tradition's
      // words wearing their language.
      records = null;
    }
    texts.set(unitId, records);
    return records;
  };

  return {
    version,
    base,
    testaments,
    units,
    editions,
    namesByLanguage,
    displayConfig: volume?.display_config || {},
    unitIds: new Set(units.map(u => u.id)),

    // The spine for a unit, or null. It carries the order, and nothing else
    // does — an opaque id has none in its characters.
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

    // The edition's BOOK ORDER: its own if it declares one, the volume's
    // otherwise. One place answers this, so nothing can order a ring by one
    // rule and seat it by another.
    //
    // A shelf naming a unit the volume does not enumerate is IGNORED rather
    // than trusted: volume.json is the sole enumeration (H-14), and a shelf
    // orders it — it never extends it. A volume unit the shelf omits keeps
    // its place, appended, so a partial shelf loses nobody.
    bookOrderFor(edition) {
      const declared = units.map(u => u.id);
      const shelf = shelves.get(edition) && shelves.get(edition).units;
      if (!Array.isArray(shelf) || !shelf.length) return declared;
      const known = new Set(declared);
      const ordered = shelf.filter(id => known.has(id));
      const seen = new Set(ordered);
      return ordered.concat(declared.filter(id => !seen.has(id)));
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

    sectionOf(edition, unitId) {
      const shelf = shelves.get(edition);
      if (!shelf || !Array.isArray(shelf.units) || !Array.isArray(shelf.groups)) return null;
      const ordinal = shelf.units.indexOf(unitId) + 1;
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
    toRoot() {
      return {
        display_config: this.displayConfig,
        testaments: Object.fromEntries(this.testaments.map(t => [t.id, {
          sort_number: t.order,
          books: Object.fromEntries(t.books.map(b => [b.id, {
            leaves: b.leaves,
            sort_number: b.order,
            testamentId: t.id
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
// every unit the volume enumerates. An edition carrying NO marks falls back to
// its declared flag, which is what every other edition still relies on.
export function isEditionFullyConfirmed(volume, edition) {
  const confirmed = confirmedUnitsOf(volume, edition);
  if (confirmed === null) {
    const declared = (volume?.editions || []).find(e => e?.code === edition);
    return declared?.proofread === true;
  }
  const units = volume?.units || [];
  return units.length > 0 && units.every(u => confirmed.has(u.id));
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
  const byId = new Map();
  for (const testament of volume.testaments) {
    for (const book of testament.books) byId.set(book.id, { book, testament });
  }
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
      const chart = volume.chartFor(book.id, edition);
      const spine = volume.spineFor(book.id);
      // ABSENT FROM THE CHART IS ABSENT FROM THE EDITION. The chart's word is
      // law and there is no per-unit fallback — membership is the edition's
      // own, and manufacturing seats for it would be the identity chart
      // returning under another name (H-2).
      //
      // THE SPINE IS REQUIRED HERE AND NO LONGER CONSULTED (W-96 / O-69). It
      // is checked because a unit without one is an unfinished increment, not
      // because anything below reads it: order comes from `seats[]` now, and
      // the spine holds no order any edition is entitled to inherit. Stated
      // rather than left to inference — a variable read only by its own guard
      // looks load-bearing to the next person, and this one is not.
      if (!chart?.seats?.length || !spine?.utterances?.length) continue;

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
