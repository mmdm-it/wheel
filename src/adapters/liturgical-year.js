// THE LITURGICAL YEAR (O-341, Howell 2026-11-25: "modify the manifold calendar
// to work as a Catholic calendar"). Pure arithmetic, no data: for a civil date
// it says which day of the Church's seasons that is — a KEY — and, handed the
// season's day and the date's feast, which of the two the day keeps.
//
// The keys are the ones the volume's table of days is built on
// (`<season><week>-<weekday>`, Sunday 0): Adv1-0 the first Sunday of Advent,
// Quadp1-0 Septuagesima, Quad1-0 the first Sunday of Lent, Pasc0-0 Easter,
// Pasc7-0 Pentecost, Pent01-0 Trinity, Pent24-0 the last Sunday after
// Pentecost, PentEpi5-0 a Sunday after Epiphany taken up again before Advent.
// The reckoning is the Roman calendar of 1960, the one-year cycle (Howell,
// the same day: each day one fixed Gospel).
//
// WHAT THIS DOES NOT DO YET, said here so nobody takes it for the whole of the
// rubrics: no feast is moved to another day when it loses its own (a feast of
// the first class falling in Holy Week is simply not shown that year), and no
// day is shown with a commemoration. Before 1583 nothing is reckoned at all:
// the Gregorian Easter is the only one computed.

const DAY = 86400000;
/** Days since the epoch for a civil date of the Gregorian calendar. */
export const dayNumber = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
const weekdayOf = n => (((n + 4) % 7) + 7) % 7;   // 1970-01-01 was a Thursday
const pad = n => String(n).padStart(2, '0');

/** Easter Sunday of a Gregorian year, as a day number (the anonymous Gregorian computus). */
export function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dayNumber(year, month, day);
}

/** The first Sunday of Advent: the Sunday nearest St Andrew's day, 27 November to 3 December. */
export function adventStart(year) {
  const from = dayNumber(year, 11, 27);
  return from + ((7 - weekdayOf(from)) % 7);
}

/** The season's day a civil date is, or null where the date's own feast is all there is. */
export function temporalKey(year, month, day) {
  if (!(year >= 1583)) return null;
  const n = dayNumber(year, month, day);
  const dow = weekdayOf(n);
  // Christ the King, the last Sunday of October.
  if (month === 10 && dow === 0 && day >= 25) return '10-DU';
  const advent = adventStart(year);
  if (n >= advent) {
    if (month === 12 && day >= 25) return dow === 0 ? 'Nat1-0' : null;
    return `Adv${Math.floor((n - advent) / 7) + 1}-${dow}`;
  }
  const e = easter(year);
  const septuagesima = e - 63;
  if (n < septuagesima) {
    if (month === 1 && day <= 5) {
      // The Holy Name: the Sunday from the 2nd to the 5th, else the 2nd itself.
      const sunday = [2, 3, 4, 5].find(d => weekdayOf(dayNumber(year, 1, d)) === 0);
      if (day === (sunday || 2)) return 'Nat2-0';
      return day >= 2 ? `Nat0${day}` : null;
    }
    if (month === 1 && day === 6) return null;
    // The Sundays after Epiphany, the first of them the Holy Family.
    const after = dayNumber(year, 1, 7);
    const first = after + ((7 - weekdayOf(after)) % 7);
    if (n < first) return null;
    return `Epi${Math.floor((n - first) / 7) + 1}-${dow}`;
  }
  if (n < e - 42) return `Quadp${Math.floor((n - septuagesima) / 7) + 1}-${dow}`;
  if (n < e) return `Quad${Math.floor((n - (e - 42)) / 7) + 1}-${dow}`;
  if (n < e + 56) return `Pasc${Math.floor((n - e) / 7)}-${dow}`;
  // After Pentecost. The last week before Advent is always the twenty-fourth;
  // the weeks between the twenty-third and it take up the Sundays after
  // Epiphany that the year left unsaid, the last of them the sixth.
  const trinity = e + 56;
  const week = Math.floor((n - trinity) / 7) + 1;
  const weeks = (advent - trinity) / 7;
  if (week >= weeks) return `Pent24-${dow}`;
  if (week <= 23) return `Pent${pad(week)}-${dow}`;
  return `PentEpi${6 - (weeks - 1 - week)}-${dow}`;
}

/** The date's own key in the table of feasts. */
export const feastKey = (month, day) => `${pad(month)}-${pad(day)}`;

/**
 * Which of the two the day keeps: the season's day or the date's feast.
 * Ranks are the table's: 6 and above the first class, 5 the second, below
 * that the third class, the ferias and the commemorations.
 */
export function kept(seasonDay, feast, { sunday = false, advent = false } = {}) {
  if (!seasonDay) return feast || null;
  if (!feast) return seasonDay;
  const t = seasonDay.rank ?? 1;
  const s = feast.rank ?? 1;
  if (t >= 6) {
    // A day of the first class keeps itself; Christmas and the Epiphany are
    // above every Sunday, and the Immaculate Conception above Advent's.
    if (s >= 7 && s > t) return feast;
    if (feast.overAdvent && advent && s >= 6) return feast;
    return seasonDay;
  }
  if (sunday && t >= 5) {
    // A Sunday of the second class gives way to a feast of the first class
    // and to a feast of the Lord of the second.
    if (s >= 6 || (feast.lord && s >= 5)) return feast;
    return seasonDay;
  }
  return s >= t ? feast : seasonDay;
}

/**
 * The day, read off the volume's table: what it keeps, and what it leaves.
 * @param table { tempora: { key: day }, sancti: { 'MM-DD': day } }
 * @returns { key, day, other } or null where the table says nothing
 */
export function liturgicalDay(table, year, month, day) {
  if (!table || !(year >= 1583)) return null;
  const read = (y, m, d) => {
    const key = temporalKey(y, m, d);
    const seasonDay = key ? table.tempora?.[key] || null : null;
    const feast = table.sancti?.[feastKey(m, d)] || null;
    const n = dayNumber(y, m, d);
    const keep = kept(seasonDay, feast, { sunday: weekdayOf(n) === 0, advent: /^Adv/.test(key || '') });
    if (!keep) return null;
    return { key: keep === seasonDay ? key : feastKey(m, d), day: keep, other: keep === seasonDay ? feast : seasonDay };
  };
  const own = read(year, month, day);
  if (own) return own;
  // A weekday the table does not name says its Sunday's Mass again: the
  // nearest day before it that the table does name.
  const n = dayNumber(year, month, day);
  for (let back = 1; back <= 7; back += 1) {
    const date = new Date((n - back) * DAY);
    const found = read(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    if (found) return { ...found, feria: true };
  }
  return null;
}
