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
import { HEBREW_RECKONING, hebrewMonthsOf, hebrewMonthKeyOf, hebrewNumeral, HEBREW_WEEKDAYS, HEBREW_WEEKDAY_LETTERS,
  HEBREW_DECADE_WORDS, HEBREW_CENTURY_WORD, hebrewCenturyLabel, hebrewCenturyPhrase, HEBREW_NAME, HEBREW_NOW } from './calendar-hebrew.js';
import { DECADE_WORDS, CENTURY_WORD, CENTURY_ERA_BC, ordinal, centuryShortLabel, centuryLongLabel } from './calendar-eras.js';

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
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

// A system from its parts: the reckoning, the months of a year (in ring
// order, each with its own number, key and name), the year's name and
// time order, and whether the count skips a year zero.
// The English era words are the default: a decade by its digit, a century
// as "21st" (lens), "3rd B.C." (ring), "21st CENTURY" (phrase), with the
// word CENTURY (or CENTURY B.C.) as the lens's caption.
const ENGLISH_ERAS = {
  decadeWord: digit => DECADE_WORDS[digit] || '',
  centuryLens: (n, era) => ordinal(n),
  centuryLabel: (n, era) => centuryShortLabel(n, era),
  centuryPhrase: (n, era) => centuryLongLabel(n, era),
  centuryWord: era => (era < 0 ? `${CENTURY_WORD} ${CENTURY_ERA_BC}` : CENTURY_WORD)
};
function makeSystem({ id, name, reckoning, monthsOf, monthKeyOf, yearName, yearSort, noYearZero, direction = 'ltr', weekdays = WEEKDAYS, weekdayLetters = WEEKDAY_LETTERS, epochSerial = null, eras = ENGLISH_ERAS, nativeName = name, nowWord = 'NOW' }) {
  const suffix = id === GREGORIAN ? '' : `@${id}`;
  return Object.freeze({
    id,
    name,
    // the name the calendar gives itself, in its own script — the watermark
    // and its seat on the plane — and its word for the present (the NOW disc)
    nativeName,
    nowWord,
    // the rings above the years, in the system's own words
    ...eras,
    reckoning,
    // the script's direction, the week's names and the grid's header letters
    direction,
    weekdays,
    weekdayLetters,
    noYearZero: Boolean(noYearZero),
    // A count that BEGINS (anno mundi: 1 Tishri 1) has no day before its
    // epoch; the rings of such a system start there, whatever the data's span.
    epochSerial: Number.isFinite(epochSerial) ? epochSerial : null,
    monthsOf,
    yearName,
    yearSort,
    dayName: typeof reckoning.dayName === 'function' ? reckoning.dayName : String,
    serialOf: (y, m, d) => reckoning.serialOf(y, m, d),
    dateOf: serial => { const { yearNumber, month, day } = reckoning.dateOf(serial); return { year: yearNumber, month, day }; },
    // ids, in the volume's grammar
    yearId: y => `${y}${suffix}`,
    monthId: (y, m) => `${y}:${monthKeyOf(m)}${suffix}`,
    dayId: (y, m, d) => reckoning.dayId(y, m, d),
    decadeId: bare => `${bare}${suffix}`,
    centuryId: bare => `${bare}${suffix}`
  });
}
const romanSystem = (id, name, reckoning) => makeSystem({
  id, name, reckoning,
  monthsOf: romanMonths(reckoning),
  monthKeyOf: m => MONTHS[m - 1]?.[0] || String(m),
  yearName: eraYearName,
  yearSort: eraYearSort,
  noYearZero: true
});

export const SYSTEMS = Object.freeze({
  gregorian: romanSystem(GREGORIAN, 'GREGORIAN', GREGORIAN_RECKONING),
  julian: romanSystem('julian', 'JULIAN', JULIAN_RECKONING),
  // Anno mundi: counted from Creation, no era line, no year zero to skip
  // inside the volume's span (its first year is 761).
  hebrew: makeSystem({
    id: 'hebrew', name: 'HEBREW', reckoning: HEBREW_RECKONING,
    monthsOf: hebrewMonthsOf,
    monthKeyOf: hebrewMonthKeyOf,
    yearName: hebrewNumeral,
    yearSort: y => y,
    noYearZero: false,
    direction: 'rtl',
    weekdays: HEBREW_WEEKDAYS,
    weekdayLetters: HEBREW_WEEKDAY_LETTERS,
    epochSerial: HEBREW_RECKONING.serialOf(1, 7, 1),
    nativeName: HEBREW_NAME,
    nowWord: HEBREW_NOW,
    eras: {
      decadeWord: digit => HEBREW_DECADE_WORDS[digit] || '',
      centuryLens: n => hebrewCenturyLabel(n),
      centuryLabel: n => hebrewCenturyLabel(n),
      centuryPhrase: n => hebrewCenturyPhrase(n),
      centuryWord: () => HEBREW_CENTURY_WORD
    }
  })
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
