// THE LOCAL COMPASS (O-200, Howell 2026-10-15), superseding the fixed screen
// compass of O-152 and the dead wedges of O-192. The focus ring is an arc of
// a circle; every point on the glass lies on a circle concentric with it, so
// at the point where the thumb lands there is one tangent and one radial
// line. "They should be tangential to the focus ring or a ring which is
// concentric to the focus ring ... at the point of impact of the thumb."
//
//   turn CLOCKWISE / COUNTER-CLOCKWISE   along the tangent, around the centre
//   DRILL OUT / DRILL IN                  along the radial line, toward the
//                                         centre and away from it
//
// "Let's do away with the dead zones at point of impact and during the
// initial reading of intended direction of travel": the first short piece of
// travel is read against the four directions and the nearer axis wins; a tie
// is a turn. "Once the direction of travel has been determined, then the dead
// zones simply become an elimination of either radial travel or rotational
// travel, as the case may be": a decided stroke keeps only the component
// along its own axis — the host measures a turn along the tangent under the
// thumb as it moves, a drill along the radial line from the press.
//
// Bearings, where they are quoted, are a compass on the glass: north 0, east
// 90, clockwise, up is north. Pure geometry, no DOM.

const norm = deg => ((deg % 360) + 360) % 360;
const RAD = Math.PI / 180;

/** The compass bearing of a movement on the glass (dy grows downward). */
export function bearingOf(dx, dy) {
  return norm(Math.atan2(dx, -dy) / RAD);
}

/** The compass bearing a unit vector points along. */
export function bearingOfUnit({ ux, uy }) {
  return bearingOf(ux, uy);
}

/**
 * The two axes at a point on the glass, for a ring centred at (hubX, hubY):
 * `cw`, the tangent in the clockwise sense around the centre, and `out`, the
 * radial line toward the centre. Both unit vectors; (dy grows downward, so
 * clockwise on the glass is the clockwise of a clock face). At the centre
 * itself there is no tangent; north and east stand in.
 */
export function localAxes(x, y, hubX, hubY) {
  const rx = x - hubX, ry = y - hubY;
  const len = Math.hypot(rx, ry);
  if (!(len > 0)) return { cw: { ux: 0, uy: -1 }, out: { ux: 1, uy: 0 } };
  return { cw: { ux: -ry / len, uy: rx / len }, out: { ux: -rx / len, uy: -ry / len } };
}

/**
 * The nearer of the four directions for a movement (dx, dy) under the axes:
 * the larger component wins, and an exact tie is a turn.
 * @returns {'cw'|'ccw'|'out'|'in'}
 */
export function quadrantKind(dx, dy, axes) {
  const t = dx * axes.cw.ux + dy * axes.cw.uy;
  const r = dx * axes.out.ux + dy * axes.out.uy;
  if (Math.abs(r) > Math.abs(t)) return r > 0 ? 'out' : 'in';
  return t >= 0 ? 'cw' : 'ccw';
}

/** The unit vector a decided stroke of this kind measures along. */
export function axisOf(kind, axes) {
  switch (kind) {
    case 'cw': return axes.cw;
    case 'ccw': return { ux: -axes.cw.ux, uy: -axes.cw.uy };
    case 'out': return axes.out;
    case 'in': return { ux: -axes.out.ux, uy: -axes.out.uy };
    default: return null;
  }
}

// THE TURN GATE (O-202, Howell 2026-10-15): "once it has been determined
// that this swipe is rotational, only moves that are clearly within the
// rotational direction should cause rotation ... the ring shouldn't move at
// all unless there is clearly a movement in that direction. So whatever that
// initial filter is of 8 pixels ... needs to constantly update and only look
// for long movements in a direction that is the same as the initial
// direction." The direction of the last `windowPx` of the thumb's path is
// re-read at every move; the ring turns only while it lies within `coneDeg`
// of the tangent, either way along it — that is how a turn reverses.

/**
 * The direction of the last `windowPx` of a path (points in order, the
 * current position last): the vector from the point `windowPx` back along
 * the path to the current point. Null until the path is that long, and
 * null when the thumb has dithered — the straight-line distance over the
 * window is under half of it — because that direction is noise.
 */
export function recentDirection(trail, windowPx) {
  if (!trail || trail.length < 2) return null;
  const now = trail[trail.length - 1];
  let walked = 0;
  for (let i = trail.length - 2; i >= 0; i--) {
    walked += Math.hypot(trail[i + 1].x - trail[i].x, trail[i + 1].y - trail[i].y);
    if (walked >= windowPx) {
      const dx = now.x - trail[i].x, dy = now.y - trail[i].y;
      const len = Math.hypot(dx, dy);
      return len >= windowPx / 2 ? { dx, dy, len } : null;
    }
  }
  return null;
}

/** Is the direction within `coneDeg` of the axis, either way along it? */
export function withinCone(dir, axis, coneDeg) {
  if (!dir || !(dir.len > 0)) return false;
  const cos = Math.abs(dir.dx * axis.ux + dir.dy * axis.uy) / dir.len;
  return cos >= Math.cos(coneDeg * Math.PI / 180) - 1e-12;
}

/**
 * The gate itself, for a path with the current position last: open when the
 * last `windowPx` of travel lies within the cone AND the latest movement,
 * if it is long enough to have a direction of its own (2 px), does too —
 * so the ring stops the moment the thumb turns across it, instead of a
 * window later. Returns the direction's bearing for the instruments.
 */
export function turnGateOpen(trail, windowPx, coneDeg, axis) {
  const dir = recentDirection(trail, windowPx);
  let open = withinCone(dir, axis, coneDeg);
  if (open && trail.length >= 2) {
    const a = trail[trail.length - 2], b = trail[trail.length - 1];
    const last = { dx: b.x - a.x, dy: b.y - a.y, len: Math.hypot(b.x - a.x, b.y - a.y) };
    if (last.len >= 2 && !withinCone(last, axis, coneDeg)) open = false;
  }
  return { open, bearing: dir ? bearingOf(dir.dx, dir.dy) : null };
}
