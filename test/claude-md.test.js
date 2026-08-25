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

  // A backstop for the one class the two checks above cannot see. Membership
  // catches a rule vanishing in the PROJECTION; the count floor catches a
  // plain deletion from the SOURCE. Neither catches a deletion and an
  // addition in the same breath — drop WF-9, add WF-22, and the count is
  // unchanged while the gap at 9 is invisible to both.
  //
  // CONTIGUITY WAS THE WRONG SHAPE FOR THAT, and it took a retirement to
  // show it. This cell asserted 1..n with no gaps, on the reasoning that
  // WF-11 promises ids are never reordered and never reused. It promises
  // exactly that and nothing more — it never promised no rule would ever be
  // RETIRED, and when O-99 retired four of them at once (2026-08-25) the
  // cell failed on a change that was entirely deliberate. A guard that
  // cannot tell a deliberate retirement from an accidental deletion will be
  // silenced by whoever meets it first, which is worse than not having it.
  //
  // So the gaps are DECLARED. An id in RETIRED may be absent and nothing
  // else may be; adding a rule still has to take the next free number, and
  // a rule that vanishes without being written down here still fails. The
  // list is the record of what this document used to say, which is the same
  // job the ledger does for everything else.
  const RETIRED = new Map([
    [15, 'O-99 — do not commit to your brother\'s repository'],
    [17, 'O-99 — an item closes when a NON-AUTHOR has re-run its check'],
    [18, 'O-99 — how the two sessions talk to each other'],
    [20, 'O-99 — a check is runnable by its named verifier'],
  ]);

  it('every WF- id is present or declared retired, and none is reused', () => {
    const workflow = readFileSync(path.join(root, 'WORKFLOW.md'), 'utf-8');
    const nums = [...workflow.matchAll(/^- \*\*(WF-\d+)/gm)].map(m => Number(m[1].slice(3)));

    assert.deepEqual(nums, [...nums].sort((a, b) => a - b),
      `WF- ids are out of order: ${nums.join(', ')} — WF-11 fixes an id at creation, ` +
      'so the document may be reordered but the numbers may not.');
    assert.equal(new Set(nums).size, nums.length,
      `a WF- id appears twice: ${nums.join(', ')} — ids are never reused.`);

    const live = new Set(nums);
    const highest = Math.max(...nums, ...RETIRED.keys());
    const unexplained = [];
    for (let n = 1; n <= highest; n += 1) {
      if (!live.has(n) && !RETIRED.has(n)) unexplained.push(n);
    }
    assert.deepEqual(unexplained, [],
      `WF-${unexplained.join(', WF-')} is neither in WORKFLOW.md nor declared retired above. ` +
      'A rule does not leave quietly: retire it here with the number that ruled it, or put it back.');

    const zombies = [...RETIRED.keys()].filter(n => live.has(n));
    assert.deepEqual(zombies, [],
      `WF-${zombies.join(', WF-')} is listed as retired but is still in WORKFLOW.md.`);
  });
});
