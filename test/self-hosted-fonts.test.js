// THE FACES TRAVEL WITH THE PAGE (O-286, 2026-11-09). The page once loaded
// its typefaces from Google at runtime — every reader's address to Google
// for a font, a substitute face offline (O-50 named the debt). Before the
// public door opens, the same faces, weights and unicode ranges are served
// from assets/fonts/google/ by styles/fonts.css, and nothing in the page
// reaches Google any more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('the page reaches no font service: its faces come from its own stylesheet', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'no Google Fonts link, no preconnect');
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\/fonts\.css\?v=[\d.]+" \/>/, 'the faces\' sheet, stamped like the others');
  assert.ok(html.indexOf('styles/fonts.css') < html.indexOf('styles/base.css'), 'declared before the sheets that use them');
  for (const sheet of ['styles/base.css', 'styles/theme-tokens.css', 'styles/fonts.css']) {
    assert.doesNotMatch(read(sheet), /https?:\/\//, `${sheet} fetches nothing from the network`);
  }
});

test('the sheet declares every family and weight the page uses, each from a file that exists', () => {
  const css = read('styles/fonts.css');
  const faces = [...css.matchAll(/@font-face \{([\s\S]*?)\}/g)].map(m => m[1]);
  assert.ok(faces.length >= 60, `the faces Google served, subset by subset (${faces.length})`);
  const have = new Set(faces.map(f => `${/font-family: '([^']+)'/.exec(f)[1]} ${/font-weight: (\d+)/.exec(f)[1]} ${/font-style: (\w+)/.exec(f)[1]}`));
  for (const want of ['EB Garamond 400 normal', 'EB Garamond 600 normal', 'EB Garamond 700 normal', 'EB Garamond 400 italic',
    'Montserrat 500 normal', 'Montserrat 700 normal', 'Noto Sans 500 normal', 'Noto Sans 700 normal', 'Noto Sans Hebrew 500 normal', 'Noto Sans Hebrew 700 normal']) {
    assert.ok(have.has(want), `${want} is declared`);
  }
  for (const f of faces) {
    const src = /url\('([^']+)'\) format\('woff2'\)/.exec(f);
    assert.ok(src, 'each face is one local woff2');
    assert.match(src[1], /^\.\.\/assets\/fonts\/google\/[a-z0-9-]+\.woff2$/);
    const file = path.join(root, 'styles', src[1]);
    assert.ok(fs.existsSync(file), `${src[1]} exists`);
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', `${src[1]} is a WOFF2 file`);
    assert.match(f, /unicode-range: U\+/, 'the subset\'s range kept, so the browser fetches only what a page uses');
    assert.match(f, /font-display: swap/);
  }
  // Greek and Hebrew are spoken (O-93): the ranges that carry them are present.
  assert.match(css, /Noto Sans Hebrew[\s\S]*?unicode-range: [^;]*U\+0590-05FF/);
  assert.match(css, /EB Garamond[\s\S]*?unicode-range: U\+0370-/);
});

test('the host serves the faces with their type and keeps them for a year, and the licences name every family', () => {
  const ht = read('.htaccess');
  assert.match(ht, /AddType font\/woff2 \.woff2/);
  assert.match(ht, /<FilesMatch "\\\.\(png\|jpe\?g\|webp\|svg\|ico\|woff2\?\)\$">\s*Header set Cache-Control "public, max-age=31536000, immutable"/);
  const lic = read('assets/fonts/Licenses.txt');
  for (const fam of ['EB Garamond', 'Montserrat', 'Noto Sans', 'Noto Sans Hebrew']) assert.ok(lic.includes(fam), `${fam} in the licences`);
  assert.match(lic, /SIL Open Font License, Version 1\.1/);
  // The boot log looks for the faces where they now are.
  const ov = read('src/view/boot-overture.js');
  assert.match(ov, /\['fonts css', \/styles\\\/fonts\\\.css\/\]/);
  assert.doesNotMatch(ov, /googleapis|gstatic/);
});
