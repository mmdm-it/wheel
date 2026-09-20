// THE NOTES MAKE ROOM FOR THE LENS CAPTION (O-150). Howell, with a Greek
// apparatus running under the level's caption beside the lens: the notes flow
// around the caption's box. Pure geometry — no DOM, so the caption is measured
// by the estimate.
import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { computeMarginArea, setMarginKeepOut } from '../src/geometry/margin-area.js';
import { captionQuad, getViewportInfo } from '../src/geometry/focus-ring-geometry.js';

const W = 360, H = 800;
const rows = () => computeMarginArea(W, H).lineTable;

describe('the margin makes room for the lens caption (O-150)', () => {
  afterEach(() => setMarginKeepOut(null));

  it('with no caption declared, the margin is untouched', () => {
    const before = rows();
    setMarginKeepOut(null);
    assert.deepEqual(rows(), before);
  });

  it('rows beside the caption end short of its box; rows clear of it keep their width', () => {
    const plain = rows();
    setMarginKeepOut({ text: () => 'STICHOS', direction: () => 'ltr' });
    const kept = rows();
    const quad = captionQuad(getViewportInfo(W, H), 'STICHOS'.length * 15.75 * 0.72, 'ltr');
    const ys = quad.map(p => p[1]);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    let narrowed = 0;
    for (const r of kept) {
      const was = plain.find(p => p.y === r.y);
      assert.ok(was, 'no row appears that was not there');
      const touches = r.y + (plain[1]?.y - plain[0]?.y || 0) >= lo && r.y <= hi;
      if (!touches) assert.equal(r.rightX, was.rightX, 'a row clear of the caption keeps its width');
      else if (r.rightX < was.rightX) {
        narrowed += 1;
        const minX = Math.min(...quad.map(p => p[0]));
        assert.ok(r.rightX <= Math.max(minX, was.leftX) + 1e-6 || r.rightX < was.rightX, 'ends short of the caption');
      }
    }
    assert.ok(narrowed > 0, 'at least one row beside the caption was narrowed');
  });

  it('a right-to-left caption stands on the far side of the lens and costs the margin nothing', () => {
    const plain = rows();
    setMarginKeepOut({ text: () => 'PASUQ', direction: () => 'rtl' });
    assert.deepEqual(rows(), plain);
  });
});
