// THE MARGIN'S ADDRESS SPACE (W-165, O-100).
//
// WHY THIS TEST EXISTS, and it is the whole reason: the first build of the
// margin shipped with the lookup pointed at the wrong address space, and
// NOTHING SAID SO. A chart's seat labels are flat ordinals within the unit —
// "1", "2", "3" — while a margin block is addressed "container:seat". Every
// lookup missed, every lookup correctly returned null, and null is the
// ordinary answer for a unit that has no apparatus at all. The screen was
// blank, the console was clean, the suite was green, and the defect was
// indistinguishable from the normal case.
//
// So the two halves are pinned separately: that the order is composed the way
// a reader's own position is composed, and that a range lookup over it lands.
//
// THE FIXTURES ARE INVENTED. No corpus content crosses into this repository
// (WF-14), and none is needed — the shapes are what is under test.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addressOrder, blockAt } from '../src/core/margin-source.js';

const chart = {
  seats: [
    { label: '1' }, { label: '2' }, { label: '3' },   // container 1
    { label: '1' }, { label: '2' },                   // container 2
    { label: '1' },                                   // container 10
  ],
  groups: [
    { label: '1', from: 1, to: 3 },
    { label: '2', from: 4, to: 5 },
    { label: '10', from: 6, to: 6 },
  ],
};

describe('margin address order', () => {
  it('composes the address the way a reader position is composed', () => {
    assert.deepEqual(addressOrder(chart), ['1:1', '1:2', '1:3', '2:1', '2:2', '10:1']);
  });

  it('is NOT the bare seat labels — the bug this file exists for', () => {
    const bare = chart.seats.map(s => s.label);
    assert.notDeepEqual(addressOrder(chart), bare);
    // And the miss is total rather than partial, which is why it was silent:
    // not one composed address appears in the flat list.
    for (const address of addressOrder(chart)) assert.ok(!bare.includes(address));
  });

  it('survives a chart with no groups, returning nothing rather than guessing', () => {
    assert.deepEqual(addressOrder({ seats: chart.seats }), []);
    assert.deepEqual(addressOrder(null), []);
  });
});

describe('margin range lookup', () => {
  const order = addressOrder(chart);
  const margin = {
    blocks: [
      { from: '1:1', to: '1:3', text: 'first' },
      { from: '2:1', to: '10:1', text: 'second' },
    ],
  };

  it('finds the block covering an address anywhere in its run', () => {
    for (const a of ['1:1', '1:2', '1:3']) assert.equal(blockAt(margin, a, order)?.text, 'first');
    for (const a of ['2:1', '2:2', '10:1']) assert.equal(blockAt(margin, a, order)?.text, 'second');
  });

  it('orders by the chart, never by the label as a string', () => {
    // "10:1" sorts BEFORE "2:1" as text, and after it in the chart. A lookup
    // that compared labels would put the last container's verse in the first
    // container's block, which reads as a plausible page of the wrong notes.
    assert.ok(order.indexOf('10:1') > order.indexOf('2:1'));
    assert.equal(blockAt(margin, '10:1', order)?.text, 'second');
  });

  it('answers null for an address no block covers, and for nonsense', () => {
    assert.equal(blockAt(margin, '9:9', order), null);
    assert.equal(blockAt(margin, '1:1', []), null);
    assert.equal(blockAt(null, '1:1', order), null);
  });
});
