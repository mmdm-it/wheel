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

  it('the ribbon runs edge to edge: no empty lower right in a tall viewport (O-235)', async () => {
    // A fixed twelve rows left the lower right of a phone empty mid-turn;
    // days must enter from the viewport's edge. Real geometry, not a fixture.
    const { getViewportInfo, getArcParameters, getMagnifierPosition } =
      await import('../src/geometry/focus-ring-geometry.js');
    for (const [w, h] of [[360, 800], [412, 915]]) {
      const vp = getViewportInfo(w, h);
      for (const fraction of [0, 0.5, 0.95]) {
        const ribbon = computeDayGridLayout(vp, getMagnifierPosition(vp), getArcParameters(vp),
          { yearNumber: 2027, month: 6, fraction, rotating: true });
        const lowest = Math.max(...ribbon.nodes.map(n => n.y));
        assert.ok(lowest > h * 0.85, `${w}x${h} @${fraction}: the ribbon stops at y=${Math.round(lowest)}`);
        assert.ok(ribbon.nodes.some(n => n.x > w * 0.7 && n.y > h * 0.7),
          `${w}x${h} @${fraction}: the lower right is empty`);
      }
    }
  });

  it('the Niagara parts at a gap between years instead of vanishing (O-236)', async () => {
    const { getViewportInfo, getArcParameters, getMagnifierPosition } =
      await import('../src/geometry/focus-ring-geometry.js');
    const { ribbonRowAt, daySerial, GAP_ROWS_PER_SLOT } = await import('../src/geometry/day-grid.js');
    const vp = getViewportInfo(360, 800);
    const mag = getMagnifierPosition(vp), arc = getArcParameters(vp);
    const seams = [{ serial: daySerial(2027, 1, 1), rows: 3 * GAP_ROWS_PER_SLOT }];
    // Midway through a three-slot gap: the fall eases between December's
    // last half-slot and January's first.
    const from = ribbonRowAt(2026, 12, 0.5, seams), to = ribbonRowAt(2027, 1, -0.5, seams);
    const gap = computeDayGridLayout(vp, mag, arc, {
      yearNumber: 2026, month: 12, rotating: true, seams, inGap: true,
      anchorRow: (from + to) / 2, startSerial: daySerial(2027, 1, 1)
    });
    assert.ok(gap.nodes.length > 0, 'the fall keeps falling in the gap');
    assert.ok(gap.nodes.every(n => n.dim), 'no month is under the glass, so every date dims');
    const dec31 = gap.nodes.find(n => n.id === 'd:2026:12:31');
    const jan1 = gap.nodes.find(n => n.id === 'd:2027:1:1');
    if (dec31 && jan1) {
      // Same week, but January sits the gap's rows further down the fall.
      assert.ok(jan1.angle < dec31.angle - (3 * Math.PI) / 180, 'empty water between December and January');
    } else {
      assert.ok(dec31 || jan1, 'one side of the seam is on the glass');
    }
    // Continuity: at the gap's near edge the fall stands where December's
    // own gearing left it.
    const edge = computeDayGridLayout(vp, mag, arc, { yearNumber: 2026, month: 12, fraction: 0.5, rotating: true, seams });
    const eased = computeDayGridLayout(vp, mag, arc, {
      yearNumber: 2026, month: 12, rotating: true, seams, inGap: true, anchorRow: from, startSerial: daySerial(2027, 1, 1)
    });
    const at = (layout, id) => layout.nodes.find(n => n.id === id);
    const a = at(edge, 'd:2026:12:22'), b = at(eased, 'd:2026:12:22');
    assert.ok(a && b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01, 'no jump entering the gap');
  });

  it('the gap\'s empty water carries one emblem, turned like the dates (O-237)', async () => {
    const { getViewportInfo, getArcParameters, getMagnifierPosition } =
      await import('../src/geometry/focus-ring-geometry.js');
    const { ribbonRowAt, daySerial, GAP_ROWS_PER_SLOT } = await import('../src/geometry/day-grid.js');
    const vp = getViewportInfo(360, 800);
    const mag = getMagnifierPosition(vp), arc = getArcParameters(vp);
    const seams = [{ serial: daySerial(2027, 1, 1), rows: 2 * GAP_ROWS_PER_SLOT }];
    const from = ribbonRowAt(2026, 12, 0.5, seams), to = ribbonRowAt(2027, 1, -0.5, seams);
    const gap = computeDayGridLayout(vp, mag, arc, {
      yearNumber: 2026, month: 12, rotating: true, seams, inGap: true,
      anchorRow: (from + to) / 2, startSerial: daySerial(2027, 1, 1)
    });
    assert.equal(gap.emblems.length, 1, 'one emblem for the one gap');
    const em = gap.emblems[0];
    assert.ok(em.width > 0 && em.height > 0);
    // It sits in the water: no date's centre falls inside its box.
    const inside = gap.nodes.filter(n => {
      const dx = n.x - em.x, dy = n.y - em.y;
      const c = Math.cos(-em.angle), s = Math.sin(-em.angle);
      const u = dx * c - dy * s, v = dx * s + dy * c; // into the ray's own frame
      return Math.abs(u) < em.width / 2 && Math.abs(v) < em.height / 2;
    });
    assert.deepEqual(inside.map(n => n.id), [], 'the emblem covers no date');
    // One size from entrance to exit: the same box at every point of the turn.
    const sizes = new Set();
    for (let t = 0; t <= 1; t += 0.1) {
      const l = computeDayGridLayout(vp, mag, arc, {
        yearNumber: 2026, month: 12, rotating: true, seams, inGap: true, emblemAspect: 2.5,
        anchorRow: from + (to - from) * t, startSerial: daySerial(2027, 1, 1)
      });
      l.emblems.forEach(e => sizes.add(`${e.width.toFixed(2)}x${e.height.toFixed(2)}`));
    }
    assert.equal(sizes.size, 1, `the emblem changed size during the turn: ${[...sizes].join(', ')}`);
    // No seam, no emblem; settled, no emblem.
    const plain = computeDayGridLayout(vp, mag, arc, { yearNumber: 2026, month: 7, fraction: 0.2, rotating: true });
    assert.equal(plain.emblems.length, 0);
    const settled = computeDayGridLayout(vp, mag, arc, { yearNumber: 2026, month: 7, rotating: false });
    assert.ok(!settled.emblems?.length);
  });

  it('the first of every month falls at full strength (O-238)', () => {
    const vp = { width: 375, height: 700, SSd: 375, LSd: 700 };
    const mag = { x: 178.2, y: 517.7 };
    const arc = { hubX: 840.8, hubY: 0, radius: 840.8 };
    const ribbon = computeDayGridLayout(vp, mag, arc, { yearNumber: 2026, month: 7, fraction: 0.4, rotating: true });
    const firsts = ribbon.nodes.filter(n => n.label === '1');
    assert.ok(firsts.some(n => n.item.monthNumber !== 7), 'a neighbouring month\'s first is on the glass');
    assert.ok(firsts.every(n => !n.dim), 'every first is full strength');
    assert.ok(firsts.every(n => n.fullStrength), 'and stands clear of the turning fade');
    assert.ok(ribbon.nodes.some(n => n.dim && n.label === '2'), 'its neighbours still dim');
  });

  it('the tilt turns the lattice rigidly and evens the Sundays beside the ring (O-239)', async () => {
    const { getViewportInfo, getArcParameters, getMagnifierPosition } =
      await import('../src/geometry/focus-ring-geometry.js');
    const { computeWedgeLattice } = await import('../src/geometry/day-grid.js');
    const vp = getViewportInfo(360, 655); // Howell's phone inside Chrome
    const arc = getArcParameters(vp), mag = getMagnifierPosition(vp);
    const flat = computeWedgeLattice(vp, arc, mag, 0);
    const tilted = computeWedgeLattice(vp, arc, mag);
    // Rigid: every distance between two lattice points is unchanged.
    const pts = L => [[0, 0], [0, 6], [6, 0], [6, 6], [3, 3]].map(([ri, c]) => L.pointAt(L.rayAngle(ri), L.radiusFor(c)));
    const a = pts(flat), b = pts(tilted);
    for (let i = 0; i < a.length; i += 1) for (let j = i + 1; j < a.length; j += 1) {
      const da = Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y), db = Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y);
      assert.ok(Math.abs(da - db) < 1e-6, 'the tilt reshaped the calendar');
    }
    // Even: the Sunday column's distance to the ring varies less across the glass.
    const spread = L => {
      const gaps = [];
      for (let off = -12; off <= 30; off += 0.5) {
        const p = L.pointAt(L.angleForRowOffset(off), L.radiusFor(0));
        if (p.x < 0 || p.x > vp.width || p.y < 0 || p.y > vp.height) continue;
        gaps.push(arc.radius - Math.hypot(p.x - arc.hubX, p.y - arc.hubY));
      }
      return Math.max(...gaps) - Math.min(...gaps);
    };
    assert.ok(spread(tilted) < spread(flat) * 0.7, `Sunday gap spread ${spread(flat).toFixed(0)} → ${spread(tilted).toFixed(0)}`);
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
