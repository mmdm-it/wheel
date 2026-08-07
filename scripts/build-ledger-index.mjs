// THE LEDGER INDEX — generated, never hand-edited.
//
// WF-2 says every ruling earns a number. B2 (Howell, 2026-08-06) makes that
// checkable: a commit touching docs/ must cite a number, and the number must
// EXIST. But the ledger now lives in team_communication/, outside both
// repositories, so nothing in git can see it. This script projects the ledger
// into a small committed index that CI and the commit hook CAN see.
//
// It is a projection, exactly like a seating chart, and carries the same rule:
// generated and never hand-edited. A projection that can be edited
// independently of its source is a lie waiting.
//
//   node scripts/build-ledger-index.mjs
//
// Regenerate whenever the ledger gains an entry or an entry changes status.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const LEDGER = '/media/howell/dev_workspace/team_communication/HANDOFF.md';
const OUT = new URL('../docs/LEDGER-INDEX.md', import.meta.url).pathname;

if (!existsSync(LEDGER)) {
  console.error(`ledger not found at ${LEDGER}`);
  console.error('It lives outside both repositories by ruling (2026-08-06).');
  process.exit(1);
}

const text = readFileSync(LEDGER, 'utf-8');
const lines = text.split('\n');
const entries = [];

for (let i = 0; i < lines.length; i += 1) {
  const head = /^### ([WO]-\d+)\s*·\s*(.+)$/.exec(lines[i]);
  if (!head) continue;
  const [, id, title] = head;
  // Status lives in the next few lines, as **Status: X ...**
  const window = lines.slice(i + 1, i + 12).join(' ');
  const st = /\*\*Status:\s*([A-Z][A-Z ]*[A-Z]|[A-Z]+)/.exec(window);
  entries.push({
    id,
    n: Number(id.slice(2)),
    kind: id[0],
    status: (st ? st[1] : 'UNKNOWN').trim(),
    title: title.replace(/\s+/g, ' ').trim(),
  });
}

const dupes = entries.map(e => e.id).filter((v, i, a) => a.indexOf(v) !== i);
if (dupes.length) {
  console.error(`REFUSING: duplicate ids in the ledger — ${[...new Set(dupes)].join(', ')}`);
  console.error('W-/O- numbers are append-only and never reused (WF-11).');
  process.exit(1);
}

entries.sort((a, b) => (a.kind === b.kind ? a.n - b.n : a.kind < b.kind ? -1 : 1));

const stamp = new Date().toISOString().slice(0, 10);
const body = [
  '# LEDGER INDEX — generated, do not edit',
  '',
  'A projection of `team_communication/HANDOFF.md`, which lives outside both',
  'repositories and is therefore invisible to git. This index exists so that the',
  'commit gate can verify a cited number EXISTS rather than merely looking like',
  'one.',
  '',
  'Regenerate with `node scripts/build-ledger-index.mjs`. Never hand-edit: a',
  'projection editable independently of its source is a lie waiting.',
  '',
  `Generated ${stamp} from ${entries.length} entries.`,
  '',
  '| id | status | title |',
  '|---|---|---|',
  ...entries.map(e => `| ${e.id} | ${e.status} | ${e.title} |`),
  '',
].join('\n');

writeFileSync(OUT, body);
console.log(`ledger index: ${entries.length} entries -> ${OUT}`);
const byStatus = entries.reduce((m, e) => ({ ...m, [e.status]: (m[e.status] || 0) + 1 }), {});
console.log('  ' + Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  '));
