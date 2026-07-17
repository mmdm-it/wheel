import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { weaveCousinChain, buildCalendarMonthsCousinChain, COUSIN_GAP_LINKS } from '../src/adapters/volume-helpers.js';
import { calculateNodePositions, getViewportInfo, getNodeSpacing, getViewportWindow, getBaseAngleForOrder } from '../src/geometry/focus-ring-geometry.js';

// The cousin-gap grammar (Howell, 2026-07-17): whatever level rides the
// ring, ancestor boundaries above it gap by rank — 2/4/6/8 empty links for
// 1st..4th cousins, highest crossed rank wins.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../data/calendar/manifest.json'), 'utf-8'));

describe('cousin gap grammar', () => {
  it('ladder is 2/4/6/8', () => {
    assert.deepEqual(COUSIN_GAP_LINKS, [2, 4, 6, 8]);
  });

  it('highest crossed rank wins the gap', () => {
    const items = weaveCousinChain(
      [{ id: 'a', g1: 1, g2: 1 }, { id: 'b', g1: 2, g2: 1 }, { id: 'c', g1: 3, g2: 2 }],
      [item => item.g1, item => item.g2]
    );
    // a [2 gaps: rank1] b [4 gaps: rank2 crossing wins] c
    assert.deepEqual(items.map(i => (i ? i.id : '·')).join(''), 'a··b····c');
  });

  it('orders equal indices, gaps included (fast-path contract)', () => {
    const items = weaveCousinChain(
      [{ id: 'a', g: 1 }, { id: 'b', g: 2 }],
      [item => item.g]
    );
    items.forEach((item, idx) => { if (item) assert.equal(item.order, idx); });
  });
});

describe('months cousin chain', () => {
  const { items } = buildCalendarMonthsCousinChain(manifest, { initialItemId: '1969:jan' });

  const gapRunBefore = id => {
    const idx = items.findIndex(item => item && item.id === id);
    let run = 0;
    for (let i = idx - 1; i >= 0 && items[i] === null; i -= 1) run += 1;
    return run;
  };

  it('holds every month of every year on one chain', () => {
    assert.equal(items.filter(Boolean).length, 72000);
  });

  it('gaps by cousin rank: year 2, century 4, millennium 6', () => {
    assert.equal(gapRunBefore('1969:jan'), 2, 'Dec 1968 → Jan 1969 = cousins');
    assert.equal(gapRunBefore('1969:feb'), 0, 'no gap inside a year');
    assert.equal(gapRunBefore('1901:jan'), 4, 'century crossing = second cousins');
    assert.equal(gapRunBefore('2001:jan'), 6, 'millennium crossing = third cousins');
    assert.equal(gapRunBefore('1:jan'), 6, 'the BC/AD line is a millennium crossing');
  });

  it('lands the requested month', () => {
    const { items: chain, selectedIndex } = buildCalendarMonthsCousinChain(manifest, { initialItemId: '1969:jul' });
    assert.equal(chain[selectedIndex]?.id, '1969:jul');
  });
});

describe('long-chain render fast path', () => {
  it('windowed scan matches a naive full sweep on the months chain', () => {
    const { items } = buildCalendarMonthsCousinChain(manifest, {});
    const vp = getViewportInfo(412, 915); // Moto G viewport
    const spacing = getNodeSpacing(vp);
    const windowInfo = getViewportWindow(vp, spacing);

    // Naive reference: the same window filter, walked over the whole chain.
    const naiveVisible = rotation => {
      const out = [];
      items.forEach((item, index) => {
        if (item === null) return;
        const order = Number.isFinite(item.order) ? item.order : index;
        const angle = getBaseAngleForOrder(order, vp, spacing) + rotation;
        if (angle >= windowInfo.startAngle && angle <= windowInfo.endAngle) out.push(index);
      });
      return out;
    };

    // Chain start, deep middle, and chain end (positive rotation advances
    // the chain past the magnifier).
    [0, 40000 * spacing, (items.length - 5) * spacing].forEach(rotation => {
      const fast = calculateNodePositions(items, vp, rotation, 10, spacing);
      assert.deepEqual(fast.map(n => n.index), naiveVisible(rotation), `rotation ${rotation}`);
      fast.forEach(node => assert.equal(items[node.index], node.item));
    });
  });
});
