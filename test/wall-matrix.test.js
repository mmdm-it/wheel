// THE WALL STAYS TESTED (R3, Howell 2026-08-07 — O-31). The Bash-layer guard
// is a heuristic, so its coverage is proven by the acceptance matrix, not
// asserted. This test keeps that proof in the suite: if a cell's verdict ever
// changes — a regex loosened, a spelling forgotten, the hook unwired from
// settings.json — the suite goes red rather than the wall going quiet.
//
// Skips only where no config exists (a fresh public checkout has no wall to
// test); in this repository the config is committed, so it always runs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hasConfig = existsSync(path.join(root, '.claude/settings.json'));

describe('the wall (WF-15) — every matrix cell verdicts correctly', () => {
  it('reads pass, writes block, in every spelling', { skip: hasConfig ? false : 'no wall config in this checkout' }, () => {
    try {
      execFileSync(process.execPath, ['scripts/wall-matrix.mjs'],
        { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
      assert.fail(`${err.stdout || ''}${err.stderr || ''}`.trim());
    }
  });
});
