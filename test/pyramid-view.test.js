import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { buildPyramidInstructions } from '../src/view/detail/pyramid-view.js';

const mkPlacement = (id, x, y, angle, arc = 'inner') => ({
  item: { id, name: `name-${id}` },
  x,
  y,
  angle,
  arc
});

describe('pyramid view helper', () => {
  it('maps placements to render instructions', () => {
    const placements = [
      mkPlacement('a', 10, 20, 0.5, 'inner'),
      mkPlacement('b', 15, 25, 0.7, 'outer')
    ];

    const instructions = buildPyramidInstructions(placements, { nodeRadius: 9 });

    assert.equal(instructions.length, 2);
    assert.deepEqual(instructions[0], {
      id: 'a',
      label: 'name-a',
      item: placements[0].item,
      arc: 'inner',
      angle: 0.5,
      x: 10,
      y: 20,
      r: 9
    });
    assert.equal(instructions[1].arc, 'outer');
    assert.equal(instructions[1].r, 9);
  });

  it('assigns defaults when data missing', () => {
    const instructions = buildPyramidInstructions([{}]);
    assert.equal(instructions[0].id, 'p-0');
    assert.equal(instructions[0].label, 'p-0');
    assert.deepEqual(instructions[0].item, {});
    assert.equal(instructions[0].r, 12);
  });

  it('throws on non-array input', () => {
    assert.throws(() => buildPyramidInstructions(null), /array/);
  });
});
