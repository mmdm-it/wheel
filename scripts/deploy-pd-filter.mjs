// deploy-pd-filter.mjs — the deploy-time public-domain filter.
//
// Builds the DEPLOYABLE copy of the gutenberg volume: every file copied
// verbatim EXCEPT the text of editions that are not cleared for publication,
// which is omitted entirely. The full corpus — third-party texts included —
// stays in the private wheel-cargo repo and the local tree; ONLY this
// filtered copy may reach the public server (HANDOFF W-10/W-11; WF-14;
// LICENSING.local.md).
//
// AMENDED 2026-08-23 (O-81): `proofread` IS NOW A GATE HERE TOO. Howell,
// asked whether the Greek editions should be cleared: "No, only proofread
// editions should be available for publishing." The paragraph below is still
// true and still the reason there are TWO gates rather than one — the
// questions differ, and neither answer implies the other — but it should no
// longer be read as saying this script ignores confirmation. It asks both:
// may we publish this, and should we publish it yet.
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
// `1200BCheb` — the Westminster Leningrad Codex, cleared by Howell on
// 2026-08-18 (O-68). The assertion is his and it is unchanged in substance:
// the Hebrew text is public domain. What changed is its NAME — W-90 minted
// the year+language codes, and this list had to be told, because a rights
// gate that survives a rename silently was never checking the identity of
// what it cleared (Wilbur's rule, O-66).
//
// `WLC` is REMOVED rather than kept beside it. Nothing in the corpus answers
// to that code any more, so leaving it would be this list asserting a licence
// for a thing that does not exist — and a stale entry on a rights list is
// exactly the kind of clutter a real mistake could hide behind. If the rename
// were ever reverted the deploy would refuse by name, loudly, which is the
// outcome to want.
const PD_ALLOWLIST = new Set(['1200BCheb']);

const GZ_FLOOR = 2048; // bytes — mirror precompress-json.mjs exactly

const [src, dest, versionArg] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: node deploy-pd-filter.mjs <srcDir> <destDir> [version]');
  process.exit(1);
}

const die = (...lines) => { for (const l of lines) console.error(l); process.exit(1); };

// The engine's own declaration of which directory is the volume. Read as text
// rather than imported: this script must run without a bundler, and importing
// volume-configs.js would drag the whole engine in behind it.
function readEngineVolumeVersion() {
  const configPath = new URL('../src/volume-configs.js', import.meta.url);
  let text;
  try { text = readFileSync(configPath, 'utf8'); } catch { return null; }
  const m = /BIBLE_VOLUME_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(text);
  return m ? m[1] : null;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { yield* walk(full); continue; }
    yield full;
  }
}

// ── 1. DERIVE: what does the volume say it contains? ───────────────────────
// The version directory is named by a DECLARATION rather than guessed, and the
// editions come from volume.json rather than from whatever folders exist.
// Reading the declaration is the point: a folder can appear without anyone
// declaring it, and that is the case this gate must not wave through.
//
// IT ASKED `manifest.json` UNTIL 2026-08-18, AND THAT FILE NO LONGER EXISTS
// (O-66). The clean slate of 2026-08-17 deleted it with the rest of the
// pre-doctrine scaffolding, so this gate died on its first line — before
// reaching the licensing check it exists to perform. It failed CLOSED, which
// is the one mercy: exit 1, nothing written, the sync aborted. But O-56 had
// rebuilt this very gate because it was inert, and it was inert again inside
// a week. The lesson is not "restore the manifest": it is that a rights gate
// must not depend on a file nobody is maintaining for its sake.
//
// So the version comes from the ENGINE's own constant, passed in — the same
// string `volume-configs.js` fetches with. If the engine and the gate ever
// disagree about which directory is the volume, the gate is inspecting
// something the reader does not read, and that is worth failing over.
const version = versionArg || readEngineVolumeVersion();
if (!version) {
  die(
    'deploy-pd-filter: cannot determine the volume version.',
    'Pass it as the third argument, or leave src/volume-configs.js declaring',
    'BIBLE_VOLUME_VERSION so this gate can read the engine\'s own answer.'
  );
}

const volumePath = join(src, version, 'volume.json');
if (!existsSync(volumePath)) die(`deploy-pd-filter: no volume.json at ${relative(src, volumePath)}.`);
const volume = JSON.parse(readFileSync(volumePath, 'utf8'));
const declared = (volume.editions || []).map(e => e.code).filter(Boolean);
if (!declared.length) die('deploy-pd-filter: volume.json declares no editions — refusing to guess.');

// IS THIS EDITION FINISHED? (O-81.) Read from the DECLARATION, not from a
// loaded volume: this gate has been inert twice already (O-56, O-66), both
// times because it leaned on something maintained for another purpose, and
// making a rights gate need the whole reader to boot is that mistake with a
// better excuse. It also could not be tested — a fixture would have to build a
// complete leaf-and-shard corpus in order to assert a licensing rule.
//
// The definition is the engine's, restated on the raw files: an edition is
// finished when every book its own chart index declares appears in its
// `proofreadUnits`. That IS `isEditionFullyConfirmed`. Because a second
// definition of one fact is how two instruments drift apart, a cell asserts
// that the two agree on the real corpus whenever the corpus is present.
const fullyConfirmed = (code) => {
  const decl = (volume.editions || []).find(e => e && e.code === code) || {};
  if (decl.proofread === true) return true;
  const confirmed = new Set(decl.proofreadUnits || []);
  if (!confirmed.size) return false;
  const indexPath = join(src, version, 'charts', code, 'index.json');
  if (!existsSync(indexPath)) return false;
  let books;
  try { books = JSON.parse(readFileSync(indexPath, 'utf8')).books || []; } catch { return false; }
  const ids = books.map(b => (typeof b === 'string' ? b : b && b.file)).filter(Boolean);
  return ids.length > 0 && ids.every(id => confirmed.has(id));
};

// ── 3. TWO GATES, AND THEY ASK DIFFERENT QUESTIONS (O-81, Howell 2026-08-23)
//
// Asked whether the Greek editions should join the allowlist, he answered:
// "No, only proofread editions should be available for publishing." That adds
// a second gate rather than replacing the first, because LICENCE and
// CONFIRMATION are not the same question and neither implies the other:
//
//   MAY we publish this?          — the licence. A human assertion, PD_ALLOWLIST.
//   SHOULD we publish this yet?   — proofread status. A fact the DATA states.
//
// An edition that is not confirmed is EXCLUDED, quietly and by design: that is
// the normal condition of a corpus being built, and refusing the whole deploy
// over it would mean nothing ships until everything is finished. An edition
// that is not LICENSED still stops the deploy by name, because a missing
// licence is a question nobody has answered, and the loudness is the point.
//
// The order matters. Licence is checked against what we intend to PUBLISH, so
// an unconfirmed edition is never held to a licence it does not need yet.
//
// WHY THE CONFIRMATION TEST IS IMPORTED RATHER THAN REIMPLEMENTED: the engine
// already owns `isEditionFullyConfirmed`, and a rights-adjacent gate is the
// last place to keep a second definition of the same fact. Two instruments
// that agree today are two instruments that can disagree tomorrow, and this
// gate has already been inert twice (O-56, O-66) — never from a wrong answer,
// always from asking a question nobody was maintaining.
const publishable = [];
const unconfirmed = [];
for (const code of declared) {
  (fullyConfirmed(code) ? publishable : unconfirmed).push(code);
}
if (unconfirmed.length) {
  console.error(`deploy-pd-filter: ${unconfirmed.length} edition(s) NOT published — not proofread: ${unconfirmed.join(', ')}`);
  console.error('  This is O-81, not a fault: only proofread editions are available for publishing.');
}
if (!publishable.length) {
  die(
    'deploy-pd-filter: REFUSING — no declared edition is proofread, so there is nothing to publish.',
    'Publishing an empty volume would ship a reader with no text at all. Nothing was written.'
  );
}
const uncleared = publishable.filter(code => !PD_ALLOWLIST.has(code));
const cleared = publishable.filter(code => PD_ALLOWLIST.has(code));

// WHAT ACTUALLY SHIPS: proofread AND licensed. Every exclusion below asks
// this set rather than the licence list, so an edition held back for being
// unconfirmed is excluded by the same machinery — by PATH, never opened —
// that has always excluded an unlicensed one.
const PUBLISHED = new Set(cleared);
if (uncleared.length) {
  die(
    `deploy-pd-filter: REFUSING — ${uncleared.length} PROOFREAD edition(s) are not cleared for publication: ${uncleared.join(', ')}`,
    'Their text will not be deployed, and this is a LICENSING decision rather than a build step.',
    'Either add the code to PD_ALLOWLIST — asserting it is public domain or licensed for our distribution —',
    'or remove the edition from the volume. Nothing was written.'
  );
}

// An uncleared edition is excluded by PATH rather than by editing files, and
// the distinction is the point: excluded text is never OPENED, where a
// per-record strip would carry it through the process and remove it, so one
// bug ships it. That is the difference between a gate and a filter.
//
// Deliberately NOT belt-and-braces. A per-record strip would never fire while
// path exclusion works, leaving an untested guard sitting in a rights path —
// which is the disease this entire entry is about. The independent second
// layer is the output re-walk below: it reads the DESTINATION and would catch
// a leak however it arrived, sharing no reasoning with the exclusion. Two
// layers that disagree by construction beat two that agree by duplication.
// *(Wilbur's ruling on review of PR #184.)*
//
// CHARTS GO WITH THE TEXT, and the reason is not rights. A chart is groups,
// seats and utterance ids with no text in it; WF-14 gives structure away on
// purpose, and an edition's verse divisions are observable from any copy, so
// publishing one leaks nothing. But shipping a chart whose text was withheld
// leaves a container no reader can reach, kept alive for no one — and the
// only thing preventing harm would be `proofread && hasChart` keeping it off
// the shelf, which is a gate somewhere else standing in for the absence of
// the thing. So both go, under one rule and one code path. *(Wilbur's rights
// ruling, 2026-08-15, his half of the wall.)*
// DEFAULT-DENY BY DIRECTORY, not deny-what-was-declared. The first cut asked
// "is this one of the DECLARED editions the allowlist does not clear", which
// let an edition sitting on disk but absent from volume.json walk straight
// through — the declaration cannot exclude what it never mentions, and a
// stray directory of licensed text is exactly the thing that would arrive
// unannounced. Found by this rule's own chart cell, which staged an
// undeclared edition so clause 3 would not refuse first and mask it.
//
// So the question is asked of the PATH: any edition directory under text/ or
// charts/ whose code is not on the allowlist is excluded, declared or not.
const textDirOf = code => join(version, 'text', code) + sep;
const editionDirRe = new RegExp(
  `^${version.replace(/\./g, '\\.')}\\${sep}(?:text|charts)\\${sep}([^\\${sep}]+)\\${sep}`
);
const unclearedEditionOf = rel => {
  const m = editionDirRe.exec(rel);
  return m && !PUBLISHED.has(m[1]) ? m[1] : null;
};
const isUnclearedText = rel => unclearedEditionOf(rel) !== null;

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
    if (code && !PUBLISHED.has(code)) {
      die(`deploy-pd-filter: REFUSING — ${rel} carries unpublished edition ${JSON.stringify(code)}.`);
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
  if (unit.edition && !PUBLISHED.has(unit.edition)) { leaks += 1; continue; }
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
