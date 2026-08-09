// THE DOCUMENT GATE in CI (B2, Howell 2026-08-06). The commit-msg hook fails
// at the keyboard; this stops a missing hook from skipping the rule silently.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verdict, knownIds } from '../scripts/check-doc-citations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('every commit touching docs/ cites a number that exists', () => {
  it('this branch is clean', () => {
    try {
      execFileSync(process.execPath, ['scripts/check-doc-citations.mjs'],
        { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
      assert.fail(`${err.stdout || ''}${err.stderr || ''}`.trim());
    }
  });
});

// H-1's carry-out: every gate and index that pattern-matches W-/O- learns H-.
// The failure this closes had two halves and only one was visible. Citing an
// H- ALONE was refused as citing nothing — loud. An H- riding ALONGSIDE a
// valid W-/O- was never looked at, so `docs(H-999, O-33)` passed reporting
// "cites O-33": a wrong ruling number that reads as cited, which is worse than
// an uncited commit because it answers the question the gate exists to ask.
describe('the gate knows H- (H-1 carry-out)', () => {
  const ids = knownIds();
  const doc = ['docs/PREMISE.md'];

  it('the index projection actually carries H- rows', () => {
    // Guards the half that must move first: teach the gate without teaching
    // build-ledger-index.mjs and every H- citation fails as nonexistent,
    // because the projection has no row to point at.
    const hs = [...ids].filter(i => i.startsWith('H-'));
    assert.ok(hs.length >= 12, `expected the H- series in the index, found ${hs.length}`);
  });

  it('accepts an H- that exists, alone', () => {
    assert.equal(verdict('docs(H-7): retire the catch-all', doc, ids).ok, true);
  });

  it('accepts an H- alongside a W-/O-, and names BOTH', () => {
    const v = verdict('docs(H-7, O-33): both', doc, ids);
    assert.equal(v.ok, true);
    assert.match(v.why, /H-7/, 'the H- must appear in the verdict, not be silently dropped');
    assert.match(v.why, /O-33/);
  });

  it('REFUSES a wrong H- riding alongside a real O- — the quiet half', () => {
    const v = verdict('docs(H-999, O-33): a wrong number that reads as cited', doc, ids);
    assert.equal(v.ok, false);
    assert.match(v.why, /H-999/);
  });

  it('REFUSES a wrong H- alone', () => {
    assert.equal(verdict('docs(H-999): wrong', doc, ids).ok, false);
  });

  it('still accepts WF- on sight — a rule id has no ledger entry to point at', () => {
    assert.equal(verdict('docs(WF-13): the audit rotation', doc, ids).ok, true);
  });
});
