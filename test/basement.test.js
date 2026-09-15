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
// The stub DOM has no querySelector, so a stratum once drawn is never pruned
// there (hideStratum is a no-op on it): these cells assert the floors' STATE
// and leave the picture to the phone.

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
    // A seat is a leaf IN AN EDITION; a bare leaf means the edition up (the boot's).
    const key = `u-test-leaf@${D.get().translation}`;
    assert.equal(D.keep('u-test-leaf'), true);
    let b = D.basement();
    assert.deepEqual(b.kept, [key]);
    assert.deepEqual(b.items, [key]);
    assert.equal(D.keep('u-test-leaf'), true, 'the same gesture drops');
    b = D.basement();
    assert.deepEqual(b.kept, [], 'dropped from storage');
    assert.deepEqual(b.items, [key], 'but still on the ring, hollow, for this visit');
    D.keep('u-test-leaf'); // keep it again for the next cell
    assert.equal(D.keep('u-test-leaf@1471ita'), true, 'the same leaf in another edition is another seat');
    assert.deepEqual(D.basement().kept, [key, 'u-test-leaf@1471ita']);
    D.keep('u-test-leaf@1471ita'); // and drop it again
  });

  it('sliding up returns the text, and the basement is not rendered from above', async () => {
    assert.equal(D.slide(0), true);
    await settle();
    assert.equal(D.front(), 0);
    const b = D.basement();
    assert.equal(b.arrival, null);
    assert.equal(b.lens, null, 'the visit is over; nothing lingers under the lens');
    assert.deepEqual(b.kept, [`u-test-leaf@${D.get().translation}`], 'what was kept stays kept');
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

  it('the slider SCRUBS the glide and settles only on release', async () => {
    D.slide(0); await settle();
    assert.equal(D.front(), 0);
    // Held partway down: the picture is mid-glide and nothing has committed.
    D.scrub(-0.4);
    assert.equal(D.front(), 0, 'no floor changes while the thumb is held');
    assert.equal(D.basement().arrival, null, 'from the front door: nothing in hand, even mid-glide');
    // Released before halfway: back to where it was, and the visit is unbegun.
    D.scrub(-0.3); D.release(); await settle();
    assert.equal(D.front(), 0);
    // Released past halfway: settles down.
    D.scrub(-0.7); D.release(); await settle();
    assert.equal(D.front(), -1);
    // Dragged straight through a floor: the segment behind commits as the next begins.
    D.scrub(0.2);
    assert.equal(D.front(), 0, 'crossed the text without stopping');
    D.release(); await settle();
    assert.equal(D.front(), 0, 'and the fifth of the way to the editions fell back');
  });

  it('the hold in the overrun keeps nothing from the front door — no verse in hand', async () => {
    D.slide(-1); await settle();
    assert.equal(D.front(), -1);
    D.holdBegin();
    assert.equal(D.hold(), null, 'nothing came down with the reader, so there is nothing to keep');
    D.holdCancel();
    assert.equal(D.hold(), null);
  });

  it('the tap goes round: languages, editions, the text, the basement, and back to the languages', async () => {
    D.slide(2); await settle();
    D.cycle(); await settle(); assert.equal(D.front(), 1, 'editions');
    D.cycle(); await settle(); assert.equal(D.front(), 0, 'the text');
    D.cycle(); await settle(); assert.equal(D.front(), -1, 'the basement, one tap down from the text');
    D.cycle(); await settle(); assert.equal(D.front(), 2, 'and round to the languages');
  });
});
