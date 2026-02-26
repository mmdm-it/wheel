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
  it('renders connector lines and visible nodes when nodes are provided', () => {
    const doc = createMockDocument();
    const root = createMockElement('g');
    const view = new PyramidView(root, doc);
    view.init();

    const data = {
      magnifierOrigin: { x: 0, y: 0 },
      nodes: [
        { x: 10, y: 0, r: 9, label: 'Node A', angle: 0 },
        { x: 0, y: 10, r: 9, label: 'Node B', angle: Math.PI / 2 }
      ]
    };

    view.render(data);

    // Pyramid group is visible
    assert.ok(!view.pyramidGroup.getAttribute('display'));
    // Connector fan-lines drawn from magnifier origin to each node
    assert.equal(view.pyramidFanLinesGroup.children.length, 2);
    // Nodes and labels are visible
    assert.equal(view.pyramidNodesGroup.children.length, 2);
    assert.equal(view.pyramidLabelsGroup.children.length, 2);
    assert.ok(!view.pyramidNodesGroup.getAttribute('display'));
    assert.ok(!view.pyramidLabelsGroup.getAttribute('display'));
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
