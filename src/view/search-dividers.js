// The search instrument's icon — a navigator's wing dividers, drawn by code
// in the wireframe globe's own idiom (1px line-work, currentColor, a slight
// tilt). Dividers are the chart-room tool for FIXING A POSITION — which is
// what search does here: fix a point on the volume's chart. The corner is
// shared: the globe lives there at a leaf, the dividers while browsing —
// context decides, they never collide (Howell 2026-07-22).
//
// The drawing is built once and used twice: at button size in the corner,
// and blown up as the mode's background watermark (see search-mode.js) —
// the tool you pressed, filling the room you pressed it into.

const SVGNS = 'http://www.w3.org/2000/svg';
const TILT_DEG = -10; // the lean of dividers walking a chart

const el = (tag, attrs) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/**
 * The dividers as a <g>, drawn in a -50..50 coordinate square so a caller
 * can seat them at any size. Strokes ride currentColor.
 * @param {number}  strokeWidth  line weight, in local units (or screen px
 *                               when nonScaling)
 * @param {boolean} nonScaling   keep the stroke a true screen pixel (the
 *                               corner icon) rather than scaling with the
 *                               drawing (the watermark, blown up large)
 */
export function buildDividers({ strokeWidth = 1, nonScaling = true } = {}) {
  const g = el('g', { transform: `rotate(${TILT_DEG})` });
  const common = {
    fill: 'none', stroke: 'currentColor',
    'stroke-width': String(strokeWidth), 'stroke-linecap': 'round'
  };
  if (nonScaling) common['vector-effect'] = 'non-scaling-stroke';
  const stroke = d => g.appendChild(el('path', { ...common, d }));
  const ring = (cx, cy, r) => g.appendChild(el('circle', { ...common, cx: String(cx), cy: String(cy), r: String(r) }));

  // The grip: a small ring handle over a short stem.
  ring(0, -40, 4);
  stroke('M0 -36 L0 -30');
  // The hinge.
  ring(0, -23, 6.5);
  // The legs, splayed to their needle points.
  stroke('M-4 -18 L-24 40');
  stroke('M4 -18 L24 40');
  // The wing — the shallow quadrant arc between the legs.
  stroke('M-19 15 Q0 21 19 15');
  return g;
}

export function mountSearchDividers(button) {
  if (!button || typeof document === 'undefined') return null;
  const svg = el('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true', focusable: 'false' });
  svg.appendChild(buildDividers({ strokeWidth: 1, nonScaling: true }));
  while (button.firstChild) button.removeChild(button.firstChild);
  button.appendChild(svg);
  return {};
}
