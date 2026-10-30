// THE HEBREW CALENDAR (O-248, Howell 2026-10-30): the fixed arithmetic
// calendar of Hillel II, as every Jewish community has kept it since the
// fourth century — a lunisolar year of twelve or thirteen months, the
// months of 29 or 30 days, the year's start fixed by the molad of Tishri
// and the four postponements, leap years in the 19-year cycle.
//
// The reckoning is Reingold and Dershowitz's ("Calendrical Calculations"),
// stated on fixed day numbers (R.D., day 1 = 1 January 1 in the proleptic
// Gregorian) and converted to the volume's serials (0 = 1 January 1970).
// Months are numbered the traditional way, Nisan = 1 … Adar = 12, Adar II
// = 13 in a leap year; the YEAR begins at Tishri (7), and the rings show
// the months in that civil order. Years are counted from Creation (anno
// mundi): the autumn of 2026 opened 5787.
//
// Pure arithmetic: numbers in, numbers out.

const RD_OF_SERIAL_ZERO = 719163;           // 1 January 1970, R.D.
const HEBREW_EPOCH_RD = -1373427;           // 1 Tishri 1 A.M. (Monday, 7 October 3761 B.C., Julian)

export const TISHRI = 7, HESHVAN = 8, KISLEV = 9, TEVET = 10, SHEVAT = 11, ADAR = 12, ADAR_II = 13;
export const NISAN = 1, IYYAR = 2, SIVAN = 3, TAMMUZ = 4, AV = 5, ELUL = 6;

const mod = (a, b) => ((a % b) + b) % b;
const rdOf = serial => serial + RD_OF_SERIAL_ZERO;
const serialOfRd = rd => rd - RD_OF_SERIAL_ZERO;

export const isHebrewLeapYear = year => mod(7 * year + 1, 19) < 7;
export const lastMonthOfHebrewYear = year => (isHebrewLeapYear(year) ? ADAR_II : ADAR);

// Days from the epoch to the molad-fixed New Year of `year`, before the
// year-length corrections.
function hebrewCalendarElapsedDays(year) {
  const monthsElapsed = Math.floor((235 * year - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  const day = monthsElapsed * 29 + Math.floor(partsElapsed / 25920);
  return mod(3 * (day + 1), 7) < 3 ? day + 1 : day;
}
// The two postponements that keep a year from being 356 or 382 days.
function hebrewYearLengthCorrection(year) {
  const ny0 = hebrewCalendarElapsedDays(year - 1);
  const ny1 = hebrewCalendarElapsedDays(year);
  const ny2 = hebrewCalendarElapsedDays(year + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}
const hebrewNewYearRd = year => HEBREW_EPOCH_RD + hebrewCalendarElapsedDays(year) + hebrewYearLengthCorrection(year);
export const daysInHebrewYear = year => hebrewNewYearRd(year + 1) - hebrewNewYearRd(year);
const longHeshvan = year => [355, 385].includes(daysInHebrewYear(year));
const shortKislev = year => [353, 383].includes(daysInHebrewYear(year));

export function lastDayOfHebrewMonth(year, month) {
  if ([IYYAR, TAMMUZ, ELUL, TEVET, ADAR_II].includes(month)) return 29;
  if (month === ADAR && !isHebrewLeapYear(year)) return 29;
  if (month === HESHVAN && !longHeshvan(year)) return 29;
  if (month === KISLEV && shortKislev(year)) return 29;
  return 30;
}

function fixedFromHebrew(year, month, day) {
  let rd = hebrewNewYearRd(year) + day - 1;
  if (month < TISHRI) {
    // Before Tishri in the traditional numbering means AFTER it in the
    // civil year: every month from Tishri to the year's last, then Nisan on.
    const last = lastMonthOfHebrewYear(year);
    for (let m = TISHRI; m <= last; m += 1) rd += lastDayOfHebrewMonth(year, m);
    for (let m = NISAN; m < month; m += 1) rd += lastDayOfHebrewMonth(year, m);
  } else {
    for (let m = TISHRI; m < month; m += 1) rd += lastDayOfHebrewMonth(year, m);
  }
  return rd;
}

function hebrewFromFixed(rd) {
  const approx = Math.floor(((rd - HEBREW_EPOCH_RD) * 98496) / 35975351) + 1;
  let year = approx - 1;
  while (hebrewNewYearRd(year + 1) <= rd) year += 1;
  const start = rd < fixedFromHebrew(year, NISAN, 1) ? TISHRI : NISAN;
  let month = start;
  while (rd > fixedFromHebrew(year, month, lastDayOfHebrewMonth(year, month))) month += 1;
  const day = rd - fixedFromHebrew(year, month, 1) + 1;
  return { year, month, day };
}

// The volume's dialect: serials, and a date as {yearNumber, month, day}.
export const hebrewSerialOf = (year, month, day) => serialOfRd(fixedFromHebrew(year, month, day));
export function hebrewDateOf(serial) {
  const { year, month, day } = hebrewFromFixed(rdOf(serial));
  return { yearNumber: year, month, day };
}
export const hebrewMonthSpan = (year, month) => lastDayOfHebrewMonth(year, month);

// HEBREW LETTERS AND NUMBERS (Howell 2026-10-30: "I would rather have
// Hebrew letters and numbers"). The months by their names; the days and
// the years in gematria — a geresh after a single letter (א׳), gershayim
// before the last of several (י״ט), 15 and 16 written ט״ו and ט״ז so the
// Name is not spelled; a year with its thousands (ה׳תשפ״ז), since the ring
// holds six thousand of them and the short form repeats every thousand.
const GEMATRIA = [
  [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'],
  [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']
];
const GERESH = '׳', GERSHAYIM = '״';
const lettersOf = n => {
  let rest = n;
  let out = '';
  // 15 and 16: ט״ו and ט״ז, never י״ה or י״ו.
  if (rest % 100 === 15) { out += 'טו'; rest -= 15; }
  else if (rest % 100 === 16) { out += 'טז'; rest -= 16; }
  const hundreds = rest - (rest % 100);
  const tail = rest % 100;
  let s = '';
  let h = hundreds;
  for (const [v, l] of GEMATRIA) { while (h >= v && v >= 100) { s += l; h -= v; } }
  let t = tail;
  for (const [v, l] of GEMATRIA) { if (v < 100) while (t >= v) { t -= v; s += l; } }
  return out ? s + out : s;
};
const punctuate = s => (s.length === 1 ? s + GERESH : s.slice(0, -1) + GERSHAYIM + s.slice(-1));
export function hebrewNumeral(n) {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousands ? lettersOf(thousands) + GERESH : '';
  if (!rest) return head;
  return head + punctuate(lettersOf(rest));
}

// The months of a year in CIVIL order, Tishri first; a leap year's Adar
// is Adar I, followed by Adar II.
const MONTH_NAMES = {
  [NISAN]: ['nisan', 'ניסן'], [IYYAR]: ['iyyar', 'אייר'], [SIVAN]: ['sivan', 'סיון'],
  [TAMMUZ]: ['tammuz', 'תמוז'], [AV]: ['av', 'אב'], [ELUL]: ['elul', 'אלול'],
  [TISHRI]: ['tishri', 'תשרי'], [HESHVAN]: ['heshvan', 'חשון'], [KISLEV]: ['kislev', 'כסלו'],
  [TEVET]: ['tevet', 'טבת'], [SHEVAT]: ['shevat', 'שבט'], [ADAR]: ['adar', 'אדר'], [ADAR_II]: ['adar2', 'אדר ב׳']
};
export function hebrewMonthsOf(year) {
  const leap = isHebrewLeapYear(year);
  const order = [TISHRI, HESHVAN, KISLEV, TEVET, SHEVAT, ADAR, ...(leap ? [ADAR_II] : []), NISAN, IYYAR, SIVAN, TAMMUZ, AV, ELUL];
  return order.map(m => {
    const [key, plain] = MONTH_NAMES[m];
    const name = (m === ADAR && leap) ? 'אדר א׳' : plain;
    return { number: m, key, name, days: lastDayOfHebrewMonth(year, m) };
  });
}
// The week, Sunday first as the grid has it: the first six days by their
// number, the seventh by its name.
export const HEBREW_WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
export const HEBREW_WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

// THE RINGS ABOVE THE YEARS, IN HEBREW (Howell 2026-10-30: "translate
// these labels into Hebrew as well"). The decades as Hebrew says them —
// "the years of the eighties"; a century as its ordinal in gematria with
// the article, so the lens and its word read "the century the 58th", the
// word FIRST as Hebrew puts it. The calendar's own name for the watermark.
export const HEBREW_DECADE_WORDS = ['שנות האפס', 'שנות העשר', 'שנות העשרים', 'שנות השלושים', 'שנות הארבעים',
  'שנות החמישים', 'שנות השישים', 'שנות השבעים', 'שנות השמונים', 'שנות התשעים'];
export const HEBREW_CENTURY_WORD = 'המאה';
export const hebrewCenturyLabel = n => `ה${hebrewNumeral(n)}`;
export const hebrewCenturyPhrase = n => `${HEBREW_CENTURY_WORD} ${hebrewCenturyLabel(n)}`;
export const HEBREW_NAME = 'עברי';
export const HEBREW_NOW = 'עכשיו';
export const hebrewMonthKeyOf = month => MONTH_NAMES[month]?.[0] || String(month);

export const HEBREW_RECKONING = Object.freeze({
  id: 'hebrew',
  serialOf: hebrewSerialOf,
  dateOf: hebrewDateOf,
  monthSpan: hebrewMonthSpan,
  dayName: hebrewNumeral,
  dayId: (y, m, d) => `d:${y}:${m}:${d}@hebrew`
});
