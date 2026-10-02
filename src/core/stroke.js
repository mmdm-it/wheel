// THE COMPASS DECIDES (O-152, Howell 2026-09-16), superseding the angle-to-
// the-hub rule of O-142. Bearings are a compass: north 0, east 90, south 180,
// west 270, clockwise, measured on the glass (up is north). The screen's own
// diagonal fixes the axes — on the Moto G 2025's page area the lower-right to
// upper-left diagonal points to 331°, "Northwest" — so another phone's shape
// gets its own Northwest. With d = the diagonal's lean off vertical (29° there):
//
//   rotate CLOCKWISE          Northwest ± 10°   321 – 341
//   dead                      10°               341 – 351
//   DRILL OUT                 140°              351 – 131  (through north and east)
//   dead                      10°               131 – 141
//   rotate COUNTER-CLOCKWISE  Southeast ± 10°   141 – 161
//   dead                      10°               161 – 171
//   DRILL IN                  140°              171 – 311  (through south and west)
//   dead                      10°               311 – 321
//
// Rotation runs along the Northwest–Southeast axis and drilling along the
// axis at right angles to it (61° / 241° there); once a stroke is decided,
// only movement along its own axis counts. Pure geometry, no DOM.

const norm = deg => ((deg % 360) + 360) % 360;
const RAD = Math.PI / 180;

/** The compass bearing of a movement on the glass (dy grows downward). */
export function bearingOf(dx, dy) {
  return norm(Math.atan2(dx, -dy) / RAD);
}

/** How far the screen's diagonal leans off vertical, in degrees (29 on the Moto G page area). */
export function diagonalLean(width, height) {
  if (!(width > 0) || !(height > 0)) return 29;
  return Math.atan(width / height) / RAD;
}

/**
 * The bands, for a lean d: each [from, to] clockwise, in degrees.
 *
 * THE ROTATION BANDS WIDEN OUTWARD BY TWO REFERENCE ANGLES (O-152 amended,
 * Howell 2026-09-16, drawing on a screenshot: "measure from the magnifier to
 * the upper left corner, and again from the magnifier to the lower right
 * corner, and then add 10 degrees to the first angle, which is headed
 * northwest, and subtract 10 degrees from the second angle, which is towards
 * southeast"). When `ul` (the bearing from the magnifier to the upper-left
 * corner) and `lr` (to the lower-right corner) are given, the clockwise band
 * runs from the diagonal's inner edge up to ul + 10°, and the counter-
 * clockwise band from lr − 10° up to its inner edge; the 10° dead zones keep
 * their width, and drill out narrows between them. Without them, the
 * symmetric ± 10° bands of the first ruling.
 */
//
// AND INWARD TO WHERE THE THUMB ACTUALLY GOES (O-152 amended again, Howell
// 2026-09-16: "go", after the gesture log showed his clockwise strokes along
// the ring at 300–322° and his counter-clockwise at 143–166°, most of them
// landing in the dead zones). The inner edges move: clockwise reaches down to
// Northwest − 35° (296° there), counter-clockwise up to Southeast + 20° (171°);
// the dead zones keep 10°, so drill in narrows to 181–286°.
export function compassBands(d = 29, { rotateHalf = 10, cwInner = 35, ccwInner = 20, dead = 10, ul = null, lr = null } = {}) {
  const nw = norm(360 - d), se = norm(180 - d);
  const cwOuter = Number.isFinite(ul) ? norm(ul + rotateHalf) : norm(nw + rotateHalf);
  const ccwOuter = Number.isFinite(lr) ? norm(lr - rotateHalf) : norm(se - rotateHalf);
  const cwStart = norm(nw - cwInner), ccwEnd = norm(se + ccwInner);
  return {
    cw: [cwStart, cwOuter],
    out: [norm(cwOuter + dead), norm(ccwOuter - dead)],
    ccw: [ccwOuter, ccwEnd],
    in: [norm(ccwEnd + dead), norm(cwStart - dead)],
  };
}

// Is bearing b inside the clockwise arc [from, to]?
const within = (b, [from, to]) => (from <= to ? b >= from && b <= to : b >= from || b <= to);

/**
 * @returns {'cw'|'ccw'|'out'|'in'|null} — null is a dead zone: nothing happens.
 */
export function classifyBearing(bearing, d = 29, opts = {}) {
  const b = norm(bearing);
  const bands = compassBands(d, opts);
  if (within(b, bands.cw)) return 'cw';
  if (within(b, bands.ccw)) return 'ccw';
  if (within(b, bands.out)) return 'out';
  if (within(b, bands.in)) return 'in';
  return null;
}

/**
 * NO DEAD ZONES — THE SESSION'S ADDITION UNDER O-191, NOT HOWELL'S RULING.
 * The comment here used to read "NO DEAD ZONES (O-191, Howell 2026-10-01)",
 * which put his name on a choice he never made: what he ruled that day was
 * where the drills point ("Any swipe going in a southwest to northeast
 * direction would migrate out"), and the ledger row records the rest as
 * "the session's additions — two axes and no dead zones" which he approved
 * as a package with "Proceed." He said so himself on 2026-10-02: "I don't
 * remember making a decision to remove the dead zones." Corrected here so
 * the record says which half was his.
 *
 * Two axes at right angles, and every stroke is the nearer of the four
 * directions. SUPERSEDED AS THE HOST'S RULE by sketchedKind below; kept
 * because it is what the measuring axes are still built from.
 * @returns {'cw'|'ccw'|'out'|'in'}
 */
export function nearestKind(bearing, d = 29) {
  const b = norm(bearing);
  const dirs = [['cw', norm(360 - d)], ['ccw', norm(180 - d)], ['out', norm(90 - d)], ['in', norm(270 - d)]];
  let best = 'cw', bestDist = 361;
  for (const [kind, a] of dirs) {
    const dist = Math.abs(((b - a + 540) % 360) - 180);
    if (dist < bestDist) { bestDist = dist; best = kind; }
  }
  return best;
}

/**
 * THE DEAD ZONES AS HOWELL DREW THEM (2026-10-02, a sketch of four red
 * wedges on a compass rose; "I'm just curious to see how they feel as
 * drawn"). FIXED SCREEN BEARINGS — no lean, no magnifier, no band tangent:
 * the four actions own seventy-five degrees each, and the fifteen degrees
 * at each midpoint between them are inert.
 *
 *   dead                    350 – 5     (straight up)
 *   DRILL OUT                 5 – 80    (northeast)
 *   dead                     80 – 95    (straight right)
 *   rotate COUNTER-CLOCKWISE  95 – 170  (southeast)
 *   dead                    170 – 185   (straight down)
 *   DRILL IN                185 – 260   (southwest)
 *   dead                    260 – 275   (straight left)
 *   rotate CLOCKWISE        275 – 350   (northwest)
 *
 * The drills follow his O-191 words exactly: southwest to northeast migrates
 * out, northeast to southwest migrates in. A wedge owns both its edges, so a
 * stroke at 5 or 80 drills rather than dying — the dead run is 81–94, 171–184,
 * 261–274, 351–4.
 *
 * WHAT THIS DELIBERATELY DOES NOT TOUCH: the axis each decided stroke then
 * measures along is still axisFor(), built from the screen's diagonal lean.
 * A wedge is centred on 42.5 while its measuring axis sits at 61, so a stroke
 * down the middle of the wedge loses about five per cent of its travel, and
 * one along the wedge's lower edge loses more. Changing that is a second
 * decision and it is Howell's, not this session's — the lesson of O-191.
 *
 * @returns {'cw'|'ccw'|'out'|'in'|null} — null is dead: nothing until lift.
 */
export const SKETCHED_WEDGES = [
  ['out', 5, 80],
  ['ccw', 95, 170],
  ['in', 185, 260],
  ['cw', 275, 350],
];

export function sketchedKind(bearing) {
  const b = norm(bearing);
  for (const [kind, from, to] of SKETCHED_WEDGES) if (within(b, [from, to])) return kind;
  return null;
}

/** The unit vector on the glass pointing along a bearing. */
export function unitOf(bearing) {
  return { ux: Math.sin(bearing * RAD), uy: -Math.cos(bearing * RAD) };
}

/** The axis each decided stroke measures along, for a lean d. */
export function axisFor(kind, d = 29) {
  switch (kind) {
    case 'cw': return unitOf(360 - d);
    case 'ccw': return unitOf(180 - d);
    case 'out': return unitOf(90 - d);
    case 'in': return unitOf(270 - d);
    default: return null;
  }
}
