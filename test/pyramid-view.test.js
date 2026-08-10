import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { buildPyramidInstructions, PyramidView } from '../src/view/detail/pyramid-view.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';

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
    // Fan lines retired (Tufte erasure, 2026-07-25): none are drawn
    assert.equal(view.pyramidFanLinesGroup.children.length, 0);
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

// Q10 (0c): the render skip. Every render used to clear five groups and
// recreate every node and label — roughly 110 SVG create/destroy operations
// per scrub frame, paid most often while the ring turns and the pyramid shows
// the same children it showed a frame ago.
describe('PyramidView skips a render that changes nothing (Q10)', () => {
  const mkData = (x = 10, onNodeClick = null) => ({
    nodes: [
      { id: 'a', label: 'A', x, y: 20, r: 9, angle: 0.5 },
      { id: 'b', label: 'B', x: x + 5, y: 25, r: 9, angle: 0.7 }
    ],
    spiral: null,
    intersections: [],
    onNodeClick
  });

  const mount = () => {
    const doc = createMockDocument();
    const view = new PyramidView(createMockElement('g'), doc);
    view.init();
    return view;
  };

  it('an identical second render leaves the subtree untouched', () => {
    const view = mount();
    view.render(mkData());
    const firstCircle = view.pyramidNodesGroup.childNodes[0];
    assert.equal(view.pyramidNodesGroup.childNodes.length, 2);

    view.render(mkData());
    assert.equal(view.pyramidNodesGroup.childNodes.length, 2);
    assert.equal(view.pyramidNodesGroup.childNodes[0], firstCircle,
      'the same element object must survive — a rebuilt one loses its iOS filter');
  });

  it('a changed render still rebuilds', () => {
    const view = mount();
    view.render(mkData(10));
    const firstCircle = view.pyramidNodesGroup.childNodes[0];
    view.render(mkData(99));
    assert.notEqual(view.pyramidNodesGroup.childNodes[0], firstCircle,
      'moved nodes must produce new elements');
  });

  it('the click callback refreshes even when the DOM is skipped', () => {
    // The subtlety the skip must never swallow: the handler is a closure over
    // the caller's current state, so a visually identical frame can still
    // carry a NEW callback. Skipping it leaves taps acting on an older frame.
    const view = mount();
    const first = () => 'first';
    const second = () => 'second';
    view.render(mkData(10, first));
    view.render(mkData(10, second));
    assert.equal(view._onNodeClick, second,
      'a skipped render must still adopt the newer callback');
  });

  it('clearing with no data forces the next render to rebuild', () => {
    const view = mount();
    view.render(mkData());
    view.render(null);
    assert.equal(view.pyramidNodesGroup.childNodes.length, 0);
    view.render(mkData());
    assert.equal(view.pyramidNodesGroup.childNodes.length, 2,
      'an identical payload after a clear must NOT be skipped');
  });
});
