// THE RING'S WATERMARK (O-315, Howell 2026-11-20): the name of the chapter in
// the lens, curved with the ring, on the Church's outermost ring only.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { watermarkLines, layWatermark } from '../src/view/focus-ring-view.js';

describe('the ring\'s watermark is laid on arcs about the hub (O-315)', () => {
  // A phone held upright: the hub off the glass to the upper right.
  const arc = { hubX: 620, hubY: -80, radius: 760 };
  it('a short name is one line; a long one breaks at the space nearest its middle', () => {
    assert.deepEqual(watermarkLines('MATRIMONY'), ['MATRIMONY']);
    assert.deepEqual(watermarkLines('THE CHURCH'), ['THE CHURCH']);
    assert.deepEqual(watermarkLines('SACRIFICE OF THE MASS'), ['SACRIFICE', 'OF THE MASS']);
    assert.deepEqual(watermarkLines(''), []);
  });
  it('no word, no watermark', () => {
    assert.equal(layWatermark('', arc, 360, 707, 360), null);
  });
  it('each line rides a circle about the hub, inside the ring, and starts and ends on the glass', () => {
    const laid = layWatermark('SACRIFICE OF THE MASS', arc, 360, 707, 360);
    assert.equal(laid.lines.length, 2);
    const radii = laid.lines.map(line => {
      const [, x0, y0, r, , , , , x1, y1] = line.d.match(/^M (\S+) (\S+) A (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)$/).map(Number);
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        assert.ok(Math.abs(Math.hypot(x - arc.hubX, y - arc.hubY) - r) < 0.2, 'the end lies on its circle about the hub');
        assert.ok(x >= -1 && x <= 361 && y >= -1 && y <= 708, 'and on the glass');
      }
      assert.ok(y1 > y0, 'read down the glass');
      return r;
    });
    assert.ok(radii.every(r => r < arc.radius), 'hubward of the ring');
    assert.ok(radii[0] < radii[1], 'the first line is the nearer the hub');
  });
  it('a longer word is set smaller, and none exceeds the ceiling', () => {
    const short = layWatermark('PRAYER', arc, 360, 707, 360).size;
    const long = layWatermark('CONFIRMATION', arc, 360, 707, 360).size;
    assert.ok(long < short);
    assert.ok(short <= 0.2 * 360 + 1e-9);
  });
});
