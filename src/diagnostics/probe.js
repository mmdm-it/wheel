// The probe (?probe=1 or localStorage wheel-probe=1): field diagnostics for
// the deployed instrument. Collects what the feel HUD shows plus what it
// can't — per-asset network timings — and ships everything to the drop box
// (telemetry.php) via sendBeacon, so lag sightings on any phone, any
// network, become log lines readable over ssh. The four test-matrix
// variables label themselves: browser+device from the UA, Internet-vs-LAN
// from the serving host, WiFi-vs-cellular from the source IP at the sink.
//
// Ships in the bundle but is inert unless explicitly enabled.

const LONG_FRAME_MS = 50;      // a frame worth journaling
const MAX_JOURNAL = 40;        // worst-frames ring buffer
const AUTO_FLUSH_MS = 12000;   // first report lands even if the tab never hides

let enabled = false;
let sessionId = '';
let journal = [];
let touchDown = false;
let flushed = 0;

// Sink URLs live in volume-configs (the declared literals home) — the probe
// itself knows nothing about the deployment layout.
import { PROBE_SINK } from '../volume-configs.js';

function sinkUrl() {
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  const isLan = /^(localhost|127\.|10\.|192\.168\.|172\.)/.test(host);
  // On the LAN the dev server itself accepts the POST and drops it to a file
  // Orville reads directly (2026-07-27; production keeps its PHP sink).
  return isLan ? PROBE_SINK.lan : PROBE_SINK.relative;
}

function resourceAutopsy() {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return [];
  const wanted = /\.(js|json|css)(\?|$)/;
  return performance.getEntriesByType('resource')
    .filter(e => wanted.test(e.name))
    .slice(0, 40)
    .map(e => ({
      name: e.name.split('/').slice(-2).join('/').split('?')[0],
      ms: Math.round(e.duration),
      dns: Math.round(e.domainLookupEnd - e.domainLookupStart),
      connect: Math.round(e.connectEnd - e.connectStart),
      ttfb: Math.round(e.responseStart - e.requestStart),
      download: Math.round(e.responseEnd - e.responseStart),
      wire: e.transferSize ?? -1,          // bytes on the wire
      gzip: e.encodedBodySize ?? -1,       // compressed body (== decoded -> no gzip)
      raw: e.decodedBodySize ?? -1,
      // wire 0 with a body -> served from cache; tiny wire -> 304 revalidation
      cache: (e.transferSize === 0 && e.decodedBodySize > 0) ? 'cache'
        : (e.transferSize > 0 && e.transferSize < 400 && e.decodedBodySize > 2000) ? '304'
          : 'network'
    }));
}

function navigationAutopsy() {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav) return null;
  return {
    ttfb: Math.round(nav.responseStart - nav.requestStart),
    dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
    connect: Math.round(nav.connectEnd - nav.connectStart),
    domReady: Math.round(nav.domContentLoadedEventEnd),
    protocol: nav.nextHopProtocol || ''
  };
}

// Every viewport metric at once — mobile browsers disagree about what the
// height "is" (innerHeight vs 100vh vs the visual viewport vs the client box),
// and a bottom-crop is exactly that disagreement. Comparing a broken config
// against a working one across these numbers names the culprit.
function viewportMetrics() {
  const de = document.documentElement;
  const vv = window.visualViewport || null;
  let css100 = null;
  try {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;visibility:hidden;pointer-events:none';
    document.body.appendChild(p);
    const r = p.getBoundingClientRect();
    css100 = `${Math.round(r.width)}x${Math.round(r.height)}`; // what 100vw x 100vh resolves to
    p.remove();
  } catch (e) { /* ignore */ }
  const app = document.getElementById('app');
  const ar = app && app.getBoundingClientRect ? app.getBoundingClientRect() : null;
  return {
    inner: `${window.innerWidth}x${window.innerHeight}`,            // geometry uses this
    client: `${de.clientWidth}x${de.clientHeight}`,
    visual: vv ? `${Math.round(vv.width)}x${Math.round(vv.height)}@${Math.round(vv.offsetTop)}scale${(vv.scale || 1).toFixed(2)}` : null,
    css100vh: css100,                                              // what the SVG (100vh) actually gets
    appBox: ar ? `${Math.round(ar.width)}x${Math.round(ar.height)}@top${Math.round(ar.top)}` : null,
    screen: `${window.screen ? window.screen.width : '?'}x${window.screen ? window.screen.height : '?'}`,
    dpr: window.devicePixelRatio || 1,
    orient: (window.screen && window.screen.orientation && window.screen.orientation.type) || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait')
  };
}

function buildReport(reason) {
  return {
    session: sessionId,
    reason,
    seq: flushed,
    host: (typeof location !== 'undefined' && location.host) || '',
    path: (typeof location !== 'undefined' && location.pathname) || '',
    device: viewportMetrics(),
    nav: navigationAutopsy(),
    boot: window.__wheelBootPhases || null,
    resources: resourceAutopsy(),
    longFrames: journal.slice(),
    // Render self-time since the last report: worst frame's JS cost + how
    // many exceeded budget. A long frame with small render = browser paint.
    render: window.__wheelRenderStats ? { ...window.__wheelRenderStats } : null,
    gesture: window.__wheelGestureTrace || null,
    taps: window.__wheelTapTrace ? window.__wheelTapTrace.slice() : null,
    // Verse-wrap autopsy (Howell 2026-07-27, the iOS Chrome overflow): the
    // ACTUALLY-rendered width of the first verse lines vs the sector budget
    // the wrap was computed against, plus the same text re-measured in body
    // and panel context. renderDetail stashes its bounds on
    // window.__wheelVerseBounds for this.
    verse: (() => {
      try {
        const lines = Array.from(document.querySelectorAll('.detail-text-line')).slice(0, 3);
        if (!lines.length) return null;
        const vb = window.__wheelVerseBounds || null;
        const panel = document.getElementById('detail-panel');
        const measureIn = (host, text, fontPx, fontFamily) => {
          if (!host) return -1;
          const s = document.createElement('span');
          s.style.cssText = 'position:absolute;left:0;top:-9999px;opacity:0;white-space:nowrap;pointer-events:none;margin:0;padding:0;';
          s.style.fontFamily = fontFamily;
          s.style.fontSize = `${fontPx}px`;
          s.textContent = text;
          host.appendChild(s);
          const w = s.getBoundingClientRect().width;
          s.remove();
          return Math.round(w);
        };
        const panelCS = panel ? getComputedStyle(panel) : null;
        return {
          ebGaramond: (document.fonts && document.fonts.check) ? document.fonts.check('16px "EB Garamond"') : null,
          panel: panel ? {
            w: Math.round(panel.getBoundingClientRect().width),
            tf: panelCS.transform, fontFamily: panelCS.fontFamily.slice(0, 40)
          } : null,
          boundsRight: vb ? Math.round(vb.rightBound) : null,
          lt0: vb && vb.lineTable && vb.lineTable[0] ? {
            leftX: Math.round(vb.lineTable[0].leftX),
            avail: Math.round(vb.lineTable[0].availableWidth)
          } : null,
          lines: lines.map(el => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            const fontPx = parseFloat(cs.fontSize) || 0;
            const text = el.textContent || '';
            return {
              text: text.slice(0, 28),
              chars: text.length,
              rendered: Math.round(r.width),
              left: Math.round(r.left),
              right: Math.round(r.right),
              cssLeft: el.style.left, cssMaxW: el.style.maxWidth,
              fontPx: Math.round(fontPx * 10) / 10,
              ff: cs.fontFamily.slice(0, 40),
              bodyMeas: measureIn(document.body, text, fontPx, cs.fontFamily),
              panelMeas: measureIn(panel, text, fontPx, cs.fontFamily)
            };
          })
        };
      } catch (e) { return { err: String(e).slice(0, 80) }; }
    })(),
    // Font autopsy: what the app computed vs what the browser actually
    // rendered for a pyramid label — catches any layer that rescales text
    // between our px and the glass (2026-07-19 cross-browser size mystery).
    fonts: (() => {
      try {
        const all = Array.from(document.querySelectorAll('.child-pyramid-label'));
        const live = all.filter(el => !el.closest('.migration-animation-overlay') && !el.closest('#gateway-wipe-old') && !el.closest('#boot-splash-layer'));
        const el = live[0] || all[0] || null;
        const summary = {
          base: window.__wheelLabelBase ?? null,
          total: all.length,
          live: live.length,
          withInline: all.filter(e2 => e2.style.fontSize).length
        };
        if (!el) return summary;
        const cs = getComputedStyle(el);
        let bb = null;
        try { bb = el.getBBox(); } catch (e) { /* detached */ }
        return {
          ...summary,
          sampledOverlay: Boolean(el.closest('.migration-animation-overlay')),
          inline: el.style.fontSize || '',
          computed: cs.fontSize,
          text: (el.textContent || '').slice(0, 12),
          bboxH: bb ? Math.round(bb.height * 10) / 10 : null,
          bboxW: bb ? Math.round(bb.width * 10) / 10 : null
        };
      } catch (e) { return null; }
    })()
  };
}

function flush(reason) {
  if (!enabled) return;
  flushed += 1;
  const payload = JSON.stringify(buildReport(reason));
  try {
    if (navigator.sendBeacon) {
      // text/plain keeps it a simple request — no preflight from the LAN.
      navigator.sendBeacon(sinkUrl(), new Blob([payload], { type: 'text/plain' }));
    } else {
      fetch(sinkUrl(), { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
  } catch (err) { /* diagnostics must never break the instrument */ }
  journal = [];
  // Reset render stats so each report reflects only its own window.
  if (window.__wheelRenderStats) window.__wheelRenderStats = { worst: 0, over: 0, n: 0 };
}

// THE WRAP LOG, ON THE GLASS (2026-08-30). The SEND button posts to
// /probe-drop, which the LAN dev server does not implement — that comment is
// a leftover and the reports go nowhere. Howell reads this instrument by
// PHOTOGRAPHING it, so the diagnosis is put where the camera already points.
// One line per verse layout: the size chosen, how many lines it produced, the
// row width it wrapped against, and the measured width of one fixed Greek
// string at that size. Two renders that disagree about the last number at the
// same size disagree about the FACE; -1 there means no DOM measurer at all.
function mountWrapLog() {
  window.__wheelWrapLog = [];
  const el = document.createElement('div');
  el.id = 'probe-wrap-log';
  el.style.cssText = [
    'position:fixed', 'left:2px', 'bottom:2px', 'z-index:9999',
    'font:11px/1.3 monospace', 'color:#0f0', 'background:rgba(0,0,0,0.78)',
    'padding:4px 6px', 'border-radius:6px', 'max-width:99vw',
    'white-space:pre', 'pointer-events:none'
  ].join(';');
  document.body.appendChild(el);
  setInterval(() => {
    const rows = window.__wheelWrapLog || [];
    el.textContent = rows.length
      ? rows.map((r, i) => `${i} ${r.px}px n${r.n} row${r.avail} w${r.sentinel} ${r.first}`).join('\n')
      : 'no verse layout yet';
  }, 400);
}

function mountSendButton() {
  const el = document.createElement('div');
  el.id = 'probe-send';
  el.textContent = '⇪ SEND';
  el.style.cssText = [
    'position:fixed', 'top:4px', 'right:4px', 'z-index:9999',
    'font:20px/1.4 monospace', 'color:#0f0', 'background:rgba(0,0,0,0.65)',
    'padding:8px 12px', 'border-radius:8px', 'cursor:pointer'
  ].join(';');
  el.addEventListener('click', () => {
    flush('manual');
    el.textContent = `⇪ SENT ${flushed}`;
    setTimeout(() => { el.textContent = '⇪ SEND'; }, 1500);
  });
  document.body.appendChild(el);
}

export function mountProbe() {
  if (enabled || typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const on = params.get('probe') === '1'
    || (typeof localStorage !== 'undefined' && localStorage.getItem('wheel-probe') === '1');
  if (!on) return;
  enabled = true;
  sessionId = Date.now().toString(36);

  // Tap autopsy: every pointer/click event in capture phase, with target,
  // coordinates, the visual viewport SCALE (a browser double-tap zoom shows
  // up here), and whether something already cancelled it. App code pushes
  // its own markers (pyramid click handled, gateway launched) into the same
  // trace so we can see exactly where a tap died.
  window.__wheelTapTrace = [];
  const TAP_TRACE_MAX = 60;
  const describeTarget = el => {
    if (!el || !el.tagName) return '?';
    const cls = (typeof el.getAttribute === 'function' && el.getAttribute('class')) || '';
    const id = el.id ? `#${el.id}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls ? '.' + String(cls).split(' ')[0] : ''}`.slice(0, 48);
  };
  const traceEvent = e => {
    const vv = window.visualViewport;
    const touch = e.touches && e.touches[0];
    window.__wheelTapTrace.push({
      t: Math.round(performance.now()),
      ev: e.type,
      x: Math.round(e.clientX ?? touch?.clientX ?? -1),
      y: Math.round(e.clientY ?? touch?.clientY ?? -1),
      tgt: describeTarget(e.target),
      scale: vv ? Number((vv.scale || 1).toFixed(3)) : 1,
      def: e.defaultPrevented ? 1 : 0
    });
    if (window.__wheelTapTrace.length > TAP_TRACE_MAX) window.__wheelTapTrace.shift();
  };
  ['pointerdown', 'pointerup', 'pointercancel', 'click', 'dblclick', 'touchstart', 'touchend']
    .forEach(type => window.addEventListener(type, traceEvent, { passive: true, capture: true }));

  // Long-frame journal, tagged with what the finger was doing.
  window.addEventListener('pointerdown', () => { touchDown = true; }, { passive: true, capture: true });
  window.addEventListener('pointerup', () => { touchDown = false; }, { passive: true, capture: true });
  window.addEventListener('pointercancel', () => { touchDown = false; }, { passive: true, capture: true });
  let last = performance.now();
  const loop = t => {
    const dt = t - last;
    last = t;
    if (dt > LONG_FRAME_MS) {
      journal.push({ at: Math.round(t), ms: Math.round(dt), touch: touchDown ? 1 : 0 });
      if (journal.length > MAX_JOURNAL) journal.shift();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // First report lands on its own; later ones on hide/background or SEND.
  setTimeout(() => flush('auto'), AUTO_FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush('hidden');
  });
  window.addEventListener('pagehide', () => flush('pagehide'));

  const mountUi = () => { mountSendButton(); mountWrapLog(); };
  if (document.body) mountUi();
  else window.addEventListener('DOMContentLoaded', mountUi);
}
