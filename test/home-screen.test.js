// THE DOOR ONTO THE HOME SCREEN (O-273, Howell 2026-11-07): the film of the
// app must show no browser bar, and a reader keeps a volume on the phone's
// home screen. A volume declares its own manifest and icon under its data
// root; the engine writes the link into <head> and names no volume.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { declareHomeScreen } from '../src/core/home-screen.js';
import { volumeConfigs } from '../src/volume-configs.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeDocument() {
  const children = [];
  const mk = tag => {
    const attrs = {};
    return { tag, attrs, setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: k => attrs[k] };
  };
  return {
    children,
    head: {
      appendChild: el => children.push(el),
      querySelector: sel => {
        const m = /^(\w+)\[(\w[\w-]*)="([^"]+)"\]$/.exec(sel);
        return children.find(c => c.tag === m[1] && c.attrs[m[2]] === m[3]) || null;
      }
    },
    createElement: mk
  };
}

describe('the home-screen door (O-273)', () => {
  it('writes the manifest link, the theme colour and the touch icon into <head>', () => {
    const doc = fakeDocument();
    const out = declareHomeScreen(doc, { manifestHref: './data/x/manifest.json', icon: './data/x/i.png', themeColor: '#d4a574', title: 'T' });
    assert.deepEqual(out, { manifest: true, themeColor: true, icon: true });
    const by = (tag, k, v) => doc.children.find(c => c.tag === tag && c.attrs[k] === v);
    assert.equal(by('link', 'rel', 'manifest').attrs.href, './data/x/manifest.json');
    assert.equal(by('meta', 'name', 'theme-color').attrs.content, '#d4a574');
    assert.equal(by('link', 'rel', 'apple-touch-icon').attrs.href, './data/x/i.png');
    assert.equal(by('meta', 'name', 'apple-mobile-web-app-title').attrs.content, 'T');
  });

  it('declares again without duplicating, so a volume change rewrites rather than stacks', () => {
    const doc = fakeDocument();
    declareHomeScreen(doc, { manifestHref: 'a.json', themeColor: '#111' });
    declareHomeScreen(doc, { manifestHref: 'b.json', themeColor: '#222' });
    const links = doc.children.filter(c => c.tag === 'link' && c.attrs.rel === 'manifest');
    assert.equal(links.length, 1);
    assert.equal(links[0].attrs.href, 'b.json');
    assert.equal(doc.children.filter(c => c.tag === 'meta' && c.attrs.name === 'theme-color').length, 1);
  });

  it('a volume declaring no manifest gets the theme colour and nothing else', () => {
    const doc = fakeDocument();
    const out = declareHomeScreen(doc, { themeColor: '#333' });
    assert.deepEqual(out, { manifest: false, themeColor: true, icon: false });
    assert.equal(doc.children.length, 1);
  });

  it('a document without a head is left alone', () => {
    assert.deepEqual(declareHomeScreen({}, { manifestHref: 'a.json', themeColor: '#1' }), { manifest: false, themeColor: false, icon: false });
    assert.deepEqual(declareHomeScreen(null, {}), { manifest: false, themeColor: false, icon: false });
  });

  it('the volume that declares a manifest declares one that exists, installs standalone, and whose icons exist', async () => {
    const cfg = volumeConfigs.bible;
    assert.ok(cfg.webManifest, 'the volume declares a manifest');
    assert.ok(cfg.webManifest.startsWith(cfg.assetBase.replace(/\/$/, '')), 'the manifest lives under the volume\'s own data root, as its emblem does (W-114)');
    const file = path.join(repoRoot, cfg.webManifest);
    const m = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(m.display, 'standalone', 'installed, it opens with no browser bar');
    assert.ok(m.name && m.start_url && m.scope, 'name, start_url and scope are what makes a page installable');
    assert.ok(m.start_url.startsWith(m.scope), 'start_url is inside scope');
    // Three folders under the app root: the file is at <root>/data/<volume>/<version>/manifest.json,
    // and relative resolution must land on the root wherever the app is served.
    assert.equal(m.scope, '../../../');
    assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, 'at least a 192 and a 512 icon');
    for (const icon of m.icons) {
      const p = path.join(path.dirname(file), icon.src);
      await fs.access(p);
    }
    assert.ok(m.icons.some(i => /maskable/.test(i.purpose || '')), 'one icon is maskable for Android launchers');
    assert.ok(cfg.homeIcon, 'the touch icon is declared');
    await fs.access(path.join(repoRoot, cfg.homeIcon));
  });
});
