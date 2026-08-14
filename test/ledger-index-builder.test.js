// THE BUILDER'S TRIPWIRES, FIRED (W-80). Wilbur's standard: a check is tested
// by firing it, not by reading it. These tests aim the builder's --validate
// mode at fixture ledgers holding the defects the tripwires exist to catch —
// a copied entry, a gapped series, a sidebar transcript quoting a heading —
// and assert the refusals, the warnings, and above all that NOTHING is
// written. The validate mode is the wall-crossable face of this builder;
// if it ever writes, it can no longer be verified from the other side.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = 'scripts/build-ledger-index.mjs';
const INDEX = path.join(root, 'docs/LEDGER-INDEX.md');

const entry = (id, title, status) =>
  `### ${id} · ${title}\n**Raised:** 2026-08-14 · **Status: ${status}**\n\nBody.\n\n`;

// Runs the builder and returns { code, stdout, stderr } — stderr is captured
// on success too, which is where the gap WARNINGs live.
function run(args, env) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root, encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('build-ledger-index --validate (W-80: read-only by construction)', () => {
  let dir, ledger, archives, indexBefore;

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'ledger-fixture-'));
    ledger = path.join(dir, 'HANDOFF.md');
    archives = path.join(dir, 'handoff_archives');
    mkdirSync(archives);
    writeFileSync(ledger,
      entry('W-1', 'first', 'OPEN') + entry('W-2', 'second', 'CLOSED')
      + entry('O-1', 'engine first', 'OPEN'));
    indexBefore = readFileSync(INDEX, 'utf-8');
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  const env = () => ({ WHEEL_LEDGER: ledger, WHEEL_LEDGER_ARCHIVES: archives });

  it('clean fixture: exit 0, says nothing was written, and nothing was', () => {
    const r = run(['--validate'], env());
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /nothing written/);
    assert.equal(readFileSync(INDEX, 'utf-8'), indexBefore);
  });

  it('an entry in both live and archive: exit 1, REFUSING, naming the id', () => {
    writeFileSync(path.join(archives, 'HANDOFF-ARCHIVE-test.md'),
      entry('W-2', 'second', 'CLOSED'));
    const r = run(['--validate'], env());
    assert.equal(r.code, 1);
    assert.match(r.stderr, /REFUSING/);
    assert.match(r.stderr, /W-2/);
    assert.equal(readFileSync(INDEX, 'utf-8'), indexBefore);
    rmSync(path.join(archives, 'HANDOFF-ARCHIVE-test.md'));
  });

  it('the same file renamed off the contract: ignored entirely', () => {
    // The archive dir holds sidebar transcripts that QUOTE headings; reading
    // them as entries would invent numbers nobody filed. The filename is the
    // contract: only HANDOFF-ARCHIVE*.md is scanned.
    writeFileSync(path.join(archives, 'SIDEBAR-not-an-archive.md'),
      entry('W-2', 'second', 'CLOSED') + entry('H-999', 'never filed', 'OPEN'));
    const r = run(['--validate'], env());
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /3 entries parsed/);
    rmSync(path.join(archives, 'SIDEBAR-not-an-archive.md'));
  });

  it('a gapped series: warns loudly, does not refuse', () => {
    writeFileSync(path.join(archives, 'HANDOFF-ARCHIVE-gap.md'),
      entry('O-5', 'far ahead', 'CLOSED'));
    const r = run(['--validate'], env());
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stderr, /WARNING: O-2 is missing/);
    assert.match(r.stderr, /WARNING: O-4 is missing/);
    rmSync(path.join(archives, 'HANDOFF-ARCHIVE-gap.md'));
  });

  it('input overrides without --validate: refused, not ignored', () => {
    const r = run([], env());
    assert.equal(r.code, 1);
    assert.match(r.stderr, /REFUSING/);
    assert.match(r.stderr, /canonical ledger/);
    assert.equal(readFileSync(INDEX, 'utf-8'), indexBefore);
  });
});
