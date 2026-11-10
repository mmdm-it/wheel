// THE INSTALLED APP (O-285, Howell 2026-11-09): Chrome's Install on the room
// showed three crowns before the glide in — the launcher's icon, the
// browser's improvised splash, then the page's card. The page now carries a
// web manifest, so the browser's splash is the crown with the name on the
// Bible's ground; and installed, the page skips its own card. In a browser
// tab nothing changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('the manifest names the Bible, its ground and its crown, and opens standalone at the door', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Biblia Catholica');
  assert.equal(m.short_name, 'Biblia Catholica');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './', 'the door itself: the page reads the volume from its path');
  assert.equal(m.scope, './');
  assert.equal(m.background_color, '#d4a574', 'the Bible\'s ground, as index.html paints it before anything arrives');
  assert.equal(m.theme_color, '#d4a574');
  const sizes = m.icons.map(i => i.sizes).sort();
  assert.deepEqual(sizes, ['192x192', '512x512', '512x512']);
  assert.ok(m.icons.some(i => i.purpose === 'maskable'), 'one icon for the launcher\'s mask');
  for (const i of m.icons) {
    assert.match(i.src, /^data\/gutenberg\/[\d.]+\/assets\/icon-/, 'the corpus\'s own icons, at the served path');
    // The icons live in the corpus, reached through the data/ symlink; absent in CI, checked where present.
    if (fs.existsSync(path.join(root, 'data/gutenberg'))) assert.ok(fs.existsSync(path.join(root, i.src)), `${i.src} exists`);
  }
  const grounds = read('index.html').match(/var grounds = \{([^}]*)\}/)[1];
  assert.match(grounds, new RegExp(`bible: '${m.background_color}'`), 'one number for the ground, here and in the page');
});

test('the page links the manifest and paints the status bar in the ground\'s colour', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest" \/>/);
  assert.match(html, /m\.name = 'theme-color'; m\.content = g;/, 'set with the ground, before any stylesheet');
});

test('installed, the page shows no card; in a tab, or asked with ?card=1, it does', () => {
  const main = read('src/main.js');
  assert.match(main, /function installedDisplay\(\) \{[\s\S]*?\('card'\) === '1'\) return false;[\s\S]*?matchMedia\('\(display-mode: standalone\)'\)\.matches/);
  assert.match(main, /splash: installed \? null : rememberedSplash/, 'no card on the sheet');
  assert.match(main, /if \(overture && !rememberedSplash && !installed\) \{/, 'and no first-visit card when the declaration lands');
});

test('the mirror keeps the Bible\'s manifest out of the calendar\'s door', () => {
  const sh = read('scripts/mirror-room.sh');
  assert.match(sh, /\[\[ "\$door" == calendar \]\] && KEEP\+=\(--exclude='manifest\.webmanifest'\)/);
});
