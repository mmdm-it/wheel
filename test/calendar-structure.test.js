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
//   - century crossings get a small cousin gap, millennium crossings a
//     larger one (the BC/AD line is a millennium crossing)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../data/calendar/manifest.json'), 'utf-8'));

describe('calendar structure (data rulings)', () => {
  const cal = manifest.Calendar;

  it('spans 3000 BC to 3000 AD with no year zero', () => {
    const years = Object.values(cal.years);
    assert.equal(years.length, 6000);
    assert.equal(cal.years['0'], undefined, 'there is no year zero');
    assert.ok(cal.years['-3000'], 'the chain starts at 3000 BC');
    assert.ok(cal.years['3000'], 'a calendar must see into the future: 3000 AD exists');
    assert.ok(cal.years[String(new Date().getFullYear())], 'the current year is on the chain');
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

  it('inserts a small gap at century crossings', () => {
    assert.equal(gapRunBefore('1901'), 1, '1900 → 1901 is a century crossing');
    assert.equal(gapRunBefore('1900'), 0, 'no gap inside a century');
  });

  it('inserts a larger gap at millennium crossings, including BC/AD', () => {
    assert.equal(gapRunBefore('2001'), 3, '2000 → 2001 is a millennium crossing');
    assert.equal(gapRunBefore('1'), 3, '1 BC → 1 AD crosses the era line');
    assert.equal(gapRunBefore('-1000'), 3, 'BC millennium crossings gap too');
  });

  it('keeps both chain ends real (sprocket doctrine)', () => {
    const real = items.filter(Boolean);
    assert.equal(real[0].id, '-3000');
    assert.equal(real[real.length - 1].id, '3000');
  });
});
