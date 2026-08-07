// CLAUDE.md IS A PROJECTION — R4, Howell 2026-08-07. Engine twin of cargo's
// generator (theirs came first; the preamble differs, the mechanism is the
// same, deliberately).
//
// The harness loads a repository's CLAUDE.md into every session at startup —
// the mechanical fix for "nobody opens WORKFLOW.md at session start". But two
// copies of one truth is how the 200/467-line spec happened, so the rules
// block is GENERATED from WORKFLOW.md, never hand-edited, and
// test/claude-md.test.js fails the suite if the block drifts from its source.
// Same doctrine as LEDGER-INDEX.md and the seating charts: a projection
// editable independently of its source is a lie waiting.
//
//   node scripts/build-claude-md.mjs        regenerate CLAUDE.md in place
//
// WORKFLOW.md lives HERE — the engine repo is the SOP's home — so unlike the
// cargo twin there is no cross-wall read and no fallback path hunt.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(root, 'WORKFLOW.md');

// Every `- **WF-n. …` bullet with its indented continuation lines, verbatim.
// Identical to the cargo twin's extractor by intention: two projections of
// one source must agree on what a rule IS.
export function extractRules(workflowText) {
  const lines = workflowText.split('\n');
  const out = [];
  let taking = false;
  for (const line of lines) {
    if (/^- \*\*WF-\d+/.test(line)) { taking = true; out.push(line); continue; }
    if (taking) {
      if (/^(- |\*Origin|## |---)/.test(line)) { taking = false; continue; }
      out.push(line);
    }
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}

export const BEGIN = '<!-- WF-RULES:BEGIN — generated from WORKFLOW.md by scripts/build-claude-md.mjs. Do not hand-edit this block. -->';
export const END = '<!-- WF-RULES:END -->';

export function render(rules) {
  return `# CLAUDE.md — wheel (the engine)

**This is the ENGINE repository. It belongs to the Orville session** (WF-15:
do not commit to your brother's repository; commits here require
\`WHEEL_SESSION=orville\`). The data repository is Wilbur's, \`data/\` is a
read-only window into it, and access across the wall is READ ONLY, both ways.

**Authority: \`WORKFLOW.md\` in this repository is the standing operating
procedure. This file is a generated projection of its rules** — the copy that
cannot go unread, not a second authority. If they disagree, WORKFLOW.md is
right and this file needs regenerating:
\`node scripts/build-claude-md.mjs\`. The suite fails on drift.

**Open every session with the board (WF-4):** open PRs oldest first, branches
carrying commits with no PR, in BOTH repositories, and the canaries green —
and if anything is open, clearing it IS the work. The ledger lives at
\`/media/howell/dev_workspace/team_communication/HANDOFF.md\`, outside both
repositories; its index projection is \`docs/LEDGER-INDEX.md\` (regenerate
with \`node scripts/build-ledger-index.mjs\` after any ledger change).

## The rules

${BEGIN}
${rules}
${END}
`;
}

if (process.argv[1] && process.argv[1].endsWith('build-claude-md.mjs')) {
  const rules = extractRules(readFileSync(WORKFLOW, 'utf-8'));
  const count = (rules.match(/^- \*\*WF-\d+/gm) || []).length;
  writeFileSync(path.join(root, 'CLAUDE.md'), render(rules));
  console.log(`CLAUDE.md: ${count} WF- rules projected from WORKFLOW.md`);
}
