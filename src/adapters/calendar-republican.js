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
// memoised, since every date on the ribbon asks for it. The astronomy lives
// in astronomy.js, shared with the Chinese calendar.

import { solarLongitude, estimatePriorSolarLongitude, MEAN_TROPICAL_YEAR } from './astronomy.js';

const RD_OF_SERIAL_ZERO = 719163;        // 1 January 1970, R.D.
export const FRENCH_EPOCH_RD = 654415;   // 1 Vendémiaire An I = 22 September 1792 (Gregorian)
const PARIS_ZONE = 1 / 24;               // Paris standard time, hours east of Greenwich
const AUTUMN = 180;                      // the Sun's longitude at the autumn equinox

const mod = (a, b) => ((a % b) + b) % b;
const rdOf = serial => serial + RD_OF_SERIAL_ZERO;
const serialOfRd = rd => rd - RD_OF_SERIAL_ZERO;
// The Sun, shared with the Chinese calendar (astronomy.js).
export { solarLongitude };

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
  rows: 3, // a month is three décades; the festivals one short row
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
