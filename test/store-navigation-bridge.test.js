import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { createStoreNavigationBridge } from '../src/core/store-navigation-bridge.js';

const VM_ID = 'manufacturer:VM Motori';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
    const events = [];
    const first = await createStoreNavigationBridge({ onEvent: evt => events.push(evt.type) });

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
    assert.ok(events.includes('volume-load:start'));
    assert.ok(events.includes('volume-load:success'));
    assert.ok(events.includes('volume-switch:start'));
    assert.ok(events.includes('volume-switch:complete'));
  });

  it('queues concurrent volume switches and replaces the queued request', async () => {
    const events = [];

    const mkAdapter = (id, delay = 5) => ({
      volumeId: id,
      async loadManifest() {
        await sleep(delay);
        return { items: [{ id: `${id}-a`, label: `${id}-A` }, { id: `${id}-b`, label: `${id}-B` }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: id } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    });

    const bridge = await createStoreNavigationBridge({ adapter: mkAdapter('one'), onEvent: evt => events.push(evt.type) });

    const firstSwitch = bridge.setVolume(mkAdapter('two', 20), { focusId: 'two-b' });
    const queuedSwitch = bridge.setVolume(mkAdapter('three', 1), { focusId: 'three-a' });
    const replacedSwitch = bridge.setVolume(mkAdapter('four', 1), { focusId: 'four-a' });

    const firstResult = await firstSwitch;
    const queuedResult = await queuedSwitch;
    const replacedResult = await replacedSwitch;

    assert.equal(firstResult.volumeId, 'two');
    assert.equal(queuedResult.cancelled, true);
    assert.equal(replacedResult.volumeId, 'four');
    assert.equal(bridge.getVolumeId(), 'four');
    assert.equal(bridge.getFocusedId(), 'four-a');

    assert.ok(events.includes('volume-switch:queued'));
    assert.ok(events.includes('volume-switch:cancelled'));
    assert.ok(events.includes('volume-switch:complete'));
  });
});
