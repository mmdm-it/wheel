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
