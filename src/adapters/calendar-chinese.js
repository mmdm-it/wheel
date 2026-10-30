// THE CHINESE CALENDAR (O-253, Howell 2026-10-30: "Proceed with the Chinese
// as you think best"). The lunisolar calendar of the 1645 reform as it is
// still kept: a month begins on the day of the new moon, a year on the
// second (sometimes third) new moon after the winter solstice, and a year
// of thirteen moons takes a LEAP month — the first of its moons that holds
// no major solar term, wearing the number of the month before it. Every
// one of those is astronomical, judged at midnight in China: Beijing's own
// time before 1929, the 120th meridian's (eight hours east) since. Years
// are named by the sexagenary cycle of ten stems and twelve branches —
// 甲子 to 癸亥 — and counted here from the traditional epoch, 2637 B.C.
//
// Reingold and Dershowitz's reckoning ("Calendrical Calculations", the
// Chinese calendar), on R.D. day numbers, with the Sun and the Moon from
// astronomy.js. The sui — solstice to solstice — is the unit the leap rule
// is stated in; a civil year straddles two, and takes its months' numbers
// from whichever sui each moon falls in. Everything is memoised by year,
// since the ribbon asks for every day and the months ring for every year.
//
// The engine's dialect: the YEAR is the count from the epoch (4663 is 丙午,
// the year that began 17 February 2026), the MONTH a moon's PLACE in its
// year, 1 to 12 or 13 (a leap month is a place of its own, named 閏), the
// DAY the day of the moon, 1 to 29 or 30. Chinese numerals throughout; the
// week by its Chinese names, Sunday first.

import { solarLongitude, estimatePriorSolarLongitude, newMoonAtOrAfter, newMoonBefore,
  gregorianYearFromFixed, fixedFromGregorian, MEAN_SYNODIC_MONTH, MEAN_TROPICAL_YEAR } from './astronomy.js';

const RD_OF_SERIAL_ZERO = 719163;                 // 1 January 1970, R.D.
export const CHINESE_EPOCH_RD = -963099;          // 15 February 2637 B.C. (proleptic Gregorian)
const WINTER = 270;                                // the Sun's longitude at the winter solstice

const mod = (a, b) => ((a % b) + b) % b;
const amod = (a, b) => mod(a - 1, b) + 1;
const rdOf = serial => serial + RD_OF_SERIAL_ZERO;
const serialOfRd = rd => rd - RD_OF_SERIAL_ZERO;

// ---- Midnight in China, and a moment's civil day there.
const zoneOf = tee => (gregorianYearFromFixed(Math.floor(tee)) < 1929 ? 1397 / 180 / 24 : 8 / 24);
const midnightInChina = rd => rd - zoneOf(rd);
const chinaDayOf = tee => Math.floor(tee + zoneOf(tee));

// Memoised by their integer argument: the leap rule asks the same questions
// of the same days from several directions.
const memo = (fn, cap = 16384) => {
  const m = new Map();
  return x => {
    if (m.has(x)) return m.get(x);
    const v = fn(x);
    if (m.size > cap) m.clear();
    m.set(x, v);
    return v;
  };
};
// The day (in China) of the first new moon on or after `rd`, and of the last before it.
const newMoonOnOrAfterDay = memo(rd => chinaDayOf(newMoonAtOrAfter(midnightInChina(rd))));
const newMoonBeforeDay = memo(rd => chinaDayOf(newMoonBefore(midnightInChina(rd))));
// The major solar term (中气) the Sun is in at the start of `rd`: 1 … 12.
const currentMajorSolarTerm = memo(rd => amod(2 + Math.floor(solarLongitude(midnightInChina(rd)) / 30), 12));
// A month beginning on `rd` with no major solar term inside it.
const noMajorSolarTerm = memo(rd => currentMajorSolarTerm(rd) === currentMajorSolarTerm(newMoonOnOrAfterDay(rd + 1)));

// The winter solstice on or before `rd`, as a day in China; memoised by the
// Gregorian year it falls in, since it is asked for from many days.
const solsticeOfYear = memo(gy => {
  const rd = fixedFromGregorian(gy, 12, 31);
  const approx = estimatePriorSolarLongitude(WINTER, midnightInChina(rd + 1));
  let day = Math.floor(approx) - 1;
  while (!(WINTER < solarLongitude(midnightInChina(day + 1)))) day += 1;
  return day;
});
function winterSolsticeOnOrBefore(rd) {
  const gy = gregorianYearFromFixed(rd);
  const s = solsticeOfYear(gy);
  return s <= rd ? s : solsticeOfYear(gy - 1);
}

// ---- THE SUI: from one winter solstice to the next, its moons numbered.
// m12 is the first moon after the solstice (the twelfth month, unless a
// leap makes it an eleventh); the sui holds a leap month when twelve whole
// months fit before the next solstice's own eleventh month.
const suiInfo = memo(s1 => {
  const s2 = winterSolsticeOnOrBefore(s1 + 370);
  const m12 = newMoonOnOrAfterDay(s1 + 1);
  const nextM11 = newMoonBeforeDay(s2 + 1);
  const leapSui = Math.round((nextM11 - m12) / MEAN_SYNODIC_MONTH) === 12;
  const moons = [];
  let seenNoMajor = false;
  for (let m = m12; m <= nextM11; m = newMoonOnOrAfterDay(m + 1)) {
    const lacks = leapSui && noMajorSolarTerm(m);
    const leap = lacks && !seenNoMajor;
    const number = amod(Math.round((m - m12) / MEAN_SYNODIC_MONTH) - (leapSui && (seenNoMajor || lacks) ? 1 : 0), 12);
    if (lacks) seenNoMajor = true;
    moons.push({ rd: m, number, leap });
  }
  return { s1, s2, m12, nextM11, leapSui, moons };
});
// The New Year of the sui that holds `rd`: the second moon after the
// solstice, or the third when a leap month comes between.
function newYearInSui(rd) {
  const info = suiInfo(winterSolsticeOnOrBefore(rd));
  const [m12, m13, m14] = info.moons;
  return info.leapSui && (noMajorSolarTerm(m12.rd) || noMajorSolarTerm(m13.rd)) ? m14.rd : m13.rd;
}
function chineseNewYearOnOrBefore(rd) {
  const ny = newYearInSui(rd);
  return rd >= ny ? ny : newYearInSui(rd - 180);
}

// ---- THE YEAR: its New Year, and its moons with their numbers and lengths.
const newYearOf = memo(year => chineseNewYearOnOrBefore(Math.floor(CHINESE_EPOCH_RD + (year - 0.5) * MEAN_TROPICAL_YEAR)));
const numberingOf = m => {
  let info = suiInfo(winterSolsticeOnOrBefore(m));
  let entry = info.moons.find(e => e.rd === m);
  if (!entry) { info = suiInfo(winterSolsticeOnOrBefore(info.s1 - 1)); entry = info.moons.find(e => e.rd === m); }
  return entry || { number: 0, leap: false };
};
const yearInfo = memo(year => {
  const newYear = newYearOf(year);
  const next = newYearOf(year + 1);
  const months = [];
  for (let m = newYear; m < next; m = newMoonOnOrAfterDay(m + 1)) {
    const { number, leap } = numberingOf(m);
    months.push({ start: m, number, leap, days: newMoonOnOrAfterDay(m + 1) - m });
  }
  return { newYear, next, months };
});

// ---- The volume's dialect.
export function chineseDateOf(serial) {
  const rd = rdOf(serial);
  let year = Math.floor((rd - CHINESE_EPOCH_RD) / MEAN_TROPICAL_YEAR) + 1;
  while (newYearOf(year + 1) <= rd) year += 1;
  while (newYearOf(year) > rd) year -= 1;
  const { months } = yearInfo(year);
  let i = months.length - 1;
  while (i > 0 && months[i].start > rd) i -= 1;
  return { yearNumber: year, month: i + 1, day: rd - months[i].start + 1 };
}
export const chineseSerialOf = (year, month, day) => {
  const { months } = yearInfo(year);
  const mo = months[Math.min(months.length, Math.max(1, month)) - 1];
  return serialOfRd(mo.start + day - 1);
};
export const chineseMonthSpan = (year, month) => yearInfo(year).months[month - 1]?.days ?? 29;
export const isChineseLeapYear = year => yearInfo(year).months.length === 13;
// Warm a year's table ahead of need (the adapter does this in idle moments).
export const warmChineseYear = year => { yearInfo(year); };
export const chineseNewYearSerial = year => serialOfRd(newYearOf(year));

// ---- NAMES. The sexagenary cycle for years and days; Chinese numerals for
// months, days and cycles.
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const sexagenary = n => STEMS[amod(n, 10) - 1] + BRANCHES[amod(n, 12) - 1];
export const chineseYearName = year => (year >= 1 ? sexagenary(year) : String(year));
// The day's own stem and branch (甲子日 was R.D. 45).
export const chineseDayStemBranch = serial => `${sexagenary(rdOf(serial) - 45)}日`;
const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function chineseNumeral(n) {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n < 10) return DIGITS[n];
  if (n < 20) return `十${n % 10 ? DIGITS[n % 10] : ''}`;
  if (n < 100) return `${DIGITS[Math.floor(n / 10)]}十${n % 10 ? DIGITS[n % 10] : ''}`;
  if (n < 1000) {
    const h = Math.floor(n / 100), rest = n % 100;
    if (!rest) return `${DIGITS[h]}百`;
    if (rest < 10) return `${DIGITS[h]}百零${DIGITS[rest]}`;
    return `${DIGITS[h]}百${DIGITS[Math.floor(rest / 10)]}十${rest % 10 ? DIGITS[rest % 10] : ''}`;
  }
  return String(n);
}
const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
export const chineseMonthName = (number, leap) => `${leap ? '閏' : ''}${MONTH_NAMES[number - 1] || String(number)}`;
// The days as the almanac writes them: 初一 to 初十, 十一 to 二十, 廿一 to 三十.
export function chineseDayName(d) {
  if (d < 10) return `初${DIGITS[d]}`;
  if (d === 10) return '初十';
  if (d < 20) return `十${DIGITS[d - 10]}`;
  if (d === 20) return '二十';
  if (d < 30) return `廿${DIGITS[d - 20]}`;
  return '三十';
}
export const chineseMonthsOf = year => yearInfo(year).months.map((mo, i) => ({
  number: i + 1, key: `m${i + 1}`, name: chineseMonthName(mo.number, mo.leap), days: mo.days
}));
export const chineseMonthKeyOf = month => `m${month}`;
export const CHINESE_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
export const CHINESE_WEEKDAY_LETTERS = ['日', '一', '二', '三', '四', '五', '六'];

// THE RUNGS ABOVE THE YEAR: the sexagenary cycle of sixty (一甲子) where the
// centuries go, and inside it the six 旬 of ten years, each named for the
// 甲 year that opens it — 甲子旬, 甲戌旬, 甲申旬, 甲午旬, 甲辰旬, 甲寅旬.
export const CHINESE_GROUPING = Object.freeze({
  decadeKey: y => `dd:${Math.floor((y - 1) / 10)}`,
  decadeDigit: y => Math.floor(mod(y - 1, 60) / 10),
  centuryKey: y => `c:${Math.floor((y - 1) / 60) + 1}`,
  centuryNumber: y => Math.floor((y - 1) / 60) + 1,
  millenniumKey: y => `m:${Math.floor((y - 1) / 600)}`
});
export const CHINESE_DECADE_WORDS = ['甲子旬', '甲戌旬', '甲申旬', '甲午旬', '甲辰旬', '甲寅旬'];
export const CHINESE_CYCLE_WORD = '甲子';
export const chineseCycleLabel = n => `第${chineseNumeral(n)}${CHINESE_CYCLE_WORD}`;
export const CHINESE_NAME = '農曆';
export const CHINESE_NOW = '現在';

export const CHINESE_RECKONING = Object.freeze({
  id: 'chinese',
  serialOf: chineseSerialOf,
  dateOf: chineseDateOf,
  monthSpan: chineseMonthSpan,
  dayName: chineseDayName,
  dayId: (y, m, d) => `d:${y}:${m}:${d}@chinese`
});
