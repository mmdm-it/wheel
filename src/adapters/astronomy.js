// THE ASTRONOMY THE CALENDARS SHARE (O-251, O-253): the Sun's apparent
// longitude for the French Republican year (the autumn equinox at Paris)
// and the Chinese (the winter solstice and the major solar terms), and the
// Moon's new moons for the Chinese months. Reingold and Dershowitz's
// "Calendrical Calculations", on fixed day numbers (R.D., day 1 = 1
// January 1 in the proleptic Gregorian), moments as real numbers of days
// in universal time; the new moons after Meeus's "Astronomical
// Algorithms" (chapter 49), as they are. The dynamical-time correction
// from their table, after Espenak and Meeus.
//
// Pure arithmetic: numbers in, numbers out.

export const J2000 = 730120.5;                  // noon, 1 January 2000
export const MEAN_TROPICAL_YEAR = 365.242189;
export const MEAN_SYNODIC_MONTH = 29.530588861;

const mod = (a, b) => ((a % b) + b) % b;
export const sinDeg = d => Math.sin((d * Math.PI) / 180);
export const cosDeg = d => Math.cos((d * Math.PI) / 180);
// a0 + a1·x + a2·x² + …
export const poly = (x, a) => a.reduceRight((acc, c) => acc * x + c, 0);

// ---- The proleptic Gregorian, for the ΔT table and the calendars' years.
export const gregorianLeap = y => mod(y, 4) === 0 && ![100, 200, 300].includes(mod(y, 400));
export function fixedFromGregorian(y, m, d) {
  return 365 * (y - 1) + Math.floor((y - 1) / 4) - Math.floor((y - 1) / 100) + Math.floor((y - 1) / 400)
    + Math.floor((367 * m - 362) / 12) + (m <= 2 ? 0 : (gregorianLeap(y) ? -1 : -2)) + d;
}
export function gregorianYearFromFixed(rd) {
  const d0 = rd - 1;
  const n400 = Math.floor(d0 / 146097);
  const d1 = mod(d0, 146097);
  const n100 = Math.floor(d1 / 36524);
  const d2 = mod(d1, 36524);
  const n4 = Math.floor(d2 / 1461);
  const d3 = mod(d2, 1461);
  const n1 = Math.floor(d3 / 365);
  const year = 400 * n400 + 100 * n100 + 4 * n4 + n1;
  return (n100 === 4 || n1 === 4) ? year : year + 1;
}

// ---- ΔT: dynamical time minus universal time, in days.
export function ephemerisCorrection(tee) {
  const year = gregorianYearFromFixed(Math.floor(tee));
  const c = (fixedFromGregorian(year, 7, 1) - fixedFromGregorian(1900, 1, 1)) / 36525;
  const y2000 = year - 2000;
  if (year >= 2051 && year <= 2150) return (-20 + 32 * ((year - 1820) / 100) ** 2 - 0.5628 * (2150 - year)) / 86400;
  if (year >= 2006 && year <= 2050) return poly(y2000, [62.92, 0.32217, 0.005589]) / 86400;
  if (year >= 1987 && year <= 2005) return poly(y2000, [63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599]) / 86400;
  if (year >= 1900 && year <= 1986) return poly(c, [-0.00002, 0.000297, 0.025184, -0.181133, 0.553040, -0.861938, 0.677066, -0.212591]);
  if (year >= 1800 && year <= 1899) return poly(c, [-0.000009, 0.003844, 0.083563, 0.865736, 4.867575, 15.845535, 31.332267, 38.291999, 28.316289, 11.636204, 2.043794]);
  if (year >= 1700 && year <= 1799) return poly(year - 1700, [8.118780842, -0.005092142, 0.003336121, -0.0000266484]) / 86400;
  if (year >= 1600 && year <= 1699) return poly(year - 1600, [120, -0.9808, -0.01532, 0.000140272128]) / 86400;
  if (year >= 500 && year <= 1599) return poly((year - 1000) / 100, [1574.2, -556.01, 71.23472, 0.319781, -0.8503463, -0.005050998, 0.0083572073]) / 86400;
  if (year >= -500 && year <= 499) return poly(year / 100, [10583.6, -1014.41, 33.78311, -5.952053, -0.1798452, 0.022174192, 0.0090316521]) / 86400;
  return poly((year - 1820) / 100, [-20, 0, 32]) / 86400;
}
export const julianCenturies = tee => (tee + ephemerisCorrection(tee) - J2000) / 36525;
export const universalFromDynamical = tee => tee - ephemerisCorrection(tee);

// ---- The Sun's apparent longitude, in degrees, at a universal-time moment.
const SOLAR_X = [403406, 195207, 119433, 112392, 3891, 2819, 1721, 660, 350, 334, 314, 268, 242, 234, 158, 132, 129, 114,
  99, 93, 86, 78, 72, 68, 64, 46, 38, 37, 32, 29, 28, 27, 27, 25, 24, 21, 21, 20, 18, 17, 14, 13, 13, 13, 12, 10, 10, 10, 10];
const SOLAR_Y = [0.9287892, 35999.1376958, 35999.4089666, 35998.7287385, 71998.20261, 71998.4403, 36000.35726, 71997.4812,
  32964.4678, -19.4410, 445267.1117, 45036.8840, 3.1008, 22518.4434, -19.9739, 65928.9345, 9038.0293, 3034.7684, 33718.148,
  3034.448, -2280.773, 29929.992, 31556.493, 149.588, 9037.750, 107997.405, -4444.176, 151.771, 67555.316, 31556.080,
  -4561.540, 107996.706, 1221.655, 62894.167, 31437.369, 14578.298, -31931.757, 34777.243, 1221.999, 62894.511, -4442.039,
  107997.909, 119.066, 16859.071, -4.578, 26895.292, -39.127, 12297.536, 90073.778];
const SOLAR_Z = [270.54861, 340.19128, 63.91854, 331.26220, 317.843, 86.631, 240.052, 310.26, 247.23, 260.87, 297.82, 343.14,
  166.79, 81.53, 3.50, 132.75, 182.95, 162.03, 29.8, 266.4, 249.2, 157.6, 257.8, 185.1, 69.9, 8.0, 197.1, 250.4, 65.3, 162.7,
  341.5, 291.6, 98.5, 146.7, 110.0, 5.2, 342.6, 230.9, 256.1, 45.3, 242.9, 115.2, 151.8, 285.3, 53.3, 126.6, 205.7, 85.9, 146.1];
function nutation(c) {
  const a = poly(c, [124.90, -1934.134, 0.002063]);
  const b = poly(c, [201.11, 72001.5377, 0.00057]);
  return -0.004778 * sinDeg(a) - 0.0003667 * sinDeg(b);
}
const aberration = c => 0.0000974 * cosDeg(177.63 + 35999.01848 * c) - 0.005575;
export function solarLongitude(tee) {
  const c = julianCenturies(tee);
  let sum = 0;
  for (let i = 0; i < SOLAR_X.length; i += 1) sum += SOLAR_X[i] * sinDeg(SOLAR_Y[i] * c + SOLAR_Z[i]);
  const lambda = 282.7771834 + 36000.76953744 * c + 0.000005729577951308232 * sum;
  return mod(lambda + aberration(c) + nutation(c), 360);
}
// The moment on or before `tee` when the Sun last stood at `lambda`, closely.
export function estimatePriorSolarLongitude(lambda, tee) {
  const rate = MEAN_TROPICAL_YEAR / 360;
  const tau = tee - rate * mod(solarLongitude(tee) - lambda, 360);
  const delta = mod(solarLongitude(tau) - lambda + 180, 360) - 180;
  return Math.min(tee, tau - rate * delta);
}

// ---- THE NEW MOONS (Meeus, chapter 49): the k-th new moon from the one
// of 6 January 2000 (k = 0), as a universal-time moment. Memoised: the
// Chinese year asks for each of its moons more than once.
const NEW_MOON_TERMS = [
  // v, w (power of E), x (solar anomaly), y (lunar anomaly), z (argument of latitude)
  [-0.40720, 0, 0, 1, 0], [0.17241, 1, 1, 0, 0], [0.01608, 0, 0, 2, 0], [0.01039, 0, 0, 0, 2], [0.00739, 1, -1, 1, 0],
  [-0.00514, 1, 1, 1, 0], [0.00208, 2, 2, 0, 0], [-0.00111, 0, 0, 1, -2], [-0.00057, 0, 0, 1, 2], [0.00056, 1, 1, 2, 0],
  [-0.00042, 0, 0, 3, 0], [0.00042, 1, 1, 0, 2], [0.00038, 1, 1, 0, -2], [-0.00024, 1, -1, 2, 0], [-0.00007, 0, 2, 1, 0],
  [0.00004, 0, 0, 2, -2], [0.00004, 0, 3, 0, 0], [0.00003, 0, 1, 1, -2], [0.00003, 0, 0, 2, 2], [-0.00003, 0, 1, 1, 2],
  [0.00003, 0, -1, 1, 2], [-0.00002, 0, -1, 1, -2], [-0.00002, 0, 1, 3, 0], [0.00002, 0, 0, 4, 0]
];
const NEW_MOON_PLANETARY = [
  [0.000325, 299.77, 0.107408], [0.000165, 251.88, 0.016321], [0.000164, 251.83, 26.651886], [0.000126, 349.42, 36.412478],
  [0.000110, 84.66, 18.206239], [0.000062, 141.74, 53.303771], [0.000060, 207.14, 2.453732], [0.000056, 154.84, 7.306860],
  [0.000047, 34.52, 27.261239], [0.000042, 207.19, 0.121824], [0.000040, 291.34, 1.844379], [0.000037, 161.72, 24.198154],
  [0.000035, 239.56, 25.513099], [0.000023, 331.55, 3.592518]
];
const NEW_MOONS = new Map();
export function nthNewMoon(k) {
  if (NEW_MOONS.has(k)) return NEW_MOONS.get(k);
  const c = k / 1236.85;
  const approx = J2000 + poly(c, [5.09766, MEAN_SYNODIC_MONTH * 1236.85, 0.00015437, -0.000000150, 0.00000000073]);
  const E = poly(c, [1, -0.002516, -0.0000074]);
  const solarAnomaly = poly(c, [2.5534, 1236.85 * 29.10535670, -0.0000014, -0.00000011]);
  const lunarAnomaly = poly(c, [201.5643, 385.81693528 * 1236.85, 0.0107582, 0.00001238, -0.000000058]);
  const moonArgument = poly(c, [160.7108, 390.67050284 * 1236.85, -0.0016118, -0.00000227, 0.000000011]);
  const omega = poly(c, [124.7746, -1.56375588 * 1236.85, 0.0020672, 0.00000215]);
  let correction = -0.00017 * sinDeg(omega);
  for (const [v, w, x, y, z] of NEW_MOON_TERMS) correction += v * E ** w * sinDeg(x * solarAnomaly + y * lunarAnomaly + z * moonArgument);
  let extra = 0;
  NEW_MOON_PLANETARY.forEach(([i, j, l], idx) => { extra += i * sinDeg(j + l * k - (idx === 0 ? 0.009173 * c * c : 0)); });
  const tee = universalFromDynamical(approx + correction + extra);
  if (NEW_MOONS.size > 65536) NEW_MOONS.clear();
  NEW_MOONS.set(k, tee);
  return tee;
}
const NEW_MOON_ZERO = J2000 + 5.09766;
// The first new moon at or after `tee`, and the last before it, as moments.
export function newMoonAtOrAfter(tee) {
  let k = Math.floor((tee - NEW_MOON_ZERO) / MEAN_SYNODIC_MONTH) - 1;
  while (nthNewMoon(k) < tee) k += 1;
  return nthNewMoon(k);
}
export function newMoonBefore(tee) {
  let k = Math.ceil((tee - NEW_MOON_ZERO) / MEAN_SYNODIC_MONTH) + 1;
  while (nthNewMoon(k) >= tee) k -= 1;
  return nthNewMoon(k);
}
