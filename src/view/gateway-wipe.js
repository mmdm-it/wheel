// Gateway transit: a cinema wipe (Howell 2026-07-18). No node moves — the
// new volume boots fully rendered underneath a frozen snapshot of the old
// screen, and a straight radius, pivoting on the off-screen hub, sweeps the
// snapshot away: downward on launch, upward on return.
//
// The snapshot's appearance is FROZEN AT CAPTURE: every visual property is
// inlined from computed style, because the live styling rides CSS theme
// variables that flip to the incoming volume's palette the instant the new
// theme applies — without inlining, the old drawing would suddenly wear the
// new colors mid-wipe.
//
// Capture happens AT THE TAP, before the new manifest even fetches: the
// snapshot covers the identical live screen for those frames, so any
// first-paint rasterization lag (WebKit drew cloned text a frame late — the
// "text blinks off" bug) lands invisibly over the same pixels. It also
// swallows input for the whole transit.

import { getArcParameters } from '../geometry/focus-ring-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// One wipe at a time: rapid volume alternation used to leave a previous
// wipe's defs in the document, and its stale clip id captured the new
// snapshot (whole screen flipped at once, only the seam line animating).
let activeWipe = null;
let wipeSeq = 0;

export function cancelGatewayWipe() {
  if (activeWipe) activeWipe.finish();
}

// The computed properties that determine how an SVG element looks.
const FROZEN_PROPS = [
  'fill', 'stroke', 'strokeWidth', 'strokeDasharray', 'strokeLinecap',
  'opacity', 'fillOpacity', 'strokeOpacity',
  'fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'textTransform',
  'visibility', 'display'
];

function freezeStyles(original, clone) {
  if (original.nodeType !== 1) return;
  if (typeof getComputedStyle === 'function') {
    const cs = getComputedStyle(original);
    for (const prop of FROZEN_PROPS) {
      const v = cs[prop];
      if (v !== undefined && v !== '') clone.style[prop] = v;
    }
  }
  const oc = original.childNodes;
  const cc = clone.childNodes;
  for (let i = 0; i < oc.length; i += 1) {
    if (cc[i]) freezeStyles(oc[i], cc[i]);
  }
}

/**
 * Capture the current screen as a self-contained frozen group and lay it
 * over the live (identical) content immediately. Call at the moment of the
 * gateway tap, while the old volume and its theme are fully live. Any
 * in-flight wipe is finished first so the capture sees a settled screen.
 */
export function captureGatewaySnapshot(svg) {
  if (!svg || typeof document === 'undefined') return null;
  cancelGatewayWipe();

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('id', 'gateway-wipe-old');

  // The old ground color, resolved now (the svg background follows the theme).
  const bg = typeof getComputedStyle === 'function'
    ? getComputedStyle(svg).backgroundColor
    : '';
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', bg || '#868686');
  g.appendChild(rect);

  Array.from(svg.childNodes).forEach(node => {
    if (!node.cloneNode || node.nodeType !== 1) return;
    if (node.tagName && node.tagName.toLowerCase() === 'defs') return; // avoid duplicate ids
    const clone = node.cloneNode(true);
    freezeStyles(node, clone);
    g.appendChild(clone);
  });

  // The snapshot is scenery, not controls: swallow everything so a tap
  // mid-transit reaches neither the frozen clones nor the live app beneath.
  const swallow = e => { e.stopPropagation(); e.preventDefault(); };
  ['pointerdown', 'pointerup', 'pointermove', 'click', 'touchstart', 'touchmove', 'touchend']
    .forEach(type => g.addEventListener(type, swallow));

  // Cover the live screen NOW — identical pixels, so nothing changes to the
  // eye, and the browser gets its warm-up frames before the swap beneath.
  svg.appendChild(g);
  g._wipeOldBg = bg || '#868686';
  return g;
}

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Play the wipe: raise the snapshot above the freshly booted volume, then
 * sweep the dividing radius across the screen, erasing the snapshot as it
 * goes. Launch sweeps top → lower right; return sweeps bottom → top
 * (direction: 'down' | 'up') — the wipe always flows away from where you
 * are going. The snapshot is hard-clipped (cheapest possible cut); a 5px
 * gradient seam of the old ground color rides the line so the edge still
 * reads soft, with no masks or filters anywhere.
 *
 * The page background OUTSIDE the canvas (the strip some browsers paint
 * under the system navigation bar) can't be wiped — it flips wholesale at
 * the moment the sweep line meets that edge: the END of a downward wipe,
 * the START of an upward one.
 */
export function playGatewayWipe({ svg, snapshot, viewport, direction = 'down', durationMs = 1800, onDone }) {
  if (!svg || !snapshot || !viewport) { if (onDone) onDone(); return; }

  const arc = getArcParameters(viewport);
  const hubX = arc.hubX;
  const hubY = arc.hubY;
  wipeSeq += 1;
  const clipId = `gateway-wipe-clip-${wipeSeq}`;
  const gradId = `gateway-wipe-feather-${wipeSeq}`;

  // Angular window: the screen's four corners as seen from the hub.
  const corners = [
    [0, 0], [viewport.width, 0], [0, viewport.height], [viewport.width, viewport.height]
  ];
  const twoPi = 2 * Math.PI;
  const angles = corners.map(([x, y]) => {
    let a = Math.atan2(y - hubY, x - hubX);
    if (a < 0) a += twoPi; // continuous range: down-left ≈ π/2..π, up-left ≈ π..3π/2
    return a;
  });
  const softness = 5; // seam width (Howell: smoothness beats softness)
  const nearDist = Math.min(...corners.map(([x, y]) => Math.hypot(x - hubX, y - hubY)));
  const margin = 0.02 + softness / nearDist;
  const topAngle = Math.max(...angles) + margin;    // above the top corner
  const bottomAngle = Math.min(...angles) - margin; // below the bottom corner
  const radius = Math.max(...corners.map(([x, y]) => Math.hypot(x - hubX, y - hubY))) * 1.05;
  const goingDown = direction !== 'up';

  const oldBg = snapshot._wipeOldBg || '#868686';
  // The theme has already swapped: read the NEW page background, then pin
  // the old one back until the sweep line reaches the off-canvas strip.
  const rootEl = document.documentElement;
  const newBg = typeof getComputedStyle === 'function'
    ? getComputedStyle(rootEl).backgroundColor
    : '';
  const setPageBg = color => {
    rootEl.style.backgroundColor = color;
    if (document.body) document.body.style.backgroundColor = color;
  };
  setPageBg(oldBg);
  const flipPageBg = () => { if (newBg) setPageBg(newBg); };
  if (!goingDown) flipPageBg(); // upward wipe leaves the bottom edge first

  const defs = document.createElementNS(SVG_NS, 'defs');
  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.setAttribute('id', clipId);
  const wedgePath = document.createElementNS(SVG_NS, 'path');
  clip.appendChild(wedgePath);
  defs.appendChild(clip);

  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', String(hubX));
  grad.setAttribute('y1', String(hubY));
  grad.setAttribute('x2', String(hubX));
  grad.setAttribute('y2', String(hubY + (goingDown ? softness : -softness)));
  const stop1 = document.createElementNS(SVG_NS, 'stop');
  stop1.setAttribute('offset', '0');
  stop1.setAttribute('stop-color', oldBg);
  const stop2 = document.createElementNS(SVG_NS, 'stop');
  stop2.setAttribute('offset', '1');
  stop2.setAttribute('stop-color', oldBg);
  stop2.setAttribute('stop-opacity', '0');
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);

  // The seam: a 5px strip on the NEW side of the line, drawn content (not a
  // mask), rotating with the sweep.
  const band = document.createElementNS(SVG_NS, 'rect');
  band.setAttribute('x', String(hubX));
  band.setAttribute('y', String(goingDown ? hubY : hubY - softness));
  band.setAttribute('width', String(radius));
  band.setAttribute('height', String(softness));
  band.setAttribute('fill', `url(#${gradId})`);
  band.style.pointerEvents = 'none';

  // The clip keeps the NOT-YET-WIPED region — the wedge between the moving
  // sweep line and the fixed bound the wipe retreats toward: the bottom for
  // a downward wipe, the top for an upward one.
  const wedge = (hi, lo) => {
    const x1 = hubX + radius * Math.cos(hi);
    const y1 = hubY + radius * Math.sin(hi);
    const x2 = hubX + radius * Math.cos(lo);
    const y2 = hubY + radius * Math.sin(lo);
    const largeArc = (hi - lo) > Math.PI ? 1 : 0;
    // From the higher angle, sweep DECREASING angle down to the lower one.
    return `M${hubX} ${hubY} L${x1.toFixed(1)} ${y1.toFixed(1)} A${radius.toFixed(1)} ${radius.toFixed(1)} 0 ${largeArc} 0 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
  };

  const phiFrom = goingDown ? topAngle : bottomAngle;
  const phiTo = goingDown ? bottomAngle : topAngle;
  const regionFor = phi => (goingDown ? wedge(phi, bottomAngle) : wedge(topAngle, phi));

  const aim = phi => {
    const deg = (phi * 180) / Math.PI;
    band.setAttribute('transform', `rotate(${deg.toFixed(3)}, ${hubX}, ${hubY})`);
  };

  wedgePath.setAttribute('d', regionFor(phiFrom));
  aim(phiFrom);
  snapshot.setAttribute('clip-path', `url(#${clipId})`);
  svg.appendChild(defs);
  svg.appendChild(snapshot); // raise above the new volume — no pop at swap
  svg.appendChild(band);     // the seam rides above the boundary

  const wipe = {
    done: false,
    finish: () => {
      if (wipe.done) return;
      wipe.done = true;
      if (activeWipe === wipe) activeWipe = null;
      snapshot.remove();
      band.remove();
      defs.remove();
      flipPageBg();
      if (onDone) onDone();
    }
  };
  activeWipe = wipe;

  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const step = now => {
    if (wipe.done) return; // cancelled by a newer transit
    const t = Math.min(1, (now - start) / durationMs);
    const phi = phiFrom + (phiTo - phiFrom) * easeInOutCubic(t);
    wedgePath.setAttribute('d', regionFor(phi));
    aim(phi);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      wipe.finish();
    }
  };
  requestAnimationFrame(step);
}
