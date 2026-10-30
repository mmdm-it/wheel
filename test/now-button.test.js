// THE WAY BACK TO THE PRESENT (O-243, Howell 2026-10-30): a red disc with a
// yellow word that turns the ring to the item living through this moment,
// at whatever level the ring shows — shown only while nothing else on the
// glass wears the present's colours.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getViewportInfo, getNowSeat, getParentSeat } from '../src/geometry/focus-ring-geometry.js';
import { FocusRingView } from '../src/view/focus-ring-view.js';
import { NOW_NODE_FILL, NOW_LABEL_FILL } from '../src/view/node-appearance.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';
import { volumeConfigs } from '../src/volume-configs.js';

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('the seat (O-243)', () => {
  it('sits on the outer side of the ring, lower left, above the parent label, at the vessel\'s size', () => {
    const vp = getViewportInfo(360, 655);
    const seat = getNowSeat(vp, 22);
    const parent = getParentSeat(vp, 22);
    assert.equal(seat.radius, 22);
    assert.ok(seat.y < parent.labelY, 'above the parent label');
    assert.ok(seat.y > vp.LSd * 0.7, 'but in the lower part of the glass');
    assert.ok(seat.x < vp.SSd * 0.2, 'at the left');
    assert.ok(seat.x > seat.radius, 'wholly on the glass');
  });
});

describe('the view (O-243)', () => {
  const originalDocument = globalThis.document;
  let view;
  beforeEach(() => {
    globalThis.document = createMockDocument();
    view = new FocusRingView(createMockElement('svg'));
    view.init();
  });
  afterEach(() => { globalThis.document = originalDocument; });

  const render = nowButton => view.render([], { hubX: 0, hubY: 0, radius: 100 }, { startAngle: 0, endAngle: Math.PI },
    { x: 0, y: 0, radius: 12, angle: 0 }, { magnifierAngle: 0, labelMaskEpsilon: 0, viewport: getViewportInfo(360, 655), nowButton });

  it('is hidden until the host shows it, and then wears the present\'s colours and its word', () => {
    render(null);
    assert.equal(view.nowCircle.getAttribute('display'), 'none');
    assert.equal(view.nowLabel.getAttribute('display'), 'none');
    let taps = 0;
    render({ show: true, label: 'NOW', onClick: () => { taps += 1; } });
    assert.equal(view.nowCircle.getAttribute('display'), null);
    assert.equal(view.nowLabel.textContent, 'NOW');
    assert.equal(view.nowCircle.style.fill, NOW_NODE_FILL);
    assert.equal(view.nowLabel.style.fill, NOW_LABEL_FILL);
    assert.equal(view.nowCircle.getAttribute('role'), 'button');
    view.nowCircle.onclick();
    view.nowLabel.onclick();
    assert.equal(taps, 2);
    const evt = { key: 'Enter', preventDefault() {} };
    view.nowCircle.onkeydown(evt);
    assert.equal(taps, 3);
    render({ show: false, label: 'NOW', onClick: () => { taps += 1; } });
    assert.equal(view.nowCircle.getAttribute('display'), 'none');
    assert.equal(view.nowCircle.onclick, null);
  });
});

describe('the host (O-243)', () => {
  const host = read('../src/index.js');
  it('shows the disc only when nothing on the glass is red: ring node in frame, sky, or lens', () => {
    assert.match(host, /if \(selected\?\.now\) return true;/);
    assert.match(host, /nodes\.some\(n => n\.item\?\.now && n\.x >= -m/);
    assert.match(host, /pyramidData\?\.nodes\?\.some\(n => n\?\.now\)/);
    assert.match(host, /show: !nowOnGlass/);
  });
  it('a tap keeps the level and turns the ring to the present item in one glide', () => {
    assert.match(host, /onClick: \(\) => rotateToIndex\(nowIndex, \{ durationMs: NOW_RETURN_MS \}\)/);
  });
  it('the present item is found once per chain, not per frame', () => {
    assert.match(host, /if \(nowIndexMemo\.items !== items\) nowIndexMemo = \{ items, index: items\.findIndex/);
  });
  it('a press on the disc is a plain button press in the gesture router', () => {
    const main = read('../src/main.js');
    assert.match(main, /closest\('\.focus-ring-now-circle, \.focus-ring-now-label'\)/);
    assert.match(main, /nowButton: typeof config\?\.nowButton === 'string'/);
  });
});

describe('who declares it (O-243)', () => {
  it('the calendar says NOW; no other volume has a present to return to', () => {
    for (const [id, cfg] of Object.entries(volumeConfigs)) {
      assert.equal(cfg.nowButton, id === 'calendar' ? 'NOW' : undefined, `${id}: nowButton`);
    }
  });
});
