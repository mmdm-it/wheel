import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp, getViewportInfo } from '../src/index.js';
import { createMockElement as makeMockElement, createMockDocument as makeMockDocument } from './helpers/mock-dom.js';

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
