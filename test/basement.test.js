// THE SLIDER AND THE BASEMENT (O-126) — the globe addresses a floor directly,
// in either direction, and the floor below the text holds bookmarks.
//
// Boots main.js for real, as boot-smoke does (it self-executes at import, in
// this file's own process), walks the launch funnel to the text, and then
// slides: down to the basement, up again, straight from the languages to the
// basement. Shallow on purpose — the floors' STATE, not their look.
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { installBrowserGlobals } from './helpers/browser-globals.mjs';

const settle = (ms = 750) => new Promise(r => setTimeout(r, ms)); // past the 600ms strata tween

describe('the slider and the basement (O-126)', () => {
  let D;
  before(async () => {
    installBrowserGlobals('?volume=bible&proofread=true');
    const realError = console.error;
    console.error = () => {};
    await import('../src/main.js');
    await settle(200);
    console.error = realError;
    D = globalThis.window?.__wheelDimension;
    assert.ok(D, 'the booted app exposed no dimension handle');
    // Walk the funnel home: language → edition → the text.
    D.cycle(); await settle(); D.cycle(); await settle();
    assert.equal(D.front(), 0, 'the reader is at the text');
  });

  it('one notch down is the basement, and it is a floor of its own', async () => {
    assert.equal(D.min(), -1, 'the basement is one floor below the text');
    assert.equal(D.slide(-1), true);
    await settle();
    assert.equal(D.front(), -1);
    const b = D.basement();
    assert.equal(b.arrival, null, 'from the front door the reader arrives with nothing in hand');
    assert.deepEqual(b.items, [], 'an empty ring is a real state — the floor exists before anything is on it');
  });

  it('the lens keeps, and dropping leaves the seat hollow until the reader leaves', async () => {
    assert.equal(D.keep('u-test-leaf'), true);
    let b = D.basement();
    assert.deepEqual(b.kept, ['u-test-leaf']);
    assert.deepEqual(b.items, ['u-test-leaf']);
    assert.equal(D.keep('u-test-leaf'), true, 'the same gesture drops');
    b = D.basement();
    assert.deepEqual(b.kept, [], 'dropped from storage');
    assert.deepEqual(b.items, ['u-test-leaf'], 'but still on the ring, hollow, for this visit');
    D.keep('u-test-leaf'); // keep it again for the next cell
  });

  it('sliding up returns the text, and the basement is not rendered from above', async () => {
    assert.equal(D.slide(0), true);
    await settle();
    assert.equal(D.front(), 0);
    const b = D.basement();
    assert.equal(b.arrival, null);
    assert.equal(b.lens, null, 'the visit is over; nothing lingers under the lens');
    assert.deepEqual(b.kept, ['u-test-leaf'], 'what was kept stays kept');
    const basementRing = globalThis.document?.getElementById?.('basement') ?? null;
    assert.equal(basementRing, null, 'from the main floor the basement is absent, not hidden behind');
  });

  it('the slider addresses any floor directly, and clamps at the ends', async () => {
    assert.equal(D.slide(2), true); await settle();
    assert.equal(D.front(), 2, 'straight to the languages');
    assert.equal(D.slide(-1), true); await settle();
    assert.equal(D.front(), -1, 'and straight down to the basement');
    assert.equal(D.slide(-5), false, 'below the basement there is nothing');
    assert.equal(D.front(), -1);
    assert.equal(D.slide(0), true); await settle();
    assert.equal(D.slide(9), true); await settle();
    assert.equal(D.front(), 2, 'above the languages there is nothing');
    assert.equal(D.slide(2), false, 'the same floor is no move');
  });

  it('a tap still cycles inward, from the basement too', async () => {
    D.slide(-1); await settle();
    D.cycle(); await settle();
    assert.equal(D.front(), 2, 'from the basement a tap rounds to the languages, as from the text');
    D.cycle(); await settle();
    assert.equal(D.front(), 1);
  });
});
