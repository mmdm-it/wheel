import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAdapterRegistry, createAdapterLoader } from '../src/adapters/registry.js';
import { createAdapterContract } from '../src/adapters/types.js';

describe('adapter registry', () => {
  it('registers and resolves adapters by id', () => {
    const registry = createAdapterRegistry();
    const loader = createAdapterLoader(registry);
    const factory = () => createAdapterContract({ capabilities: { search: true } });
    registry.register('demo', factory);

    assert.deepEqual(registry.list(), ['demo']);
    const adapter = loader.load('demo');
    assert.ok(adapter);
    assert.equal(adapter.capabilities.search, true);
  });

  it('returns null for missing adapters', () => {
    const registry = createAdapterRegistry();
    const loader = createAdapterLoader(registry);
    const adapter = loader.load('missing');
    assert.equal(adapter, null);
  });

  it('unregisters via disposer', () => {
    const registry = createAdapterRegistry();
    const factory = () => createAdapterContract({});
    const dispose = registry.register('demo', factory);
    assert.equal(registry.list().length, 1);
    dispose();
    assert.equal(registry.list().length, 0);
  });
});
