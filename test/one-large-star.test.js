// ONE LARGE STAR, AND ONLY A LANDMARK EARNS IT (O-262, Howell 2026-11-02):
// the sky's large star is the child holding the landmark highest on the
// corpus's ordered list; the lectionary is no longer read; the node just
// drilled out from keeps no size; a crowded sky seats one run around it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { relativeTiers } from '../src/pyramid/volume-pyramid.js';

const src = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

describe('one large star, from the landmarks (O-262)', () => {
  it('distinct places on the list make exactly one tier-1 child, the same on any day', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const place = { b: 7, d: 2 };
    for (const day of ['2026-11-2', '2026-11-3', '2027-1-1']) {
      const t = relativeTiers(items, it => place[it.id] ?? null, { day }).map(x => x.prominence);
      assert.deepEqual(t, [4, 3, 4, 1]);
    }
  });
  it('the volume answers landmarks, not lectionary ranks', () => {
    const v = src('adapters/bible-volume.js');
    assert.match(v, /landmarkOf\(leaf\)/);
    assert.doesNotMatch(v, /kind: 'ranks'|rankOf\(leaf\)/);
    assert.match(src('adapters/bible-adapter.js'), /volume\.landmarkOf\(u\)/);
  });
  it('the large star is one decision (O-327: the node just left has its size back); a crowded sky is one run around it', () => {
    const s = src('index.js');
    assert.match(s, /const largeIdx = largeChildIndex\(children, \{ standoutId \}\);/);
    assert.match(s, /const isLarge = ch => Boolean\(ch && largeIdx >= 0 && ch === children\[largeIdx\]\);/);
    assert.match(s, /seatPool = seatPool\.slice\(start, start \+ seatCount\)/);
  });
});
