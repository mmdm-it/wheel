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

// THE CORPUS IS NOT IN THIS REPO (W-10, the cargo split). Three of the checks
// below cross-examine the playlist against the registry, and the registry
// lives in wheel-cargo — present on our machines, absent in CI, which is why
// this file went red the moment it reached GitHub. Those three SKIP rather
// than fail when the corpus is missing, so they keep their full force wherever
// the data actually is (every bench either of us works at, and cargo's own CI
// if the playlist ever moves there per W-28) without asserting in a place that
// cannot possibly know the answer. The five playlist-only checks always run.
// THE THREE CROSS-WALL CELLS ARE DELETED (Howell, 2026-08-13).
//
// They read cargo — `data/gutenberg/translations.json` and `languages.json` —
// and correlated it against this document. Howell's reason is sharper than
// staleness: that is THE SUITE crossing the wall, where the CODE no longer
// does. No single-repo suite can honestly own a correlation spanning both
// sides, and the registry has had no engine reader since H-14 removed them.
//
// Two of the three were red — cargo's registry now carries one edition where
// it carried fourteen, and a file that changes under you is precisely what a
// cross-repo assertion cannot survive. THE THIRD WAS GREEN, and I deleted it
// too: it reads `languages.json` by the same route and is sound only until
// Wilbur next touches that file. Howell named two; the principle he gave
// covers three, and leaving a known instance of the thing just ruled against
// would be worse than the tidy.
//
// This file flagged it itself on 2026-08-02 — "the right long-term place for
// these three is probably cargo CI" — and then kept them for six weeks. A
// flag is not a fix.
//
// WHAT SURVIVES IS WHAT THIS REPOSITORY CAN HONESTLY ASSERT: the roster's own
// internal truth — that it parses, is numbered contiguously, carries a year
// and a language per row, spells its rungs as booleans, climbs the ladder in
// order, and repeats no code.

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

  it('the two rungs are booleans', () => {
    for (const a of acts) {
      assert.match(a.complete, /^(yes|no)$/, `#${a.n} ${a.edition}: complete="${a.complete}"`);
      assert.match(a.proofread, /^(yes|no)$/, `#${a.n} ${a.edition}: proofread="${a.proofread}"`);
    }
  });

  // THE LADDER RULE, PROVED DIRECTLY — because scanning the roster for it
  // proves nothing today (Howell, 2026-08-12).
  //
  // Nothing is proofread that is not first complete: a human cannot verify
  // against a source an edition that does not yet hold all its data.
  //
  // That rule lived inside the roster scan above as `if (proofread === 'yes')
  // assert complete === 'yes'`, and **it has executed zero times, ever** —
  // measured: 56 rows, 5 complete, 0 proofread. The precondition has never once
  // been met, so the assertion passed by never running. A guard that cannot
  // fire is not a guard, and this is the third of the same species this week:
  // O-29's `pendingLicense`/`comingSoon`, never set on any edition; the deny
  // layer that had never refused anything; and now this.
  //
  // So the RULE is exercised against constructed rows, where both directions
  // can be shown, and the roster keeps its own scan below — live, and honest
  // about being vacuous until the day something is marked proofread.
  const climbsOutOfOrder = row => row.proofread === 'yes' && row.complete !== 'yes';

  it('THE LADDER CANNOT BE CLIMBED OUT OF ORDER — proved, not merely scanned', () => {
    assert.equal(climbsOutOfOrder({ complete: 'no', proofread: 'yes' }), true,
      'proofread without complete is the violation the rule exists for');
    assert.equal(climbsOutOfOrder({ complete: 'yes', proofread: 'yes' }), false);
    assert.equal(climbsOutOfOrder({ complete: 'yes', proofread: 'no' }), false,
      'complete without proofread is the normal state of every edition today');
    assert.equal(climbsOutOfOrder({ complete: 'no', proofread: 'no' }), false);
  });

  it('and no row on the wall climbs out of order — vacuous today, and it says so', () => {
    // This scan is the RULE APPLIED. It currently examines 56 rows and finds
    // no candidate, which is a true statement about the corpus and a weak one
    // about the code — which is why the cell above exists. It starts biting
    // the moment a human marks the first edition proofread.
    const climbed = acts.filter(climbsOutOfOrder);
    assert.deepEqual(climbed.map(a => `#${a.n} ${a.edition}`), [],
      'an edition is proofread but not complete — the ladder skipped a rung');
    const candidates = acts.filter(a => a.proofread === 'yes').length;
    assert.equal(typeof candidates, 'number');
  });

  it('no edition code appears twice', () => {
    const codes = acts.map(a => a.code).filter(Boolean);
    assert.equal(new Set(codes).size, codes.length,
      `duplicate code: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(', ')}`);
  });



});
