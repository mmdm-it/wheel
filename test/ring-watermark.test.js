// THE RING'S WATERMARK (O-315, Howell 2026-11-20): the name of the chapter in
// the lens on the Church's outermost ring — one row, one size, concentric
// with the ring and a little hubward of it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layWatermark } from '../src/view/focus-ring-view.js';

describe('the ring\'s watermark is one row on an arc about the hub (O-315)', () => {
  // A phone held upright: the hub off the glass to the upper right.
  const arc = { hubX: 620, hubY: -80, radius: 760 };
  const ends = d => d.match(/^M (\S+) (\S+) A (\S+) \S+ \S+ \S+ \S+ (\S+) (\S+)$/).slice(1).map(Number);
  it('no word, no watermark', () => {
    assert.equal(layWatermark('', arc, 360, 707, 360), null);
  });
  it('EVERY NAME IS THE SAME SIZE, and rides the same arc', () => {
    const a = layWatermark('PRAYER', arc, 360, 707, 360);
    const b = layWatermark('SACRIFICE OF THE MASS', arc, 360, 707, 360);
    assert.equal(a.size, b.size);
    assert.equal(a.d, b.d);
    assert.equal(b.text, 'SACRIFICE OF THE MASS', 'one row, never broken');
    assert.ok(a.size <= 0.09 * 360 + 1e-9);
  });
  it('a name longer than the row was sized for is the one that is set smaller, and still fits', () => {
    const usual = layWatermark('DOUAY-RHEIMS', arc, 360, 707, 360);
    const long = layWatermark('BIBLIA SACRA VULGATAE EDITIONIS', arc, 360, 707, 360);
    assert.ok(long.size < usual.size);
    const [x0, y0, r, x1, y1] = ends(long.d);
    assert.ok(31 * 0.74 * long.size <= 2 * r * Math.asin(Math.hypot(x1 - x0, y1 - y0) / (2 * r)));
  });
  it('the longest name the volume carries fits the row at that size', () => {
    const { size, d } = layWatermark('SACRIFICE OF THE MASS', arc, 360, 707, 360);
    const [x0, y0, r, x1, y1] = ends(d);
    const chord = Math.hypot(x1 - x0, y1 - y0);
    const run = 2 * r * Math.asin(chord / (2 * r));
    assert.ok(21 * 0.74 * size <= run, 'twenty-one letters inside the arc');
  });
  it('the arc is the ring\'s own circle drawn a little smaller, read down the glass, clear of the foot', () => {
    const [x0, y0, r, x1, y1] = ends(layWatermark('MATRIMONY', arc, 360, 707, 360).d);
    for (const [x, y] of [[x0, y0], [x1, y1]]) assert.ok(Math.abs(Math.hypot(x - arc.hubX, y - arc.hubY) - r) < 0.2);
    assert.ok(r < arc.radius && r > arc.radius - 0.25 * 360, 'hubward of the ring, and near it');
    assert.ok(y1 > y0, 'read down the glass');
    assert.ok(y0 >= 0.1 * 707 - 5 && y1 <= 0.8 * 707 + 5, 'between the top margin and the foot of the sky');
  });
});
