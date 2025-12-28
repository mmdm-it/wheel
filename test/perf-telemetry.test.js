import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStoreNavigationBridge } from '../src/core/store-navigation-bridge.js';

function makeAdapter(id = 'test-volume') {
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

describe('perf telemetry', () => {
  it('emits perf events for manifest load/validate/normalize', async () => {
    const events = [];
    const adapter = makeAdapter('perf-vol');
    await createStoreNavigationBridge({ adapter, onEvent: evt => events.push(evt) });

    const perfEvents = events.filter(e => e?.type === 'perf:manifest');
    assert.ok(perfEvents.length >= 3, 'expected perf events for load/validate/normalize');
    const phases = new Set(perfEvents.map(e => e.phase));
    ['load', 'validate', 'normalize'].forEach(phase => {
      assert.ok(phases.has(phase), `missing perf phase ${phase}`);
    });
    perfEvents.forEach(evt => {
      assert.equal(evt.volumeId, 'perf-vol');
      assert.equal(evt.adapter, adapter);
      assert.ok(typeof evt.durationMs === 'number');
    });
  });
});
