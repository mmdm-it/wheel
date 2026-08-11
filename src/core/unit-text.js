// THE TEXT-SHAPE ADAPTER (O-45, phase 1a) — the seam's fourth move.
//
// WHY THIS EXISTS, and it is worth stating because the gap it fills was
// invisible right up until two correct things were asked to meet.
//
// The descriptor (O-42) hands out correct paths for a migrated unit, and the
// projection (O-44) enumerates its containers correctly. Both were verified
// against their own contracts and both passed. But the two layouts store text
// in shapes that do not resemble each other:
//
//   legacy   ONE file per container, holding EVERY edition at once:
//              { "1": { seq: 1, text: { AAA: "…", BBB: "…" } }, … }
//   current  ONE file PER EDITION, holding only its own words:
//              { edition: "AAA", text: { "1": "…" } }
//
// So the descriptor could resolve, the walk could enumerate, and the reader
// would then meet a blank — a unit that renders nothing while every check
// upstream of it reports success. No test caught it because no test crossed
// the boundary; the gap was BETWEEN two contracts, not inside either.
//
// This module is that crossing, and it converges on the LEGACY shape on
// purpose. The alternative — teach every downstream reader the new shape —
// would put a layout branch at each of them, which is precisely what the
// descriptor exists to prevent. Downstream keeps its one shape and never
// learns which layout answered. When the last unit migrates, this module and
// the legacy shape retire together.
//
// THE ADDRESS IS THE KEY, AND THAT IS W-21's RULING, NOT A CONVENIENCE.
// "Text belongs to the (edition, address) pair, not to the utterance — the
// string IS that tradition's own cutting of the words." An edition that
// gathers into one address what another divides in two therefore has ONE
// string where the other has two, and both files are complete.
//
// A CONSEQUENCE WORTH RECORDING: the legacy engine needed `slotKeyForOrdinal`
// because its files were keyed by SPINE slots while seats wore EDITION labels,
// and that mismatch is the whole "Psalm 44:24 is really slot 23" defect class
// — an off-by-one in scripture, which is invisible in a way a blank is not.
// Under H-11 the text is already keyed by the edition's own address, so that
// indirection has nothing left to do. The bug class becomes inexpressible
// rather than fixed.

// VOLUME-NEUTRAL VOCABULARY (O-43). `unit`, `address`, `edition` — never any
// one volume's word for its own levels.

export function normalizeUnitText({ editions, declared, order = [] } = {}) {
  if (!Array.isArray(declared) || !declared.length) {
    throw new Error(
      'unit-text: the caller must DECLARE its editions — presence is checked against a '
      + 'declaration, and without one a half-arrived unit is indistinguishable from a '
      + 'complete one that simply has fewer traditions.');
  }

  // ALL-OR-NOTHING, LOUDLY (O-42, inherited rather than re-decided).
  //
  // Under the legacy layout a partial load was not EXPRESSIBLE: one fetch
  // returned every edition or none. Splitting the file per edition makes it
  // expressible for the first time, so the check has to be created here — it
  // is not a check that was lost, it is one the old shape never needed.
  //
  // The tempting kindness is to render the editions that answered. It would
  // show the reader a unit missing a tradition, with no mark saying so, and
  // every layer above would report success.
  const missing = declared.filter(code => {
    const file = editions?.[code];
    return !file || typeof file.text !== 'object' || file.text === null;
  });
  if (missing.length) {
    throw new Error(
      `unit-text: INCOMPLETE — missing text for ${missing.join(', ')}.\n`
      + '  A unit resolves all-or-nothing (O-42). Rendering the editions that happened to '
      + 'arrive would silently drop a tradition the reader was never told was absent.');
  }

  // A MIS-ROUTED FETCH IS THE QUIET ONE. Every address resolves, the strings
  // are real scripture, the shape is perfect — and the words belong to another
  // tradition. Nothing downstream could ever detect it, so it is caught here,
  // where the file still remembers what it claims to be.
  for (const code of declared) {
    const stated = editions[code].edition;
    if (typeof stated === 'string' && stated.length && stated !== code) {
      throw new Error(
        `unit-text: the file fetched for "${code}" answers for ${JSON.stringify(stated)}. `
        + 'A mis-routed fetch resolves every address and serves the wrong tradition\'s '
        + 'words, which nothing downstream can see.');
    }
  }

  // ORDER IS DECLARED, NEVER READ OFF THE ADDRESS (H-2, and identity.js's one
  // rule). An address is a quotation — "3:16", "17-20", "Prologue" are all
  // legitimate, and none of them carries its position in its characters.
  const seqOf = new Map();
  order.forEach((address, i) => { if (!seqOf.has(address)) seqOf.set(address, i); });

  // An address the active order does not seat is still text that EXISTS: the
  // order comes from one edition's chart, and another edition may address
  // something it does not. Dropping those would make the merge case lossy in
  // the direction nobody would notice — the narrower edition's extra address
  // simply vanishing. They are kept, and sort after everything placed.
  let overflow = order.length;
  const out = {};
  for (const code of declared) {
    for (const [address, string] of Object.entries(editions[code].text)) {
      if (!out[address]) {
        if (!seqOf.has(address)) seqOf.set(address, overflow++);
        out[address] = { seq: seqOf.get(address), text: {} };
      }
      // Only a real string is recorded. An edition with no words at this
      // address must stay ABSENT rather than present-and-empty: the honest
      // empty is what stops a silent fallback from filling it (W-6).
      if (typeof string === 'string' && string.length) out[address].text[code] = string;
    }
  }
  return out;
}

// FETCH POLICY: EAGER, EVERY DECLARED EDITION, ONE SETTLEMENT.
//
// This is the decision the split forced, and it is made by inheritance rather
// than by taste. Three things constrain it and they agree:
//
//   1. The phase-1 FREEZE. The legacy path fetched one file and had every
//      edition in hand; loading only the committed one would change WHEN a
//      rotation can answer, which is a feel change, and the feel is frozen.
//   2. The resolution chain. Downstream walks a preference list ACROSS
//      editions and returns the honest empty past it — with editions loaded
//      lazily that empty becomes "not yet", indistinguishable from "not there".
//      A silent lie, of exactly the kind W-6 killed three of.
//   3. O-42's all-or-nothing. A unit is complete or it is unrenderable, and
//      lazy loading makes "complete" a moving target.
//
// WHAT THIS COSTS, stated rather than buried: the fixture holds two editions
// and the real corpus holds fourteen, so this is fourteen requests where the
// legacy layout made one. Immutable versioned paths (H-11 item 4) make them
// cacheable forever, which is the trade H-11 already accepted — but the FIRST
// visit to a unit pays it, and that is a real number nobody has measured. It
// belongs to the migration's perf question, not to this module's correctness,
// and it is filed rather than assumed harmless.
export function fetchUnitText(descriptor, { declared, order = [], fetchJson } = {}) {
  if (typeof fetchJson !== 'function') {
    throw new Error('unit-text: needs a `fetchJson(path)` — the transport is the caller\'s');
  }
  if (!descriptor || descriptor.layout !== 'current') {
    throw new Error('unit-text: this is the CURRENT layout\'s loader — a legacy unit is fetched as it always was');
  }
  const codes = Array.isArray(declared) ? declared : [];
  return Promise.all(codes.map(code => fetchJson(descriptor.textAt(code))))
    .then(files => {
      const editions = {};
      codes.forEach((code, i) => { editions[code] = files[i]; });
      return normalizeUnitText({ editions, declared: codes, order });
    });
}
