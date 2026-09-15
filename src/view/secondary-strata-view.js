// A stratum's static ring (Phase D). Draws a chooser focus ring — band,
// nodes, magnifier — into its own SVG group, in the primary's own colors,
// band width, node size, and rotated-centered labels. Any stratum can be
// standard or mirrored. No blur here; the depth (scale + blur + z-order) is
// applied to the group by the stack (main.js). Rotation comes next.

import { computeStrataLayout } from '../geometry/secondary-strata-geometry.js';
import { standardBandCenterline, pointsToPath, getNodeSpacing } from '../geometry/focus-ring-geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const NODE_RADIUS_RATIO = 0.035;      // matches the primary (index.js)
const MAGNIFIER_RADIUS_RATIO = 0.060; // matches the primary
const BAND_THICKNESS_RATIO = 0.02;    // the primary band spans 0.99r–1.01r
// The magnified label starts one fraction-of-a-node BACK from its centre and
// runs inward (start-anchored), so the name spans the node weighted to one
// side — the primary ring's unselected-node look — instead of sitting hard
// against the left edge. Higher = reaches further back (Howell 2026-07-21).
const MAG_LABEL_SPAN_PULL = 0.7;
// THE PRIMARY'S LABEL MANNERS, for a ring that asks for them (O-128, Howell
// 2026-09-14: the basement's bookmarks "should react to passing through the
// Magnifier in the same way that the name nodes do in the Primary
// Stratum Focus Ring"): a name sits BESIDE its node — left-aligned, starting
// just past the node on its outward side (Howell, the same day: "switch the
// alignment of the unselected node labels in the basement Focus Ring from
// Right to Left. The Magnifier label should stay centered"); passing the
// lens it swells on a bell — the primary's own curve,
// peak 2.0, sigma 0.3 of a node spacing (focus-ring-view.js) — centred on
// the node and scaled with it; settled in the lens it wears the magnified
// label, centred, at the lens's own size.
const BESIDE_OFFSET = 1.3;           // node radii, along the node's angle (outward): the name starts here and runs on
const LENS_SCALE_PEAK = 2.0;
const LENS_SCALE_SIGMA = 0.3;        // × node spacing

const svgEl = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

// Uppercase Latin-script labels (as the ring always has), but leave every
// other script in its given form: uppercasing strips polytonic Greek's
// breathings/accents, is meaningless for Hebrew/Arabic/CJK/Indic, and can
// mangle scripts with their own casing (Howell 2026-07-22). With 50 languages
// now on the ring, invert the test: uppercase ONLY when a label is pure Latin
// (Basic + Latin-1 + Extended-A/B + Additional + combining marks \u2014 covers
// Vietnamese, Turkish, Czech, Welsh, \u2026), otherwise leave it untouched.
const LATIN_SCRIPT_ONLY = /^[\u0020-\u024F\u0300-\u036F\u1E00-\u1EFF]+$/;
const displayCase = s => (LATIN_SCRIPT_ONLY.test(s) ? s.toUpperCase() : s);

export function hideStratum(svg, id) {
  const g = svg?.querySelector?.(`#${id}`);
  if (g) g.remove();
}

export function renderStratum(svg, { id, viewport, items, selectedIndex = 0, mirrored = false, labelFor, centerMagnified = false, rotating = false, classFor = null, allowEmpty = false, labelsBeside = false, lensShift = 0 } = {}) {
  if (!svg || !Array.isArray(items)) return null;
  // An EMPTY ring is a real state for the basement (O-126): a reader with no
  // bookmarks yet sees the band and the hollow lens and nothing on them —
  // the floor exists before anything is put on it. The choosers above never
  // ask for this: an empty language plane is an error, not a state.
  if (!items.length && !allowEmpty) return null;

  // Reuse a STABLE group per id — and if NOTHING about this render differs
  // from what the group already shows, leave its children entirely alone.
  // iOS Safari does not reliably apply a CSS `filter` to freshly-inserted
  // SVG content: a receded stratum whose children were rebuilt in the same
  // beat its blur was set stayed SHARP on iPhone (the settle's re-render —
  // Howell 2026-07-22, second sighting). The primary blurs fine because its
  // subtree persists across the filter change; with the signature skip, a
  // settled stratum's subtree persists the same way.
  const classes = typeof classFor === 'function' ? items.map(it => classFor(it) || '') : null;
  const signature = JSON.stringify([items, selectedIndex, mirrored, Boolean(centerMagnified), Boolean(rotating), viewport.width, viewport.height, classes, Boolean(labelsBeside), lensShift]);
  // A nested <svg> per stratum, NOT a bare <g> (Howell 2026-07-27): iOS/WebKit
  // honors a CSS `filter` on an <svg> element (as on the #app root and the HTML
  // verse panel) but SILENTLY DROPS it on a <g>. So the recede BLUR rides this
  // outer <svg>; the recede TRANSFORM rides the inner <g>. The element persists
  // across renders (the signature skip) so the filter sticks — WebKit won't
  // re-apply a filter to freshly-inserted SVG content.
  let outer = svg.querySelector(`#${id}`);
  if (outer && outer.dataset.signature === signature) return outer;
  let g;
  if (outer) {
    g = outer.querySelector('.stratum-inner');
    while (g.firstChild) g.removeChild(g.firstChild);
  } else {
    outer = svgEl('svg', { id, class: 'secondary-strata' });
    // A TOP-LEVEL svg overlaying the strata-layer div (all strata stacked at
    // inset:0). WebKit blurs an svg root but not a <g> or a nested svg, so each
    // stratum is its own root here.
    outer.style.position = 'absolute';
    outer.style.left = '0';
    outer.style.top = '0';
    outer.style.width = '100%';
    outer.style.height = '100%';
    outer.style.overflow = 'visible'; // clip at the strata layer, as the bare <g> did
    g = svgEl('g', { class: 'stratum-inner' });
    outer.appendChild(g);
    svg.appendChild(outer);
  }
  outer.setAttribute('x', '0');
  outer.setAttribute('y', '0');
  outer.setAttribute('width', String(viewport.width));
  outer.setAttribute('height', String(viewport.height));
  outer.dataset.signature = signature;

  const layout = computeStrataLayout(viewport, Math.max(1, items.length), selectedIndex, mirrored, { lensShift });
  if (!items.length) layout.nodes = [];   // the band and the lens, no seats
  const nodeR = viewport.SSd * NODE_RADIUS_RATIO;
  const magR = viewport.SSd * MAGNIFIER_RADIUS_RATIO;

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
  const sigma = getNodeSpacing(viewport) * LENS_SCALE_SIGMA;
  const magAngle = layout.magnifier?.angle ?? null;
  layout.nodes.forEach(node => {
    if (!rotating && node.index === layout.magIndex) return;
    // Passing the lens (labelsBeside only): the primary's bell, on the angle.
    let magScale = 1;
    if (labelsBeside && rotating && magAngle != null) {
      const dist = Math.abs(node.angle - magAngle);
      magScale = 1 + (LENS_SCALE_PEAK - 1) * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    }
    const circle = svgEl('circle', {
      cx: node.x.toFixed(1), cy: node.y.toFixed(1), r: (nodeR * magScale).toFixed(1),
      class: `secondary-strata-node${classes?.[node.index] ? ` ${classes[node.index]}` : ''}`
    });
    circle.dataset.index = String(node.index);
    g.appendChild(circle);
    const rotDeg = (node.angle * 180) / Math.PI + 180;
    const raw = typeof labelFor === 'function' ? labelFor(items[node.index], false) : items[node.index];
    let label;
    if (labelsBeside && magScale <= 1.01) {
      // Beside the node, left-aligned: the name starts just past the node and runs on.
      const lx = node.x + Math.cos(node.angle) * nodeR * BESIDE_OFFSET;
      const ly = node.y + Math.sin(node.angle) * nodeR * BESIDE_OFFSET;
      label = svgEl('text', {
        x: lx.toFixed(1), y: ly.toFixed(1), 'text-anchor': 'start', 'dominant-baseline': 'middle',
        class: 'secondary-strata-label is-beside',
        transform: `rotate(${rotDeg.toFixed(1)}, ${lx.toFixed(1)}, ${ly.toFixed(1)})`
      });
    } else {
      // On the node — the numeral's seat, and the swelling name passing the lens.
      label = svgEl('text', {
        x: '0', y: '0', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        class: `secondary-strata-label${magScale > 1.01 ? ' is-passing' : ''}`,
        transform: `translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${rotDeg.toFixed(1)})${magScale > 1.01 ? ` scale(${magScale.toFixed(3)})` : ''}`
      });
    }
    label.textContent = displayCase(String(raw ?? ''));
    g.appendChild(label);
  });

  // THE LODESTAR (docs/archive/DESIGN_CLARIFICATIONS.md): the magnifier is a FIXED point
  // at magA — the reference everything rotates around. It never moves. WHILE
  // ROTATING it is an EMPTY hollow lens the nodes stream through (like the
  // primary's); SETTLED it fills with the item nearest the lens (magIndex),
  // magnified. Drawn last, so a node sliding through passes behind it.
  const mag = layout.magnifier;
  const magRotDeg = (mag.angle * 180) / Math.PI + 180;
  const magClass = !rotating && classes?.[layout.magIndex] ? ` ${classes[layout.magIndex]}` : '';
  g.appendChild(svgEl('circle', {
    cx: mag.x.toFixed(1), cy: mag.y.toFixed(1), r: magR.toFixed(1),
    class: 'secondary-strata-node is-magnified' + (rotating || !items.length ? ' lens-empty' : '') + magClass
  }));
  if (!rotating && items.length) {
    // Centred for a central magnifier (the tertiary's) and for a ring with the
    // primary's manners (the basement's), else start-anchored and pulled
    // inward off the left edge (the secondary's, hard against it).
    const pulled = !centerMagnified && !labelsBeside;
    const magLabel = svgEl('text', {
      x: (pulled ? -magR * MAG_LABEL_SPAN_PULL : 0).toFixed(1), y: '0',
      'text-anchor': pulled ? 'start' : 'middle', 'dominant-baseline': 'middle',
      class: 'secondary-strata-label is-magnified',
      transform: `translate(${mag.x.toFixed(1)}, ${mag.y.toFixed(1)}) rotate(${magRotDeg.toFixed(1)})`
    });
    const magRaw = typeof labelFor === 'function' ? labelFor(items[layout.magIndex], true) : items[layout.magIndex];
    magLabel.textContent = displayCase(String(magRaw ?? ''));
    g.appendChild(magLabel);
  }

  // Already appended on create; a reused stratum stays put so its DOM order
  // (and thus z-order: secondary below, tertiary above) holds without
  // re-inserting. Return the OUTER <svg> — the blur rides it; callers pass it
  // to setStratumVisual, which drives the transform on the inner <g>.
  return outer;
}
