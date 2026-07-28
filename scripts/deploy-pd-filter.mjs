// deploy-pd-filter.mjs — Wilbur's deploy-time public-domain filter.
//
// Builds the DEPLOYABLE copy of the gutenberg volume: chapter files with all
// non-allowlisted translation texts removed, everything else copied verbatim,
// .json.gz siblings regenerated (same 2048-byte floor as precompress-json).
// The full corpus — copyrighted texts included — stays in the private
// wheel-cargo repo and the local tree; ONLY this filtered copy may reach the
// public server (HANDOFF W-10/W-11; LICENSING.local.md).
//
// The allowlist is deliberately explicit and short. Adding a code here is a
// LICENSING event, not a convenience: it asserts the text is public domain or
// licensed for our distribution. LXX provenance is still to be verified
// against its critical apparatus (dossier note) — included on the reasonable
// reading that the underlying edition's protection has lapsed.
//
// Usage: node scripts/deploy-pd-filter.mjs <src data/gutenberg> <dest dir>

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, dirname } from 'node:path';

const PD_ALLOWLIST = new Set(['WLC', 'LXX', 'BYZ', 'VUL', 'NEO', 'SYN', 'DRA', 'SAC', 'ALL']);
const GZ_FLOOR = 2048; // bytes — mirror precompress-json.mjs exactly

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: node deploy-pd-filter.mjs <srcDir> <destDir>');
  process.exit(1);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { yield* walk(full); continue; }
    yield full;
  }
}

const strippedPerCode = {};
let files = 0, chapters = 0, bytesIn = 0, bytesOut = 0;

for (const file of walk(src)) {
  if (file.endsWith('.json.gz')) continue; // regenerated below, never copied
  const rel = relative(src, file);
  const out = join(dest, rel);
  mkdirSync(dirname(out), { recursive: true });

  let buf = readFileSync(file);
  bytesIn += buf.length;

  if (rel.startsWith('chapters/') && file.endsWith('.json')) {
    const chapter = JSON.parse(buf.toString('utf8'));
    for (const verse of Object.values(chapter.verses || {})) {
      for (const code of Object.keys(verse.text || {})) {
        if (!PD_ALLOWLIST.has(code)) {
          delete verse.text[code];
          strippedPerCode[code] = (strippedPerCode[code] || 0) + 1;
        }
      }
    }
    buf = Buffer.from(JSON.stringify(chapter), 'utf8');
    chapters += 1;
  }

  writeFileSync(out, buf);
  bytesOut += buf.length;
  if (buf.length >= GZ_FLOOR && out.endsWith('.json')) {
    writeFileSync(`${out}.gz`, gzipSync(buf, { level: 9 }));
  }
  files += 1;
}

// The filter must be provably total: a single surviving occurrence of a
// stripped code's text is a failed deploy, not a warning.
let leaks = 0;
for (const file of walk(dest)) {
  if (!file.endsWith('.json') || !relative(dest, file).startsWith('chapters/')) continue;
  const chapter = JSON.parse(readFileSync(file, 'utf8'));
  for (const verse of Object.values(chapter.verses || {})) {
    for (const code of Object.keys(verse.text || {})) {
      if (!PD_ALLOWLIST.has(code)) leaks += 1;
    }
  }
}
if (leaks > 0) {
  console.error(`deploy-pd-filter: FAILED — ${leaks} non-allowlisted texts survived`);
  process.exit(1);
}

const kb = n => Math.round(n / 1024);
console.log(
  `deploy-pd-filter: ${files} files (${chapters} chapters), ` +
  `${kb(bytesIn)}KB → ${kb(bytesOut)}KB; stripped: ` +
  (Object.keys(strippedPerCode).length
    ? Object.entries(strippedPerCode).map(([c, n]) => `${c}=${n}`).join(' ')
    : 'nothing') +
  `; verified zero non-PD texts in output`
);
