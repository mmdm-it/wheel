// THE ANGLE OF THE STROKE DECIDES (O-142, Howell 2026-09-15): "Angle of swipe
// determines DRILL or ROTATE, anywhere in the viewport." A drag that moves
// along the ring's curve turns it; a drag that moves across the ring drills —
// outward, away from the hub, drills IN (the lens's own down-swipe, made
// general), inward drills OUT (the parent's up-swipe). Where the motion is
// ambiguous it turns, the older and safer gesture.
//
// Pure geometry, no DOM: the caller hands over the stroke so far and the
// radial unit vector at the point where the finger came down.

/** Unit vector from the hub through (x, y); null at the hub itself. */
export function radialAt(x, y, hubX, hubY) {
  const dx = x - hubX, dy = y - hubY;
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  return { rx: dx / len, ry: dy / len };
}

/**
 * @param {{ vx:number, vy:number, rx:number, ry:number, drillDeg?:number }} o
 *   vx, vy — the stroke so far; rx, ry — the radial unit at its origin;
 *   drillDeg — how far from the ring's tangent a stroke must lean to be a
 *   drill (50° by default: past it, radial; short of it, along).
 * @returns {'rotate'|'outward'|'inward'|null} null for a stroke of no length.
 */
export function strokeKind({ vx, vy, rx, ry, drillDeg = 50 }) {
  const len = Math.hypot(vx || 0, vy || 0);
  if (!len || !Number.isFinite(rx) || !Number.isFinite(ry)) return null;
  const radial = (vx * rx + vy * ry) / len;           // cosine to the radial: +outward, -inward
  const lean = Math.sin((Math.max(0, Math.min(90, drillDeg)) * Math.PI) / 180);
  if (Math.abs(radial) < lean) return 'rotate';
  return radial > 0 ? 'outward' : 'inward';
}
