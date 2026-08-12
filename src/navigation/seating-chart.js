// THE SEATING CHART — what survives the wall (H-14, 2026-08-12).
//
// This file held the legacy chart reader: `identityChartFromManifest`, which
// manufactured a chart from a verse count, and `expandChart`, which reconciled
// a legacy chart against a manifest that stored chapters. Both are DELETED.
//
// They were 250 lines of careful work and almost all of it existed because the
// chart and the storage disagreed about shape: positional anchors for
// unlabelled chapters, suffixing for two chapter namespaces sharing a
// spelling, a synthetic-span flag, and an identity fallback standing behind
// the lot. Under H-11 there is one shape, so those questions are not answered
// better — they stop being askable. The volume's own adapter
// (`expandVolumeSeats`) does the whole job in a fraction of the space.
//
// THE DOCTRINE THEY GUARDED DID NOT GO WITH THEM. Welds, non-contiguous
// folds, editions that regroup, containers named rather than numbered,
// asserted absences, units absent from a chart — every case is re-proved
// against the wall in `test/wall-seating.test.js`, which was written BEFORE
// this deletion precisely so the loss would be visible if there were one.
//
// The identity fallback is the one thing deliberately NOT replaced. It
// invented labels from a count, which H-2 calls manufacture, and it was
// reached whenever a chart was missing — so an uncharted edition quietly got
// a plausible fiction. An edition that does not chart a unit now does not
// seat it.

export function chaptersFromSeats(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const out = [];
  let seenKey = null;
  for (const it of items) {
    if (!it || it.level !== 'verse' || !it.chapterKey || it.chapterKey === seenKey) continue;
    seenKey = it.chapterKey;
    // The label is CARRIED, never recovered from the key (H-2). The fallback
    // here split the key on a colon — the same id-parsing habit that printed
    // an opaque id at the reader from the parent button. A seat whose label
    // nobody recorded has no label, and that is the honest answer.
    const label = it.meta?.chapterLabel ?? null;
    if (!label) continue;
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
        testamentId: it.testamentKey,
        // The text address, which under H-11 is the UNIT's id rather than a
        // file: containers ceased to be a storage level, so a container no
        // longer has a file of its own to name.
        externalFile: it.meta?.externalFile
      }
    });
  }
  return out.length ? out : null;
}

// THE SEAT HOLDING AN UTTERANCE (E2 of W-21), by the utterance's own id.
// Single-valued, because the folds are many-to-one and never one-to-many.
//
// This took a book, a spine chapter key and an ordinal, and searched
// `meta.span` — three coordinates standing in for an identity, because the
// chain had no stable id for an utterance to carry. Under H-11 it does: a
// seat names the utterances it holds, so the question is asked directly.
//
// That is W-21's own claim finally being true in code — "the reader's
// position stops being a number; they stand on an utterance, so rotating out
// and back is exact even where seats fuse." A span-and-ordinal lookup was the
// workaround for the missing identity, and it carried the failure mode of
// every coordinate scheme: it could match the right numbers in the wrong
// place. An opaque id cannot.
export function seatIndexForUtterance(items, utteranceId) {
  if (!utteranceId) return -1;
  for (let i = 0; i < items.length; i += 1) {
    const utterances = items[i]?.meta?.utterances;
    if (Array.isArray(utterances) && utterances.includes(utteranceId)) return i;
  }
  return -1;
}
