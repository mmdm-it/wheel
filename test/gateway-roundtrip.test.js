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
    millennia: {
      m0: { id: 'm0', name: 'M0', sort_number: 1 },
      m1: { id: 'm1', name: 'M1', sort_number: 2 }
    },
    years: {
      y1: { id: 'y1', name: 'Year 1', millennium_id: 'm0', sort_number: 1, months: {} },
      y2: { id: 'y2', name: 'Year 2', millennium_id: 'm1', sort_number: 2, months: {} }
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
  it('calendar: OUT at the millennium ring returns through the gateway', () => {
    let returned = 0;
    const handlers = createCalendarHandlers({
      manifest: calendarManifest,
      options: {},
      onGatewayReturn: () => { returned += 1; return true; },
      gatewayLabel: 'GREGORIO XIII'
    });
    const state = {};
    const app = stubApp(state);
    // year ring → OUT → millennium ring
    const up = handlers.parentHandler({ selected: { id: 'y1', parentId: 'm0' }, app });
    assert.equal(up, true, 'year → millennium OUT should be handled');
    assert.equal(state.parentButtons?.showOuter, true,
      'outer parent button must show at the millennium ring when a gateway label exists');
    // millennium ring → OUT → back through the gateway
    const out = handlers.parentHandler({ selected: { id: 'm0' }, app });
    assert.equal(out, true, 'millennium OUT must be handled by the gateway return');
    assert.equal(returned, 1, 'onGatewayReturn must be invoked exactly once');
  });

  it('calendar: without a gateway, the millennium ring is the top (no OUT)', () => {
    const handlers = createCalendarHandlers({ manifest: calendarManifest, options: {} });
    const state = {};
    const app = stubApp(state);
    handlers.parentHandler({ selected: { id: 'y1', parentId: 'm0' }, app });
    assert.equal(state.parentButtons?.showOuter, false,
      'no gateway label → no outer button at the top ring');
    const out = handlers.parentHandler({ selected: { id: 'm0' }, app });
    assert.equal(out, false, 'top-level OUT unhandled when there is no gateway');
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
