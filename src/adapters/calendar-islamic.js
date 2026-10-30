// THE ISLAMIC CALENDAR (O-250, Howell 2026-10-30): the tabular Hijri — the
// arithmetic calendar of twelve lunar months, 30 and 29 days by turns,
// eleven leap years in a cycle of thirty, counted from the Hijra: 1 Muharram
// of year 1 is Friday, 16 July 622 (Julian). Reingold and Dershowitz's
// reckoning, on R.D. day numbers, converted to the volume's serials.
//
// A WARNING THAT TRAVELS WITH IT: this is the calendar of the tables, which
// is what almanacs and software agree on. The calendar actually kept in any
// country follows the sighting of the new moon, and may run a day either
// side of this one.
//
// Arabic names, Arabic-Indic numerals, the week by its Arabic names, right
// to left. Pure arithmetic: numbers in, numbers out.

const RD_OF_SERIAL_ZERO = 719163;      // 1 January 1970, R.D.
const ISLAMIC_EPOCH_RD = 227015;       // 1 Muharram 1 A.H. (Friday, 16 July 622, Julian)

const mod = (a, b) => ((a % b) + b) % b;
const rdOf = serial => serial + RD_OF_SERIAL_ZERO;
const serialOfRd = rd => rd - RD_OF_SERIAL_ZERO;

export const isIslamicLeapYear = year => mod(14 + 11 * year, 30) < 11;
export function lastDayOfIslamicMonth(year, month) {
  if (month % 2 === 1) return 30;
  if (month === 12 && isIslamicLeapYear(year)) return 30;
  return 29;
}
export const daysInIslamicYear = year => (isIslamicLeapYear(year) ? 355 : 354);

const fixedFromIslamic = (year, month, day) => ISLAMIC_EPOCH_RD - 1
  + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30)
  + 29 * (month - 1) + Math.floor(month / 2) + day;

function islamicFromFixed(rd) {
  const year = Math.floor((30 * (rd - ISLAMIC_EPOCH_RD) + 10646) / 10631);
  const priorDays = rd - fixedFromIslamic(year, 1, 1);
  const month = Math.floor((11 * priorDays + 330) / 325);
  const day = rd - fixedFromIslamic(year, month, 1) + 1;
  return { year, month, day };
}

export const islamicSerialOf = (year, month, day) => serialOfRd(fixedFromIslamic(year, month, day));
export function islamicDateOf(serial) {
  const { year, month, day } = islamicFromFixed(rdOf(serial));
  return { yearNumber: year, month, day };
}
export const islamicMonthSpan = (year, month) => lastDayOfIslamicMonth(year, month);

// ARABIC-INDIC NUMERALS for the days and the years.
const DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const arabicNumeral = n => String(n).replace(/[0-9]/g, d => DIGITS[Number(d)]);

const MONTHS = [
  ['muharram', 'محرم'], ['safar', 'صفر'], ['rabi1', 'ربيع الأول'], ['rabi2', 'ربيع الآخر'],
  ['jumada1', 'جمادى الأولى'], ['jumada2', 'جمادى الآخرة'], ['rajab', 'رجب'], ['shaban', 'شعبان'],
  ['ramadan', 'رمضان'], ['shawwal', 'شوال'], ['dhualqada', 'ذو القعدة'], ['dhualhijja', 'ذو الحجة']
];
export const islamicMonthsOf = year => MONTHS.map(([key, name], i) => ({
  number: i + 1, key, name, days: lastDayOfIslamicMonth(year, i + 1)
}));
export const islamicMonthKeyOf = month => MONTHS[month - 1]?.[0] || String(month);

// The week, Sunday first as the grid has it, and one letter each for the
// grid's header.
export const ARABIC_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const ARABIC_WEEKDAY_LETTERS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

// The rings above the years. The decades as Arabic says them; a century
// by its ordinal in words (the volume's span holds the first twenty-five
// centuries of the Hijra; beyond them, the number), the word FIRST.
export const ARABIC_DECADE_WORDS = ['سنوات الصفر', 'سنوات العشر', 'العشرينيات', 'الثلاثينيات', 'الأربعينيات',
  'الخمسينيات', 'الستينيات', 'السبعينيات', 'الثمانينيات', 'التسعينيات'];
const ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون',
  'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون'];
export const ARABIC_CENTURY_WORD = 'القرن';
export const arabicOrdinal = n => ORDINALS[n] || arabicNumeral(n);
export const arabicCenturyPhrase = n => `${ARABIC_CENTURY_WORD} ${arabicOrdinal(n)}`;
export const ISLAMIC_NAME = 'هجري';
export const ARABIC_NOW = 'الآن';

export const ISLAMIC_RECKONING = Object.freeze({
  id: 'islamic',
  serialOf: islamicSerialOf,
  dateOf: islamicDateOf,
  monthSpan: islamicMonthSpan,
  dayName: arabicNumeral,
  dayId: (y, m, d) => `d:${y}:${m}:${d}@islamic`
});
