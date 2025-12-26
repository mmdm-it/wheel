import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { createAdapterContract, normalizeCapabilities, assertLayoutSpecShape } from '../src/adapters/types.js';

describe('adapter types helpers', () => {
  it('normalizes capabilities to booleans', () => {
    const caps = normalizeCapabilities({ search: 1, deepLink: 'yes' });
    assert.equal(caps.search, true);
    assert.equal(caps.deepLink, true);
    assert.equal(caps.theming, false);
  });

  it('applies normalized capabilities in contract', () => {
    const contract = createAdapterContract({ capabilities: { search: 1, deepLink: 0 } });
    assert.equal(contract.capabilities.search, true);
    assert.equal(contract.capabilities.deepLink, false);
    assert.equal(contract.capabilities.theming, false);
  });

  it('asserts layoutSpec shape', () => {
    const spec = assertLayoutSpecShape({ rings: [] });
    assert.ok(spec);
    assert.throws(() => assertLayoutSpecShape(null));
  });
});
