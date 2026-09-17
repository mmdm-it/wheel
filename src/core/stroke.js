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

/** The bands, for a lean d: each [from, to] clockwise, in degrees. */
export function compassBands(d = 29, { rotateHalf = 10, dead = 10 } = {}) {
  const nw = norm(360 - d), se = norm(180 - d);
  return {
    cw: [norm(nw - rotateHalf), norm(nw + rotateHalf)],
    out: [norm(nw + rotateHalf + dead), norm(se - rotateHalf - dead)],
    ccw: [norm(se - rotateHalf), norm(se + rotateHalf)],
    in: [norm(se + rotateHalf + dead), norm(nw - rotateHalf - dead)],
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
