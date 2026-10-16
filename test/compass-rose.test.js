import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roseQuarters } from '../src/diagnostics/compass-rose.js';
import { localAxes, quadrantKind } from '../src/core/stroke.js';

const axes = localAxes(159, 463, 751, 0);   // the lens on the Moto G

test('the rose has four quarters of ninety degrees that tile the circle', () => {
  const q = roseQuarters(axes);
  assert.deepEqual(q.map(x => x.kind), ['cw', 'out', 'ccw', 'in']);
  for (let i = 0; i < 4; i++) {
    assert.equal(q[i].to, q[(i + 1) % 4].from, `${q[i].kind} meets ${q[(i + 1) % 4].kind}`);
    assert.ok(Math.abs(((q[i].to - q[i].from + 360) % 360) - 90) < 1e-9);
  }
});

test('every quarter agrees with the engine at its middle and just inside each edge', () => {
  const along = b => [10 * Math.sin(b * Math.PI / 180), -10 * Math.cos(b * Math.PI / 180)];
  for (const { kind, mid, from, to } of roseQuarters(axes)) {
    assert.equal(quadrantKind(...along(mid), axes), kind);
    assert.equal(quadrantKind(...along(from + 0.5), axes), kind);
    assert.equal(quadrantKind(...along(to - 0.5), axes), kind);
  }
});

test('the rose leans with the point of impact', () => {
  const top = roseQuarters(localAxes(80, 250, 751, 0))[0].mid;
  const low = roseQuarters(localAxes(330, 700, 751, 0))[0].mid;
  assert.ok(top > low + 30, `top-left tangent ${top} vs lower-right ${low}`);
});
