import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCalendarYears } from '../src/adapters/volume-helpers.js';

// The 2026-07-17 calendar rulings, kept honest in CI:
//   - 3000 BC .. 3000 AD, no year zero (6000 years)
//   - years are the top level: no millennia key
//   - AD names are bare numbers; BC names carry the BC suffix
//   - decade crossings get a small cousin gap, centuries a larger one,
//     millennia the largest (the BC/AD line is a millennium crossing), all
//     by the digits since O-242

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Small synthetic calendar (W-10): the crossing-years that exercise the
// cousin-gap ENGINE and the era-naming rule. The real 6000-year span and the
// runtime 'current year on the chain' are data facts, validated in the cargo
// repo's data CI — not reproducible in a small public fixture.
const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../test/fixtures/data/calendar/manifest.json'), 'utf-8'));

describe('calendar structure (data rulings)', () => {
  const cal = manifest.Calendar;

  it('spans BC to AD with no year zero', () => {
    // The exact 6000-year count and the runtime 'current year is present'
    // check are real-corpus facts — validated in cargo, not on this fixture.
    assert.equal(cal.years['0'], undefined, 'there is no year zero');
    assert.ok(cal.years['-3000'], 'the chain reaches back to 3000 BC');
    assert.ok(cal.years['3000'], 'a calendar must see into the future: 3000 AD exists');
  });

  it('has no millennia layer and one shared month template', () => {
    assert.equal(cal.millennia, undefined);
    assert.equal(Object.keys(cal.month_template).length, 12);
    const sample = Object.values(cal.years)[0];
    assert.equal(sample.months, undefined, 'months are synthesized, not duplicated per year');
  });

  it('names follow the era rule: bare AD numbers, BC suffix', () => {
    assert.equal(cal.years['1969'].name, '1969');
    assert.equal(cal.years['-753'].name, '753 BC');
  });
});

describe('calendar year chain (gap doctrine)', () => {
  const { items, selectedIndex } = buildCalendarYears(manifest, { initialItemId: '2026' });

  const gapRunBefore = id => {
    const idx = items.findIndex(item => item && item.id === id);
    let run = 0;
    for (let i = idx - 1; i >= 0 && items[i] === null; i -= 1) run += 1;
    return run;
  };

  it('lands the requested year even with gaps in the chain', () => {
    assert.equal(items[selectedIndex]?.id, '2026');
  });

  // BY THE DIGITS, WITH DECADES ABOVE (O-242): a decade crossing is a
  // cousin gap, a century a second cousin, a millennium a third — and the
  // century turns at 1999 | 2000, where the parent seat changes its name.
  it('inserts a small gap at decade crossings', () => {
    assert.equal(gapRunBefore('1969'), 2, '1901 → 1969 crosses decades inside one century');
    assert.equal(gapRunBefore('1901'), 0, 'no gap inside a decade');
  });

  it('inserts a larger gap at century crossings', () => {
    assert.equal(gapRunBefore('1900'), 4, '1899 → 1900 is a century crossing by the digits');
  });

  it('inserts the largest gap at millennium crossings, including BC/AD', () => {
    assert.equal(gapRunBefore('2000'), 6, '1999 → 2000 is a millennium crossing by the digits');
    assert.equal(gapRunBefore('2001'), 0, '2000 and 2001 share a decade');
    assert.equal(gapRunBefore('1'), 6, '1 BC → 1 AD crosses the era line');
    assert.equal(gapRunBefore('-1000'), 6, 'BC millennium crossings gap too');
  });

  it('keeps both chain ends real (sprocket doctrine)', () => {
    const real = items.filter(Boolean);
    assert.equal(real[0].id, '-3000');
    assert.equal(real[real.length - 1].id, '3000');
  });
});
