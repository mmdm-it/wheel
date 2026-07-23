import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createVolumePyramidConfig,
  buildCatalogPyramid,
  buildCalendarPyramid,
  buildBiblePyramid,
  buildPlacesPyramid
} from '../src/pyramid/volume-pyramid.js';
import { createVolumeLayoutSpec } from '../src/adapters/volume-layout.js';

describe('createVolumePyramidConfig', () => {
  it('returns null when no builder is provided', () => {
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
      pyramidBuilder: buildCatalogPyramid,
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
    assert.equal(mode, 'child');
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
      pyramidBuilder: buildCalendarPyramid,
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
    assert.deepEqual(ctx, { yearId: selectedYear.id });
    assert.equal(primaryCalls.length, 1);
  });

  it('calendar pyramid click lands in the months COUSIN chain when the binding is provided — through the real layout-spec plumbing', () => {
    // Regression: getCalendarMonthChain was once dropped by the explicit
    // whitelists in main.js/volume-layout.js, silently reverting months
    // mode to 12 siblings. This goes through createVolumeLayoutSpec so a
    // future whitelist drop fails here.
    const manifest = { Calendar: { years: {} } };
    const selectedYear = { id: '1969', parentId: null };
    const clickedMonth = { id: '1969:jul' };
    const chainItems = [null, { id: '1969:jun' }, { id: '1969:jul' }, { id: '1969:aug' }, null];
    const primaryCalls = [];
    const app = {
      nav: { getCurrent: () => selectedYear },
      setPrimaryItems: (...args) => primaryCalls.push(args),
      setParentButtons: () => {}
    };
    let mode = 'year';
    const spec = createVolumeLayoutSpec({
      volume: 'calendar',
      pyramidBuilder: buildCalendarPyramid,
      manifest,
      getCalendarMonths: () => [clickedMonth],
      getCalendarMonthChain: monthId => ({
        items: chainItems,
        selectedIndex: chainItems.findIndex(i => i && i.id === monthId)
      }),
      getApp: () => app,
      calendarModeRef: () => mode,
      setCalendarMode: next => { mode = next; },
      setCalendarMonthContext: () => {}
    });
    spec.pyramid.onClick({ item: clickedMonth });
    assert.equal(mode, 'month');
    assert.equal(primaryCalls.length, 1);
    const [items, selectedIdx] = primaryCalls[0];
    assert.equal(items, chainItems, 'ring receives the cousin chain, not the 12 siblings');
    assert.equal(selectedIdx, 2, 'clicked month selected at its global chain index');
  });

  it('wedge day tap pours the day chain into the ring — through the real layout-spec plumbing', () => {
    // Regression: getCalendarDayChain was dropped by the volume-layout.js
    // invocation whitelist (the getCalendarMonthChain trap, again) — taps
    // in the wedge silently no-oped. This goes through createVolumeLayoutSpec
    // so a future whitelist drop fails here.
    const manifest = { Calendar: {} };
    const tappedDay = { id: 'd:2026:7:19', level: 'day', yearNumber: 2026, monthNumber: 7, dayNumber: 19 };
    const chainItems = [null, { id: 'd:2026:7:18' }, { id: 'd:2026:7:19' }, { id: 'd:2026:7:20' }, null];
    const primaryCalls = [];
    const app = {
      setPrimaryItems: (...args) => primaryCalls.push(args),
      setParentButtons: () => {}
    };
    let mode = 'month';
    const spec = createVolumeLayoutSpec({
      volume: 'calendar',
      pyramidBuilder: buildCalendarPyramid,
      manifest,
      getCalendarMonths: () => [],
      getCalendarDayChain: centerId => ({
        items: chainItems,
        selectedIndex: chainItems.findIndex(i => i && i.id === centerId)
      }),
      getApp: () => app,
      calendarModeRef: () => mode,
      setCalendarMode: next => { mode = next; }
    });
    spec.pyramid.onClick({ item: tappedDay });
    assert.equal(mode, 'day');
    assert.equal(primaryCalls.length, 1);
    const [items, selectedIdx] = primaryCalls[0];
    assert.equal(items, chainItems, 'ring receives the day chain');
    assert.equal(selectedIdx, 2, 'tapped day selected at its chain index');

    // Weekday header cells stay inert.
    spec.pyramid.onClick({ item: { id: 'wd:3', level: 'weekday' } });
    assert.equal(primaryCalls.length, 1, 'header tap does nothing');
  });

  it('hands the wedge its column headers through the real layout-spec plumbing', () => {
    // The third binding to run this gauntlet (getCalendarMonthChain, then
    // getCalendarDayChain): a binding dropped by either whitelist fails
    // silently — here the lattice would quietly keep its built-in row and
    // a translated volume would show English headers over Italian prose.
    const manifest = { Calendar: {} };
    const spec = createVolumeLayoutSpec({
      volume: 'calendar',
      pyramidBuilder: buildCalendarPyramid,
      manifest,
      getCalendarMonths: () => [],
      getWeekdayLetters: () => ['D', 'L', 'M', 'M', 'G', 'V', 'S'],
      getApp: () => null,
      calendarModeRef: () => 'month'
    });
    const grid = spec.pyramid.gridFor({
      selected: { id: '2026:jul', level: 'month', yearNumber: 2026, monthNumber: 7 }
    });
    assert.deepEqual(grid.weekdayLetters, ['D', 'L', 'M', 'M', 'G', 'V', 'S'],
      'the volume names its own columns');
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
      pyramidBuilder: buildBiblePyramid,
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

  it('testament sky seats siblings only — cousins stay in the ring', () => {
    // The books chain is the whole volume (the sweep), but the child pyramid
    // is a preview of the MAGNIFIED testament's OWN books: Genesis and
    // Matthew are cousins, not siblings (Howell 2026-07-20).
    const manifest = { Gutenberg_Bible: { testaments: {} } };
    const sweepChain = [
      { id: 'GEN', testamentId: 'old', level: 'book' },
      { id: 'MAL', testamentId: 'old', level: 'book' },
      null, null,
      { id: 'MT', testamentId: 'new', level: 'book' },
      { id: 'APOC', testamentId: 'new', level: 'book' }
    ];
    const config = createVolumePyramidConfig({
      volume: 'bible',
      pyramidBuilder: buildBiblePyramid,
      manifest,
      getBibleChapters: () => [],
      getBibleBooksForTestament: () => ({ items: sweepChain }),
      getApp: () => null,
      bibleModeRef: () => 'testament'
    });
    const oldSky = config.getChildren({ selected: { id: 'old', level: 'testament' } });
    assert.deepEqual(oldSky.map(c => c.id), ['GEN', 'MAL'], 'old testament sky holds only its own books');
    const newSky = config.getChildren({ selected: { id: 'new', level: 'testament' } });
    assert.deepEqual(newSky.map(c => c.id), ['MT', 'APOC'], 'new testament sky holds only its own books');
  });

  it('a loaded-but-empty chapter never re-prefetches — the Esther hot loop', () => {
    // Esther 1–7 and 9–16 ship as verse-less stubs; re-requesting a
    // loaded-empty chapter fired onLoaded synchronously → refreshPyramid →
    // render → request again, grinding the Moto G to a near-crash
    // (Phase C, 2026-07-20). Terminal cache states must render an empty
    // sky and ask nothing.
    const chapter = { id: 'ESTH:1', level: 'chapter', meta: { externalFile: 'data/x/ESTH/001.json' } };
    const calls = [];
    const makeConfig = status => createVolumePyramidConfig({
      volume: 'bible',
      pyramidBuilder: buildBiblePyramid,
      manifest: { Gutenberg_Bible: { testaments: {} } },
      getBibleChapters: () => [],
      getBibleVerseItems: () => [],
      getBibleVerseCacheStatus: () => status,
      prefetchBibleVerses: (item, opts) => calls.push(status),
      getApp: () => null,
      bibleModeRef: () => 'chapter'
    });
    makeConfig('loaded').getChildren({ selected: chapter });
    makeConfig('error').getChildren({ selected: chapter });
    assert.deepEqual(calls, [], 'terminal states never re-request');
    makeConfig(null).getChildren({ selected: chapter });
    makeConfig('loading').getChildren({ selected: chapter });
    assert.deepEqual(calls, [null, 'loading'], 'unrequested and in-flight states do request');
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
      pyramidBuilder: buildPlacesPyramid,
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
