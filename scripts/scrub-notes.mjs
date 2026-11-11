#!/usr/bin/env node
// THE NOTES STAY ON THE LAN (2026-11-10, the day the public doors opened).
// The corpus writes its reasons into its data as keys beginning `_` — why a
// card looks as it does, where a drawing's measurements came from, what
// Howell said and when. The engine reads no such key (deploy-pd-filter.mjs
// already strips them from the names files and now from volume.json); a
// volume whose data goes to a public door without that filter — the
// calendar's — shipped them whole: the manifest's two long notes and a
// `_source` on every drawing's measurements. This copies a data folder
// with every note removed, and regenerates the .gz beside each JSON that
// earns one (the same floor as precompress-json.mjs, so no stale brace is
// left to be served).
//
//   node scripts/scrub-notes.mjs <srcDir> <destDir>
//
// `sources/` is never copied (fetched material, outside version control),
// and no `.json.gz` is copied from the source — each is made afresh.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, dirname, sep } from 'node:path';

export const GZ_FLOOR = 2048; // bytes — mirror precompress-json.mjs exactly

/** The value with every key beginning `_` removed, at every depth. */
export function withoutNotes(v) {
  if (Array.isArray(v)) return v.map(withoutNotes);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) out[k] = withoutNotes(x);
    return out;
  }
  return v;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { if (entry !== 'sources') yield* walk(full); }
    else yield full;
  }
}

export function scrubTree(src, dest) {
  rmSync(dest, { recursive: true, force: true });
  let files = 0, notes = 0, braces = 0;
  for (const file of walk(src)) {
    if (file.endsWith('.json.gz')) continue;
    const rel = relative(src, file);
    if (rel.split(sep)[0] === 'sources') continue;
    const out = join(dest, rel);
    mkdirSync(dirname(out), { recursive: true });
    if (file.endsWith('.json')) {
      const text = readFileSync(file, 'utf8');
      const before = JSON.parse(text);
      const after = withoutNotes(before);
      const counted = JSON.stringify(before).length - JSON.stringify(after).length;
      if (counted) notes += 1;
      // The source's own shape (one line or indented) is kept where nothing
      // was removed, so a checksum mirror sends nothing it need not.
      const buf = counted ? Buffer.from(`${JSON.stringify(after, null, text.includes('\n ') ? 1 : 0)}\n`) : Buffer.from(text);
      writeFileSync(out, buf);
      if (buf.length >= GZ_FLOOR) { writeFileSync(`${out}.gz`, gzipSync(buf, { level: 9 })); braces += 1; }
    } else {
      copyFileSync(file, out);
    }
    files += 1;
  }
  return { files, notes, braces };
}

if (process.argv[1] && /scrub-notes\.mjs$/.test(process.argv[1])) {
  const [src, dest] = process.argv.slice(2);
  if (!src || !dest) { console.error('usage: node scripts/scrub-notes.mjs <srcDir> <destDir>'); process.exit(1); }
  const r = scrubTree(src, dest);
  console.log(`scrub-notes: ${r.files} files copied, ${r.notes} with notes removed, ${r.braces} braces made -> ${dest}`);
}
