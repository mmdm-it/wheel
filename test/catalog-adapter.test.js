import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { catalogAdapter, loadManifest, validate, normalize, layoutSpec, detailFor } from '../src/adapters/catalog-adapter.js';
import { getViewportInfo } from '../src/geometry/focus-ring-geometry.js';

describe('catalog adapter', () => {
  it('loads manifest', async () => {
    const manifest = await loadManifest();
    const keys = Object.keys(manifest);
    assert.ok(keys.length > 0, 'manifest should have a volume root');
    assert.ok(manifest.MMdM, 'manifest should include MMdM root');
  });

  it('validates manifest against schema', async () => {
    const manifest = await loadManifest();
    const result = validate(manifest);
    assert.ok(result.ok, `schema validation failed: ${result.errors?.join('; ')}`);
  });

  it('normalizes into items and links', async () => {
    const manifest = await loadManifest();
    const norm = normalize(manifest);
    assert.ok(Array.isArray(norm.items) && norm.items.length > 0, 'normalized items missing');
    assert.ok(Array.isArray(norm.links) && norm.links.length > 0, 'normalized links missing');
    const hasMarket = norm.items.some(i => i.level === 'market');
    const hasManufacturer = norm.items.some(i => i.level === 'manufacturer');
    const hasModel = norm.items.some(i => i.level === 'model');
    assert.ok(hasMarket, 'expected at least one market');
    assert.ok(hasManufacturer, 'expected at least one manufacturer');
    assert.ok(hasModel, 'expected at least one model');
    const vm = norm.items.find(i => i.id.includes('VM Motori') || i.name === 'VM Motori');
    assert.ok(vm, 'expected VM Motori manufacturer');
  });

  it('provides layout spec', async () => {
    const manifest = await loadManifest();
    const norm = normalize(manifest);
    const viewport = getViewportInfo(1200, 900);
    const spec = layoutSpec(norm, viewport);
    assert.ok(spec.rings?.length, 'layout spec should include rings');
    assert.equal(typeof spec.label, 'function');
    assert.equal(typeof spec.colorByLevel, 'function');
    assert.ok(spec.pyramid?.capacity?.total > 0, 'pyramid capacity should be available');
    const siblings = norm.items.filter(i => i.parentId === norm.items[0].id);
    const sampled = spec.pyramid.sample(siblings);
    const placed = spec.pyramid.place(sampled);
    assert.equal(sampled.length, placed.length);
    assert.ok(placed.every(p => Number.isFinite(p.angle) && Number.isFinite(p.x) && Number.isFinite(p.y)));
  });

  it('exports adapter object', () => {
    assert.ok(catalogAdapter.normalize);
    assert.ok(catalogAdapter.layoutSpec);
  });

  it('returns adapter-driven detail payloads', async () => {
    const manifest = await loadManifest();
    const manuf = { id: 'emea__italy__VM Motori', name: 'VM Motori' };
    const detail = detailFor(manuf, manifest);
    assert.equal(detail.type, 'card');
    assert.match(detail.title, /VM Motori/i);
  });
});
