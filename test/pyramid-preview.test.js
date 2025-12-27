import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';
import { buildPyramidPreview } from '../src/core/pyramid-preview.js';

describe('buildPyramidPreview', () => {
  const viewport = getViewportInfo(800, 600);
  const mkChildren = count => Array.from({ length: count }, (_, idx) => ({ id: `c-${idx}`, name: `child-${idx}`, order: idx }));

  it('returns instructions when children available', () => {
    const selected = { id: 'parent-1' };
    const getChildren = () => mkChildren(6);
    const instructions = buildPyramidPreview({ viewport, selected, getChildren });

    assert.ok(instructions.length > 0, 'expected instructions');
    instructions.forEach(instr => {
      assert.equal(typeof instr.id, 'string');
      assert.equal(typeof instr.label, 'string');
      assert.ok(Number.isFinite(instr.x));
      assert.ok(Number.isFinite(instr.y));
    });
  });

  it('uses custom sampler and builder when provided', () => {
    const selected = { id: 'parent-2' };
    const getChildren = () => mkChildren(4);
    const called = { sample: false, build: false };
    const instructions = buildPyramidPreview({
      viewport: { width: 640, height: 360 },
      selected,
      getChildren,
      pyramidConfig: {
        sample: (children) => {
          called.sample = true;
          return children.slice(0, 2);
        },
        buildInstructions: placements => {
          called.build = true;
          return placements.map(p => ({ ...p, id: `custom-${p.item.id}` }));
        }
      }
    });

    assert.equal(called.sample, true);
    assert.equal(called.build, true);
    assert.equal(instructions.length, 2);
    instructions.forEach(instr => assert.ok(instr.id.startsWith('custom-')));
  });

  it('derives children from normalized items when no getter provided', () => {
    const normalized = {
      items: [
        { id: 'parent', name: 'Parent' },
        { id: 'child-a', name: 'Child A', parentId: 'parent' },
        { id: 'child-b', name: 'Child B', parentId: 'parent' }
      ],
      links: [{ from: 'parent', to: 'child-a' }, { from: 'parent', to: 'child-b' }]
    };

    const instructions = buildPyramidPreview({ viewport, selected: { id: 'parent' }, normalized });

    assert.equal(instructions.length, 2);
    assert.deepEqual(instructions.map(i => i.id).sort(), ['child-a', 'child-b']);
  });

  it('uses adapter layoutSpec pyramid config when available', () => {
    const normalized = {
      items: [
        { id: 'parent', name: 'Parent' },
        { id: 'child-a', name: 'Child A', parentId: 'parent' },
        { id: 'child-b', name: 'Child B', parentId: 'parent' }
      ]
    };
    const calls = { layout: false, sample: false, place: false, build: false };
    const adapter = {
      layoutSpec: (norm, vp) => {
        calls.layout = true;
        assert.equal(norm, normalized);
        assert.ok(vp?.width);
        return {
          pyramid: {
            capacity: { total: 1, arcs: [] },
            sample: siblings => {
              calls.sample = true;
              return siblings.slice(0, 1);
            },
            place: siblings => {
              calls.place = true;
              return siblings.map((sibling, idx) => ({ item: sibling, x: idx + 1, y: idx + 2, angle: 0.1 + idx, arc: 'inner' }));
            },
            buildInstructions: placements => {
              calls.build = true;
              return placements.map(p => ({ ...p, id: `via-${p.item.id}` }));
            }
          }
        };
      }
    };

    const instructions = buildPyramidPreview({ viewport, selected: { id: 'parent' }, normalized, adapter });

    assert.ok(calls.layout);
    assert.ok(calls.sample);
    assert.ok(calls.place);
    assert.ok(calls.build);
    assert.equal(instructions.length, 1);
    assert.equal(instructions[0].id, 'via-child-a');
  });

  it('returns empty list when no children', () => {
    const instructions = buildPyramidPreview({ viewport, selected: null, getChildren: () => [] });
    assert.deepEqual(instructions, []);
  });
});
