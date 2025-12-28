import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { FocusRingView } from '../src/view/focus-ring-view.js';

function createMockElement(tag) {
  const listeners = {};
  const children = [];
  const element = {
    tag,
    attrs: {},
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    parentNode: null,
    textContent: '',
    onclick: null,
    onkeydown: null,
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    setAttributeNS(ns, name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    getAttribute(name) {
      return this.attrs[name];
    },
    appendChild(node) {
      const idx = children.indexOf(node);
      if (idx >= 0) children.splice(idx, 1);
      children.push(node);
      node.parentNode = this;
      return node;
    },
    removeChild(node) {
      const idx = children.indexOf(node);
      if (idx >= 0) {
        children.splice(idx, 1);
        node.parentNode = null;
      }
    },
    get children() {
      return children;
    },
    addEventListener(event, handler) {
      listeners[event] = handler;
    },
    dispatchEvent(event) {
      const handler = listeners[event.type];
      if (handler) handler(event);
    }
  };
  return element;
}

function createMockDocument() {
  return {
    createElementNS(ns, tag) {
      return createMockElement(tag);
    }
  };
}

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

  it('activates pyramid nodes via keyboard', () => {
    let activated = 0;
    view.render([], { hubX: 0, hubY: 0, radius: 100 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      pyramidInstructions: [{ id: 'p1', x: 5, y: 5, r: 6, label: 'Node P1' }],
      onPyramidClick: () => { activated += 1; },
      magnifierAngle: 0,
      labelMaskEpsilon: 0
    });

    const node = view.pyramidNodesGroup.children[0];
    assert.equal(node.getAttribute('role'), 'button');
    assert.equal(node.getAttribute('tabindex'), '0');
    const evt = { key: ' ', preventDefault() { this.prevented = true; } };
    node.onkeydown(evt);
    assert.equal(activated, 1);
    assert.equal(evt.prevented, true);
  });

  it('activates dimension and parent buttons via keyboard', () => {
    let dimensionClicks = 0;
    let outerClicks = 0;
    let innerClicks = 0;
    const viewport = { SSd: 800, LSd: 800, height: 800 };
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Alpha' }
    ], { hubX: 100, hubY: 100, radius: 120 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      viewport,
      magnifierAngle: 0,
      labelMaskEpsilon: 0,
      dimensionIcon: {
        href: '#',
        x: 20,
        y: 20,
        size: 10,
        onClick: () => { dimensionClicks += 1; }
      },
      parentButtons: {
        showOuter: true,
        showInner: true,
        onOuterClick: () => { outerClicks += 1; },
        onInnerClick: () => { innerClicks += 1; },
        outerLabel: 'Parent',
        innerLabel: 'Children',
        isLayerOut: false
      }
    });

    const dimension = view.dimensionIcon;
    const outer = view.parentButtonOuter;
    const inner = view.parentButtonInner;

    const keyEvt = key => ({ key, preventDefault() { this.prevented = true; } });
    dimension.onkeydown(keyEvt('Enter'));
    outer.onkeydown(keyEvt(' '));
    inner.onkeydown(keyEvt('Enter'));

    assert.equal(dimensionClicks, 1);
    assert.equal(outerClicks, 1);
    assert.equal(innerClicks, 1);
  });

  it('applies aria-labels from labels/meta for primary, secondary, and pyramid nodes', () => {
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Primary Label' }
    ], { hubX: 0, hubY: 0, radius: 100 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      magnifierAngle: 0,
      labelMaskEpsilon: 0,
      secondary: {
        nodes: [
          { item: { id: 's1', name: 'Secondary' }, x: 12, y: 12, radius: 10, angle: 0.1, label: 'Secondary Label', index: 0 }
        ],
        isRotating: false,
        magnifierAngle: 0,
        labelMaskEpsilon: 0
      },
      pyramidInstructions: [{ id: 'p1', x: 5, y: 5, r: 6, label: 'Pyramid Label' }]
    });

    const primary = view.nodesGroup.children[0];
    const secondary = view.mirroredNodesGroup.children[0];
    const pyramid = view.pyramidNodesGroup.children[0];

    assert.equal(primary.getAttribute('aria-label'), 'Primary Label');
    assert.equal(secondary.getAttribute('aria-label'), 'Secondary Label');
    assert.equal(pyramid.getAttribute('aria-label'), 'Pyramid Label');
  });

  it('marks focusable controls with tabindex for keyboard order', () => {
    const viewport = { SSd: 800, LSd: 800, height: 800 };
    view.render([
      { item: { id: 'a', name: 'Alpha' }, x: 10, y: 10, radius: 12, angle: 0, label: 'Alpha' }
    ], { hubX: 100, hubY: 100, radius: 120 }, { startAngle: 0, endAngle: Math.PI }, { x: 0, y: 0, radius: 12, angle: 0 }, {
      viewport,
      magnifierAngle: 0,
      labelMaskEpsilon: 0,
      secondary: {
        nodes: [
          { item: { id: 's1', name: 'Secondary' }, x: 12, y: 12, radius: 10, angle: 0.1, label: 'Secondary Label', index: 0 }
        ],
        isRotating: false,
        magnifierAngle: 0,
        labelMaskEpsilon: 0
      },
      pyramidInstructions: [{ id: 'p1', x: 5, y: 5, r: 6, label: 'Pyramid Label' }],
      dimensionIcon: { href: '#', x: 20, y: 20, size: 10, onClick: () => {} },
      parentButtons: {
        showOuter: true,
        showInner: true,
        onOuterClick: () => {},
        onInnerClick: () => {},
        outerLabel: 'Parent',
        innerLabel: 'Children',
        isLayerOut: false
      }
    });

    const focusables = [
      view.nodesGroup.children[0],
      view.mirroredNodesGroup.children[0],
      view.pyramidNodesGroup.children[0],
      view.dimensionIcon,
      view.parentButtonOuter,
      view.parentButtonInner
    ];

    focusables.forEach(el => {
      assert.equal(el.getAttribute('tabindex'), '0');
    });
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
      secondary: {
        nodes: [
          { item: { id: 's1', name: 'Secondary' }, x: 12, y: 12, radius: 10, angle: 0.1, label: 'Secondary Label', index: 0 }
        ],
        isRotating: false,
        magnifierAngle: 0,
        labelMaskEpsilon: 0,
        onNodeClick: () => {}
      },
      pyramidInstructions: [{ id: 'p1', x: 5, y: 5, r: 6, label: 'Pyramid Label' }],
      dimensionIcon: { href: '#', x: 20, y: 20, size: 10, onClick: () => {} },
      parentButtons: {
        showOuter: true,
        showInner: true,
        onOuterClick: () => {},
        onInnerClick: () => {},
        outerLabel: 'Parent',
        innerLabel: 'Children',
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
        const cls = el.getAttribute ? el.getAttribute('class') : '';
        const aria = el.getAttribute ? el.getAttribute('aria-label') : '';
        const dataId = el.dataset?.id;
        if (name === 'parent-outer') return aria === 'Parent';
        if (name === 'parent-inner') return aria === 'Children';
        if (name === 'node-a') return id === 'focus-node-a';
        if (name === 'node-b') return id === 'focus-node-b';
        if (name === 'pyramid') return dataId === 'p1';
        if (name === 'secondary') return id === 'secondary-node-s1';
        if (name === 'dimension') return cls?.includes('dimension-button');
        return false;
      });
    };

    assert(idx('parent-outer') >= 0, 'missing parent outer button');
    assert(idx('parent-inner') >= 0, 'missing parent inner button');
    assert(idx('node-a') >= 0 && idx('node-b') >= 0, 'missing primary nodes');
    assert(idx('pyramid') >= 0, 'missing pyramid node');
    assert(idx('secondary') >= 0, 'missing secondary node');
    assert(idx('dimension') >= 0, 'missing dimension button');

    const orderChecks = [
      ['parent-outer', 'parent-inner'],
      ['parent-inner', 'node-a'],
      ['node-a', 'node-b'],
      ['node-b', 'pyramid'],
      ['pyramid', 'secondary'],
      ['secondary', 'dimension']
    ];

    orderChecks.forEach(([first, second]) => {
      assert(idx(first) < idx(second), `${first} should precede ${second} in tab order`);
    });
  });
});
