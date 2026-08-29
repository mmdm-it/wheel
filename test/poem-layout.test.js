// A POEM CASCADES ALONG THE ARC (O-112, second sitting). The first design's
// straight global left edge died against the real geometry — the ring's arc
// sweeps rightward all the way down, and Howell photographed a sixteen-line
// prayer collapsed into the right-hand sliver. The ruling now: each metrical
// line's head seats at its own row's arc edge, continuations hang one indent
// in (clamped clear of the arc), a long poem splits at a metrical boundary,
// and an overflowing half steps down to a 0.7 floor — never truncating.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layoutPoem, poemPartCount } from '../src/view/detail/plugins/line-layout.js';

// The REAL shape of the sector in miniature: the arc intrudes rightward
// monotonically, the way the ring actually does on a phone.
const bounds = (() => {
  const topY = 100, bottomY = 560;
  const lineTable = [];
  for (let y = topY; y <= bottomY; y += 20) {
    const drift = Math.round((y - topY) * 0.45);
    lineTable.push({ y, leftX: 30 + drift, availableWidth: 330 - drift * 1.4 });
  }
  return { SSd: 390, topY, bottomY, leftBound: 30, rightBound: 360, lineTable };
})();

const SHORT = ['Βενιαμεὶν λύκος ἅρπαξ·', 'τὸ πρωινὸν ἔδεται ἔτι,', 'καὶ εἰς τὸ ἑσπέρας δίδωσιν τροφήν.'];

describe('the poem cascades along the arc', () => {
  it('seats every head at its own row\'s arc edge', () => {
    const { lines, parts } = layoutPoem(SHORT, bounds);
    assert.equal(parts, 1);
    const heads = lines.filter(l => l.head);
    assert.equal(heads.length, 3);
    for (const h of heads) {
      const row = bounds.lineTable.reduce((a, b) => Math.abs(b.y - h.y) < Math.abs(a.y - h.y) ? b : a);
      assert.ok(Math.abs(h.leftX - row.leftX) < 12, `head at y=${h.y} is off its arc edge`);
    }
  });

  it('hangs a continuation in from its head, and never inside the arc', () => {
    const long = ['ἐξομολογείσθω τῷ κυρίῳ ἐν ἀγαθότητι καὶ εὐλογείτω τὸν βασιλέα τῶν αἰώνων ἵνα πάλιν ἡ σκηνὴ αὐτοῦ οἰκοδομηθῇ'];
    const { lines } = layoutPoem(long, bounds);
    assert.ok(lines.length > 1, 'the long line never wrapped');
    const head = lines[0];
    for (const l of lines.slice(1)) {
      assert.ok(l.leftX > head.leftX + 5, 'the continuation does not hang');
      // the flow interpolates between rows; allow the interpolation gap
      const row = bounds.lineTable.reduce((a, b) => Math.abs(b.y - l.y) < Math.abs(a.y - l.y) ? b : a);
      assert.ok(l.leftX >= row.leftX - 10, `a continuation enters the arc at y=${l.y}`);
    }
  });

  it('splits a long poem at a metrical line boundary, nothing lost — Tobit-sized', () => {
    const many = Array.from({ length: 16 }, (_, i) => `στίχος ${i + 1} τῆς μεγάλης ᾠδῆς τοῦ Τωβεὶτ οὗτος`);
    assert.equal(poemPartCount(many, bounds), 2);
    const a = layoutPoem(many, bounds, 0), b = layoutPoem(many, bounds, 1);
    const words = t => t.split(/\s+/).filter(Boolean).length;
    const seated = [...a.lines, ...b.lines].reduce((n, l) => n + words(l.text), 0);
    assert.equal(seated, many.reduce((n, l) => n + words(l), 0), 'words were lost at the split');
    for (const l of [...a.lines, ...b.lines]) {
      assert.ok((l.text.match(/στίχος/g) || []).length <= 1, `mid-line split: ${l.text}`);
    }
  });

  it('steps a crowded half down toward the floor, never past it', () => {
    const many = Array.from({ length: 16 }, (_, i) => `στίχος ${i + 1} τῆς μεγάλης ᾠδῆς τοῦ Τωβεὶτ οὗτος μακρότερος ἔτι`);
    const a = layoutPoem(many, bounds, 0);
    const uniform = layoutPoem(SHORT, bounds).fontPx;
    assert.ok(a.fontPx <= uniform, 'a crowded half did not step down');
    assert.ok(a.fontPx >= uniform * 0.7 - 0.01, 'the floor was breached');
  });
});
