// Strata geometry (Phase D, docs/DIMENSION_SYSTEM.md). A stratum's focus ring
// is the primary's arc, optionally mirrored across the screen's HORIZONTAL
// centerline. Each deeper stratum flips the previous (Howell 2026-07-21):
//   primary   — standard (hub off upper-right, magnifier low-left)
//   secondary — mirrored (hub off lower-right, sweeps lower-left→upper-right)
//   tertiary  — standard again (identical to the primary's orientation)
// The mirrored stratum's magnifier lands up top from the pure reflection, so
// it is lowered by a few nodes into the thumb zone.

import { getArcParameters, getNodeSpacing } from './focus-ring-geometry.js';

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
  const baseAngle = (mirrored ? MIRRORED_MAG_ANGLE_DEG : STANDARD_MAG_ANGLE_DEG) * Math.PI / 180;
  const offset = mirrored ? MIRRORED_MAG_NODE_OFFSET : 0;
  const magA = baseAngle - offset * spacing; // decreasing angle lowers the magnifier down the arc
  const magIndex = Math.max(0, Math.min(itemCount - 1, Math.round(centerIndex)));
  const nodes = [];
  for (let i = 0; i < itemCount; i += 1) {
    const angle = magA - (i - centerIndex) * spacing;
    nodes.push({
      index: i,
      angle,
      x: arc.hubX + arc.radius * Math.cos(angle),
      y: arc.hubY + arc.radius * Math.sin(angle),
      isMagnified: i === magIndex
    });
  }
  const magnifier = { x: arc.hubX + arc.radius * Math.cos(magA), y: arc.hubY + arc.radius * Math.sin(magA), angle: magA };
  return { arc, spacing, magA, magnifier, nodes, magIndex };
}
