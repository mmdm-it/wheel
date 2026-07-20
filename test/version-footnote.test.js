import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCatalogManufacturers } from '../src/adapters/volume-helpers.js';
import { FocusRingView } from '../src/view/focus-ring-view.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readJson = async relative => {
  const abs = path.resolve(__dirname, '..', relative);
  const raw = await readFile(abs, 'utf-8');
  return JSON.parse(raw);
};

// THE VERSION FOOTNOTE (Howell 2026-07-20): a factory stamp at the end of
// the manufacturers chain — four empty links past the last real link, then
// one placebo node carrying the build's version. The stamp must be present,
// index-aligned (the long-chain fast path's contract), and structurally
// unreachable: bounds anchor on the last REAL link, snap never seats it,
// deep links never resolve to it, and the rendered node is inert ink.

describe('version footnote — chain shape', () => {
  let chain;

  beforeEach(async () => {
    const manifest = await readJson('data/mmdm/mmdm_catalog.json');
    chain = buildCatalogManufacturers(manifest);
  });

  it('ends the chain with four gaps then one placebo stamp', () => {
    const { items } = chain;
    const last = items[items.length - 1];
    assert.equal(last?.placebo, true, 'last link should be the placebo stamp');
    assert.ok(last.name, 'the stamp carries a version string');
    for (let i = 2; i <= 5; i += 1) {
      assert.equal(items[items.length - i], null, `link ${i - 1} before the stamp should be a gap`);
    }
    const beforeGaps = items[items.length - 6];
    assert.ok(beforeGaps && !beforeGaps.placebo, 'the last real link precedes the gaps');
  });

  it('keeps the chain index-aligned for the long-chain fast path', () => {
    const { items } = chain;
    items.forEach((item, idx) => {
      if (item === null) return;
      assert.equal(item.order, idx, `order must equal index at ${idx}`);
    });
  });

  it('never resolves a deep link to the placebo stamp', async () => {
    const manifest = await readJson('data/mmdm/mmdm_catalog.json');
    const { items, selectedIndex } = buildCatalogManufacturers(manifest, { initialItemId: 'version-footnote' });
    assert.equal(items[selectedIndex]?.placebo, undefined, 'selection must land on a real item');
    assert.equal(selectedIndex, 0, 'an unmatchable target falls back to the first item');
  });
});

describe('version footnote — rendered node is inert ink', () => {
  const originalDocument = globalThis.document;
  let view;

  beforeEach(() => {
    globalThis.document = createMockDocument();
    view = new FocusRingView(createMockElement('svg'));
    view.init();
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  const renderNodes = (nodes, options = {}) => {
    view.render(nodes, { hubX: 0, hubY: 0, radius: 100 }, { startAngle: 0, endAngle: Math.PI },
      { x: 0, y: 0, radius: 12, angle: 0 }, { magnifierAngle: 0, labelMaskEpsilon: 0.1, ...options });
  };

  const placeboNode = (over = {}) => ({
    item: { id: 'version-footnote', name: '3.11.0', placebo: true },
    x: 10, y: 10, radius: 12, angle: 1.2, label: '3.11.0', ...over
  });

  it('renders without role, tab stop, click, or aria exposure', () => {
    let activated = 0;
    renderNodes([placeboNode()], { onNodeClick: () => { activated += 1; } });
    const el = view.nodesGroup.children[0];
    assert.equal(el.getAttribute('role'), null);
    assert.equal(el.getAttribute('tabindex'), null);
    assert.equal(el.getAttribute('aria-hidden'), 'true');
    assert.equal(el.onclick, null);
    assert.equal(el.onkeydown, null);
    assert.equal(activated, 0);
  });

  it('wears the placebo costume on node and label', () => {
    renderNodes([placeboNode()]);
    const el = view.nodesGroup.children[0];
    const label = view.labelsGroup.children[0];
    assert.equal(el.classList.contains('is-placebo'), true);
    assert.equal(label.classList.contains('is-placebo'), true);
    assert.equal(label.textContent, '3.11.0');
    // The stamp's numerals sit ON the node (centered), hub-rotated.
    assert.equal(label.getAttribute('text-anchor'), 'middle');
    assert.ok(String(label.getAttribute('transform')).startsWith('translate(10, 10)'),
      'label transform centers on the node');
  });

  it('keeps the unselected node radius — no magnifier-approach swell', () => {
    // A real node this close to the magnifier during rotation swells toward
    // the peak scale; the stamp must not.
    renderNodes([placeboNode({ angle: 0.001 })], { isRotating: true, magnifierAngle: 0, labelMaskEpsilon: 0.5 });
    const el = view.nodesGroup.children[0];
    assert.equal(Number(el.getAttribute('r')), 12, 'placebo radius stays the base node radius');
  });

  it('a real node still activates and carries ARIA alongside the stamp', () => {
    let activated = 0;
    renderNodes([
      { item: { id: 'zvezda', name: 'ZVEZDA' }, x: 5, y: 5, radius: 12, angle: 2.0, label: 'ZVEZDA' },
      placeboNode()
    ], { onNodeClick: () => { activated += 1; } });
    const real = view.nodesGroup.children[0];
    assert.equal(real.getAttribute('role'), 'button');
    assert.equal(real.getAttribute('tabindex'), '0');
    real.onkeydown({ key: 'Enter', preventDefault() {} });
    assert.equal(activated, 1);
  });
});
