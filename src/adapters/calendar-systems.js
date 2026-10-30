// THE CALENDAR SYSTEMS (O-245, Howell 2026-10-30): "choosing a calendar
// relabels the same days in that calendar's own years, months and days —
// yes." One line of real days (serials, 0 = 1970-01-01), and a SYSTEM is a
// way of naming them: what year, what month, what day a serial wears, what
// months a year has, what a year is called. The rings are built from a
// system the way the Bible's are built from an edition: the leaves — the
// days — are the same in every one; only their names change, and today is
// today in all of them.
//
// A system carries its RECKONING (the day-grid's arithmetic: serialOf,
// dateOf, monthSpan, dayId) and, on top of it, the names and the ids. Ids:
// the Gregorian keeps the ids the volume has always had ('-753', '2026:oct',
// 'd:2026:10:30', 'dd:202', 'c:21'); every other system suffixes its own
// name — '2026:oct@julian', 'd:1900:2:29@julian' — so a link is never
// mistaken for another calendar's, and the old parsers refuse it rather
// than misreading it.
import { GREGORIAN_RECKONING, JULIAN_RECKONING, daySerial } from '../geometry/day-grid.js';

export const GREGORIAN = 'gregorian';
const SUFFIX = /^(.*)@([a-z]+)$/;

// The suffix on an id, and the id without it.
export function splitSystemId(id) {
  const m = SUFFIX.exec(String(id || ''));
  return m ? { system: m[2], bare: m[1] } : { system: GREGORIAN, bare: String(id || '') };
}
export const systemIdOf = id => splitSystemId(id).system;

const MONTHS = [
  ['jan', 'January'], ['feb', 'February'], ['mar', 'March'], ['apr', 'April'],
  ['may', 'May'], ['jun', 'June'], ['jul', 'July'], ['aug', 'August'],
  ['sep', 'September'], ['oct', 'October'], ['nov', 'November'], ['dec', 'December']
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The Roman-month family (the historical Gregorian and the Julian share
// everything but the leap rule and the reform).
const romanMonths = reckoning => yearNumber => MONTHS.map(([key, name], i) => ({
  number: i + 1, key, name, days: reckoning.monthSpan(yearNumber, i + 1)
}));
// Years are numbered without a zero, BC across the line (as the data names
// them: '753 BC', '1 BC', '1').
const eraYearName = y => (y < 0 ? `${Math.abs(y)} BC` : String(y));
// Time order of a year number with no zero (the data's sort_number).
const eraYearSort = y => (y < 0 ? y + 3001 : y + 3000);

function romanSystem(id, name, reckoning) {
  const suffix = id === GREGORIAN ? '' : `@${id}`;
  return Object.freeze({
    id,
    name,
    reckoning,
    weekdays: WEEKDAYS,
    // the span of years the volume holds, in this system's own numbering
    firstYear: -3000,
    lastYear: 3000,
    monthsOf: romanMonths(reckoning),
    yearName: eraYearName,
    yearSort: eraYearSort,
    serialOf: (y, m, d) => reckoning.serialOf(y, m, d),
    dateOf: serial => { const { yearNumber, month, day } = reckoning.dateOf(serial); return { year: yearNumber, month, day }; },
    // ids, in the volume's grammar
    yearId: y => `${y}${suffix}`,
    monthId: (y, m) => `${y}:${MONTHS[m - 1]?.[0] || m}${suffix}`,
    dayId: (y, m, d) => reckoning.dayId(y, m, d),
    decadeId: bare => `${bare}${suffix}`,
    centuryId: bare => `${bare}${suffix}`
  });
}

export const SYSTEMS = Object.freeze({
  gregorian: romanSystem(GREGORIAN, 'GREGORIAN', GREGORIAN_RECKONING),
  julian: romanSystem('julian', 'JULIAN', JULIAN_RECKONING)
});

export const systemOf = id => SYSTEMS[id] || SYSTEMS[GREGORIAN];

// The present moment as a serial (the wall clock's date in the historical
// reckoning), and the same moment in any system.
export function todaySerial() {
  const wallClock = new Date();
  return daySerial(wallClock.getFullYear(), wallClock.getMonth() + 1, wallClock.getDate());
}
export function presentIn(system) {
  const serial = todaySerial();
  const d = system.dateOf(serial);
  return { serial, yearNumber: d.year, monthNumber: d.month, dayNumber: d.day };
}
