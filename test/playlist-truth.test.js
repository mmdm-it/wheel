// THE PLAYLIST is the single source of major truth (Howell, 2026-08-01).
//
// "Put all your eggs in one basket, and WATCH that basket." This is the
// watching. docs/THE-PLAYLIST.md records which editions exist or are planned,
// when each was made, in what language, and how far up the two-rung ladder it
// has come. Everything else about an edition — native names, versification
// tables, colophon prose, book names and abbreviations — lives in
// translations.json, which holds dictionaries, not decisions.
//
// These tests exist because the three files describing our translations drifted
// apart in exactly the ways a human eventually noticed by accident: seven
// languages had doors on the ring with no row on the wall, four ring years
// disagreed with the acts behind them, and the proofread flag lived in one
// vocabulary while complete/certified lived in another.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const loadJson = p => JSON.parse(readFileSync(p, 'utf-8'));

const playlist = readFileSync(path.join(root, 'docs/THE-PLAYLIST.md'), 'utf-8');

// Rows of the numbered roster: | # | Year | Edition | Language | Code | complete | proofread | Notes |
const acts = playlist
  .split('\n')
  .filter(line => /^\|\s*\d+\s*\|/.test(line))
  .map(line => line.split('|').slice(1, -1).map(c => c.trim()))
  .filter(c => c.length >= 7)
  .map(([n, year, edition, language, code, complete, proofread]) =>
    ({ n: Number(n), year, edition, language, code, complete, proofread }));

describe('THE PLAYLIST is the single source of major truth', () => {
  it('parses as a roster at all', () => {
    assert.ok(acts.length > 40, `only ${acts.length} rows parsed — the table shape changed`);
  });

  it('is numbered chronologically, contiguously, from 1', () => {
    acts.forEach((a, i) => assert.equal(a.n, i + 1, `row ${i + 1} is numbered ${a.n}`));
  });

  it('every row carries a year and a language', () => {
    for (const a of acts) {
      assert.ok(a.year, `#${a.n} ${a.edition}: no year`);
      assert.ok(a.language, `#${a.n} ${a.edition}: no language`);
    }
  });

  it('the two rungs are booleans, and the ladder cannot be climbed out of order', () => {
    for (const a of acts) {
      assert.match(a.complete, /^(yes|no)$/, `#${a.n} ${a.edition}: complete="${a.complete}"`);
      assert.match(a.proofread, /^(yes|no)$/, `#${a.n} ${a.edition}: proofread="${a.proofread}"`);
      // Nothing is proofread that is not first complete: a human cannot verify
      // against a source an edition that does not yet hold all its data.
      if (a.proofread === 'yes') {
        assert.equal(a.complete, 'yes',
          `#${a.n} ${a.edition} is proofread but not complete — the ladder skipped a rung`);
      }
    }
  });

  it('no edition code appears twice', () => {
    const codes = acts.map(a => a.code).filter(Boolean);
    assert.equal(new Set(codes).size, codes.length,
      `duplicate code: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(', ')}`);
  });

  it('every seated edition has a row, and every coded row is seated', () => {
    const seated = new Set(Object.keys(loadJson(path.join(root, 'data/gutenberg/translations.json')).translations));
    const onWall = new Set(acts.map(a => a.code).filter(Boolean));
    const missing = [...seated].filter(c => !onWall.has(c));
    const phantom = [...onWall].filter(c => !seated.has(c));
    assert.deepEqual(missing, [], `seated in the corpus but not on the wall: ${missing.join(', ')}`);
    assert.deepEqual(phantom, [], `on the wall with a code but nothing seated: ${phantom.join(', ')}`);
  });

  it('the proofread gate agrees with the wall', () => {
    // Until the program reads the playlist directly, translations.json carries
    // a copy of this flag. A copy that can disagree is the bug this file exists
    // to prevent, so they are checked against each other on every run.
    const eds = loadJson(path.join(root, 'data/gutenberg/translations.json')).translations;
    const bad = [];
    for (const a of acts.filter(x => x.code)) {
      const flag = eds[a.code]?.proofread;
      if (flag !== (a.proofread === 'yes')) bad.push(`${a.code}: wall=${a.proofread} data=${flag}`);
    }
    assert.deepEqual(bad, []);
  });

  it('every door on the language ring traces to an act on the wall', () => {
    // A language earns a door BECAUSE a translation act exists in it. This is
    // the guard that would have caught Arabic sitting at 867 with nothing
    // behind it, and Irish at 1685 — which is Bedell's Protestant Old
    // Testament, and would never have survived the shelf criterion.
    const langs = loadJson(path.join(root, 'data/gutenberg/languages.json'));
    const ring = (Array.isArray(langs) ? langs : Object.values(langs).find(Array.isArray)) || [];
    //
    // Seven doors arrived in the 42-language sweep of 2026-07-28 as quick
    // comingSoon hooks, three days before this table was expanded, and none has
    // an act behind it. Pinned here as a backlog that may only SHRINK: each is
    // resolved either by researching a real act onto the wall or by closing the
    // door, and that is Howell's call per language, not a test's. A door NOT on
    // this list and not on the wall is a new defect.
    const KNOWN_ORPHAN_DOORS = ['czech', 'irish', 'romanian', 'slovak', 'turkish', 'tagalog', 'maltese'];
    const spoken = new Set(acts.map(a => a.language.toLowerCase().split(/[ (]/)[0]));
    const orphans = ring.map(l => l.id).filter(id => !spoken.has(id.toLowerCase()));
    const fresh = orphans.filter(id => !KNOWN_ORPHAN_DOORS.includes(id));
    assert.deepEqual(fresh, [],
      `languages with a door and no act: ${fresh.join(', ')} — research them or close the door`);
    assert.ok(orphans.length <= KNOWN_ORPHAN_DOORS.length,
      `the orphan-door backlog grew from ${KNOWN_ORPHAN_DOORS.length} to ${orphans.length}`);
  });
});
