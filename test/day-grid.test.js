import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLeapYear, daysInMonth, daySerial, dayOfWeek, serialToDate, monthWeeks, computeDayGridLayout
} from '../src/geometry/day-grid.js';

describe('day grid arithmetic', () => {
  it('knows its weekdays (0 = Sunday)', () => {
    assert.equal(dayOfWeek(1970, 1, 1), 4);   // Thursday — the serial epoch
    assert.equal(dayOfWeek(2000, 1, 1), 6);   // Saturday
    assert.equal(dayOfWeek(2026, 7, 19), 0);  // Sunday (the day of these rulings)
  });

  it('knows its leap years (proleptic Gregorian; Julian is the C.6 seam)', () => {
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(1900), false);
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2026), false);
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2026, 7), 31);
  });

  it('round-trips serials, including across the BC boundary (no year zero)', () => {
    for (const [y, m, d] of [[2026, 7, 19], [1582, 10, 4], [1, 1, 1], [-1, 12, 31], [-753, 4, 21]]) {
      const s = daySerial(y, m, d);
      assert.deepEqual(serialToDate(s), { yearNumber: y, month: m, day: d }, `${y}-${m}-${d}`);
    }
    // 1 BC (yearNumber -1) Dec 31 is the day before AD 1 Jan 1.
    assert.equal(daySerial(1, 1, 1) - daySerial(-1, 12, 31), 1);
  });

  it('lays a month into Sunday-start week rows', () => {
    const rows = monthWeeks(2026, 7); // July 2026: the 1st is a Wednesday
    assert.equal(rows[0][3], 1, 'July 1 2026 in the Wednesday column');
    assert.equal(rows.length, 5);
    const days = rows.flat().filter(v => v !== null);
    assert.equal(days.length, 31);
    assert.equal(days[0], 1);
    assert.equal(days[days.length - 1], 31);
  });

  it('settled layout hard-crops to the month; ribbon carries dimmed neighbors', () => {
    // Real geometry from the live pipeline — synthetic fixtures drifted
    // from the canonical CPUA's vessel/bottom interplay.
    const vp = { width: 375, height: 700, SSd: 375, LSd: 700 };
    const mag = { x: 178.2, y: 517.7 }; // getMagnifierPosition(vp) values
    const arc = { hubX: 840.8, hubY: 0, radius: 840.8 }; // getArcParameters(vp)
    const settled = computeDayGridLayout(vp, mag, arc, { yearNumber: 2026, month: 7, rotating: false });
    assert.equal(settled.gridMode, true);
    assert.equal(settled.nodes.length, 31, 'every day of July, nothing else');
    assert.ok(settled.nodes.every(n => !n.dim));
    const ribbon = computeDayGridLayout(vp, mag, arc, { yearNumber: 2026, month: 7, fraction: 0.4, rotating: true });
    assert.ok(ribbon.nodes.length > 31, 'ribbon shows continuous weeks');
    assert.ok(ribbon.nodes.some(n => n.dim), 'neighbor months present but dimmed');
    assert.ok(ribbon.nodes.some(n => !n.dim), 'anchor month full-strength');
  });
});
