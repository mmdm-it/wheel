// Pre-compress every shipped JSON manifest to a .json.gz sibling. The host's
// own compression layer (brotli) covers text/javascript and text/css but NOT
// application/json, so JSON manifests were shipping full-size — 1.3MB of
// uncompressed JSON on a catalog boot over cellular (iPhone probe, 2026-07-17).
// The .htaccess serves the .gz with Content-Encoding: gzip when the client
// accepts it, bypassing the host allowlist entirely.
//
// Runs after split-catalog in `npm run build`. Build output, gitignored,
// shipped by sync-to-server.sh.
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DATA_DIR = new URL('../data', import.meta.url).pathname;

// No data/ in a public engine-only checkout (W-10 — the corpus is in
// wheel-cargo). Nothing to compress; skip cleanly so the build still finishes.
if (!existsSync(DATA_DIR)) {
  console.warn('precompress-json: no data/ (corpus is in wheel-cargo, W-10) — nothing to compress.');
  process.exit(0);
}

function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { yield* walkFiles(full); continue; }
    yield full;
  }
}

// The 2048-byte floor below which a .gz is not written — and above which an
// EXISTING .gz must be re-earned every run (W-5, the stale-.gz hazard): a
// source shrunk under the floor, or deleted outright, used to orphan its
// sibling — and .htaccess serves the .gz when present, so browsers got the
// STALE copy while curl (no gzip negotiation on plain requests) got the
// truth. Every run now removes any .gz whose source is gone or under the
// floor; survivors are rewritten from the current source. Wilbur's wipe in
// sync-data-to-server.sh stays as belt-and-suspenders.
const GZ_FLOOR = 2048;

let count = 0;
let rawTotal = 0;
let gzTotal = 0;
let orphans = 0;
const jsonFiles = [];
const gzFiles = [];
for (const file of walkFiles(DATA_DIR)) {
  if (file.endsWith('.json.gz')) gzFiles.push(file);
  else if (file.endsWith('.json')) jsonFiles.push(file);
}
for (const gz of gzFiles) {
  const source = gz.slice(0, -3);
  if (!existsSync(source) || statSync(source).size < GZ_FLOOR) {
    unlinkSync(gz);
    orphans += 1;
  }
}
for (const file of jsonFiles) {
  const raw = readFileSync(file);
  // Only bother when compression actually pays (skip tiny files).
  if (raw.length < GZ_FLOOR) continue;
  const gz = gzipSync(raw, { level: 9 });
  writeFileSync(`${file}.gz`, gz);
  count += 1;
  rawTotal += raw.length;
  gzTotal += gz.length;
}
const kb = n => Math.round(n / 1024);
console.log(`precompress-json: ${count} files, ${kb(rawTotal)}KB → ${kb(gzTotal)}KB gzipped (${(rawTotal / gzTotal).toFixed(1)}x)`
  + (orphans ? `; removed ${orphans} stale .gz` : ''));
