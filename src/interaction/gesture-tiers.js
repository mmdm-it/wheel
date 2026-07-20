// C.3 gesture-tier policy.
//
// The flick is measured against the SCRUB, not the chain (Howell 2026-07-17,
// revising the earlier "every chain is ten flicks long / 10% per flick"):
// a corner-to-corner scrub moves a fixed number of nodes regardless of chain
// length, so 10%-of-chain ballooned on long chains — one flick lurched 700
// years on the 84k-node months timeline while a scrub crawled ~20. Anchoring
// the flick to the scrub makes it feel identical on 12 nodes or 84,000:
//
//   scrub       = precision (pixel-exact, chain-independent)
//   flick       = local-fast — FLICK_SCRUBS corner-to-corner scrubs
//   double-flick= the whole way (to the chain end)
//
// The choreographer clamps the glide to the chain ends, so a flick that would
// overshoot a short chain simply lands at the end — no floor needed.

export const FLICK_GLIDE_MS = 600;     // the house tempo — arrival is predictable everywhere
export const FLICK_SCRUBS = 4;         // a flick travels this many corner-to-corner scrubs

// One flick's rotation, in radians. A corner-to-corner scrub's rotation is the
// Manhattan finger span (width+height) times the drag sensitivity — matching
// exactly how a scrub maps pixels to rotation (delta = (dx+dy) * sensitivity).
// A flick is FLICK_SCRUBS of those. Chain-independent by construction.
// Live-tunable: set window.__flickScrubs in the console to feel a new multiple
// without a rebuild.
export function computeFlickRotation(viewport, sensitivity, scrubs) {
  const k = Number.isFinite(scrubs) ? scrubs
    : (typeof globalThis !== 'undefined' && Number.isFinite(globalThis.__flickScrubs))
      ? globalThis.__flickScrubs
      : FLICK_SCRUBS;
  const span = (viewport?.width || 0) + (viewport?.height || 0);
  const s = Number.isFinite(sensitivity) ? sensitivity : 0;
  return k * span * s;
}
