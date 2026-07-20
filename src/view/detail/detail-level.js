// WHICH SELECTIONS HAVE A DETAIL PAYLOAD.
//
// The detail sector describes the LEAF — the thing at the bottom of the
// hierarchy, where there is nothing further to descend into. A volume
// declares its leaf in meta.leafLevel, and that same field is what opens
// the sector, so the two must agree: rendering a payload for anything
// else writes into a panel that is closed, closing, or about to be.
//
// The visible cost of disagreeing (found 2026-07-20): ascending out of a
// leaf changed the selection to its parent, the panel was still fading
// out, and the parent's payload was painted into it on the way — a stray
// title and subtitle popping on and fading away in the corner, describing
// a level the sector does not serve.
//
// A caller that gets `false` should leave the panel's existing content
// ALONE rather than clear it: the sector is on its way out, and it should
// fade carrying the leaf it was describing, not blink empty first.

/**
 * @param {Object|null} selected   — the currently magnified item
 * @param {Object|null} normalized — the adapter's normalized volume (meta.leafLevel)
 * @returns {boolean} whether this selection is one the detail sector describes
 */
export function isDetailLevel(selected, normalized) {
  if (!selected) return false;
  const leafLevel = normalized?.meta?.leafLevel || null;
  // A volume that names no leaf makes no claim about depth; anything it
  // magnifies may carry detail.
  if (!leafLevel) return true;
  return selected.level === leafLevel;
}
