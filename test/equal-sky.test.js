// A SKY OF EQUALS (O-240, Howell 2026-10-29): "There is no reason to have a
// featured or favored node in the child pyramid. All months are equal. And
// there's no reason to ever show fewer than all 12 months." A volume declares
// it; the host honours it without naming the volume.
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('a volume may declare a sky of equals (O-240)', () => {
  it('the calendar declares it', () => {
    assert.match(read('../src/adapters/calendar-adapter.js'), /equalSky: true/);
  });
  it('the Bible does not — its skies stay ranked and capped (O-133, O-198, O-199)', () => {
    assert.doesNotMatch(read('../src/adapters/bible-adapter.js'), /equalSky/);
  });
  it('the host shows every child, one size, with no subset, rank or cap', () => {
    const host = read('../src/index.js');
    assert.match(host, /const equalSky = pyramidConfig\?\.equalSky === true;/);
    assert.match(host, /if \(!equalSky\) children = children\.filter/);
    assert.match(host, /const policy = equalSky \? \{ cap: Math\.max\(1, children\.length\) \}/);
    assert.match(host, /const isLarge = ch => Boolean\(!equalSky &&/);
  });

  it('an equal sky seats its children highest first, in sibling order (O-241)', () => {
    const host = read('../src/index.js');
    assert.match(host, /if \(equalSky\) slots\.sort\(\(a, b\) => \(a\.y - b\.y\) \|\| \(a\.x - b\.x\)\);/);
  });
});
