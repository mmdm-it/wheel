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
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  splitVerse, layoutVerse, versePartCount, uniformVerseFontPx,
  invalidateVerseMeasurement, LONGEST_VERSE_REFERENCE
} from '../src/view/detail/plugins/line-layout.js';
import { computeDetailSectorBounds } from '../src/geometry/detail-sector-geometry.js';
import { FocusRingView } from '../src/view/focus-ring-view.js';
import { createMockElement, createMockDocument } from './helpers/mock-dom.js';

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

  it("THE MAGNIFIER'S STROKE IS PERMANENT — the eclipse needs an edge to read against (O-84 amendment)", async () => {
    // Howell, 2026-08-22: the stroke used to appear only while rotating,
    // which was fine while every settled node sat dead-centre. A split verse
    // settles off-centre now, and a node peeking past a lens with no drawn
    // edge is invisible as an eclipse. The parent button's stroke is already
    // permanent; this holds the lens to the same rule. A source-shape cell,
    // because no unit can see a stylesheet: the BASE rule (not the .rotating
    // one) must carry the stroke.
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf-8');
    const base = css.match(/\n\.focus-ring-magnifier-circle\s*\{[^}]*\}/);
    assert.ok(base, 'the base magnifier rule exists');
    assert.match(base[0], /stroke:\s*var\(--color-magnifier-stroke/,
      'the settled lens draws its stroke, not only the rotating one');
    assert.match(base[0], /stroke-width/, 'with a width, so it actually paints');
  });
});

// THE ECLIPSED SETTLE (O-84, corrected from Howell's screenshot 2026-08-22).
// The first build let the settled-lens absorption run for split verses too:
// the opaque lens covered the off-centre node and wore its label, so the
// glass showed a fully-settled verse 9 — "centered in the magnifier ring,
// filling it. This is wrong." The node must keep its ordinary seat, size and
// numeral, and the lens goes hollow so the node partially covers the empty
// stroke circle. These cells drive the REAL view against the mock DOM.
describe('a split verse settles as a true eclipse, not an absorbed node', () => {
  const originalDocument = globalThis.document;
  let view;
  beforeEach(() => {
    globalThis.document = createMockDocument();
    view = new FocusRingView(createMockElement('svg'));
    view.init();
  });
  afterEach(() => { globalThis.document = originalDocument; });

  const NODE = { item: { id: 'v9', name: '9' }, x: 10, y: 10, radius: 12, angle: 0, label: '9' };
  const settle = eclipsed => view.render(
    [NODE],
    { hubX: 0, hubY: 0, radius: 100 },
    { startAngle: 0, endAngle: Math.PI },
    { x: 0, y: 0, radius: 24, angle: 0, label: '9' },
    { isRotating: false, eclipsed, magnifierAngle: 0, labelMaskEpsilon: 0.5, selectedId: 'v9' }
  );

  it('a WHOLE verse still settles absorbed: the lens wears the label, the node label yields', () => {
    settle(false);
    assert.equal(view.magnifierLabel.textContent, '9', 'the lens speaks on settle');
    assert.equal(view.labelsGroup.children[0].textContent, '', 'the node label is masked under it');
    assert.ok(!view.magnifierGroup.classList.contains('eclipsed'));
  });

  it('an ECLIPSED settle leaves the node its own seat and numeral, and empties the lens', () => {
    settle(true);
    assert.equal(view.magnifierLabel.textContent, '', 'the lens shows nothing of its own');
    assert.equal(view.labelsGroup.children[0].textContent, '9', 'the node keeps its numeral');
    assert.ok(view.magnifierGroup.classList.contains('eclipsed'),
      'and the class that hollows the lens fill is on');
  });

  it('the half-settled node wears the SETTLED size — the lens\'s own (Howell, 2026-08-22)', () => {
    // "Verse 9 at rest, either half, should be the same size as a settled
    // verse 10 at rest." The settled size IS the lens: the whole-verse settle
    // absorbs the node under an opaque lens of magnifier radius, so equality
    // means the eclipsed node's circle grows to that same radius — two
    // equal circles, partially overlapping, which is what an eclipse is.
    settle(true);
    const circle = view.nodesGroup.children[0];
    assert.equal(Number(circle.getAttribute('r')), 24,
      'the node circle at the lens radius (fixture: node 12, lens 24)');
    const label = view.labelsGroup.children[0];
    assert.match(String(label.getAttribute('transform') || ''), /scale\(2\.000\)/,
      'and the numeral scales with it');
    // The neighbours do not grow — only the half-settled node is settled.
    settle(false);
    assert.equal(Number(view.nodesGroup.children[0].getAttribute('r')), 12,
      'a whole-verse settle leaves the ring node at ring size (it hides under the lens)');
  });

  it('the settle is still ANNOUNCED when eclipsed — a screen reader cannot see an eclipse', () => {
    const region = { textContent: '' };
    globalThis.document.getElementById = id => (id === 'a11y-announcer' ? region : null);
    settle(true);
    assert.equal(region.textContent, '9',
      'the live region speaks the settled label even though the lens shows nothing');
  });
});

describe('the block sits one row higher than it measures itself (O-115)', () => {
  // Howell, 2026-08-29: "move the entire text block up by one row... one row
  // closer to the copyright disclaimer", and then, told what the auto-fit
  // would do with the gained height: "pin the shared size to what it is now."
  // Two numbers, deliberately different — where text SEATS and what the size
  // is FITTED against — because fitting to the taller box spends the row on
  // bigger glyphs and saves no splits at all.
  it('seats one line pitch above the fence it sizes against', () => {
    const b = computeDetailSectorBounds(360, 740);
    const pitch = b.SSd * 0.03 * 1.4;
    assert.ok(b.sizingTopY !== undefined, 'the sizing box is not exposed');
    assert.ok(Math.abs((b.sizingTopY - b.topY) - pitch) < 0.001,
      `the block is not raised by exactly one pitch (${b.sizingTopY - b.topY} vs ${pitch})`);
  });

  it('keeps the shared size the raise would otherwise inflate', () => {
    const b = computeDetailSectorBounds(360, 740);
    const unraised = { ...b, topY: b.sizingTopY, sizingTopY: undefined };
    invalidateVerseMeasurement();
    const pinned = uniformVerseFontPx(b);
    invalidateVerseMeasurement();
    const before = uniformVerseFontPx(unraised);
    assert.ok(Math.abs(pinned - before) < 0.001,
      `the size moved with the block (${before} -> ${pinned})`);
  });

  it('spends the gained row on text: a verse that split now fits whole', () => {
    // A verse sized to just overflow the unraised box must fit the raised one
    // at the same pinned size — that is the whole point of the move.
    const b = computeDetailSectorBounds(360, 740);
    const unraised = { ...b, topY: b.sizingTopY, sizingTopY: undefined };
    invalidateVerseMeasurement();
    const px = uniformVerseFontPx(b);
    let words = [];
    let text = '';
    for (let i = 0; i < 400; i += 1) {
      words.push('λογος');
      const t = words.join(' ');
      if (versePartCount(t, unraised) > 1) { text = t; break; }
    }
    assert.ok(text, 'no verse long enough to overflow the unraised sector');
    assert.equal(versePartCount(text, unraised), 2, 'the fixture does not split before the move');
    assert.equal(versePartCount(text, b), 1, 'the gained row did not seat the verse whole');
    assert.ok(px > 0);
  });
});
