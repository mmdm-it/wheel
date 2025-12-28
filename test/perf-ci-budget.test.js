import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp, getViewportInfo } from '../src/index.js';
import { createStoreNavigationBridge } from '../src/core/store-navigation-bridge.js';

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

function makeAdapter(id = 'perf-ci') {
  return {
    volumeId: id,
    async loadManifest() {
      return { meta: { id }, items: [{ id: 'a' }] };
    },
    validate(manifest) {
      return { ok: true, manifest };
    },
    normalize(manifest) {
      return { meta: manifest.meta, items: manifest.items };
    }
  };
}

describe('perf CI budgets', () => {
  const originalDocument = globalThis.document;

  it('keeps render duration within CI budget', () => {
    globalThis.document = makeMockDocument();
    try {
      const events = [];
      const svgRoot = makeMockElement('svg');
      const items = [
        { id: 'a', name: 'Alpha', order: 0 },
        { id: 'b', name: 'Beta', order: 1 }
      ];
      const viewport = getViewportInfo(800, 600);
      const renderBudget = Number(process.env.CI_PERF_RENDER_BUDGET_MS || 50);

      createApp({
        svgRoot,
        items,
        viewport,
        contextOptions: {
          onEvent: evt => events.push(evt),
          perfRenderBudgetMs: renderBudget,
          debugPerf: false
        }
      });

      const renderEvents = events.filter(e => e?.type === 'perf:render');
      assert.ok(renderEvents.length >= 1, 'expected perf:render event');
      renderEvents.forEach(evt => {
        assert.ok(evt.durationMs <= renderBudget, `render ${evt.durationMs}ms exceeded budget ${renderBudget}ms`);
        assert.equal(evt.overBudget, false);
      });
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('keeps manifest phases within CI budget', async () => {
    const events = [];
    const manifestBudget = Number(process.env.CI_PERF_MANIFEST_BUDGET_MS || 50);
    await createStoreNavigationBridge({ adapter: makeAdapter(), onEvent: evt => events.push(evt) });

    const perfEvents = events.filter(e => e?.type === 'perf:manifest');
    assert.ok(perfEvents.length >= 3, 'expected perf:manifest events');
    perfEvents.forEach(evt => {
      assert.ok(evt.durationMs <= manifestBudget, `manifest ${evt.phase} ${evt.durationMs}ms exceeded budget ${manifestBudget}ms`);
    });
  });
});
