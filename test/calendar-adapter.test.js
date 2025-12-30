import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarAdapter, normalize as normalizeCalendar } from '../src/adapters/calendar-adapter.js';

const sampleManifest = {
  Calendar: {
    display_config: {
      volume_name: 'Calendar Sample',
      hierarchy_levels: {
        millennium: { display_name: 'Millennium', color: '#111' },
        year: { display_name: 'Year', color: '#222' },
        month: { display_name: 'Month', color: '#333' }
      }
    },
    millennia: {
      m1: { id: 'm1', name: 'M1', sort_number: 2 },
      m0: { id: 'm0', name: 'M0', sort_number: 1 }
    },
    years: {
      y1: { id: 'y1', name: 'Year 1', millennium_id: 'm0', sort_number: 10, months: { jan: { id: 'jan', name: 'Jan', month_number: 1 } } },
      y2: { id: 'y2', name: 'Year 2', millennium_id: 'm1', sort_number: 20, months: { feb: { id: 'feb', name: 'Feb', month_number: 2 } } }
    }
  }
};

describe('calendar adapter', () => {
  it('normalizes calendar manifest into items and links', () => {
    const normalized = normalizeCalendar(sampleManifest);
    assert.equal(normalized.meta.volumeId, 'Calendar');
    assert.equal(normalized.items[0].id, 'volume:Calendar');
    const millennia = normalized.items.filter(i => i.level === 'millennium');
    const years = normalized.items.filter(i => i.level === 'year');
    const months = normalized.items.filter(i => i.level === 'month');
    assert.equal(millennia.length, 2);
    assert.equal(years.length, 2);
    assert.equal(months.length, 2);
    const linkTargets = normalized.links.map(l => l.to);
    assert.ok(linkTargets.includes('y1'));
    assert.ok(linkTargets.includes('jan'));
    assert.equal(normalized.meta.leafLevel, 'month');
    assert.equal(normalized.meta.colors.month, '#333');
  });

  it('builds layout spec with pyramid config', () => {
    const normalized = normalizeCalendar(sampleManifest);
    const spec = calendarAdapter.layoutSpec(normalized, { width: 800, height: 600 });
    assert.ok(Array.isArray(spec.rings));
    assert.equal(spec.rings.length, 3);
    const pyramid = spec.pyramid;
    assert.ok(pyramid);
    assert.ok(pyramid.capacity);
    assert.equal(typeof pyramid.place, 'function');
  });

  it('emits detail payloads for year and month', () => {
    const monthDetail = calendarAdapter.detailFor({ id: 'jan', level: 'month' }, sampleManifest);
    assert.equal(monthDetail.type, 'card');
    assert.ok(monthDetail.title.includes('Jan'));
    const yearDetail = calendarAdapter.detailFor({ id: 'y1', level: 'year', meta: { yearNumber: 1 } }, sampleManifest);
    assert.equal(yearDetail.type, 'card');
    assert.ok(yearDetail.title.includes('1'));
  });
});
