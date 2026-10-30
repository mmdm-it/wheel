// DECADES AND CENTURIES (O-242): the digits decide, there is no year zero,
// and every decade sits inside one century.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ordinal, centuryIdOf, decadeIdOf, decadeDigitOf, centuryNumberOf, DECADE_WORDS, centuryLongLabel } from '../src/adapters/calendar-eras.js';
import { buildCalendarDecades, buildCalendarCenturies, getCalendarCenturyDecades, getCalendarDecadeYears } from '../src/adapters/volume-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures/data/calendar/manifest.json'), 'utf-8'));

describe('decades and centuries (O-242)', () => {
  it('names ordinals as they are said', () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal),
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st']);
  });

  it('counts by the digits: 2000 to 2099 is the 21st, its OUGHTS 2000 to 2009', () => {
    assert.equal(centuryNumberOf(2000), 21);
    assert.equal(centuryNumberOf(2099), 21);
    assert.equal(centuryNumberOf(1999), 20);
    assert.equal(DECADE_WORDS[decadeDigitOf(2009)], 'OUGHTS');
    assert.equal(DECADE_WORDS[decadeDigitOf(2015)], 'TEENS');
    assert.equal(DECADE_WORDS[decadeDigitOf(1969)], 'SIXTIES');
    assert.equal(decadeIdOf(2000), decadeIdOf(2009));
    assert.notEqual(decadeIdOf(1999), decadeIdOf(2000));
  });

  it('keeps the eras apart across the missing year zero', () => {
    assert.notEqual(centuryIdOf(-1), centuryIdOf(1));
    assert.notEqual(decadeIdOf(-1), decadeIdOf(1));
    assert.equal(centuryLongLabel(centuryNumberOf(-250), -1), '3rd CENTURY B.C.');
    assert.equal(centuryLongLabel(centuryNumberOf(1750), 1), '18th CENTURY');
  });

  it('builds the decades ring in time order, its words repeating, gapped by century', () => {
    const { items, selectedIndex } = buildCalendarDecades(manifest, { initialItemId: decadeIdOf(1969) });
    assert.equal(items[selectedIndex].name, 'SIXTIES');
    const real = items.filter(Boolean);
    real.slice(1).forEach((d, i) => assert.ok(d.firstYear > real[i].lastYear, 'time order'));
    const i1990 = items.findIndex(d => d && d.id === decadeIdOf(1999));
    const i2000 = items.findIndex(d => d && d.id === decadeIdOf(2000));
    assert.equal(i2000 - i1990 - 1, 4, '1990s | 2000s crosses a millennium: second cousins');
  });

  it('builds the centuries ring with the era line as a gap', () => {
    const { items } = buildCalendarCenturies(manifest);
    const iBC = items.findIndex(c => c && c.id === centuryIdOf(-1));
    const iAD = items.findIndex(c => c && c.id === centuryIdOf(1));
    assert.ok(iAD - iBC - 1 > 0, 'a gap at the era line');
  });

  it('the skies: a century holds its decades, a decade its years', () => {
    const decades = getCalendarCenturyDecades(manifest, centuryIdOf(1969));
    assert.ok(decades.every(d => d.level === 'decade' && d.centuryNumber === 20));
    const years = getCalendarDecadeYears(manifest, decadeIdOf(2000));
    assert.deepEqual(years.map(y => y.yearNumber), [2000, 2001]);
  });
});
