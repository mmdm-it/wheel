// ONE READER FOR A GROUP OF SIGLA (W-186).
//
// Swete writes agreement by running sigla together: "AR" is Alexandrinus AND
// the Verona Psalter, "ℵAQΓ" is four manuscripts in four letters. Three layers
// of this app read those, and in one week all three were found to be treating
// a group as a single letter — the latinisation, the lookup, and the display —
// each discovered by a reader AFTER the previous had been declared fixed,
// because each fix corrected a COPY and left the others standing.
//
// Three correct copies is not one correct implementation. These cells exist to
// keep it at one: the behaviour is pinned here, and the last cell fails if a
// second copy appears anywhere in the source.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siglumRun, SIGLUM_SPLIT, GREEK_LOWER, manuscriptsIn } from '../src/core/margin-source.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIGLA = new Set(['ℵ', 'A', 'B', 'C', 'D', 'E', 'F', 'Q', 'R', 'Γ']);
const is = c => SIGLA.has(c);

describe('reading a run of sigla', () => {
  it('takes every manuscript in a group, not merely the first', () => {
    assert.equal(siglumRun('AR', is).run, 'AR');
    assert.equal(siglumRun('ℵAQΓ', is).run, 'ℵAQΓ');
    assert.equal(siglumRun('AF', is).run, 'AF');
  });

  it('keeps the manuscript and stops at a modifier', () => {
    // "A*" is the original hand; "F1" the first corrector. The letter is the
    // manuscript and the rest describes which hand of it — so the run ends at
    // the modifier and the manuscript survives.
    assert.equal(siglumRun('A*vid', is).run, 'A');
    assert.equal(siglumRun('A*vid', is).stoppedAt, '*');
    assert.equal(siglumRun('F1mg', is).run, 'F');
  });

  it('REFUSES A GREEK WORD that happens to begin with a capital', () => {
    // This is the whole reason the rule is "stop at the first character that
    // is not a manuscript" rather than "collect the capitals": a proper noun
    // stops at its own second letter and the caller can see why.
    // The case that matters is a word whose FIRST letter is a manuscript —
    // Γ is the Cryptoferratensis and also the first letter of Genesis. The
    // run is that one letter and it stops on a lowercase Greek one, which is
    // how the caller knows to throw the whole thing away.
    const g = siglumRun('Γενεσις', is);
    assert.equal(g.run, 'Γ');
    assert.ok(GREEK_LOWER.test(g.stoppedAt), 'a word must be rejectable by its second letter');
    // And a word whose first letter is NOT a manuscript yields nothing at all,
    // stopping on that first letter rather than on a second.
    const d = siglumRun('Δανιηλ', is);
    assert.equal(d.run, '');
    assert.equal(d.stoppedAt, 'Δ');
  });

  it('answers empty for a token with no manuscript at its head', () => {
    assert.equal(siglumRun('om', is).run, '');
    assert.equal(siglumRun('', is).run, '');
  });
});

describe('the lookup reads what the display reads', () => {
  const legend = {
    volumes: [{ volume: 1, units: ['u1'], books: ['X'],
      sigla: { 'ℵ': 'Sinaiticus', A: 'Alexandrinus', R: 'Verona', Γ: 'Cryptoferratensis' } }],
  };
  /** The display's own reckoning of which manuscripts a body cites, written
   *  the way margin-panel writes it — through the SAME reader. */
  const citedByDisplay = (body, known) => {
    const out = new Set();
    for (const token of String(body).split(SIGLUM_SPLIT)) {
      const { run, stoppedAt } = siglumRun(token, c => known.has(c));
      if (!run || (stoppedAt !== null && GREEK_LOWER.test(stoppedAt))) continue;
      for (const c of run) out.add(c);
    }
    return out;
  };

  for (const body of [
    'τη φωνη AR',
    'om αυτου A | γενος] εθνος A',
    'Inscr ℵAQΓ 1 πανοικια A*vid',
    'Γενεσις ℵA | R',
    'om',
  ]) {
    it(`agrees on: ${body}`, () => {
      const named = manuscriptsIn(body, legend, 'u1');
      const known = new Set(Object.keys(legend.volumes[0].sigla));
      const shown = citedByDisplay(body, known);
      assert.deepEqual(named.map(m => m.siglum).sort(), [...shown].sort(),
        'the manuscripts NAMED and the manuscripts SHOWN must be the same set');
    });
  }
});

describe('there is only one reader', () => {
  it('no other source file walks a token against a siglum set', () => {
    // THE CELL THAT ACTUALLY PREVENTS THE NEXT ONE. The bug was never that a
    // copy was wrong — it was that copies existed at all, so a fix could be
    // complete and true and still leave the app broken. This looks for the
    // shape of a hand-rolled reader anywhere but its one home.
    const walk = dir => readdirSync(dir).flatMap(e => {
      const full = path.join(dir, e);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
    const HOME = path.join(root, 'src', 'core', 'margin-source.js');
    const suspects = [];
    for (const file of walk(path.join(root, 'src')).filter(f => f.endsWith('.js'))) {
      if (file === HOME) continue;
      const src = readFileSync(file, 'utf-8');
      if (/while\s*\([^)]*<\s*\w*[Tt]oken\.length[^)]*\)/.test(src)) {
        suspects.push(path.relative(root, file));
      }
    }
    assert.deepEqual(suspects, [],
      `a second siglum reader has appeared in: ${suspects.join(', ')} — call siglumRun instead`);
  });
});
