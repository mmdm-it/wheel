#!/usr/bin/env node
// THE AUDIT BOARD — which document is due, and which are lying about it.
//
//   node scripts/audit-board.mjs            # this repository
//   node scripts/audit-board.mjs ../wheel-cargo
//
// WF-13 says an audit reads ONE document against ONE question, once a session,
// and that the board names which document is next so skipping is visible
// rather than silent. It has never had anything to name it WITH, so the choice
// was made by eye and the rotation drifted — fourteen days, in the case that
// prompted this.
//
// ── AND THE STAMP CAN LIE, WHICH IS THE PART WORTH AUTOMATING ───────────────
// A document carries `Last audited: <date> — Q<n>`. That date says when it was
// READ. It says nothing about when it was WRITTEN, and the two came apart
// twice in two days with the same result both times:
//
//   the corpus's proofread suite — stamped the 13th, rewritten on the 26th,
//   its far end still defining `proofread` by a four-part suite the rewrite
//   had retired;
//   the engine's architecture — stamped the 20th, its checklist still asking
//   for a per-volume manifest that a ruling had deleted months before.
//
// Both read perfectly well in isolation. Both contradicted their own other
// half. That is what an edit lands: it corrects where the writer is looking
// and leaves the far end teaching the retired thing with fresh authority.
//
// So this compares the STAMP against the file's last commit, and a document
// edited since it was read is flagged — not because the edit was wrong, but
// because the stamp is now a claim nobody has checked.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] || here);
const docs = path.join(root, 'docs');
if (!existsSync(docs)) { console.error(`audit-board: no docs/ under ${root}`); process.exit(1); }

const STAMP = /Last audited:\s*(\d{4}-\d{2}-\d{2})[^—\n]*—\s*Q(\d)/;
const QUESTIONS = {
  1: 'does it contradict ITSELF?',
  2: 'does it contradict ANOTHER document?',
  3: 'does it assert a STATE that is now false?',
  4: 'does it use VOCABULARY a later ruling abolished?',
  5: 'does it describe something UNIMPLEMENTED with no numbered item?',
  6: 'does its prose carry UNDATED state assertions?',
};

const lastCommit = rel => {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', rel],
      { cwd: root, encoding: 'utf-8' }).trim() || null;
  } catch { return null; }
};

// GENERATED PROJECTIONS ARE NOT AUDITED, they are REGENERATED. The ledger
// index is a byte copy of a file outside both repositories and is verified by
// its own builder; reading it against a standing question would be reading the
// ledger, which is not a document under docs/ and has its own discipline.
const GENERATED = new Set(['LEDGER-INDEX.md']);

const rows = [];
for (const name of readdirSync(docs).filter(f => f.endsWith('.md') && !GENERATED.has(f))) {
  const m = STAMP.exec(readFileSync(path.join(docs, name), 'utf-8'));
  const edited = lastCommit(path.join('docs', name));
  rows.push({ name, audited: m ? m[1] : null, q: m ? Number(m[2]) : null, edited });
}

// Never read first, then oldest read first: the rotation's own order.
rows.sort((a, b) => (a.audited ? 1 : 0) - (b.audited ? 1 : 0)
  || String(a.audited).localeCompare(String(b.audited)));

console.log(`audit board — ${path.basename(root)}\n`);
for (const r of rows) {
  const stale = r.audited && r.edited && r.edited > r.audited;
  console.log(`  ${r.name.padEnd(30)} ${r.audited ? `read ${r.audited} Q${r.q}` : 'NEVER READ     '}`
    + `  edited ${r.edited ?? '?'}${stale ? '   ← EDITED SINCE IT WAS READ' : ''}`);
}
const first = rows[0];
const next = first?.q ? (first.q % 6) + 1 : 1;
console.log(`\nNEXT: ${first?.name} — Q${next}: ${QUESTIONS[next]}`);
const lying = rows.filter(r => r.audited && r.edited && r.edited > r.audited);
console.log(`${rows.length} documents; ${lying.length} edited since they were last read.`);
if (lying.length) {
  console.log('A stamp older than the edit is a claim nobody has checked —');
  console.log('both contradictions found this week were exactly that.');
}
