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

  // THE RING KEEPS ITS ELEMENTS (O-185, Howell 2026-09-30: the chooser rings
  // "not nearly as smooth as the primary stratum focus ring"). This used to
  // throw away every circle and every label whenever anything about the
  // render differed — and while a finger turns the ring, the centre differs
  // on every pointer move, so the whole ring was rebuilt, text shaping and
  // all, several times a frame. The primary never did that: it keeps its
  // node elements and moves them. So does this now. Two signatures: the
  // MEMBERSHIP (which seats, in which dress, on which viewport) rebuilds the
  // subtree; the POSE (where the centre is, whether the ring is turning)
  // only re-seats what is there.
  //
  // The membership skip is also what keeps iOS honest: Safari does not
  // reliably apply a CSS `filter` to freshly-inserted SVG content (a receded
  // stratum rebuilt in the beat its blur was set stayed SHARP on iPhone —
  // Howell 2026-07-22), and a subtree that persists across the filter change
  // blurs as the primary's does.
  const classes = typeof classFor === 'function' ? items.map(it => classFor(it) || '') : null;
  const membership = JSON.stringify([items, mirrored, Boolean(centerMagnified), viewport.width, viewport.height, classes, Boolean(labelsBeside), lensShift]);
  const pose = JSON.stringify([selectedIndex, Boolean(rotating)]);
  let outer = svg.querySelector(`#${id}`);
  if (outer && outer.dataset.signature === membership && outer.dataset.pose === pose) return outer;
  const layout = computeStrataLayout(viewport, Math.max(1, items.length), selectedIndex, mirrored, { lensShift });
  if (!items.length) layout.nodes = [];   // the band and the lens, no seats
  const nodeR = viewport.SSd * NODE_RADIUS_RATIO;
  const magR = viewport.SSd * MAGNIFIER_RADIUS_RATIO;
  let seats = outer && outer.dataset.signature === membership ? outer.__seats : null;
  let g;
  if (seats) {
    g = outer.__inner;
  } else {
    if (outer) {
      g = outer.querySelector('.stratum-inner') || outer.__inner;
      while (g.firstChild) g.removeChild(g.firstChild);
    } else {
      // A nested <svg> per stratum, NOT a bare <g> (Howell 2026-07-27):
      // iOS/WebKit honors a CSS `filter` on an <svg> element (as on the #app
      // root and the HTML verse panel) but SILENTLY DROPS it on a <g>. So the
      // recede BLUR rides this outer <svg>, and so does the recede TRANSFORM
      // now (O-185: a CSS transform on the element the browser already
      // composites, so a receding plane is a bitmap scaled on the GPU rather
      // than a subtree re-rasterised every frame).
      outer = svgEl('svg', { id, class: 'secondary-strata' });
      // A TOP-LEVEL svg overlaying the strata-layer div (all strata stacked at
      // inset:0). WebKit blurs an svg root but not a <g> or a nested svg, so
      // each stratum is its own root here.
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
    outer.__inner = g;
    // A ring with the primary's manners says so on its root, for the styles:
    // its lens label is larger, not bolder (Howell, 2026-09-14).
    outer.classList?.toggle?.('labels-beside', Boolean(labelsBeside));
    outer.setAttribute('x', '0');
    outer.setAttribute('y', '0');
    outer.setAttribute('width', String(viewport.width));
    outer.setAttribute('height', String(viewport.height));

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

    // One circle and one label per seat, in seat order, made once. The
    // label's TEXT is the seat's own and never changes with the pose; where
    // it sits and how it is anchored does.
    seats = items.map((item, index) => {
      const circle = svgEl('circle', { class: `secondary-strata-node${classes?.[index] ? ` ${classes[index]}` : ''}` });
      circle.dataset.index = String(index);
      const label = svgEl('text', { class: 'secondary-strata-label', 'dominant-baseline': 'middle' });
      const raw = typeof labelFor === 'function' ? labelFor(item, false) : item;
      label.textContent = displayCase(String(raw ?? ''));
      g.appendChild(circle);
      g.appendChild(label);
      return { circle, label, baseClass: `secondary-strata-node${classes?.[index] ? ` ${classes[index]}` : ''}` };
    });
    // THE LODESTAR (docs/archive/DESIGN_CLARIFICATIONS.md): the magnifier is
    // a FIXED point at magA — the reference everything rotates around. Drawn
    // last, so a node sliding through passes behind it.
    const lens = svgEl('circle', { cx: layout.magnifier.x.toFixed(1), cy: layout.magnifier.y.toFixed(1), r: magR.toFixed(1) });
    const lensLabel = svgEl('text', { y: '0', 'dominant-baseline': 'middle', class: 'secondary-strata-label is-magnified' });
    g.appendChild(lens);
    g.appendChild(lensLabel);
    outer.__seats = seats;
    outer.__lens = lens;
    outer.__lensLabel = lensLabel;
    outer.dataset.signature = membership;
  }

  // THE POSE: every seat to its place for this centre. While turning, EVERY
  // node is drawn (they stream through the empty lens, as on the primary);
  // settled, the node in the lens (magIndex) is hidden and the filled
  // lodestar shows it instead, so nothing floats where the lens is anchored.
  const sigma = getNodeSpacing(viewport) * LENS_SCALE_SIGMA;
  const magAngle = layout.magnifier?.angle ?? null;
  const show = (el, on) => { if (on) el.removeAttribute('display'); else el.setAttribute('display', 'none'); };
  const posed = new Set();
  layout.nodes.forEach(node => {
    const seat = seats[node.index];
    if (!seat) return;
    posed.add(node.index);
    const inLens = !rotating && node.index === layout.magIndex;
    show(seat.circle, !inLens);
    show(seat.label, !inLens);
    if (inLens) return;
    // Passing the lens (labelsBeside only): the primary's bell, on the angle.
    let magScale = 1;
    if (labelsBeside && rotating && magAngle != null) {
      const dist = Math.abs(node.angle - magAngle);
      magScale = 1 + (LENS_SCALE_PEAK - 1) * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    }
    seat.circle.setAttribute('cx', node.x.toFixed(1));
    seat.circle.setAttribute('cy', node.y.toFixed(1));
    seat.circle.setAttribute('r', (nodeR * magScale).toFixed(1));
    const rotDeg = (node.angle * 180) / Math.PI + 180;
    const label = seat.label;
    if (labelsBeside && magScale <= 1.01) {
      // Beside the node, left-aligned: the name starts just past the node and runs on.
      const lx = node.x + Math.cos(node.angle) * nodeR * BESIDE_OFFSET;
      const ly = node.y + Math.sin(node.angle) * nodeR * BESIDE_OFFSET;
      label.setAttribute('x', lx.toFixed(1));
      label.setAttribute('y', ly.toFixed(1));
      label.setAttribute('text-anchor', 'start');
      label.setAttribute('class', 'secondary-strata-label is-beside');
      label.setAttribute('transform', `rotate(${rotDeg.toFixed(1)}, ${lx.toFixed(1)}, ${ly.toFixed(1)})`);
    } else {
      // On the node — the numeral's seat, and the swelling name passing the lens.
      label.setAttribute('x', '0');
      label.setAttribute('y', '0');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', `secondary-strata-label${magScale > 1.01 ? ' is-passing' : ''}`);
      label.setAttribute('transform', `translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${rotDeg.toFixed(1)})${magScale > 1.01 ? ` scale(${magScale.toFixed(3)})` : ''}`);
    }
  });
  seats.forEach((seat, index) => { if (!posed.has(index)) { show(seat.circle, false); show(seat.label, false); } });

  // The lens: while ROTATING an EMPTY hollow lens the nodes stream through
  // (like the primary's); SETTLED it fills with the item nearest the lens
  // (magIndex), magnified.
  const lens = outer.__lens, lensLabel = outer.__lensLabel;
  const magClass = !rotating && classes?.[layout.magIndex] ? ` ${classes[layout.magIndex]}` : '';
  lens.setAttribute('class', 'secondary-strata-node is-magnified' + (rotating || !items.length ? ' lens-empty' : '') + magClass);
  if (!rotating && items.length) {
    const mag = layout.magnifier;
    const magRotDeg = (mag.angle * 180) / Math.PI + 180;
    // Centred for a central magnifier (the tertiary's) and for a ring with the
    // primary's manners (the basement's), else start-anchored and pulled
    // inward off the left edge (the secondary's, hard against it).
    const pulled = !centerMagnified && !labelsBeside;
    lensLabel.setAttribute('x', (pulled ? -magR * MAG_LABEL_SPAN_PULL : 0).toFixed(1));
    lensLabel.setAttribute('text-anchor', pulled ? 'start' : 'middle');
    lensLabel.setAttribute('transform', `translate(${mag.x.toFixed(1)}, ${mag.y.toFixed(1)}) rotate(${magRotDeg.toFixed(1)})`);
    const magRaw = typeof labelFor === 'function' ? labelFor(items[layout.magIndex], true) : items[layout.magIndex];
    lensLabel.textContent = displayCase(String(magRaw ?? ''));
    show(lensLabel, true);
  } else {
    show(lensLabel, false);
  }
  outer.dataset.pose = pose;

  // Already appended on create; a reused stratum stays put so its DOM order
  // (and thus z-order: secondary below, tertiary above) holds without
  // re-inserting. Return the OUTER <svg> — the blur and the recede transform
  // ride it (setStratumVisual).
  return outer;
}
