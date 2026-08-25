#!/usr/bin/env node
// BUILD-LEDGER-INDEX — copy the ledger into this repository, and verify it.
//
//   node scripts/build-ledger-index.mjs           # copy + verify
//   node scripts/build-ledger-index.mjs --check   # verify only; exit 1 on drift (CI)
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
// The ledger lives OUTSIDE both repositories, in team_communication, so that
// it belongs to neither repository rather than to both (O-99 retired the wall
// between the two sessions; the file stayed where it was).
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
// (Orville's wording, taken verbatim over mine — one text has to win, and
// byte-identity between the two copies is the property each brother's
// verification of the other rests on.)
//
// The guard hooks open a cross-wall door for this script BY NAME, and only
// when `--validate` rides in the same command segment as an invocation of it
// (H-9's allowlist; W-80's cells pin the conditional pass). W-139 renamed
// that face to `--check` and DID NOT TELL THE WALL. My first note here said
// that would make a verification door go dark — fail closed, a nuisance.
// That was wrong, and the truth is worse: the hook still ADMITS the command
// on the word `--validate`, and the script behind it, seeing no `--check`,
// would run in WRITE mode and overwrite the brother's index from across the
// wall with the hook's blessing. A wall that fails OPEN is worse than no
// wall, because it is trusted.
//
// AN UNRECOGNISED FLAG IS REFUSED, NEVER TREATED AS "no flag" — and this is
// the hole the alias did NOT close, found by Orville's own standard: he asked
// me to try to make his cell WRITE rather than watch it pass, and it wrote.
//
// `--validate=1` is admitted by the guard hook, whose test is /--validate\b/
// and whose `\b` matches at the `=`. The script's test was
// argv.includes('--validate'), which is EXACT and therefore false. Flag
// admitted by the wall, unrecognised by the script, script falls through to
// WRITE mode — the same cross-wall write we thought the alias had closed,
// through a shape neither of us tested. `--validated` does the same locally:
// a typo silently turns a VERIFICATION into a MUTATION that then reports
// success, which is the worst possible direction for a check to fail.
//
// So the two tests are made to agree by refusing anything else. The hook
// stays coarse (a tripwire); the script is exact and says so out loud.
const FLAGS = ['--check', '--validate'];
const unknown = process.argv.slice(2).filter(a => a.startsWith('-') && !FLAGS.includes(a));
if (unknown.length) {
  console.error(`build-ledger-index: unrecognised flag(s): ${unknown.join(' ')}`);
  console.error(`  This script takes ${FLAGS.join(' or ')} (verify only), or nothing (copy).`);
  console.error('  Refusing rather than guessing: a near-miss flag must never fall through to WRITE.');
  process.exit(1);
}
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
  // THE OPEN-NAMES-WHY RULE IS A FLOOR, NOT A PROOF, and saying so is the
  // point. It tests for an em-dash and nothing more, so a title reading
  // "A TITLE — that says nothing at all" passes — Orville fed it exactly
  // that at the conversion's verification, and it did. A machine cannot
  // judge whether a reason is a reason; what it can do is refuse a row that
  // did not even try. WF-21's own words about grep, turned on this check:
  // the grep is the floor, not the proof. A green run here is NOT evidence
  // that every OPEN row explains itself. Read them.
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

// ── THE SCRIPT REFUSES TO WRITE A REPOSITORY IT WAS NOT RUN FROM ────────────
// Defence in depth, and it exists because the wall FAILED OPEN for the length
// of one PR — not closed, OPEN, which is the worse direction and the one that
// gets trusted.
//
// Cargo's guard hook opens a cross-wall door for this script BY FLAG: an
// invocation of the brother's copy is admitted when `--validate` rides in the
// same command, on the model that `--validate` IS the read-only face. W-139
// renamed that face to `--check` and did not tell the wall. For one PR the
// hook therefore ADMITTED `node ../<brother>/scripts/build-ledger-index.mjs
// --validate`, the script saw no `--check`, ran in WRITE mode — and `root` is
// resolved from the SCRIPT's own location, so the file it would have
// overwritten was THE BROTHER'S index, from the other session, with the
// hook's blessing. Nobody ran it. That is luck, not design.
//
// The alias closed that instance. This closes the ACCIDENTAL crossing — the
// one that actually happened: the hook is a tripwire reasoning about a flag
// whose meaning lives in a file the hook does not control, and either
// brother can rename it again. So the script now defends itself. A write is
// refused unless the caller is standing in the repository being written;
// reading and `--check` cross freely, which is the whole point of the door.
//
// WHAT IT DOES NOT DO, stated because a guard read as more than it is
// becomes the next comfortable theory (O-33, one layer down). THIS TESTS
// WHERE THE CALLER STANDS, NOT WHO THE CALLER IS. Orville probed it at the
// verification: a process that simply `cd`s into the target repository and
// runs its own script is trusted, and writes. That is not a defect to fix —
// `cwd` is the only signal a script has, and a script cannot authenticate a
// session — but it means this stops the ACCIDENT and cannot stop a DELIBERATE
// crossing. The hook is the first layer, this is the second, neither is a
// proof, and the pair is stronger than either alone.
//
// THE OTHER HALF OF THIS REASONING LIVES IN THE HOOK, where the dependency
// actually is — `.claude/hooks/guard-brother-tree.cjs`, at the conditional
// pass. Orville's read at the verification, kept because he is right about
// where things belong: this paragraph's subject is the HOOK's contract, not
// the copier's, and it lodges here only because this file is where the wound
// happened. That is how a script becomes a diary. One such paragraph is a
// scar; a THIRD is the signal to move the wall reasoning to the hook wholly
// and leave only a pointer here.
const calledFromInside = (process.cwd() + path.sep).startsWith(root + path.sep);
if (!check && !calledFromInside) {
  console.error(`build-ledger-index: REFUSING to write ${COPY}`);
  console.error(`  This script writes the repository it lives in (${root}),`);
  console.error(`  and it was run from ${process.cwd()}.`);
  console.error('  Use --check, or run it from inside the repository it writes.');
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
