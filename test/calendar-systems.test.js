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
import { isHebrewLeapYear, daysInHebrewYear, hebrewNumeral } from '../src/adapters/calendar-hebrew.js';
import * as islamic from '../src/adapters/calendar-islamic.js';
import * as french from '../src/adapters/calendar-republican.js';
import * as maya from '../src/adapters/calendar-maya.js';
const { arabicNumeral } = islamic;
import { buildCalendarYears, buildCalendarMonthsCousinChain, buildCalendarDaysCousinChain, buildCalendarDecades, buildCalendarCenturies, getCalendarMonths, getCalendarCenturyDecades, getCalendarDecadeYears } from '../src/adapters/volume-helpers.js';

import { calendarManifest } from './helpers/calendar-manifest.js';

const manifest = calendarManifest();
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

describe('the Hebrew calendar (O-248)', () => {
  const H = SYSTEMS.hebrew;
  const at = (y, m, d) => H.dateOf(daySerial(y, m, d));
  it('names the known days: the feasts of 5786–5787, the epoch, 1970, today', () => {
    assert.deepEqual(at(2026, 9, 12), { year: 5787, month: 7, day: 1 }, 'Rosh Hashanah 5787');
    assert.deepEqual(at(2026, 9, 21), { year: 5787, month: 7, day: 10 }, 'Yom Kippur 5787');
    assert.deepEqual(at(2026, 4, 2), { year: 5786, month: 1, day: 15 }, 'Passover 5786');
    assert.deepEqual(at(2024, 10, 3), { year: 5785, month: 7, day: 1 }, 'Rosh Hashanah 5785');
    assert.deepEqual(at(2026, 10, 30), { year: 5787, month: 8, day: 19 }, '19 Heshvan 5787');
    assert.deepEqual(H.dateOf(0), { year: 5730, month: 10, day: 23 }, '1 January 1970');
    // 1 Tishri 1 A.M. is Monday, 7 October 3761 B.C. in the Julian reckoning the volume keeps before 1582.
    assert.deepEqual(serialToDate(H.serialOf(1, 7, 1)), { yearNumber: -3761, month: 10, day: 7 });
    assert.equal(((H.serialOf(1, 7, 1) + 4) % 7 + 7) % 7, 1, 'a Monday');
  });
  it('keeps the year: 12 or 13 months in the 19-year cycle, 353 to 385 days, Tishri first', () => {
    assert.equal(isHebrewLeapYear(5787), true);
    assert.equal(isHebrewLeapYear(5786), false);
    assert.equal(isHebrewLeapYear(5784), true);
    assert.equal(daysInHebrewYear(5787), 385);
    assert.equal(daysInHebrewYear(5786), 354);
    for (let y = 5700; y < 5800; y += 1) assert.ok([353, 354, 355, 383, 384, 385].includes(daysInHebrewYear(y)), String(y));
    const months = H.monthsOf(5787);
    assert.deepEqual(months.map(m => m.name), ['תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר א׳', 'אדר ב׳', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול']);
    assert.deepEqual(months.map(m => m.number), [7, 8, 9, 10, 11, 12, 13, 1, 2, 3, 4, 5, 6]);
    assert.equal(months.reduce((n, m) => n + m.days, 0), 385);
    assert.equal(H.monthsOf(5786).length, 12);
    assert.equal(H.monthsOf(5786).find(m => m.number === 12).name, 'אדר');
    // Every serial of a year round-trips and the months tile the year.
    const first = H.serialOf(5787, 7, 1);
    for (let s = first; s < first + 385; s += 7) {
      const d = H.dateOf(s);
      assert.equal(H.serialOf(d.year, d.month, d.day), s);
      assert.equal(d.year, 5787);
    }
  });
  it('writes its letters and numbers: gematria for days and years, the week by its names, right to left', () => {
    for (const [n, s] of [[1, 'א׳'], [2, 'ב׳'], [10, 'י׳'], [15, 'ט״ו'], [16, 'ט״ז'], [19, 'י״ט'], [20, 'כ׳'], [30, 'ל׳'], [761, 'תשס״א'], [5787, 'ה׳תשפ״ז'], [6761, 'ו׳תשס״א']]) {
      assert.equal(hebrewNumeral(n), s, String(n));
    }
    assert.equal(H.dayName(19), 'י״ט');
    assert.equal(H.yearName(5787), 'ה׳תשפ״ז');
    assert.equal(H.direction, 'rtl');
    assert.equal(G.direction, 'ltr');
    assert.equal(H.weekdays[5], 'יום שישי');
    assert.equal(H.weekdays[6], 'שבת');
    assert.deepEqual(H.weekdayLetters, ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']);
    assert.deepEqual(G.weekdayLetters, ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    const cells = monthCells(5787, 8, H.reckoning).flat().filter(Boolean);
    assert.equal(H.reckoning.dayName(cells[18].day), 'י״ט');
  });
  it('names the rings above the years in Hebrew, with the century\'s word first', () => {
    assert.equal(H.decadeWord(8), 'שנות השמונים');
    assert.equal(H.decadeWord(0), 'שנות האפס');
    assert.equal(H.centuryLens(58, 1), 'הנ״ח');
    assert.equal(H.centuryLabel(58, 1), 'הנ״ח');
    assert.equal(H.centuryPhrase(58, 1), 'המאה הנ״ח');
    assert.equal(H.centuryWord(1), 'המאה');
    assert.equal(H.nativeName, 'עברי');
    assert.equal(H.nowWord, 'עכשיו');
    assert.equal(G.nowWord, 'NOW');
    assert.equal(G.decadeWord(8), 'EIGHTIES');
    assert.equal(G.centuryLens(21, 1), '21st');
    assert.equal(G.centuryLabel(3, -1), '3rd B.C.');
    assert.equal(G.centuryPhrase(8, -1), '8th CENTURY B.C.');
    assert.equal(G.centuryWord(-1), 'CENTURY B.C.');
    assert.equal(G.nativeName, 'GREGORIAN');
    const decades = buildCalendarDecades(manifest, { initialItemId: 'dd:578@hebrew' });
    assert.equal(decades.items[decades.selectedIndex].name, 'שנות השמונים');
    const centuries = buildCalendarCenturies(manifest, { initialItemId: 'c:58@hebrew' });
    assert.equal(centuries.items[centuries.selectedIndex].name, 'הנ״ח');
    // The host keeps the word before the numeral for a right-to-left script.
    assert.match(fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8'), /const captionIsAfter = \(\) => Boolean\(captionAfter\) && textDirection\(\) !== 'rtl';/);
  });
  it('builds the rings: ids suffixed @hebrew, months in civil order, the span 761 to 6761, today red at its Hebrew name', () => {
    const years = buildCalendarYears(manifest, { initialItemId: '5787@hebrew' });
    const real = years.items.filter(Boolean);
    assert.equal(real[0].id, '761@hebrew');
    assert.equal(real[real.length - 1].id, '6761@hebrew');
    const y = years.items[years.selectedIndex];
    assert.equal(y.name, 'ה׳תשפ״ז');
    assert.equal(y.now, true);
    const sky = getCalendarMonths(manifest, y, 'year');
    assert.equal(sky[0].id, '5787:tishri@hebrew');
    assert.equal(sky[1].id, '5787:heshvan@hebrew');
    assert.equal(sky.filter(m => m.now).map(m => m.name).join(), 'חשון');
    const chain = buildCalendarMonthsCousinChain(manifest, { initialItemId: '5787:heshvan@hebrew' });
    const m = chain.items[chain.selectedIndex];
    assert.equal(m.monthNumber, 8);
    assert.equal(chain.items[chain.selectedIndex - 1].name, 'תשרי');
    const t = todaySerial();
    const p = H.dateOf(t);
    const days = buildCalendarDaysCousinChain(manifest, { centerId: H.dayId(p.year, p.month, p.day) });
    const now = days.items.filter(i => i && i.now);
    assert.equal(now.length, 1);
    assert.equal(now[0].monthName, H.monthsOf(p.year).find(mm => mm.number === p.month).name);
    assert.equal(now[0].yearName, hebrewNumeral(p.year));
    assert.equal(now[0].name, hebrewNumeral(p.day));
    assert.equal(monthWeeks(5787, 8, H.reckoning).flat().filter(Boolean).length, 30, 'Heshvan 5787 is long');
  });
});

describe('the Islamic calendar (O-250)', () => {
  const I = SYSTEMS.islamic;
  const at = (y, m, d) => I.dateOf(daySerial(y, m, d));
  it('counts from the Hijra: the epoch, Ramadan 1447, 1970, today', () => {
    assert.deepEqual(at(622, 7, 16), { year: 1, month: 1, day: 1 }, '1 Muharram 1 is 16 July 622');
    assert.equal(((I.serialOf(1, 1, 1) + 4) % 7 + 7) % 7, 5, 'a Friday');
    assert.deepEqual(at(2026, 2, 18), { year: 1447, month: 9, day: 1 }, '1 Ramadan 1447');
    assert.deepEqual(I.dateOf(0), { year: 1389, month: 10, day: 22 }, '1 January 1970');
    assert.deepEqual(at(2026, 10, 30), { year: 1448, month: 5, day: 18 });
    assert.ok(Number.isFinite(I.epochSerial));
    assert.equal(I.epochSerial, daySerial(622, 7, 16));
  });
  it('keeps the year: 354 or 355 days, eleven leap years in thirty, months of 30 and 29 by turns', () => {
    const { isIslamicLeapYear, daysInIslamicYear } = islamic;
    assert.equal(isIslamicLeapYear(1447), true);
    assert.equal(isIslamicLeapYear(1448), false);
    let leaps = 0;
    for (let y = 1441; y <= 1470; y += 1) if (isIslamicLeapYear(y)) leaps += 1;
    assert.equal(leaps, 11);
    assert.equal(daysInIslamicYear(1447), 355);
    assert.equal(daysInIslamicYear(1448), 354);
    const months = I.monthsOf(1447);
    assert.deepEqual(months.map(m => m.days), [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30]);
    assert.deepEqual(I.monthsOf(1448).map(m => m.days).slice(-1), [29]);
    assert.equal(months[8].name, 'رمضان');
    assert.equal(months[0].key, 'muharram');
    const first = I.serialOf(1447, 1, 1);
    for (let s = first; s < first + 355; s += 5) {
      const d = I.dateOf(s);
      assert.equal(I.serialOf(d.year, d.month, d.day), s);
      assert.equal(d.year, 1447);
    }
  });
  it('writes Arabic: numerals, the week, the rings above the years, its name and its word for now, right to left', () => {
    assert.equal(I.direction, 'rtl');
    assert.equal(I.dayName(19), '١٩');
    assert.equal(I.yearName(1448), '١٤٤٨');
    assert.equal(I.weekdays[5], 'الجمعة');
    assert.deepEqual(I.weekdayLetters, ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']);
    assert.equal(I.decadeWord(8), 'الثمانينيات');
    assert.equal(I.centuryLens(15, 1), 'الخامس عشر');
    assert.equal(I.centuryPhrase(15, 1), 'القرن الخامس عشر');
    assert.equal(I.centuryWord(1), 'القرن');
    assert.equal(I.centuryLens(31, 1), '٣١', 'beyond the words, the number');
    assert.equal(I.nativeName, 'هجري');
    assert.equal(I.nowWord, 'الآن');
    const years = buildCalendarYears(manifest, { initialItemId: '1448@islamic' });
    const real = years.items.filter(Boolean);
    assert.equal(real[0].id, '1@islamic', 'the ring starts at the Hijra');
    assert.equal(years.items[years.selectedIndex].name, '١٤٤٨');
    const t = todaySerial();
    const p = I.dateOf(t);
    const days = buildCalendarDaysCousinChain(manifest, { centerId: I.dayId(p.year, p.month, p.day) });
    const now = days.items.filter(i => i && i.now);
    assert.equal(now.length, 1);
    assert.equal(now[0].name, arabicNumeral(p.day));
    assert.equal(now[0].monthName, I.monthsOf(p.year)[p.month - 1].name);
  });
});

describe('the French Republican calendar (O-251)', () => {
  const F = SYSTEMS.republican;
  const at = (y, m, d) => F.dateOf(daySerial(y, m, d));
  const on = (y, m, d) => serialToDate(F.serialOf(y, m, d));
  it('begins at the equinox of 1792 and keeps the Convention\'s own dates', () => {
    assert.deepEqual(at(1792, 9, 22), { year: 1, month: 1, day: 1 }, '1 Vendémiaire An I');
    assert.equal(F.epochSerial, daySerial(1792, 9, 22));
    assert.deepEqual(on(2, 11, 9), { yearNumber: 1794, month: 7, day: 27 }, '9 Thermidor An II');
    assert.deepEqual(on(8, 2, 18), { yearNumber: 1799, month: 11, day: 9 }, '18 Brumaire An VIII');
    assert.deepEqual(on(14, 4, 10), { yearNumber: 1805, month: 12, day: 31 }, '10 Nivôse An XIV, the last day it was kept');
    // The fourteen New Years as the almanacs printed them.
    const newYears = [[1792, 22], [1793, 22], [1794, 22], [1795, 23], [1796, 22], [1797, 22], [1798, 22], [1799, 23], [1800, 23], [1801, 23], [1802, 23], [1803, 24], [1804, 23], [1805, 23]];
    newYears.forEach(([y, d], i) => assert.deepEqual(on(i + 1, 1, 1), { yearNumber: y, month: 9, day: d }, `An ${i + 1}`));
  });
  it('takes its leap years from the true equinox at Paris: III, VII, XI, and 235 begins on 23 September 2026', () => {
    const { isFrenchLeapYear, daysInFrenchYear, solarLongitude } = french;
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(isFrenchLeapYear), [3, 7, 11]);
    assert.equal(daysInFrenchYear(3), 366);
    assert.equal(daysInFrenchYear(4), 365);
    // The Sun's longitude at three published equinoxes, to a ten-thousandth of a degree.
    const rd = (y, m, d, h) => daySerial(y, m, d) + 719163 + h / 24;
    assert.ok(Math.abs(solarLongitude(rd(2026, 9, 23, 5 / 60)) - 180) < 0.001, 'autumn 2026: 23 September 00:05 UT');
    assert.ok(Math.abs(solarLongitude(rd(2025, 9, 22, 18 + 19 / 60)) - 180) < 0.001, 'autumn 2025');
    assert.ok(solarLongitude(rd(2000, 3, 20, 7 + 35 / 60)) < 0.001, 'spring 2000');
    assert.deepEqual(at(2026, 9, 23), { year: 235, month: 1, day: 1 });
    assert.deepEqual(at(2026, 9, 22), { year: 234, month: 13, day: 6 }, 'the last festival of 234, a sextile year (22 Sep 2025 to 23 Sep 2026)');
    assert.equal(daysInFrenchYear(234), 366);
    assert.equal(daysInFrenchYear(235), 365);
    assert.deepEqual(at(2026, 10, 30), { year: 235, month: 2, day: 8 }, '8 Brumaire 235 (Romme\'s rule would say the 9th)');
    const first = F.serialOf(234, 1, 1);
    for (let s = first; s < first + 365; s += 3) {
      const d = F.dateOf(s);
      assert.equal(F.serialOf(d.year, d.month, d.day), s);
    }
  });
  it('has twelve months of thirty and the festivals: five, six in a leap year, each with a name', () => {
    const months = F.monthsOf(235);
    assert.equal(months.length, 13);
    assert.deepEqual(months.slice(0, 12).map(m => m.days), new Array(12).fill(30));
    assert.equal(months[12].days, 5);
    assert.equal(F.monthsOf(3)[12].days, 6, 'An III was sextile');
    assert.equal(months[0].name, 'Vendémiaire');
    assert.equal(months[0].short, 'VEND');
    assert.equal(months[10].name, 'Thermidor');
    assert.equal(months[12].name, 'Sansculottides');
    assert.equal(F.monthId(235, 2), '235:brumaire@republican');
    assert.equal(F.dayWord(235, 1, 1), 'Raisin');
    assert.equal(F.dayWord(235, 2, 8), 'Scorsonère');
    assert.equal(F.dayWord(235, 12, 14), 'Noix');
    assert.equal(F.dayWord(235, 1, 10), 'Cuve', 'every décadi a tool');
    assert.equal(F.dayWord(235, 1, 5), 'Cheval', 'every quintidi an animal');
    assert.equal(F.dayWord(3, 13, 6), 'La Révolution');
    assert.equal(F.dayWord(235, 13, 5), 'Les Récompenses');
    for (let m = 1; m <= 12; m += 1) for (let d = 1; d <= 30; d += 1) assert.ok(F.dayWord(235, m, d), `${m}/${d} named`);
  });
  it('counts the week in décades: ten columns headed I to X, begun afresh each year', () => {
    const { FRENCH_RECKONING } = french;
    assert.equal(FRENCH_RECKONING.week.length, 10);
    assert.deepEqual(F.weekdayLetters, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
    assert.equal(F.weekdays[9], 'Décadi');
    assert.equal(F.weekdayOf(F.serialOf(235, 1, 1)), 0, 'the first of the year is a primidi');
    assert.equal(F.weekdayOf(F.serialOf(235, 2, 8)), 7, 'the 8th an octidi');
    assert.equal(F.weekdayOf(F.serialOf(235, 2, 10)), 9, 'the 10th a décadi');
    assert.equal(F.weekdayOf(F.serialOf(235, 2, 11)), 0, 'and the 11th a primidi again');
    const rows = monthCells(235, 2, FRENCH_RECKONING);
    assert.equal(rows.length, 3, 'three rows');
    assert.ok(rows.every(r => r.length === 10 && r.every(Boolean)), 'of ten, all full');
    assert.deepEqual(rows[2].map(c => c.day), [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    const fetes = monthCells(235, 13, FRENCH_RECKONING);
    assert.equal(fetes.length, 1);
    assert.deepEqual(fetes[0].map(c => c && c.day), [1, 2, 3, 4, 5, null, null, null, null, null]);
    // The rows are consistent with themselves across a New Year: a serial
    // lies in the row its continuous row number names.
    const week = FRENCH_RECKONING.week;
    for (let s = F.serialOf(234, 12, 25); s <= F.serialOf(235, 1, 12); s += 1) {
      const row = week.rowAt(Math.floor(week.rowOf(s)));
      assert.ok(s >= row.serial && s < row.serial + row.length, `serial ${s} in its row`);
      assert.equal(week.columnOf(s), s - row.serial);
    }
    assert.equal(week.rowAt(Math.floor(week.rowOf(F.serialOf(234, 13, 1)))).length, 6, 'the festivals are one short row (six in 234)');
    assert.equal(week.rowAt(Math.floor(week.rowOf(F.serialOf(235, 13, 1)))).length, 5, 'five in 235');
    assert.equal(monthWeeks(2026, 7).length, 5, 'the seven-day grid is untouched');
  });
  it('writes French: Roman years, the rings above them, its name, its word for now; and the sky wears its short months', () => {
    const { romanNumeral } = french;
    assert.equal(F.direction, 'ltr');
    assert.equal(F.yearName(14), 'XIV');
    assert.equal(F.yearName(235), 'CCXXXV');
    assert.equal(romanNumeral(1208), 'MCCVIII');
    assert.equal(F.dayName(8), '8');
    assert.equal(F.decadeWord(3), 'ANNÉES TRENTE');
    assert.equal(F.decadeShort(9, 295), 'CCXC', 'the sky names a decade by its first year in Roman numerals');
    assert.equal(F.decadeShort(0, 3), 'I', 'the first decade of the Republic');
    assert.equal(G.decadeShort(9, 1995), '', 'the English words are short already');
    const decades = buildCalendarDecades(manifest, { initialItemId: 'dd:23@republican' });
    assert.equal(decades.items[decades.selectedIndex].short, 'CCXXX');
    assert.equal(decades.items[decades.selectedIndex].name, 'ANNÉES TRENTE');
    assert.equal(F.centuryLens(3, 1), 'IIIᵉ');
    assert.equal(F.centuryLens(1, 1), 'Iᵉʳ');
    assert.equal(F.centuryPhrase(3, 1), 'IIIᵉ SIÈCLE');
    assert.equal(F.centuryWord(1), 'SIÈCLE');
    assert.equal(F.nativeName, 'RÉPUBLICAIN');
    assert.equal(F.nowWord, 'PRÉSENT');
    const years = buildCalendarYears(manifest, { initialItemId: '235@republican' });
    const real = years.items.filter(Boolean);
    assert.equal(real[0].id, '1@republican', 'the ring starts at the Republic');
    assert.equal(years.items[years.selectedIndex].name, 'CCXXXV');
    const sky = getCalendarMonths(manifest, years.items[years.selectedIndex], 'year');
    assert.equal(sky.length, 13);
    assert.equal(sky[0].short, 'VEND');
    assert.equal(sky[12].short, 'FÊTES');
    const t = todaySerial();
    const p = F.dateOf(t);
    const days = buildCalendarDaysCousinChain(manifest, { centerId: F.dayId(p.year, p.month, p.day) });
    const now = days.items.filter(i => i && i.now);
    assert.equal(now.length, 1);
    assert.equal(now[0].dayWord, F.dayWord(p.year, p.month, p.day));
    assert.equal(now[0].monthName, F.monthsOf(p.year)[p.month - 1].name);
    const first = days.items.find(Boolean);
    assert.ok(first.serial >= F.epochSerial, 'no day before the Republic');
  });
});

describe('the Maya calendar (O-252)', () => {
  const M = SYSTEMS.maya;
  const lc = (y, m, d) => maya.longCountLabel(maya.longCountOf(daySerial(y, m, d)));
  it('counts the Long Count from the creation by the standard correlation', () => {
    assert.equal(lc(-3114, 9, 6), '0.0.0.0.0', '11 August 3114 BC proleptic Gregorian, 6 September Julian');
    assert.equal(M.epochSerial, daySerial(-3114, 9, 6));
    assert.equal(lc(2012, 12, 21), '13.0.0.0.0');
    assert.equal(lc(1970, 1, 1), '12.17.16.7.5');
    assert.equal(lc(2026, 10, 30), '13.0.14.1.1');
    assert.equal(maya.MAYA_EPOCH_RD, 584283 - 1721425, 'Julian day 584283');
  });
  it('names every day by the Tzolk\'in and the Haab\'', () => {
    const at = (y, m, d) => `${maya.tzolkinLabel(daySerial(y, m, d))} ${maya.haabLabel(daySerial(y, m, d))}`;
    assert.equal(at(-3114, 9, 6), '4 Ajaw 8 Kumk\'u');
    assert.equal(at(2012, 12, 21), '4 Ajaw 3 K\'ank\'in');
    assert.equal(at(1970, 1, 1), '13 Chikchan 3 K\'ank\'in');
    assert.equal(at(2026, 10, 30), '8 Imix 14 Sak');
    // The Calendar Round: the same pair of names returns after 18,980 days.
    const s = daySerial(2026, 10, 30);
    assert.equal(at(2026, 10, 30), `${maya.tzolkinLabel(s + 18980)} ${maya.haabLabel(s + 18980)}`);
    assert.notEqual(maya.tzolkinLabel(s), maya.tzolkinLabel(s + 260 * 3 + 1));
    assert.equal(M.dayTitle(s), '8 Imix', 'the card is headed by the Tzolk\'in');
    const d = M.dateOf(s);
    assert.equal(M.dayWord(d.year, d.month, d.day), '14 Sak', 'and says the Haab\'');
  });
  it('is the engine\'s own ladder: tuns for years grouped by twenties, winals for months, k\'ins in rows of five', () => {
    const s = daySerial(2026, 10, 30);
    assert.deepEqual(M.dateOf(s), { year: 5214, month: 2, day: 2 }, 'tun 5214 since the creation, winal 1, k\'in 1 — shown from zero');
    assert.equal(M.yearName(5214), '13.0.14');
    assert.equal(M.yearName(0), '0.0.0');
    assert.equal(M.yearName(5200), '13.0.0');
    assert.equal(M.serialOf(5214, 2, 2), s);
    assert.equal(M.monthsOf(5214).length, 18);
    assert.equal(M.monthsOf(5214)[0].name, '0');
    assert.equal(M.monthsOf(5214)[17].name, '17');
    assert.equal(M.monthId(5214, 2), '5214:w1@maya');
    assert.equal(M.dayName(1), '0');
    assert.equal(M.dayName(20), '19');
    assert.equal(M.monthPhrase(M.yearName(5214), '1'), '13.0.14.1');
    // The rungs above the tun.
    assert.equal(M.decadeKey(5214), 'dd:260');
    assert.equal(M.decadeDigit(5214), 0, '13.0.14 is in k\'atun 0 of b\'ak\'tun 13');
    assert.equal(M.decadeWord(M.decadeDigit(5214)), 'K\'ATUN 0');
    assert.equal(M.decadeDigit(5199), 19, '12.19.19 is in k\'atun 19');
    assert.equal(M.centuryKey(5214), 'c:13');
    assert.equal(M.centuryNumber(5214), 13);
    assert.equal(M.centuryLabel(13, 1), 'B\'AK\'TUN 13');
    assert.equal(M.centuryLens(13, 1), '13');
    assert.equal(M.centuryWord(1), 'B\'AK\'TUN');
    assert.equal(G.decadeKey(2026), 'dd:202', 'the Gregorian keeps its digits');
    assert.equal(G.centuryNumber(2026), 21);
    // The grid: four rows of five, no header.
    const rows = monthCells(5214, 2, maya.MAYA_RECKONING);
    assert.equal(rows.length, 4);
    assert.ok(rows.every(r => r.length === 5 && r.every(Boolean)));
    assert.deepEqual(rows[0].map(c => c.day), [1, 2, 3, 4, 5]);
    assert.deepEqual(M.weekdayLetters, ['', '', '', '', '']);
    assert.equal(maya.MAYA_WEEK.rows, 4);
    const week = maya.MAYA_WEEK;
    for (let x = s - 30; x <= s + 30; x += 1) {
      const row = week.rowAt(Math.floor(week.rowOf(x)));
      assert.ok(x >= row.serial && x < row.serial + 5);
      assert.equal(week.columnOf(x), x - row.serial);
    }
  });
  it('rings from the creation, grouped by its own count, the present marked', () => {
    assert.equal(M.nativeName, 'MAYA');
    assert.equal(M.nowWord, 'BEJLA\'E\'');
    // The creation is 3114 BC: inside the data's span since O-249 (3999 BC), not the test helper's default.
    const manifest = calendarManifest(-3999, 3000);
    const years = buildCalendarYears(manifest, { initialItemId: '5214@maya' });
    const real = years.items.filter(Boolean);
    assert.equal(real[0].id, '0@maya', 'the ring starts at the creation');
    assert.equal(real[0].name, '0.0.0');
    assert.equal(years.items[years.selectedIndex].name, '13.0.14');
    assert.ok(real[real.length - 1].yearNumber > 6100, 'and runs to the span\'s end');
    const decades = buildCalendarDecades(manifest, { initialItemId: 'dd:260@maya' });
    const dec = decades.items[decades.selectedIndex];
    assert.equal(dec.name, 'K\'ATUN 0');
    assert.equal(dec.firstYear, 5200);
    assert.equal(dec.lastYear, 5219);
    assert.equal(dec.parentId, 'c:13@maya');
    assert.equal(decades.items.filter(Boolean).filter(i => i.parentId === 'c:13@maya').length, 20, 'twenty k\'atuns to a b\'ak\'tun');
    const centuries = buildCalendarCenturies(manifest, { initialItemId: 'c:13@maya' });
    const cent = centuries.items[centuries.selectedIndex];
    assert.equal(cent.name, 'B\'AK\'TUN 13');
    assert.equal(cent.firstYear, 5200);
    assert.equal(cent.lastYear, 5599);
    assert.equal(centuries.items.filter(Boolean)[0].name, 'B\'AK\'TUN 0');
    assert.equal(getCalendarCenturyDecades(manifest, 'c:13@maya').length, 20);
    assert.equal(getCalendarDecadeYears(manifest, 'dd:260@maya').length, 20);
    // In the skies of twenty, short forms: the place alone.
    assert.equal(getCalendarCenturyDecades(manifest, 'c:13@maya')[11].short, '11');
    assert.equal(getCalendarDecadeYears(manifest, 'dd:260@maya')[16].short, '16');
    assert.equal(getCalendarDecadeYears(manifest, 'dd:260@maya')[16].name, '13.0.16', 'the ring keeps the Long Count');
    assert.equal(G.yearShort(2026), '', 'the Gregorian year is short already');
    assert.equal(getCalendarMonths(manifest, years.items[years.selectedIndex], 'year').length, 18);
    const t = todaySerial();
    const p = M.dateOf(t);
    const days = buildCalendarDaysCousinChain(manifest, { centerId: M.dayId(p.year, p.month, p.day) });
    const now = days.items.filter(i => i && i.now);
    assert.equal(now.length, 1);
    assert.equal(now[0].name, String(p.day - 1));
    assert.equal(now[0].dayWord, M.dayWord(p.year, p.month, p.day));
    assert.ok(days.items.find(Boolean).serial >= M.epochSerial);
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
