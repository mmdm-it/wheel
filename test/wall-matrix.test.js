// THE WALL STAYS TESTED (R3, Howell 2026-08-07 — O-31). The Bash-layer guard
// is a heuristic, so its coverage is proven by the acceptance matrix, not
// asserted. This test keeps that proof in the suite: if a cell's verdict ever
// changes — a regex loosened, a spelling forgotten, the hook unwired from
// settings.json — the suite goes red rather than the wall going quiet.
//
// TWO SKIPS, AND THE SECOND IS INVISIBLE IN A GREEN RUN (noted O-74).
//
// The first skips where no wall config exists — a fresh public checkout has
// no wall to test. That one never fires here: the config is committed.
//
// The second skips where there is no `/usr/bin/node`, and it fires on EVERY
// CI run, because the risk it guards is a property of Howell's machine (a
// desktop-launched session reaching an ancient system node) and not of a
// GitHub runner. So the 55-cell system-node matrix W-46 added is a LOCAL
// check only, and a green CI tick has never included it.
//
// Both are DECLARED skips, so they report as skipped rather than passed, and
// that is the honest form — but "reported" and "read" are different things
// when the summary line says green. Stated here so the next reader knows the
// matrix's real coverage without counting cells in a log.
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

  // W-46: the guard died under the system node (v10) with exit 1 — which the
  // harness treats as NON-blocking, so the wall failed open on any
  // desktop-launched session. This cell reruns every dynamic cell under
  // /usr/bin/node explicitly, so the next ESM-ism (or anything newer than
  // v10) turns the build red instead of the wall quiet.
  const systemNode = '/usr/bin/node';
  it('every cell still verdicts correctly under the SYSTEM node', {
    skip: (hasConfig && existsSync(systemNode)) ? false : 'no system node or no config here'
  }, () => {
    const brother = ['', 'media', 'howell', 'dev_workspace', 'wheel-cargo'].join('/');
    try {
      execFileSync(process.execPath,
        ['scripts/wall-matrix.mjs', '.claude', brother, 'data/', systemNode],
        { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
    } catch (err) {
      assert.fail(`${err.stdout || ''}${err.stderr || ''}`.trim());
    }
  });
});
