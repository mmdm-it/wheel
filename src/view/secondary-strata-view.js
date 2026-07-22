// A stratum's static ring (Phase D). Draws a chooser focus ring — band,
// nodes, magnifier — into its own SVG group, in the primary's own colors,
// band width, node size, and rotated-centered labels. Any stratum can be
// standard or mirrored. No blur here; the depth (scale + blur + z-order) is
// applied to the group by the stack (main.js). Rotation comes next.

import { computeStrataLayout } from '../geometry/secondary-strata-geometry.js';
import { standardBandCenterline, pointsToPath } from '../geometry/focus-ring-geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const NODE_RADIUS_RATIO = 0.035;      // matches the primary (index.js)
const MAGNIFIER_RADIUS_RATIO = 0.060; // matches the primary
const BAND_THICKNESS_RATIO = 0.02;    // the primary band spans 0.99r–1.01r
// The magnified label starts one fraction-of-a-node BACK from its centre and
// runs inward (start-anchored), so the name spans the node weighted to one
// side — the primary ring's unselected-node look — instead of sitting hard
// against the left edge. Higher = reaches further back (Howell 2026-07-21).
const MAG_LABEL_SPAN_PULL = 0.7;

const svgEl = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

export function hideStratum(svg, id) {
  const g = svg?.querySelector?.(`#${id}`);
  if (g) g.remove();
}

export function renderStratum(svg, { id, viewport, items, selectedIndex = 0, mirrored = false, labelFor, centerMagnified = false, rotating = false } = {}) {
  if (!svg || !Array.isArray(items) || !items.length) return null;
  hideStratum(svg, id);

  const layout = computeStrataLayout(viewport, items.length, selectedIndex, mirrored);
  const nodeR = viewport.SSd * NODE_RADIUS_RATIO;
  const magR = viewport.SSd * MAGNIFIER_RADIUS_RATIO;
  const g = svgEl('g', { id, class: 'secondary-strata' });

  // The band is the sprocket-chain centreline (arc + straight tangents),
  // shared with the primary. A mirrored stratum reflects it across the
  // horizontal centreline, which turns the vertical-UP exit into vertical-DOWN
  // and the SE tangent into NE — the mirror this stratum needs (Howell
  // 2026-07-21). This matches the mirrored nodes from computeStrataLayout.
  let bandPts = standardBandCenterline(viewport);
  if (mirrored) bandPts = bandPts.map(([x, y]) => [x, viewport.height - y]);
  g.appendChild(svgEl('path', {
    d: pointsToPath(bandPts),
    class: 'secondary-strata-band',
    'stroke-width': (layout.arc.radius * BAND_THICKNESS_RATIO).toFixed(1)
  }));

  // The rotating nodes — all uniform, flowing THROUGH the lens. While turning,
  // EVERY node is drawn (they stream through the empty lens, as on the primary);
  // once settled, the node in the lens (magIndex) is omitted and the filled
  // lodestar shows it instead, so nothing floats where the lens is anchored.
  layout.nodes.forEach(node => {
    if (!rotating && node.index === layout.magIndex) return;
    const circle = svgEl('circle', {
      cx: node.x.toFixed(1), cy: node.y.toFixed(1), r: nodeR.toFixed(1),
      class: 'secondary-strata-node'
    });
    circle.dataset.index = String(node.index);
    g.appendChild(circle);
    const rotDeg = (node.angle * 180) / Math.PI + 180;
    const label = svgEl('text', {
      x: '0', y: '0', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      class: 'secondary-strata-label',
      transform: `translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${rotDeg.toFixed(1)})`
    });
    const raw = typeof labelFor === 'function' ? labelFor(items[node.index], false) : items[node.index];
    label.textContent = String(raw ?? '').toUpperCase();
    g.appendChild(label);
  });

  // THE LODESTAR (docs/DESIGN_CLARIFICATIONS.md): the magnifier is a FIXED point
  // at magA — the reference everything rotates around. It never moves. WHILE
  // ROTATING it is an EMPTY hollow lens the nodes stream through (like the
  // primary's); SETTLED it fills with the item nearest the lens (magIndex),
  // magnified. Drawn last, so a node sliding through passes behind it.
  const mag = layout.magnifier;
  const magRotDeg = (mag.angle * 180) / Math.PI + 180;
  g.appendChild(svgEl('circle', {
    cx: mag.x.toFixed(1), cy: mag.y.toFixed(1), r: magR.toFixed(1),
    class: 'secondary-strata-node is-magnified' + (rotating ? ' lens-empty' : '')
  }));
  if (!rotating) {
    // Centred for a central magnifier (the tertiary's), else start-anchored and
    // pulled inward off the left edge (the secondary's, hard against it).
    const pulled = !centerMagnified;
    const magLabel = svgEl('text', {
      x: (pulled ? -magR * MAG_LABEL_SPAN_PULL : 0).toFixed(1), y: '0',
      'text-anchor': pulled ? 'start' : 'middle', 'dominant-baseline': 'middle',
      class: 'secondary-strata-label is-magnified',
      transform: `translate(${mag.x.toFixed(1)}, ${mag.y.toFixed(1)}) rotate(${magRotDeg.toFixed(1)})`
    });
    const magRaw = typeof labelFor === 'function' ? labelFor(items[layout.magIndex], true) : items[layout.magIndex];
    magLabel.textContent = String(magRaw ?? '').toUpperCase();
    g.appendChild(magLabel);
  }

  svg.appendChild(g);
  return g;
}
