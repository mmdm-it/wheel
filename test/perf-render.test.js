import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp, getViewportInfo } from '../src/index.js';
import { createMockElement as makeMockElement, createMockDocument as makeMockDocument } from './helpers/mock-dom.js';

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

  it('keeps dimension toggle renders within budget', () => {
    globalThis.document = makeMockDocument();
    try {
      const events = [];
      const svgRoot = makeMockElement('svg');
      const items = [
        { id: 'a', name: 'Alpha', order: 0 },
        { id: 'b', name: 'Beta', order: 1 }
      ];
      const viewport = getViewportInfo(800, 600);
      const renderBudget = 20;

      const app = createApp({
        svgRoot,
        items,
        viewport,
        contextOptions: {
          onEvent: evt => events.push(evt),
          perfRenderBudgetMs: renderBudget,
          debugPerf: false
        },
        dimensionPortals: {
          languages: {
            items: [{ id: 'english', name: 'English' }, { id: 'latin', name: 'Latina' }],
            defaultId: 'english'
          },
          editions: {
            available: { english: ['NAB', 'DRA'], latin: ['VUL'] },
            default: { english: 'NAB', latin: 'VUL' }
          }
        }
      });

      const icon = app.view?.dimensionIcon;
      assert.ok(icon, 'dimension icon missing');
      icon.onclick(); // language stage
      icon.onclick(); // edition or primary

      const renderEvents = events.filter(e => e?.type === 'perf:render');
      assert.ok(renderEvents.length >= 2, 'expected perf:render events during portal cycle');
      renderEvents.forEach(evt => {
        assert.equal(evt.budgetMs, renderBudget);
        assert.equal(evt.overBudget, false, `render ${evt.durationMs}ms exceeded budget ${renderBudget}ms`);
      });
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
