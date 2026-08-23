#!/usr/bin/env node
// BUILD-LEDGER-INDEX — copy the ledger into this repository, and verify it.
//
//   node scripts/build-ledger-index.mjs           # copy + verify
//   node scripts/build-ledger-index.mjs --check   # verify only; exit 1 on drift (CI)
//   node scripts/build-ledger-index.mjs --validate  # the same, under the name
//                                                   # the wall knows (see below)
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
// The ledger lives OUTSIDE both repositories, in team_communication, so that
// either session can file its own numbers without crossing the wall (WF-15).
// Git cannot see it from in here, and WF-16's commit gate must check that a
// CITED NUMBER EXISTS rather than merely looks like one. So each repository
// carries a copy, and the gate reads the copy.
//
// ── WHAT CHANGED, AND WHY IT MATTERS (W-139, ruled 2026-08-23) ───────────────
// This script used to PARSE 13,322 lines of ledger prose and project them
// into a table. It no longer parses anything. The ledger IS the table now,
// hand-maintained, one line per number — so this copies it and checks the
// copy is faithful.
//
// The change is not cosmetic. The old parser was line-oriented, and a status
// line that WRAPPED —
//     **Status: SUPERSEDED
//     BY W-38 (2026-08-05).**
// — gave it "SUPERSEDED" with the successor on the next line, which it never
// read. Two rows shipped that way, and a supersession that cannot name what
// superseded it cannot be followed (WF-6). Orville found both at the
// conversion. A copier cannot make that mistake, because a copier does not
// interpret: THE ONE JOB IS FIDELITY, and fidelity is checkable.
//
// ── THE VERIFICATION, which is the point ─────────────────────────────────────
// Byte-identical, plus a shape check on every row, plus the vocabulary. If
// this repository's copy has drifted from the ledger — hand-edited, half
// merged, stale by a commit — CI says so and refuses.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = process.env.LEDGER
  ?? path.resolve(root, '..', 'team_communication', 'LEDGER.md');
const COPY = path.join(root, 'docs', 'LEDGER-INDEX.md');
// `--validate` IS THE WALL'S NAME FOR THIS FACE, AND IT MUST KEEP WORKING.
//
// Both repositories' `guard-brother-tree.cjs` open a door for this script BY
// NAME, and only when `--validate` rides in the same command segment as an
// exact token (H-9's conditional allowlist; W-80's cells pin it). The hook's
// own refusal says why: "the brother's builder crosses only in its read-only
// face … the bare call is write mode and stays refused."
//
// W-139 renamed that face to `--check` and did not tell the wall. The result
// is a door that opens onto a WRITE: a verifier crossing the wall exactly as
// documented runs `… build-ledger-index.mjs --validate`, this script sees no
// `--check`, and copies — overwriting the brother's index from across the
// wall, with the hook's blessing. A wall that fails OPEN is worse than no
// wall, because it is trusted.
//
// So the two spellings are one flag. `--check` is the honest name of what it
// does; `--validate` is the name the wall already knows, kept as a synonym
// rather than editing two hooks and their cells to chase a rename. The rule
// this teaches: a flag a guard names is part of that guard's contract, and
// renaming it is a change to the guard.
const check = process.argv.includes('--check') || process.argv.includes('--validate');

if (!existsSync(LEDGER)) {
  // A missing ledger is not a silent pass. In CI the sibling checkout may
  // simply not be there — say which, and let the caller decide.
  console.error(`build-ledger-index: no ledger at ${LEDGER}`);
  console.error('  Set LEDGER=<path> or check out team_communication beside this repository.');
  process.exit(1);
}

const source = readFileSync(LEDGER, 'utf-8');

// ── THE SHAPE, checked on every row ──────────────────────────────────────────
// Five statuses and only five; a supersession NAMES its successor; an id is
// H-, W- or O- and a number. A row that fails any of these is a defect in the
// ledger itself, and this is the only instrument that reads every row.
const ROW = /^\| ([HWO]-\d+) \| ([^|]+?) \| ([^|]*) \| (.+?) \|$/;
const STATUS = /^(RULED|DONE|OPEN|DECLINED|SUPERSEDED BY [HWO]-\d+)$/;
const rows = [];
const faults = [];
for (const [i, line] of source.split('\n').entries()) {
  if (!line.startsWith('| ') || line.startsWith('| id ') || line.startsWith('|---')) continue;
  const m = ROW.exec(line);
  if (!m) { faults.push(`line ${i + 1}: not a ledger row — ${line.slice(0, 60)}`); continue; }
  const [, id, status, , title] = m;
  if (!STATUS.test(status.trim())) faults.push(`${id}: status "${status.trim()}" is not one of the five`);
  if (status.trim() === 'OPEN' && !/—/.test(title)) faults.push(`${id}: OPEN without saying why (the title must name it)`);
  rows.push(id);
}
const dupes = rows.filter((id, i) => rows.indexOf(id) !== i);
if (dupes.length) faults.push(`duplicate row(s): ${[...new Set(dupes)].join(', ')}`);

if (faults.length) {
  console.error(`build-ledger-index: ${faults.length} fault(s) in ${LEDGER}`);
  for (const f of faults.slice(0, 20)) console.error(`  ${f}`);
  process.exit(1);
}

const current = existsSync(COPY) ? readFileSync(COPY, 'utf-8') : null;
if (check) {
  if (current !== source) {
    console.error('build-ledger-index: docs/LEDGER-INDEX.md has DRIFTED from the ledger.');
    console.error('  Run `node scripts/build-ledger-index.mjs` and commit the result.');
    process.exit(1);
  }
  console.log(`ledger index: ${rows.length} numbers, copy is faithful`);
} else {
  if (current !== source) writeFileSync(COPY, source);
  console.log(`ledger index: ${rows.length} numbers copied from ${LEDGER}`);
}
