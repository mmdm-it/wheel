#!/usr/bin/env node
// THE BENCH SERVER (O-173, Howell 2026-09-21: with a cleared cache "the LAN
// version takes about 10 seconds to load, whereas the screening room only
// takes about four"). The bench was Python's built-in file server, which
// speaks HTTP/1.0: it closes the connection after every file, so a boot's
// 366 requests each opened a fresh connection — sixty rounds of connect, ask,
// receive, close over the phone's Wi-Fi — and it compressed nothing, three and
// a half times the bytes. The room's server keeps one connection open and
// serves the .gz siblings the corpus already ships. This does what the room
// does, from this directory, so the bench measures what a reader will feel.
//
//   node scripts/bench-server.mjs [port]      (default 8080; serves the repo root)
//
// - HTTP/1.1 with keep-alive, so one connection carries the whole boot.
// - A .gz sibling is served with Content-Encoding: gzip when the browser
//   accepts it and the sibling is no older than its source (the stale-.gz
//   hazard, 2026-07-17: a .gz older than its source is served to browsers and
//   not to curl, and the two disagree). Older, and the source is sent plain.
// - A text file with no sibling — the app, the styles — is compressed on the
//   fly, as the room does.
// - Cache-Control: no-store, as the LAN server always had (the C.2 Moto G
//   incident), so a phone never tests a stale bundle.
// - Follows the data/ symlink into the corpus; refuses paths above the root.
import { createServer } from 'node:http';
import { createReadStream, statSync, realpathSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://bench');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); res.end(); return; }
  let real;
  try { real = realpathSync(file); } catch { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end('not found'); return; }
  let st;
  try { st = statSync(real); } catch { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end('not found'); return; }
  if (st.isDirectory()) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }); res.end(); return; }
  const type = TYPES[path.extname(real).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Bench': 'wheel-v3 bench-server' };
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  let send = real, size = st.size;
  if (acceptsGzip && !real.endsWith('.gz')) {
    try {
      const gz = statSync(`${real}.gz`);
      if (gz.mtimeMs >= st.mtimeMs) { send = `${real}.gz`; size = gz.size; headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; }
    } catch { /* no sibling: the source goes plain */ }
  }
  // No sibling and a text file worth it (the app itself, the styles): the
  // room compresses these on the fly, so the bench does too.
  const onTheFly = acceptsGzip && !headers['Content-Encoding'] && /^(text\/|application\/(json|javascript|manifest))/.test(type) && st.size > 2048;
  if (onTheFly) { headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; }
  else headers['Content-Length'] = size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(send).on('error', () => { try { res.destroy(); } catch { /* gone */ } });
  if (onTheFly) stream.pipe(createGzip({ level: 6 })).pipe(res); else stream.pipe(res);
});
server.keepAliveTimeout = 65000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`bench-server: http://0.0.0.0:${PORT}/ serving ${ROOT} — HTTP/1.1 keep-alive, .gz siblings, no-store`);
});
