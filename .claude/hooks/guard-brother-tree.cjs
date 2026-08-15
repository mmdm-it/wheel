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
//
// H-9 (2026-08-08) adds cross-wall EXECUTION as a third refusal: an
// interpreter aimed at a script inside the brother's tree is denied unless
// that script is on a named allowlist of read-only instruments.
//
// THE RESIDUAL, RECORDED RATHER THAN DISCOVERED (H-9 item 3). This allowlist
// is a TRIPWIRE, NOT A PROOF. It reads command text, so it can be walked
// around by anyone who wants to — a copied script, an indirection through a
// shell variable, an interpreter spelled a way this regex does not know. It
// exists to make the wrong move fail loudly and leave a mark, not to make it
// impossible. The actual guarantees are elsewhere and are the ones to trust:
// the server-side per-repository PATs, which refuse the crossing where no
// local process can reach; and both brothers' review of every commit to any
// script that crosses. Adding an entry to the allowlist is a deliberate act
// needing that review, because every entry is a door.
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

  var bases = [BROTHER_ABS, BROTHER_SIBLING, DATA_LINK];
  function inBrotherTree(abs) {
    for (var b = 0; b < bases.length; b += 1) {
      if (abs === bases[b] || abs.indexOf(bases[b] + path.sep) === 0) return true;
    }
    return false;
  }

  // ── File tools: resolve the path, refuse if it lands in the tree ────────
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
    var fp = ti.file_path || ti.notebook_path || '';
    var resolved = path.resolve(ROOT, fp);
    if (inBrotherTree(resolved)) {
      console.error('WALL (WF-15): ' + tool + ' into the data tree is refused — access across the wall is READ ONLY. Path resolves to: ' + resolved);
      return 2;
    }
    return 0;
  }

  if (tool !== 'Bash') return 0;

  // ── H-9: CROSS-WALL EXECUTION IS DEFAULT-DENY, WITH A NAMED ALLOWLIST ───
  // The gap this closes: `node ../wheel-cargo/anything.mjs` references the
  // brother's tree and carries NO write shape, so every check below passed it
  // as a read — while the interpreter it starts can write anything it can
  // reach. Reads across the wall are allowed by design; EXECUTION is not, and
  // the two were indistinguishable to a regex reading command text.
  //
  // Default-deny applied to execution: an interpreter aimed at a script INSIDE
  // the brother's tree is refused unless that script is a named read-only
  // verification instrument. Today the list is one entry. Adding to it is a
  // deliberate act requiring both brothers' review (H-9 item 3), because every
  // entry is a door.
  //
  // Scope, stated so it is not mistaken for more than it is: this tests the
  // interpreter's TARGET SCRIPT. `node -e '…'` reading cargo files is not an
  // invocation *into* the tree and is governed by the write-shape rules below,
  // as before.
  var EXEC_ALLOWLIST = ['wall-matrix.mjs'];
  // THE CONDITIONAL DOOR (W-80; Howell's word in-session 2026-08-14, applied
  // by his own hand after the harness's classifier refused the session
  // editing its own wall). The brother's ledger-index builder crosses ONLY
  // in its read-only face: the same command SEGMENT must carry --validate.
  // The bare name never joins the allowlist above — a basename cannot see
  // flags, and the bare call is write mode. Each interpreter invocation is
  // judged on its own segment, so a chained validate-then-bare refuses
  // whole: the bare segment fails and exit 2 kills the entire command.
  //
  // A NEWLINE ENDS A SEGMENT (O-57). The first cut knew only `;&|`, so a
  // bare call ran to end-of-string and passed whenever --validate appeared
  // anywhere later — including a plain two-line block with the bare call
  // first and a legitimate validate call second. That is a habit, not an
  // attack, which is what made it dangerous. Found by the brother on
  // review, reproduced here under both node versions before it was
  // believed, and held red in the matrix until this line changed.
  //
  // AND THE FLAG MUST BE AN ARGUMENT, NOT MERELY TEXT (O-59). The first two
  // cuts asked "does --validate appear in this span", which is the wrong
  // question: a trailing shell comment (`# remember --validate`) or a quoted
  // argument that merely mentions the flag both satisfied it, and the builder
  // then ran in WRITE mode because argv carried no such flag. The separator
  // fix of O-57 and this are one bug in two costumes — both came of matching
  // text where the question was about arguments. So the segment is SCRUBBED
  // of quoted spans and of a trailing comment, then TOKENISED, and the flag
  // must be present as an exact token.
  //
  // Deliberately conservative: `node b.mjs "--validate"` is refused though
  // the shell would pass it. Over-refusing an odd spelling beats
  // under-refusing a habit, and the honest spelling is one character shorter.
  var CONDITIONAL_EXEC = { 'build-ledger-index.mjs': '--validate' };
  function carriesFlag(segment, flag) {
    var scrubbed = segment
      .replace(/'[^']*'/g, ' ')      // quoted spans are text, not arguments
      .replace(/"[^"]*"/g, ' ')
      .replace(/#[^\n]*/g, ' ')      // a trailing comment is not an argument
      .replace(/[()`]/g, ' ');       // `$(… --validate)` — punctuation is not
                                     // part of the token, and stripping it
                                     // cannot admit inert text: quotes and
                                     // comments are already gone.
    var toks = scrubbed.split(/\s+/);
    for (var t = 0; t < toks.length; t += 1) if (toks[t] === flag) return true;
    return false;
  }
  var INTERPRETERS = '(node|nodejs|npx|python|python3|perl|ruby|sh|bash|zsh|deno|bun)';
  var execRe = new RegExp('(^|[\\s;&|(])' + INTERPRETERS + '\\s+((?:-\\w+\\s+)*)([^\\s;&|<>]+)', 'g');
  var hit;
  while ((hit = execRe.exec(cmd)) !== null) {
    var target = hit[4].replace(/^["']|["']$/g, '');
    if (target.charAt(0) === '-') continue;          // a flag, not a script
    var targetAbs = path.resolve(ROOT, target);
    if (!inBrotherTree(targetAbs)) continue;
    if (EXEC_ALLOWLIST.indexOf(path.basename(targetAbs)) !== -1) continue;
    var cond = CONDITIONAL_EXEC[path.basename(targetAbs)];
    if (cond) {
      var rest = cmd.slice(execRe.lastIndex);
      var segEnd = rest.search(/[;&|\n]/);
      var segment = segEnd === -1 ? rest : rest.slice(0, segEnd);
      if (carriesFlag(segment, cond)) continue;
      console.error('WALL (WF-15, H-9, W-80): the brother\'s builder crosses only in its read-only face — this command segment must carry --validate. The bare call is write mode and stays refused. Target: ' + targetAbs);
      return 2;
    }
    console.error('WALL (WF-15, H-9): executing a script inside the brother\'s tree is refused — cross-wall execution is default-deny. Target: ' + targetAbs
      + '\n  Allowed instruments: ' + EXEC_ALLOWLIST.join(', ')
      + '\n  Reads are permitted; running his code is not. If you need a measurement, write it on YOUR side and read his data.');
    return 2;
  }

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
