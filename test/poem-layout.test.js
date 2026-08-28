// A POEM FLOWS LINE BY LINE ON A STRAIGHT LEFT EDGE (O-112). Howell's ruling,
// 2026-08-28: poetry at the same size as prose, each of Swete's metrical
// lines beginning its own display line, a straight left origin instead of the
// arc — the straight edge itself the quiet signal that this is verse — and a
// long line wrapping with a hanging indent. A long poem splits across the
// two-part eclipse at a METRICAL line boundary, never mid-line.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layoutPoem, poemPartCount } from '../src/view/detail/plugins/line-layout.js';

// An arc'd sector: the left edge intrudes more near the top, like the circle.
const bounds = (() => {
  const topY = 100, bottomY = 560;
  const lineTable = [];
  for (let y = topY; y <= bottomY; y += 20) {
    const bulge = Math.round(60 * Math.abs(y - 330) / 230);   // widest mid-sector
    lineTable.push({ y, leftX: 40 + bulge, availableWidth: 320 - bulge * 2 });
  }
  return { SSd: 390, topY, bottomY, leftBound: 40, rightBound: 360, lineTable };
})();

const SHORT = ['Βενιαμεὶν λύκος ἅρπαξ·', 'τὸ πρωινὸν ἔδεται ἔτι,', 'καὶ εἰς τὸ ἑσπέρας δίδωσιν τροφήν.'];

describe('the poem stands on a straight left edge', () => {
  it('gives every metrical line the same left origin', () => {
    const { lines, parts } = layoutPoem(SHORT, bounds);
    assert.equal(parts, 1);
    const heads = lines.filter(l => l.head);
    assert.equal(heads.length, 3, 'every metrical line starts a display line');
    const origins = new Set(heads.map(l => l.leftX.toFixed(1)));
    assert.equal(origins.size, 1, `origins wander: ${[...origins].join(', ')}`);
  });

  it('clears the arc everywhere it stands — no line starts left of its row', () => {
    const { lines } = layoutPoem(SHORT, bounds);
    for (const l of lines) {
      // the row's own left intrusion at this y
      const row = bounds.lineTable.reduce((a, b) => Math.abs(b.y - l.y) < Math.abs(a.y - l.y) ? b : a);
      assert.ok(l.leftX >= row.leftX - 0.5, `line at y=${l.y} starts inside the arc`);
    }
  });

  it('hangs the continuation of a long metrical line', () => {
    const long = ['ἐξομολογείσθω τῷ κυρίῳ ἐν ἀγαθότητι καὶ εὐλογείτω τὸν βασιλέα τῶν αἰώνων ἵνα πάλιν ἡ σκηνὴ αὐτοῦ οἰκοδομηθῇ'];
    const { lines } = layoutPoem(long, bounds);
    assert.ok(lines.length > 1, 'the long line never wrapped');
    assert.ok(lines[1].leftX > lines[0].leftX + 5, 'the continuation does not hang');
  });

  it('splits a long poem at a metrical line boundary, nothing lost — Tobit-sized', () => {
    // Sixteen lines, the corpus's longest lined verse (Tobit 13:6).
    const many = Array.from({ length: 16 }, (_, i) => `στίχος ${i + 1} τῆς μεγάλης ᾠδῆς τοῦ Τωβεὶτ οὗτος`);
    assert.equal(poemPartCount(many, bounds), 2);
    const a = layoutPoem(many, bounds, 0), b = layoutPoem(many, bounds, 1);
    const words = t => t.split(/\s+/).filter(Boolean).length;
    const seated = [...a.lines, ...b.lines].reduce((n, l) => n + words(l.text), 0);
    assert.equal(seated, many.reduce((n, l) => n + words(l), 0), 'words were lost at the split');
    // no display line mixes two metrical lines
    for (const l of [...a.lines, ...b.lines]) {
      assert.ok((l.text.match(/στίχος/g) || []).length <= 1, `mid-line split: ${l.text}`);
    }
    // an overflowing half may shrink, never truncate
    assert.ok(a.fontPx > 0 && b.fontPx > 0);
  });
});
