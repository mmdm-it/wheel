#!/usr/bin/env node
// DEPLOY FILTER — the CLEARED gate at the door (O-231, Howell 2026-10-28: "No
// uncleared edition should ever leave the LAN"). Every deploy of the Bible's
// data — the screening room's mirror and the public sync alike — ships the
// copy this writes, never data/gutenberg itself.
//
//   node scripts/deploy-pd-filter.mjs <data/gutenberg> <destDir> [version]
//
// WHAT CHANGED, AND WHAT IT RETIRES. Until 2026-10-28 this gate published only
// PROOFREAD editions (O-81) out of a hand-kept allowlist (O-56, the Hebrew
// alone). The CHECKED gate is open (O-229) and the licensing decision is now
// DATA: the corpus marks an edition `cleared: false`, build-volume leaves it
// out of volume.json and writes it to uncleared.json. So here: every edition
// volume.json names is published; everything else is left behind.
//
// WHAT THE COPY IS. Only the versioned folder the engine reads (the engine
// fetches nothing outside it), so the declaration, the naming kits, the
// staging area and the proofreading records never leave the LAN either. Left
// behind inside it: uncleared.json, and every charts/ text/ margin/ poetry/
// entry of an edition volume.json does not name. Rewritten: volume.json's
// shelf ("coming") names an uncleared edition by its shelf name, never its
// code; the names files lose any entry keyed by an uncleared code and every
// note (the corpus's record, never the engine's input), and a tongue with no
// published edition loses its names file. THE GUARD: the finished copy is searched for every
// uncleared code, and one found anywhere refuses the deploy.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, dirname, sep } from 'node:path';

const GZ_FLOOR = 2048; // bytes — mirror precompress-json.mjs exactly
const [src, dest, versionArg] = process.argv.slice(2);
if (!src || !dest) { console.error('usage: node deploy-pd-filter.mjs <srcDir> <destDir> [version]'); process.exit(1); }
const die = (...lines) => { for (const l of lines) console.error(l); process.exit(1); };
function readEngineVolumeVersion() {
  try { const m = /BIBLE_VOLUME_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(readFileSync(new URL('../src/volume-configs.js', import.meta.url), 'utf8')); return m ? m[1] : null; } catch { return null; }
}
function* walk(dir) { for (const entry of readdirSync(dir)) { const full = join(dir, entry); if (statSync(full).isDirectory()) yield* walk(full); else yield full; } }

const version = versionArg || readEngineVolumeVersion();
if (!version) die('deploy-pd-filter: cannot determine the volume version. Pass it as the third argument, or leave src/volume-configs.js declaring BIBLE_VOLUME_VERSION.');
const vdir = join(src, version);
const volumePath = join(vdir, 'volume.json');
if (!existsSync(volumePath)) die(`deploy-pd-filter: no volume.json at ${relative(src, volumePath)}.`);
const volume = JSON.parse(readFileSync(volumePath, 'utf8'));
const published = new Set((volume.editions || []).map(e => e?.code).filter(Boolean));
if (!published.size) die('deploy-pd-filter: volume.json declares no editions — refusing to guess.');
const sidecarPath = join(vdir, 'uncleared.json');
const sidecar = existsSync(sidecarPath) ? JSON.parse(readFileSync(sidecarPath, 'utf8')) : { codes: [], editions: [] };
const UNCLEARED = (sidecar.codes || []).filter(c => !published.has(c));
const shelfName = code => { const e = (sidecar.editions || []).find(x => x.code === code) || {}; return e.map || e.nativeName || 'in arrivo'; };

// what is left behind, by path inside the versioned folder
const EDITION_DIR = /^(charts|text|margin|poetry)[\\/]([^\\/]+)[\\/]/;
const LEGEND = /^margin[\\/]([^\\/]+)-legend\.json$/;
const leftBehind = rel => {
  if (rel === 'uncleared.json' || rel === 'uncleared.json.gz') return true;
  const m = EDITION_DIR.exec(rel); if (m && !published.has(m[2])) return true;
  const l = LEGEND.exec(rel); if (l && !published.has(l[1])) return true;
  return false;
};
// a JSON value with every key naming an uncleared code removed, and every note mentioning one
const scrub = v => {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (UNCLEARED.includes(k)) continue;
      if (k.startsWith('_')) continue;   // a note is the corpus's record, never the engine's input: none leaves (WF-14)
      out[k] = scrub(x);
    }
    return out;
  }
  return v;
};

rmSync(dest, { recursive: true, force: true });
let files = 0, omitted = 0, records = 0;
const recordsPerEdition = {};
const written = [];
for (const file of walk(vdir)) {
  if (file.endsWith('.json.gz')) continue;   // regenerated below, never copied
  const rel = relative(vdir, file);
  if (leftBehind(rel)) { omitted += 1; continue; }
  // A NAMES FILE FOR A TONGUE WITH NO PUBLISHED EDITION stays behind: the
  // Hungarian kit names the Káldi's books and nothing else.
  if (/^names[\\/].+\.json$/.test(rel)) {
    const lang = rel.replace(/^names[\\/]/, '').replace(/\.json$/, '');
    if (!(volume.editions || []).some(e => e.language === lang)) { omitted += 1; continue; }
  }
  let buf = readFileSync(file);
  if (rel === 'volume.json') {
    const v = JSON.parse(buf.toString('utf8'));
    const coming = v.display_config?.editions?.coming;
    if (coming) for (const [lang, list] of Object.entries(coming)) if (Array.isArray(list)) coming[lang] = list.map(x => (UNCLEARED.includes(x) ? shelfName(x) : x));
    buf = Buffer.from(`${JSON.stringify(v, null, 2)}\n`);
  } else if (/^names[\\/].+\.json$/.test(rel)) {
    buf = Buffer.from(`${JSON.stringify(scrub(JSON.parse(buf.toString('utf8'))), null, 1)}\n`);
  }
  const m = EDITION_DIR.exec(rel);
  if (m && m[1] === 'text' && rel.endsWith('.json')) {
    const unit = JSON.parse(buf.toString('utf8'));
    if (unit.edition && unit.edition !== m[2]) die(`deploy-pd-filter: REFUSING — ${rel} declares edition ${JSON.stringify(unit.edition)} but sits in another edition's directory.`);
    const n = Object.keys(unit.text || {}).length; records += n; recordsPerEdition[m[2]] = (recordsPerEdition[m[2]] || 0) + n;
  }
  const out = join(dest, version, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf); written.push(out);
  if (buf.length >= GZ_FLOOR && out.endsWith('.json')) writeFileSync(`${out}.gz`, gzipSync(buf, { level: 9 }));
  files += 1;
}
if (records === 0) die('deploy-pd-filter: REFUSING — ZERO text records were inspected; the copy would ship a reader with no text.');
// THE GUARD: no uncleared code anywhere in what leaves.
for (const out of written) {
  const t = readFileSync(out, 'utf8');
  const hit = UNCLEARED.find(c => t.includes(c));
  if (hit) { rmSync(dest, { recursive: true, force: true }); die(`deploy-pd-filter: REFUSING — ${relative(dest, out)} still names the uncleared ${hit}. Nothing was left written.`); }
}
console.log(`deploy-pd-filter: ${files} files, ${records} text records in ${Object.keys(recordsPerEdition).length} cleared edition(s) -> ${dest}`);
console.log(`  published: ${[...published].join(', ')}`);
console.log(`  left on the LAN: ${UNCLEARED.length ? UNCLEARED.join(', ') : '(nothing uncleared)'}; ${omitted} file(s), the declaration, naming kits and staging never copied`);
