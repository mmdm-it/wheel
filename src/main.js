import { createApp, getViewportInfo, buildBibleVerseCousinChain, buildBibleBookCousinChain, validateVolumeRoot } from './index.js';
import { getPlacesLevels, buildPlacesLevel, buildCalendarYears, buildBibleBooks, buildCatalogManufacturers, getCatalogChildren, getCalendarMonths, getBibleChapters, toRomanNumeral } from './adapters/volume-helpers.js';
import { createVolumeLayoutSpec } from './adapters/volume-layout.js';
import { adapterLoader, volumeConfigs, DEFAULT_VOLUME, makeLabelFormatter } from './volume-configs.js';
import { mountFeelHud } from './view/feel-hud.js';
import { mountProbe } from './diagnostics/probe.js';
import { DetailPluginRegistry } from './view/detail/plugin-registry.js';
import { TextDetailPlugin } from './view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from './view/detail/plugins/card-plugin.js';
import { computeDetailSectorBounds } from './geometry/detail-sector-geometry.js';
import { computeFlickRotation, FLICK_GLIDE_MS } from './interaction/gesture-tiers.js';
import { getArcParameters, getViewportWindow, getNodeSpacing } from './geometry/focus-ring-geometry.js';
import { bootSplashShouldPlay, playBootSplash } from './view/boot-splash.js';

const svg = document.getElementById('app');
const viewport = getViewportInfo(window.innerWidth, window.innerHeight);
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
const detailPanel = document.getElementById('detail-panel');
const detailContent = document.getElementById('detail-content');

// Toggle detail panel visibility in sync with the Detail Sector animation.
// The panel fades in after the blue circle has finished expanding,
// and hides immediately when the circle begins collapsing.
window.addEventListener('detail-sector-change', (e) => {
  if (!detailPanel) return;
  const { visible } = e.detail || {};
  if (visible) {
    detailPanel.classList.add('detail-panel--visible');
  } else {
    detailPanel.classList.remove('detail-panel--visible');
  }
});

function renderDetail(selected, adapterInstance, manifest, adapterNormalized, { translation } = {}) {
  if (!detailPanel || !detailContent) return;
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
  const arcBounds = computeDetailSectorBounds(window.innerWidth, window.innerHeight);
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

  const nearestRingNode = event => {
    if (!svg || typeof svg.createSVGPoint !== 'function') return null;
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return null;

    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const p = pt.matrixTransform(ctm.inverse());

    const nodes = svg.querySelectorAll('.focus-ring-node');
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
    logTap('pointerdown', {
      pointerType: event.pointerType,
      targetClass: event.target?.getAttribute?.('class') || null,
      targetId: event.target?.getAttribute?.('id') || null,
      x: event.clientX,
      y: event.clientY
    });
    const isNode = event.target && event.target.closest && event.target.closest('.focus-ring-node');
    pendingTapNode = null;
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
    // Child pyramid node — delegate to the app's pyramid click handler
    const isPyramidNode = event.target && event.target.closest && event.target.closest('.child-pyramid-node');
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

    // Touch near-miss support: if the tap lands close to a tiny ring node,
    // trigger its click handler instead of starting a drag.
    const isBackgroundLikeTarget = (
      event.target === svg
      || (event.target && event.target.closest && event.target.closest('.focus-ring-band'))
      || Boolean(isPyramidNode)
    );
    if ((event.pointerType === 'touch' || event.pointerType === 'pen') && isBackgroundLikeTarget && !pendingTapNode) {
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
  // Boot first; only a successful boot earns the history entry (H4).
  bootVolume(gateway.volume, search, returnContext)
    .then(() => {
      try {
        window.history.pushState({ wheelGateway: true, gatewayReturn: returnContext }, '', search);
      } catch (err) { /* history unavailable (e.g. file://) */ }
    })
    .catch(err => showBootError(`gateway boot failed: ${err.message}`));
}

function returnThroughGateway() {
  const ctx = gatewayReturnContext;
  if (!ctx?.volume || !volumeConfigs[ctx.volume]) return false;
  const params = new URLSearchParams();
  params.set('volume', ctx.volume);
  if (ctx.itemId) params.set('item', ctx.itemId);
  const search = `?${params.toString()}`;
  bootVolume(ctx.volume, search, null)
    .then(() => {
      try { window.history.pushState({ wheelGateway: true }, '', search); } catch (err) { /* ignore */ }
    })
    .catch(err => showBootError(`gateway return failed: ${err.message}`));
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

async function bootVolume(volumeOverride = null, searchOverride = null, gatewayReturn = null) {
  performance.mark('wheel:boot-start');
  // The splash reveal is initial-load only, never a gateway transit. Decide
  // now and hide the live wheel so it can be dissolved into, not popped on.
  const playSplash = !firstBootDone && bootSplashShouldPlay();
  firstBootDone = true;
  if (playSplash && svg) svg.style.opacity = '0';
  const { volume, config, manifest, root, options, supplemental } = await loadConfig(volumeOverride, searchOverride);
  performance.mark('wheel:manifest-ready');
  const translationsMeta = supplemental?.translationsMeta || null;
  const translationId = options.translation || null;
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

  // ── Point of no return ── the new volume built successfully; only now
  // tear down the previous instance (Phase B audit, M1: a late failure
  // above leaves the old volume intact instead of a black screen).
  // Teardown any previous volume instance — gateway reboots reuse the SVG.
  // Clear only the detail CONTENT: #detail-panel's inner skeleton
  // (#detail-content, #version-badge) is owned by index.html and must survive.
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const detailContentEl = document.getElementById('detail-content');
  if (detailContentEl) detailContentEl.innerHTML = '';
  const detailPanelEl = document.getElementById('detail-panel');
  if (detailPanelEl) detailPanelEl.classList.remove('detail-panel--visible');
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
    getBibleChapters: layoutBindings.getBibleChapters || ((m, selected, nm, mode) => getBibleChapters(manifest, selected, nm, mode)),
    getBibleVerseItems: layoutBindings.getBibleVerseItems,
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
    pyramidAdapter: adapter
  });
  currentApp = app;
  // Expose app to window for console API
  window.app = app;
  renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: translationId });
  app?.nav?.onChange?.(() => renderDetail(app?.nav?.getCurrent?.(), adapter, manifest, adapterNormalized, { translation: translationId }));
  // Generic post-boot hook: adapters may schedule volume-specific startup
  // work (e.g. a featured-item prefetch) without the host
  // carrying volume literals (Phase B audit, H1).
  if (typeof handlerSet.onBoot === 'function') {
    handlerSet.onBoot({
      app,
      items,
      selectedIndex,
      renderDetail: item => renderDetail(item, adapter, manifest, adapterNormalized, { translation: translationId })
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
