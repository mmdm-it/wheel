import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarAdapter, normalize as normalizeCalendar } from '../src/adapters/calendar-adapter.js';

const sampleManifest = {
  Calendar: {
    display_config: {
      volume_name: 'Calendar Sample',
      hierarchy_levels: {
        year: { display_name: 'Year', color: '#222' },
        month: { display_name: 'Month', color: '#333' }
      }
    },
    month_template: {
      jan: { id: 'jan', name: 'January', month_number: 1 },
      feb: { id: 'feb', name: 'February', month_number: 2 }
    },
    years: {
      '-753': { id: '-753', name: '753 BC', year_number: -753, sort_number: 1 },
      1969: { id: '1969', name: '1969', year_number: 1969, sort_number: 2 }
    }
  }
};

describe('calendar adapter', () => {
  it('normalizes years as the top level (no millennia, months synthesized)', () => {
    const normalized = normalizeCalendar(sampleManifest);
    assert.equal(normalized.meta.volumeId, 'Calendar');
    assert.equal(normalized.items[0].id, 'volume:Calendar');
    const years = normalized.items.filter(i => i.level === 'year');
    assert.equal(years.length, 2);
    assert.ok(years.every(y => y.parentId === 'volume:Calendar'),
      'years hang directly off the volume root');
    assert.equal(normalized.items.filter(i => i.level === 'millennium').length, 0);
    assert.equal(normalized.meta.leafLevel, null, 'no detail sector until days exist');
    assert.deepEqual(normalized.meta.levels, ['year', 'month']);
    assert.equal(normalized.meta.colors.month, '#333');
  });

  it('builds layout spec with pyramid config', () => {
    const normalized = normalizeCalendar(sampleManifest);
    const spec = calendarAdapter.layoutSpec(normalized, { width: 800, height: 600 });
    assert.ok(Array.isArray(spec.rings));
    assert.equal(spec.rings.length, 2);
    const pyramid = spec.pyramid;
    assert.ok(pyramid);
    assert.ok(pyramid.capacity);
    assert.equal(typeof pyramid.place, 'function');
  });

  it('emits detail payloads for year and month', () => {
    const monthDetail = calendarAdapter.detailFor({ id: '1969:jan', level: 'month' }, sampleManifest);
    assert.equal(monthDetail.type, 'card');
    assert.ok(monthDetail.title.includes('January'));
    assert.ok(monthDetail.body.includes('1969'));
    const adDetail = calendarAdapter.detailFor({ id: '1969', level: 'year', meta: { yearNumber: 1969 } }, sampleManifest);
    assert.equal(adDetail.type, 'card');
    assert.equal(adDetail.title, '1969', 'AD years are bare numbers — no suffix');
    const bcDetail = calendarAdapter.detailFor({ id: '-753', level: 'year', meta: { yearNumber: -753 } }, sampleManifest);
    assert.equal(bcDetail.title, '753 BC', 'BC years carry the BC suffix');
  });
});

describe('calendar front door (volume config)', () => {
  it('boots the months ring on the current month, whatever the manifest names as top level', async () => {
    // Regression: the manifest's focus_ring_startup.top_navigation_level
    // ("year" — truthfully the top of the hierarchy) was consulted as the
    // ENTRY level, so gateway transits (level=root) kept landing on the
    // years ring instead of the current month (Howell 2026-07-19).
    const { volumeConfigs } = await import('../src/volume-configs.js');
    const cfg = volumeConfigs.calendar;
    const gatewayOptions = cfg.buildOptions({
      params: new URLSearchParams('volume=calendar&level=root'),
      startup: { top_navigation_level: 'year' },
      arrangements: {}
    });
    assert.equal(gatewayOptions.level, 'month', 'gateway transit enters at months');
    const bare = cfg.buildOptions({ params: new URLSearchParams(''), startup: { top_navigation_level: 'year' }, arrangements: {} });
    assert.equal(bare.level, 'month', 'standalone boot enters at months');
    const explicit = cfg.buildOptions({ params: new URLSearchParams('level=year'), startup: {}, arrangements: {} });
    assert.equal(explicit.level, 'year', '?level=year keeps the years-ring entrance');

    const now = new Date();
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const template = Object.fromEntries(monthKeys.map((k, i) => [k, { id: k, name: k, month_number: i + 1 }]));
    const yearId = String(now.getFullYear());
    const manifest = {
      Calendar: {
        month_template: template,
        years: { [yearId]: { id: yearId, year_number: now.getFullYear(), sort_number: 0 } }
      }
    };
    const { items, selectedIndex } = cfg.buildChain(manifest, gatewayOptions);
    assert.equal(items[selectedIndex]?.id, `${yearId}:${monthKeys[now.getMonth()]}`,
      'the current month arrives magnified');
  });
});
