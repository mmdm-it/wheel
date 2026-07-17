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
  it('calendar: OUT at the year ring (the top) returns through the gateway', () => {
    let returned = 0;
    const handlers = createCalendarHandlers({
      manifest: calendarManifest,
      options: {},
      onGatewayReturn: () => { returned += 1; return true; },
      gatewayLabel: 'GREGORIO XIII'
    });
    const state = {};
    const app = stubApp(state);
    // month ring → OUT → year ring (outer button stays: the gateway is above)
    handlers.childrenHandler({ selected: { id: 'y1', level: 'year' }, app });
    const up = handlers.parentHandler({ app });
    assert.equal(up, true, 'month → year OUT should be handled');
    assert.equal(state.parentButtons?.showOuter, true,
      'outer parent button must show at the year ring when a gateway label exists');
    // year ring (top) → OUT → back through the gateway
    const out = handlers.parentHandler({ app });
    assert.equal(out, true, 'top-level OUT must be handled by the gateway return');
    assert.equal(returned, 1, 'onGatewayReturn must be invoked exactly once');
  });

  it('calendar: without a gateway, the year ring is the top (no OUT)', () => {
    const handlers = createCalendarHandlers({ manifest: calendarManifest, options: {} });
    const state = {};
    const app = stubApp(state);
    handlers.childrenHandler({ selected: { id: 'y1', level: 'year' }, app });
    handlers.parentHandler({ app });
    assert.equal(state.parentButtons?.showOuter, false,
      'no gateway label → no outer button at the top ring');
    const out = handlers.parentHandler({ app });
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
