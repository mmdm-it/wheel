// THE DOCUMENT GATE — B2, Howell's ruling 2026-08-06.
//
//   A commit that changes a document under docs/ must cite a number, and the
//   number must exist in the ledger index.
//
// WF-2 says every ruling earns a number. This is what makes it checkable
// rather than intended, and it is the direct fix for the failure that cost two
// days: a ruling written into a blueprint, never entered in any queue, so
// nobody owed the work.
//
// Two modes:
//   node scripts/check-doc-citations.mjs --message <file>   (commit-msg hook)
//   node scripts/check-doc-citations.mjs                    (CI: this branch)
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const INDEX = `${root}docs/LEDGER-INDEX.md`;
// case-insensitive: commit subjects are written `docs(w-38):`
//
// H- joins the family (H-1's carry-out). Before it did, the failure had two
// halves and only one was visible: citing an H- ALONE was refused as citing
// nothing — loud, and easy to notice — while an H- riding ALONGSIDE a valid
// W-/O- was never looked at, so `docs(H-999, O-33)` passed reporting
// "cites O-33". A wrong ruling number that reads as cited is worse than an
// uncited commit, because it answers the question the gate exists to ask.
const CITE = /\b(?:WF|W|O|H)-\d+\b/gi;

export function knownIds() {
  if (!existsSync(INDEX)) return null;
  const ids = new Set();
  for (const line of readFileSync(INDEX, 'utf-8').split('\n')) {
    const m = /^\|\s*([WOH]-\d+)\s*\|/.exec(line);
    if (m) ids.add(m[1]);
  }
  return ids;
}

// WF- ids are procedural rules in the SOP, not ledger items — they have no
// entry to point at, so they are accepted on sight. W-, O- and H- must exist.
export function verdict(message, changedDocs, ids) {
  if (!changedDocs.length) return { ok: true, why: 'no docs/ files changed' };
  const cited = [...new Set((message.match(CITE) || []).map(c => c.toUpperCase()))];
  if (!cited.length) {
    return { ok: false, why:
      `changes ${changedDocs.length} document(s) under docs/ but cites no number.\n` +
      `  Cite the ruling this implements: H-11, W-38, O-27, WF-13 …\n` +
      `  If there is no ruling yet, make one first (WF-2).\n` +
      `  changed: ${changedDocs.slice(0, 5).join(', ')}` };
  }
  const ledgerCites = cited.filter(c => !c.startsWith('WF-'));
  const unknown = ledgerCites.filter(c => !ids.has(c));
  if (unknown.length) {
    return { ok: false, why:
      `cites ${unknown.join(', ')}, which ${unknown.length > 1 ? 'are' : 'is'} not in the ledger index.\n` +
      `  Either the number is wrong, or the entry was never written (WF-2),\n` +
      `  or the index is stale: node scripts/build-ledger-index.mjs` };
  }
  return { ok: true, why: `cites ${cited.join(', ')}` };
}

const git = c => execSync(c, { cwd: root, encoding: 'utf-8' }).trim();

if (process.argv[1] && process.argv[1].endsWith('check-doc-citations.mjs')) {
  const ids = knownIds();
  if (!ids) { console.error('no docs/LEDGER-INDEX.md — run build-ledger-index.mjs'); process.exit(1); }
  const msgFlag = process.argv.indexOf('--message');
  let failures = 0;
  if (msgFlag !== -1) {
    const message = readFileSync(process.argv[msgFlag + 1], 'utf-8');
    const changed = git('git diff --cached --name-only').split('\n')
      .filter(f => f.startsWith('docs/') && !f.startsWith('docs/archive/'));
    const v = verdict(message, changed, ids);
    if (!v.ok) { console.error(`REFUSED: this commit ${v.why}`); failures = 1; }
  } else {
    // CI checks out shallow, so origin/main and even HEAD~1 may not exist.
    // Try the candidates in order and fall back to the tip alone — a narrower
    // check, never a crash, and never a silent pass.
    const tryGit = c => { try { return git(c); } catch { return ''; } };
    const base = ['origin/main', process.env.GITHUB_BASE_REF && `origin/${process.env.GITHUB_BASE_REF}`, 'main']
      .filter(Boolean).map(r => tryGit(`git rev-parse --verify --quiet ${r}`)).find(Boolean);
    const shas = (base ? tryGit(`git rev-list ${base}..HEAD`) : tryGit('git rev-parse HEAD'))
      .split('\n').filter(Boolean);
    if (!base) console.log('document gate: no base ref (shallow clone) — checking HEAD only');
    for (const sha of shas) {
      const changed = git(`git show --name-only --format= ${sha}`).split('\n')
        .filter(f => f.startsWith('docs/') && !f.startsWith('docs/archive/'));
      const v = verdict(git(`git log -1 --format=%B ${sha}`), changed, ids);
      if (!v.ok) { console.error(`REFUSED ${sha.slice(0, 9)}: ${v.why}`); failures += 1; }
    }
    if (!failures) console.log(`document gate: ${shas.length} commit(s) clean`);
  }
  process.exit(failures ? 1 : 0);
}
