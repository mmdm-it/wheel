// THE FRENCH REPUBLICAN CALENDAR (O-251, Howell 2026-10-30: "Shall we talk
// about those crazy French?" — "Yes to both"). The calendar of the
// Convention, decreed 5 October 1793 and reaching back to 22 September
// 1792, the autumn equinox and the day after the Republic was proclaimed:
// twelve months of thirty days named by Fabre d'Églantine for the weather
// and the fields, each month three DÉCADES of ten days (primidi to décadi,
// décadi the day of rest), five complementary days closing the year — six
// in a leap year — each a festival, and every one of the 366 days with a
// name of its own from the countryside. Years in Roman numerals. Abolished
// by Napoleon from 1 January 1806 (after 10 Nivôse An XIV); revived for
// eighteen days by the Commune in 1871.
//
// THE YEAR BEGINS ON THE DAY OF THE TRUE AUTUMN EQUINOX, observed at Paris
// — that was the law, and it makes the leap years astronomical rather than
// arithmetic. Romme's fixed rule was proposed and never adopted; the two
// agree for the fourteen years the calendar was kept and drift afterwards
// (today is 8 Brumaire 235 by the equinox and 9 Brumaire by the rule). This
// module takes the equinox, as Reingold and Dershowitz do ("Calendrical
// Calculations", the French Revolutionary calendar): the Sun's apparent
// longitude from their 49-term series with aberration and nutation, the
// moment judged at midnight in Paris (standard time, one hour east), and
// the dynamical-time correction from their table. The arithmetic needed
// for the Chinese calendar later is the same.
//
// Pure arithmetic: numbers in, numbers out. The New Year of each year is
// memoised, since every date on the ribbon asks for it.

const RD_OF_SERIAL_ZERO = 719163;        // 1 January 1970, R.D.
export const FRENCH_EPOCH_RD = 654415;   // 1 Vendémiaire An I = 22 September 1792 (Gregorian)
const J2000 = 730120.5;                  // noon, 1 January 2000
const MEAN_TROPICAL_YEAR = 365.242189;
const PARIS_ZONE = 1 / 24;               // Paris standard time, hours east of Greenwich
const AUTUMN = 180;                      // the Sun's longitude at the autumn equinox

const mod = (a, b) => ((a % b) + b) % b;
const rdOf = serial => serial + RD_OF_SERIAL_ZERO;
const serialOfRd = rd => rd - RD_OF_SERIAL_ZERO;
const sinDeg = d => Math.sin((d * Math.PI) / 180);
const cosDeg = d => Math.cos((d * Math.PI) / 180);
// a0 + a1·x + a2·x² + …
const poly = (x, a) => a.reduceRight((acc, c) => acc * x + c, 0);

// ---- The proleptic Gregorian year of a fixed day, for the ΔT table.
const gregorianLeap = y => mod(y, 4) === 0 && ![100, 200, 300].includes(mod(y, 400));
function fixedFromGregorian(y, m, d) {
  return 365 * (y - 1) + Math.floor((y - 1) / 4) - Math.floor((y - 1) / 100) + Math.floor((y - 1) / 400)
    + Math.floor((367 * m - 362) / 12) + (m <= 2 ? 0 : (gregorianLeap(y) ? -1 : -2)) + d;
}
function gregorianYearFromFixed(rd) {
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

// ---- ΔT: dynamical time minus universal time, in days (Reingold and
// Dershowitz's table, after Espenak and Meeus).
function ephemerisCorrection(tee) {
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
const julianCenturies = tee => (tee + ephemerisCorrection(tee) - J2000) / 36525;

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
function estimatePriorSolarLongitude(lambda, tee) {
  const rate = MEAN_TROPICAL_YEAR / 360;
  const tau = tee - rate * mod(solarLongitude(tee) - lambda, 360);
  const delta = mod(solarLongitude(tau) - lambda + 180, 360) - 180;
  return Math.min(tee, tau - rate * delta);
}

// ---- The New Year: the last day on or before `rd` whose midnight (the end
// of that day, Paris) finds the Sun past the autumn equinox.
const midnightInParis = rd => rd + 1 - PARIS_ZONE;
function frenchNewYearOnOrBefore(rd) {
  const approx = estimatePriorSolarLongitude(AUTUMN, midnightInParis(rd));
  let day = Math.floor(approx) - 1;
  while (!(AUTUMN <= solarLongitude(midnightInParis(day)))) day += 1;
  return day;
}
const NEW_YEARS = new Map();
export function frenchNewYearRd(year) {
  if (NEW_YEARS.has(year)) return NEW_YEARS.get(year);
  const rd = frenchNewYearOnOrBefore(Math.floor(FRENCH_EPOCH_RD + 180 + MEAN_TROPICAL_YEAR * (year - 1)));
  if (NEW_YEARS.size > 8192) NEW_YEARS.clear();
  NEW_YEARS.set(year, rd);
  return rd;
}
export const daysInFrenchYear = year => frenchNewYearRd(year + 1) - frenchNewYearRd(year);
export const isFrenchLeapYear = year => daysInFrenchYear(year) === 366;
export const SANSCULOTTIDES = 13;
export const lastDayOfFrenchMonth = (year, month) => (month === SANSCULOTTIDES ? daysInFrenchYear(year) - 360 : 30);

const fixedFromFrench = (year, month, day) => frenchNewYearRd(year) - 1 + 30 * (month - 1) + day;
function frenchFromFixed(rd) {
  let year = Math.floor((rd - FRENCH_EPOCH_RD) / MEAN_TROPICAL_YEAR) + 1;
  while (frenchNewYearRd(year + 1) <= rd) year += 1;
  while (frenchNewYearRd(year) > rd) year -= 1;
  const doy = rd - frenchNewYearRd(year);
  return { year, month: Math.floor(doy / 30) + 1, day: mod(doy, 30) + 1 };
}
export const frenchSerialOf = (year, month, day) => serialOfRd(fixedFromFrench(year, month, day));
export function frenchDateOf(serial) {
  const { year, month, day } = frenchFromFixed(rdOf(serial));
  return { yearNumber: year, month, day };
}
export const frenchMonthSpan = lastDayOfFrenchMonth;
// A day's place in its year, 0 = 1 Vendémiaire.
const dayOfYear = serial => { const rd = rdOf(serial); const { year } = frenchFromFixed(rd); return { year, doy: rd - frenchNewYearRd(year) }; };

// ---- THE DÉCADE: the ten-day week, the grid's rows (Howell: "three rows of
// ten is the whole point of the calendar"). The décades are counted afresh
// from each New Year — 36 of ten days and one short row of the festivals —
// so the ribbon's rows are a year's 37, year after year, not an unbroken
// cycle like the seven-day week's. The columns are headed I to X, since the
// day names are literally "first-day" to "tenth-day".
const DECADE = 10;
const ROWS_PER_YEAR = 37;
export const FRENCH_WEEK = Object.freeze({
  length: DECADE,
  columnOf: serial => { const { doy } = dayOfYear(serial); return doy < 360 ? doy % DECADE : doy - 360; },
  // Continuous: a fraction of a row for a fraction of a day.
  rowOf: serial => {
    const { year, doy } = dayOfYear(Math.floor(serial));
    const frac = serial - Math.floor(serial);
    const len = doy < 360 ? DECADE : daysInFrenchYear(year) - 360;
    return ROWS_PER_YEAR * (year - 1) + (doy < 360 ? (doy + frac) / DECADE : 36 + (doy - 360 + frac) / len);
  },
  rowAt: rowAbs => {
    const year = Math.floor(rowAbs / ROWS_PER_YEAR) + 1;
    const r = rowAbs - ROWS_PER_YEAR * (year - 1);
    return { serial: serialOfRd(frenchNewYearRd(year)) + DECADE * r, length: r === 36 ? daysInFrenchYear(year) - 360 : DECADE };
  }
});
export const FRENCH_WEEKDAYS = ['Primidi', 'Duodi', 'Tridi', 'Quartidi', 'Quintidi', 'Sextidi', 'Septidi', 'Octidi', 'Nonidi', 'Décadi'];
export const FRENCH_WEEKDAY_LETTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// ---- Roman numerals, for the years and the centuries.
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function romanNumeral(n) {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  let rest = Math.floor(n);
  let out = '';
  for (const [v, s] of ROMAN) while (rest >= v) { out += s; rest -= v; }
  return out;
}
// Iᵉʳ, IIᵉ … (the superscript letters survive the lens's capitals).
export const romanOrdinal = n => (n === 1 ? 'Iᵉʳ' : `${romanNumeral(n)}ᵉ`);

// ---- The months, with the short forms the sky wears.
const MONTHS = [
  ['vendemiaire', 'Vendémiaire', 'VEND'], ['brumaire', 'Brumaire', 'BRUM'], ['frimaire', 'Frimaire', 'FRIM'],
  ['nivose', 'Nivôse', 'NIVÔ'], ['pluviose', 'Pluviôse', 'PLUV'], ['ventose', 'Ventôse', 'VENT'],
  ['germinal', 'Germinal', 'GERM'], ['floreal', 'Floréal', 'FLOR'], ['prairial', 'Prairial', 'PRAI'],
  ['messidor', 'Messidor', 'MESS'], ['thermidor', 'Thermidor', 'THER'], ['fructidor', 'Fructidor', 'FRUC'],
  ['sansculottides', 'Sansculottides', 'FÊTES']
];
export const frenchMonthsOf = year => MONTHS.map(([key, name, short], i) => ({
  number: i + 1, key, name, short, days: lastDayOfFrenchMonth(year, i + 1)
}));
export const frenchMonthKeyOf = month => MONTHS[month - 1]?.[0] || String(month);

// ---- EVERY DAY HAS A NAME: Fabre d'Églantine's rural calendar — a plant
// or a fruit on most days, an animal on every quintidi, a tool on every
// décadi — and the festivals of the complementary days.
const RURAL = [
  ['Raisin', 'Safran', 'Châtaigne', 'Colchique', 'Cheval', 'Balsamine', 'Carotte', 'Amarante', 'Panais', 'Cuve',
    'Pomme de terre', 'Immortelle', 'Potiron', 'Réséda', 'Âne', 'Belle de nuit', 'Citrouille', 'Sarrasin', 'Tournesol', 'Pressoir',
    'Chanvre', 'Pêche', 'Navet', 'Amaryllis', 'Bœuf', 'Aubergine', 'Piment', 'Tomate', 'Orge', 'Tonneau'],
  ['Pomme', 'Céleri', 'Poire', 'Betterave', 'Oie', 'Héliotrope', 'Figue', 'Scorsonère', 'Alisier', 'Charrue',
    'Salsifis', 'Mâcre', 'Topinambour', 'Endive', 'Dindon', 'Chervis', 'Cresson', 'Dentelaire', 'Grenade', 'Herse',
    'Bacchante', 'Azerole', 'Garance', 'Orange', 'Faisan', 'Pistache', 'Macjonc', 'Coing', 'Cormier', 'Rouleau'],
  ['Raiponce', 'Turneps', 'Chicorée', 'Nèfle', 'Cochon', 'Mâche', 'Chou-fleur', 'Miel', 'Genièvre', 'Pioche',
    'Cire', 'Raifort', 'Cèdre', 'Sapin', 'Chevreuil', 'Ajonc', 'Cyprès', 'Lierre', 'Sabine', 'Hoyau',
    'Érable à sucre', 'Bruyère', 'Roseau', 'Oseille', 'Grillon', 'Pignon', 'Liège', 'Truffe', 'Olive', 'Pelle'],
  ['Tourbe', 'Houille', 'Bitume', 'Soufre', 'Chien', 'Lave', 'Terre végétale', 'Fumier', 'Salpêtre', 'Fléau',
    'Granit', 'Argile', 'Ardoise', 'Grès', 'Lapin', 'Silex', 'Marne', 'Pierre à chaux', 'Marbre', 'Van',
    'Pierre à plâtre', 'Sel', 'Fer', 'Cuivre', 'Chat', 'Étain', 'Plomb', 'Zinc', 'Mercure', 'Crible'],
  ['Lauréole', 'Mousse', 'Fragon', 'Perce-neige', 'Taureau', 'Laurier-thym', 'Amadouvier', 'Mézéréon', 'Peuplier', 'Coignée',
    'Ellébore', 'Brocoli', 'Laurier', 'Avelinier', 'Vache', 'Buis', 'Lichen', 'If', 'Pulmonaire', 'Serpette',
    'Thlaspi', 'Thimelé', 'Chiendent', 'Trainasse', 'Lièvre', 'Guède', 'Noisetier', 'Cyclamen', 'Chélidoine', 'Traîneau'],
  ['Tussilage', 'Cornouiller', 'Violier', 'Troène', 'Bouc', 'Asaret', 'Alaterne', 'Violette', 'Marceau', 'Bêche',
    'Narcisse', 'Orme', 'Fumeterre', 'Vélar', 'Chèvre', 'Épinard', 'Doronic', 'Mouron', 'Cerfeuil', 'Cordeau',
    'Mandragore', 'Persil', 'Cochléaria', 'Pâquerette', 'Thon', 'Pissenlit', 'Sylvie', 'Capillaire', 'Frêne', 'Plantoir'],
  ['Primevère', 'Platane', 'Asperge', 'Tulipe', 'Poule', 'Bette', 'Bouleau', 'Jonquille', 'Aulne', 'Couvoir',
    'Pervenche', 'Charme', 'Morille', 'Hêtre', 'Abeille', 'Laitue', 'Mélèze', 'Ciguë', 'Radis', 'Ruche',
    'Gainier', 'Romaine', 'Marronnier', 'Roquette', 'Pigeon', 'Lilas', 'Anémone', 'Pensée', 'Myrtille', 'Greffoir'],
  ['Rose', 'Chêne', 'Fougère', 'Aubépine', 'Rossignol', 'Ancolie', 'Muguet', 'Champignon', 'Hyacinthe', 'Râteau',
    'Rhubarbe', 'Sainfoin', 'Bâton d\'or', 'Chamerisier', 'Ver à soie', 'Consoude', 'Pimprenelle', 'Corbeille d\'or', 'Arroche', 'Sarcloir',
    'Statice', 'Fritillaire', 'Bourrache', 'Valériane', 'Carpe', 'Fusain', 'Civette', 'Buglosse', 'Sénevé', 'Houlette'],
  ['Luzerne', 'Hémérocalle', 'Trèfle', 'Angélique', 'Canard', 'Mélisse', 'Fromental', 'Martagon', 'Serpolet', 'Faux',
    'Fraise', 'Bétoine', 'Pois', 'Acacia', 'Caille', 'Œillet', 'Sureau', 'Pavot', 'Tilleul', 'Fourche',
    'Barbeau', 'Camomille', 'Chèvrefeuille', 'Caille-lait', 'Tanche', 'Jasmin', 'Verveine', 'Thym', 'Pivoine', 'Chariot'],
  ['Seigle', 'Avoine', 'Oignon', 'Véronique', 'Mulet', 'Romarin', 'Concombre', 'Échalote', 'Absinthe', 'Faucille',
    'Coriandre', 'Artichaut', 'Girofle', 'Lavande', 'Chamois', 'Tabac', 'Groseille', 'Gesse', 'Cerise', 'Parc',
    'Menthe', 'Cumin', 'Haricot', 'Orcanète', 'Pintade', 'Sauge', 'Ail', 'Vesce', 'Blé', 'Chalémie'],
  ['Épeautre', 'Bouillon-blanc', 'Melon', 'Ivraie', 'Bélier', 'Prêle', 'Armoise', 'Carthame', 'Mûre', 'Arrosoir',
    'Panic', 'Salicorne', 'Abricot', 'Basilic', 'Brebis', 'Guimauve', 'Lin', 'Amande', 'Gentiane', 'Écluse',
    'Carline', 'Câprier', 'Lentille', 'Aunée', 'Loutre', 'Myrte', 'Colza', 'Lupin', 'Coton', 'Moulin'],
  ['Prune', 'Millet', 'Lycoperdon', 'Escourgeon', 'Saumon', 'Tubéreuse', 'Sucrion', 'Apocyn', 'Réglisse', 'Échelle',
    'Pastèque', 'Fenouil', 'Épine vinette', 'Noix', 'Truite', 'Citron', 'Cardère', 'Nerprun', 'Tagette', 'Hotte',
    'Églantier', 'Noisette', 'Houblon', 'Sorgho', 'Écrevisse', 'Bigarade', 'Verge d\'or', 'Maïs', 'Marron', 'Panier']
];
// The festivals by the name of the day — "jour de la Vertu" — short enough
// for the lens's caption, where "Fête de la Révolution" ran off the glass.
const FESTIVALS = ['La Vertu', 'Le Génie', 'Le Travail', 'L\'Opinion', 'Les Récompenses', 'La Révolution'];
export const frenchDayName = (month, day) => (month === SANSCULOTTIDES ? FESTIVALS[day - 1] : RURAL[month - 1]?.[day - 1]) || '';

// ---- The rings above the years, in French; the words the plane, the
// watermark and the NOW disc wear.
const DECADE_NUMBERS = ['ZÉRO', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE-DIX', 'QUATRE-VINGT', 'QUATRE-VINGT-DIX'];
export const FRENCH_DECADE_WORDS = DECADE_NUMBERS.map(n => `ANNÉES ${n}`);
// The sky's short form: the decade's first year in Roman numerals (CCXXX
// for the années trente of the third century) — "ANNÉES QUATRE-VINGT-DIX"
// left the star walk room for three stars of ten, and the number words
// alone for seven.
export const frenchDecadeShort = (digit, year) => romanNumeral(Math.max(1, Math.floor(Math.abs(year) / 10) * 10));
export const FRENCH_CENTURY_WORD = 'SIÈCLE';
export const frenchCenturyPhrase = n => `${romanOrdinal(n)} ${FRENCH_CENTURY_WORD}`;
export const REPUBLICAN_NAME = 'RÉPUBLICAIN';
export const FRENCH_NOW = 'PRÉSENT';   // shorter than MAINTENANT, which crowded the disc's corner

export const FRENCH_RECKONING = Object.freeze({
  id: 'republican',
  serialOf: frenchSerialOf,
  dateOf: frenchDateOf,
  monthSpan: frenchMonthSpan,
  dayId: (y, m, d) => `d:${y}:${m}:${d}@republican`,
  week: FRENCH_WEEK
});
