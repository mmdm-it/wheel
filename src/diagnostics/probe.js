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
  // On the LAN dev server there is no PHP — post to production's sink so
  // LAN runs still land in the same log (sendBeacon needs no CORS reply).
  return isLan ? PROBE_SINK.absolute : PROBE_SINK.relative;
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
    gesture: window.__wheelGestureTrace || null
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

  if (document.body) mountSendButton();
  else window.addEventListener('DOMContentLoaded', mountSendButton);
}
