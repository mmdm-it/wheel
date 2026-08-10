import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp, getViewportInfo } from '../src/index.js';
import { createMockElement as makeMockElement, createMockDocument as makeMockDocument } from './helpers/mock-dom.js';

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

  // THE MANIFEST-PHASE BUDGET WAS DELETED, NOT RE-POINTED (Q9, 0c).
  //
  // It measured `perf:manifest` events, and those were emitted from exactly
  // one place: store-navigation-bridge, the abandoned portal-era loader. The
  // SHIPPING boot path — loadConfig -> fetchManifest in main.js — has never
  // emitted them at all. So this cell was not instrumentation we are losing;
  // it was a budget guarding code nobody runs, reporting green on a path that
  // does not exist. That is worse than no budget, because it answers the
  // question "are manifest phases within budget?" with a number about
  // something else.
  //
  // The render budget above SURVIVES and is untouched: it goes through
  // createApp in src/index.js, which is live.
  //
  // Real manifest-phase instrumentation on the live path is worth having and
  // is NOT smuggled in here — it is O-40, so that adding timing to the boot
  // sequence is a decision with its own number rather than a side effect of a
  // deletion.
});
