import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHandlers as createCalendarHandlers } from '../src/adapters/calendar-adapter.js';
import { createHandlers as createBibleHandlers, buildBibleRootChain } from '../src/adapters/bible-adapter.js';

// Phase B audit L2/H2: the gateway return contract, at the adapter-handler
// level. A volume entered through a gateway must (a) surface its top-level
// OUT button when a gateway label exists, and (b) route that OUT through
// onGatewayReturn. The calendar shipped without this once (PR #25); these
// tests keep both doors two-way.

const calendarManifest = {
  Calendar: {
    display_config: { volume_name: 'Cal', hierarchy_levels: {} },
    month_template: {
      jan: { id: 'jan', name: 'January', month_number: 1 }
    },
    years: {
      y1: { id: 'y1', name: '1', year_number: 1, sort_number: 1 },
      y2: { id: 'y2', name: '2', year_number: 2, sort_number: 2 }
    }
  }
};

function stubApp(state) {
  return {
    setParentButtons: cfg => { state.parentButtons = cfg; },
    setPrimaryItems: (items, idx) => { state.items = items; state.idx = idx; },
    migrateOut: (items, idx) => { state.items = items; state.idx = idx; }
  };
}

describe('gateway round trip (adapter contract)', () => {
  it('calendar: the year ring names the gateway-return destination and OUT goes through the gateway', () => {
    let returned = 0;
    const handlers = createCalendarHandlers({
      manifest: calendarManifest,
      options: { level: 'year' },
      onGatewayReturn: () => { returned += 1; return true; },
      gatewayLabel: 'GREGORIO XIII',
      gatewayReturnLabel: 'MMdM CATALOGO'
    });
    const state = {};
    const app = stubApp(state);
    assert.equal(handlers.getParentLabel({ id: 'y1', level: 'year' }), 'MMdM CATALOGO',
      'year ring parent button names the volume OUT returns to');
    handlers.childrenHandler({ selected: { id: 'y1', level: 'year' }, app });
    assert.equal(state.parentButtons?.showOuter, true, 'months mode shows the parent button');
    const up = handlers.parentHandler({ app });
    assert.equal(up, true, 'month → year OUT should be handled');
    assert.equal(state.parentButtons?.showOuter, true,
      'through a gateway the year ring keeps its parent button');
    const out = handlers.parentHandler({ app });
    assert.equal(out, true, 'top-level OUT must be handled by the gateway return');
    assert.equal(returned, 1, 'onGatewayReturn must be invoked exactly once');
  });

  it('calendar: standalone, the year ring has no parent button and top-level OUT is unhandled', () => {
    const handlers = createCalendarHandlers({ manifest: calendarManifest, options: { level: 'year' } });
    const state = {};
    const app = stubApp(state);
    assert.equal(handlers.getParentLabel({ id: 'y1', level: 'year' }), '',
      'nothing above the year ring without a gateway');
    handlers.childrenHandler({ selected: { id: 'y1', level: 'year' }, app });
    handlers.parentHandler({ app });
    assert.equal(state.parentButtons?.showOuter, false);
    const out = handlers.parentHandler({ app });
    assert.equal(out, false, 'top-level OUT unhandled when there is no gateway');
  });

  it('calendar: parent button names the magnified month\'s year, live', () => {
    const handlers = createCalendarHandlers({ manifest: calendarManifest, options: { level: 'year' } });
    const app = stubApp({});
    handlers.childrenHandler({ selected: { id: 'y1', level: 'year' }, app });
    assert.equal(handlers.getParentLabel({ id: '1969:jul', parentId: '1969', yearNumber: 1969, level: 'month' }), '1969');
    assert.equal(handlers.getParentLabel({ id: '-753:jan', parentId: '-753', yearNumber: -753, level: 'month' }), '753 BC',
      'era rule holds in the parent button');
    assert.equal(handlers.getParentLabel(null), '', 'a gap in the magnifier blanks the label');
  });

  it('calendar: default boot lands in the months ring with an OUT to the years ring', () => {
    // Howell 2026-07-19: entry (gateway or standalone) magnifies the
    // CURRENT MONTH; the years ring is one OUT away.
    const handlers = createCalendarHandlers({ manifest: calendarManifest, options: {} });
    const state = {};
    const app = stubApp(state);
    handlers.onBoot({ app });
    assert.equal(state.parentButtons?.showOuter, true,
      'months mode always has an OUT (up to the years ring)');
    assert.equal(handlers.getParentLabel({ id: '1969:jul', parentId: '1969', yearNumber: 1969, level: 'month' }),
      '1969', 'the parent button is the live year header from boot');
    const up = handlers.parentHandler({ app });
    assert.equal(up, true, 'OUT ascends to the years ring');
    assert.ok(state.items?.length, 'years ring delivered');
  });

  it('bible: the root ring routes OUT through the gateway', () => {
    let returned = 0;
    const handlers = createBibleHandlers({
      manifest: {},
      namesMap: {},
      options: { level: 'root' },
      translationsMeta: null,
      chainMeta: buildBibleRootChain(),
      onGatewayReturn: () => { returned += 1; return true; },
      gatewayLabel: 'GUTENBERG'
    });
    const rootItem = buildBibleRootChain().items[0];
    const out = handlers.parentHandler({ selected: rootItem, app: stubApp({}) });
    assert.equal(Boolean(out), true, 'bible root OUT must be handled');
    assert.equal(returned, 1, 'onGatewayReturn must be invoked exactly once');
  });
});
