#!/usr/bin/env node
// THE WALL'S BASH LAYER — WF-15, ruled enforceable by Howell 2026-08-07 (R3).
//
// Deny rules govern the Edit/Write tools; this hook covers what they cannot:
// Bash, and any file-path spelling that resolves into the brother's tree.
// R3's ruling: refuse WRITE-shaped references, pass READ-shaped ones — the
// wall is read-only, not opaque, because the cross-verification that caught
// every finding this week runs through read access.
//
// This is a HEURISTIC (Bash cannot be parsed by grep), so its coverage is
// TESTED, not asserted: scripts/wall-matrix.mjs feeds this hook every cell of
// the acceptance matrix and fails loudly on any wrong verdict. Bias runs
// toward blocking: a false positive costs a rephrased command; a false
// negative costs a silent write into the brother's tree.
//
// Contract: JSON on stdin {tool_name, tool_input}; exit 0 = allow,
// exit 2 = block (stderr explains to the session).
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
// The brother's tree, in every spelling this repo can reach it by. The
// SIBLING form is computed from ROOT rather than hardcoded: on the bench it
// equals the absolute form, but CI checks out at /home/runner/work/…, where
// ../wheel-cargo resolves somewhere the bench path never matches — the matrix
// caught exactly that cell going allow in CI while blocking at home.
const BROTHER_ABS = '/media/howell/dev_workspace/wheel-cargo';
const BROTHER_SIBLING = path.resolve(ROOT, '..', 'wheel-cargo');
const DATA_LINK = path.join(ROOT, 'data');       // the symlink's own spelling

let input;
try { input = JSON.parse(readFileSync(0, 'utf-8')); } catch { process.exit(0); }
const tool = input.tool_name || '';

// ── File tools: resolve the path, refuse if it lands in the tree ──────────
if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
  const fp = input.tool_input?.file_path || input.tool_input?.notebook_path || '';
  const resolved = path.resolve(ROOT, fp);
  const inTree = base => resolved === base || resolved.startsWith(base + path.sep);
  if (inTree(BROTHER_ABS) || inTree(BROTHER_SIBLING) || inTree(DATA_LINK)) {
    console.error(`WALL (WF-15): ${tool} into the data tree is refused — access across the wall is READ ONLY. Path resolves to: ${resolved}`);
    process.exit(2);
  }
  process.exit(0);
}

if (tool !== 'Bash') process.exit(0);
const cmd = String(input.tool_input?.command || '');

// Does the command reference the brother's tree at all? `data/` only counts
// when it starts a path token — `test/fixtures/data/…` is OUR tree.
const REFERENCES = new RegExp(
  String.raw`(^|[\s"'=(:])(\.\.\/wheel-cargo|${BROTHER_ABS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|data\/)`
);
if (!REFERENCES.test(cmd)) process.exit(0);

// Write-shaped? Redirections, file-mutating commands, in-place editors,
// mutating git aimed at the tree, archive extraction, sync with a dest.
const WRITE_SHAPES = [
  /(^|[^<>])>{1,2}(?!&2)/,                       // > and >> (not 2>&1's >&2)
  /\btee\b/, /\brm\b/, /\bmv\b/, /\bcp\b/, /\bmkdir\b/, /\btouch\b/,
  /\bchmod\b/, /\bchown\b/, /\bln\b/, /\btruncate\b/, /\bdd\b/,
  /\bsed\s+(-\w*\s+)*-i/, /\bperl\s+(-\w*\s+)*-i/, /\brsync\b/,
  /\btar\b[^|]*\s-?\w*x/, /\bunzip\b/,
  /\bgit\b[^|]*\s-C\s+("?)(\.\.\/wheel-cargo|\/media\/howell\/dev_workspace\/wheel-cargo|data\b)/
];
const hit = WRITE_SHAPES.find(re => re.test(cmd));
if (hit) {
  console.error(`WALL (WF-15): this command references the data tree AND matches a write shape (${hit}). Access across the wall is READ ONLY — reads pass, writes are refused. Rephrase if this is genuinely a read.`);
  process.exit(2);
}
process.exit(0);
