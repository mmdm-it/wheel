// "The instrument arrives" — the first-visit boot reveal (C.4).
// Inspiration: the Cold Comfort Farm credits — a line drawing that dissolves
// into the live panorama. The ground is the app's own grey THROUGHOUT (the
// #app SVG is painted grey by applyTheme, and index.html paints the page grey
// inline, so it is there the instant the page loads — no flash). The wheel
// draws itself in graphite line-work that settles to black; labels TYPE one
// character at a time in a set order; then it hands off to the live coloured
// wheel. Filter-free.
//
// Drawn INSIDE #app, as a sibling group to the (hidden) content group — so the
// drawing shares the wheel's exact coordinate system and lands precisely where
// the wheel renders, with no jump at handoff (a separate overlay could not be
// reconciled: #app is sized in vh, not innerHeight, and WebKit's getScreenCTM
// did not bridge it). Everything else — fonts, sizes, weights — is read from
// the real elements, so the drawing IS the wheel it becomes.
//
// Gating (Howell 2026-07-17): first visit plays it (localStorage is the
// reliable "seen it" signal; our assets revalidate so HTTP-cache is fuzzy);
// a returning browser pops straight on. ?splash=1 forces, ?splash=0 skips.

const SEEN_KEY = 'wheel-splash-seen';
const SVGNS = 'http://www.w3.org/2000/svg';

// Tunables — dial by feel on the LAN. Budgeted to ~7s (it plays once).
const T = {
  preInkMs: 400,       // grey beat before the first line
  arcDrawMs: 1600,     // the ring arc inking itself, upper-left → lower-right
  nodeDrawMs: 200,     // each ring node's compass draw (unchanged)
  nodeGapMs: 130,      // tiny pause between nodes, so the sequence reads
  circleDrawMs: 750,   // the magnifier / parent button
  charMs: 85,          // per typed character — unhurried, handcrafted
  gapMs: 360,          // breath between the focal labels
  pyramidDrawMs: 700,  // pyramid circles
  logoFadeMs: 800,
  holdMs: 1000,        // the finished drawing sits complete before it dissolves
  dissolveMs: 1000,    // hand off to the live wheel
  inputUnlockMs: 500   // keep touch blocked this long PAST the final fade-in
};
// No graphite phase (Howell 2026-07-17): the line-work is drawn in the
// finished wheel's own colours, read from each element. The arc is a
// structural line, drawn in the wheel's ink (text/stroke) colour.
const ARC_COLOR = '#000000';

// The colour to ink an element's OUTLINE in: its visible stroke if it has one
// (the magnifier's black ring), otherwise black. A node has only a fill (amber)
// and no stroke — its line-drawing is a black circle; the amber arrives when
// the real filled node fades in at the dissolve (Howell 2026-07-17).
function finalColor(elem) {
  const cs = getComputedStyle(elem);
  const stroke = cs.stroke && cs.stroke !== 'none' && cs.stroke !== 'rgba(0, 0, 0, 0)' ? cs.stroke : null;
  return stroke || '#000';
}

export function bootSplashShouldPlay() {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  if (p.get('splash') === '1') return true;
  if (p.get('splash') === '0') return false;
  try { return !window.localStorage.getItem(SEEN_KEY); } catch (e) { return false; }
}

function markSeen() {
  try { window.localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* private mode */ }
}

const wait = ms => new Promise(r => setTimeout(r, ms));

function el(tag, attrs) {
  const node = document.createElementNS(SVGNS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

// Self-drawing stroke: dash the whole length, then sweep the offset to zero.
// Driven by the Web Animations API — a CSS transition here depends on the
// browser painting the start state first, which iOS WebKit does not reliably
// do, making the line pop fully-drawn instead of sweeping.
function inkStroke(pathEl, len, durationMs) {
  const L = Number.isFinite(len) && len > 0 ? len : 1;
  pathEl.style.strokeDasharray = String(L);
  pathEl.style.strokeDashoffset = String(L);
  if (typeof pathEl.animate === 'function') {
    pathEl.animate(
      [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
      { duration: durationMs, easing: 'ease-in-out', fill: 'forwards' }
    );
  } else {
    requestAnimationFrame(() => {
      pathEl.style.transition = `stroke-dashoffset ${durationMs}ms ease-in-out`;
      pathEl.style.strokeDashoffset = '0';
    });
  }
}

function smoothPath(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

// Raw local coords — the splash draws in the SAME SVG, so no mapping needed.
function readCircles(svg, selector) {
  return Array.from(svg.querySelectorAll(selector)).map(c => {
    const x = parseFloat(c.getAttribute('cx'));
    const y = parseFloat(c.getAttribute('cy'));
    const r = parseFloat(c.getAttribute('r'));
    if (![x, y, r].every(Number.isFinite)) return null;
    return { x, y, r, weight: parseFloat(getComputedStyle(c).strokeWidth) || 0, color: finalColor(c) };
  }).filter(Boolean);
}

// The real label elements — cloned so the drawing inherits their exact class
// (font, size, weight, letter-spacing, and the uppercase text-transform).
function readLabelEls(svg, selector) {
  return Array.from(svg.querySelectorAll(selector)).filter(t => {
    const x = parseFloat(t.getAttribute('x'));
    const y = parseFloat(t.getAttribute('y'));
    return Number.isFinite(x) && Number.isFinite(y) && (t.textContent || '').trim();
  });
}

function strokeLine(layer, d, width, color) {
  const p = el('path', {
    d, fill: 'none', stroke: color || ARC_COLOR, 'stroke-width': String(width || 2),
    'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  });
  layer.appendChild(p);
  return p;
}

function inkCircle(layer, c, durationMs) {
  const width = c.weight > 0 ? c.weight : (c.r > 20 ? 2 : 1.5);
  const circ = el('circle', {
    cx: String(c.x), cy: String(c.y), r: String(c.r),
    fill: 'none', stroke: c.color || ARC_COLOR, 'stroke-width': String(width)
  });
  layer.appendChild(circ);
  inkStroke(circ, 2 * Math.PI * c.r, durationMs || T.circleDrawMs);
}

// Type a label into the drawing, one character at a time. The element is a
// clone of the real label — same class, so it keeps the wheel's exact font AND
// its final colour; nothing to override.
function typeLabel(layer, srcEl) {
  const full = (srcEl.textContent || '').trim();
  const t = srcEl.cloneNode(false);
  t.removeAttribute('id');
  t.textContent = '';
  t.style.visibility = '';
  t.style.opacity = '';
  layer.appendChild(t);
  const chars = [...full];
  let i = 0;
  return new Promise(resolve => {
    const step = () => {
      i += 1;
      t.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) { resolve(); return; }
      setTimeout(step, T.charMs);
    };
    step();
  });
}

export async function playBootSplash({ svg, contentGroup, viewport, arcPoints }) {
  markSeen();
  const src = svg || document.getElementById('app');
  if (!src) return;

  // Swallow all touch input for the whole reveal (the wheel's handlers are
  // live underneath) — removed only 500ms past the final fade-in (Howell).
  const inputBlocker = document.createElement('div');
  inputBlocker.id = 'boot-splash-blocker';
  inputBlocker.style.cssText = 'position:fixed;inset:0;z-index:100000;background:transparent;touch-action:none';
  if (document.body) document.body.appendChild(inputBlocker);

  // Hide the live wheel; draw on the grey SVG in its place. The logo group
  // (blue circle + image) sits OUTSIDE the content group and the copyright is
  // an HTML div — both hidden too, to arrive only at the end (Howell).
  const logoGroup = src.querySelector('#volume-logo-group');
  const copyright = typeof document !== 'undefined' ? document.getElementById('copyright-notice') : null;
  if (contentGroup) contentGroup.style.opacity = '0';
  if (logoGroup) logoGroup.style.opacity = '0';
  if (copyright) copyright.style.opacity = '0';
  if (svg) svg.style.opacity = '';

  const layer = el('g', { id: 'boot-splash-layer' });
  const lines = el('g', {});
  const text = el('g', {});
  layer.appendChild(lines);
  layer.appendChild(text);
  src.appendChild(layer);

  const reveal = () => {
    if (contentGroup) contentGroup.style.opacity = '';
    if (logoGroup) logoGroup.style.opacity = '';
    if (copyright) copyright.style.opacity = '';
    layer.remove();
    inputBlocker.remove();
  };

  try {
    await wait(T.preInkMs);

    // 1) The ring arc sweeps in — its compass pivot is off the page.
    if (arcPoints && arcPoints.length) {
      const arc = strokeLine(lines, smoothPath(arcPoints), 2.5, ARC_COLOR);
      inkStroke(arc, arc.getTotalLength ? arc.getTotalLength() : 2000, T.arcDrawMs);
      await wait(T.arcDrawMs);
    }

    // 2) The ring nodes draw one at a time, upper-left → lower-right, each in
    // ~200ms — the sweep populating with beads in the arc's own direction.
    // The selected node sits under the magnifier (the wheel stacks both, the
    // filled magnifier hiding the node); in outline we'd see a spurious small
    // circle there, so skip any node within the magnifier's radius.
    const magEl = src.querySelector('.focus-ring-magnifier .focus-ring-magnifier-circle');
    const mag = magEl ? {
      x: parseFloat(magEl.getAttribute('cx')),
      y: parseFloat(magEl.getAttribute('cy')),
      r: parseFloat(magEl.getAttribute('r'))
    } : null;
    const underMagnifier = c => mag && Number.isFinite(mag.x) && Math.hypot(c.x - mag.x, c.y - mag.y) <= mag.r;

    // The magnifier takes its place in the left→right sweep as one of the beads:
    // the nodes march in from the upper-left, the magnifier is struck when the
    // sweep reaches its spot, then the nodes continue down to the lower-right.
    const beads = readCircles(src, '.focus-ring-node').filter(c => !underMagnifier(c));
    if (mag && Number.isFinite(mag.x)) {
      mag.weight = parseFloat(getComputedStyle(magEl).strokeWidth) || 0;
      beads.push(mag); // the magnifier is just another bead in the sweep
    }
    beads.sort((a, b) => a.x - b.x);
    for (const c of beads) {
      // Every bead draws at the same brisk node pace — the magnifier included.
      inkCircle(lines, c, T.nodeDrawMs);
      await wait(T.nodeDrawMs + T.nodeGapMs);
    }

    // Only then does the parent button ring appear — on its own, no longer with
    // the magnifier.
    Array.from(src.querySelectorAll('.focus-ring-magnifier-circle'))
      .filter(pe => !pe.closest('.focus-ring-magnifier'))
      .forEach(pe => {
        const c = {
          x: parseFloat(pe.getAttribute('cx')), y: parseFloat(pe.getAttribute('cy')),
          r: parseFloat(pe.getAttribute('r')), weight: parseFloat(getComputedStyle(pe).strokeWidth) || 0
        };
        if ([c.x, c.y, c.r].every(Number.isFinite)) inkCircle(lines, c, T.circleDrawMs);
      });
    await wait(T.circleDrawMs);

    // 3) Focal labels IN ORDER: parent (country) → magnifier (maker).
    for (const l of readLabelEls(src, '.focus-ring-parent-label')) { await typeLabel(text, l); await wait(T.gapMs); }
    const magLabels = readLabelEls(src, '.focus-ring-magnifier-label:not(.focus-ring-parent-label)');
    for (const l of magLabels) { await typeLabel(text, l); await wait(T.gapMs); }

    // 4) Every other visible manufacturer types at once — the chorus, before
    // the pyramid (Howell 2026-07-17: manufacturer names come first).
    const magText = new Set(magLabels.map(l => (l.textContent || '').trim()));
    const others = readLabelEls(src, '.focus-ring-label').filter(l => !magText.has((l.textContent || '').trim()));
    await Promise.all(others.map(l => typeLabel(text, l)));
    await wait(T.gapMs);

    // 5) Then the child pyramid inks, and its labels (the cylinder counts) type.
    readCircles(src, '.child-pyramid-node').forEach(c => inkCircle(lines, c));
    await wait(T.pyramidDrawMs * 0.5);
    await Promise.all(readLabelEls(src, '.child-pyramid-label').map(l => typeLabel(text, l)));
    await wait(T.gapMs);

    // 6) Only now — after all the line-work — the maker's mark (the real logo
    // group: blue circle + image) and the copyright notice fade in.
    if (logoGroup) {
      logoGroup.style.transition = `opacity ${T.logoFadeMs}ms ease-in`;
      logoGroup.style.opacity = '1';
    }
    if (copyright) {
      copyright.style.transition = `opacity ${T.logoFadeMs}ms ease-in`;
      copyright.style.opacity = '1';
    }
    await wait(T.logoFadeMs);

    // 7) Hold — the finished drawing complete on the desk before it lifts.
    await wait(T.holdMs);

    // 8) Cross-fade to the live coloured wheel underneath.
    if (contentGroup) {
      contentGroup.style.transition = `opacity ${T.dissolveMs}ms ease-in-out`;
      contentGroup.style.opacity = '';
    }
    layer.style.transition = `opacity ${T.dissolveMs}ms ease-in-out`;
    requestAnimationFrame(() => { layer.style.opacity = '0'; });
    await wait(T.dissolveMs);
    layer.remove();

    // The wheel is fully faded in — hold input off a beat longer, then release.
    await wait(T.inputUnlockMs);
    inputBlocker.remove();
  } catch (err) {
    reveal();
    throw err;
  }
}
