// ONLY THREE GESTURES CHANGE A LEVEL (O-294, Howell 2026-11-11): "the only
// way that nodes can be drilled in or out is by tapping the parent button,
// tapping a child pyramid node, or swiping. Nothing else should ever change
// levels. And if the user leaves a stratum, that stratum should always be as
// it was when the user left, when the user returns."
//
// A volume's level lives in one variable per adapter (its "mode"), and the
// child pyramid sets it through one setter. So every line that can change a
// level is findable, and this is the inventory of them: each with the
// gesture it answers. A new line fails here until it is entered with its
// gesture — and if the honest answer is "none of the three", it is the bug
// Howell found twice on 2026-11-11 (an edition change that took the reader
// to the top ring; a return from the Church that drilled to a verse).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const CHANGE = /\b(bibleMode|calendarMode|catalogMode)\s*=[^=]|\bset(Bible|Calendar|Catalog)Mode\(/;
const sites = f => read(f).split('\n')
  .map(l => l.trim())
  .filter(l => CHANGE.test(l) && !l.startsWith('//'));

const INVENTORY = {
  'src/adapters/bible-adapter.js': [
    ["let bibleMode = (initialLevel === 'chapter' || initialLevel === 'verse' || initialLevel === 'testament') ? initialLevel : (hasRoot ? 'root' : 'book');", 'boot: the level the reader left (remembered place) or the address names'],
    ["bibleMode = 'chapter';", 'the parent button, from a verse'],
    ["bibleMode = 'book';", 'the parent button, from a chapter'],
    ["bibleMode = 'testament';", 'the parent button, from a book'],
    ["bibleMode = 'root';", 'the parent button, from the divisions (gateway entry)'],
    ["bibleMode = 'book';", 'a child pyramid node, from the divisions'],
    ["bibleMode = 'verse';", 'a basement bookmark: the verse the reader chose (seatAtLeaf)'],
    ['setBibleMode: next => { bibleMode = next; },', 'the setter the child pyramid uses']
  ],
  'src/adapters/calendar-adapter.js': [
    ["let calendarMode = ['century', 'decade', 'year'].includes(options?.level) ? options.level : 'month';", 'boot: the level the reader left or the address names'],
    ["calendarMode = 'month';", 'the parent button, from a day'],
    ["calendarMode = 'year';", 'the parent button, from a month'],
    ["calendarMode = toDecades ? 'decade' : 'century';", 'the parent button, from a year or a decade'],
    ["calendarMode = calendarMode === 'century' ? 'decade' : 'year';", 'a child pyramid node, from a century or a decade'],
    ["calendarMode = 'month';", 'a child pyramid node, from a year'],
    ['setCalendarMode: next => { calendarMode = next; },', 'the setter the child pyramid uses']
  ],
  'src/adapters/catalog-adapter.js': [
    ["let catalogMode = 'manufacturer';", 'boot'],
    ["catalogMode = 'manufacturer';", 'the parent button at the countries ring (the road home)'],
    ["catalogMode = 'countries';", 'the parent button, from a maker'],
    ["catalogMode = restoredLevel === 'country'", 'the parent button, popping a level'],
    ['setCatalogMode: next => { catalogMode = next; },', 'the setter the child pyramid uses']
  ],
  'src/pyramid/volume-pyramid.js': [
    ["if (typeof setCatalogMode === 'function') setCatalogMode('child');", 'a child pyramid node'],
    ["if (typeof setCatalogMode === 'function') setCatalogMode('child');", 'a search arrival in the catalog: the model the reader spelled'],
    ["if (typeof setCalendarMode === 'function') setCalendarMode('day');", 'a child pyramid node: a day'],
    ["if (typeof setCalendarMode === 'function') setCalendarMode(mode === 'century' ? 'decade' : 'year');", 'a child pyramid node: a decade or a year'],
    ["if (typeof setCalendarMode === 'function') setCalendarMode('month');", 'a child pyramid node: a month'],
    ["if (typeof setBibleMode === 'function') setBibleMode('testament');", 'a child pyramid node: a division'],
    ["if (typeof setBibleMode === 'function') setBibleMode('book');", 'a child pyramid node: a book'],
    ["if (typeof setBibleMode === 'function') setBibleMode('chapter');", 'a child pyramid node: a chapter'],
    ["if (typeof setBibleMode === 'function') setBibleMode('verse');", 'a child pyramid node: a verse']
  ]
};

describe('a level changes only by the parent button, a child pyramid node or a swipe (O-294)', () => {
  for (const [file, entries] of Object.entries(INVENTORY)) {
    it(`${file}: every line that changes a level is accounted for`, () => {
      const found = sites(file);
      const expected = entries.map(([line]) => line);
      assert.deepEqual(found, expected,
        `A line that changes a level appeared, vanished or changed in ${file}. If it answers the parent button, a child pyramid node or a swipe, enter it in this inventory with that gesture; if it answers anything else, it is the bug this test exists for.`);
    });
  }

  it('choosing a hollow edition commits it where the reader stands: no seat at the top ring', () => {
    const main = read('src/main.js');
    const cross = main.slice(main.indexOf('function crossToEdition(key) {'), main.indexOf('function leaveBasement()'));
    assert.ok(cross.length > 0);
    assert.doesNotMatch(cross, /seatAt|setPrimaryItems|migrate/);
    assert.doesNotMatch(main, /seatAtShelf|goToShelf/, 'the shelf (O-284) is retired');
    assert.doesNotMatch(read('src/adapters/bible-adapter.js'), /seatAtShelf/);
  });

  it('the crossing lands on the testament\'s chosen verse at the reader\'s own level, never a drill', () => {
    const adapter = read('src/adapters/bible-adapter.js');
    const reseat = adapter.slice(adapter.indexOf('const reseatOnEditionChange = ('), adapter.indexOf('// THE PYRAMID IS SEATED BY THE CHART TOO'));
    assert.ok(reseat.length > 0);
    assert.doesNotMatch(reseat, /bibleMode\s*=[^=]|migrateIn|migrateOut/, 'an edition change never changes the level');
    assert.match(adapter, /const declared = \(options\?\.firstVisit \|\| \[\]\)\[0\]/, 'the declared first verse (Matthew 16:18) where the division holds it');
  });

  it('the place the reader left is remembered at every level and rebuilt at boot', () => {
    const main = read('src/main.js');
    assert.match(main, /remember\(volume, \{ placeLevel: typeof current\.level === 'string' \? current\.level : null, placeItem: current\.id \}\);/);
    const configs = read('src/volume-configs.js');
    assert.match(configs, /\['testament', 'book', 'chapter'\]\.includes\(memory\?\.placeLevel\)/);
    assert.match(configs, /\['century', 'decade', 'year', 'month', 'day'\]\.includes\(memory\?\.placeLevel\)/);
    assert.match(configs, /if \(options\.place\) \{\s*const seated = seatBiblePlace\(manifest, options, namesMap\);/);
  });

  it('the swap between the halves names no level: each half opens where it was left', () => {
    const main = read('src/main.js');
    const swap = main.slice(main.indexOf('function swapThroughSeal() {'), main.indexOf('// Browser Back across a gateway pushState'));
    assert.match(swap, /const search = `\?volume=\$\{encodeURIComponent\(to\)\}/);
    assert.doesNotMatch(swap, /level=/);
  });
});
