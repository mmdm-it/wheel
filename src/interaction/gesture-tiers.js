// C.3 gesture-tier policy (Howell rulings, 2026-07-17; ballistic flick
// approved 2026-07-17 — "Go ahead. Knock yourself out.").
//
// The tier ladder addresses chains in FRACTIONS, not nodes: every chain is
// the same size in gesture-space. A flick is a discrete unit of travel —
// every chain is ten flicks long — with a floor of twice the visible window
// so tiny rings collapse flick ≈ double-flick by design ("silly to have 5
// nodes and a swipe rotate half a node").

export const FLICK_MIN_VELOCITY = 0.8; // px/ms — same gate as a double-flick leg
export const FLICK_FRACTION = 0.10;    // of the chain (links, gaps included)
export const FLICK_MIN_FACTOR = 2;     // × visible nodes: the small-chain floor
export const FLICK_GLIDE_MS = 600;     // the house tempo — arrival is predictable everywhere

// How many chain links one flick travels. linkCount includes gap links
// (they occupy chain space); visibleMax is the viewport window's node count.
export function computeFlickLinks(linkCount, visibleMax) {
  const chain = Number.isFinite(linkCount) && linkCount > 0 ? linkCount : 0;
  const visible = Number.isFinite(visibleMax) && visibleMax > 0 ? visibleMax : 0;
  return Math.max(FLICK_FRACTION * chain, FLICK_MIN_FACTOR * visible);
}
