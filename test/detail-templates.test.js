import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DetailPluginRegistry } from '../src/view/detail/plugin-registry.js';
import { TextDetailPlugin } from '../src/view/detail/plugins/text-plugin.js';
import { CardDetailPlugin } from '../src/view/detail/plugins/card-plugin.js';
import { bibleAdapter } from '../src/adapters/bible-adapter.js';
import { catalogAdapter } from '../src/adapters/catalog-adapter.js';
import { calendarAdapter } from '../src/adapters/calendar-adapter.js';
import { placesAdapter } from '../src/adapters/places-adapter.js';
import {
  buildBibleBooks,
  buildCatalogManufacturers,
  buildCalendarYears,
  getCalendarMonths,
  getPlacesLevels,
  buildPlacesLevel
} from '../src/adapters/volume-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readJson = async relative => {
  const abs = path.resolve(__dirname, '..', relative);
  const raw = await readFile(abs, 'utf-8');
  return JSON.parse(raw);
};

const createMockElementFactory = () => {
  const createElement = tag => {
    const node = {
      tag,
      children: [],
      className: '',
      style: {},
      textContent: '',
      appendChild(child) {
        this.children.push(child);
      }
    };
    return node;
  };
  return createElement;
};

const registryWithDefaults = () => {
  const registry = new DetailPluginRegistry();
  registry.register(new CardDetailPlugin());
  registry.register(new TextDetailPlugin());
  return registry;
};

test('bible detail templates render card and text', async () => {
  const manifest = await readJson('data/gutenberg/manifest.json');
  const bookEntry = buildBibleBooks(manifest)[0];
  assert.ok(bookEntry, 'expected at least one book');

  const bookDetail = bibleAdapter.detailFor({ id: bookEntry.id, level: 'book', name: bookEntry.name }, manifest);
  assert.equal(bookDetail?.type, 'card');

  const registry = registryWithDefaults();
  const plugin = registry.getPlugin(bookDetail);
  assert.ok(plugin, 'plugin should resolve for bible book');

  const createElement = createMockElementFactory();
  const rendered = plugin.render(bookDetail, { width: 320, height: 180 }, { createElement });
  assert.equal(rendered.tag, 'div');
  assert.ok(rendered.children.length >= 2, 'card should have title/body children');
  const titleNode = rendered.children.find(child => child?.className?.includes('title'));
  assert.ok(titleNode?.textContent?.length, 'card title should be set');

  // Chapter detail should render as text.
  const chapterDetail = bibleAdapter.detailFor({ id: `${bookEntry.id}:1`, level: 'chapter', name: 'Chapter 1' }, manifest);
  assert.equal(chapterDetail?.type, 'text');
  const textPlugin = registry.getPlugin(chapterDetail);
  assert.ok(textPlugin, 'plugin should resolve for bible chapter');
  const textRendered = textPlugin.render(chapterDetail, { width: 320 }, { createElement });
  assert.equal(textRendered.tag, 'div');
  assert.ok((textRendered.textContent || '').length, 'text content should be populated');
});

test('catalog detail templates render manufacturer card', async () => {
  const manifest = await readJson('data/mmdm/mmdm_catalog.json');
  const { items } = buildCatalogManufacturers(manifest);
  const manufacturer = items[0];
  assert.ok(manufacturer, 'expected at least one manufacturer');

  const detail = catalogAdapter.detailFor({ id: manufacturer.id, level: 'manufacturer', name: manufacturer.name }, manifest);
  assert.equal(detail?.type, 'card');
  const registry = registryWithDefaults();
  const plugin = registry.getPlugin(detail);
  assert.ok(plugin, 'plugin should resolve for catalog manufacturer');

  const createElement = createMockElementFactory();
  const rendered = plugin.render(detail, { width: 360, height: 200 }, { createElement });
  assert.equal(rendered.tag, 'div');
  assert.ok(rendered.children.length >= 2, 'card should contain title/body');
});

test('catalog detail templates render model card from pyramid ids', async () => {
  const manifest = await readJson('data/mmdm/mmdm_catalog.json');
  // Walk manifest to build a model id like model:manufacturer:cylinder:modelKey
  const markets = manifest?.MMdM?.markets || {};
  const firstMarket = Object.values(markets)[0];
  assert.ok(firstMarket, 'expected at least one market');
  const countries = firstMarket?.countries || {};
  const firstCountry = Object.values(countries)[0];
  assert.ok(firstCountry, 'expected at least one country');
  const manufacturers = firstCountry?.manufacturers || {};
  const [manufacturerId, manufacturerVal] = Object.entries(manufacturers)[0] || [];
  assert.ok(manufacturerId && manufacturerVal, 'expected at least one manufacturer entry');
  const cylinders = manufacturerVal?.cylinders || {};
  const [cylKey, cylVal] = Object.entries(cylinders)[0] || [];
  assert.ok(cylKey && cylVal, 'expected at least one cylinder entry');
  const models = Array.isArray(cylVal.models) ? cylVal.models : [];
  const modelIdx = 0;
  const model = models[modelIdx];
  assert.ok(model, 'expected at least one model');
  const modelKey = model.engine_model || `${modelIdx}`;
  const modelId = `model:${manufacturerId}:${cylKey}:${modelKey}`;

  const detail = catalogAdapter.detailFor({ id: modelId, level: 'model', name: model.engine_model || modelId }, manifest);
  assert.equal(detail?.type, 'card');
  const registry = registryWithDefaults();
  const plugin = registry.getPlugin(detail);
  assert.ok(plugin, 'plugin should resolve for catalog model');

  const createElement = createMockElementFactory();
  const rendered = plugin.render(detail, { width: 360, height: 200 }, { createElement });
  assert.equal(rendered.tag, 'div');
  assert.ok(rendered.children.length >= 2, 'card should contain title/body');
});

test('calendar detail templates render year and month cards', async () => {
  const manifest = await readJson('data/calendar/manifest.json');
  const { items: years } = buildCalendarYears(manifest, {});
  const year = years[0];
  assert.ok(year, 'expected at least one year');

  const yearDetail = calendarAdapter.detailFor({ id: year.id, level: 'year', name: year.name }, manifest);
  assert.equal(yearDetail?.type, 'card');

  const registry = registryWithDefaults();
  const plugin = registry.getPlugin(yearDetail);
  assert.ok(plugin, 'plugin should resolve for calendar year');
  const createElement = createMockElementFactory();
  const renderedYear = plugin.render(yearDetail, { width: 320, height: 200 }, { createElement });
  assert.equal(renderedYear.tag, 'div');
  assert.ok(renderedYear.children.length >= 2, 'year card should have title/body');

  const months = getCalendarMonths(manifest, { id: year.id, level: 'year' }, 'year');
  if (months.length) {
    const month = months[0];
    const monthDetail = calendarAdapter.detailFor({ id: month.id, level: 'month', name: month.name }, manifest);
    assert.equal(monthDetail?.type, 'card');
    const monthPlugin = registry.getPlugin(monthDetail);
    assert.ok(monthPlugin, 'plugin should resolve for calendar month');
    const renderedMonth = monthPlugin.render(monthDetail, { width: 320, height: 200 }, { createElement });
    assert.equal(renderedMonth.tag, 'div');
    assert.ok(renderedMonth.children.length >= 2, 'month card should have title/body');
  }
});

test('places detail templates render hierarchical cards', async () => {
  const manifest = await readJson('data/places/manifest.json');
  const levels = getPlacesLevels(manifest);
  assert.ok(levels.length >= 1, 'expected at least one places level');
  const levelIndex = 0;
  const { items } = buildPlacesLevel(manifest, levels, levelIndex, {});
  const place = items[0];
  assert.ok(place, 'expected at least one place item');

  const detail = placesAdapter.detailFor({ id: place.id, level: levels[levelIndex], name: place.name, parentName: place.parentName }, manifest);
  assert.equal(detail?.type, 'card');

  const registry = registryWithDefaults();
  const plugin = registry.getPlugin(detail);
  assert.ok(plugin, 'plugin should resolve for places item');
  const createElement = createMockElementFactory();
  const rendered = plugin.render(detail, { width: 320, height: 200 }, { createElement });
  assert.equal(rendered.tag, 'div');
  assert.ok(rendered.children.length >= 2, 'places card should have title/body');
});
