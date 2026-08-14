// A MOCK BROWSER FOR BOOT TESTS, shared (2026-08-12).
//
// Extracted from boot-smoke because `main.js` self-executes at import and
// exports nothing: a second boot needs a second PROCESS, which means a second
// test file, which means this cannot live inside the first one.
//
// That is what kept the withheld/dark state (O-48) unpinned — Howell ruled it
// and confirmed it on the instrument, and the suite could not reach it at all.
//
// The `hostname` and `protocol` in the location stub are load-bearing, not
// padding: the proofread override is LAN-gated and the gate fails CLOSED, so
// a location missing its hostname is read as public and the override never
// lifts. The stub used to claim localhost in its href alone — a field the
// gate does not consult — and so could never have lifted anything.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockElement } from './mock-dom.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const KNOWN_IDS = [
  'app', 'detail-panel', 'detail-content', 'strata-layer', 'copyright-notice',
  'dimension-button', 'search-button', 'version-badge', 'portrait-gate', 'desktop-gate'
];

export function installBrowserGlobals(search) {
  const byId = new Map(KNOWN_IDS.map(id => {
    const el = createMockElement('div');
    el.setAttribute?.('id', id);
    el.id = id;
    return [id, el];
  }));
  const body = createMockElement('body');
  const store = new Map();

  const doc = {
    getElementById: id => byId.get(id) || null,
    createElement: tag => createMockElement(tag),
    createElementNS: (_ns, tag) => createMockElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    body,
    documentElement: createMockElement('html'),
    // The verse layout asks whether the serif has landed; say it never does,
    // so the fallback metrics are used and nothing waits on a font.
    fonts: { ready: Promise.resolve(), check: () => false, load: () => Promise.resolve(), addEventListener() {} },
    visibilityState: 'visible'
  };

  const win = {
    // `hostname` and `protocol` are REAL parts of this stub, not padding: the
    // proofread override is LAN-gated and the gate fails closed, so a location
    // missing its hostname is treated as public and the override never lifts.
    // The stub already claimed localhost in its href; now it says so where the
    // gate actually looks.
    location: {
      search, pathname: '/', hostname: 'localhost', protocol: 'http:',
      href: `http://localhost/${search}`
    },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    addEventListener() {}, removeEventListener() {},
    innerWidth: 412, innerHeight: 915, devicePixelRatio: 2,
    visualViewport: null,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: cb => setTimeout(() => cb(performance.now()), 0),
    cancelAnimationFrame: id => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => '', fontSize: '16px', fontFamily: 'serif', transform: 'none' }),
    screen: { width: 412, height: 915 },
    history: { replaceState() {}, pushState() {} },
    navigator: { userAgent: 'node', sendBeacon: () => true }
  };
  win.window = win;

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.localStorage = win.localStorage;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.cancelAnimationFrame = win.cancelAnimationFrame;
  globalThis.getComputedStyle = win.getComputedStyle;
  globalThis.navigator = win.navigator;
  globalThis.screen = win.screen;
  // Node 18 does not expose CustomEvent globally; the detail sector announces
  // itself with one.
  if (typeof globalThis.CustomEvent !== 'function') {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    };
  }
  win.CustomEvent = globalThis.CustomEvent;
  win.dispatchEvent = () => true;
  globalThis.performance = globalThis.performance || { now: () => Date.now(), mark() {}, measure() {}, getEntriesByType: () => [] };
  if (!globalThis.performance.mark) globalThis.performance.mark = () => {};
  if (!globalThis.performance.getEntriesByType) globalThis.performance.getEntriesByType = () => [];

  // Serve the FIXTURES, never the real corpus: `data/` lives in the private
  // cargo repo (W-10), so it is absent in CI — a boot test that read it would
  // pass on a developer's machine and 404 on the build. The volume configs ask
  // for `./data/…` by name, so that prefix is rewritten to the fixture tree.
  globalThis.fetch = async url => {
    const rel = String(url)
      .replace(/^\.\//, '').replace(/^\//, '')
      // THE BIBLE'S CARGO PATH MAPS TO THE H-11 FIXTURE (O-52, 2026-08-14).
      //
      // Since the repoint the volume asks for the real corpus at its dated
      // version. That corpus lives in wheel-cargo (W-10) and is absent from
      // CI, so a boot test reading it would pass on a developer's machine and
      // 404 on the build — the exact failure this stub was written to prevent.
      //
      // The h11 fixture stops being THE VOLUME today and becomes what it
      // should always have been: the suite's own deterministic corpus. One
      // testament, one book, thirty-one leaves, ids that disagree with the
      // alphabet on purpose.
      .replace(/^data\/gutenberg\/[^/]+\//, 'test/fixtures/h11/gutenberg/v1/')
      .replace(/^data\//, 'test/fixtures/data/');
    try {
      const text = readFileSync(path.join(repoRoot, rel), 'utf-8');
      return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
    } catch (_) {
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    }
  };
  return { doc, byId };
}
