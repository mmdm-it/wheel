// THE MARGIN SOURCE — an edition's apparatus, fetched per unit (W-165).
//
// WHY THIS IS ITS OWN MODULE AND NOT A FIELD ON THE TEXT.
// The apparatus is captured, verified and flagged on a ladder of its own, per
// unit, and gates nothing in either direction (W-131, W-133). An edition ships
// fully proofread with its margin empty, for as long as that takes. A loader
// that fetched both together would make the margin's absence indistinguishable
// from the text's, which is exactly the state those rulings exist to keep
// separate — so this fails SILENTLY and on its own: no margin file, no margin,
// and the verse reads as it always did.
//
// WHAT A MARGIN FILE HOLDS. A list of blocks, each covering a RUN of verses:
//   { from: "1:1", to: "1:13", type: "footnote", text: "…" }
// The run is not a convenience. A block is one printed page's apparatus, and
// splitting it into per-verse entries was built first and refuted: Swete counts
// erased letters the same way he numbers verses, so 17% of the split entries
// came out filed under a verse they said nothing about. The block is also how
// the page reads — its entries lean on each other, and a reader holding the
// printed page sees the whole foot of it at once.
//
// SO THE LOOKUP IS A RANGE LOOKUP, and the ranges tile the unit in order with
// no gap and no overlap (the corpus suite pins exactly that). Binary search
// over the seat ORDER, not over the label: "10:2" sorts before "9:1" as a
// string, and an edition may address a verse the chart does not.
import { resolvePath } from './identity.js';

const cache = new Map();   // `${edition}|${unitId}` → { blocks, index } | null

/**
 * Load one unit's margin. Resolves to null when the unit has none — which is
 * the ordinary case for every edition but the Septuagint, and for the units of
 * that edition whose apparatus is still held.
 */
export async function loadMargin({ base, version, edition, unitId, fetchJson, identityOf }) {
  if (!edition || !unitId) return null;
  const key = `${edition}|${unitId}`;
  if (cache.has(key)) return cache.get(key);
  let value = null;
  try {
    const file = await fetchJson(resolvePath({ base, version, kind: 'margin', edition, unitId }));
    // The file must ANSWER FOR THE UNIT IT WAS FETCHED FOR. A mis-routed fetch
    // that resolves puts one unit's apparatus under another's verses, which is
    // the misfiling this whole design exists to prevent — and it would look
    // perfectly plausible on screen, because one page of variants resembles
    // another.
    //
    // WHICH FIELD CARRIES THAT IDENTITY IS THE VOLUME'S BUSINESS, not this
    // module's, so the caller hands in `identityOf`. That is not ceremony:
    // O-43 forbids engine-general code from speaking a volume's word for its
    // own levels, and the field in this particular volume's files is spelled
    // with that word. The guard caught it on the first run of this file, and
    // the fix it asks for is the right one — the check stays, and the
    // vocabulary moves to the adapter that owns it.
    const declared = typeof identityOf === 'function' ? identityOf(file) : undefined;
    if (file && declared === unitId && Array.isArray(file.margin)) {
      value = { blocks: file.margin, source: file.source || '' };
    }
  } catch {
    value = null;   // no margin is a state, not a failure
  }
  cache.set(key, value);
  return value;
}

/**
 * The block covering `address` ("ch:v"), or null.
 *
 * `order` is the edition's own seat labels in its own order — the same list the
 * text cache is keyed by. Positions come from it rather than from parsing the
 * label, because the label is the EDITION's address and only its own chart
 * knows where that address sits.
 */
export function blockAt(margin, address, order) {
  if (!margin || !address || !order?.length) return null;
  const at = order.indexOf(String(address));
  if (at < 0) return null;
  let lo = 0, hi = margin.blocks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = margin.blocks[mid];
    const from = order.indexOf(b.from);
    const to = order.indexOf(b.to);
    if (from < 0 || to < 0) return null;      // an unaddressable block covers nothing
    if (at < from) hi = mid - 1;
    else if (at > to) lo = mid + 1;
    else return b;
  }
  return null;
}

export function clearMarginCache() { cache.clear(); }

/**
 * The addresses a chart seats, in its own order, spelled the way a reader's
 * position is spelled: the container's label, a colon, the seat's.
 *
 * THIS EXISTS BECAUSE ITS ABSENCE FAILED SILENTLY. The first build handed
 * `blockAt` the chart's raw seat labels, which are FLAT ordinals within the
 * unit — "1", "2", "3" … 1172 — while a margin block is addressed
 * "container:seat". Every lookup missed, every lookup correctly returned null,
 * and null is the ordinary answer for a unit with no apparatus. Nothing was
 * wrong on any screen and nothing was in the log: the defect wore the exact
 * face of the normal case, which is the only kind that survives a demo.
 *
 * `groups` are the runs of consecutive seats sharing one container label.
 */
export function addressOrder(chart) {
  const seats = chart?.seats || [];
  const order = [];
  for (const group of chart?.groups || []) {
    for (let i = group.from; i <= group.to; i += 1) {
      const seat = seats[i - 1];
      if (seat) order.push(`${group.label}:${seat.label}`);
    }
  }
  return order;
}
