#!/usr/bin/env node
// THE WALL'S BASH LAYER, v10-PORTABLE (W-46). The .mjs original died at its
// first `import` under the system node (v10) — exit 1, which the harness
// treats as a NON-blocking error, so a desktop-launched session's wall was
// decoration. A guard should be the most portable thing in the repository:
// CommonJS, nothing newer than v10 (no ?., no ??), and FAIL CLOSED — one
// try/catch at the bottom converts every throw to exit 2. A guard that
// errors blocks; the annoyance is the feature (the invisible failures were
// the ones that cost us).
//
// Logic is the .mjs twin's, unchanged: reads pass, writes refuse, in every
// spelling (WF-15 — the wall is read-only, not opaque). Coverage is proven
// by scripts/wall-matrix.mjs, including under /usr/bin/node explicitly.
'use strict';
var fs = require('fs');
var path = require('path');

function main() {
  var raw = fs.readFileSync(0, 'utf-8');
  // Unparseable stdin THROWS on purpose — swallowing it was fail-open in
  // miniature (Wilbur's field note 2).
  var input = JSON.parse(raw);
  var tool = input.tool_name || '';
  var ti = input.tool_input || {};

  var ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  var BROTHER_ABS = '/media/howell/dev_workspace/wheel-cargo';
  var BROTHER_SIBLING = path.resolve(ROOT, '..', 'wheel-cargo');
  var DATA_LINK = path.join(ROOT, 'data');

  // THE CANARY, BEFORE EVERYTHING (field note 3): its whole job is to prove
  // this hook is loaded and firing, so it must not sit behind the reference
  // regexes it exists to vouch for. Bare substring, first thing after parse.
  var cmd = tool === 'Bash' ? String(ti.command || '') : '';
  if (cmd.indexOf('WALL_CANARY') !== -1) {
    console.error('WALL CANARY: the hook is loaded and firing. This refusal is the proof you asked for.');
    return 2;
  }

  // ── File tools: resolve the path, refuse if it lands in the tree ────────
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
    var fp = ti.file_path || ti.notebook_path || '';
    var resolved = path.resolve(ROOT, fp);
    var bases = [BROTHER_ABS, BROTHER_SIBLING, DATA_LINK];
    for (var i = 0; i < bases.length; i += 1) {
      if (resolved === bases[i] || resolved.indexOf(bases[i] + path.sep) === 0) {
        console.error('WALL (WF-15): ' + tool + ' into the data tree is refused — access across the wall is READ ONLY. Path resolves to: ' + resolved);
        return 2;
      }
    }
    return 0;
  }

  if (tool !== 'Bash') return 0;

  // References the brother's tree? `data/` counts only at a path-token start
  // — test/fixtures/data/… is OUR tree.
  var absEsc = BROTHER_ABS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var references = new RegExp('(^|[\\s"\'=(:])(\\.\\.\\/wheel-cargo|' + absEsc + '|data\\/)');
  if (!references.test(cmd)) return 0;

  // Write-shaped? Known recorded behaviour: `2>&1` alongside a tree
  // reference matches the redirect shape — a correct-by-doctrine false
  // positive (bias toward blocking); rephrase the read rather than loosen
  // the regex without matrix cells proving the refinement.
  var writeShapes = [
    /(^|[^<>])>{1,2}(?!&2)/,
    /\btee\b/, /\brm\b/, /\bmv\b/, /\bcp\b/, /\bmkdir\b/, /\btouch\b/,
    /\bchmod\b/, /\bchown\b/, /\bln\b/, /\btruncate\b/, /\bdd\b/,
    /\bsed\s+(-\w*\s+)*-i/, /\bperl\s+(-\w*\s+)*-i/, /\brsync\b/,
    /\btar\b[^|]*\s-?\w*x/, /\bunzip\b/,
    new RegExp('\\bgit\\b[^|]*\\s-C\\s+("?)(\\.\\.\\/wheel-cargo|' + absEsc + '|data\\b)')
  ];
  for (var j = 0; j < writeShapes.length; j += 1) {
    if (writeShapes[j].test(cmd)) {
      console.error('WALL (WF-15): this command references the data tree AND matches a write shape (' + writeShapes[j] + '). Reads pass, writes are refused — rephrase if this is genuinely a read.');
      return 2;
    }
  }
  return 0;
}

try {
  process.exit(main());
} catch (e) {
  console.error('WALL (WF-15): hook error — failing CLOSED, not open: ' + (e && e.message ? e.message : e));
  process.exit(2);
}
