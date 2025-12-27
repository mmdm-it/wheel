import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createVolumePyramidConfig } from '../src/pyramid/volume-pyramid.js';

describe('createVolumePyramidConfig', () => {
  it('returns null for unknown volume', () => {
    const cfg = createVolumePyramidConfig({ volume: 'unknown' });
    assert.equal(cfg, null);
  });

  it('builds catalog pyramid config and wires callbacks', () => {
    const manifest = { MMdM: {} };
    const parentItem = { id: 'parent' };
    const childItem = { id: 'child' };
    const getCatalogChildren = (m, sel) => {
      assert.equal(m, manifest);
      if (sel === parentItem) return [childItem];
      return [];
    };
    const state = { parent: parentItem };
    const primaryCalls = [];
    const parentButtonCalls = [];
    const app = {
      nav: { getCurrent: () => state.parent },
      setPrimaryItems: (...args) => primaryCalls.push(args),
      setParentButtons: (...args) => parentButtonCalls.push(args)
    };
    let mode = 'manufacturer';
    const config = createVolumePyramidConfig({
      volume: 'catalog',
      manifest,
      getCatalogChildren,
      getApp: () => app,
      catalogModeRef: () => mode,
      setCatalogMode: next => { mode = next; }
    });
    assert.ok(config?.getChildren);
    assert.ok(config?.onClick);
    const children = config.getChildren({ selected: parentItem });
    assert.deepEqual(children, [childItem]);
    config.onClick({ item: childItem });
    assert.equal(mode, 'model');
    assert.equal(primaryCalls.length, 1);
    assert.equal(parentButtonCalls.length, 1);
  });

  it('builds calendar pyramid config and updates mode/context', () => {
    const manifest = { Calendar: { years: {} } };
    const selectedYear = { id: '2001', parentId: 'm1' };
    const childMonth = { id: '2001:01' };
    const getCalendarMonths = (m, year, mode) => {
      assert.equal(m, manifest);
      assert.equal(year, selectedYear);
      assert.equal(mode, 'year');
      return [childMonth];
    };
    let mode = 'year';
    let ctx = null;
    const primaryCalls = [];
    const app = {
      nav: { getCurrent: () => selectedYear },
      setPrimaryItems: (...args) => primaryCalls.push(args),
      setParentButtons: () => {}
    };
    const config = createVolumePyramidConfig({
      volume: 'calendar',
      manifest,
      getCalendarMonths,
      getApp: () => app,
      calendarModeRef: () => mode,
      setCalendarMode: next => { mode = next; },
      setCalendarMonthContext: next => { ctx = next; }
    });
    assert.ok(config);
    const children = config.getChildren({ selected: selectedYear });
    assert.deepEqual(children, [childMonth]);
    config.onClick({ item: childMonth });
    assert.equal(mode, 'month');
    assert.deepEqual(ctx, { yearId: selectedYear.id, millenniumId: selectedYear.parentId });
    assert.equal(primaryCalls.length, 1);
  });

  it('builds bible pyramid config and updates mode/context', () => {
    const manifest = { Gutenberg_Bible: { testaments: {} } };
    const book = { id: 'GEN', sectionId: 'sec1', testamentId: 'old' };
    const childChapter = { id: 'GEN:1' };
    const getBibleChapters = (m, b, names, mode) => {
      assert.equal(m, manifest);
      assert.equal(b, book);
      assert.equal(names, undefined);
      assert.equal(mode, 'book');
      return [childChapter];
    };
    let mode = 'book';
    let ctx = null;
    const primaryCalls = [];
    const app = {
      nav: { getCurrent: () => book },
      setPrimaryItems: (...args) => primaryCalls.push(args),
      setParentButtons: () => {}
    };
    const config = createVolumePyramidConfig({
      volume: 'bible',
      manifest,
      getBibleChapters,
      getApp: () => app,
      bibleModeRef: () => mode,
      setBibleMode: next => { mode = next; },
      setBibleChapterContext: next => { ctx = next; }
    });
    assert.ok(config);
    const children = config.getChildren({ selected: book });
    assert.deepEqual(children, [childChapter]);
    config.onClick({ item: childChapter });
    assert.equal(mode, 'chapter');
    assert.deepEqual(ctx, { bookId: book.id, sectionId: book.sectionId, testamentId: book.testamentId });
    assert.equal(primaryCalls.length, 1);
  });

  it('builds places pyramid config and defers to handlers', () => {
    const manifest = { Places: { regions: {}, root: { children: [] } } };
    const levels = ['country', 'city'];
    const parent = { id: 'us' };
    const child = { id: 'nyc' };
    const placesState = { manifest, levels, levelIndex: 0, selections: {} };
    const buildPlacesLevel = (m, lvls, idx, opts) => {
      assert.equal(m, manifest);
      assert.equal(lvls, levels);
      assert.equal(idx, 1);
      assert.equal(opts.parentItem, parent);
      return { items: [child] };
    };
    let handlerCalls = 0;
    const app = { setPrimaryItems: () => {} };
    const config = createVolumePyramidConfig({
      volume: 'places',
      manifest,
      placesState,
      buildPlacesLevel,
      placesChildrenHandler: () => { handlerCalls += 1; },
      getApp: () => app
    });
    assert.ok(config);
    const children = config.getChildren({ selected: parent });
    assert.deepEqual(children, [child]);
    config.onClick({ item: child });
    assert.equal(handlerCalls, 1);
  });
});
