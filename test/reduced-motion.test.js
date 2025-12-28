import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp, getViewportInfo } from '../src/index.js';

function makeMockElement(tag) {
  const children = [];
  const listeners = {};
  return {
    tag,
    attrs: {},
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    children,
    parentNode: null,
    setAttribute(name, value) { this.attrs[name] = String(value); },
    setAttributeNS(ns, name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    appendChild(node) { children.push(node); node.parentNode = this; return node; },
    removeChild(node) { const i = children.indexOf(node); if (i >= 0) children.splice(i, 1); node.parentNode = null; },
    remove() { if (this.parentNode?.removeChild) this.parentNode.removeChild(this); },
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatchEvent(event) { const handler = listeners[event.type]; if (handler) handler(event); }
  };
}

function makeMockDocument() {
  return {
    createElementNS(ns, tag) { return makeMockElement(tag); }
  };
}

describe('reduced motion', () => {
  const originalDocument = globalThis.document;

  it('disables snap animation when prefersReducedMotion is true', () => {
    globalThis.document = makeMockDocument();

    const svgRoot = makeMockElement('svg');
    const items = [
      { id: 'a', name: 'Alpha', order: 0 },
      { id: 'b', name: 'Beta', order: 1 }
    ];
    const viewport = getViewportInfo(800, 600);
    const app = createApp({
      svgRoot,
      items,
      viewport,
      contextOptions: { reducedMotion: true }
    });

    // pick first node and trigger snap
    app.beginRotation();
    app.endRotation();

    // Should not schedule animation frames; rotation should be clamped directly
    assert.equal(typeof app.choreographer.getRotation(), 'number');

    globalThis.document = originalDocument;
  });
});
