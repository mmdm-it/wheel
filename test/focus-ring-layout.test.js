import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { catalogAdapter } from '../src/adapters/catalog-adapter.js';
import { buildFocusRingLayout } from '../src/core/focus-ring-layout.js';

const finite = value => Number.isFinite(value);

describe('focus-ring-layout', () => {
  it('builds node positions from adapter output', async () => {
    const manifest = await catalogAdapter.loadManifest();
    const validation = catalogAdapter.validate(manifest);
    assert.ok(validation.ok, `expected manifest to validate: ${validation.errors?.join('; ')}`);

    const normalized = catalogAdapter.normalize(manifest);
    const layoutSpec = catalogAdapter.layoutSpec(normalized);

    const { nodes, arcParams, viewportWindow, magnifier } = buildFocusRingLayout({ normalized, layoutSpec });

    assert.ok(nodes.length > 0, 'expected nodes');
    nodes.forEach(node => {
      assert.ok(finite(node.x) && finite(node.y), 'node coordinates must be finite');
      assert.ok(finite(node.angle), 'node angle must be finite');
      assert.equal(typeof node.label, 'string');
    });
    assert.ok(finite(arcParams.hubX) && finite(arcParams.hubY), 'arc params finite');
    assert.ok(finite(viewportWindow.startAngle) && finite(viewportWindow.endAngle), 'viewport window finite');
    assert.ok(finite(magnifier.x) && finite(magnifier.y), 'magnifier position finite');
  });
});
