// THE CALENDAR'S DIMENSION (O-244, Howell 2026-10-30): the dimension button
// is the volume's emblem, lying on its ray to the hub, and sliding it brings
// the volume's OWN secondary stratum — a plane of calendars — in the Bible's
// secondary geometry. A volume declares its planes; the host stops assuming
// they are the Bible's languages.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { volumeConfigs } from '../src/volume-configs.js';
import { calendarStrata, CALENDAR_SYSTEMS } from '../src/adapters/calendar-adapter.js';
import { mountDimensionEmblem } from '../src/view/dimension-globe.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('who declares a dimension of its own (O-244)', () => {
  it('the calendar declares its strata and asks for its emblem as the button; no other volume does', () => {
    for (const [id, cfg] of Object.entries(volumeConfigs)) {
      assert.equal(typeof cfg.strata === 'function', id === 'calendar', `${id}: strata`);
      assert.equal(cfg.dimensionEmblem === true, id === 'calendar', `${id}: dimensionEmblem`);
    }
  });
});

describe('the calendars plane (O-244)', () => {
  it('is one chooser in the secondary geometry, the mirrored ring', () => {
    const planes = calendarStrata();
    assert.equal(planes.length, 1);
    assert.equal(planes[0].id, 'secondary');
    assert.equal(planes[0].mirrored, true);
  });
  it('speaks the Gregorian today; the others are hollow, inert seats until their arithmetic lands', () => {
    const [plane] = calendarStrata();
    const items = plane.items();
    assert.deepEqual(items, CALENDAR_SYSTEMS.map(c => c.id));
    assert.equal(items[0], 'gregorian');
    assert.equal(plane.selected(), 'gregorian');
    assert.equal(plane.label('gregorian'), 'GREGORIAN');
    assert.equal(plane.label('republican'), 'FRENCH REPUBLICAN');
    assert.equal(plane.classFor('gregorian'), '');
    assert.equal(plane.inert('gregorian'), false);
    for (const id of items.slice(1)) {
      assert.equal(plane.classFor(id), 'is-coming', id);
      assert.equal(plane.inert(id), true, id);
      assert.equal(plane.select(id), false, `${id} cannot be chosen yet`);
    }
    assert.equal(plane.selected(), 'gregorian');
    assert.equal(plane.select('gregorian'), true);
  });
  it('names the calendars Howell asked for', () => {
    const ids = CALENDAR_SYSTEMS.map(c => c.id);
    for (const want of ['hebrew', 'chinese', 'maya', 'republican', 'julian', 'islamic']) assert.ok(ids.includes(want), want);
  });
});

describe('the host (O-244)', () => {
  const main = read('../src/main.js');
  it('takes the volume\'s planes when it declares them, the Bible\'s otherwise, at each boot', () => {
    assert.match(main, /const BRIDGE_CHOOSERS = \[/);
    assert.match(main, /let CHOOSERS = BRIDGE_CHOOSERS;/);
    assert.match(main, /volumeStrata = typeof config\?\.strata === 'function' \? \(config\.strata\(\) \|\| null\) : null;/);
    assert.match(main, /CHOOSERS = Array\.isArray\(volumeStrata\) && volumeStrata\.length \? volumeStrata : BRIDGE_CHOOSERS;/);
    assert.doesNotMatch(main, /const CHOOSERS = \[/);
  });
  it('shows the button wherever one of the volume\'s planes has something to offer', () => {
    assert.match(main, /const dimensionAvailable = \(\) => \(volumeStrata\n\s+\? CHOOSERS\.some\(ch => \(ch\.items\(\) \|\| \[\]\)\.length > 0\)\n\s+: dimensionBridge\.languagesAvailable\(\)\.length > 0\);/);
  });
  it('mounts the emblem where the volume asks for it, the globe otherwise, and lays the emblem on its ray to the hub', () => {
    assert.match(main, /dimensionArt = \(config\?\.dimensionEmblem === true && splashDeclared\?\.imageUrl\)\n\s+\? mountDimensionEmblem\(dimensionButton, splashDeclared\.imageUrl, gapEmblemAspect\)\n\s+: mountDimensionGlobe\(dimensionButton\);/);
    assert.match(main, /dimensionArt\.orient\(labelRotationDeg\(Math\.atan2\(/);
    assert.match(main, /if \(show\) \{ placeThumb\(\); orientDimensionArt\(\); \}/);
  });
});

describe('the emblem mount (O-244)', () => {
  it('draws the artwork alone — no circle, no stroke — at the art\'s proportions, and turns on command', () => {
    const originalDocument = globalThis.document;
    globalThis.document = createMockDocument();
    try {
      const button = createMockElement('button');
      const art = mountDimensionEmblem(button, 'x/logo.png', 2.5);
      assert.ok(art);
      assert.equal(button.children.length, 1, 'one drawing in the button');
      const svg = button.children[0];
      const g = svg.children[0];
      const image = g.children[0];
      assert.equal(g.children.length, 1, 'the artwork alone');
      assert.equal(image.getAttribute('href'), 'x/logo.png');
      assert.equal(image.getAttribute('width'), '100');
      assert.equal(image.getAttribute('height'), '40');
      art.orient(123.456);
      assert.equal(g.getAttribute('transform'), 'rotate(123.46)');
      assert.doesNotThrow(() => art.spin());
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
