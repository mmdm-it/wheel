import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roseSectors } from '../src/diagnostics/compass-rose.js';
import { SKETCHED_WEDGES, sketchedKind } from '../src/core/stroke.js';

test('the rose tiles the full circle with the live wedges and the dead gaps between them', () => {
  const s = roseSectors(SKETCHED_WEDGES);
  assert.equal(s.length, 8);
  assert.equal(s[0].from, 5);
  assert.equal(s[s.length - 1].to, 365);
  for (let i = 1; i < s.length; i++) assert.equal(s[i].from, s[i - 1].to);
  assert.equal(s.reduce((sum, x) => sum + (x.to - x.from), 0), 360);
});

test('every sector of the rose agrees with the engine at its midpoint', () => {
  for (const { kind, from, to } of roseSectors(SKETCHED_WEDGES)) {
    assert.equal(sketchedKind(((from + to) / 2) % 360), kind);
  }
});
