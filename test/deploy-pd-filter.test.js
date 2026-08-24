// THE RIGHTS GATE, FIRED (O-56). This filter decides what reaches a public
// server, so its cells are about REFUSALS: the shapes it must stop, and the
// one thing it must never do, which is report success without having looked.
//
// The defect this suite exists for: both of the old version's passes tested
// `rel.startsWith('chapters/')`, a directory H-21 deleted. It copied
// everything, stripped nothing, verified a path that did not exist, and
// exited 0 printing "verified zero non-PD texts in output". Nothing could
// have caught that from inside — which is why the assert-it-ran cell below
// matters more than any of the strip cells.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = 'scripts/deploy-pd-filter.mjs';
const V = '2026.01.01';

let dir;
const src = () => path.join(dir, 'src');
const dest = () => path.join(dir, 'dest');

// THE CLEARED CODE IS READ FROM THE GATE, NEVER SPELLED HERE (O-68).
//
// These fixtures named `WLC` as the cleared edition. When Howell cleared the
// renamed Hebrew — `1200BCheb` under W-90 — eight of twelve cells went red,
// having asserted the identity of a code rather than the BEHAVIOUR of the
// gate. The behaviour is what is under test: a cleared edition deploys, an
// uncleared one stops everything by name. Which string happens to be cleared
// this month is the allowlist's business, and the allowlist is the subject,
// not the fixture.
const CLEARED = (() => {
  const src = readFileSync(path.join(root, 'scripts/deploy-pd-filter.mjs'), 'utf-8');
  const m = /PD_ALLOWLIST\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(src);
  const first = m && /['"]([^'"]+)['"]/.exec(m[1]);
  if (!first) throw new Error('cannot read PD_ALLOWLIST from the gate — the fixture has nothing to clear');
  return first[1];
})();
// A code the allowlist certainly does not carry, for the refusal cells.
const UNCLEARED = 'NOT-A-CLEARED-EDITION';

// Builds a fixture corpus. `editions` are the codes volume.json DECLARES;
// `texts` are the edition directories that actually carry files — kept
// separate on purpose, because declaration and presence disagreeing is one
// of the cases under test.
// `unconfirmed` names editions that are NOT proofread (O-81). Every other
// edition declares `proofread: true`, which is what the gate now requires
// before an edition may be published at all — a fixture written before that
// ruling declared nothing, so the gate correctly refused to publish an
// unfinished corpus and every cell here went red. W-102: the cells are
// rewritten to the doctrine, not patched around it.
function build({ editions = [CLEARED], texts = { [CLEARED]: 3 }, declaresEdition = null, charts = [], unconfirmed = [] } = {}) {
  rmSync(src(), { recursive: true, force: true });
  rmSync(dest(), { recursive: true, force: true });
  mkdirSync(path.join(src(), V), { recursive: true });
  // NO manifest.json IS WRITTEN (O-66). The gate stopped requiring one when
  // the clean slate deleted it from the corpus; a fixture that still supplied
  // it would have kept every cell here green over a gate that could not run
  // against the real data — which is exactly what happened for a day.
  writeFileSync(path.join(src(), V, 'volume.json'), JSON.stringify({
    editions: editions.map(code => ({ code, hasChart: true, proofread: !unconfirmed.includes(code) }))
  }));
  for (const code of charts) {
    const d = path.join(src(), V, 'charts', code);
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, 'index.json'), JSON.stringify({ edition: code, seats: ['1:1'] }));
  }
  for (const [code, n] of Object.entries(texts)) {
    const d = path.join(src(), V, 'text', code);
    mkdirSync(d, { recursive: true });
    for (let i = 0; i < n; i += 1) {
      writeFileSync(path.join(d, `b${i}.json`), JSON.stringify({
        book: `b${i}`, edition: declaresEdition || code, text: { '1:1': 'in principio', '1:2': 'terra autem' }
      }));
    }
  }
}

const run = (versionArg = V) => {
  // The version is passed explicitly here. The gate falls back to reading the
  // ENGINE's BIBLE_VOLUME_VERSION when it is omitted, and one cell below
  // exercises that route — but every other cell names its own fixture's
  // version, because a fixture must not depend on what the real corpus is
  // called this week.
  const args = [SCRIPT, src(), dest()];
  if (versionArg) args.push(versionArg);
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf-8' });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
};

describe('deploy-pd-filter — the rights gate (O-56)', () => {
  before(() => { dir = mkdtempSync(path.join(tmpdir(), 'pdfilter-')); });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('a cleared corpus passes, and SAYS HOW MUCH IT READ', () => {
    build({ editions: [CLEARED], texts: { [CLEARED]: 3 } });
    const r = run();
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /records inspected AND re-verified in the output: 6/,
      'three files of two verses each — the count is the proof it looked');
    assert.ok(existsSync(path.join(dest(), V, 'text', CLEARED, 'b0.json')));
  });

  it('ZERO RECORDS INSPECTED IS A REFUSAL — the O-56 defect itself', () => {
    // The exact shape of the original bug: a corpus whose text is not where
    // the filter looks. The old version copied everything and reported
    // success. Nothing else in this suite would have caught it.
    build({ editions: [CLEARED], texts: {} });
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.err, /ZERO text records were inspected/);
    assert.match(r.err, /cannot verify what it never read/);
  });

  it('an edition the volume declares but does not clear STOPS THE DEPLOY BY NAME', () => {
    build({ editions: [CLEARED, UNCLEARED], texts: { [CLEARED]: 2, [UNCLEARED]: 2 } });
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.err, /REFUSING/);
    assert.match(r.err, /NOT-A-CLEARED-EDITION/, 'it names the edition rather than dropping it quietly');
    assert.match(r.err, /LICENSING decision/);
    assert.ok(!existsSync(dest()), 'and nothing at all was written');
  });

  it('the refusal comes BEFORE any writing, so a wrong allowlist cannot half-publish', () => {
    build({ editions: [CLEARED, UNCLEARED], texts: { [CLEARED]: 5, [UNCLEARED]: 1 } });
    const r = run();
    assert.equal(r.code, 1);
    assert.ok(!existsSync(path.join(dest(), V, 'text', CLEARED, 'b0.json')),
      'not even the cleared edition is written when the volume is in question');
  });

  it('a text file whose own edition disagrees with its directory is refused', () => {
    // Layout and content drifting apart is not something a rights gate should
    // reconcile silently — it is a question for a person.
    build({ editions: [CLEARED], texts: { [CLEARED]: 1 }, declaresEdition: UNCLEARED });
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.err, /REFUSING/);
    assert.match(r.err, /NOT-A-CLEARED-EDITION/);
  });

  it('the volume must declare something — an empty declaration is refused, not treated as clean', () => {
    build({ editions: [], texts: { [CLEARED]: 1 } });
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.err, /declares no editions/);
  });

  // THE GATE NO LONGER ASKS `manifest.json` (O-66). It did until 2026-08-18,
  // and the 2026-08-17 clean slate deleted that file — so the gate died on
  // its first line, before reaching the licensing check it exists to perform.
  // It failed CLOSED, which is the mercy, but O-56 had rebuilt this very gate
  // because it was inert and it was inert again within a week. A rights gate
  // must not depend on a file nobody maintains for its sake.
  it('RUNS WITH NO manifest.json AT ALL — the file it used to require is gone', () => {
    build({ editions: [CLEARED], texts: { [CLEARED]: 1 }, charts: [CLEARED] });
    assert.ok(!existsSync(path.join(src(), 'manifest.json')),
      'the fixture must not carry one, or this cell proves nothing');
    const r = run();
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /records inspected/);
  });

  it('AN UNPROOFREAD EDITION IS EXCLUDED, NAMED, AND DOES NOT STOP THE DEPLOY (O-81)', () => {
    // Howell, asked whether the Greek should join the allowlist: "No, only
    // proofread editions should be available for publishing." An unfinished
    // edition is the NORMAL condition of a corpus being built, so it is held
    // back rather than treated as a forgotten licence — refusing the whole
    // deploy over it would mean nothing ships until everything is finished.
    build({ editions: [CLEARED, UNCLEARED], texts: { [CLEARED]: 2, [UNCLEARED]: 2 },
            unconfirmed: [UNCLEARED] });
    const r = run();
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /NOT published — not proofread/, 'held back OUT LOUD, never silently');
    assert.match(r.err, new RegExp(UNCLEARED), 'and by name');
    assert.ok(!existsSync(path.join(dest(), V, 'text', UNCLEARED)),
      'and its text never reaches the deployable copy');
    assert.ok(existsSync(path.join(dest(), V, 'text', CLEARED)),
      'while the finished edition ships');
  });

  it('AN UNPROOFREAD EDITION IS NEVER HELD TO A LICENCE IT DOES NOT NEED YET', () => {
    // The order of the two gates matters. UNCLEARED is absent from the
    // allowlist AND unproofread; it must be excluded for the second reason
    // and never raise the first, because a licence question nobody has been
    // asked yet is not a fault to report.
    build({ editions: [CLEARED, UNCLEARED], texts: { [CLEARED]: 1, [UNCLEARED]: 1 },
            unconfirmed: [UNCLEARED] });
    const r = run();
    assert.equal(r.code, 0, r.err);
    assert.ok(!/not cleared for publication/.test(r.err),
      'no licensing complaint about an edition we are not publishing');
  });

  it('A PROOFREAD EDITION WITH NO LICENCE STILL STOPS THE DEPLOY BY NAME', () => {
    // The licence gate is unchanged for anything we actually intend to ship.
    // This is the case O-56 rebuilt the gate for, and O-81 must not soften it.
    build({ editions: [CLEARED, UNCLEARED], texts: { [CLEARED]: 1, [UNCLEARED]: 1 } });
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.err, /REFUSING/);
    assert.match(r.err, /PROOFREAD edition\(s\) are not cleared/);
    assert.match(r.err, new RegExp(UNCLEARED));
  });

  it('A CORPUS WITH NOTHING PROOFREAD REFUSES, rather than publishing an empty reader', () => {
    build({ editions: [CLEARED], texts: { [CLEARED]: 2 }, unconfirmed: [CLEARED] });
    const r = run();
    assert.equal(r.code, 1);
    assert.match(r.err, /nothing to publish/);
  });

  it('falls back to the ENGINE\'s declared version when none is passed', () => {
    // No third argument: the gate must read BIBLE_VOLUME_VERSION out of
    // src/volume-configs.js. The fixture is built under that same name, so a
    // pass means the gate genuinely found and used the engine's answer.
    const engineVersion = /BIBLE_VOLUME_VERSION\s*=\s*['"]([^'"]+)['"]/
      .exec(readFileSync(path.join(root, 'src/volume-configs.js'), 'utf-8'))?.[1];
    assert.ok(engineVersion, 'the engine must declare a volume version for the gate to read');
    rmSync(src(), { recursive: true, force: true });
    rmSync(dest(), { recursive: true, force: true });
    mkdirSync(path.join(src(), engineVersion), { recursive: true });
    writeFileSync(path.join(src(), engineVersion, 'volume.json'),
      JSON.stringify({ editions: [{ code: CLEARED, hasChart: true, proofread: true }] }));
    const d = path.join(src(), engineVersion, 'text', CLEARED);
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, 'b0.json'), JSON.stringify({ edition: CLEARED, text: { '1:1': 'x' } }));
    const r = run(null);
    assert.equal(r.code, 0, r.err);
  });

  it('refuses when it cannot determine a version at all', () => {
    build({ editions: [CLEARED], texts: { [CLEARED]: 1 } });
    const r = spawnSync(process.execPath, [SCRIPT, src(), dest(), ''], {
      cwd: root, encoding: 'utf-8',
      env: { ...process.env, PATH: process.env.PATH }
    });
    // An empty version argument falls through to the engine read, which
    // succeeds — so the fixture's own directory is not found instead.
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no volume\.json|cannot determine the volume version/);
  });

  it('a cleared edition keeps its chart — structure is granted on purpose (WF-14)', () => {
    build({ editions: [CLEARED], texts: { [CLEARED]: 1 }, charts: [CLEARED] });
    const r = run();
    assert.equal(r.code, 0, r.err);
    assert.ok(existsSync(path.join(dest(), V, 'charts', CLEARED, 'index.json')),
      'a chart is groups and seats, not content — and its edition ships');
  });

  it('an uncleared edition loses its CHART as well as its text', () => {
    // Wilbur's rights ruling on review: a chart leaks nothing and is grantable,
    // but shipping one whose text was withheld leaves a container no reader can
    // reach, kept off the shelf only by a gate somewhere else. Both go, one rule.
    //
    // DO NOT "TIDY" THIS INTO THE NATURAL FORM. The uncleared edition is
    // staged present in the tree but NOT declared by volume.json, on purpose.
    // Declare it — which reads more naturally and is what anyone would write
    // first — and clause 3 refuses the whole deploy BEFORE exclusion is ever
    // reached. The cell then passes, named for the exclusion, having proved
    // only the refusal that was already covered two cells up: green, and
    // compatible with the thing it names being completely broken.
    //
    // A cell must be written adversarially against the OTHER clauses in order
    // to test its own. This one was one line from being written the wrong way,
    // in the suite whose whole subject is instruments that pass over a vacuum —
    // and writing it correctly is what exposed that exclusion consulted the
    // declaration at all.
    build({ editions: [CLEARED], texts: { [CLEARED]: 1, [UNCLEARED]: 1 }, charts: [CLEARED, UNCLEARED] });
    const r = run();
    assert.equal(r.code, 0, r.err);
    assert.ok(existsSync(path.join(dest(), V, 'text', CLEARED, 'b0.json')), 'the cleared edition ships');
    assert.ok(existsSync(path.join(dest(), V, 'charts', CLEARED, 'index.json')), 'with its chart');
    assert.ok(!existsSync(path.join(dest(), V, 'text', UNCLEARED)), 'the uncleared text never reaches the output');
    assert.ok(!existsSync(path.join(dest(), V, 'charts', UNCLEARED)), 'and neither does its chart');
  });

  it('the deployable copy carries the structure, and the text it carries is cleared', () => {
    build({ editions: [CLEARED], texts: { [CLEARED]: 2 } });
    const r = run();
    assert.equal(r.code, 0, r.err);
    const unit = JSON.parse(readFileSync(path.join(dest(), V, 'text', CLEARED, 'b1.json'), 'utf8'));
    assert.equal(unit.edition, CLEARED);
    assert.equal(Object.keys(unit.text).length, 2, 'a cleared edition ships whole — this filter removes nothing from it');
  });
});
