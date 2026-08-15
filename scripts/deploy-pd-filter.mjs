// deploy-pd-filter.mjs — the deploy-time public-domain filter.
//
// Builds the DEPLOYABLE copy of the gutenberg volume: every file copied
// verbatim EXCEPT the text of editions that are not cleared for publication,
// which is omitted entirely. The full corpus — third-party texts included —
// stays in the private wheel-cargo repo and the local tree; ONLY this
// filtered copy may reach the public server (HANDOFF W-10/W-11; WF-14;
// LICENSING.local.md).
//
// WHY IT MATTERS THAT THIS IS A SEPARATE GATE FROM `proofread`. The shelf
// gate (O-29) decides what the APP OFFERS; this decides what EXISTS ON THE
// SERVER. The corpus is fetched as JSON at predictable URLs under /data/, so
// a file the picker never lists is still a file anyone can request —
// robots.txt forbids crawling it by policy and stops no one. And the two
// questions differ: `proofread` means we finished the editorial work,
// public-domain means it is ours to give away. A licensed translation can be
// immaculately proofread and still not ours, and those are exactly the texts
// we would most want to ship.
//
// Usage: node scripts/deploy-pd-filter.mjs <src data/gutenberg> <dest dir>
//
// ─── O-56: THIS SCRIPT SPENT WEEKS INSPECTING NOTHING ────────────────────
// Both its strip pass and its leak verification tested
// `rel.startsWith('chapters/')`. H-21 deleted `gutenberg/chapters`; the
// post-migration layout (H-11) is `text/{EDITION}/{unitId}.json`. So it
// copied every file verbatim, stripped nothing, ran its leak check over a
// directory that does not exist, counted zero leaks, and exited 0 printing
// "verified zero non-PD texts in output". A rights gate reporting success
// over a vacuum.
//
// The rewrite follows Wilbur's design, and its second clause is the one that
// generalises:
//
//   1. DERIVE the layout from what volume.json DECLARES, never from a
//      hardcoded directory name. A hardcoded path is what broke it, and the
//      next layout change would break it again.
//   2. ASSERT IT RAN. If zero text records were inspected, REFUSE. A check
//      that examined nothing must never report success — that clause alone
//      would have caught this the day H-21 landed.
//   3. REFUSE on DECLARED-BUT-NOT-CLEARED. If volume.json declares an
//      edition absent from the allowlist, stop before writing anything and
//      name it. Adding a code is a LICENSING event, so an unrecognised
//      edition is a question for a human, not a text to quietly drop.
//   4. The allowlist asserts only what is true — codes for editions the
//      corpus no longer holds were removed.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, dirname, sep } from 'node:path';

// CLEARED FOR PUBLICATION. Adding a code here is a LICENSING event, not a
// convenience: it asserts the text is public domain or licensed for our
// distribution. It is deliberately short, and under clause 3 an edition that
// is missing from it stops the deploy by name rather than being silently
// dropped — so forgetting to add one is loud, and so is adding one by habit.
const PD_ALLOWLIST = new Set(['WLC']);

const GZ_FLOOR = 2048; // bytes — mirror precompress-json.mjs exactly

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: node deploy-pd-filter.mjs <srcDir> <destDir>');
  process.exit(1);
}

const die = (...lines) => { for (const l of lines) console.error(l); process.exit(1); };

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { yield* walk(full); continue; }
    yield full;
  }
}

// ── 1. DERIVE: what does the volume say it contains? ───────────────────────
// The version directory is named by the manifest rather than guessed, and the
// editions come from volume.json rather than from whatever folders exist.
// Reading the declaration is the point: a folder can appear without anyone
// declaring it, and that is the case this gate must not wave through.
const manifestPath = join(src, 'manifest.json');
if (!existsSync(manifestPath)) die(`deploy-pd-filter: no manifest.json in ${src} — cannot derive the layout.`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const root = manifest[Object.keys(manifest)[0]] || {};
const version = root?.display_config?.volume_data_version;
if (!version) die('deploy-pd-filter: the manifest declares no volume_data_version — cannot locate the volume.');

const volumePath = join(src, version, 'volume.json');
if (!existsSync(volumePath)) die(`deploy-pd-filter: no volume.json at ${relative(src, volumePath)}.`);
const volume = JSON.parse(readFileSync(volumePath, 'utf8'));
const declared = (volume.editions || []).map(e => e.code).filter(Boolean);
if (!declared.length) die('deploy-pd-filter: volume.json declares no editions — refusing to guess.');

// ── 3. REFUSE on declared-but-not-cleared, BEFORE writing anything ─────────
const uncleared = declared.filter(code => !PD_ALLOWLIST.has(code));
const cleared = declared.filter(code => PD_ALLOWLIST.has(code));
if (uncleared.length) {
  die(
    `deploy-pd-filter: REFUSING — the volume declares ${uncleared.length} edition(s) that are not cleared for publication: ${uncleared.join(', ')}`,
    'Their text will not be deployed, and this is a LICENSING decision rather than a build step.',
    'Either add the code to PD_ALLOWLIST — asserting it is public domain or licensed for our distribution —',
    'or remove the edition from the volume. Nothing was written.'
  );
}

// The text of an edition lives under text/{EDITION}/, so an uncleared edition
// is excluded by PATH rather than by editing files. Kept as a general test
// anyway: this must hold for every edition the volume does not clear, not
// only for the ones that happen to exist today.
const textDirOf = code => join(version, 'text', code) + sep;
const isUnclearedText = rel => declared.some(c => !PD_ALLOWLIST.has(c) && rel.startsWith(textDirOf(c)));

// ── copy, omitting the text of uncleared editions ──────────────────────────
let files = 0, omitted = 0, records = 0, bytesIn = 0, bytesOut = 0;
const recordsPerEdition = {};

for (const file of walk(src)) {
  if (file.endsWith('.json.gz')) continue; // regenerated below, never copied
  const rel = relative(src, file);

  if (isUnclearedText(rel)) { omitted += 1; continue; }

  const buf = readFileSync(file);
  bytesIn += buf.length;

  // ── 2. COUNT WHAT WAS ACTUALLY INSPECTED ────────────────────────────────
  // Every text record that passes through is counted, per edition. This is
  // the number the assertion below is made against, and it is measured from
  // the files themselves rather than from the declaration — so a volume that
  // declares an edition whose files are absent cannot satisfy it.
  const inTextDir = cleared.some(c => rel.startsWith(textDirOf(c)));
  if (inTextDir && file.endsWith('.json')) {
    const unit = JSON.parse(buf.toString('utf8'));
    const code = unit.edition;
    // A file's own declaration must agree with the directory it sits in;
    // disagreement means the layout and the content have drifted apart, and
    // this gate is the wrong place to reconcile them silently.
    if (code && !rel.startsWith(textDirOf(code))) {
      die(`deploy-pd-filter: REFUSING — ${rel} declares edition ${JSON.stringify(code)} but sits in another edition's directory.`);
    }
    if (code && !PD_ALLOWLIST.has(code)) {
      die(`deploy-pd-filter: REFUSING — ${rel} carries uncleared edition ${JSON.stringify(code)}.`);
    }
    const n = Object.keys(unit.text || {}).length;
    records += n;
    recordsPerEdition[code || '(undeclared)'] = (recordsPerEdition[code || '(undeclared)'] || 0) + n;
  }

  const out = join(dest, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  bytesOut += buf.length;
  if (buf.length >= GZ_FLOOR && out.endsWith('.json')) {
    writeFileSync(`${out}.gz`, gzipSync(buf, { level: 9 }));
  }
  files += 1;
}

// ── 2. ASSERT IT RAN ───────────────────────────────────────────────────────
// The clause O-56 exists for. A filter that inspected zero text records has
// proved nothing, and must not be allowed to say otherwise — whatever the
// reason, whether a renamed directory, an empty tree, or a wrong argument.
if (records === 0) {
  die(
    'deploy-pd-filter: REFUSING — ZERO text records were inspected.',
    `Cleared editions declared: ${cleared.join(', ') || '(none)'}; text expected under ${version}/text/<EDITION>/.`,
    'The filter cannot verify what it never read. This is the failure O-56 was filed for:',
    'the previous version tested a directory that no longer existed and reported success over a vacuum.'
  );
}

// ── VERIFY THE OUTPUT, not the intention ───────────────────────────────────
// The filter must be provably total: a single surviving occurrence of an
// uncleared edition's text is a failed deploy, not a warning. Re-walked from
// the destination so this tests what was WRITTEN rather than what was meant.
let leaks = 0, verified = 0;
for (const file of walk(dest)) {
  if (!file.endsWith('.json')) continue;
  const rel = relative(dest, file);
  if (isUnclearedText(rel)) { leaks += 1; continue; }
  if (!cleared.some(c => rel.startsWith(textDirOf(c)))) continue;
  const unit = JSON.parse(readFileSync(file, 'utf8'));
  if (unit.edition && !PD_ALLOWLIST.has(unit.edition)) { leaks += 1; continue; }
  verified += Object.keys(unit.text || {}).length;
}
if (leaks > 0) die(`deploy-pd-filter: FAILED — ${leaks} uncleared text file(s) survived into the output.`);
if (verified !== records) {
  die(`deploy-pd-filter: FAILED — inspected ${records} records but verified ${verified} in the output; they must agree.`);
}

const kb = n => Math.round(n / 1024);
console.log(
  `deploy-pd-filter: ${files} files copied, ${omitted} omitted as uncleared; ${kb(bytesIn)}KB → ${kb(bytesOut)}KB`
);
console.log(
  `  cleared: ${cleared.join(', ')}; records inspected AND re-verified in the output: ${records} `
  + `(${Object.entries(recordsPerEdition).map(([c, n]) => `${c}=${n}`).join(' ')})`
);
