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

**This is the ENGINE repository — the app.** The corpus lives in the data
repository beside it, and \`data/\` is a window into that tree. The two are kept
apart because one is public and the other is not: the engine ships under an
open licence, the corpus does not. THAT boundary is enforced by what gets
committed where, and it is the only wall left.

**There used to be a second wall, between two SESSIONS** — Orville held the
engine, Wilbur held the corpus, and neither could write to the other's tree.
Howell ended that on 2026-08-25 (O-99), after the project had spent months at
roughly 95% housekeeping: one session now works in both repositories. The
guard hook, the acceptance matrix, the canaries and the second credential are
gone. If you find an instruction anywhere telling you not to commit to "your
brother's repository", it is a leftover and it is wrong.

**Authority: \`WORKFLOW.md\` in this repository is the standing operating
procedure. This file is a generated projection of its rules** — the copy that
cannot go unread, not a second authority. If they disagree, WORKFLOW.md is
right and this file needs regenerating:
\`node scripts/build-claude-md.mjs\`. The suite fails on drift.

**Open every session with the board (WF-4):** open PRs oldest first, branches
carrying commits with no PR, and main green — in BOTH repositories. If
anything is open, clearing it IS the work. The ledger lives at
\`/media/howell/dev_workspace/team_communication/LEDGER.md\` — one line per
number — outside both repositories; each carries a verified copy at
\`docs/LEDGER-INDEX.md\` (refresh it with
\`node scripts/build-ledger-index.mjs\` after any ledger change; \`--check\`
proves the copy has not drifted).

**Say the thing, not the number.** Howell asked for this on 2026-08-24: the
\`W-\`, \`O-\` and \`WF-\` ids mean nothing to him, and citing one at him makes him
open a file to follow his own project. They belong in commits and code
comments, where they are for whoever runs \`git blame\` in a year. In
conversation with him, write the sentence out.

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
