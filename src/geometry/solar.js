// Solar events for the day ephemeris (docs/DETAIL_SECTOR_LOADS.md).
// Pure math, NOAA sunrise/sunset algorithm — the app COMPUTES the sun at
// render time for any date on the chain; nothing is stored. Validated
// against the 2026 wall-print edition (mean deviation 1.9 min; the check
// exposed a two-day misprint in the paper — Apr 24/25).
//
// HONESTY BOUNDS (Phase C audit M5): the formula is epoch-centered — it
// answers with the modern-era sun for every year. Exact where it is
// checked (the print window); drifts toward the deep past as Julian-era
// dates slide against the seasons (~10 min medieval, ~30+ min at 3000
// BC). Good enough for a day card's footnote sky; a full Meeus
// implementation is the upgrade path if the deep past ever needs minutes.
//
// The station is the adapter's business (Fano, permanently); this module
// takes coordinates and answers in UTC. Civil-time conversion also lives
// here (`localSunTimes`) because the clock rules are civil reckoning, not
// volume data: CET from 1893 (Italy adopts zone time), EU DST rule in the
// modern era, local mean solar time before 1893. Historical ora legale
// between 1916 and 1980 was irregular; the modern last-Sunday rule is
// applied as an approximation — refine if the instrument ever needs
// minute-true twentieth-century sunsets.

const ZENITH_DEG = 90.833; // official sunrise/sunset (refraction + semi-diameter)

const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

// Fractional UTC hours of sunrise/sunset for a civil date at lat/lon.
// Returns null in polar day/night conditions (never at Adriatic latitudes).
export function solarEventsUTC(year, month, day, lat, lon) {
  // Day-of-year with the GREGORIAN leap rule (the classic NOAA n1/n2/n3
  // shorthand used the Julian rule — 1900/2100 treated as leap, skewing
  // March-onward by a day in those centuries; Phase C audit M5).
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const n = CUM[month - 1] + day + (month > 2 && isLeap ? 1 : 0);
  const lngHour = lon / 15;
  const events = [];
  for (const rising of [true, false]) {
    const t = n + ((rising ? 6 : 18) - lngHour) / 24;
    const mean = 0.9856 * t - 3.289;
    let l = mean + 1.916 * Math.sin(rad(mean)) + 0.020 * Math.sin(rad(2 * mean)) + 282.634;
    l = ((l % 360) + 360) % 360;
    let ra = ((deg(Math.atan(0.91764 * Math.tan(rad(l)))) % 360) + 360) % 360;
    ra += Math.floor(l / 90) * 90 - Math.floor(ra / 90) * 90;
    ra /= 15;
    const sinDec = 0.39782 * Math.sin(rad(l));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(rad(ZENITH_DEG)) - sinDec * Math.sin(rad(lat))) / (cosDec * Math.cos(rad(lat)));
    if (cosH < -1 || cosH > 1) return null;
    const h = (rising ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH))) / 15;
    const meanT = h + ra - 0.06571 * t - 6.622;
    events.push(((meanT - lngHour) % 24 + 24) % 24);
  }
  return { riseUTC: events[0], setUTC: events[1] };
}

// 0 = Sunday. Valid for the proleptic Gregorian reckoning.
export function gregorianDayOfWeek(year, month, day) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = month < 3 ? year - 1 : year;
  return (((y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7) + 7) % 7;
}

const lastSundayOf = (year, month) => {
  let d = month === 3 ? 31 : 25;
  while (gregorianDayOfWeek(year, month, d) !== 0) d -= 1;
  return d;
};

// Civil offset from UTC, in hours, for the station's clock on a date.
// zoneSince: first year of zone time (Italy: 1893); before it, local mean
// solar time at the station's longitude.
export function civilOffsetHours(year, month, day, lon, zoneSince = 1893) {
  if (year < zoneSince) return lon / 15;
  // Ora legale: none before 1916, irregular 1916–1965 (approximated here
  // as none — Phase C audit M5 caught phantom summer time in 1900), the
  // modern last-Sunday rule from 1966 on.
  if (year < 1966) return 1;
  const dst = (month > 3 && month < 10)
    || (month === 3 && day >= lastSundayOf(year, 3))
    || (month === 10 && day < lastSundayOf(year, 10));
  return dst ? 2 : 1;
}

const fmt = minutes => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

// The two strings the day card prints: local alba/tramonto ("5:27").
export function localSunTimes(year, month, day, lat, lon, zoneSince = 1893) {
  const ev = solarEventsUTC(year, month, day, lat, lon);
  if (!ev) return null;
  const off = civilOffsetHours(year, month, day, lon, zoneSince) * 60;
  return { alba: fmt(ev.riseUTC * 60 + off), tramonto: fmt(ev.setUTC * 60 + off) };
}
