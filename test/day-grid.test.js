import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLeapYear, daysInMonth, monthDaySpan, daySerial, dayOfWeek, serialToDate, monthWeeks,
  dayExists, computeDayGridLayout, GREGORIAN_REFORM, REFORM_SERIAL
} from '../src/geometry/day-grid.js';

describe('day grid arithmetic', () => {
  it('knows its weekdays (0 = Sunday)', () => {
    assert.equal(dayOfWeek(1970, 1, 1), 4);   // Thursday — the serial epoch
    assert.equal(dayOfWeek(2000, 1, 1), 6);   // Saturday
    assert.equal(dayOfWeek(2026, 7, 19), 0);  // Sunday (the day of these rulings)
  });

  it('knows its leap years — Gregorian after the reform, Julian before', () => {
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(1900), false);
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2026), false);
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2026, 7), 31);
    // Before 1582 the century exception did not exist yet.
    assert.equal(isLeapYear(1500), true, 'Julian: every fourth year, no exception');
    assert.equal(isLeapYear(1300), true);
    assert.equal(daysInMonth(1500, 2), 29);
    assert.equal(isLeapYear(1700), false, 'Gregorian rule owns the first century year it changed');
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
    const dayCells = settled.nodes.filter(n => /^\d+$/.test(n.label));
    const headerCells = settled.nodes.filter(n => /^[A-Z]$/.test(n.label));
    assert.equal(dayCells.length, 31, 'every day of July');
    assert.equal(headerCells.length, 7, 'S M T W T F S on the top ray');
    assert.ok(settled.nodes.every(n => !n.dim));
    const ribbon = computeDayGridLayout(vp, mag, arc, { yearNumber: 2026, month: 7, fraction: 0.4, rotating: true });
    assert.ok(ribbon.nodes.length > 31, 'ribbon shows continuous weeks');
    assert.ok(ribbon.nodes.some(n => n.dim), 'neighbor months present but dimmed');
    assert.ok(ribbon.nodes.some(n => !n.dim), 'anchor month full-strength');
  });

  it('honors Gregory: the ten days of October 1582 never happened', () => {
    GREGORIAN_REFORM.missingDays.forEach(d => {
      assert.equal(dayExists(1582, 10, d), false, `5-14 Oct 1582 is a ghost: ${d}`);
    });
    assert.equal(dayExists(1582, 10, 4), true, 'the last Julian day was lived');
    assert.equal(dayExists(1582, 10, 15), true, 'the first Gregorian day was lived');
    assert.equal(dayExists(1583, 10, 7), true, 'only that one October lost days');
    // No serial belongs to a ghost, so nothing can ever scroll onto one.
    const seen = new Set();
    for (let s = REFORM_SERIAL - 40; s <= REFORM_SERIAL + 40; s += 1) {
      const d = serialToDate(s);
      assert.equal(dayExists(d.yearNumber, d.month, d.day), true, `serial ${s} is a real day`);
      seen.add(`${d.yearNumber}:${d.month}:${d.day}`);
    }
    assert.equal(seen.size, 81, 'each serial names its own distinct day');
  });

  it('closes the seam: 4 October is followed by 15 October, and the week never breaks', () => {
    assert.equal(daySerial(1582, 10, 4) + 1, daySerial(1582, 10, 15), 'adjacent days');
    assert.equal(daySerial(1582, 10, 15), REFORM_SERIAL);
    // Gregory moved the date, never the weekday cycle.
    assert.equal(dayOfWeek(1582, 10, 4), 4, 'Thursday');
    assert.equal(dayOfWeek(1582, 10, 15), 5, 'Friday, the very next day');
  });

  it('measures October 1582 as the 21 days it held, though it still ends on the 31st', () => {
    assert.equal(daysInMonth(1582, 10), 31, 'the last day still wears the number 31');
    assert.equal(monthDaySpan(1582, 10), 21, 'but only 21 days were lived');
    assert.equal(monthDaySpan(1582, 9), 30, 'neighbors untouched');
    assert.equal(monthDaySpan(2026, 7), 31);
    assert.equal(monthDaySpan(2024, 2), 29, 'leap Februaries measured whole');
    assert.equal(monthDaySpan(2026, 12), 31, 'December spans into the new year cleanly');
    assert.equal(monthDaySpan(-1, 12), 31, 'and across the year with no zero');
  });

  it('lays October 1582 into the grid as history did — 4 and 15 in adjacent seats', () => {
    const rows = monthWeeks(1582, 10);
    assert.deepEqual(rows[0], [null, 1, 2, 3, 4, 15, 16],
      'the jump lives in the numerals; the week itself is unbroken');
    assert.deepEqual(rows[1], [17, 18, 19, 20, 21, 22, 23]);
    const days = rows.flat().filter(v => v !== null);
    assert.equal(days.length, 21);
    assert.ok(!days.some(d => d >= 5 && d <= 14), 'no ghost ever reaches the grid');
  });

  it('agrees with the astronomers at the far end of the timeline', () => {
    // Julian Day Number 0: 1 January 4713 BC (Julian) is the very same day
    // as 24 November 4714 BC (proleptic Gregorian) — an anchor computed
    // entirely outside this engine.
    assert.equal(daySerial(-4713, 1, 1), -2440588);
    // Dates before the reform are Julian, as historians write them.
    assert.deepEqual(serialToDate(daySerial(-753, 4, 21)), { yearNumber: -753, month: 4, day: 21 });
  });

  it('round-trips every day across the seam and the era boundary', () => {
    const spans = [
      [daySerial(1582, 9, 1), daySerial(1582, 11, 30)], // the reform itself
      [daySerial(-1, 12, 1), daySerial(1, 1, 31)],      // the BC/AD line
      [daySerial(1700, 2, 1), daySerial(1700, 3, 5)]    // first century year the rule changed
    ];
    spans.forEach(([from, to]) => {
      for (let s = from; s <= to; s += 1) {
        const d = serialToDate(s);
        assert.equal(daySerial(d.yearNumber, d.month, d.day), s, `serial ${s}`);
      }
    });
  });

  it('resolves a ghost date to the day the reckoning resumed', () => {
    // Nothing in the instrument can produce 7 October 1582, but a
    // hand-typed id might ask for it.
    assert.equal(daySerial(1582, 10, 7), REFORM_SERIAL);
    assert.deepEqual(serialToDate(daySerial(1582, 10, 7)), { yearNumber: 1582, month: 10, day: 15 });
  });

  it('takes its column headers from the caller, and keeps a fallback', () => {
    const vp = { width: 375, height: 700, SSd: 375, LSd: 700 };
    const mag = { x: 178.2, y: 517.7 };
    const arc = { hubX: 840.8, hubY: 0, radius: 840.8 };
    const headersOf = opts => computeDayGridLayout(vp, mag, arc,
      { yearNumber: 2026, month: 7, rotating: false, ...opts })
      .nodes.filter(n => n.id.startsWith('wd:')).map(n => n.label);
    assert.deepEqual(headersOf({}), ['S', 'M', 'T', 'W', 'T', 'F', 'S'], 'built-in row');
    assert.deepEqual(headersOf({ weekdayLetters: ['D', 'L', 'M', 'M', 'G', 'V', 'S'] }),
      ['D', 'L', 'M', 'M', 'G', 'V', 'S'], 'the volume may name them');
    assert.deepEqual(headersOf({ weekdayLetters: ['X', 'Y'] }),
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'], 'a malformed row is refused, not drawn');
  });

  it('marks today — and only today — in its own month', () => {
    const vp = { width: 375, height: 700, SSd: 375, LSd: 700 };
    const mag = { x: 178.2, y: 517.7 };
    const arc = { hubX: 840.8, hubY: 0, radius: 840.8 };
    const now = new Date();
    const home = computeDayGridLayout(vp, mag, arc, {
      yearNumber: now.getFullYear(), month: now.getMonth() + 1, rotating: false
    });
    const marked = home.nodes.filter(n => n.now);
    assert.equal(marked.length, 1, 'exactly one today cell');
    assert.equal(marked[0].label, String(now.getDate()));
    // A month that is not this one carries no today (headers never do).
    const elsewhereMonth = now.getMonth() === 0 ? 2 : 1;
    const away = computeDayGridLayout(vp, mag, arc, {
      yearNumber: now.getFullYear(), month: elsewhereMonth, rotating: false
    });
    assert.ok(away.nodes.every(n => !n.now));
  });
});
