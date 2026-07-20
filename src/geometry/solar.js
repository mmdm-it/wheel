// Solar events for the day ephemeris (docs/DETAIL_SECTOR_LOADS.md).
// Pure math, NOAA sunrise/sunset algorithm — the app COMPUTES the sun for
// the whole six-millennia chain (Howell 2026-07-20); nothing is stored.
// Validated against the 2026 wall-print edition (mean deviation 1.9 min;
// the check exposed a two-day misprint in the paper — Apr 24/25).
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
  const n1 = Math.floor((275 * month) / 9);
  const n2 = Math.floor((month + 9) / 12);
  const n3 = 1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3);
  const n = n1 - n2 * n3 + day - 30;
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
