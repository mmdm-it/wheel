// THE CONVERTER'S TRIPWIRES, FIRED (W-139, rewriting W-80's cells — W-102:
// cells are rewritten, not amended, when the doctrine under them moves).
//
// W-80's cells aimed a PARSER at fixture ledgers full of prose and asserted
// its refusals. The parser is gone. The ledger is one line per number now,
// hand-maintained, and this script's whole job is FIDELITY: copy it into this
// repository and prove the copy faithful, so WF-16's commit gate can check
// that a cited number exists.
//
// WHY THE PARSER HAD TO GO, in one defect: it was line-oriented, and a status
// line that WRAPPED —
//     **Status: SUPERSEDED
//     BY W-38 (2026-08-05).**
// — gave it "SUPERSEDED" with the successor on the next line, unread. Two rows
// shipped that way, and a supersession that cannot name what superseded it
// cannot be followed (WF-6). A copier cannot make that mistake, because a
// copier does not interpret.
//
// These cells fire the guard rather than read it (Wilbur's standard, W-80's
// one surviving principle): every one builds a deliberately defective ledger
// and asserts the refusal, AND asserts that this repository's real index was
// not touched while the defect was on the bench.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = 'scripts/build-ledger-index.mjs';
const INDEX = path.join(root, 'docs/LEDGER-INDEX.md');

const HEAD = '# THE LEDGER — one line per number\n\n| id | status | date | title |\n|---|---|---|---|\n';
const row = (id, status, title) => `| ${id} | ${status} | 2026-08-23 | ${title} |\n`;
const GOOD = HEAD
  + row('H-1', 'DONE', 'THE ROADMAP')
  + row('W-1', 'RULED', 'THE SPINE — cargo WILBUR-FORMAT.md')
  + row('O-1', 'OPEN', 'SOMETHING — and this is why it is open')
  + row('O-2', 'SUPERSEDED BY O-1', 'AN EARLIER TRY');

// AIM IT AT A FIXTURE LEDGER — and note what the second argument is FOR.
// The script's destination is fixed at this repository's docs/LEDGER-INDEX.md
// and there is no override, by design: a copier that can be pointed anywhere
// is not a copier. So a fixture run that SUCCEEDS would overwrite the real
// index with fixture rows. Every cell here therefore either expects a refusal
// (which exits before writing) or passes `--check`, which never writes at all.
// The `after` hook is the backstop, and it caught this while these cells were
// being written.
function run(ledgerText, args = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ledger-'));
  const file = path.join(dir, 'LEDGER.md');
  writeFileSync(file, ledgerText);
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root, encoding: 'utf-8', env: { ...process.env, LEDGER: file }
  });
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('the ledger converter copies, and verifies (W-139)', () => {
  let indexBefore;
  before(() => { indexBefore = readFileSync(INDEX, 'utf-8'); });
  // Every cell below aims the script at a FIXTURE ledger, so this repository's
  // own index must survive the whole suite untouched. If a defective fixture
  // could rewrite it, the guard would be the hazard.
  after(() => assert.equal(readFileSync(INDEX, 'utf-8'), indexBefore,
    'the real index was written during a fixture run'));

  it('A BARE SUPERSEDED IS REFUSED — the exact defect the parser shipped twice', () => {
    const r = run(GOOD.replace('| O-2 | SUPERSEDED BY O-1 |', '| O-2 | SUPERSEDED |'));
    assert.equal(r.code, 1, 'a supersession that names nothing cannot be followed (WF-6)');
    assert.match(r.stderr, /O-2: status "SUPERSEDED" is not one of the five/);
  });

  it('a status outside the five is refused, whatever it says', () => {
    const r = run(GOOD.replace('| H-1 | DONE |', '| H-1 | CLOSED (archived) |'));
    assert.equal(r.code, 1, 'thirty-two spellings is the disease; five is the cure');
    assert.match(r.stderr, /H-1/);
  });

  it('AN OPEN ROW THAT DID NOT EVEN TRY IS REFUSED — but the check is a floor, not a proof', () => {
    const r = run(GOOD.replace('SOMETHING — and this is why it is open', 'SOMETHING'));
    assert.equal(r.code, 1);
    assert.match(r.stderr, /OPEN without saying why/);
    // AND THE HONEST OTHER HALF, asserted so nobody reads a green check as
    // "every OPEN row explains itself": the check tests that a reason was
    // ATTEMPTED, never that it is a reason. A machine cannot judge that, and
    // this cell exists so the limit is recorded where the guard is.
    // Asked with --check, so a PASSING fixture cannot write over this
    // repository's real index — see the note on `run` below. A hollow reason
    // clears the shape pass entirely and is stopped only by drift, which is
    // the proof: no OPEN fault is raised against it.
    const weak = run(GOOD.replace('SOMETHING — and this is why it is open',
      'SOMETHING — nothing at all'), ['--check']);
    assert.doesNotMatch(weak.stderr, /OPEN without saying why/,
      'a hollow reason passes the check: WF-21\'s word about grep, true of this check too');
    assert.match(weak.stderr, /DRIFTED/, 'and is stopped, if at all, only by fidelity');
  });

  it('a duplicate id is refused — two rows for one number is two answers', () => {
    const r = run(GOOD + row('W-1', 'DONE', 'THE SAME NUMBER AGAIN'));
    assert.equal(r.code, 1);
    assert.match(r.stderr, /duplicate row\(s\): W-1/);
  });

  it('A MISSING LEDGER IS NOT A SILENT PASS', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--check'], {
      cwd: root, encoding: 'utf-8',
      env: { ...process.env, LEDGER: path.join(tmpdir(), 'no-such-ledger-31337.md') }
    });
    assert.equal(r.status, 1, 'a missing sibling checkout must say so, not report zero');
    assert.match(r.stderr, /no ledger at/);
  });

  it('--check REFUSES DRIFT with no shape fault at all — the copy is stale, nothing else', () => {
    // A ledger valid in every way, differing from this repo's copy by one
    // title. Nothing here is malformed; the only fault is that the copy is
    // not the ledger, which is the one thing this script exists to notice.
    const r = run(GOOD, ['--check']);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /DRIFTED/);
  });

  it('THIS REPOSITORY\'S OWN COMMITTED COPY OBEYS EVERY RULE — and this runs in CI, where the ledger cannot', () => {
    // The ledger lives OUTSIDE both repositories, so CI's checkout cannot see
    // it — which is the whole reason each repository carries a copy. A cell
    // that asked CI to read the ledger would be a check its runner cannot
    // run, and the first draft of this cell was exactly that: green
    // here, red on the runner.
    //
    // So point the script at the COMMITTED COPY as its own source. Source and
    // destination are then identical, fidelity is trivially satisfied, and
    // what is actually exercised is every shape rule against the rows this
    // repository will really hand to WF-16's gate.
    const r = spawnSync(process.execPath, [SCRIPT, '--check'], {
      cwd: root, encoding: 'utf-8', env: { ...process.env, LEDGER: INDEX }
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /copy is faithful/);
    assert.match(r.stdout, /\d+ numbers/);
  });

  it('--validate IS --check, BECAUSE THE WALL OPENS ITS DOOR ON THAT WORD', () => {
    // Both repositories' guard-brother-tree.cjs permit this script to be run
    // across the wall ONLY when `--validate` appears as an exact token — the
    // hook's own refusal reads "the brother's builder crosses only in its
    // read-only face … the bare call is write mode and stays refused."
    //
    // W-139 renamed that face to `--check` and told the wall nothing, so the
    // door briefly opened onto a WRITE: a verifier crossing exactly as
    // documented would have overwritten the brother's index with the hook's
    // blessing. A wall that fails OPEN is worse than none, because it is
    // trusted. This cell is what stops the synonym being tidied away later.
    const r = run(GOOD, ['--validate']);
    assert.equal(r.code, 1, 'a differing ledger must be REPORTED, never copied');
    assert.match(r.stderr, /DRIFTED/, 'it verified rather than wrote');

    // And the decisive half: under --validate it must not write, ever. The
    // suite's `after` hook proves the real index survived every cell, this one
    // included — which is the assertion that matters here.
    const faithful = spawnSync(process.execPath, [SCRIPT, '--validate'], {
      cwd: root, encoding: 'utf-8', env: { ...process.env, LEDGER: INDEX }
    });
    assert.equal(faithful.status, 0, faithful.stderr);
    assert.match(faithful.stdout, /copy is faithful/);
  });

  it('EVERY NEAR MISS OF A VERIFY FLAG IS REFUSED — a typo must not become a mutation', () => {
    // Raised by Wilbur, reproduced here on a fixture before it was believed,
    // and the reproduction found more shapes than the report named.
    //
    // The alias cell above passes while this hole is open, because it tests
    // the EXACT spelling and nothing around it. That is the blind spot worth
    // remembering: a cell that asserts the right word works says nothing
    // about the words that are nearly it.
    //
    // Each of these used to exit 0 having WRITTEN, and print "numbers copied"
    // — a verification reporting success while mutating what it was asked to
    // check. `--validate=1` additionally crossed the wall, because the hook's
    // test is /--validate\b/ and \b matches at the `=`.
    for (const flag of ['--validate=1', '--validated', '--valid', '-c', '--Check', '--check=1']) {
      const r = run(GOOD, [flag]);
      assert.equal(r.code, 1, `${flag}: refused, never downgraded to write mode`);
      assert.match(r.stderr, /unrecognised flag/, `${flag}: and it says so`);
    }
    // The two real spellings still select the read-only face...
    for (const flag of ['--check', '--validate']) {
      assert.match(run(GOOD, [flag]).stderr, /DRIFTED/, `${flag}: still verifies`);
    }
    // ...and a BARE call is still write mode, which is the script's job. The
    // fix must not turn "no flag" into a refusal — only "a flag I do not know".
    const bare = spawnSync(process.execPath, [SCRIPT, '--check'], {
      cwd: root, encoding: 'utf-8', env: { ...process.env, LEDGER: INDEX }
    });
    assert.equal(bare.status, 0, 'the ordinary path is untouched');
  });

  it('and where the ledger IS beside us, the copy is in step with it', () => {
    // True on a session's machine, absent on the runner. Skipping when the
    // sibling is missing is honest; asserting a pass would be a check that
    // measures whether it was run.
    const sibling = path.resolve(root, '..', 'team_communication', 'LEDGER.md');
    if (!existsSync(sibling)) {
      assert.ok(true, 'no team_communication beside this checkout — nothing to compare');
      return;
    }
    const r = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: root, encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /copy is faithful/);
  });
});
