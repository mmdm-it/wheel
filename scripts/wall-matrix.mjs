#!/usr/bin/env node
// THE WALL'S ACCEPTANCE MATRIX — R3, Howell 2026-08-07 (O-31).
//
// "Because that is a heuristic, coverage is TESTED, not asserted." Every cell
// is {read, write} × {spelling} × {tool}, with an expected verdict. The
// dynamic half feeds the PreToolUse hook real stdin and checks its exit code;
// the static half lints settings.json for the deny rules the harness itself
// enforces (those cannot be exercised from here — the harness is not
// invokable — so presence is checked and the live cells are the sessions'
// own attempts, recorded in the ledger when each config is verified).
//
// Written BEFORE either config existed, so both were built against a
// definition of correct rather than asserted into existence. Wilbur runs it
// against cargo's config with his own tree arguments; each brother runs it
// against the other's config (Howell's standing assignment).
//
//   node scripts/wall-matrix.mjs [configDir] [brotherAbs] [relSpelling]
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// The traversal spelling is DERIVED from the brother path, never hardcoded —
// three cells hardcoded `../wheel-cargo`, which from cargo is its OWN tree,
// and Wilbur's cross-check run correctly reported them WRONG (his prediction,
// cell for cell). A matrix that only verdicts correctly for one repo is half
// a matrix.


const configDir = process.argv[2] || '.claude';
const BROTHER = process.argv[3] || '/media/howell/dev_workspace/wheel-cargo';
const REL = process.argv[4] || 'data/';   // the symlink spelling in THIS repo
const TRAV = `../${path.basename(BROTHER)}`;   // relative-traversal spelling, derived

// Both extensions tried (Wilbur's field note 4): .cjs is the v10-portable
// twin (W-46); .mjs was the original. A missing hook is a clean bail, not
// silent WRONG cells.
const hookPath = ['guard-brother-tree.cjs', 'guard-brother-tree.mjs']
  .map(f => path.join(configDir, 'hooks', f)).find(existsSync);
// W-46: the guard must hold under ANY node the machine can produce. Pass a
// node binary as a 4th argument (the suite passes /usr/bin/node when it
// exists) and every dynamic cell runs under it.
const NODE_BIN = process.argv[5] || process.execPath;
const settingsPath = path.join(configDir, 'settings.json');
let failures = 0;
const verdictName = v => (v ? 'BLOCK' : 'allow');

// ── Dynamic cells: the hook, fed real stdin ─────────────────────────────────
const hook = (tool, tool_input) => {
  const r = spawnSync(NODE_BIN, [hookPath], {
    input: JSON.stringify({ tool_name: tool, tool_input }),
    encoding: 'utf-8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() }
  });
  return r.status === 2;   // true = blocked
};

const cells = [
  // ── Bash reads: every spelling must PASS ──────────────────────────────
  ['Bash read, symlink spelling',  'Bash', { command: `cat ${REL}gutenberg/manifest.json` }, false],
  ['Bash read, absolute spelling', 'Bash', { command: `head -1 ${BROTHER}/gutenberg/manifest.json` }, false],
  ['Bash read, relative traversal','Bash', { command: `grep -c verses ${TRAV}/gutenberg/manifest.json` }, false],
  ['Bash read, node script over data', 'Bash', { command: `node scripts/check.mjs ${REL}gutenberg/seating/LXX.json` }, false],
  ['Bash read of OUR fixtures (data/ mid-path)', 'Bash', { command: 'cat test/fixtures/data/gutenberg/manifest.json' }, false],
  ['Bash write to OUR fixtures must stay allowed', 'Bash', { command: 'echo x > test/fixtures/data/gutenberg/tmp.json' }, false],
  // ── Bash writes: every spelling must BLOCK ────────────────────────────
  ['Bash redirect, symlink',       'Bash', { command: `echo x > ${REL}gutenberg/foo.json` }, true],
  ['Bash redirect, absolute',      'Bash', { command: `echo x >> ${BROTHER}/gutenberg/foo.json` }, true],
  ['Bash rm, relative traversal',  'Bash', { command: `rm ${TRAV}/gutenberg/foo.json` }, true],
  ['Bash cp INTO the tree',        'Bash', { command: `cp foo.json ${REL}gutenberg/` }, true],
  ['Bash mv, absolute',            'Bash', { command: `mv a.json ${BROTHER}/a.json` }, true],
  ['Bash sed -i, symlink',         'Bash', { command: `sed -i 's/a/b/' ${REL}gutenberg/manifest.json` }, true],
  ['Bash tee, absolute',           'Bash', { command: `echo x | tee ${BROTHER}/gutenberg/foo.json` }, true],
  ['Bash git -C into the tree',    'Bash', { command: `git -C ${TRAV} commit -am x` }, true],
  ['Bash rsync dest in tree',      'Bash', { command: `rsync -a out/ ${BROTHER}/gutenberg/` }, true],
  // ── File tools through the hook (belt under the harness's braces) ─────
  ['Write, symlink spelling',      'Write', { file_path: `${REL}gutenberg/foo.json`, content: 'x' }, true],
  ['Edit, absolute spelling',      'Edit',  { file_path: `${BROTHER}/gutenberg/manifest.json` }, true],
  ['Edit, relative traversal',     'Edit',  { file_path: `${TRAV}/gutenberg/manifest.json` }, true],
  ['Write to our own src stays allowed', 'Write', { file_path: 'src/main.js', content: 'x' }, false],
  ['Write to our fixtures stays allowed', 'Write', { file_path: 'test/fixtures/data/gutenberg/x.json', content: 'x' }, false],
  // ── W-46: the liveness canary blocks before any guard logic ───────────
  ['CANARY token is refused (hook is loaded and firing)', 'Bash', { command: 'echo WALL_CANARY' }, true]
];

if (!hookPath) {
  console.error(`no hook in ${configDir}/hooks (tried .cjs, .mjs)`);
  process.exit(1);
}
for (const [label, tool, tool_input, expectBlock] of cells) {
  const got = hook(tool, tool_input);
  const ok = got === expectBlock;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : 'WRONG '} ${verdictName(expectBlock).padEnd(5)} ${label}${ok ? '' : `  (got ${verdictName(got)})`}`);
}

// ── W-46: unparseable stdin FAILS CLOSED — exit 2, never a shrug ────────────
{
  const r = spawnSync(NODE_BIN, [hookPath], { input: 'not json', encoding: 'utf-8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() } });
  const ok = r.status === 2 && /failing CLOSED/.test(r.stderr || '');
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : 'WRONG '} BLOCK garbage stdin fails closed (exit 2 + marker)${ok ? '' : `  (got exit ${r.status})`}`);
}

// ── Static cells: the deny rules the harness enforces ───────────────────────
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf-8')) : null;
const deny = settings?.permissions?.deny || [];
const wantDeny = [
  `Edit(${REL}**)`, `Write(${REL}**)`,
  `Edit(${BROTHER}/**)`, `Write(${BROTHER}/**)`,
  'Write(.claude/canary/**)'   // W-46: the deny layer's own liveness probe
];
for (const rule of wantDeny) {
  const present = deny.includes(rule);
  if (!present) failures += 1;
  console.log(`${present ? '  ok  ' : 'WRONG '} deny  ${rule}${present ? '' : '  (MISSING from settings.json)'}`);
}
const hooked = JSON.stringify(settings?.hooks || {}).includes('guard-brother-tree');
if (!hooked) failures += 1;
console.log(`${hooked ? '  ok  ' : 'WRONG '} hook  PreToolUse wires guard-brother-tree`);

console.log(failures ? `\nwall matrix: ${failures} WRONG verdict(s)` : '\nwall matrix: every cell correct');
process.exit(failures ? 1 : 0);
