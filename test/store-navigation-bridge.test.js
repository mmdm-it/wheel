import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { createStoreNavigationBridge } from '../src/core/store-navigation-bridge.js';
import { interactionEvents } from '../src/core/interaction-store.js';

const VM_ID = 'manufacturer:VM Motori';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const assertOrder = (events, expected) => {
  let cursor = -1;
  for (const label of expected) {
    const nextIdx = events.indexOf(label, cursor + 1);
    assert.ok(nextIdx !== -1, `expected event ${label} after index ${cursor}`);
    cursor = nextIdx;
  }
};

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

  it('handles a burst of rapid switches and leaves the last volume active', async () => {
    const events = [];

    const mkAdapter = (id, delay = 1) => ({
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

    const bridge = await createStoreNavigationBridge({ adapter: mkAdapter('base'), onEvent: evt => events.push(evt.type) });

    const switches = [
      bridge.setVolume(mkAdapter('v1', 10)),
      bridge.setVolume(mkAdapter('v2', 9)),
      bridge.setVolume(mkAdapter('v3', 8)),
      bridge.setVolume(mkAdapter('v4', 2)),
      bridge.setVolume(mkAdapter('v5', 1))
    ];

    const results = await Promise.all(switches);

    assert.equal(results[0].volumeId, 'v1');
    assert.equal(results.at(-1).volumeId, 'v5');
    assert.equal(bridge.getVolumeId(), 'v5');
    assert.ok(events.includes('volume-switch:queued'));
    assert.ok(events.filter(e => e === 'volume-switch:complete').length >= 2);
  });

  it('emits error telemetry with adapter context when manifest load throws', async () => {
    const events = [];

    const goodAdapter = {
      volumeId: 'good-load',
      async loadManifest() {
        return { items: [{ id: 'g-a', label: 'G A' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'good-load' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const badAdapter = {
      volumeId: 'bad-load',
      async loadManifest() {
        throw new Error('load failed');
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'bad-load' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({ adapter: goodAdapter, onEvent: evt => events.push(evt) });
    events.length = 0;

    await assert.rejects(() => bridge.setVolume(badAdapter), /load failed/);

    assert.equal(bridge.getVolumeId(), 'good-load');
    const types = events.map(e => e.type);
    assert.ok(types.includes('volume-load:error'));
    assert.ok(types.includes('volume-switch:error'));
    const loadErr = events.find(e => e.type === 'volume-load:error');
    assert.equal(loadErr.adapter.volumeId, 'bad-load');
    assert.ok(bridge.store.getState().error instanceof Error);
  });

  it('sets and clears store error state around failed and successful switches', async () => {
    const goodAdapter = {
      volumeId: 'err-good',
      async loadManifest() {
        return { items: [{ id: 'g', label: 'G' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'err-good' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const badAdapter = {
      volumeId: 'err-bad',
      async loadManifest() {
        throw new Error('explode');
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'err-bad' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({ adapter: goodAdapter });
    assert.equal(bridge.store.getState().error, null);

    await assert.rejects(() => bridge.setVolume(badAdapter), /explode/);
    assert.ok(bridge.store.getState().error instanceof Error);

    await bridge.setVolume(goodAdapter);
    assert.equal(bridge.store.getState().error, null);
  });

  it('invokes onError callback and emits store:error when error state changes', async () => {
    const events = [];
    const errors = [];

    const goodAdapter = {
      volumeId: 'good',
      async loadManifest() {
        return { items: [{ id: 'g', label: 'G' }] };
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
        throw new Error('bad-load');
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'bad' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({
      adapter: goodAdapter,
      onEvent: evt => events.push(evt.type),
      onError: (error, meta) => errors.push({ error, meta })
    });

    await assert.rejects(() => bridge.setVolume(badAdapter), /bad-load/);

    assert.ok(events.includes('store:error'));
    assert.ok(errors[0].error instanceof Error);
    assert.equal(errors[0].meta.cleared, false);
    assert.equal(errors[0].meta.volumeId, 'bad');

    await bridge.setVolume(goodAdapter);

    const final = errors.at(-1);
    assert.equal(final.error, null);
    assert.equal(final.meta.cleared, true);
    assert.equal(final.meta.volumeId, 'good');
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

  it('emits ordered telemetry for successful volume switch', async () => {
    const events = [];

    const adapterOne = {
      volumeId: 'tele-one',
      async loadManifest() {
        return { items: [{ id: 'a', label: 'A' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'tele-one' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const adapterTwo = {
      volumeId: 'tele-two',
      async loadManifest() {
        return { items: [{ id: 'b', label: 'B' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'tele-two' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({ adapter: adapterOne, onEvent: evt => events.push(evt) });
    events.length = 0; // ignore initial load events

    await bridge.setVolume(adapterTwo, { focusId: 'b' });

    const types = events.map(e => e.type);
    assertOrder(types, [
      'volume-switch:start',
      'volume-load:start',
      'volume-load:validate:start',
      'volume-load:validate:success',
      'volume-load:success',
      'volume-switch:complete'
    ]);

    const start = events.find(e => e.type === 'volume-switch:start');
    const complete = events.find(e => e.type === 'volume-switch:complete');
    const success = events.find(e => e.type === 'volume-load:success');

    assert.equal(start.from, 'tele-one');
    assert.equal(complete.to, 'tele-two');
    assert.equal(success.volumeId, 'tele-two');
  });

  it('emits error telemetry and no completion on failed switch', async () => {
    const events = [];

    const goodAdapter = {
      volumeId: 'tele-good',
      async loadManifest() {
        return { items: [{ id: 'g', label: 'G' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'tele-good' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const badAdapter = {
      volumeId: 'tele-bad',
      async loadManifest() {
        return { items: [{ id: 'b', label: 'B' }] };
      },
      validate() {
        return { ok: false, errors: ['no meta'] };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'tele-bad' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({ adapter: goodAdapter, onEvent: evt => events.push(evt) });
    events.length = 0; // ignore initial load events

    await assert.rejects(() => bridge.setVolume(badAdapter), /manifest validation failed/i);

    const types = events.map(e => e.type);
    assert.ok(types.includes('volume-switch:error'));
    assert.ok(types.includes('volume-load:error'));
    assert.ok(!types.includes('volume-switch:complete'));
    assertOrder(types, ['volume-switch:start', 'volume-load:start', 'volume-load:validate:start', 'volume-load:error', 'volume-switch:error']);

    const errEvt = events.find(e => e.type === 'volume-switch:error');
    assert.ok(errEvt?.error instanceof Error);
    assert.equal(bridge.getVolumeId(), 'tele-good');
  });

  it('emits deep-link error telemetry when resolver cannot resolve', async () => {
    const events = [];

    const adapter = {
      volumeId: 'dl-fail',
      async loadManifest() {
        return { items: [{ id: 'x', label: 'X' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'dl-fail' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: { deepLink: true },
      resolveDeepLink() {
        return null;
      }
    };

    const bridge = await createStoreNavigationBridge({ adapter, onEvent: evt => events.push(evt) });
    events.length = 0;

    const ok = await bridge.hydrateDeepLink('missing');

    assert.equal(ok, false);
    assert.equal(bridge.getFocusedId(), 'x');
    const types = events.map(e => e.type);
    assert.ok(types.includes('deep-link:error'));
    assertOrder(types, ['deep-link:start', 'deep-link:error']);
    const errEvt = events.find(e => e.type === 'deep-link:error');
    assert.ok(errEvt?.error instanceof Error);
  });

  it('emits deep-link error telemetry when resolver throws', async () => {
    const events = [];

    const adapter = {
      volumeId: 'dl-throw',
      async loadManifest() {
        return { items: [{ id: 'y', label: 'Y' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'dl-throw' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: { deepLink: true },
      resolveDeepLink() {
        throw new Error('resolver blew up');
      }
    };

    const bridge = await createStoreNavigationBridge({ adapter, onEvent: evt => events.push(evt) });
    events.length = 0;

    await assert.rejects(() => bridge.hydrateDeepLink('any'), /blew up/);

    const types = events.map(e => e.type);
    assertOrder(types, ['deep-link:start', 'deep-link:error']);
    const errEvt = events.find(e => e.type === 'deep-link:error');
    assert.ok(errEvt?.error instanceof Error);
    assert.equal(bridge.getVolumeId(), 'dl-throw');
    assert.equal(bridge.getFocusedId(), 'y');
  });

  it('rejects a queued switch when validation fails and leaves active volume intact', async () => {
    const events = [];

    const adapterOne = {
      volumeId: 'queue-base',
      async loadManifest() {
        return { items: [{ id: 'base-a', label: 'Base A' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'queue-base' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const slowGood = {
      volumeId: 'queue-good',
      async loadManifest() {
        await sleep(10);
        return { items: [{ id: 'good-a', label: 'Good A' }] };
      },
      validate() {
        return { ok: true };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'queue-good' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const badAdapter = {
      volumeId: 'queue-bad',
      async loadManifest() {
        return { items: [{ id: 'bad-a', label: 'Bad A' }] };
      },
      validate() {
        return { ok: false, errors: ['bad'] };
      },
      normalize(raw) {
        return { items: raw.items, meta: { volumeId: 'queue-bad' } };
      },
      layoutSpec() {
        return {};
      },
      capabilities: {}
    };

    const bridge = await createStoreNavigationBridge({ adapter: adapterOne, onEvent: evt => events.push(evt.type) });

    const firstSwitch = bridge.setVolume(slowGood);
    const badSwitch = bridge.setVolume(badAdapter);

    const firstResult = await firstSwitch;
    await assert.rejects(badSwitch, /manifest validation failed/i);

    assert.equal(firstResult.volumeId, 'queue-good');
    assert.equal(bridge.getVolumeId(), 'queue-good');
    assert.ok(events.includes('volume-switch:error'));
    assert.ok(events.includes('volume-load:error'));
  });

  it('keeps only the last of multiple queued switches and cancels earlier ones', async () => {
    const events = [];

    const mkAdapter = (id, delay = 5) => ({
      volumeId: id,
      async loadManifest() {
        await sleep(delay);
        return { items: [{ id: `${id}-a`, label: `${id}-A` }] };
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

    const bridge = await createStoreNavigationBridge({ adapter: mkAdapter('base'), onEvent: evt => events.push(evt.type) });

    const first = bridge.setVolume(mkAdapter('two', 20));
    const second = bridge.setVolume(mkAdapter('three', 10));
    const third = bridge.setVolume(mkAdapter('four', 1));

    const firstResult = await first;
    const secondResult = await second;
    const thirdResult = await third;

    assert.equal(firstResult.volumeId, 'two');
    assert.equal(secondResult.cancelled, true);
    assert.equal(thirdResult.volumeId, 'four');
    assert.equal(bridge.getVolumeId(), 'four');

    assert.ok(events.includes('volume-switch:queued'));
    assert.ok(events.includes('volume-switch:cancelled'));
    assert.ok(events.filter(e => e === 'volume-switch:complete').length === 2); // first and last only
  });

  it('survives sustained rapid switch/rotation bursts without stale state', async () => {
    const events = [];

    const mkAdapter = (id, delay = 2) => ({
      volumeId: id,
      async loadManifest() {
        await sleep(delay);
        return {
          items: [
            { id: `${id}-a`, label: `${id}-A` },
            { id: `${id}-b`, label: `${id}-B` },
            { id: `${id}-c`, label: `${id}-C` }
          ]
        };
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

    const bridge = await createStoreNavigationBridge({ adapter: mkAdapter('seed'), onEvent: evt => events.push(evt.type) });
    events.length = 0;

    const requests = [];
    for (let i = 1; i <= 50; i += 1) {
      const volumeId = `stress-${i}`;
      const focusId = `${volumeId}-b`;

      bridge.store.dispatch({ type: interactionEvents.HOVER, hoverId: `hover-${i}` });
      bridge.nav.selectOffset(1);
      requests.push(bridge.setVolume(mkAdapter(volumeId, (i % 5) + 1), { focusId }));
    }

    const results = await Promise.all(requests);
    const lastResult = results.at(-1);

    assert.equal(lastResult.volumeId, 'stress-50');
    assert.equal(bridge.getVolumeId(), 'stress-50');
    assert.equal(bridge.getFocusedId(), 'stress-50-b');
    assert.equal(bridge.store.getState().hoverId, null);

    const completes = events.filter(t => t === 'volume-switch:complete').length;
    assert.ok(completes >= 2, 'expected multiple completed switches');
    assert.ok(events.includes('volume-switch:queued'));
    assert.ok(events.includes('volume-switch:cancelled'));
  });

  it('hydrates deep links while a prior switch is in flight without stale focus', async () => {
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
      capabilities: { deepLink: true },
      resolveDeepLink(link) {
        return { focusId: `${id}-${link}` };
      }
    });

    const base = mkAdapter('base');
    const slow = mkAdapter('slow', 25);
    const target = mkAdapter('target', 1);

    const bridge = await createStoreNavigationBridge({ adapter: base, onEvent: evt => events.push(evt) });
    events.length = 0;

    const slowSwitch = bridge.setVolume(slow, { focusId: 'slow-b' });
    const hydrated = await bridge.hydrateDeepLink('b', { adapter: target });

    assert.equal(hydrated, true);
    assert.equal(bridge.getVolumeId(), 'target');
    assert.equal(bridge.getFocusedId(), 'target-b');
    assert.equal(bridge.store.getState().hoverId, null);

    const types = events.map(e => e.type);
    assert.ok(types.includes('deep-link:start'));
    assert.ok(types.includes('deep-link:success'));
    assert.ok(types.includes('volume-switch:start'));
    assert.ok(types.includes('volume-switch:complete'));

    const completes = events.filter(e => e.type === 'volume-switch:complete');
    assert.equal(completes.at(-1)?.to, 'target');

    const slowResult = await slowSwitch;
    assert.equal(slowResult.volumeId, 'slow');
  });

});
