import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FocusRingView } from '../src/view/focus-ring-view.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';

describe('FocusRingView accessibility', () => {
  const originalDocument = globalThis.document;
  let mockDocument;
  let svgRoot;
  let view;

  beforeEach(() => {
    mockDocument = createMockDocument();
    globalThis.document = mockDocument;
    svgRoot = createMockElement('svg');
    view = new FocusRingView(svgRoot);
    view.init();
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('activates primary nodes via keyboard and carries ARIA', () => {
    let activated = 0;
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Alpha' }
    ], { hubX: 0, hubY: 0, radius: 100 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      onNodeClick: () => { activated += 1; },
      magnifierAngle: 0,
      labelMaskEpsilon: 0
    });

    const node = view.nodesGroup.children[0];
    assert.equal(node.getAttribute('role'), 'button');
    assert.equal(node.getAttribute('tabindex'), '0');
    const evt = { key: 'Enter', preventDefault() { this.prevented = true; } };
    node.onkeydown(evt);
    assert.equal(activated, 1);
    assert.equal(evt.prevented, true);
  });

  it('activates the parent button via keyboard', () => {
    let outerClicks = 0;
    const viewport = { SSd: 800, LSd: 800, height: 800 };
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Alpha' }
    ], { hubX: 100, hubY: 100, radius: 120 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      viewport,
      magnifierAngle: 0,
      labelMaskEpsilon: 0,
      parentButtons: {
        showOuter: true,
        onOuterClick: () => { outerClicks += 1; },
        outerLabel: 'Parent',
        isLayerOut: false
      }
    });

    const outer = view.parentButtonOuter;
    const keyEvt = key => ({ key, preventDefault() { this.prevented = true; } });
    outer.onkeydown(keyEvt(' '));

    assert.equal(outerClicks, 1);
  });

  it('applies aria-labels from labels/meta for primary nodes', () => {
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Primary Label' }
    ], { hubX: 0, hubY: 0, radius: 100 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      magnifierAngle: 0,
      labelMaskEpsilon: 0
    });

    const primary = view.nodesGroup.children[0];

    assert.equal(primary.getAttribute('aria-label'), 'Primary Label');
    assert.equal(view.pyramidNodesGroup.children.length, 0);
  });

  it('marks focusable controls with tabindex for keyboard order', () => {
    const viewport = { SSd: 800, LSd: 800, height: 800 };
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Alpha' }
    ], { hubX: 100, hubY: 100, radius: 120 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      viewport,
      magnifierAngle: 0,
      labelMaskEpsilon: 0,
      parentButtons: {
        showOuter: true,
        onOuterClick: () => {},
        outerLabel: 'Parent',
        isLayerOut: false
      }
    });

    const focusables = [
      view.nodesGroup.children[0],
      view.parentButtonOuter
    ];

    focusables.forEach(el => {
      assert.equal(el.getAttribute('tabindex'), '0');
    });

    assert.equal(view.pyramidNodesGroup.children.length, 0);
  });

  it('maintains predictable focus order across controls', () => {
    const viewport = { SSd: 800, LSd: 800, height: 800 };
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Alpha' },
      { item: { id: 'b', name: 'Beta' }, x: 20, y: 20, radius: 12, angle: 0.2, label: 'Beta' }
    ], { hubX: 100, hubY: 100, radius: 120 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      viewport,
      magnifierAngle: 0,
      labelMaskEpsilon: 0,
      parentButtons: {
        showOuter: true,
        onOuterClick: () => {},
        outerLabel: 'Parent',
        isLayerOut: false
      }
    });

    const collectTabbables = node => {
      const order = [];
      const walk = el => {
        if (!el) return;
        if (el.getAttribute && el.getAttribute('tabindex') === '0') order.push(el);
        if (Array.isArray(el.children)) el.children.forEach(child => walk(child));
      };
      walk(node);
      return order;
    };

    const tabbables = collectTabbables(svgRoot);
    const idx = name => {
      return tabbables.findIndex(el => {
        const id = el.getAttribute ? el.getAttribute('id') : null;
        const aria = el.getAttribute ? el.getAttribute('aria-label') : '';
        if (name === 'parent-outer') return aria === 'Parent';
        if (name === 'node-a') return id === 'focus-node-a';
        if (name === 'node-b') return id === 'focus-node-b';
        return false;
      });
    };

    assert(idx('parent-outer') >= 0, 'missing parent outer button');
    assert(idx('node-a') >= 0 && idx('node-b') >= 0, 'missing primary nodes');
    assert(idx('pyramid') === -1, 'pyramid nodes should be hidden');

    const orderChecks = [
      ['parent-outer', 'node-a'],
      ['node-a', 'node-b']
    ];

    orderChecks.forEach(([first, second]) => {
      assert(idx(first) < idx(second), `${first} should precede ${second} in tab order`);
    });
  });
});
