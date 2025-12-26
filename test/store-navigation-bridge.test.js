import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { createStoreNavigationBridge } from '../src/core/store-navigation-bridge.js';

const VM_ID = 'manufacturer:VM Motori';

describe('store-navigation-bridge (catalog)', () => {
  it('loads manifest, normalizes, and exposes items', async () => {
    const bridge = await createStoreNavigationBridge();
    assert.ok(bridge.items.length > 0, 'expected items');
    assert.ok(bridge.normalized.items.length > 0, 'expected normalized items');
  });

  it('focusById updates store and nav', async () => {
    const bridge = await createStoreNavigationBridge();
    const ok = bridge.focusById(VM_ID);
    assert.ok(ok, 'expected focusById to succeed');
    assert.equal(bridge.getFocusedId(), VM_ID);
    assert.equal(bridge.nav.getCurrent().id, VM_ID);
  });

  it('returns false for unknown id', async () => {
    const bridge = await createStoreNavigationBridge();
    const initialFocused = bridge.getFocusedId();
    const ok = bridge.focusById('manufacturer:does-not-exist');
    assert.equal(ok, false);
    assert.equal(bridge.getFocusedId(), initialFocused);
  });

  it('supports volume switching and updates store', async () => {
    const first = await createStoreNavigationBridge();

    // Stub a second adapter that looks like catalog but is distinct by volume id.
    const secondAdapter = {
      volumeId: 'second-volume',
      async loadManifest() {
        return {
          items: [
            { id: 'alpha', label: 'Alpha' },
            { id: 'beta', label: 'Beta' }
          ]
        };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'second-volume' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const result = await first.setVolume(secondAdapter, { focusId: 'beta' });

    assert.equal(first.getVolumeId(), 'second-volume');
    assert.equal(first.getFocusedId(), 'beta');
    assert.equal(result.volumeId, 'second-volume');
    assert.ok(first.items.find(item => item.id === 'alpha'));
  });
});
