// nearest-detent.js — which visible node, and which half of it, sits nearest
// the magnifier's seat. The ring asks this when the thumb lifts (to settle)
// and, since O-256's live card, on every frame of a turn (to paint the
// sector ahead of arrival). One answer, one place.
//
//   nodes:          [{ item, index, angle }] — the visible window, laid out
//   detentAngleFor: (item, part) => angle of that half's seat
//   partsOf:        item => how many sector screens the item needs (1 or more)
//
// Returns { index, part, delta, diff } or null when nothing can seat
// (an empty window, or only the version footnote, which is never a seat).
export function nearestDetent(nodes, detentAngleFor, partsOf = () => 1) {
  let best = null;
  for (const node of nodes || []) {
    if (!node || node.item == null || node.item?.placebo) continue;
    const parts = Math.max(1, partsOf(node.item) | 0);
    for (let part = 0; part < parts; part += 1) {
      const seat = detentAngleFor(node.item, part);
      const diff = Math.abs(node.angle - seat);
      if (!best || diff < best.diff) best = { index: node.index, part, delta: seat - node.angle, diff };
    }
  }
  return best;
}
