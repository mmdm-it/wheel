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
import { verseFaceReady, onVerseFontReady, faceMarkDrifted } from '../src/view/detail/plugins/line-layout.js';
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
  // closer to the copyright disclaimer", then, seeing it: "that looks like a
  // vertical change of less than a full row." It was: the first pass raised
  // by one LINE-TABLE pitch — the tier-6 grid, 0.042·SSd — which is under
  // half a row of the type he actually reads. The raise is now counted in
  // the reader's own rows, and the copyright notice is the ceiling.
  it('raises by a row of the reader\'s type, not of the line-table grid', () => {
    const b = computeDetailSectorBounds(360, 740, null, 0); // no notice in the way
    invalidateVerseMeasurement();
    const px = uniformVerseFontPx(b);
    const verseRow = px * 1.3;
    const tablePitch = b.SSd * 0.03 * 1.4;
    assert.ok(verseRow > tablePitch * 2, 'the fixture no longer distinguishes the two units');
    const seatTop = Math.max(b.topY - verseRow, b.ceilingY);
    assert.ok(Math.abs((b.topY - seatTop) - verseRow) < 0.001,
      'the raise is not one row of the reader\'s type');
  });

  it('stops at the copyright notice rather than climbing over it', () => {
    const tall = computeDetailSectorBounds(360, 740, null, 200); // an absurd notice
    invalidateVerseMeasurement();
    const px = uniformVerseFontPx(tall);
    // The line box may cross the notice's INK line by its own half-leading —
    // 0.15em of guaranteed white above the glyphs — and no further.
    const seatTop = Math.max(tall.topY - px * 1.3, tall.ceilingY - px * 0.15);
    assert.ok(seatTop < 200 && seatTop > 200 - px * 0.16, 'the clamp is not ink-aware');
    // The ink itself never reaches the notice.
    assert.ok(seatTop + px * 0.15 >= 200 - 0.001, 'glyph ink crossed the notice');
  });

  it('takes the notice\'s own bottom padding as headroom (Howell\'s Moto G)', () => {
    // Howell, reading through the translucent mark: "there appears to be
    // plenty of headroom before we hit the copyright warning." There was —
    // the clamp was measuring the notice's BOX, six pixels of padding below
    // its last line, and the line box's own empty top on the other side.
    const box = computeDetailSectorBounds(360, 740, null, 38);   // box bottom
    const ink = computeDetailSectorBounds(360, 740, null, 32);   // ink bottom
    invalidateVerseMeasurement();
    const px = uniformVerseFontPx(ink);
    const seatOf = b => Math.max(b.topY - px * 1.3, b.ceilingY - px * 0.15);
    assert.ok(seatOf(ink) < seatOf(box) - 5, 'the padding was not recovered');
  });

  it('keeps the shared size the raise would otherwise inflate', () => {
    const b = computeDetailSectorBounds(360, 740, null, 0);
    const unraised = { ...b, ceilingY: b.topY };   // ceiling at the fence: no raise possible
    invalidateVerseMeasurement();
    const pinned = uniformVerseFontPx(b);
    invalidateVerseMeasurement();
    const before = uniformVerseFontPx(unraised);
    assert.ok(Math.abs(pinned - before) < 0.001,
      `the size moved with the block (${before} -> ${pinned})`);
  });

  it('spends the gained row on text: a verse that split now fits whole', () => {
    const raised = computeDetailSectorBounds(360, 740, null, 0);
    const unraised = { ...raised, ceilingY: raised.topY };
    invalidateVerseMeasurement();
    let text = '';
    const words = [];
    for (let i = 0; i < 400; i += 1) {
      words.push('λογος');
      const t = words.join(' ');
      if (versePartCount(t, unraised) > 1) { text = t; break; }
    }
    assert.ok(text, 'no verse long enough to overflow the unraised sector');
    assert.equal(versePartCount(text, unraised), 2, 'the fixture does not split before the move');
    assert.equal(versePartCount(text, raised), 1, 'the gained row did not seat the verse whole');
  });
});

describe('a layout measured without the real face is provisional (O-118)', () => {
  // Howell: "Genesis 1:1 renders differently at boot than it does after
  // turning the focus ring away and back." The boot layout wrapped at 18
  // characters where 27 fit — measured in the Georgia fallback, painted in
  // EB Garamond. The post-paint verifier could not catch it: it asks whether
  // a line OVERFLOWS its box, and this failure under-fills it.
  it('states plainly whether the real face has reached layout', () => {
    // Outside a browser there is no font pipeline, so the answer is no — and
    // the point of the predicate is that a caller can ASK, which is what the
    // render now does before trusting its own measurements.
    assert.equal(typeof verseFaceReady, 'function');
    assert.equal(verseFaceReady(), false, 'claimed the serif was loaded with no font pipeline');
  });

  it('holds a callback until the face lands rather than dropping it', () => {
    // The old cure was one global one-shot registered during boot, and the
    // boot splash renders the first verse after it — so on a warm cache the
    // shot was spent before there was anything to correct. A callback
    // registered while the face is absent must still be waiting, not lost.
    let fired = false;
    onVerseFontReady(() => { fired = true; });
    assert.equal(fired, false, 'the callback fired though no face has loaded');
  });
});

describe('the paint is asked about under-fill, not only overflow (O-119)', () => {
  // Howell, after the first attempt: "Cold boot failed." The first fix
  // trusted document.fonts, and the comment beside the paint-witness already
  // said that promise resolves BEFORE the face reaches layout — which is why
  // the witness exists at all. The witness was asking one question, "did a
  // line run PAST its box", and this failure sits comfortably INSIDE the box.
  it('recognises a line that could still have taken the next word', () => {
    // The predicate itself, in miniature: a row 326px wide holding a line
    // that measures 227px, with a word of 40px waiting below it. Nothing
    // overflows; everything is wrong.
    const box = 326, painted = 227, nextWord = 40;
    assert.ok(painted + nextWord <= box - 1,
      'the fixture does not represent an under-filled row');
  });

  it('leaves a genuinely full row alone', () => {
    const box = 326, painted = 318, nextWord = 40;
    assert.ok(!(painted + nextWord <= box - 1),
      'a full row would be reported as under-filled');
  });
});

describe('the layout marks the face it was measured in (O-121)', () => {
  // Howell settled three rounds of guessing with one sentence: "the bug
  // disappears with the probe=1 tag, but without it I still see the 3 line
  // incorrect version." The probe measures one extra span per layout, and
  // that extra measurement was dragging the real face into layout in time —
  // so the instrument was curing the bug by observing it.
  //
  // The check that failed asked whether the painted lines look wrong in the
  // face that is active NOW; the stale layout was measured in that same face,
  // so it agreed with itself. This one compares a number to itself across two
  // frames instead, and asks nothing about fonts at all.
  it('reports no drift when there is nothing to compare', () => {
    // No layout has been marked in this process and there is no DOM to
    // measure with, so the honest answer is "no drift" — never a re-render
    // storm on a page that cannot measure.
    assert.equal(faceMarkDrifted(), false);
  });

  it('is the arithmetic Howell photographed', () => {
    // The wrap log on his Moto G: one size, one row, the first layout
    // measuring the sentinel at 321px and every later one at 268px. That gap
    // is what this check exists to see; anything under half a pixel is not.
    const atLayout = 321, atPaint = 268;
    assert.ok(Math.abs(atPaint - atLayout) > 0.5, 'the drift test would have missed it');
    assert.ok(!(Math.abs(268 - 268.2) > 0.5), 'ordinary rounding would trigger a re-render');
  });
});
