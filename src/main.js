import { createApp, getViewportInfo, buildBibleVerseCousinChain, buildBibleBookCousinChain, validateVolumeRoot } from './index.js';
import { getPlacesLevels, buildPlacesLevel, buildCalendarYears, buildBibleBooks, buildCatalogManufacturers, getCatalogChildren, getCalendarMonths, getBibleChapters, toRomanNumeral } from './adapters/volume-helpers.js';
import { createVolumeLayoutSpec } from './adapters/volume-layout.js';
import { adapterLoader, volumeConfigs, DEFAULT_VOLUME, makeLabelFormatter } from './volume-configs.js';
import { mountFeelHud } from './view/feel-hud.js';
import { mountProbe } from './diagnostics/probe.js';
import { captureGatewaySnapshot, playGatewayWipe } from './view/gateway-wipe.js';
import { clearStack as clearMigrationStack } from './view/migration-animation.js';
import { createInteractionStore } from './core/interaction-store.js';
import { createDimensionBridge } from './core/dimension-bridge.js';
import { renderStratum, hideStratum } from './view/secondary-strata-view.js';
import { DetailPluginRegistry } from './view/detail/plugin-registry.js';
import { TextDetailPlugin } from './view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from './view/detail/plugins/card-plugin.js';
import { EphemerisDetailPlugin } from './view/detail/plugins/ephemeris-plugin.js';
import { computeDetailSectorBounds } from './geometry/detail-sector-geometry.js';
import { isDetailLevel } from './view/detail/detail-level.js';
import { computeFlickRotation, FLICK_GLIDE_MS } from './interaction/gesture-tiers.js';
import { getArcParameters, getViewportWindow, getNodeSpacing } from './geometry/focus-ring-geometry.js';
import { bootSplashShouldPlay, playBootSplash } from './view/boot-splash.js';

const svg = document.getElementById('app');

// Viewport responsiveness, part one: measure the GENUINELY-visible area and
// size the canvas from JS to the same numbers the geometry uses. window.inner*
// reports the full screen as if there were no address bar; visualViewport is
// the area actually visible BELOW a browser's chrome (e.g. a DuckDuckGo/Android
// top address bar). Measuring inner* — and measuring it at module load, before
// the bar drops in — computed for a full screen and the bar then cropped the
// bottom. One source of truth, measured fresh at boot.
function measureViewport() {
  const vv = window.visualViewport;
  const w = vv && vv.width ? Math.round(vv.width) : window.innerWidth;
  const h = vv && vv.height ? Math.round(vv.height) : window.innerHeight;
  return getViewportInfo(w, h);
}
const strataLayer = typeof document !== 'undefined' ? document.getElementById('strata-layer') : null;
// A transparent full-viewport hit target, kept as the FIRST (bottom) child of
// the strata layer, so the front stratum can be rotated by a drag STARTED
// anywhere — not only on the thin band or a node. Strata groups append after
// it, so it never covers them. Its pointer-events ride the layer's (toggled by
// strataFront), so it's inert at the primary.
const strataHit = strataLayer && typeof document !== 'undefined'
  ? (() => {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('id', 'strata-hit');
    r.setAttribute('x', '0'); r.setAttribute('y', '0');
    r.setAttribute('fill', 'transparent');
    // Inert by default — turned on ONLY while a stratum is front (renderStack).
    // pointer-events:all here overrides the layer's none, so it must be gated,
    // or it swallows every tap/swipe on the primary (Howell 2026-07-21).
    r.style.pointerEvents = 'none';
    strataLayer.appendChild(r);
    return r;
  })()
  : null;
function pinCanvas(vp) {
  if (svg) { svg.style.width = `${vp.width}px`; svg.style.height = `${vp.height}px`; }
  // The strata layer shares the primary's exact coordinate system (px, no
  // viewBox) so a stratum drawn at (x,y) lands where the geometry says.
  if (strataLayer) { strataLayer.style.width = `${vp.width}px`; strataLayer.style.height = `${vp.height}px`; }
  if (strataHit) { strataHit.setAttribute('width', String(vp.width)); strataHit.setAttribute('height', String(vp.height)); }
}
let viewport = measureViewport();
pinCanvas(viewport);

// D.2 — the dimension state lives at the HOST level, above bootVolume, so a
// choice survives volume reboots and gateway round trips (Howell ruling
// 2026-07-20, docs/DIMENSION_SYSTEM.md). The store and bridge are created
// once; each boot refreshes the bridge's registry and its render hook.
const dimensionStore = createInteractionStore();
const dimensionBridge = createDimensionBridge({ store: dimensionStore });

// D — the strata STACK (docs/DIMENSION_SYSTEM.md). Up to three deep for a
// dimensioned volume: primary (the volume) → secondary (languages, mirrored)
// → tertiary (translations, standard). The dimension button cycles which
// stratum is at
// the FRONT: primary → secondary → tertiary → primary. Each press pushes the
// stack one layer deeper — the front is full size, one layer back recedes to
// 0.4, two layers back to 0.2 — each receding one straight-pull-back
// (Disney multiplane: a 2D scale about the viewport centre, which drops the
// off-screen hub) and softening under a static rack-focus blur. The front
// opaquely covers the layers behind; strata not yet entered are hidden
// ("behind the user's head"). Selection is still tap-for-now — rotation
// (magnifier-as-selection) is the next build.
const STRATA_DEPTHS = [1.0, 0.4, 0.2];  // scale, indexed by levels behind the front
const STRATA_BLURS = [0, 5, 10];        // px local, same index
// Tangent fill span (radians past each viewport exit), sized to reach the
// screen edge at each recede scale — the deeper the ring, the more of the
// straight chain climbs into view (Howell 2026-07-21). Level 0 = arc-only.
const STRATA_TANGENT_SPANS = [0, 1.1, 2.2];
const CHOOSERS = [
  { id: 'secondary', mirrored: true,
    items: () => dimensionBridge.languagesAvailable(),
    label: id => dimensionBridge.languageLabel(id), // each tongue names itself
    selected: () => dimensionBridge.getSelection().language,
    select: id => dimensionBridge.setLanguage(id) },
  { id: 'tertiary', mirrored: false, centerMag: true,
    items: () => dimensionBridge.translationsOf(),
    // Magnified node: the full, spelled-out translation title (centred in the
    // magnifier); the rest keep the abbreviation/key — Howell 2026-07-21.
    label: (key, isMagnified) => (isMagnified ? dimensionBridge.translationName(key) : key),
    selected: () => dimensionBridge.getSelection().translation,
    select: key => dimensionBridge.setTranslation(key) }
];
let strataFront = 0;                       // 0 = primary at front
const isStrataOpen = () => strataFront !== 0;
const isSecondaryOpen = isStrataOpen;      // the primary pointer guard reads this
// The dimension feature lives IN the detail sector: strata recede only when
// the purple sill is on screen (a leaf), never over a child pyramid — that is
// where the sprocket-wheel-and-chain analogy reads (Howell 2026-07-21).
let detailSectorVisible = false;
const dimensionButton = typeof document !== 'undefined' ? document.getElementById('dimension-button') : null;

function scaleAboutCentre(scale) {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  return `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
}
// A plane's DEPTH is a uniform scale about the viewport centre (which drops
// the off-screen hub — Disney multiplane) plus a rack-focus blur. These
// setters apply an ARBITRARY scale/blur/opacity, so the settled snap and the
// animated tween drive the same pixels through one path.
function setPrimaryVisual(scale, blurPx) {
  const scaled = scale < 0.999;
  const tf = scaled ? scaleAboutCentre(scale) : null;
  const filter = blurPx > 0.01 ? `blur(${blurPx}px)` : '';
  ['.focus-content-group', '#volume-logo-group'].forEach(sel => {
    const g = document.querySelector(`#app ${sel}`);
    if (!g) return;
    if (tf) g.setAttribute('transform', tf); else g.removeAttribute('transform');
    g.style.filter = filter;
  });
  const panel = document.getElementById('detail-panel');
  if (panel) {
    const cx = viewport.width / 2, cy = viewport.height / 2;
    // Scale about the viewport CENTRE — the point the SVG ring/logo scale
    // about — so the verse text stays seated on the blue circle. The panel is
    // fixed at inset:0, so (cx,cy) is its centre; transform-origin is defined
    // pre-transform, so it's stable across successive scales. (Reading
    // getBoundingClientRect here slid the origin on a second recede, Howell
    // 2026-07-21.)
    panel.style.transformOrigin = `${cx}px ${cy}px`;
    panel.style.transform = scaled ? `scale(${scale})` : '';
    panel.style.filter = filter;
  }
}
function setStratumVisual(g, scale, blurPx, opacity = 1, offsetX = 0, offsetY = 0) {
  if (!g) return;
  const still = Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5;
  if (scale > 0.999 && blurPx < 0.01 && opacity > 0.999 && still) {
    g.removeAttribute('transform'); g.style.filter = ''; g.style.opacity = ''; return;
  }
  const slide = still ? '' : `translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) `;
  g.setAttribute('transform', `${slide}${scaleAboutCentre(scale)}`);
  g.style.filter = blurPx > 0.01 ? `blur(${blurPx}px)` : '';
  g.style.opacity = String(opacity);
}

// Settled depths (the snap, and the end of a tween): a plane at stack-level L
// sits at STRATA_DEPTHS[L], blurred STRATA_BLURS[L]. The primary also fills
// its tangent runs to match its recede.
function applyPrimaryDepth(level) {
  setPrimaryVisual(STRATA_DEPTHS[level], STRATA_BLURS[level]);
  if (currentApp && typeof currentApp.setTangentFill === 'function') {
    currentApp.setTangentFill(STRATA_TANGENT_SPANS[level] || 0);
  }
}
function applyStratumDepth(g, level) {
  setStratumVisual(g, STRATA_DEPTHS[level], STRATA_BLURS[level], 1);
}

function renderStack() {
  applyPrimaryDepth(strataFront); // primary is stack position 0; its level == front
  // Choosers are positions 1..N. Render (front to back so the SVG z-order —
  // last child on top — puts the front stratum highest) any at or ahead of
  // the front; hide the rest.
  CHOOSERS.forEach((ch, ci) => {
    const pos = ci + 1;
    if (pos > strataFront) { hideStratum(strataLayer, ch.id); return; }
    const items = ch.items();
    const g = renderStratum(strataLayer, {
      id: ch.id, viewport, items,
      selectedIndex: Math.max(0, items.indexOf(ch.selected())),
      mirrored: ch.mirrored,
      labelFor: ch.label,
      centerMagnified: ch.centerMag
    });
    applyStratumDepth(g, strataFront - pos);
  });
  if (dimensionButton) dimensionButton.setAttribute('aria-pressed', String(isStrataOpen()));
  // The front stratum is drag-rotatable; the layer and its full-area hit target
  // catch pointer events ONLY while a stratum is front — at the primary they
  // stay out of the way so the ring below gets every tap and swipe.
  if (strataLayer) strataLayer.style.pointerEvents = strataFront > 0 ? 'auto' : 'none';
  if (strataHit) strataHit.style.pointerEvents = strataFront > 0 ? 'all' : 'none';
}

// ── Magnifier-as-selection: rotate the front stratum (D.4a) ────────────────
// The front stratum is a rotatable focus ring: drag it, and whatever node
// SETTLES in the magnifier is obeyed — retiring tap-for-now, restoring the
// two-motion premise (Howell 2026-07-21). Short chains, so a gentle per-node
// sensitivity; the selection commits on release (the settle), which is when
// the receded primary re-renders its live preview.
// Match the PRIMARY's drag-to-rotation rate exactly (π/4 of arc per 100px), so
// the strata feel as graceful as the ring the reader already knows — mapping
// pixels straight to arc angle, then to node travel via the node spacing. (A
// flat px-per-node was geared down ~7×; the thumb had to crawl — Howell.)
const STRATA_DRAG_SENSITIVITY = Math.PI / 4 / 100; // rad per px
const STRATA_OVERRUN = 3;         // nodes of overshoot past each end, then the wall
const STRATA_SPRINGBACK_MS = 280; // the eased return from the overrun / into the lens
const STRATA_TAP_SLOP = 8;        // px of travel below which a press is a TAP, not a drag
let strataDrag = null;            // { items, center, spacing, lastX/Y, startX/Y, moved }
let strataSnap = null;            // rAF id of an in-flight springback / snap glide
const clampCenter = (c, n) => Math.max(0, Math.min(n - 1, c));
const clampDrag = (c, n) => Math.max(-STRATA_OVERRUN, Math.min(n - 1 + STRATA_OVERRUN, c));
const activeChooser = () => (strataFront > 0 ? CHOOSERS[strataFront - 1] : null);

// The real node nearest a tap point (for tap-to-magnifier), or null if the tap
// is nearest the lodestar (already selected — no move) or out in empty space.
function nodeIndexNearPoint(event, ch) {
  if (!ch || !strataLayer) return null;
  const group = strataLayer.querySelector(`#${ch.id}`);
  if (!group) return null;
  const rect = strataLayer.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  let best = null, bd = Infinity;
  group.querySelectorAll('.secondary-strata-node[data-index]').forEach(n => {
    const d = Math.hypot(Number(n.getAttribute('cx')) - x, Number(n.getAttribute('cy')) - y);
    if (d < bd) { bd = d; best = Number(n.dataset.index); }
  });
  const lens = group.querySelector('.secondary-strata-node.is-magnified');
  if (lens && Math.hypot(Number(lens.getAttribute('cx')) - x, Number(lens.getAttribute('cy')) - y) < bd) {
    return null; // nearest the lens itself → already the selection
  }
  return best != null && bd <= viewport.SSd * 0.14 ? best : null;
}

// Re-render ONLY the front stratum at a (fractional) center index, front depth.
// rotating (default) = the empty hollow lens with every node streaming through;
// false = the settled, filled lodestar (used at the end of the springback).
function renderFrontStratumAt(centerIndex, rotating = true) {
  const ch = activeChooser();
  if (!ch) return;
  const items = ch.items();
  const g = renderStratum(strataLayer, {
    id: ch.id, viewport, items,
    selectedIndex: centerIndex,
    mirrored: ch.mirrored, labelFor: ch.label, centerMagnified: ch.centerMag,
    rotating
  });
  setStratumVisual(g, 1, 0, 1); // front plane: sharp, in place
}

// Ease the ring from wherever it settled (maybe out in the overrun) back to the
// nearest real node — the SPRINGBACK that makes the last link go taut, and the
// snap-glide into the lens. Commit on arrival (the settle → the live preview).
function springbackStrata(fromCenter, toIndex, ch, items) {
  if (strataSnap) { cancelAnimationFrame(strataSnap); strataSnap = null; }
  const commit = () => { renderFrontStratumAt(toIndex, false); if (ch) ch.select(items[toIndex]); };
  if (Math.abs(fromCenter - toIndex) < 0.001) { commit(); return; }
  let start = 0;
  const step = now => {
    if (!start) start = now;
    const t = Math.min(1, (now - start) / STRATA_SPRINGBACK_MS);
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic — matches the primary's glideTo
    renderFrontStratumAt(fromCenter + (toIndex - fromCenter) * e);
    if (t < 1) { strataSnap = requestAnimationFrame(step); }
    else { strataSnap = null; commit(); }
  };
  strataSnap = requestAnimationFrame(step);
}

if (strataLayer) {
  strataLayer.addEventListener('pointerdown', event => {
    const ch = activeChooser();
    if (!ch || strataAnim) return; // nothing to rotate at the primary or mid-glide
    if (strataSnap) { cancelAnimationFrame(strataSnap); strataSnap = null; } // catch a springback
    const items = ch.items();
    strataDrag = {
      items,
      center: clampCenter(items.indexOf(ch.selected()), items.length),
      spacing: getNodeSpacing(viewport), // rad per node — constant through the drag
      lastX: event.clientX, lastY: event.clientY,
      startX: event.clientX, startY: event.clientY,
      moved: false
    };
    try { strataLayer.setPointerCapture(event.pointerId); } catch (_) { /* unsupported */ }
  });
  strataLayer.addEventListener('pointermove', event => {
    if (!strataDrag) return;
    const dx = event.clientX - strataDrag.lastX;
    const dy = event.clientY - strataDrag.lastY;
    strataDrag.lastX = event.clientX; strataDrag.lastY = event.clientY;
    // Hold still until the press clears the tap slop — otherwise a tap jitters
    // the ring. Past it, it's a drag.
    if (!strataDrag.moved) {
      if (Math.hypot(event.clientX - strataDrag.startX, event.clientY - strataDrag.startY) <= STRATA_TAP_SLOP) return;
      strataDrag.moved = true;
    }
    // Same drag sign for BOTH rings: the mirror flips the arc's look, not the
    // index→magnifier mapping, so no per-ring inversion — the mirrored secondary
    // read backwards until this flip came out (Howell 2026-07-21). Pixels → arc
    // angle → node travel (primary's rate); clampDrag allows the sprocket's
    // 3-node overshoot past each end before the wall.
    strataDrag.center = clampDrag(
      strataDrag.center - (dx + dy) * STRATA_DRAG_SENSITIVITY / strataDrag.spacing,
      strataDrag.items.length
    );
    renderFrontStratumAt(strataDrag.center);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>
    strataLayer.addEventListener(type, event => {
      if (!strataDrag) return;
      const { items, center, moved } = strataDrag;
      strataDrag = null;
      const ch = activeChooser();
      // Tap (no drag) on a node → glide THAT node into the lens; a drag → snap
      // to the nearest. Either way springbackStrata eases it home and commits.
      let target = clampCenter(Math.round(center), items.length);
      if (!moved && type === 'pointerup') {
        const tapped = nodeIndexNearPoint(event, ch);
        if (tapped != null) target = tapped;
      }
      springbackStrata(center, target, ch, items);
    })
  );
}

// ── The strata transition tween (D.4) ─────────────────────────────────────
// The recede is a snap today; this glides it — a camera pull-back. The front
// plane recedes to 0.4/0.2 while the incoming plane arrives from "behind the
// head" (starting a touch closer than the film plane, ENTER_SCALE) and settles
// at the front; a leaving plane drifts back and fades. Blur is DROPPED during
// motion (the C.2 per-frame villain) and snapped back on settle, where the
// receded planes are static again. Tunable feel knobs below.
const STRATA_TWEEN_MS = 600;
// Incoming/leaving strata TRAVEL in from / out to the left, DIAGONALLY: mostly
// horizontal, with a vertical bias toward each ring's own home half — the
// mirrored secondary from ABOVE-left, the standard tertiary from BELOW-left —
// so the slide runs on the same diagonal the recede backs away on, not a flat
// horizontal shift (Howell 2026-07-21). A translate (the whole ring travels),
// NOT a scale about centre (which only inflates the edges and reads as a pop).
const STRATA_SLIDE_X = 0.9;  // × viewport width
const STRATA_SLIDE_Y = 0.4;  // × viewport height — the diagonal's vertical bias
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
let strataAnim = null;

// Each plane's settled visual for a given front (level < 0 ⇒ off-stack, hidden).
function layerStates(front) {
  const states = { __primary: { scale: STRATA_DEPTHS[front], blur: STRATA_BLURS[front], opacity: 1, offsetX: 0, offsetY: 0 } };
  CHOOSERS.forEach((ch, ci) => {
    const level = front - (ci + 1);
    states[ch.id] = level >= 0
      ? { scale: STRATA_DEPTHS[level], blur: STRATA_BLURS[level], opacity: 1, offsetX: 0, offsetY: 0 }
      : { scale: 1, blur: 0, opacity: 0, offsetX: 0, offsetY: 0 };
  });
  return states;
}

function transitionStrata(fromFront, toFront) {
  if (strataAnim) { strataAnim.cancel(); strataAnim = null; }
  if (strataLayer) strataLayer.style.pointerEvents = 'none'; // no rotating mid-glide
  if (strataHit) strataHit.style.pointerEvents = 'none';
  const from = layerStates(fromFront);
  const to = layerStates(toFront);

  // Render every chooser present at EITHER end, so a leaving plane persists
  // through the glide and an entering one has something to animate; hide the rest.
  const groups = {};
  CHOOSERS.forEach((ch, ci) => {
    const pos = ci + 1;
    const inFrom = pos <= fromFront, inTo = pos <= toFront;
    if (!inFrom && !inTo) { hideStratum(strataLayer, ch.id); return; }
    const items = ch.items();
    groups[ch.id] = renderStratum(strataLayer, {
      id: ch.id, viewport, items,
      selectedIndex: Math.max(0, items.indexOf(ch.selected())),
      mirrored: ch.mirrored, labelFor: ch.label,
      centerMagnified: ch.centerMag
    });
    // Slide diagonally in from / out to the left: the vertical bias follows
    // each ring's home half (mirrored ⇒ from above, standard ⇒ from below), so
    // the whole ring travels on the recede's diagonal. Full opacity — the
    // travel carries it in, no fade.
    const dx = -viewport.width * STRATA_SLIDE_X;
    const dy = (ch.mirrored ? -1 : 1) * viewport.height * STRATA_SLIDE_Y;
    if (!inFrom && inTo) from[ch.id] = { ...to[ch.id], offsetX: dx, offsetY: dy };
    if (inFrom && !inTo) to[ch.id] = { ...from[ch.id], offsetX: dx, offsetY: dy };
  });

  // Populate the primary's tangent chain for the DESTINATION now, so the links
  // are already there as it recedes (static re-render, off the per-frame path).
  if (currentApp && typeof currentApp.setTangentFill === 'function') {
    currentApp.setTangentFill(STRATA_TANGENT_SPANS[toFront] || 0);
  }

  let raf = 0, start = 0, cancelled = false;
  const frame = now => {
    if (cancelled) return;
    if (!start) start = now;
    const e = easeInOut(Math.min(1, (now - start) / STRATA_TWEEN_MS));
    // Hold each plane's STARTING blur through the motion — a receded plane must
    // never sharpen (Howell 2026-07-21); a front plane holds 0 and recedes
    // sharp as before. Constant radius = the blurred layer renders once, only
    // the scale moves. Blur snaps to its destination on settle (renderStack).
    setPrimaryVisual(lerp(from.__primary.scale, to.__primary.scale, e), from.__primary.blur);
    CHOOSERS.forEach(ch => {
      const g = groups[ch.id]; if (!g) return;
      const f = from[ch.id], t = to[ch.id];
      setStratumVisual(g, lerp(f.scale, t.scale, e), f.blur, lerp(f.opacity, t.opacity, e),
        lerp(f.offsetX || 0, t.offsetX || 0, e), lerp(f.offsetY || 0, t.offsetY || 0, e));
    });
    if (e < 1) { raf = requestAnimationFrame(frame); }
    else { strataAnim = null; renderStack(); } // settle: final depths + blur, prune hidden
  };
  raf = requestAnimationFrame(frame);
  strataAnim = { cancel: () => { cancelled = true; cancelAnimationFrame(raf); } };
}

const dimensionAvailable = () => dimensionBridge.languagesAvailable().length > 0;

// EVERY language shows a tertiary stratum, even a single-translation one: the
// reader wants to know WHICH translation they're reading — the Vulgate is a
// specific edition, not an absence of choice — so Latin's magnifier names the
// Clementine Vulgate all the same (Howell 2026-07-21, reversing the earlier
// single-translation skip). Every language has at least one translation, so
// the tertiary always has a node to show.
const maxStrataFront = () => CHOOSERS.length; // primary(0) → secondary(1) → tertiary(2)

function cycleStrata() {
  if (!dimensionAvailable()) return;
  const max = maxStrataFront();
  const from = strataFront;
  strataFront = strataFront >= max ? 0 : strataFront + 1;
  if (from === strataFront) return;
  transitionStrata(from, strataFront);
  if (dimensionButton) dimensionButton.setAttribute('aria-pressed', String(isStrataOpen()));
}
function resetStrata() {
  if (strataAnim) { strataAnim.cancel(); strataAnim = null; }
  strataFront = 0;
  CHOOSERS.forEach(ch => hideStratum(strataLayer, ch.id));
  renderStack();
}
// The globe shows only where a dimension EXISTS and the detail sector is open;
// over a child pyramid it hides, and any open stack recedes back to the
// primary. A volume boot (including a gateway transit) resets the stack.
function updateDimensionButton() {
  if (!dimensionButton) return;
  const show = dimensionAvailable() && detailSectorVisible;
  dimensionButton.hidden = !show;
  if (!show && isStrataOpen()) resetStrata();
}
function refreshDimensionButton() {
  if (!dimensionButton) return;
  resetStrata();
  updateDimensionButton();
}
if (dimensionButton) {
  dimensionButton.addEventListener('click', cycleStrata);
}
if (typeof window !== 'undefined') {
  window.__wheelDimension = {
    get: () => dimensionBridge.getSelection(),
    set: id => dimensionBridge.setTranslation(id) || dimensionBridge.setLanguage(id),
    languages: () => dimensionBridge.languagesAvailable(),
    cycle: cycleStrata
  };
}
const tapDebugEnabled = new URLSearchParams(window.location.search).get('tapdebug') === '1';

if (tapDebugEnabled && typeof window !== 'undefined') {
  window.__tapLog = [];
  window.__tapDebugLog = (event, payload = {}) => {
    const row = {
      ts: new Date().toISOString(),
      event,
      ...payload
    };
    window.__tapLog.push(row);
    console.log('[tapdebug]', row);
  };
  window.__tapDebugDownload = () => {
    const text = JSON.stringify(window.__tapLog || [], null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `tapdebug-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
}

// Detect iframe zoom-out (e.g. GoDaddy "Forward with Masking" on mobile).
// Mobile browsers ignore the iframe's viewport meta tag, defaulting to a
// ~980 px layout viewport which is then scaled down to fit the screen.
// CSS clamp floors (in px) resolve pre-zoom, so fonts appear tiny.
// Multiply clamp min/max by this factor to compensate.
const _physSSd = Math.min(screen.width, screen.height);
const _cssSSd  = Math.min(window.innerWidth, window.innerHeight);
if (_physSSd > 0 && _cssSSd > _physSSd * 1.2) {
  document.documentElement.style.setProperty(
    '--iframe-scale', (_cssSSd / _physSSd).toFixed(3));
}


// C.2 instrumentation: decompose boot time into phases. Read the result in
// the feel HUD (?debug=1) or via window.__wheelBootPhases / console.table.
function recordBootPhases(volume) {
  try {
    const ms = (a, b) => {
      const ea = performance.getEntriesByName(a).pop();
      const eb = performance.getEntriesByName(b).pop();
      return ea && eb ? Math.round(eb.startTime - ea.startTime) : null;
    };
    const first = performance.getEntriesByName('wheel:html-start').pop();
    const phases = {
      volume,
      htmlToBoot: first ? Math.round(performance.getEntriesByName('wheel:boot-start').pop().startTime - first.startTime) : null,
      manifest: ms('wheel:boot-start', 'wheel:manifest-ready'),
      chainBuild: ms('wheel:manifest-ready', 'wheel:chain-built'),
      renderWire: ms('wheel:chain-built', 'wheel:render-done'),
      total: first ? Math.round(performance.getEntriesByName('wheel:render-done').pop().startTime - first.startTime) : null
    };
    window.__wheelBootPhases = phases;
    console.table([phases]);
    ['wheel:boot-start', 'wheel:manifest-ready', 'wheel:chain-built', 'wheel:render-done'].forEach(n => performance.clearMarks(n));
  } catch (err) { /* instrumentation must never break boot */ }
}

// Parsed-manifest cache: a volume visited once — or prefetched on approach —
// boots without refetching or reparsing its manifest. Gateway RETURNS ride
// this cache too (re-entering the origin volume becomes free). (Phase C.2)
const manifestCache = new Map();
function fetchManifest(volumeId) {
  if (!manifestCache.has(volumeId)) {
    const cfg = volumeConfigs[volumeId];
    if (!cfg) return Promise.reject(new Error(`unknown volume "${volumeId}"`));
    const p = fetch(cfg.manifestPath).then(r => {
      if (!r.ok) throw new Error(`manifest missing for volume "${cfg.id}" (${cfg.manifestPath}: HTTP ${r.status})`);
      return r.json();
    }).catch(err => { manifestCache.delete(volumeId); throw err; });
    manifestCache.set(volumeId, p);
  }
  return manifestCache.get(volumeId);
}

// Prefetch-on-approach: after a volume boots, scan its manifest for gateway
// declarations and warm the target manifests during idle time — by the time
// a human reads a gateway node and taps it, the network cost is paid.
// Data-driven: no volume names appear here. (Phase C.2)
function prefetchGatewayTargets(manifest) {
  const targets = new Set();
  (function scan(o) {
    if (Array.isArray(o)) { o.forEach(scan); return; }
    if (o && typeof o === 'object') {
      if (Array.isArray(o.gateway_children)) {
        o.gateway_children.forEach(g => { if (g?.volume) targets.add(g.volume); });
      }
      Object.values(o).forEach(scan);
    }
  })(manifest);
  if (!targets.size) return;
  const kick = () => targets.forEach(v => { if (volumeConfigs[v]) fetchManifest(v).catch(() => {}); });
  if (typeof requestIdleCallback === 'function') requestIdleCallback(kick, { timeout: 5000 });
  else setTimeout(kick, 2500);
}

function resolveVolumeFromPath(path) {
  const lower = (path || '').toLowerCase();
  const match = Object.values(volumeConfigs).find(cfg => cfg.paths?.some(p => lower.includes(p)));
  return match?.id || null;
}

async function loadConfig(volumeOverride = null, searchOverride = null) {
  const params = new URLSearchParams(searchOverride ?? window.location.search);
  const path = (window.location.pathname || '').toLowerCase();
  const paramVolume = params.get('volume');
  const resolvedVolume = volumeConfigs[volumeOverride]?.id || volumeConfigs[paramVolume]?.id || resolveVolumeFromPath(path) || DEFAULT_VOLUME;
  const config = volumeConfigs[resolvedVolume];
  const manifest = await fetchManifest(resolvedVolume);
  const root = config.extractRoot(manifest);
  const validation = validateVolumeRoot(root);
  if (!validation.ok) {
    console.error('[wheel] volume validation failed', { errors: validation.errors, warnings: validation.warnings });
    throw new Error('Invalid volume manifest');
  }
  const startup = root?.display_config?.focus_ring_startup || {};
  const arrangements = root?.display_config?.focus_ring_arrangements || {};
  const supplemental = await config.loadSupplemental(root, manifest, params);
  const debugFlag = params.get('debug') === '1' || localStorage.getItem('wheel-debug') === '1';
  const options = {
    ...config.buildOptions({ params, startup, arrangements }),
    debug: debugFlag
  };
  return { volume: resolvedVolume, config, manifest, root, options, supplemental };
}

function applyTheme(manifest, volume) {
  const theme = volumeConfigs[volume]?.theme || volume;
  const root = document.documentElement;
  const active = volumeConfigs[volume]?.palette || {
    bg: '#f5f5f5',
    node: '#555555',
    text: '#111111',
    band: '#7a7979',
    accent: '#1f6feb',
    magnifierStroke: '#000000'
  };
  const bg = active.bg;
  root.setAttribute('data-theme', theme);
  root.style.backgroundColor = bg;
  // Set ALL theme CSS variables inline so the first render has correct
  // colors even before the async volume stylesheet finishes loading.
  root.style.setProperty('--theme-color-bg', bg);
  root.style.setProperty('--theme-color-node', active.node);
  root.style.setProperty('--theme-color-text', active.text);
  root.style.setProperty('--theme-color-band', active.band);
  root.style.setProperty('--theme-color-accent', active.accent);
  root.style.setProperty('--theme-color-magnifier-stroke', active.magnifierStroke);
  if (document.body) {
    document.body.style.backgroundColor = bg;
  }
  if (svg) {
    svg.style.backgroundColor = bg;
  }
  const link = document.getElementById('volume-style');
  if (link) {
    link.setAttribute('href', `./styles/themes/${theme}.css`);
  }
}

const detailRegistry = new DetailPluginRegistry();
detailRegistry.register(new TextDetailPlugin());
detailRegistry.register(new CardDetailPlugin());
detailRegistry.register(new EphemerisDetailPlugin());
const detailPanel = document.getElementById('detail-panel');
const detailContent = document.getElementById('detail-content');

// Toggle detail panel visibility in sync with the Detail Sector animation.
// The panel fades in after the blue circle has finished expanding,
// and hides immediately when the circle begins collapsing.
window.addEventListener('detail-sector-change', (e) => {
  const { visible } = e.detail || {};
  if (detailPanel) {
    detailPanel.classList.toggle('detail-panel--visible', Boolean(visible));
  }
  // The dimension button follows the sill: present at a leaf, gone over a
  // child pyramid (which also recedes any open stack back to the primary).
  detailSectorVisible = Boolean(visible);
  updateDimensionButton();
});

function renderDetail(selected, adapterInstance, manifest, adapterNormalized, { translation } = {}) {
  if (!detailPanel || !detailContent) return;
  // Only the leaf is described here. Note this returns WITHOUT clearing:
  // on the way up out of a leaf the panel is already fading, and it should
  // fade carrying what it was describing rather than flash the level
  // above's payload on its way out.
  if (!isDetailLevel(selected, adapterNormalized)) return;
  while (detailContent.firstChild) detailContent.removeChild(detailContent.firstChild);
  if (!selected) return;

  const payload = adapterInstance?.detailFor
    ? adapterInstance.detailFor(selected, manifest, { normalized: adapterNormalized, translation })
    : { type: 'text', text: selected.name || selected.id || '' };
  if (!payload) return;

  const plugin = detailRegistry.getPlugin(payload);
  if (!plugin) return;

  // Build arc-aware bounds (DSUA — full area, no logo exclusion).
  // The logo moves to the centre as a watermark when the circle expands,
  // so its collapsed upper-right position does not restrict detail text.
  // MEASURED viewport, never window.inner* — the wheel's geometry and the
  // pinned canvas use the visual viewport, and a browser chrome bar makes
  // innerHeight lie (Phase C audit M4; the DDG bottom-crop class of bug).
  const vpm = measureViewport();
  const arcBounds = computeDetailSectorBounds(vpm.width, vpm.height);
  const panelRect = detailPanel.getBoundingClientRect();
  const renderBounds = { ...arcBounds, width: panelRect.width, height: panelRect.height };


  const node = plugin.render(payload, renderBounds, { createElement: tag => document.createElement(tag) });
  if (node) detailContent.appendChild(node);
}

function wireInteractions(getApp) {
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let suppressNativeClickUntil = 0;
  // C.3 double-flick (see docs/FEEL.md) — additive; drag feel untouched.
  const DOUBLE_FLICK_WINDOW_MS = 400;   // max gap between two fast swipes
  const DOUBLE_FLICK_MIN_VELOCITY = 0.8; // px/ms sustained at release = "fast"
  const GLIDE_TO_LIMIT_MS = 600;         // one tempo (= detail sector)
  // "Fast" is judged by what the finger was doing AT RELEASE: distance over
  // the trailing window, not the peak of any single event sample. Touch
  // events arrive in bursts with ~1ms deltas, so per-sample velocity spikes
  // past any threshold even mid-slow-scrub — that noise once made released
  // scrubs take off on their own (2026-07-17 flick regression).
  const VELOCITY_WINDOW_MS = 100;
  let recentMoves = [];         // {t, dist, delta} samples inside the window
  let gestureTravelPx = 0;      // cumulative finger travel this drag
  let pointerCaptured = false;  // capture transferred to the svg root
  const trace = { downTarget: '', moves: 0, endedBy: '', travel: 0, captured: false, cancels: 0 };
  const publishTrace = () => { window.__wheelGestureTrace = { ...trace }; };
  const DRAG_SLOP_PX = 8;       // past this, it's a drag, not a tap
  let pendingAdvanceTap = false; // press landed in the sector's NEXT area
  let pendingTapNode = null;    // ring node under the finger at pointerdown;
                                // its click fires at lift IF travel stayed
                                // within tap slop — a press is ambiguous
                                // until the finger commits
  let lastFlickAt = 0;          // pointerup time of the last fast swipe
  let lastFlickDir = 0;         // its direction (sign of net delta)
  const sensitivity = Math.PI / 4 / 100; // 100px → 45°
  // C.3 flick tier (approved 2026-07-17): the drag is a pure 1:1 scrub at
  // every speed — the old velocity-gain amplifier (velocityThreshold 0.4,
  // gainSlope 1.1, targetSpinNodes 350) is retired. Fast-swipe distance now
  // comes from the ballistic glide on release (gesture-tiers.js), so travel
  // is chain-relative and never double-counted.
  const logTap = (event, payload = {}) => {
    if (typeof window !== 'undefined' && typeof window.__tapDebugLog === 'function') {
      window.__tapDebugLog(event, payload);
    }
  };

  const svgPointOf = event => {
    if (!svg || typeof svg.createSVGPoint !== 'function') return null;
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(ctm.inverse());
  };

  const nearestRingNode = event => {
    const p = svgPointOf(event);
    if (!p) return null;

    // Placebo nodes (the version footnote) are not tap targets — excluding
    // them here keeps a real neighbor eligible for the redirect.
    const nodes = svg.querySelectorAll('.focus-ring-node:not(.is-placebo)');
    let nearest = null;
    let nearestDist = Infinity;
    nodes.forEach(node => {
      const cx = Number(node.getAttribute('cx'));
      const cy = Number(node.getAttribute('cy'));
      const r = Number(node.getAttribute('r')) || 0;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy);
      const threshold = Math.max(r * 4, 36);
      if (dist <= threshold && dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    });
    return nearest;
  };

  const onPointerMove = event => {
    if (!isDragging) return;
    const app = getApp();
    if (!app) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const dt = event.timeStamp - lastTime;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;

    const distance = Math.abs(dx) + Math.abs(dy);
    const delta = -(dx + dy) * sensitivity;
    const t = event.timeStamp;
    recentMoves.push({ t, dist: distance, delta });
    while (recentMoves.length && t - recentMoves[0].t > VELOCITY_WINDOW_MS) recentMoves.shift();
    gestureTravelPx += distance;
    trace.moves += 1; trace.travel = Math.round(gestureTravelPx); trace.captured = pointerCaptured;
    if ((trace.moves & 7) === 0) publishTrace();
    // Ring nodes are disposable elements: a drag that began ON one holds an
    // implicit pointer capture that dies if that node scrolls out of the
    // window and is removed. Once travel exceeds tap slop, re-anchor the
    // capture to the permanent svg root so the event stream survives the
    // whole gesture. Taps never reach the slop, so node clicks are
    // unaffected.
    if (!pointerCaptured && gestureTravelPx > DRAG_SLOP_PX && event.pointerId != null) {
      try { svg.setPointerCapture(event.pointerId); pointerCaptured = true; } catch (err) { /* capture unsupported */ }
    }
    logTap('pointermove', {
      pointerType: event.pointerType,
      dx,
      dy,
      dt,
      dragging: isDragging
    });
    app.choreographer.rotate(delta);
  };

  // When touch pointerdown manually dispatches a node onclick, suppress the
  // browser's delayed native click so the same node doesn't rotate twice.
  svg.addEventListener('click', event => {
    const now = Date.now();
    if (now < suppressNativeClickUntil) {
      // Control taps (magnifier, parent button) rely on their NATIVE click
      // and their pointerdown path never arms a manual fire — suppressing
      // them makes a quick node-then-parent rhythm eat the second tap
      // (Phase C audit M6). Controls are exempt from suppression.
      const isControl = event.target?.closest?.('.focus-ring-magnifier-circle, .focus-ring-magnifier-label');
      if (isControl) return;
      logTap('native-click-suppressed', {
        targetClass: event.target?.getAttribute?.('class') || null,
        targetId: event.target?.getAttribute?.('id') || null
      });
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  svg.addEventListener('pointerdown', event => {
    const app = getApp();
    if (!app) return;
    // While the secondary strata is up, the primary is receded and INERT —
    // its ring must not take taps (D.3). The secondary nodes handle their
    // own pointerdown and stop it here anyway; this is the belt.
    if (isSecondaryOpen()) return;
    logTap('pointerdown', {
      pointerType: event.pointerType,
      targetClass: event.target?.getAttribute?.('class') || null,
      targetId: event.target?.getAttribute?.('id') || null,
      x: event.clientX,
      y: event.clientY
    });
    const isNode = event.target && event.target.closest && event.target.closest('.focus-ring-node');
    pendingTapNode = null;
    pendingAdvanceTap = false;
    if (isNode) {
      logTap('node-hit', {
        pointerType: event.pointerType,
        nodeIndex: isNode.dataset?.index ?? null,
        nodeId: isNode.getAttribute?.('id') || null
      });
      // A press on a node is ambiguous until the finger commits: firing the
      // click here at pointerdown is what made every over-ring swipe die as
      // a 2-node tap. Arm a pending tap instead and start the drag machinery
      // like anywhere else; pointerup decides — within slop it's the tap
      // (fired manually, so tiny targets still never depend on the browser's
      // synthetic click), past slop it was a swipe all along.
      pendingTapNode = isNode;
      if (event.pointerType === 'touch' || event.pointerType === 'pen') event.preventDefault();
    }

    // Parent/magnifier controls: don't start drag and don't near-miss redirect.
    // Let their native click handlers run.
    const isControlTarget = event.target && event.target.closest && event.target.closest('.focus-ring-magnifier-circle, .focus-ring-magnifier-label');
    if (isControlTarget) {
      isDragging = false;
      logTap('control-hit', {
        pointerType: event.pointerType,
        targetClass: event.target?.getAttribute?.('class') || null,
        targetId: event.target?.getAttribute?.('id') || null
      });
      return;
    }
    suppressNativeClickUntil = Date.now() + 450;
    // Child pyramid node OR ITS LABEL — delegate to the app's pyramid click
    // handler. The label is a sibling <text>, not a descendant of the circle,
    // so matching only the circle made a tap on the word itself fall through
    // to ring near-miss targeting (the multi-tap gateway bug on iOS browsers
    // whose touch-target adjustment doesn't rescue the miss).
    const isPyramidNode = event.target && event.target.closest
      && event.target.closest('.child-pyramid-node, .child-pyramid-label');
    if (isPyramidNode) {
      const attrIndex = isPyramidNode.getAttribute && isPyramidNode.getAttribute('data-index');
      const rawIndex = isPyramidNode.dataset?.index ?? attrIndex;
      const idx = Number.parseInt(rawIndex, 10);
      logTap('pyramid-hit', { pointerType: event.pointerType, nodeIndex: Number.isFinite(idx) ? idx : null, rawIndex: rawIndex ?? null });
      if (Number.isFinite(idx)) {
        if (app.handlePyramidNodeClick) {
          app.handlePyramidNodeClick(idx);
        }
        return; // don't start drag
      }
      // No valid index on this pyramid-shaped target (e.g. transient clone).
      // Fall through to near-miss ring targeting instead of swallowing the tap.
      logTap('pyramid-hit-no-index-fallback', { pointerType: event.pointerType });
    }

    // THE NEXT GESTURE (Howell 2026-07-20): at a leaf, in volumes that ask
    // for it, the detail sector is one large button — read the verse, tap
    // it with your thumb, read the next. Resolved at lift like every other
    // tap here, so a scrub that merely ends over the sector never advances.
    if (!pendingTapNode && typeof app.detailAreaAdvances === 'function') {
      const p = svgPointOf(event);
      if (p && app.detailAreaAdvances(p.x, p.y)) {
        pendingAdvanceTap = true;
        logTap('detail-advance-pending', { pointerType: event.pointerType });
      }
    }

    // Touch near-miss support: if the tap lands close to a tiny ring node,
    // trigger its click handler instead of starting a drag.
    const isBackgroundLikeTarget = (
      event.target === svg
      || (event.target && event.target.closest && event.target.closest('.focus-ring-band'))
      || Boolean(isPyramidNode)
    );
    if ((event.pointerType === 'touch' || event.pointerType === 'pen') && isBackgroundLikeTarget
      && !pendingTapNode && !pendingAdvanceTap) {
      const nearby = nearestRingNode(event);
      if (nearby && typeof nearby.onclick === 'function') {
        // Same deferral as a direct node press: tap resolves at lift,
        // movement past slop means this was a swipe born near a node.
        logTap('near-miss-pending-tap', {
          pointerType: event.pointerType,
          nodeIndex: nearby.dataset?.index ?? null,
          nodeId: nearby.getAttribute?.('id') || null
        });
        pendingTapNode = nearby;
        event.preventDefault();
      }
    }

    isDragging = true;
    recentMoves = [];
    gestureTravelPx = 0;
    pointerCaptured = false;
    trace.downTarget = event.target?.getAttribute?.('class') || event.target?.tagName || '?';
    trace.moves = 0; trace.endedBy = ''; trace.travel = 0; trace.captured = false; trace.cancels = 0;
    publishTrace();
    logTap('drag-start', { pointerType: event.pointerType });
    // Catch the ring mid-glide: a finger planted during a flick's glide
    // stops the glide and takes over (flick, flick, catch).
    app.choreographer?.stopMomentum?.();
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
  });

  svg.addEventListener('pointermove', onPointerMove);

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    svg.addEventListener(type, event => {
      // v0 parity: only snap after real drags. For taps/clicks, let the
      // target node's click handler run without a competing snap animation.
      const app = getApp();
      if (!app) return;
      if (isSecondaryOpen()) return; // primary inert while the secondary is up (D.3)
      const wasDragging = isDragging;
      isDragging = false;
      if (wasDragging) {
        trace.endedBy = type;
        if (type === 'pointercancel') trace.cancels += 1;
        trace.captured = pointerCaptured;
        publishTrace();
      }
      if (pointerCaptured && event.pointerId != null) {
        try { svg.releasePointerCapture(event.pointerId); } catch (err) { /* already released */ }
        pointerCaptured = false;
      }
      logTap(type, {
        pointerType: event?.pointerType,
        wasDragging,
        action: wasDragging ? 'snap-nearest' : 'tap-no-snap'
      });
      if (!wasDragging) return;
      // Resolve a pending node tap: the press landed on (or near) a node and
      // the finger never traveled past slop — fire that node's click now, at
      // lift. Either way the node press is finished; suppress the browser's
      // own delayed click so nothing fires twice.
      const tapNode = pendingTapNode;
      pendingTapNode = null;
      const advanceTap = pendingAdvanceTap;
      pendingAdvanceTap = false;
      if (advanceTap && !tapNode) {
        suppressNativeClickUntil = Date.now() + 450;
        if (gestureTravelPx <= DRAG_SLOP_PX && type === 'pointerup') {
          logTap('detail-advance-on-lift', { pointerType: event?.pointerType });
          app.advanceLeaf?.();
          return; // a tap: the advance manages rotation, no snap
        }
        // Travelled: this was a scrub that began in the sector. Fall
        // through and let it settle like any other scrub.
      }
      if (tapNode) {
        suppressNativeClickUntil = Date.now() + 450;
        if (gestureTravelPx <= DRAG_SLOP_PX) {
          if (type === 'pointerup' && typeof tapNode.onclick === 'function') {
            logTap('node-tap-on-lift', {
              pointerType: event?.pointerType,
              nodeId: tapNode.getAttribute?.('id') || null
            });
            tapNode.onclick();
          }
          return; // a tap: the node's click manages rotation, no snap
        }
      }
      // "Fast" = what the finger was doing at release: distance and direction
      // over the trailing VELOCITY_WINDOW_MS, so a pause before lifting (or a
      // noisy 1ms event sample mid-scrub) can never read as a flick.
      const now = event.timeStamp || Date.now();
      const recent = recentMoves.filter(m => now - m.t <= VELOCITY_WINDOW_MS);
      recentMoves = [];
      const recentDist = recent.reduce((sum, m) => sum + m.dist, 0);
      const recentDelta = recent.reduce((sum, m) => sum + m.delta, 0);
      const releaseVelocity = recentDist / VELOCITY_WINDOW_MS;
      const dir = Math.sign(recentDelta);
      const isFast = releaseVelocity >= DOUBLE_FLICK_MIN_VELOCITY && dir !== 0;
      // C.3 double-flick: two fast swipes, same direction, inside the
      // window -> glide to that end of the chain (sprocket doctrine:
      // every chain is bounded; the last link is a real place).
      if (isFast && dir === lastFlickDir && (now - lastFlickAt) <= DOUBLE_FLICK_WINDOW_MS) {
        lastFlickAt = 0;
        lastFlickDir = 0;
        const ch = app.choreographer;
        const limit = dir > 0 ? ch.maxRotation : ch.minRotation;
        if (Number.isFinite(limit)) {
          logTap('double-flick', { dir, limit });
          ch.glideTo(limit, GLIDE_TO_LIMIT_MS, () => app.selectNearest());
          return;
        }
      }
      lastFlickAt = isFast ? now : 0;
      lastFlickDir = isFast ? dir : 0;
      // C.3 single flick: a fast swipe is ballistic — the ring glides
      // FLICK_SCRUBS corner-to-corner scrubs' worth of rotation, in the house
      // tempo. Scrub-anchored, not chain-relative, so it feels the same on any
      // chain length (Howell 2026-07-17). glideTo clamps to the chain ends, so
      // a flick that would overshoot a short chain lands at the end. The "fast"
      // gate is the same 0.8 px/ms a double-flick leg uses (isFast).
      if (isFast) {
        const ch = app.choreographer;
        const flickRotation = computeFlickRotation(app.viewport, sensitivity);
        if (flickRotation > 0) {
          const target = ch.getRotation() + dir * flickRotation;
          logTap('flick', { dir, flickRotation: Number(flickRotation.toFixed(3)) });
          ch.glideTo(target, FLICK_GLIDE_MS, () => app.selectNearest());
          return;
        }
      }
      app.selectNearest();
      app.choreographer.stopMomentum();
    });
  });
}

async function showVersion() {
  const badge = document.getElementById('version-badge');
  if (!badge) return;
  try {
    const pkg = await fetch('./package.json').then(r => r.json());
    const name = pkg?.name || 'wheel';
    const version = pkg?.version ? `v${pkg.version}` : 'v?';
    badge.textContent = `${name} ${version}`;
  } catch (err) {
    console.warn('Version load failed', err);
    badge.textContent = 'version unavailable';
  }
}

let currentApp = null;
let currentVolumeId = null;
let gatewayReturnContext = null;
let interactionsWired = false;
let firstBootDone = false; // the boot splash plays only on the initial load

// Sample points along the visible focus-ring arc — the first stroke the boot
// splash inks. Ordered endAngle→startAngle so the self-draw sweeps from the
// upper-left corner down to the lower-right (Howell 2026-07-17).
function computeArcPoints(vp, n = 72) {
  const arc = getArcParameters(vp);
  const win = getViewportWindow(vp, getNodeSpacing(vp));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = win.endAngle + (win.startAngle - win.endAngle) * (i / n);
    pts.push({ x: arc.hubX + arc.radius * Math.cos(a), y: arc.hubY + arc.radius * Math.sin(a) });
  }
  return pts;
}

function gatewayLabelFromItemId(itemId) {
  if (typeof itemId !== 'string') return '';
  const segments = itemId.split('__');
  return (segments[segments.length - 1] || '').toUpperCase();
}

// Data-declared door into another volume: boot it in-app, remembering the
// way back. The browser URL gains a history entry so Back exits the door.
function showBootError(message) {
  // Minimal visible error surface: the console-only failures of the past
  // left black screens (Phase B audit, H4/M1).
  const el = document.getElementById('detail-content');
  if (el) el.textContent = message;
  console.error('[wheel]', message);
}

function launchGateway(gateway) {
  if (!gateway?.volume || !volumeConfigs[gateway.volume]) {
    console.warn('[wheel] gateway names unknown volume', gateway?.volume);
    return;
  }
  const returnContext = { volume: currentVolumeId, itemId: gateway.returnItemId || null };
  const search = `?volume=${encodeURIComponent(gateway.volume)}&level=root`;
  // Capture the outgoing screen AT THE TAP: the frozen copy covers its own
  // identical pixels through the fetch (warming its rasterization so the
  // wipe's first frames can't blink) and swallows input for the transit.
  const transit = { mode: 'launch', snapshot: captureGatewaySnapshot(svg) };
  // Boot first; only a successful boot earns the history entry (H4).
  bootVolume(gateway.volume, search, returnContext, transit)
    .then(() => {
      try {
        window.history.pushState({ wheelGateway: true, gatewayReturn: returnContext }, '', search);
      } catch (err) { /* history unavailable (e.g. file://) */ }
    })
    .catch(err => {
      // Failed boot leaves the OLD volume intact (M1) — uncover it.
      if (transit.snapshot) transit.snapshot.remove();
      showBootError(`gateway boot failed: ${err.message}`);
    });
}

function returnThroughGateway() {
  const ctx = gatewayReturnContext;
  if (!ctx?.volume || !volumeConfigs[ctx.volume]) return false;
  const params = new URLSearchParams();
  params.set('volume', ctx.volume);
  if (ctx.itemId) params.set('item', ctx.itemId);
  const search = `?${params.toString()}`;
  const transit = { mode: 'return', snapshot: captureGatewaySnapshot(svg) };
  bootVolume(ctx.volume, search, null, transit)
    .then(() => {
      try { window.history.pushState({ wheelGateway: true }, '', search); } catch (err) { /* ignore */ }
    })
    .catch(err => {
      if (transit.snapshot) transit.snapshot.remove();
      showBootError(`gateway return failed: ${err.message}`);
    });
  return true;
}

// Browser Back across a gateway pushState: reload resolves the URL cleanly.
window.addEventListener('popstate', () => window.location.reload());

// M4: history.state survives reloads — a refresh inside a gateway volume
// restores its way back instead of stranding the visitor.
function restoredGatewayReturn() {
  try {
    const st = window.history.state;
    if (st?.gatewayReturn?.volume && volumeConfigs[st.gatewayReturn.volume]) return st.gatewayReturn;
  } catch (err) { /* history unavailable */ }
  return null;
}

async function bootVolume(volumeOverride = null, searchOverride = null, gatewayReturn = null, transit = null) {
  performance.mark('wheel:boot-start');
  // The splash reveal is initial-load only, never a gateway transit. Decide
  // now and hide the live wheel so it can be dissolved into, not popped on.
  const playSplash = !firstBootDone && bootSplashShouldPlay();
  firstBootDone = true;
  if (playSplash) {
    if (svg) svg.style.opacity = '0';
    // Hide the copyright as early as possible — it is an index.html div,
    // visible from first paint; the splash brings it in only at the end.
    const cr = document.getElementById('copyright-notice');
    if (cr) cr.style.opacity = '0';
  }
  const { volume, config, manifest, root, options, supplemental } = await loadConfig(volumeOverride, searchOverride);
  performance.mark('wheel:manifest-ready');
  const translationsMeta = supplemental?.translationsMeta || null;
  dimensionBridge.setTranslationsMeta(translationsMeta);
  // Seed the dimension state with the volume's default translation, so the
  // secondary/tertiary strata and the primary text all agree from boot —
  // unless a sticky choice already survived a gateway/reboot.
  if (!dimensionStore.getState().language && options.translation) {
    dimensionBridge.setTranslation(options.translation);
  }
  refreshDimensionButton(); // show the globe only where a dimension exists
  // The sticky dimension choice (survives reboots/gateways) wins over the
  // volume's pinned default; boot-time derivations (namesMap, labels) still
  // use the boot value — swapping those live is D.6's work, not D.2's.
  const activeTranslation = () => dimensionStore.getState().edition || options.translation || null;
  const translationId = activeTranslation();
  const translationLang = translationsMeta?.translations?.[translationId]?.language || options.locale || 'english';
  const resolvedLocale = options.locale || translationLang || 'english';
  const localeNames = translationsMeta?.names?.[translationLang] || {};
  const namesMap = {
    books: localeNames.books || localeNames,
    sections: localeNames.sections || {},
    testaments: localeNames.testaments || {},
    bookAbbreviations: localeNames.book_abbreviations || {}
  };

  const translationName = translationsMeta?.translations?.[translationId]?.name || translationId;

  const chainResult = await config.buildChain(manifest, options, namesMap);
  performance.mark('wheel:chain-built');
  const { items, selectedIndex = 0, preserveOrder = false, meta } = chainResult;
  const handlerSet = config.createHandlers({
    manifest,
    namesMap,
    options,
    translationsMeta,
    chainMeta: chainResult,
    translationName,
    onGatewayReturn: returnThroughGateway,
    gatewayLabel: gatewayReturn ? gatewayLabelFromItemId(gatewayReturn.itemId) : '',
    // The origin volume's own display name (from its config) — for adapters
    // whose top-ring OUT button names the volume you'd return TO rather
    // than the gateway node you came through.
    gatewayReturnLabel: gatewayReturn
      ? (volumeConfigs[gatewayReturn.volume]?.gatewayReturnLabel || gatewayLabelFromItemId(gatewayReturn.itemId))
      : ''
  });
  if (!items.length) throw new Error(`no items found for volume "${volume}"`);

  // Gateway transit (C.4): the outgoing screen was frozen at the tap
  // (colors inlined, input swallowed) and has covered its own pixels since.
  const wipeSnapshot = transit?.snapshot || null;

  // ── Point of no return ── the new volume built successfully; only now
  // tear down the previous instance (Phase B audit, M1: a late failure
  // above leaves the old volume intact instead of a black screen).
  // Teardown any previous volume instance — gateway reboots reuse the SVG.
  // Clear only the detail CONTENT: #detail-panel's inner skeleton
  // (#detail-content, #version-badge) is owned by index.html and must survive.
  Array.from(svg.childNodes).forEach(node => {
    // The wipe snapshot stays: it is the old volume's face until the sweep.
    if (node !== wipeSnapshot) svg.removeChild(node);
  });
  const detailContentEl = document.getElementById('detail-content');
  if (detailContentEl) detailContentEl.innerHTML = '';
  const detailPanelEl = document.getElementById('detail-panel');
  if (detailPanelEl) detailPanelEl.classList.remove('detail-panel--visible');
  // The migration LIFO belongs to the OLD volume: clear it, or its detached
  // overlay clones leak per transit and a later ascent in the NEW volume can
  // pop the old volume's entry and replay stale clones (Phase C audit M3).
  clearMigrationStack();
  currentApp = null;
  currentVolumeId = volume;
  gatewayReturnContext = gatewayReturn;
  applyTheme(manifest, volume);

  const adapter = adapterLoader.load(volume);
  let adapterNormalized = null;
  let adapterLayoutSpec = null;
  if (adapter) {
    try {
      adapterNormalized = adapter.normalize(manifest);
      adapterLayoutSpec = adapter.layoutSpec(adapterNormalized, viewport);
      // Attach manifest to adapter for logo configuration
      adapter.manifest = manifest;
    } catch (err) {
      console.warn('[wheel] adapter layoutSpec failed, falling back to host config', err);
      adapterNormalized = null;
      adapterLayoutSpec = null;
    }
  }

  const configLabel = makeLabelFormatter({ config, volume, level: options.level, locale: resolvedLocale, namesMap, options, manifest, meta });
  const adapterLabel = adapterLayoutSpec?.label;
  // Prefer the config's formatter when it is context-aware (receives { item, context }),
  // otherwise fall back to the adapter's plain label, then the config formatter.
  const configIsContextAware = config?.formatLabel?.length === 0; // zero-arg factory returns (item, context) => ...
  const labelFormatter = configIsContextAware
    ? configLabel
    : adapterLabel
      ? ({ item }) => adapterLabel(item)
      : configLabel;
  const shouldCenterLabel = handlerSet.shouldCenterLabel || (({ item } = {}) => {
    if (Boolean(config?.centerLabel)) return true;
    // Cylinder items (short numeric labels) should always be centered
    if (item?.level === 'cylinder') return true;
    return false;
  });
  let app;

  const parentHandler = params => (handlerSet.parentHandler ? handlerSet.parentHandler({ ...params, app }) : false);
  const childrenHandler = params => (handlerSet.childrenHandler ? handlerSet.childrenHandler({ ...params, app }) : false);
  const adapterGetParentLabel = typeof handlerSet.getParentLabel === 'function' ? handlerSet.getParentLabel : null;

  const layoutBindings = handlerSet.layoutBindings || {};
  const layoutSpec = createVolumeLayoutSpec({
    volume,
    manifest,
    namesMap,
    placesState: layoutBindings.placesState,
    buildPlacesLevel,
    placesChildrenHandler: layoutBindings.placesChildrenHandler,
    getCatalogChildren: layoutBindings.getCatalogChildren || ((m, selected) => getCatalogChildren(manifest, selected)),
    getCalendarMonths: layoutBindings.getCalendarMonths || ((m, selected, mode) => getCalendarMonths(manifest, selected, mode)),
    getCalendarMonthChain: layoutBindings.getCalendarMonthChain,
    getCalendarDayChain: layoutBindings.getCalendarDayChain,
    getWeekdayLetters: layoutBindings.getWeekdayLetters,
    getBibleChapters: layoutBindings.getBibleChapters || ((m, selected, nm, mode) => getBibleChapters(manifest, selected, nm, mode)),
    getBibleVerseItems: layoutBindings.getBibleVerseItems,
    getBibleVerseCacheStatus: layoutBindings.getBibleVerseCacheStatus,
    getBibleVerseChain: layoutBindings.getBibleVerseChain,
    getBibleChapterChain: layoutBindings.getBibleChapterChain,
    prefetchBibleVerses: layoutBindings.prefetchBibleVerses,
    getBibleBooksForTestament: layoutBindings.getBibleBooksForTestament,
    getBibleTestaments: layoutBindings.getBibleTestaments,
    getApp: () => app,
    launchGateway,
    calendarModeRef: layoutBindings.calendarModeRef,
    setCalendarMode: layoutBindings.setCalendarMode,
    setCalendarMonthContext: layoutBindings.setCalendarMonthContext,
    bibleModeRef: layoutBindings.bibleModeRef,
    setBibleMode: layoutBindings.setBibleMode,
    setBibleChapterContext: layoutBindings.setBibleChapterContext,
    setBibleVerseContext: layoutBindings.setBibleVerseContext,
    catalogModeRef: layoutBindings.catalogModeRef,
    setCatalogMode: layoutBindings.setCatalogMode,
    savePreInState: layoutBindings.savePreInState,
    pyramidBuilder: layoutBindings.pyramidBuilder
  });
  const pyramidConfig = {
    ...(layoutSpec?.pyramid || {}),
    ...(adapterLayoutSpec?.pyramid || {})
  };
  const pyramidLayout = adapterLayoutSpec || layoutSpec;
  const normalized = {
    items,
    links: (items || [])
      .filter(item => item?.parentId)
      .map(item => ({ from: item.parentId, to: item.id })),
    meta: { volumeId: volume }
  };

  // Re-measure just before rendering: by now the page has settled and the
  // browser's address bar (if any) is present, so the visible viewport is
  // accurate. Re-pin the canvas to it so layout and canvas agree with reality.
  viewport = measureViewport();
  pinCanvas(viewport);

  app = createApp({
    svgRoot: svg,
    items,
    viewport,
    selectedIndex,
    preserveOrder,
    labelFormatter,
    shouldCenterLabel,
    contextOptions: { ...options, locale: resolvedLocale },
    onParentClick: parentHandler,
    getParentLabel: adapterGetParentLabel,
    pyramid: pyramidConfig,
    pyramidLayoutSpec: pyramidLayout,
    pyramidNormalized: adapterNormalized || normalized,
    pyramidAdapter: adapter,
    detailTapAdvances: Boolean(adapter?.capabilities?.detailTapAdvances),
    // Leaf-advance paints the text ahead of the ring's arrival — same
    // renderer the settle hook uses, resolving the translation live.
    onDetailPreview: item => renderDetail(item, adapter, manifest, adapterNormalized, { translation: activeTranslation() })
  });
  currentApp = app;
  // Expose app to window for console API
  window.app = app;
  // Gateway transit: the new volume is fully rendered — lay the frozen old
  // screen over it and sweep the wipe line, hub-centered, top → lower right.
  // Same tick as the render above, so the swap itself never paints.
  if (transit && wipeSnapshot) {
    try {
      // Launch wipes downward; return wipes back up — the wipe always flows
      // away from where you are going.
      playGatewayWipe({
        svg,
        snapshot: wipeSnapshot,
        viewport,
        direction: transit.mode === 'return' ? 'up' : 'down'
      });
    } catch (err) {
      console.warn('[wheel] gateway wipe failed', err);
      wipeSnapshot.remove();
    }
  }
  // Detail renders resolve the translation LIVE (the sticky choice can
  // change between renders); the settle hook below regenerates the open
  // panel the moment a new choice commits.
  renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: activeTranslation() });
  app?.nav?.onChange?.(() => renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: activeTranslation() }));
  dimensionBridge.onSettle(translation => {
    renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation });
  });
  // Generic post-boot hook: adapters may schedule volume-specific startup
  // work (e.g. a featured-item prefetch) without the host
  // carrying volume literals (Phase B audit, H1).
  if (typeof handlerSet.onBoot === 'function') {
    handlerSet.onBoot({
      app,
      items,
      selectedIndex,
      renderDetail: item => renderDetail(item, adapter, manifest, adapterNormalized, { translation: activeTranslation() })
    });
  }
  if (!interactionsWired) {
    wireInteractions(() => currentApp);
    interactionsWired = true;
  }
  showVersion();
  performance.mark('wheel:render-done');
  recordBootPhases(volume);
  if (options.debug) mountFeelHud();
  mountProbe(); // inert unless ?probe=1 — field diagnostics to the drop box
  // ?bounds=1 — green region outlines (solid: star field, dashed: day grid)
  // for phone-side layout tuning; phones have no console for the old call.
  try {
    const diagParams = new URLSearchParams(window.location.search);
    if (diagParams.get('bounds') === '1') {
      window.showPyramidBounds?.();
    }
    // ?wedge=1 — day-wedge construction rays; ?wedgemul=N tunes the new
    // hub's distance (multiplier on magnifier→hub, default 1.5).
    if (diagParams.get('wedge') === '1') {
      window.showDayWedge?.(Number(diagParams.get('wedgemul')) || 1.5);
    }
  } catch (err) { /* diagnostics never break boot */ }
  prefetchGatewayTargets(manifest);

  if (playSplash) {
    const contentGroup = app?.view?.contentGroup || null;
    playBootSplash({ svg, contentGroup, viewport, arcPoints: computeArcPoints(viewport) })
      .catch(err => {
        console.warn('[wheel] boot splash failed', err);
        if (contentGroup) contentGroup.style.opacity = '';
        if (svg) svg.style.opacity = '';
      });
  }
}

bootVolume(null, null, restoredGatewayReturn()).catch(err => {
  showBootError(`Failed to initialize app: ${err.message}`);
});
