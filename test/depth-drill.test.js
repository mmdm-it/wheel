import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDepthDrill } from '../src/core/depth-drill.js';

// A fake host: every launch is recorded and returns a handle that records
// its scrubs; commit/abort/settle are recorded by handle. `closed` names
// the directions, per level, where nothing lies — the ends of the volume.
function harness({ closed = {}, held = true, notchPx = 100 } = {}) {
  const log = [];
  let level = 0;
  let n = 0;
  const drill = createDepthDrill({
    notchPx,
    launch: dir => {
      if ((closed[level] || []).includes(dir)) { log.push(`decline ${dir > 0 ? 'out' : 'in'}@${level}`); return null; }
      const h = { id: n += 1, dir, e: [], captured: () => held, scrubTo(e) { this.e.push(Math.round(e * 100) / 100); } };
      log.push(`launch#${h.id} ${dir > 0 ? 'out' : 'in'}@${level}`);
      return h;
    },
    commit: h => { log.push(`commit#${h.id}`); level += h.dir; },
    abort: h => { log.push(`abort#${h.id}`); },
    settle: (h, go, done) => { log.push(`settle#${h.id} ${go ? 'through' : 'back'}`); if (go) level += h.dir; if (done) pending.push(done); },
  });
  const pending = [];
  // The host's settle animates; `settled()` is the moment it ends.
  const settled = () => { const d = pending.shift(); if (d) d(); };
  return { drill, log, level: () => level, setHeld: v => { held = v; }, settled };
}

describe('the depth drill (O-203)', () => {
  test('one level: the first segment opens at once and the thumb scrubs it', () => {
    const { drill, log } = harness();
    assert.equal(drill.begin(1), true);
    assert.deepEqual(log, ['launch#1 out@0']);
    drill.move(30); drill.move(20);
    assert.equal(drill.depth(), 0.5);
    assert.deepEqual(drill.segment(), { dir: 1, e: 0.5, held: true, carried: false });
    const r = drill.release();
    assert.deepEqual(r, { level: 1, committed: true, e: 0.5, carry: false });
    assert.equal(log.at(-1), 'settle#1 through');
  });

  test('short of halfway the release springs back and the level is unchanged', () => {
    const { drill, log } = harness();
    drill.begin(1); drill.move(40);
    const r = drill.release();
    assert.deepEqual(r, { level: 0, committed: false, e: 0.4, carry: false });
    assert.equal(log.at(-1), 'settle#1 back');
  });

  test('a long stroke crosses several levels: each boundary commits and opens the next', () => {
    const { drill, log } = harness();
    drill.begin(1);
    drill.move(120);   // past the first level in one move
    assert.deepEqual(log, ['launch#1 out@0', 'commit#1', 'launch#2 out@1']);
    assert.equal(Math.round(drill.depth() * 100) / 100, 1.2);
    drill.move(110);   // 230: past the second
    assert.deepEqual(log.slice(3), ['commit#2', 'launch#3 out@2']);
    assert.equal(drill.level(), 2);
    assert.equal(Math.round(drill.depth() * 100) / 100, 2.3);
  });

  test('one move can cross two levels at once', () => {
    const { drill, log } = harness();
    drill.begin(1);
    drill.move(250);
    assert.deepEqual(log, ['launch#1 out@0', 'commit#1', 'launch#2 out@1', 'commit#2', 'launch#3 out@2']);
    assert.equal(Math.round(drill.depth() * 100) / 100, 2.5);
  });

  test('coming back over a boundary aborts the segment and opens the opposite one, nothing lifted', () => {
    const { drill, log } = harness();
    drill.begin(1);
    drill.move(120);                 // level 1, segment 2 at 0.2
    drill.move(-30);                 // back over the boundary: 0.9
    assert.deepEqual(log.slice(3), ['abort#2', 'launch#3 in@1']);
    assert.equal(Math.round(drill.depth() * 100) / 100, 0.9);
    const seg = drill.segment();
    assert.equal(seg.dir, -1); assert.equal(seg.held, true); assert.equal(Math.round(seg.e * 100) / 100, 0.1);
    drill.move(-70);                 // 0.2: nearly home
    assert.equal(Math.round(drill.depth() * 100) / 100, 0.2);
    const r = drill.release();
    assert.equal(r.committed, true, 'past halfway back: it goes through to the start'); assert.equal(r.level, 0); assert.equal(Math.round(r.e * 100) / 100, 0.8);
  });

  test('out and all the way back in one stroke ends where it began', () => {
    const { drill, log, level } = harness();
    drill.begin(1);
    drill.move(150);
    drill.move(-160);                // back past the start: the in-segment commits at level 0
    assert.equal(level(), 0);
    assert.ok(log.includes('commit#3'), log.join(', '));
    assert.equal(Math.round(drill.depth() * 100) / 100, -0.1, 'and a little further in');
  });

  test('the ends: where nothing lies the launch declines, the travel clamps, and the way back begins at once', () => {
    const { drill, log } = harness({ closed: { 1: [1] } });   // nothing above level 1
    drill.begin(1);
    drill.move(120);                 // commit to 1; the next out declines
    assert.deepEqual(log, ['launch#1 out@0', 'commit#1', 'decline out@1']);
    drill.move(200);                 // the thumb goes on; the depth does not
    assert.equal(drill.depth(), 1);
    assert.equal(log.length, 3, 'no second attempt while the thumb keeps going that way');
    drill.move(-10);                 // the first px back opens the way in
    assert.equal(log.at(-1), 'launch#2 in@1');
    assert.equal(Math.round(drill.depth() * 100) / 100, 0.9);
  });

  test('a leaf cannot be drilled into: begin declines and the host reads nothing there', () => {
    const { drill, log } = harness({ closed: { 0: [-1] } });
    assert.equal(drill.begin(-1), false);
    assert.deepEqual(log, ['decline in@0']);
    assert.equal(drill.segment(), null);
  });

  test('while a segment is launching the thumb re-bases: its travel is not counted', () => {
    const { drill, setHeld } = harness({ held: false });
    drill.begin(1);
    assert.equal(drill.move(60), false);
    assert.equal(drill.depth(), 0);
    setHeld(true);
    assert.equal(drill.move(30), true);
    assert.equal(drill.depth(), 0.3);
  });

  test('a cancelled release always springs back', () => {
    const { drill, log } = harness();
    drill.begin(1); drill.move(90);
    const r = drill.release({ cancelled: true });
    assert.equal(r.committed, false);
    assert.equal(log.at(-1), 'settle#1 back');
  });

  test('released between flights, nothing settles and the level stands', () => {
    const { drill, log } = harness({ closed: { 1: [1] } });
    drill.begin(1); drill.move(100);   // exactly one level: committed, nothing open
    assert.equal(drill.segment(), null);
    const r = drill.release();
    assert.deepEqual(r, { level: 1, committed: false, e: null, carry: false });
    assert.equal(log.filter(l => l.startsWith('settle')).length, 0);
  });

  test('a flick along the segment carries one more: through whatever the progress, then the next level on its own', () => {
    const { drill, log, level, settled } = harness();
    drill.begin(1); drill.move(30);                 // short of halfway
    const r = drill.release({ flick: 1 });
    assert.equal(r.committed, true, 'a flick goes through');
    assert.equal(r.carry, true);
    assert.equal(r.level, 1);
    assert.equal(log.at(-1), 'settle#1 through');
    assert.equal(log.filter(l => l.startsWith('launch')).length, 1, 'the carried level waits for the settle');
    settled();                                       // the first settle lands
    assert.deepEqual(log.slice(-2), ['launch#2 out@1', 'settle#2 through']);
    assert.deepEqual(drill.segment(), { dir: 1, e: 0, held: true, carried: true });
    settled();                                       // the carried settle lands
    assert.equal(level(), 2);
    assert.equal(drill.level(), 2);
    assert.equal(drill.segment(), null);
  });

  test('a flick against the segment is no flick: the snap decides', () => {
    const { drill, log } = harness();
    drill.begin(1); drill.move(70);
    const r = drill.release({ flick: -1 });
    assert.deepEqual(r, { level: 1, committed: true, e: 0.7, carry: false });
    assert.equal(log.filter(l => l.startsWith('launch')).length, 1);
  });

  test('a flick at the end carries nothing: the launch declines', () => {
    const { drill, log, settled } = harness({ closed: { 1: [1] } });
    drill.begin(1); drill.move(60);
    drill.release({ flick: 1 });
    settled();
    assert.equal(log.at(-1), 'decline out@1');
    assert.equal(drill.segment(), null);
  });

  test('a cancelled release never flicks', () => {
    const { drill, log } = harness();
    drill.begin(1); drill.move(70);
    const r = drill.release({ cancelled: true, flick: 1 });
    assert.equal(r.committed, false);
    assert.equal(r.carry, false);
    assert.equal(log.at(-1), 'settle#1 back');
  });
});
