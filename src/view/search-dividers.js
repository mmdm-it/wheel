// The search instrument's icon — a navigator's wing dividers, drawn by code
// in the wireframe globe's own idiom (1px line-work, currentColor, a slight
// tilt). Dividers are the chart-room tool for FIXING A POSITION — which is
// what search does here: fix a point on the volume's chart. The corner is
// shared: the globe lives there at a leaf, the dividers while browsing —
// context decides, they never collide (Howell 2026-07-22).
//
// REVIEW STUB for now: mounts the drawing only, no behavior. The step()
// animation (one leg walking a pace, hinge fixed — the icon demonstrating
// its meaning, like the globe's turn) arrives with the search mode itself.

const SVGNS = 'http://www.w3.org/2000/svg';
const TILT_DEG = -10; // the lean of dividers walking a chart

const el = (tag, attrs) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

export function mountSearchDividers(button) {
  if (!button || typeof document === 'undefined') return null;

  const svg = el('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true', focusable: 'false' });
  const g = el('g', { transform: `rotate(${TILT_DEG})` });
  svg.appendChild(g);

  const stroke = attrs => {
    const e = el('path', {
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1',
      'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', ...attrs
    });
    g.appendChild(e);
    return e;
  };
  const ring = (cx, cy, r) => {
    const e = el('circle', {
      cx: String(cx), cy: String(cy), r: String(r), fill: 'none',
      stroke: 'currentColor', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke'
    });
    g.appendChild(e);
    return e;
  };

  // The grip: a small ring handle over a short stem.
  ring(0, -40, 4);
  stroke({ d: 'M0 -36 L0 -30' });
  // The hinge.
  ring(0, -23, 6.5);
  // The legs, splayed to their needle points.
  stroke({ d: 'M-4 -18 L-24 40' });
  stroke({ d: 'M4 -18 L24 40' });
  // The wing — the shallow quadrant arc between the legs.
  stroke({ d: 'M-19 15 Q0 21 19 15' });

  while (button.firstChild) button.removeChild(button.firstChild);
  button.appendChild(svg);
  return {};
}
