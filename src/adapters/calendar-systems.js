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
import { DECADE_WORDS, CENTURY_WORD, CENTURY_ERA_BC, ordinal, centuryShortLabel, centuryLongLabel,
  decadeIdOf, decadeDigitOf, centuryIdOf, centuryNumberOf, millenniumIdOf } from './calendar-eras.js';
import { MAYA_RECKONING, MAYA_EPOCH_SERIAL, MAYA_GROUPING, mayaMonthsOf, mayaMonthKeyOf, tunName, tzolkinLabel, haabLabel,
  MAYA_WEEKDAY_LETTERS, MAYA_DECADE_WORD, MAYA_CENTURY_WORD, MAYA_NAME, MAYA_NOW } from './calendar-maya.js';
import { CHINESE_RECKONING, CHINESE_GROUPING, chineseMonthsOf, chineseMonthKeyOf, chineseYearName, chineseDayStemBranch,
  chineseNumeral, chineseCycleLabel, warmChineseYear, CHINESE_WEEKDAYS, CHINESE_WEEKDAY_LETTERS, CHINESE_DECADE_WORDS,
  CHINESE_CYCLE_WORD, CHINESE_NAME, CHINESE_NOW } from './calendar-chinese.js';
import { ISLAMIC_RECKONING, islamicMonthsOf, islamicMonthKeyOf, arabicNumeral, ARABIC_WEEKDAYS, ARABIC_WEEKDAY_LETTERS,
  ARABIC_DECADE_WORDS, ARABIC_CENTURY_WORD, arabicOrdinal, arabicCenturyPhrase, ISLAMIC_NAME, ARABIC_NOW } from './calendar-islamic.js';
import { FRENCH_RECKONING, frenchMonthsOf, frenchMonthKeyOf, frenchDayName, romanNumeral, romanOrdinal, FRENCH_WEEKDAYS,
  FRENCH_WEEKDAY_LETTERS, FRENCH_DECADE_WORDS, frenchDecadeShort, FRENCH_CENTURY_WORD, frenchCenturyPhrase, REPUBLICAN_NAME, FRENCH_NOW } from './calendar-republican.js';

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
  // The decade's short form for the sky, where its word is long (O-251),
  // given the decade's digit and a year in it; empty means the word itself.
  decadeShort: () => '',
  centuryLens: (n, era) => ordinal(n),
  centuryLabel: (n, era) => centuryShortLabel(n, era),
  centuryPhrase: (n, era) => centuryLongLabel(n, era),
  centuryWord: era => (era < 0 ? `${CENTURY_WORD} ${CENTURY_ERA_BC}` : CENTURY_WORD)
};
const SEVEN_DAY_WEEKDAY = serial => ((serial + 4) % 7 + 7) % 7;
// THE RUNGS ABOVE THE YEAR ARE THE SYSTEM'S (O-252): ten years to a decade
// and a hundred to a century by the digits (O-242) unless the count groups
// otherwise — the Long Count's twenty tuns to a k'atun, twenty k'atuns to
// a b'ak'tun. Each gives the bare id of a year's decade and century (and
// the millennium the ring parts at), the decade's digit for its word, and
// the century's number for its label.
const DECIMAL_GROUPING = Object.freeze({
  decadeKey: decadeIdOf,
  decadeDigit: decadeDigitOf,
  centuryKey: centuryIdOf,
  centuryNumber: centuryNumberOf,
  millenniumKey: millenniumIdOf
});
// A day's parent seat on the days ring: the month's name before the year's.
const MONTH_THEN_YEAR = (yearName, monthName) => `${String(monthName).toUpperCase()} ${yearName}`;
function makeSystem({ id, name, reckoning, monthsOf, monthKeyOf, yearName, yearSort, noYearZero, direction = 'ltr', weekdays = WEEKDAYS, weekdayLetters = WEEKDAY_LETTERS, epochSerial = null, eras = ENGLISH_ERAS, nativeName = name, nowWord = 'NOW', dayWord = null, grouping = DECIMAL_GROUPING, dayTitle = null, monthPhrase = MONTH_THEN_YEAR, yearShort = null, warm = null }) {
  const suffix = id === GREGORIAN ? '' : `@${id}`;
  return Object.freeze({
    id,
    name,
    // the name the calendar gives itself, in its own script — the watermark
    // and its seat on the plane — and its word for the present (the NOW disc)
    nativeName,
    nowWord,
    // the rings above the years, in the system's own words, and by its own count
    ...eras,
    ...grouping,
    // What the day's card is headed by, where it is not a weekday (the
    // Tzolk'in day, O-252); null means the week's name.
    dayTitle: typeof dayTitle === 'function' ? dayTitle : null,
    // The parent seat above a day: the month's name and the year's, as the
    // system phrases them (13.0.14.1 for the Maya).
    monthPhrase,
    // A system whose years cost astronomy (the Chinese) may be warmed a
    // year at a time in idle moments, so the months ring opens without a
    // stall; null means there is nothing to warm.
    warm: typeof warm === 'function' ? warm : null,
    reckoning,
    // the script's direction, the week's names and the grid's header letters
    direction,
    weekdays,
    weekdayLetters,
    // Which of the week's names a real day wears (O-251): the seven-day
    // cycle unless the reckoning counts its rows otherwise (the décade).
    weekdayOf: typeof reckoning.week?.columnOf === 'function' ? reckoning.week.columnOf : SEVEN_DAY_WEEKDAY,
    // A day's own name, where the system gives every day one (the French
    // rural names, O-251); empty elsewhere.
    dayWord: typeof dayWord === 'function' ? dayWord : () => '',
    noYearZero: Boolean(noYearZero),
    // A count that BEGINS (anno mundi: 1 Tishri 1) has no day before its
    // epoch; the rings of such a system start there, whatever the data's span.
    epochSerial: Number.isFinite(epochSerial) ? epochSerial : null,
    monthsOf,
    yearName,
    // The year's short form for the sky, where its name is long (a tun's
    // 13.0.16 in a k'atun's sky of twenty, O-252); empty means the name.
    yearShort: typeof yearShort === 'function' ? yearShort : () => '',
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
      decadeShort: () => '',
      decadeWord: digit => HEBREW_DECADE_WORDS[digit] || '',
      centuryLens: n => hebrewCenturyLabel(n),
      centuryLabel: n => hebrewCenturyLabel(n),
      centuryPhrase: n => hebrewCenturyPhrase(n),
      centuryWord: () => HEBREW_CENTURY_WORD
    }
  }),
  // Anno Hegirae: counted from the Hijra, no era line; the tables' calendar,
  // which the sighted moon may lead or trail by a day.
  islamic: makeSystem({
    id: 'islamic', name: 'ISLAMIC', reckoning: ISLAMIC_RECKONING,
    monthsOf: islamicMonthsOf,
    monthKeyOf: islamicMonthKeyOf,
    yearName: arabicNumeral,
    yearSort: y => y,
    noYearZero: false,
    direction: 'rtl',
    weekdays: ARABIC_WEEKDAYS,
    weekdayLetters: ARABIC_WEEKDAY_LETTERS,
    epochSerial: ISLAMIC_RECKONING.serialOf(1, 1, 1),
    nativeName: ISLAMIC_NAME,
    nowWord: ARABIC_NOW,
    eras: {
      decadeShort: () => '',
      decadeWord: digit => ARABIC_DECADE_WORDS[digit] || '',
      centuryLens: n => arabicOrdinal(n),
      centuryLabel: n => arabicOrdinal(n),
      centuryPhrase: n => arabicCenturyPhrase(n),
      centuryWord: () => ARABIC_CENTURY_WORD
    }
  }),
  // The Republic's count: from the equinox of 1792, no era line, the year
  // in Roman numerals, the ten-day décade for a week, and a name on every day.
  republican: makeSystem({
    id: 'republican', name: 'FRENCH REPUBLICAN', reckoning: FRENCH_RECKONING,
    monthsOf: frenchMonthsOf,
    monthKeyOf: frenchMonthKeyOf,
    yearName: romanNumeral,
    yearSort: y => y,
    noYearZero: false,
    weekdays: FRENCH_WEEKDAYS,
    weekdayLetters: FRENCH_WEEKDAY_LETTERS,
    epochSerial: FRENCH_RECKONING.serialOf(1, 1, 1),
    nativeName: REPUBLICAN_NAME,
    nowWord: FRENCH_NOW,
    dayWord: (y, m, d) => frenchDayName(m, d),
    eras: {
      decadeWord: digit => FRENCH_DECADE_WORDS[digit] || '',
      decadeShort: (digit, year) => frenchDecadeShort(digit, year),
      centuryLens: n => romanOrdinal(n),
      centuryLabel: n => romanOrdinal(n),
      centuryPhrase: n => frenchCenturyPhrase(n),
      centuryWord: () => FRENCH_CENTURY_WORD
    }
  }),
  // The Long Count: tuns for years from the creation, grouped by twenties;
  // the Tzolk'in and Haab' naming the days.
  maya: makeSystem({
    id: 'maya', name: 'MAYA', reckoning: MAYA_RECKONING,
    monthsOf: mayaMonthsOf,
    monthKeyOf: mayaMonthKeyOf,
    yearName: tunName,
    yearSort: y => y,
    noYearZero: false,
    weekdays: ['', '', '', '', ''],
    weekdayLetters: MAYA_WEEKDAY_LETTERS,
    epochSerial: MAYA_EPOCH_SERIAL,
    nativeName: MAYA_NAME,
    nowWord: MAYA_NOW,
    grouping: MAYA_GROUPING,
    dayTitle: serial => tzolkinLabel(serial),
    dayWord: (y, m, d) => haabLabel(MAYA_RECKONING.serialOf(y, m, d)),
    monthPhrase: (yearName, monthName) => `${yearName}.${monthName}`,
    // In the skies of twenty, the tun and the k'atun by their place alone.
    yearShort: y => String(((y % 20) + 20) % 20),
    eras: {
      decadeShort: digit => String(digit),
      decadeWord: digit => `${MAYA_DECADE_WORD} ${digit}`,
      centuryLens: n => String(n),
      centuryLabel: n => `${MAYA_CENTURY_WORD} ${n}`,
      centuryPhrase: n => `${MAYA_CENTURY_WORD} ${n}`,
      centuryWord: () => MAYA_CENTURY_WORD
    }
  }),
  // The lunisolar year of the new moons and the solstice, named by the
  // sexagenary cycle, counted from 2637 B.C.; sixty years to a cycle where
  // the centuries go, six 旬 of ten inside it.
  chinese: makeSystem({
    id: 'chinese', name: 'CHINESE', reckoning: CHINESE_RECKONING,
    monthsOf: chineseMonthsOf,
    monthKeyOf: chineseMonthKeyOf,
    yearName: chineseYearName,
    yearSort: y => y,
    noYearZero: false,
    weekdays: CHINESE_WEEKDAYS,
    weekdayLetters: CHINESE_WEEKDAY_LETTERS,
    epochSerial: CHINESE_RECKONING.serialOf(1, 1, 1),
    nativeName: CHINESE_NAME,
    nowWord: CHINESE_NOW,
    grouping: CHINESE_GROUPING,
    dayWord: (y, m, d) => chineseDayStemBranch(CHINESE_RECKONING.serialOf(y, m, d)),
    monthPhrase: (yearName, monthName) => `${yearName}年${monthName}`,
    warm: warmChineseYear,
    eras: {
      decadeShort: () => '',
      decadeWord: digit => CHINESE_DECADE_WORDS[digit] || '',
      centuryLens: n => chineseNumeral(n),
      centuryLabel: n => chineseCycleLabel(n),
      centuryPhrase: n => chineseCycleLabel(n),
      centuryWord: () => CHINESE_CYCLE_WORD
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
