// O-259: a wheel booted sideways reboots when the phone comes upright; a
// wheel booted upright never does; a desktop never does.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { armOrientationReboot } from '../src/core/orientation-reboot.js';

function fakeWindow({ coarse = true, portrait = false } = {}) {
  const queries = {};
  const mq = (q, matches) => {
    const listeners = [];
    const m = { matches, addEventListener: (_t, fn) => listeners.push(fn), fire: matches2 => { m.matches = matches2; listeners.forEach(fn => fn({ matches: matches2 })); }, listeners };
    queries[q] = m;
    return m;
  };
  const win = {
    matchMedia: q => queries[q] || mq(q, q.includes('coarse') ? coarse : portrait),
    location: { reloads: 0, reload() { this.reloads += 1; } }
  };
  return { win, queries };
}

describe('orientation reboot', () => {
  it('a landscape boot on a touch device reloads the page when the phone comes upright', () => {
    const { win, queries } = fakeWindow();
    const r = armOrientationReboot({ bootPortrait: false, win });
    assert.equal(r.armed, true);
    assert.equal(win.location.reloads, 0, 'nothing happens while it stays sideways');
    queries['(orientation: portrait)'].fire(false);
    assert.equal(win.location.reloads, 0, 'a landscape-to-landscape change is not a turn');
    queries['(orientation: portrait)'].fire(true);
    assert.equal(win.location.reloads, 1);
  });

  it('a boot that found the phone upright never arms', () => {
    const { win, queries } = fakeWindow({ portrait: true });
    const r = armOrientationReboot({ bootPortrait: true, win });
    assert.equal(r.armed, false);
    assert.equal(queries['(orientation: portrait)'], undefined, 'no query is even made');
    assert.equal(win.location.reloads, 0);
  });

  it('a fine pointer never arms: a desktop window dragged tall is not a phone turned', () => {
    const { win } = fakeWindow({ coarse: false });
    const r = armOrientationReboot({ bootPortrait: false, win });
    assert.equal(r.armed, false);
    assert.equal(r.reason, 'fine pointer');
  });

  it('covers the sideways wheel before the reload, so nothing cropped shows in between', () => {
    const { win, queries } = fakeWindow();
    const order = [];
    armOrientationReboot({ bootPortrait: false, win, cover: () => order.push('cover'), reload: () => order.push('reload') });
    queries['(orientation: portrait)'].fire(true);
    assert.deepEqual(order, ['cover', 'reload']);
  });

  it('a phone that turned upright during the load reloads at once', () => {
    const { win } = fakeWindow({ portrait: true });
    let reloads = 0;
    const r = armOrientationReboot({ bootPortrait: false, win, reload: () => { reloads += 1; } });
    assert.equal(r.armed, true);
    assert.equal(r.reason, 'already upright');
    assert.equal(reloads, 1);
  });

  it('a window without matchMedia is left alone', () => {
    assert.equal(armOrientationReboot({ bootPortrait: false, win: {} }).armed, false);
    assert.equal(armOrientationReboot({ bootPortrait: false, win: null }).armed, false);
  });
});
