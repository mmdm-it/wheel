// THE SPLICE (O-45, phase 1a) — one substitution point, forty-one blind sites.
//
// The cells that earn their keep here are the NEGATIVE ones. A rig that
// substitutes correctly but also touches anything else is worse than no rig,
// because phase 1a's acceptance test is that every OTHER unit is unchanged.
import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import {
  legacyTextFile, declareTextSubstitution, clearTextSubstitution
} from '../src/core/unit-source.js';

const LEGACY = 'data/gutenberg/chapters/GENE/001.json';
const MIGRATED = './test/fixtures/h11/gutenberg/v1/bc22df';

afterEach(() => clearTextSubstitution());

describe('the splice — a declared substitution, and nothing else', () => {
  it('substitutes the declared address', () => {
    declareTextSubstitution({ from: LEGACY, to: MIGRATED });
    assert.equal(legacyTextFile({ _external_file: LEGACY }), MIGRATED);
  });

  it('LEAVES EVERY OTHER UNIT ALONE — this is the acceptance test in one cell', () => {
    declareTextSubstitution({ from: LEGACY, to: MIGRATED });
    // The neighbour in the same book, and a book on the far side of the corpus.
    assert.equal(legacyTextFile({ _external_file: 'data/gutenberg/chapters/GENE/002.json' }),
      'data/gutenberg/chapters/GENE/002.json');
    assert.equal(legacyTextFile({ _external_file: 'data/gutenberg/chapters/APOC/022.json' }),
      'data/gutenberg/chapters/APOC/022.json');
  });

  it('matches the WHOLE address, never a prefix', () => {
    // The bug this guards is the one isAncestor already met: a bare prefix
    // test would drag every chapter of the book into the substitution.
    declareTextSubstitution({ from: 'data/gutenberg/chapters/GENE/001', to: MIGRATED });
    assert.equal(legacyTextFile({ _external_file: LEGACY }), LEGACY,
      'a near-miss must NOT substitute — an accidental match here renders the wrong unit');
  });

  it('with no substitution declared, the function is exactly what it was', () => {
    assert.equal(legacyTextFile({ _external_file: LEGACY }), LEGACY);
    assert.equal(legacyTextFile({}, 'the/fallback.json'), 'the/fallback.json');
    assert.equal(legacyTextFile(null, ''), '');
  });

  it('the fallback path substitutes too — six sites, one behaviour', () => {
    // Three of the six sites build a path as their fallback rather than
    // reading the field. If the substitution only saw the field, those three
    // would quietly keep rendering the legacy unit.
    declareTextSubstitution({ from: LEGACY, to: MIGRATED });
    assert.equal(legacyTextFile({}, LEGACY), MIGRATED);
  });

  it('REFUSES a half-declared substitution rather than inferring the other half', () => {
    assert.throws(() => declareTextSubstitution({ from: LEGACY }), /needs both/);
    assert.throws(() => declareTextSubstitution({ to: MIGRATED }), /needs both/);
  });
});
