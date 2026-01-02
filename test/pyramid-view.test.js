import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { buildPyramidInstructions, PyramidView } from '../src/view/detail/pyramid-view.js';

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

function createMockElement(tag) {
  const children = [];
  const element = {
    tag,
    attrs: {},
    style: {},
    parentNode: null,
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name]; },
    removeAttribute(name) { delete this.attrs[name]; },
    appendChild(node) { children.push(node); node.parentNode = this; return node; },
    removeChild(node) { const idx = children.indexOf(node); if (idx >= 0) children.splice(idx, 1); },
    get firstChild() { return children[0]; },
    get children() { return children; }
  };
  return element;
}

function createMockDocument() {
  return {
    createElementNS(ns, tag) { return createMockElement(tag); }
  };
}

describe('PyramidView rendering', () => {
  it('renders fan lines, spiral, and intersections while hiding nodes', () => {
    const doc = createMockDocument();
    const root = createMockElement('g');
    const view = new PyramidView(root, doc);
    view.init();

    const data = {
      fanLines: [
        { id: 0, x1: 0, y1: 0, x2: 10, y2: 0 },
        { id: 1, x1: 0, y1: 0, x2: 0, y2: 10 }
      ],
      spiral: { path: 'M 0 0 L 5 5' },
      intersections: [{ x: 2, y: 2 }, { x: 3, y: 3 }]
    };

    view.render(data);

    assert.ok(!view.pyramidGroup.getAttribute('display'));
    assert.equal(view.pyramidFanLinesGroup.children.length, 2);
    assert.equal(view.pyramidSpiralGroup.children.length, 1 + data.intersections.length * 2);
    assert.equal(view.pyramidNodesGroup.getAttribute('display'), 'none');
    assert.equal(view.pyramidLabelsGroup.getAttribute('display'), 'none');
  });

  it('clears and hides when no data', () => {
    const doc = createMockDocument();
    const root = createMockElement('g');
    const view = new PyramidView(root, doc);
    view.init();

    view.render(null);
    assert.equal(view.pyramidGroup.getAttribute('display'), 'none');
    assert.equal(view.pyramidFanLinesGroup.children.length, 0);
    assert.equal(view.pyramidSpiralGroup.children.length, 0);
  });
});
