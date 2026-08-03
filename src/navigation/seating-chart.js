// THE SEATING CHART (E1 of W-21, docs/SEATING-CHART-CONTRACT.md).
//
// The chart is the generated per-artifact truth about WHICH seats exist —
// membership, labels, and each seat's utterance span in spine coordinates.
// The chain is built from it, retiring `verse_count` as the chain's source
// and, with it, the phantom-seat class (a chapter holding keys 1..34 + 15b
// under verse_count 35 produced seats 1..35: one hidden verse, one phantom).
//
// One code path for both worlds: when no chart has been generated for an
// artifact yet, `identityChartFromManifest` derives an all-integer chart
// from verse_count — exactly today's behaviour, phantom bug included, by
// design (contract: "data first, engine tolerant"). Charts land per
// artifact; the bug dies where they land.
//
// This module is PURE: no fetching, no DOM. It expands a chart against the
// manifest into the flat verse-item list the cousin weaver consumes.

const bySortNumber = (a, b) => {
  const as = Number.isFinite(a[1]?.sort_number) ? a[1].sort_number : parseInt(a[0], 10) || 0;
  const bs = Number.isFinite(b[1]?.sort_number) ? b[1].sort_number : parseInt(b[0], 10) || 0;
  return as - bs;
};

// A book entry is an array of chapters, or `{ convention, chapters }` when it
// carries a book-level flag (the two-recension books). Normalize to one form.
const bookForm = entry => {
  if (Array.isArray(entry)) return { convention: false, chapters: entry };
  if (entry && Array.isArray(entry.chapters)) {
    return { convention: entry.convention === true, chapters: entry.chapters };
  }
  return null;
};

// A chapter entry is an integer (identity), a compressed RUN
// `{ c, u }`, or an explicit seat list `{ c?, convention?, s }`.
//
// THE RUN EXISTS BECAUSE POSITION CANNOT IDENTIFY (W-32, Wilbur, 2026-08-03).
// The integer form says "the spine chapter at the same POSITION", which
// silently stops being true the moment an edition's chapters stop
// corresponding one-to-one with the spine's — the Latin Psalm 9 is the
// Hebrew's 9 AND 10, so from there every position is off by one and a bare
// integer resolves to the wrong chapter for the rest of the book. Seven books
// of LXX and THEOD were wrong this way, and the charts were withdrawn.
//
// A run names its own source instead of leaning on position: `{"c":"10",
// "u":["9",22,39]}` is eighteen identity seats labelled 1..18, drawn from
// spine chapter 9's utterances 22 through 39. Spelling those out seat by seat
// would cost ~140 entries in the Psalms alone, which is why the compression
// has to survive the fix.
const chapterForm = entry => {
  if (Number.isInteger(entry) && entry >= 0) return { identity: true, count: entry };
  if (entry && Array.isArray(entry.s)) {
    return {
      identity: false,
      label: entry.c != null ? String(entry.c) : null,
      convention: entry.convention === true,
      seats: entry.s
    };
  }
  if (entry && entry.u && !entry.s) {
    const span = spanForm(entry.u);
    // A run is one contiguous stretch of one spine chapter; anything folded
    // or scattered is a seat list, not a run.
    if (!span || span.length !== 1) return null;
    const [chapterKey, first, last] = span[0];
    const seats = [];
    for (let o = first; o <= last; o += 1) {
      seats.push({ l: String(o - first + 1), u: [chapterKey, o, o] });
    }
    return {
      identity: false,
      label: entry.c != null ? String(entry.c) : null,
      convention: entry.convention === true,
      seats
    };
  }
  return null;
};

// A seat's span: one [spineChapterKey, first, last] triple, or a list of them
// (the eleven many-to-one folds are non-contiguous — W-30). Normalized to a
// list of triples; null on malformed input.
const spanForm = u => {
  if (!Array.isArray(u) || !u.length) return null;
  const ranges = Array.isArray(u[0]) ? u : [u];
  const out = [];
  for (const r of ranges) {
    if (!Array.isArray(r) || r.length !== 3) return null;
    const [chapterKey, first, last] = r;
    if (typeof chapterKey !== 'string' && typeof chapterKey !== 'number') return null;
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first) return null;
    out.push([String(chapterKey), first, last]);
  }
  return out;
};

/**
 * Derive the identity chart from the volume root's verse_count — the
 * fallback for an artifact whose generated chart has not landed. Every
 * chapter is an integer. `root` is the volume's manifest ROOT (the object
 * holding `testaments`); this module never names the volume, per the
 * forbidden-literals guard — the caller unwraps.
 */
export function identityChartFromManifest(root) {
  if (!root?.testaments) return null;
  const books = {};
  Object.entries(root.testaments).sort(bySortNumber).forEach(([, testament]) => {
    Object.entries(testament?.sections || {}).sort(bySortNumber).forEach(([, section]) => {
      Object.entries(section?.books || {}).sort(bySortNumber).forEach(([bookId, book]) => {
        const chapters = Object.entries(book?.chapters || {}).sort(bySortNumber)
          .map(([, chapterMeta]) => (Number.isFinite(chapterMeta?.verse_count) ? chapterMeta.verse_count : 0));
        if (chapters.some(n => n > 0)) books[book?.book_key || bookId] = chapters;
      });
    });
  });
  return { edition: null, books };
}

/**
 * Expand a seating chart against the volume root into the flat, ordered list of
 * verse items the cousin weaver consumes — the same item shape the legacy
 * verse_count loop produced, plus `meta.span` (spine coordinates) and
 * `meta.convention`. Returns null when the chart is structurally unusable,
 * so the caller can fall back to the identity chart.
 *
 * Identity chapters are POSITIONAL against the spine's chapter sequence
 * (not its numeric ids — ECCLU opens at chapter 0, the Prologue) and inherit
 * the spine chapter's display identity. Explicit chapters may regroup under
 * the edition's own chapter label (`c`) — the grouping key follows it, so
 * the cousin-gap grammar breaks at the edition's OWN boundaries.
 */
export function expandChart(root, chart) {
  if (!root?.testaments || !chart || typeof chart.books !== 'object' || chart.books === null) return null;

  const items = [];
  let usable = false;

  Object.entries(root.testaments).sort(bySortNumber).forEach(([testamentId, testament]) => {
    Object.entries(testament?.sections || {}).sort(bySortNumber).forEach(([sectionId, section]) => {
      Object.entries(section?.books || {}).sort(bySortNumber).forEach(([bookId, book]) => {
        const bookKey = book?.book_key || bookId;
        const entry = chart.books[bookKey] ?? chart.books[bookId];
        // Absent from the chart = absent from the artifact. The chart's word
        // is law; there is no per-book fallback (contract: membership is the
        // edition's own).
        if (entry == null) return;
        const form = bookForm(entry);
        if (!form) return;

        // The spine's chapter sequence for this book, in spine order —
        // identity chapters and span chapterKeys both resolve against it.
        const spineSeq = Object.entries(book?.chapters || {}).sort(bySortNumber);
        const spineByKey = new Map(spineSeq.map(([key, meta]) => [String(key), { key, meta }]));
        // GROUPING KEYS MUST BE UNIQUE WITHIN A BOOK. Identity chapters key
        // by the spine's own number and explicit ones by the edition's label,
        // which are two namespaces sharing a spelling: Greek Sirach's chapter
        // 30 collided with the spine's chapter 30 and the two were SILENTLY
        // MERGED into one 44-seat chapter — a display lie of exactly the kind
        // this model exists to make impossible. On a collision the later
        // chapter takes a positional suffix; the DISPLAY label is carried
        // separately (meta.chapterLabel) and never wears it.
        const usedKeys = new Set();
        const uniqueKey = (key, position) => {
          let k = key;
          if (usedKeys.has(k)) k = `${key}#${position}`;
          usedKeys.add(k);
          return k;
        };

        form.chapters.forEach((chapterEntry, position) => {
          const ch = chapterForm(chapterEntry);
          if (!ch) return;
          const spineAtPosition = spineSeq[position];

          if (ch.identity) {
            // Identity: N seats, labels 1..N, utterance k ↔ seat k, in the
            // same-positioned spine chapter, wearing its display identity.
            if (!spineAtPosition || ch.count <= 0) return;
            const [spineKey, chapterMeta] = spineAtPosition;
            const chapterLabel = chapterMeta?.name ?? spineKey;
            const groupKey = uniqueKey(`${bookId}:${spineKey}`, position);
            const chapterId = chapterMeta?.id || groupKey;
            const externalFile = chapterMeta?._external_file || chapterMeta?.external_file || '';
            for (let k = 1; k <= ch.count; k += 1) {
              items.push({
                id: `${bookKey}_${chapterLabel}_${k}`,
                name: String(k),
                level: 'verse',
                parentId: chapterId,
                chapterKey: groupKey,
                bookKey: bookId,
                testamentKey: testamentId,
                meta: {
                  bookId: bookKey,
                  bookEntryId: bookId,
                  chapterId,
                  sectionId,
                  testamentId,
                  verseKey: String(k),
                  chapterLabel,
                  externalFile,
                  span: [[String(spineKey), k, k]],
                  convention: form.convention
                }
              });
            }
            usable = true;
            return;
          }

          // Explicit: the edition's own seats. Group under the edition's own
          // chapter label when it departs from the spine's grouping.
          const anchor = spineAtPosition ? { key: spineAtPosition[0], meta: spineAtPosition[1] } : null;
          // AN UNLABELLED CHAPTER IS NAMED BY THE SPINE IT DRAWS FROM, not by
          // its position in the array. The two agree only while the edition's
          // chapter sequence matches the spine's — and the moment a book
          // regroups, the counts diverge and position means nothing. Greek
          // Sirach has 55 chapters against the spine's 52, so its unlabelled
          // entries were being named by whatever spine chapter happened to sit
          // at the same index, far from the text they actually hold.
          // (The contract asks for `c` on EVERY chapter of a regrouped book
          // for this reason — see O-20; this is the honest reading when it is
          // missing, not a substitute for it.)
          const firstSpan = ch.seats.reduce((found, seat) => found || spanForm(seat?.u), null);
          const home = firstSpan ? spineByKey.get(firstSpan[0][0]) : null;
          const chapterLabel = ch.label ?? home?.meta?.name ?? home?.key
            ?? anchor?.meta?.name ?? anchor?.key ?? String(position + 1);
          const groupKey = uniqueKey(`${bookId}:${ch.label ?? home?.key ?? anchor?.key ?? position + 1}`, position);
          // Identity too resolves through the SPAN, not the position (W-32).
          const chapterId = (ch.label == null && (home?.meta?.id || anchor?.meta?.id)) || groupKey;
          ch.seats.forEach(seat => {
            const label = seat?.l != null ? String(seat.l) : null;
            const span = spanForm(seat?.u);
            if (!label || !span) return;
            // Text lives whole at the span's first slot (W-30) — the fetch
            // file is the FIRST range's spine chapter.
            const home = spineByKey.get(span[0][0]);
            const externalFile = home?.meta?._external_file || home?.meta?.external_file || '';
            items.push({
              id: `${bookKey}_${chapterLabel}_${label}`,
              name: label,
              level: 'verse',
              parentId: chapterId,
              chapterKey: groupKey,
              bookKey: bookId,
              testamentKey: testamentId,
              meta: {
                bookId: bookKey,
                bookEntryId: bookId,
                chapterId,
                sectionId,
                testamentId,
                verseKey: label,
                chapterLabel,
                externalFile,
                span,
                convention: form.convention || ch.convention
              }
            });
            usable = true;
          });
        });
      });
    });
  });

  return usable ? items : null;
}

/**
 * THE CHAPTERS THE READER ACTUALLY HAS (E3 of W-21) — collapsed from the
 * expanded seats, so the chapters ring and the verse ring cannot disagree:
 * one is literally derived from the other.
 *
 * This matters wherever an edition regroups. The Septuagint's Sirach reads
 * its chapters in an order the Latin spine does not (…30, 31, 34, 35, 36,
 * 32, 33, 39…) and runs to 55 where the spine stops at 51. Built from the
 * spine, the ring offered a Greek reader chapters 37 and 38 — which that
 * edition has never had — and hid 53 through 55, which it does. The same
 * defect as the phantom verse seats, one level up.
 *
 * Chapter identity and order come from the seats' own grouping key, which
 * the chart set: an identity chapter keeps the spine's id (so descent and
 * ascent work exactly as before for the 1:1 majority), and a regrouped one
 * wears the edition's own label.
 */
export function chaptersFromSeats(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const out = [];
  let seenKey = null;
  for (const it of items) {
    if (!it || it.level !== 'verse' || !it.chapterKey || it.chapterKey === seenKey) continue;
    seenKey = it.chapterKey;
    const label = it.meta?.chapterLabel ?? String(it.chapterKey).split(':').pop();
    out.push({
      id: it.meta?.chapterId || it.chapterKey,
      name: label,
      level: 'chapter',
      parentId: it.bookKey,
      bookKey: it.bookKey,
      testamentKey: it.testamentKey,
      meta: {
        bookId: it.bookKey,
        chapterKey: label,
        sectionId: it.meta?.sectionId,
        testamentId: it.testamentKey,
        // The chapter's own file is where its FIRST utterance lives; each
        // verse still carries its own, so a chapter drawn from two spine
        // files still fetches every verse correctly.
        externalFile: it.meta?.externalFile
      }
    });
  }
  return out.length ? out : null;
}

/**
 * The rotation query's kernel (E2 will ride this): the seat in `items`
 * whose span covers the given spine utterance — single-valued because the
 * folds are many-to-one, never one-to-many. Returns its index, or -1.
 */
export function seatIndexForUtterance(items, bookId, spineChapterKey, ordinal) {
  const wantKey = String(spineChapterKey);
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (!it || it.bookKey !== bookId || !Array.isArray(it.meta?.span)) continue;
    for (const [chKey, first, last] of it.meta.span) {
      if (chKey === wantKey && ordinal >= first && ordinal <= last) return i;
    }
  }
  return -1;
}
