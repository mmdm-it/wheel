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

  it('rejects invalid manifest switches and keeps prior volume', async () => {
    const events = [];

    const goodAdapter = {
      volumeId: 'good',
      async loadManifest() {
        return { items: [{ id: 'good-a', label: 'Good A' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'good' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const badAdapter = {
      volumeId: 'bad',
      async loadManifest() {
        return { items: [{ id: 'bad-a', label: 'Bad A' }] };
      },
      validate() {
        return { ok: false, errors: ['missing meta'] };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'bad' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({ adapter: goodAdapter, onEvent: evt => events.push(evt.type) });

    await assert.rejects(() => bridge.setVolume(badAdapter, { focusId: 'bad-a' }), /manifest validation failed/i);

    assert.equal(bridge.getVolumeId(), 'good');
    assert.equal(bridge.getFocusedId(), 'good-a');
    assert.ok(bridge.items.find(item => item.id === 'good-a'));
    assert.ok(events.includes('volume-load:error'));
    assert.ok(events.includes('volume-switch:error'));
  });

  it('hydrates deep links on the current volume via adapter resolver', async () => {
    const events = [];

    const adapter = {
      volumeId: 'dl-current',
      async loadManifest() {
        return { items: [{ id: 'dl-a', label: 'DL A' }, { id: 'dl-b', label: 'DL B' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'dl-current' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: { deepLink: true },
      resolveDeepLink(link) {
        return { focusId: link === 'pick-b' ? 'dl-b' : 'dl-a' };
      }
    };

    const bridge = await createStoreNavigationBridge({ adapter, onEvent: evt => events.push(evt.type) });

    const ok = await bridge.hydrateDeepLink('pick-b');

    assert.equal(ok, true);
    assert.equal(bridge.getVolumeId(), 'dl-current');
    assert.equal(bridge.getFocusedId(), 'dl-b');
    assert.ok(events.includes('deep-link:start'));
    assert.ok(events.includes('deep-link:success'));
  });

  it('hydrates deep links by switching volumes when adapter differs', async () => {
    const events = [];

    const adapterOne = {
      volumeId: 'one',
      async loadManifest() {
        return { items: [{ id: 'one-a', label: 'One A' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'one' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const adapterTwo = {
      volumeId: 'two',
      async loadManifest() {
        return { items: [{ id: 'two-a', label: 'Two A' }, { id: 'two-b', label: 'Two B' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'two' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: { deepLink: true },
      resolveDeepLink(link) {
        return { focusId: link === 'two-b' ? 'two-b' : 'two-a' };
      }
    };

    const bridge = await createStoreNavigationBridge({ adapter: adapterOne, onEvent: evt => events.push(evt.type) });

    const ok = await bridge.hydrateDeepLink('two-b', { adapter: adapterTwo });

    assert.equal(ok, true);
    assert.equal(bridge.getVolumeId(), 'two');
    assert.equal(bridge.getFocusedId(), 'two-b');
    assert.ok(events.includes('deep-link:start'));
    assert.ok(events.includes('deep-link:success'));
    assert.ok(events.includes('volume-switch:start'));
    assert.ok(events.includes('volume-switch:complete'));
  });

  it('supports rotation → volume switch → rotation without stale nav state', async () => {
    const adapterOne = {
      volumeId: 'rot-one',
      async loadManifest() {
        return { items: [{ id: 'r1-a', label: 'R1 A' }, { id: 'r1-b', label: 'R1 B' }, { id: 'r1-c', label: 'R1 C' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'rot-one' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const adapterTwo = {
      volumeId: 'rot-two',
      async loadManifest() {
        return { items: [{ id: 'r2-a', label: 'R2 A' }, { id: 'r2-b', label: 'R2 B' }, { id: 'r2-c', label: 'R2 C' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'rot-two' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({ adapter: adapterOne });

    // rotate forward once on volume one
    bridge.nav.selectOffset(1);
    assert.equal(bridge.getFocusedId(), 'r1-b');

    // switch volumes and carry focusId
    await bridge.setVolume(adapterTwo, { focusId: 'r2-b' });
    assert.equal(bridge.getVolumeId(), 'rot-two');
    assert.equal(bridge.getFocusedId(), 'r2-b');

    // rotate again after switch; ensure new items drive nav
    bridge.nav.selectOffset(1);
    assert.equal(bridge.getFocusedId(), 'r2-c');
  });
});
