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
//   node scripts/build-ledger-index.mjs             regenerate the index
//   node scripts/build-ledger-index.mjs --validate  same parse, same tripwires,
//                                                   same exit codes and
//                                                   complaints; writes NOTHING
//
// Regenerate whenever the ledger gains an entry or an entry changes status.
//
// THE VALIDATE MODE EXISTS FOR THE BROTHER (W-80). A check one session writes
// for the other must be runnable by that other across a wall that stops
// writes — read-only by construction, or it is not a check, it is a request
// to take the author's word for it. --validate is this builder's read-only
// face: Wilbur fires the tripwires from his side and nothing is touched.
//
// In --validate mode ONLY, the inputs may be overridden so the tripwires can
// be fired against fixtures (a duplicated entry, a gapped series) without
// staging defects in the real ledger:
//
//   WHEEL_LEDGER=<file> WHEEL_LEDGER_ARCHIVES=<dir>
//
// Overrides outside --validate are REFUSED, not ignored: the committed
// projection is built from the canonical ledger or not at all.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const VALIDATE_ONLY = process.argv.includes('--validate');
if (!VALIDATE_ONLY && (process.env.WHEEL_LEDGER || process.env.WHEEL_LEDGER_ARCHIVES)) {
  console.error('REFUSING: WHEEL_LEDGER/WHEEL_LEDGER_ARCHIVES are honored only with --validate.');
  console.error('The committed projection is built from the canonical ledger or not at all.');
  process.exit(1);
}

const LEDGER = (VALIDATE_ONLY && process.env.WHEEL_LEDGER)
  || '/media/howell/dev_workspace/team_communication/HANDOFF.md';
// THE ARCHIVES ARE PART OF THE LEDGER (W-79a / H-24 point 5). Once pruning
// starts, settled entries move to handoff_archives/HANDOFF-ARCHIVE*.md — and a
// number that leaves this projection stops existing as far as the commit gate
// is concerned, so the next citation of H-2 would be refused by our own hook.
// The builder therefore reads live + archives, and an archived number stays
// citable forever.
//
// THE FILENAME PATTERN IS A CONTRACT: the prune script must write
// HANDOFF-ARCHIVE*.md and nothing else matches. Other files in that directory
// (the 2026-08-06 sidebar transcript) may QUOTE entry headings and must not be
// scanned as entries.
const ARCHIVE_DIR = (VALIDATE_ONLY && process.env.WHEEL_LEDGER_ARCHIVES)
  || '/media/howell/dev_workspace/team_communication/handoff_archives';
const OUT = new URL('../docs/LEDGER-INDEX.md', import.meta.url).pathname;

if (!existsSync(LEDGER)) {
  console.error(`ledger not found at ${LEDGER}`);
  console.error('It lives outside both repositories by ruling (2026-08-06).');
  process.exit(1);
}

const sources = [{ name: 'live', text: readFileSync(LEDGER, 'utf-8') }];
if (existsSync(ARCHIVE_DIR)) {
  for (const f of readdirSync(ARCHIVE_DIR).sort()) {
    if (/^HANDOFF-ARCHIVE.*\.md$/.test(f)) {
      sources.push({ name: f, text: readFileSync(`${ARCHIVE_DIR}/${f}`, 'utf-8') });
    }
  }
}

const entries = [];
for (const source of sources) {
const lines = source.text.split('\n');
for (let i = 0; i < lines.length; i += 1) {
  // H- joins W- and O- (H-1's carry-out): Howell's rulings enter the ledger
  // directly in his own numbered voice. Same doctrine — assigned at creation,
  // append-only, never renumbered, never reused. The BUILDER must learn H-
  // before the gate does: teach the gate alone and every H- citation is
  // refused as nonexistent, because the projection has no row to point at.
  const head = /^### ([WOH]-\d+)\s*·\s*(.+)$/.exec(lines[i]);
  if (!head) continue;
  const [, id, title] = head;
  // Status lives in the next few lines, as **Status: X ...**
  const window = lines.slice(i + 1, i + 12).join(' ');
  const st = /\*\*Status:\s*([A-Z][A-Z ]*[A-Z]|[A-Z]+)/.exec(window);
  entries.push({
    id,
    n: Number(id.slice(2)),
    kind: id[0],
    status: (st ? st[1] : 'UNKNOWN').trim()
      + (source.name === 'live' ? '' : ' (archived)'),
    title: title.replace(/\s+/g, ' ').trim(),
  });
}
}

// A duplicate across live+archives is Wilbur's check 4 (W-79): an entry that
// exists in both places was copied, not moved, and the projection would lie
// about which is authoritative. Refusal, not warning.
const dupes = entries.map(e => e.id).filter((v, i, a) => a.indexOf(v) !== i);
if (dupes.length) {
  console.error(`REFUSING: duplicate ids across live+archives — ${[...new Set(dupes)].join(', ')}`);
  console.error('W-/O- numbers are append-only and never reused (WF-11).');
  process.exit(1);
}

// A GAP in a series is Wilbur's check 5, and it is H-4's own injury made
// visible: an entry whose heading is destroyed keeps its body and vanishes
// from every count. Also the shape of an unfiled citation (O-47 was a gap for
// two days and nothing said so). Warn loudly; do not refuse, because the gap
// might be the finding.
for (const kind of ['W', 'O', 'H']) {
  const ns = entries.filter(e => e.kind === kind).map(e => e.n).sort((a, b) => a - b);
  for (let i = 1; i < ns.length; i += 1) {
    for (let missing = ns[i - 1] + 1; missing < ns[i]; missing += 1) {
      console.error(`WARNING: ${kind}-${missing} is missing — heading destroyed, or cited but never filed?`);
    }
  }
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

if (VALIDATE_ONLY) {
  console.log(`validate: ${entries.length} entries parsed, tripwires clean — nothing written`);
} else {
  writeFileSync(OUT, body);
}
const settled = entries.filter(e => /^(CLOSED|DONE|SUPERSEDED|DECLINED|LANDED|RULED)/.test(e.status) && !e.status.includes('archived'));
if (!VALIDATE_ONLY) console.log(`ledger index: ${entries.length} entries -> ${OUT}`);
console.log(`archive debt: ${settled.length} settled entries still in the live file (H-24 point 2)`);
const byStatus = entries.reduce((m, e) => ({ ...m, [e.status]: (m[e.status] || 0) + 1 }), {});
console.log('  ' + Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  '));
