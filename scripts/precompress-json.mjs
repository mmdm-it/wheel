// Pre-compress every shipped JSON manifest to a .json.gz sibling. The host's
// own compression layer (brotli) covers text/javascript and text/css but NOT
// application/json, so JSON manifests were shipping full-size — 1.3MB of
// uncompressed JSON on a catalog boot over cellular (iPhone probe, 2026-07-17).
// The .htaccess serves the .gz with Content-Encoding: gzip when the client
// accepts it, bypassing the host allowlist entirely.
//
// Runs after split-catalog in `npm run build`. Build output, gitignored,
// shipped by sync-to-server.sh.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DATA_DIR = new URL('../data', import.meta.url).pathname;

function* walkJson(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { yield* walkJson(full); continue; }
    if (entry.endsWith('.json')) yield full;
  }
}

let count = 0;
let rawTotal = 0;
let gzTotal = 0;
for (const file of walkJson(DATA_DIR)) {
  const raw = readFileSync(file);
  // Only bother when compression actually pays (skip tiny files).
  if (raw.length < 2048) continue;
  const gz = gzipSync(raw, { level: 9 });
  writeFileSync(`${file}.gz`, gz);
  count += 1;
  rawTotal += raw.length;
  gzTotal += gz.length;
}
const kb = n => Math.round(n / 1024);
console.log(`precompress-json: ${count} files, ${kb(rawTotal)}KB → ${kb(gzTotal)}KB gzipped (${(rawTotal / gzTotal).toFixed(1)}x)`);
