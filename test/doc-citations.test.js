// THE DOCUMENT GATE in CI (B2, Howell 2026-08-06). The commit-msg hook fails
// at the keyboard; this stops a missing hook from skipping the rule silently.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
