// The boot overture (arrival in motion, Howell 2026-07-22): the splash's
// rotation beat is DATA-DECLARED — a volume names its overture item in its
// own display config, shared code only ferries the generic key. These tests
// pin that contract: the option surfaces from startup data, volumes without
// the key stay on the classic reveal, and a URL ?item= deep link still wins
// as the home the overture glides to.

import { describe, it } from 'node:test';
import assert from 'node:assert';

const params = entries => new URLSearchParams(entries);

describe('splash overture — data-declared, volume-agnostic', () => {
  it('the first volume config surfaces splash_overture_item from startup data', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const cfg = volumeConfigs.catalog; // the manifold volume — the only overture so far
    const options = cfg.buildOptions({
      params: params(''),
      startup: {
        initial_magnified_item: 'Home Item',
        top_navigation_level: 'manufacturer',
        splash_overture_item: 'Overture Item'
      },
      arrangements: {}
    });
    assert.equal(options.splashOvertureItem, 'Overture Item');
    assert.equal(options.initialItemId, 'Home Item');
  });

  it('without the key the option is null — the classic reveal', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const cfg = volumeConfigs.catalog;
    const options = cfg.buildOptions({
      params: params(''),
      startup: { initial_magnified_item: 'Home Item', top_navigation_level: 'manufacturer' },
      arrangements: {}
    });
    assert.equal(options.splashOvertureItem, null);
  });

  it('a ?item= deep link stays the home item; the overture key rides alongside', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const cfg = volumeConfigs.catalog;
    const options = cfg.buildOptions({
      params: params('item=Deep+Link'),
      startup: { initial_magnified_item: 'Home Item', splash_overture_item: 'Overture Item' },
      arrangements: {}
    });
    assert.equal(options.initialItemId, 'Deep Link');
    assert.equal(options.splashOvertureItem, 'Overture Item');
  });

  it('the real volume data declares an overture that exists in its own chain', async () => {
    const fs = await import('node:fs');
    const manifest = JSON.parse(fs.readFileSync(new URL('../data/mmdm/mmdm_catalog.json', import.meta.url)));
    const top = manifest[Object.keys(manifest)[0]];
    const startup = top.display_config.focus_ring_startup;
    assert.ok(startup.splash_overture_item, 'overture item declared');
    assert.ok(startup.initial_magnified_item, 'home item declared');
    assert.notEqual(startup.splash_overture_item, startup.initial_magnified_item,
      'the overture must travel — it cannot already be home');
    const { buildCatalogManufacturers } = await import('../src/adapters/volume-helpers.js');
    const chain = buildCatalogManufacturers(manifest, {});
    const names = (chain.items || []).filter(Boolean).map(i => i.name || i.id);
    assert.ok(names.includes(startup.splash_overture_item), 'overture item is in the chain');
    assert.ok(names.includes(startup.initial_magnified_item), 'home item is in the chain');
  });
});
