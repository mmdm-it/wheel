import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { beginMigrationTransaction, animateIn, animateOut, clearStack, beginScrubbedMigration, isScrubbing, scrubDriver } from '../src/view/migration-animation.js';

// The transaction core is DOM-free until an animation actually draws, so the
// arm/settle/barrier semantics are testable headless via the animations'
// guard paths (no svgRoot / empty stack), which arm and settle synchronously.

describe('migration transaction', () => {
  it('runs restore when every armed animation has settled', () => {
    let restored = 0;
    beginMigrationTransaction({ restore: () => { restored += 1; } });
    // Both animations take the guard path: arm, complete, settle — synchronously.
    animateIn({ svgRoot: null });
    assert.equal(restored, 1, 'barrier drops when the last armed animation settles');
    clearStack();
  });

  it('restores exactly once even with multiple animations', () => {
    let restored = 0;
    let completions = 0;
    beginMigrationTransaction({ restore: () => { restored += 1; } });
    animateIn({ svgRoot: null, onComplete: () => { completions += 1; } });
    animateOut({ onComplete: () => { completions += 1; } });
    assert.equal(completions, 2, 'each animation still gets its own onComplete');
    assert.equal(restored, 1, 'restore fires once, not per animation');
    clearStack();
  });

  it('force-finishes a stuck transaction when a new one begins', () => {
    let first = 0;
    let second = 0;
    beginMigrationTransaction({ restore: () => { first += 1; } });   // never settled
    beginMigrationTransaction({ restore: () => { second += 1; } });  // must not be wedged
    assert.equal(first, 1, 'the stuck transaction was force-restored');
    assert.equal(second, 0, 'the new transaction is still open');
    clearStack();
    assert.equal(second, 1, 'clearStack finishes the open transaction');
  });

  it('clearStack leaves no transaction behind for the next volume', () => {
    let restored = 0;
    beginMigrationTransaction({ restore: () => { restored += 1; } });
    clearStack();
    assert.equal(restored, 1);
    // A later animation with no open transaction behaves standalone (no throw).
    animateIn({ svgRoot: null });
  });
});

// THE DRILL IS SCRUBBED (O-138): headless, the controller's contract — what a
// finger owns, what a release does, what a strike undoes.
describe('the scrubbed drill (O-138)', () => {
  it('a scrub that launched nothing is forgotten, and release is a no-op', () => {
    const ctl = beginScrubbedMigration(null);
    assert.equal(isScrubbing(), true);
    assert.equal(ctl.launched(), false, 'nothing armed');
    ctl.cancel();
    assert.equal(isScrubbing(), false);
    ctl.release(true);   // nothing to do, nothing thrown
  });
  it('a struck drill calls the host\'s undo exactly once and closes the transaction', () => {
    let restored = 0, undone = 0;
    const ctl = beginScrubbedMigration(null);
    beginMigrationTransaction({ restore: () => { restored += 1; } });
    // The guard paths arm and settle synchronously — no flight, so no
    // completion waits on the finger — but the transaction is open.
    animateIn({ svgRoot: null });
    ctl.scrubTo(0.3);
    ctl.release(false, { onAbort: () => { undone += 1; } });
    assert.equal(undone, 1, 'the navigation is taken back once');
    assert.equal(isScrubbing(), false);
    assert.equal(restored, 1, 'the reals come back exactly once');
    clearStack();
  });
  it('a committed release fires the deferred completions in clock order', () => {
    // A second scrub while one is open strikes the first — the controller is
    // never left dangling.
    beginScrubbedMigration(null);
    const ctl = beginScrubbedMigration(null);
    assert.equal(isScrubbing(), true);
    ctl.scrubTo(2);      // clamped
    ctl.release(true);   // no rAF here: settles at once
    assert.equal(isScrubbing(), false);
    clearStack();
  });
});

// THE SECTOR RIDES THE FINGER (O-140): a frame driver joins the scrub clock.
describe('a frame driver on the scrub clock (O-140)', () => {
  it('with no scrub open the caller keeps its own clock', () => {
    assert.equal(scrubDriver(600, () => {}), false);
  });
  it('under a scrub the finger drives it, commit lands it at 1, and onCommit fires once', () => {
    const frames = []; let committed = 0, aborted = 0;
    const ctl = beginScrubbedMigration(null);
    assert.equal(scrubDriver(600, t => frames.push(t), { onCommit: () => { committed += 1; }, onAbort: () => { aborted += 1; } }), true);
    assert.equal(ctl.launched(), true, 'a driver is a launch');
    ctl.scrubTo(0.5);
    assert.ok(Math.abs(frames[frames.length - 1] - 0.5) < 1e-9, 'half the master clock is half the journey');
    ctl.release(true);
    assert.equal(frames[frames.length - 1], 1);
    assert.equal(committed, 1); assert.equal(aborted, 0);
    assert.equal(isScrubbing(), false);
  });
  it('struck, it goes back to its first frame before the undo and hears onAbort after it', () => {
    const order = [];
    const ctl = beginScrubbedMigration(null);
    scrubDriver(600, t => { if (t === 0) order.push('frame0'); }, { onAbort: () => order.push('driver-abort') });
    ctl.scrubTo(0.4);
    ctl.release(false, { onAbort: () => order.push('undo') });
    assert.deepEqual(order.slice(-3), ['frame0', 'undo', 'driver-abort'], 'picture first, navigation undone, then the sector\'s state follows');
  });
});
