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

export function renderStratum(svg, { id, viewport, items, selectedIndex = 0, mirrored = false, onSelect, labelFor, centerMagnified = false } = {}) {
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

  layout.nodes.forEach(node => {
    const r = node.isMagnified ? magR : nodeR;
    const circle = svgEl('circle', {
      cx: node.x.toFixed(1), cy: node.y.toFixed(1), r: r.toFixed(1),
      class: 'secondary-strata-node' + (node.isMagnified ? ' is-magnified' : ''),
      role: 'button', tabindex: '0'
    });
    circle.dataset.index = String(node.index);
    if (typeof onSelect === 'function') {
      circle.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); onSelect(node.index); });
      circle.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.index); } };
    }
    g.appendChild(circle);

    const rotDeg = (node.angle * 180) / Math.PI + 180;
    // Magnified: start-anchored, pulled back over the node so the name spans it
    // weighted inward — UNLESS centerMagnified (the tertiary's magnifier sits
    // central enough that the full title reads best simply centred, Howell
    // 2026-07-21). Unselected nodes are always centred on the node.
    const pulled = node.isMagnified && !centerMagnified;
    const labelX = pulled ? -magR * MAG_LABEL_SPAN_PULL : 0;
    const label = svgEl('text', {
      x: labelX.toFixed(1), y: '0',
      'text-anchor': pulled ? 'start' : 'middle', 'dominant-baseline': 'middle',
      class: 'secondary-strata-label' + (node.isMagnified ? ' is-magnified' : ''),
      transform: `translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${rotDeg.toFixed(1)})`
    });
    const raw = typeof labelFor === 'function' ? labelFor(items[node.index], node.isMagnified) : items[node.index];
    label.textContent = String(raw ?? '').toUpperCase();
    g.appendChild(label);
  });

  svg.appendChild(g);
  return g;
}
