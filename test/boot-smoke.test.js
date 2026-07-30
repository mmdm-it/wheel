// THE BOOT SMOKE TEST — the gap two bugs walked through in one day
// (2026-07-30). Every other suite exercises a PIECE: a builder, the geometry,
// the bridge. None of them ever boots the app, so a crash in bootVolume itself
// is invisible to a fully green run. Twice in one session that cost a white
// screen on the phone: a `config.bootSplash` read a few lines before `config`
// existed, and a verse ring that reached only one book.
//
// This file boots main.js for real — it self-executes — against a stubbed DOM
// and the actual manifests on disk, and asserts only that the instrument comes
// up. It is deliberately shallow: not what the app looks like, only that it
// LIVES. Node runs each test file in its own process, so the globals here
// cannot leak into another suite.

import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockElement } from './helpers/mock-dom.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Elements main.js looks up by id. Anything it asks for that isn't here
// returns null, which the code already tolerates (every lookup is guarded).
const KNOWN_IDS = [
  'app', 'detail-panel', 'detail-content', 'strata-layer', 'copyright-notice',
  'dimension-button', 'search-button', 'version-badge', 'portrait-gate', 'desktop-gate'
];

function installBrowserGlobals(search) {
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
    location: { search, pathname: '/', href: `http://localhost/${search}` },
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
  globalThis.performance = globalThis.performance || { now: () => Date.now(), mark() {}, measure() {}, getEntriesByType: () => [] };
  if (!globalThis.performance.mark) globalThis.performance.mark = () => {};
  if (!globalThis.performance.getEntriesByType) globalThis.performance.getEntriesByType = () => [];

  // Serve the real data off disk, so boot reads exactly what ships.
  globalThis.fetch = async url => {
    const rel = String(url).replace(/^\.\//, '').replace(/^\//, '');
    try {
      const text = readFileSync(path.join(repoRoot, rel), 'utf-8');
      return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
    } catch (_) {
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    }
  };
  return { doc, byId };
}

describe('the app boots', () => {
  let errors = [];
  let byId;

  before(async () => {
    ({ byId } = installBrowserGlobals('?volume=bible'));
    const realError = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };
    // main.js self-executes bootVolume at import.
    await import('../src/main.js');
    // Let the boot's awaits and one animation frame settle.
    await new Promise(r => setTimeout(r, 150));
    console.error = realError;
  });

  it('reaches the end of boot without a fatal error', () => {
    const fatal = errors.filter(e => /Failed to initialize|volume validation failed/.test(e));
    assert.deepEqual(fatal, [], `boot reported: ${fatal.join(' | ')}`);
  });

  it('does not paint the boot-error message into the detail sector', () => {
    const content = byId.get('detail-content');
    const text = String(content?.textContent || '');
    assert.ok(!/Failed to initialize/.test(text), `detail sector shows: ${text}`);
  });
});

// The SECOND bug of the day, guarded precisely rather than by smoke: boot used
// to build its own verse ring that walked ONE book from the entry chapter to
// that book's end, so a reader booting at Matthew 16:18 could rotate no
// earlier than Matthew 16:1 and no later than Matthew 28:20. Everything before
// the current chapter and after the current book was unreachable.
describe('the boot verse ring spans the whole volume', () => {
  it('runs from the first verse to the last, seated at the entry verse', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const manifest = JSON.parse(readFileSync(
      path.join(repoRoot, 'test/fixtures/data/gutenberg/manifest.json'), 'utf-8'));
    const chain = await volumeConfigs.bible.buildChain(manifest, {
      level: 'verse', cousinMode: true, arrangement: 'cousins-with-gaps',
      bookId: 'GENE', chapterId: '1', verseId: '2'
    }, {});
    const real = chain.items.filter(Boolean);
    assert.equal(chain.items[chain.selectedIndex]?.id, 'GENE_1_2', 'seated at the entry verse');
    assert.equal(real[0].id, 'GENE_1_1', 'reaches back before the entry chapter');
    // The fixture's last book is Revelation; the point is that the ring does
    // not stop at the end of the entry BOOK.
    assert.ok(real[real.length - 1].id.startsWith('APOC_'),
      `ring should reach the volume's last book, ended at ${real[real.length - 1].id}`);
    assert.ok(real.some(v => v.meta?.bookEntryId === 'EXO'),
      'books after the entry book are reachable');
  });
});
