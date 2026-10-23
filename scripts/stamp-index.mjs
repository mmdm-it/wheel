#!/usr/bin/env node
// STAMP THE STATIC STYLESHEETS WITH THE ENGINE'S VERSION (O-216/O-217,
// 2026-10-23). The host caches CSS for a week unless told otherwise, and a
// phone held last week's base stylesheet beside today's bundle: the mark
// moved in the code and stayed a red band on the glass. The theme sheet is
// stamped by the app at run time (applyTheme); the two sheets index.html
// names itself are stamped here, at build, from package.json — so a new
// version is a new address and no cache can serve the old one. Idempotent:
// the same version writes the same file.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const file = path.join(root, 'index.html');
const before = readFileSync(file, 'utf8');
const after = before.replace(/href="\.\/styles\/(theme-tokens|base)\.css(?:\?v=[^"]*)?"/g, (_, name) => `href="./styles/${name}.css?v=${encodeURIComponent(version)}"`);
if (after !== before) { writeFileSync(file, after); console.log(`stamp-index: stylesheets stamped v${version}`); }
else console.log(`stamp-index: already v${version}`);
