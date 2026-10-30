// THE MAYA CALENDAR (O-252, Howell 2026-10-30: "Proceed with the Mayan
// discussion" — "Yes to both. Proceed."). Three counts kept at once, and
// none of them a year in our sense:
//
// THE LONG COUNT is an odometer of days from the creation date, 0.0.0.0.0 —
// 11 August 3114 B.C. in the proleptic Gregorian, 6 September in the Julian
// the volume's historical reckoning uses before 1582 — in a vigesimal
// ladder of five rungs: twenty k'ins a winal, eighteen winals a tun of 360
// days, twenty tuns a k'atun, twenty k'atuns a b'ak'tun of 144,000 days.
// Scholars write it with dots; 13.0.0.0.0 was 21 December 2012. The ladder
// is the volume's own five rings: b'ak'tuns where the centuries go, k'atuns
// the decades, tuns the years, winals the months, k'ins the days — so a
// system may group its years by its own count (twenty to a rung) instead
// of the decimal one.
//
// THE TZOLK'IN is a round of 260 days, thirteen numbers against twenty day
// names; THE HAAB' a year of 365, eighteen named months of twenty days and
// the five days of Wayeb'. Every day wears both — 8 Imix 14 Sak — and they
// are the day's NAME here, on its card, as the French rural names are.
//
// THE CORRELATION: Julian day 584283 for the epoch, the Goodman–Martínez–
// Thompson constant nearly everyone uses (Reingold and Dershowitz too);
// Thompson's own earlier 584285 would put every date two days later, and
// a few scholars still hold to it.
//
// The engine's dialect: the YEAR is the tun, counted from the epoch (tun 0
// is 0.0.0, tun 7200 is 1.0.0 … ), the MONTH the winal, 1 to 18 inside,
// the DAY the k'in, 1 to 20 inside — and every one of them is SHOWN from
// zero, as the Maya counted: winal 0 to 17, k'in 0 to 19. Digits, not the
// bar-and-dot glyphs, until phones can draw them (Howell: "Yes to both").
//
// Pure arithmetic: numbers in, numbers out.

const RD_OF_SERIAL_ZERO = 719163;          // 1 January 1970, R.D.
export const MAYA_EPOCH_RD = -1137142;     // 0.0.0.0.0 = J.D. 584283
export const MAYA_EPOCH_SERIAL = MAYA_EPOCH_RD - RD_OF_SERIAL_ZERO;
const WINAL = 20, TUN = 360, KATUN = 7200, BAKTUN = 144000;

const mod = (a, b) => ((a % b) + b) % b;
// Days since the creation, which may be negative before it.
const daysOf = serial => serial - MAYA_EPOCH_SERIAL;

export function longCountOf(serial) {
  const d = daysOf(serial);
  return {
    baktun: Math.floor(d / BAKTUN),
    katun: Math.floor(mod(d, BAKTUN) / KATUN),
    tun: Math.floor(mod(d, KATUN) / TUN),
    winal: Math.floor(mod(d, TUN) / WINAL),
    kin: mod(d, WINAL)
  };
}
export const longCountLabel = lc => [lc.baktun, lc.katun, lc.tun, lc.winal, lc.kin].join('.');

// The volume's dialect.
export const mayaSerialOf = (tunIndex, month, day) => MAYA_EPOCH_SERIAL + tunIndex * TUN + (month - 1) * WINAL + (day - 1);
export function mayaDateOf(serial) {
  const d = daysOf(serial);
  return { yearNumber: Math.floor(d / TUN), month: Math.floor(mod(d, TUN) / WINAL) + 1, day: mod(d, WINAL) + 1 };
}
export const mayaMonthSpan = () => WINAL;
// A tun's name is the Long Count to the tun: 13.0.14.
export function tunName(tunIndex) {
  if (!Number.isFinite(tunIndex) || tunIndex < 0) return String(tunIndex);
  return `${Math.floor(tunIndex / 400)}.${Math.floor(tunIndex / 20) % 20}.${tunIndex % 20}`;
}
// The rungs above the tun: a k'atun of twenty tuns, a b'ak'tun of twenty
// k'atuns, a piktun of twenty b'ak'tuns — the ring's cousin gaps.
export const MAYA_GROUPING = Object.freeze({
  decadeKey: y => `dd:${Math.floor(y / 20)}`,
  // The k'atun's place in its b'ak'tun, 0 to 19 — what its word says.
  decadeDigit: y => mod(Math.floor(y / 20), 20),
  centuryKey: y => `c:${Math.floor(y / 400)}`,
  centuryNumber: y => Math.floor(y / 400),
  millenniumKey: y => `m:${Math.floor(y / 8000)}`
});

// THE NAMES OF THE DAYS. The Tzolk'in: at the creation the day was 4 Ajaw;
// the Haab': 8 Kumk'u, the 348th day of its year.
export const TZOLKIN_NAMES = ['Imix', 'Ik\'', 'Ak\'b\'al', 'K\'an', 'Chikchan', 'Kimi', 'Manik\'', 'Lamat', 'Muluk', 'Ok',
  'Chuwen', 'Eb\'', 'B\'en', 'Ix', 'Men', 'K\'ib\'', 'Kab\'an', 'Etz\'nab\'', 'Kawak', 'Ajaw'];
export const HAAB_MONTHS = ['Pop', 'Wo\'', 'Sip', 'Sotz\'', 'Sek', 'Xul', 'Yaxk\'in', 'Mol', 'Ch\'en', 'Yax', 'Sak', 'Keh',
  'Mak', 'K\'ank\'in', 'Muwan', 'Pax', 'K\'ayab\'', 'Kumk\'u', 'Wayeb\''];
export function tzolkinOf(serial) {
  const count = daysOf(serial) + 1;
  return { number: mod(count + 3, 13) || 13, name: TZOLKIN_NAMES[mod(count + 18, 20)] };
}
export function haabOf(serial) {
  const count = mod(daysOf(serial) + 348, 365);
  return { day: mod(count, 20), month: HAAB_MONTHS[Math.floor(count / 20)] };
}
export const tzolkinLabel = serial => { const t = tzolkinOf(serial); return `${t.number} ${t.name}`; };
export const haabLabel = serial => { const h = haabOf(serial); return `${h.day} ${h.month}`; };

// THE GRID: twenty k'ins as four rows of five — a Maya numeral counts in
// bars of five — with no header, since there is no week. The rows run
// unbroken from the creation: a winal is four of them, a tun seventy-two.
export const MAYA_WEEK = Object.freeze({
  length: 5,
  rows: 4,
  columnOf: serial => mod(daysOf(serial), 5),
  rowOf: serial => daysOf(serial) / 5,
  rowAt: row => ({ serial: MAYA_EPOCH_SERIAL + 5 * row, length: 5 })
});
export const MAYA_WEEKDAY_LETTERS = ['', '', '', '', ''];

// The winals of a tun, shown from zero.
export const mayaMonthsOf = () => Array.from({ length: 18 }, (_, i) => ({ number: i + 1, key: `w${i}`, name: String(i), days: WINAL }));
export const mayaMonthKeyOf = month => `w${month - 1}`;
export const mayaDayName = day => String(day - 1);

// The rungs above the years, in the count's own words; the watermark; the
// Yucatec word for today on the NOW disc.
export const MAYA_DECADE_WORD = 'K\'ATUN';
export const MAYA_CENTURY_WORD = 'B\'AK\'TUN';
export const MAYA_NAME = 'MAYA';
export const MAYA_NOW = 'BEJLA\'E\'';

export const MAYA_RECKONING = Object.freeze({
  id: 'maya',
  serialOf: mayaSerialOf,
  dateOf: mayaDateOf,
  monthSpan: mayaMonthSpan,
  dayName: mayaDayName,
  dayId: (y, m, d) => `d:${y}:${m}:${d}@maya`,
  week: MAYA_WEEK
});
