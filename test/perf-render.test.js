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
    get children() { return children; },
    get firstChild() { return children[0] || null; },
    classList: { toggle() {}, add() {}, remove() {} },
    parentNode: null,
    textContent: '',
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

describe('perf render telemetry', () => {
  const originalDocument = globalThis.document;
  const originalPerformance = globalThis.performance;

  it('emits perf:render with budget flag', () => {
    globalThis.document = makeMockDocument();
    try {
      const events = [];
      const svgRoot = makeMockElement('svg');
      const items = [
        { id: 'a', name: 'Alpha', order: 0 },
        { id: 'b', name: 'Beta', order: 1 }
      ];
      const viewport = getViewportInfo(800, 600);

      createApp({
        svgRoot,
        items,
        viewport,
        contextOptions: {
          onEvent: evt => events.push(evt),
          perfRenderBudgetMs: 1,
          debugPerf: false
        }
      });

      const perfEvents = events.filter(e => e?.type === 'perf:render');
      assert.ok(perfEvents.length >= 1, 'expected perf:render event');
      perfEvents.forEach(evt => {
        assert.ok(typeof evt.durationMs === 'number');
        assert.equal(evt.budgetMs, 1);
        assert.ok(typeof evt.overBudget === 'boolean');
      });
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('flags over-budget renders when duration exceeds budget', () => {
    let perfCall = 0;
    globalThis.document = makeMockDocument();
    globalThis.performance = { now: () => (++perfCall === 1 ? 1000 : 1008) };
    try {
      const events = [];
      const svgRoot = makeMockElement('svg');
      const items = [
        { id: 'a', name: 'Alpha', order: 0 },
        { id: 'b', name: 'Beta', order: 1 }
      ];
      const viewport = getViewportInfo(800, 600);

      createApp({
        svgRoot,
        items,
        viewport,
        contextOptions: {
          onEvent: evt => events.push(evt),
          perfRenderBudgetMs: 5,
          debugPerf: false
        }
      });

      const overBudgetEvents = events.filter(e => e?.type === 'perf:render' && e.overBudget === true);
      assert.ok(overBudgetEvents.length >= 1, 'expected over-budget perf:render event');
      overBudgetEvents.forEach(evt => {
        assert.equal(evt.budgetMs, 5);
        assert.ok(evt.durationMs >= 8);
      });
    } finally {
      globalThis.document = originalDocument;
      globalThis.performance = originalPerformance;
    }
  });
});
