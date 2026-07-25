// Search mode's LOOK — the same room under a different light.
//
// Feedback on the shipped search was that swapping manufacturer names for
// letters wasn't shift enough: nothing told you that you had picked up a
// different tool (Howell 2026-07-22). Search is not a volume and not a
// stratum — it is a tool applied to where you are standing (the corpus IS
// the ring you left) — so a wholesale palette change would lie about what
// happened. Dimming the lamps for close work tells the truth.
//
// Two moves, both made of the instrument:
//   1. THE WATERMARK — the dividers you just pressed, blown up huge and
//      faint behind the completions. The same vocabulary the volume logos
//      already use behind detail text; no new visual language invented.
//   2. THE LIGHT — the ground dims (a transform on the ACTIVE theme, never
//      a hardcoded palette, so any volume that later earns dividers dims in
//      its own hue). The nodes and their labels are left alone: the same
//      amber ring simply leaps forward against a dark ground — one token
//      doing the work of a repaint.
//
// Everything styled dark-on-light must invert, or it vanishes: the
// completion stars and their labels, the carriage, and the dividers icon
// itself — which is the way OUT of the mode. Those live in base.css under
// :root.search-mode; only the computed colours are set from here.

import { buildDividers } from './search-dividers.js';

const WATERMARK_ID = 'search-watermark';
const WATERMARK_OPACITY = 0.1;   // the crown-of-thorns register: barely there
const WATERMARK_SPAN = 0.9;      // × the short screen dimension
const WATERMARK_CX = 0.6;        // × width  — behind where the completions scatter
const WATERMARK_CY = 0.4;        // × height
const WATERMARK_STROKE = 1.2;    // local units; scales up with the drawing
const DIM_TOWARD = [25, 25, 25]; // fallback only: near-black
const DIM_MIX = 0.82;            // fallback only: how far the ground travels toward it
const BAND_LIFT = 0.22;          // how far the band travels toward white
const FADE_MS = 300;             // the lights come up / go down over this
const SCOPE_ID = 'search-scope-label';

const SVGNS = 'http://www.w3.org/2000/svg';

// ── colour arithmetic (hex or rgb() in, rgb() out) ────────────────────────
function parseColor(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s[0] === '#') {
    const h = s.slice(1);
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (full.length < 6) return null;
    const n = parseInt(full.slice(0, 6), 16);
    if (!Number.isFinite(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(v => !Number.isFinite(v))) return null;
  return [parts[0], parts[1], parts[2]];
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

// ── the watermark ─────────────────────────────────────────────────────────
export function mountSearchWatermark(svgRoot, viewport) {
  if (!svgRoot || !viewport) return null;
  removeSearchWatermark(svgRoot);
  const scale = (viewport.SSd * WATERMARK_SPAN) / 100; // the drawing is a 100-unit square
  const cx = viewport.width * WATERMARK_CX;
  const cy = viewport.height * WATERMARK_CY;
  const wrap = document.createElementNS(SVGNS, 'g');
  wrap.setAttribute('id', WATERMARK_ID);
  wrap.setAttribute('class', 'search-watermark');
  wrap.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${scale.toFixed(3)})`);
  wrap.appendChild(buildDividers({ strokeWidth: WATERMARK_STROKE, nonScaling: false }));
  wrap.style.opacity = '0';
  // First child: above the ground, behind every moving part.
  svgRoot.insertBefore(wrap, svgRoot.firstChild);
  requestAnimationFrame(() => {
    wrap.style.transition = `opacity ${FADE_MS}ms ease`;
    wrap.style.opacity = String(WATERMARK_OPACITY);
  });
  return wrap;
}

export function removeSearchWatermark(svgRoot) {
  const existing = svgRoot?.querySelector?.(`#${WATERMARK_ID}`);
  if (!existing) return;
  existing.style.transition = `opacity ${FADE_MS}ms ease`;
  existing.style.opacity = '0';
  setTimeout(() => existing.remove(), FADE_MS + 40);
}

// ── the scope label ───────────────────────────────────────────────────────
// The parent BUTTON has no meaning over the character ring — there is no
// vessel and nothing to ascend to — but its LABEL does: inside the letters
// the ring you were standing on is gone, and nothing else on screen says
// what the search is filtered to (Howell 2026-07-22, correcting my "the
// ring is the scope display" — true only until the ring is replaced). So
// the label stays, lit for the dark ground, purely as a statement: no
// vessel, no click, no ascent.
export function setSearchScopeLabel(svgRoot, { text, x, y } = {}) {
  if (!svgRoot || !text) return null;
  let el = svgRoot.querySelector(`#${SCOPE_ID}`);
  if (!el) {
    el = document.createElementNS(SVGNS, 'text');
    el.setAttribute('id', SCOPE_ID);
    el.setAttribute('class', 'focus-ring-magnifier-label focus-ring-parent-label search-scope-label');
    el.setAttribute('text-anchor', 'start');
    el.setAttribute('dominant-baseline', 'middle');
    svgRoot.appendChild(el);
  }
  el.setAttribute('x', String(Math.round(x)));
  el.setAttribute('y', String(Math.round(y)));
  el.textContent = text;
  return el;
}

function removeSearchScopeLabel(svgRoot) {
  svgRoot?.querySelector?.(`#${SCOPE_ID}`)?.remove();
}

// ── the light ─────────────────────────────────────────────────────────────
let restoreLook = null;

// The ground search dims TO: the volume's own mark sits on a coloured disc,
// and the room takes that disc's colour (Howell 2026-07-22). Its RAW fill,
// never a composite — the disc is half transparent, so it paints over
// whatever is behind it, INCLUDING this ground. Compositing it over the old
// first made the disc darken a second time and read darker than the room.
// The arithmetic has one fixed point: for a disc of colour D at any alpha,
// mix(G, D, a) === G only when G === D. So the raw fill is the one ground
// the disc can sit on invisibly. No disc: dim the theme instead.
function searchGround(root, svg) {
  const disc = svg?.querySelector?.('#volume-logo-circle');
  const fill = disc ? parseColor(disc.getAttribute('fill')) : null;
  if (fill) return fill;
  const cs = getComputedStyle(root);
  const bg = parseColor(cs.getPropertyValue('--theme-color-bg')) || [245, 245, 245];
  return mix(bg, DIM_TOWARD, DIM_MIX);
}

export function enterSearchLook({ svg, viewport } = {}) {
  if (typeof document === 'undefined' || restoreLook) return;
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const band = parseColor(cs.getPropertyValue('--theme-color-band')) || [122, 121, 121];
  restoreLook = {
    rootBg: root.style.backgroundColor,
    bodyBg: document.body ? document.body.style.backgroundColor : '',
    svgBg: svg ? svg.style.backgroundColor : '',
    band: root.style.getPropertyValue('--theme-color-band')
  };
  const dimmed = rgb(searchGround(root, svg));
  const lifted = rgb(mix(band, [255, 255, 255], BAND_LIFT));
  const grounds = [root, document.body, svg].filter(Boolean);
  grounds.forEach(el => { el.style.transition = `background-color ${FADE_MS}ms ease`; });
  grounds.forEach(el => { el.style.backgroundColor = dimmed; });
  root.style.setProperty('--theme-color-band', lifted);
  root.classList.add('search-mode');
  mountSearchWatermark(svg, viewport);
  setTimeout(() => grounds.forEach(el => { el.style.transition = ''; }), FADE_MS + 50);
}

export function exitSearchLook({ svg } = {}) {
  if (typeof document === 'undefined' || !restoreLook) return;
  const root = document.documentElement;
  const grounds = [root, document.body, svg].filter(Boolean);
  grounds.forEach(el => { el.style.transition = `background-color ${FADE_MS}ms ease`; });
  root.style.backgroundColor = restoreLook.rootBg;
  if (document.body) document.body.style.backgroundColor = restoreLook.bodyBg;
  if (svg) svg.style.backgroundColor = restoreLook.svgBg;
  if (restoreLook.band) root.style.setProperty('--theme-color-band', restoreLook.band);
  else root.style.removeProperty('--theme-color-band');
  root.classList.remove('search-mode');
  removeSearchWatermark(svg);
  removeSearchScopeLabel(svg);
  setTimeout(() => grounds.forEach(el => { el.style.transition = ''; }), FADE_MS + 50);
  restoreLook = null;
}
