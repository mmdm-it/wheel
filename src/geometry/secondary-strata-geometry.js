// Strata geometry (Phase D, docs/DIMENSION_SYSTEM.md). A stratum's focus ring
// is the primary's arc, optionally mirrored across the screen's HORIZONTAL
// centerline. Each deeper stratum flips the previous (Howell 2026-07-21):
//   primary   — standard (hub off upper-right, magnifier low-left)
//   secondary — mirrored (hub off lower-right, sweeps lower-left→upper-right)
//   tertiary  — standard again (identical to the primary's orientation)
// The mirrored stratum's magnifier lands up top from the pure reflection, so
// it is lowered by a few nodes into the thumb zone.

import { getArcParameters, getNodeSpacing, getViewportWindow, chainPointAt } from './focus-ring-geometry.js';

export const STANDARD_MAG_ANGLE_DEG = 142;   // the primary's magnifier angle
export const MIRRORED_MAG_ANGLE_DEG = -142;  // its horizontal reflection
export const MIRRORED_MAG_NODE_OFFSET = 4;   // lower the mirrored magnifier this many nodes

export function getStrataArcParameters(viewport, mirrored) {
  const primary = getArcParameters(viewport);
  const hubY = mirrored ? viewport.height - primary.hubY : primary.hubY;
  return { hubX: primary.hubX, hubY, radius: primary.radius };
}

// Placement: whatever CENTER INDEX sits at the magnifier, each sibling steps
// one node-spacing along the arc. centerIndex is a FLOAT — an integer is the
// settled frame (a node in the lens), a fraction is mid-rotation (the ring
// between nodes). Magnifier-as-selection: the obeyed node is the one nearest
// the lens, round(centerIndex) (Howell 2026-07-21).
export function computeStrataLayout(viewport, itemCount, centerIndex = 0, mirrored = false) {
  const arc = getStrataArcParameters(viewport, mirrored);
  const spacing = getNodeSpacing(viewport);
  // The band this stratum draws is the sprocket chain — arc within the viewport
  // window, DEAD-STRAIGHT tangents beyond each exit — so the nodes MUST ride the
  // same chain (chainPointAt), not the bare circle. On the circle they wrapped
  // around and peeled off the straight band once a long chain (50 languages)
  // ran past the arc (Howell 2026-07-22). A mirrored stratum reflects the
  // standard window across the horizontal centreline: θ → −θ, so the standard
  // [start, π] becomes [−π, −start] in this frame (the reflected hub does the rest).
  const w = getViewportWindow(viewport);
  const startAngle = mirrored ? -Math.PI : w.startAngle;
  const endAngle = mirrored ? -w.startAngle : Math.PI;
  const baseAngle = (mirrored ? MIRRORED_MAG_ANGLE_DEG : STANDARD_MAG_ANGLE_DEG) * Math.PI / 180;
  const offset = mirrored ? MIRRORED_MAG_NODE_OFFSET : 0;
  const magA = baseAngle - offset * spacing; // decreasing angle lowers the magnifier down the arc
  const magIndex = Math.max(0, Math.min(itemCount - 1, Math.round(centerIndex)));
  const nodes = [];
  for (let i = 0; i < itemCount; i += 1) {
    const a = magA - (i - centerIndex) * spacing;
    const p = chainPointAt(arc, startAngle, endAngle, a);
    // p.tangentAngle is the true arc angle, CLAMPED to the exit on the straight
    // runs, so tangent labels stay square to the chain instead of turning past it.
    nodes.push({ index: i, angle: p.tangentAngle, x: p.x, y: p.y, onArc: p.onArc, isMagnified: i === magIndex });
  }
  const magP = chainPointAt(arc, startAngle, endAngle, magA);
  const magnifier = { x: magP.x, y: magP.y, angle: magP.tangentAngle };
  return { arc, spacing, magA, magnifier, nodes, magIndex };
}
