// CLAUDE.md IS A PROJECTION AND MUST NOT DRIFT (R4, W-46's branch). The
// harness reads CLAUDE.md; humans edit WORKFLOW.md; this test regenerates the
// projection in memory and demands byte equality, so an edit to either file
// alone turns the suite red — which is the machinery Wilbur's cargo twin
// already proved when the WF-4 amendment landed and his drift test fired.
//
// Unlike the cargo twin this needs no skip gate: WORKFLOW.md lives in this
// repository, so the source is always reachable.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRules, render } from '../scripts/build-claude-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('CLAUDE.md is a faithful projection of WORKFLOW.md', () => {
  it('regenerating in memory reproduces the committed file byte for byte', () => {
    const workflow = readFileSync(path.join(root, 'WORKFLOW.md'), 'utf-8');
    const committed = readFileSync(path.join(root, 'CLAUDE.md'), 'utf-8');
    const expected = render(extractRules(workflow));
    assert.equal(committed, expected,
      'CLAUDE.md has drifted from WORKFLOW.md — regenerate: node scripts/build-claude-md.mjs');
  });

  it('every WF- rule in WORKFLOW.md appears in the projection', () => {
    const workflow = readFileSync(path.join(root, 'WORKFLOW.md'), 'utf-8');
    const committed = readFileSync(path.join(root, 'CLAUDE.md'), 'utf-8');
    const ids = [...workflow.matchAll(/^- \*\*(WF-\d+)/gm)].map(m => m[1]);
    assert.ok(ids.length >= 16, `expected at least 16 rules, found ${ids.length}`);
    for (const id of ids) {
      assert.ok(committed.includes(`- **${id}`), `${id} missing from CLAUDE.md`);
    }
  });

  // Wilbur's backstop, ported (cargo b781037b), for the one class the two
  // checks above cannot see. Membership catches a rule vanishing in the
  // PROJECTION; the count floor catches a plain deletion from the SOURCE.
  // Neither catches a deletion and an addition in the same breath — drop
  // WF-9, add WF-17, and the count is 16 again while the gap at 9 is
  // invisible to both. WF-11 promises these ids are never reordered and never
  // reused, so contiguous 1..n is exactly what that promise looks like when
  // it is measured.
  it('the WF- ids run contiguously from 1, as WF-11 promises', () => {
    const workflow = readFileSync(path.join(root, 'WORKFLOW.md'), 'utf-8');
    const nums = [...workflow.matchAll(/^- \*\*(WF-\d+)/gm)]
      .map(m => Number(m[1].slice(3)))
      .sort((a, b) => a - b);
    const expected = Array.from({ length: nums.length }, (_, i) => i + 1);
    assert.deepEqual(nums, expected,
      `WF- ids are not contiguous 1..${nums.length} — a rule was retired without ` +
      `its id being kept, or one was added out of sequence. Found: ${nums.join(', ')}`);
  });
});
