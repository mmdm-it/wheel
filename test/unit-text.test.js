// THE TEXT-SHAPE ADAPTER (O-45). The cells that matter are the ones proving
// it never parses an address and never quietly half-loads.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeUnitText } from '../src/core/unit-text.js';

// One address, two editions, as H-11 stores them: one file PER edition.
const AAA = { edition: 'AAA', text: { '1': 'alpha one', '2': 'alpha two' } };
const BBB = { edition: 'BBB', text: { '1': 'beta one', '2': 'beta two' } };

describe('unit-text — N per-edition files become the one shape downstream reads', () => {
  it('merges the editions under a shared address', () => {
    const out = normalizeUnitText({
      editions: { AAA, BBB },
      declared: ['AAA', 'BBB'],
      order: ['1', '2']
    });
    assert.deepEqual(out['1'].text, { AAA: 'alpha one', BBB: 'beta one' });
    assert.deepEqual(out['2'].text, { AAA: 'alpha two', BBB: 'beta two' });
  });

  it('carries the declared order as seq — never read off the address', () => {
    const out = normalizeUnitText({
      editions: { AAA, BBB }, declared: ['AAA', 'BBB'], order: ['2', '1']
    });
    // The order says 2 comes first, and it is believed. An adapter that read
    // the number out of the address would disagree, and would be wrong the
    // first time an edition addressed anything that is not a bare integer.
    assert.equal(out['2'].seq, 0);
    assert.equal(out['1'].seq, 1);
  });

  it('an address only ONE edition has survives, and stays honestly partial', () => {
    // The merge case: where AAA gathers into one address what BBB divides in
    // two, BBB's second address exists and AAA has no text for it. The empty
    // is the truth and must not be filled from the other edition.
    const wide = { edition: 'AAA', text: { '22': 'the two clauses run together' } };
    const narrow = { edition: 'BBB', text: { '22': 'the first', '23': 'the second' } };
    const out = normalizeUnitText({
      editions: { AAA: wide, BBB: narrow }, declared: ['AAA', 'BBB'], order: ['22']
    });
    assert.deepEqual(Object.keys(out).sort(), ['22', '23']);
    assert.equal(out['23'].text.AAA, undefined, 'AAA genuinely has no text there');
    assert.equal(out['23'].text.BBB, 'the second');
  });

  it('an address outside the order is kept, never dropped and never invented', () => {
    const out = normalizeUnitText({
      editions: { AAA, BBB }, declared: ['AAA', 'BBB'], order: ['1']
    });
    assert.ok('2' in out, 'an address the active order does not seat is still text that exists');
    assert.ok(out['2'].seq > out['1'].seq, 'and it sorts after everything the order placed');
  });

  it('NEVER parses an address for structure (H-2 — a label is a quotation)', () => {
    const odd = { edition: 'AAA', text: { '3:16': 'x', '17-20': 'y', 'Prologue': 'z' } };
    const out = normalizeUnitText({
      editions: { AAA: odd }, declared: ['AAA'], order: ['3:16', '17-20', 'Prologue']
    });
    assert.deepEqual(Object.keys(out), ['3:16', '17-20', 'Prologue']);
    assert.deepEqual(Object.values(out).map(v => v.seq), [0, 1, 2]);
  });
});

describe('unit-text — all-or-nothing, loudly (O-42 inherited)', () => {
  it('SCREAMS when a declared edition did not arrive', () => {
    // The legacy layout fetched ONE file and got every edition at once, so a
    // partial load was not expressible. Under H-11 it is, and a unit rendering
    // from the editions that happened to answer would look like success.
    assert.throws(() => normalizeUnitText({
      editions: { AAA }, declared: ['AAA', 'BBB'], order: ['1']
    }), /INCOMPLETE — missing text for BBB/);
  });

  it('SCREAMS when an edition arrived with no text map at all', () => {
    assert.throws(() => normalizeUnitText({
      editions: { AAA, BBB: { edition: 'BBB' } }, declared: ['AAA', 'BBB'], order: ['1']
    }), /INCOMPLETE — missing text for BBB/);
  });

  it('SCREAMS rather than accepting a file that answers for another edition', () => {
    // A mis-routed fetch is silent otherwise: the text is real, the shape is
    // right, and every address resolves — to the wrong tradition's words.
    assert.throws(() => normalizeUnitText({
      editions: { AAA, BBB: { edition: 'AAA', text: { '1': 'alpha one' } } },
      declared: ['AAA', 'BBB'], order: ['1']
    }), /answers for "AAA"/);
  });

  it('REFUSES to run without a declared edition list — presence must be checkable', () => {
    assert.throws(() => normalizeUnitText({ editions: { AAA }, order: ['1'] }),
      /must DECLARE its editions/);
  });
});

describe('unit-text — the shape it produces is the shape already read', () => {
  it('matches the legacy per-address record downstream expects', () => {
    // The whole point of the adapter: nothing beyond it learns which layout
    // answered. Legacy records are `{ seq, text: { CODE: string } }`.
    const out = normalizeUnitText({
      editions: { AAA, BBB }, declared: ['AAA', 'BBB'], order: ['1', '2']
    });
    for (const record of Object.values(out)) {
      assert.ok(Number.isFinite(record.seq), 'every record carries an ordering');
      assert.equal(typeof record.text, 'object');
    }
  });
});
