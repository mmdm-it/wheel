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

  it('the volume data declares an overture that exists in its own chain', async () => {
    const fs = await import('node:fs');
    const manifest = JSON.parse(fs.readFileSync(new URL('./fixtures/data/mmdm/mmdm_catalog.json', import.meta.url)));
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

// THE SHEET IS OVER EVERYTHING THE READER CAN SEE (O-221). The card stood at
// 340 and the edition's mark was later placed at 401 to clear the detail
// sector, so a boot that landed on a verse behind the card painted "edition
// under review" through it (Howell 2026-10-25: "the disclaimer does appear
// very briefly on the splash page at boot"). The sheet's level is held above
// every stacking level the stylesheet gives the reader's own overlays, and
// below the gates and diagnostic HUDs, which belong above it.
describe('the overture sheet covers every overlay the app owns', () => {
  it('BOOT_SHEET_Z is above each reader-facing z-index in base.css and below the gates', async () => {
    const { BOOT_SHEET_Z } = await import('../src/view/boot-overture.js');
    const fs = await import('node:fs');
    const css = fs.readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');
    const levels = [...css.matchAll(/z-index:\s*(-?\d+)/g)].map(m => Number(m[1]));
    assert.ok(levels.length > 5, 'the stylesheet declares stacking levels');
    const GATE = 9999; // the diagnostic HUDs and the desktop gate start here
    const reader = levels.filter(z => z < GATE);
    const above = levels.filter(z => z >= GATE);
    assert.ok(reader.includes(401), 'the mark and the margin marks sit at 401');
    assert.ok(BOOT_SHEET_Z > Math.max(...reader), `sheet ${BOOT_SHEET_Z} over the reader's overlays (max ${Math.max(...reader)})`);
    assert.ok(BOOT_SHEET_Z < Math.min(...above), 'sheet under the gates and HUDs');
  });
});

describe('a card may set its emblem on a circle (the calendar, 2026-10-28)', () => {
  it('splashRecord carries a declared circle, and only a declared one', async () => {
    const { splashRecord } = await import('../src/view/boot-overture.js');
    const onCircle = splashRecord({ display_config: { splash: { image: 'mmdm_logo', title: '', circle: { stroke: '#194567' } } } }, './data/calendar/');
    assert.deepStrictEqual(onCircle, { imageUrl: './data/calendar/assets/mmdm_logo.png', title: '', circle: { stroke: '#194567' } });
    const bare = splashRecord({ display_config: { splash: { image: 'crown_of_thorns', title: 'Biblia Catholica' } } }, '');
    assert.strictEqual(bare.circle, undefined, 'the Bible card stays bare');
  });
  it('a ring may declare its width and size, the title its face and colour', async () => {
    const { splashRecord } = await import('../src/view/boot-overture.js');
    const r = splashRecord({ display_config: { splash: { image: 'mmdm_logo', title: 'T', title_font: 'Montserrat', title_color: '#f1b800', circle: { stroke: '#000000', width: 1, scale: 0.9 } } } }, '');
    assert.deepStrictEqual(r.circle, { stroke: '#000000', width: 1, scale: 0.9 });
    assert.strictEqual(r.font, 'Montserrat');
    assert.strictEqual(r.color, '#f1b800');
    assert.strictEqual(r.holdMs, undefined, 'no hold declared: the card keeps its own');
    assert.strictEqual(splashRecord({ display_config: { splash: { title: 'T', hold_ms: 2500 } } }, '').holdMs, 2500);
  });
  it('the calendar serves its pictures from its own data', async () => {
    const { volumeConfigs } = await import('../src/volume-configs.js');
    assert.strictEqual(volumeConfigs.calendar.assetBase, './data/calendar/');
  });
});
