// THE PARTIAL ECLIPSE'S TEXT HALF (O-84, Howell 2026-08-22): "the entire
// Bible should not be hostage to its longest verse."
//
// The shared per-device verse size used to be fitted to the whole of Esther
// 8:9; it is now fitted to the longer HALF of it, and a verse that no longer
// fits whole displays in two parts — two being a HARD CAP, which is exactly
// what keeps the half a safe sizing floor. These cells prove the three
// load-bearing claims from the outside, through the exported API only, in
// node (no DOM: the flow machinery falls back to its estimate metrics, which
// is the same path CI has always exercised).
//
// The ring's half of the ruling — the eclipse itself — is geometry on the
// glass; its verifier is Howell on the LAN, as with every rendering ruling.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  splitVerse, layoutVerse, versePartCount, uniformVerseFontPx,
  LONGEST_VERSE_REFERENCE
} from '../src/view/detail/plugins/line-layout.js';

// A phone-shaped sector: SSd 390, a straight-sided line table (the taper is
// sectorMetricAt's business and interpolates the same either way).
const BOUNDS = (() => {
  const topY = 100, bottomY = 620;
  const lineTable = [];
  for (let y = topY; y <= bottomY; y += 20) {
    lineTable.push({ y, leftX: 40, availableWidth: 320 });
  }
  return { SSd: 390, topY, bottomY, leftBound: 40, rightBound: 360, lineTable };
})();

const wordsOf = t => String(t).split(/\s+/).filter(Boolean);
const wordsOfLines = lines => lines.flatMap(l => wordsOf(l.text));

describe('a long verse shows in two parts (O-84)', () => {
  it('the split is balanced, on a word boundary, and loses nothing', () => {
    const [a, b] = splitVerse(LONGEST_VERSE_REFERENCE);
    assert.ok(a.length > 0 && b.length > 0, 'two real parts');
    assert.equal(`${a} ${b}`, wordsOf(LONGEST_VERSE_REFERENCE).join(' '),
      'joining the parts reproduces the verse word for word');
    // Balanced by characters: neither half beyond ~62% of the whole. The
    // bound is loose on purpose — words are indivisible, so exact halves are
    // not on offer; what matters is that no half approaches the old whole.
    const whole = a.length + b.length;
    assert.ok(Math.max(a.length, b.length) / whole < 0.62,
      `halves ${a.length}/${b.length} — neither may dominate`);
  });

  it('THE SIZE IS GOVERNED BY THE HALF: Esther 8:9 itself no longer fits whole', () => {
    // This is the whole point of the ruling made falsifiable: were the shared
    // size still fitted to the full reference, the reference would flow whole
    // and parts would be 1. It reporting 2 IS the measurement that the type
    // grew past the old ceiling.
    const laid = layoutVerse(LONGEST_VERSE_REFERENCE, BOUNDS);
    assert.equal(laid.parts, 2, 'the sizing reference itself now needs two screens');
    assert.equal(versePartCount(LONGEST_VERSE_REFERENCE, BOUNDS), 2,
      'and the ring is told the same thing the renderer decided');
  });

  it('an ordinary verse still fits whole and is untouched', () => {
    const ordinary = 'In the beginning God created heaven and earth. And the earth was void '
      + 'and empty, and darkness was upon the face of the deep.';
    const laid = layoutVerse(ordinary, BOUNDS);
    assert.equal(laid.parts, 1);
    assert.equal(laid.part, 0);
    assert.equal(versePartCount(ordinary, BOUNDS), 1);
    assert.deepEqual(wordsOfLines(laid.lines), wordsOf(ordinary), 'every word seated once');
  });

  it('the two parts carry every word exactly once, in order', () => {
    const p0 = layoutVerse(LONGEST_VERSE_REFERENCE, BOUNDS, 0);
    const p1 = layoutVerse(LONGEST_VERSE_REFERENCE, BOUNDS, 1);
    assert.equal(p0.part, 0);
    assert.equal(p1.part, 1);
    assert.deepEqual(
      [...wordsOfLines(p0.lines), ...wordsOfLines(p1.lines)],
      wordsOf(LONGEST_VERSE_REFERENCE),
      'part one then part two is the verse, nothing lost, nothing doubled — scripture is never cut');
  });

  it('NEITHER part overflows the sector — the hard cap of two is honest', () => {
    const fontPx = uniformVerseFontPx(BOUNDS);
    const lineH = fontPx * 1.30; // VERSE_LINE_HEIGHT
    for (const part of [0, 1]) {
      const { lines } = layoutVerse(LONGEST_VERSE_REFERENCE, BOUNDS, part);
      assert.ok(lines.length > 0, `part ${part} has lines`);
      const lastY = lines[lines.length - 1].y;
      assert.ok(lastY + lineH <= BOUNDS.bottomY + 0.5,
        `part ${part}'s last line (${lastY.toFixed(1)}) sits inside the sector`);
    }
  });

  it('a defective part request falls back to the first part, never to nothing', () => {
    const laid = layoutVerse(LONGEST_VERSE_REFERENCE, BOUNDS, 7);
    assert.equal(laid.part, 0, 'an unknown part is read as the first');
    assert.ok(laid.lines.length > 0);
  });
});
