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
});
