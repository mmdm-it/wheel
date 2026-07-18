import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { beginMigrationTransaction, animateIn, animateOut, clearStack } from '../src/view/migration-animation.js';

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
