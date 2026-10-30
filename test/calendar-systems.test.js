// THE CALENDAR SYSTEMS (O-245, Howell 2026-10-30: "choosing a calendar
// relabels the same days in that calendar's own years, months and days").
// One line of real days; a system names them. The Gregorian is the data's
// own reckoning, unchanged; the Julian is the first other calendar to turn
// its seat live.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SYSTEMS, systemOf, splitSystemId, systemIdOf, presentIn, todaySerial } from '../src/adapters/calendar-systems.js';
import { GREGORIAN_RECKONING, JULIAN_RECKONING, monthWeeks, monthCells, daySerial, serialToDate } from '../src/geometry/day-grid.js';
import { buildCalendarYears, buildCalendarMonthsCousinChain, buildCalendarDaysCousinChain, buildCalendarDecades, buildCalendarCenturies, getCalendarMonths, getCalendarCenturyDecades, getCalendarDecadeYears } from '../src/adapters/volume-helpers.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../data/calendar/manifest.json', import.meta.url), 'utf8'));
const G = SYSTEMS.gregorian;
const J = SYSTEMS.julian;

describe('the id grammar (O-245)', () => {
  it('the Gregorian keeps the ids the volume always had; another system suffixes its name', () => {
    assert.deepEqual(splitSystemId('2026:oct'), { system: 'gregorian', bare: '2026:oct' });
    assert.deepEqual(splitSystemId('d:1900:2:29@julian'), { system: 'julian', bare: 'd:1900:2:29' });
    assert.equal(systemIdOf('c:21'), 'gregorian');
    assert.equal(systemIdOf('dd:190@julian'), 'julian');
    assert.equal(G.yearId(-753), '-753');
    assert.equal(G.monthId(2026, 10), '2026:oct');
    assert.equal(G.dayId(2026, 10, 30), 'd:2026:10:30');
    assert.equal(J.yearId(1900), '1900@julian');
    assert.equal(J.monthId(1900, 2), '1900:feb@julian');
    assert.equal(J.dayId(1900, 2, 29), 'd:1900:2:29@julian');
    assert.equal(J.decadeId('dd:190'), 'dd:190@julian');
    assert.equal(systemOf('nonesuch'), G, 'an unknown system is the Gregorian');
  });
});

describe('the two reckonings (O-245)', () => {
  it('the Gregorian system IS the historical reckoning the grid always used', () => {
    assert.equal(G.reckoning, GREGORIAN_RECKONING);
    assert.equal(G.serialOf(2026, 10, 30), daySerial(2026, 10, 30));
    assert.deepEqual(G.dateOf(daySerial(1582, 10, 15)), { year: 1582, month: 10, day: 15 });
    assert.equal(G.monthsOf(1900)[1].days, 28, 'Gregorian 1900 is not leap');
    assert.equal(G.monthsOf(2000)[1].days, 29);
    assert.equal(G.monthsOf(1582)[9].days, 21, 'October 1582 held 21 days');
  });
  it('the Julian runs the Old Style on: every fourth year leap, thirteen days behind today', () => {
    assert.equal(J.reckoning, JULIAN_RECKONING);
    // The day Gregory's count began was 5 October in the Julian.
    assert.deepEqual(J.dateOf(daySerial(1582, 10, 15)), { year: 1582, month: 10, day: 5 });
    // Before the reform the two agree to the day.
    assert.deepEqual(J.dateOf(daySerial(1000, 6, 15)), { year: 1000, month: 6, day: 15 });
    assert.deepEqual(J.dateOf(daySerial(-753, 4, 21)), { year: -753, month: 4, day: 21 });
    // Today's thirteen days.
    assert.deepEqual(J.dateOf(daySerial(2026, 10, 30)), { year: 2026, month: 10, day: 17 });
    assert.deepEqual(J.dateOf(daySerial(2026, 10, 1)), { year: 2026, month: 9, day: 18 });
    assert.equal(J.monthsOf(1900)[1].days, 29, 'Julian 1900 is leap');
    assert.equal(J.monthsOf(1582)[9].days, 31, 'no reform in the Julian');
    // Round trips.
    for (const serial of [daySerial(2026, 10, 30), daySerial(1900, 3, 1), daySerial(-3000, 1, 1), daySerial(3000, 12, 31)]) {
      const d = J.dateOf(serial);
      assert.equal(J.serialOf(d.year, d.month, d.day), serial);
    }
    assert.equal(J.serialOf(1900, 2, 29) + 1, J.serialOf(1900, 3, 1));
  });
  it('the grid lays the Julian month down by its own reckoning', () => {
    assert.equal(monthWeeks(1900, 2).flat().filter(Boolean).length, 28);
    assert.equal(monthWeeks(1900, 2, JULIAN_RECKONING).flat().filter(Boolean).length, 29);
    const cells = monthCells(1900, 2, JULIAN_RECKONING).flat().filter(Boolean);
    assert.equal(cells[0].serial, J.serialOf(1900, 2, 1));
    assert.equal(cells[cells.length - 1].day, 29);
    // The weekday cycle is one line: the same serial sits in the same column.
    const g = monthCells(2026, 10).flat().filter(Boolean).find(c => c.day === 30);
    const col = row => row.findIndex(c => c && c.serial === g.serial);
    const jRows = monthCells(2026, 10, JULIAN_RECKONING);
    const jCol = jRows.map(col).find(c => c >= 0);
    const gCol = monthCells(2026, 10).map(col).find(c => c >= 0);
    assert.equal(jCol, gCol);
  });
  it('today is one serial in every system', () => {
    const t = todaySerial();
    assert.equal(presentIn(G).serial, t);
    assert.equal(presentIn(J).serial, t);
    const civil = serialToDate(t);
    assert.equal(presentIn(G).yearNumber, civil.yearNumber);
    assert.equal(J.serialOf(presentIn(J).yearNumber, presentIn(J).monthNumber, presentIn(J).dayNumber), t);
  });
});

describe('the rings in another system (O-245)', () => {
  it('the Gregorian rings are what the data gave: ids, names and spans unchanged', () => {
    const { items } = buildCalendarYears(manifest, { initialItemId: '2026' });
    const real = items.filter(Boolean);
    assert.equal(real.length, 6000);
    assert.equal(real[0].id, '-3000');
    assert.equal(real[0].name, '3000 BC');
    assert.equal(real.find(i => i.id === '-1').name, '1 BC');
    assert.equal(real[real.length - 1].id, '3000');
    assert.equal(real.every(i => i.system === 'gregorian'), true);
    const months = getCalendarMonths(manifest, { id: '2026', level: 'year' }, 'year');
    assert.equal(months[9].id, '2026:oct');
    assert.equal(months[9].name, 'October');
  });
  it('the Julian rings carry the suffix on every link, and the same real days', () => {
    const years = buildCalendarYears(manifest, { initialItemId: '1900@julian' });
    const y = years.items[years.selectedIndex];
    assert.equal(y.id, '1900@julian');
    assert.equal(y.name, '1900');
    assert.equal(y.system, 'julian');
    const months = getCalendarMonths(manifest, y, 'year');
    assert.equal(months.length, 12);
    assert.equal(months[1].id, '1900:feb@julian');
    assert.equal(months[1].yearName, '1900');
    const chain = buildCalendarMonthsCousinChain(manifest, { initialItemId: '1900:feb@julian' });
    const feb = chain.items[chain.selectedIndex];
    assert.equal(feb.id, '1900:feb@julian');
    assert.equal(feb.parentId, '1900@julian');
    const days = buildCalendarDaysCousinChain(manifest, { centerId: 'd:1900:2:29@julian' });
    const leap = days.items[days.selectedIndex];
    assert.equal(leap.id, 'd:1900:2:29@julian', 'a Julian 29 February 1900 is a real link');
    assert.equal(leap.serial, J.serialOf(1900, 2, 29));
    assert.equal(leap.monthName, 'February');
    assert.equal(days.items.filter(i => i && i.now).length, 0);
    // The present day is red in the Julian too, at its Julian name.
    const t = todaySerial();
    const p = J.dateOf(t);
    const todayRing = buildCalendarDaysCousinChain(manifest, { centerId: J.dayId(p.year, p.month, p.day) });
    const now = todayRing.items.filter(i => i && i.now);
    assert.equal(now.length, 1);
    assert.equal(now[0].serial, t);
    assert.equal(now[0].id, J.dayId(p.year, p.month, p.day));
  });
  it('decades and centuries count by the system\'s own digits, suffixed, and their skies answer by id', () => {
    const decades = buildCalendarDecades(manifest, { initialItemId: 'dd:190@julian' });
    const d = decades.items[decades.selectedIndex];
    assert.equal(d.id, 'dd:190@julian');
    assert.equal(d.name, 'OUGHTS');
    assert.equal(d.parentId, 'c:20@julian');
    const centuries = buildCalendarCenturies(manifest, { initialItemId: 'c:20@julian' });
    assert.equal(centuries.items[centuries.selectedIndex].id, 'c:20@julian');
    assert.equal(getCalendarCenturyDecades(manifest, 'c:20@julian').length, 10);
    assert.equal(getCalendarDecadeYears(manifest, 'dd:190@julian').map(i => i.id)[0], '1900@julian');
    assert.equal(getCalendarDecadeYears(manifest, 'dd:190').map(i => i.id)[0], '1900');
  });
});
