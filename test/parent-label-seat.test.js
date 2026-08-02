// THE LABEL COMES HOME (Howell 2026-07-25) and CLEARS THE STROKE (2026-08-02).
//
// The parent label is placed by TEXT WIDTH under three rules: short labels
// center on the vessel (IHI); longer ones right-align over it with the ring's
// own 1.3-radius spill past center (FINLANDIA, MITSUBISHI); labels too long
// for that fall back to the corner start (PALMER BROTHERS) so they never exit
// the viewport's left edge.
//
// A SUFFIXED label — the book name plus the chapter it is open at — broke
// those rules, because they place the whole string and the vessel's stroke
// then cut through the numeral. Such a label is seated by its NAME instead:
// the name's last letter lands just past the stroke, which puts the entire
// suffix beyond the disc. For a suffixed label rules 1 and 2 collapse into
// one — centering a short name would leave its numeral straddling the stroke
// exactly as before — and only the corner floor still applies.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getViewportInfo, getParentSeat, getParentLabelLeftX } from '../src/geometry/focus-ring-geometry.js';

const vp = getViewportInfo(720, 1400);
const magR = vp.SSd * 0.06;
const seat = getParentSeat(vp, magR);
const strokeX = seat.discX + magR;          // the vessel's right edge
const place = (w, nameW = null) => getParentLabelLeftX(vp, magR, w, nameW);

describe('the parent label seat', () => {
  it('keeps the three rules for a label with no suffix', () => {
    assert.equal(place(60).toFixed(1), (seat.discX - 30).toFixed(1), 'short centers on the vessel');
    assert.equal(place(220).toFixed(1), (seat.discX + magR * 1.3 - 220).toFixed(1), 'longer right-aligns with the 1.3r spill');
    assert.equal(place(560), seat.labelX, 'too long falls back to the corner');
  });

  it('never lets any label exit the left edge', () => {
    for (const w of [60, 220, 400, 560, 900, 2000]) {
      assert.ok(place(w) >= seat.labelX, `width ${w}`);
      assert.ok(place(w, w * 0.8) >= seat.labelX, `width ${w} suffixed`);
    }
  });

  it('seats a SUFFIXED label so the name clears the stroke and the suffix hangs free', () => {
    const suffixW = 58;
    for (const nameW of [70, 140, 217, 300]) {   // short through medium
      const x = place(nameW + suffixW, nameW);
      const nameEnds = x + nameW;
      assert.ok(nameEnds >= strokeX, `name of ${nameW} ends at ${nameEnds}, stroke at ${strokeX}`);
      assert.ok(nameEnds - strokeX < magR * 0.25, 'and only JUST past it, not flung right');
      assert.ok(x + nameW + suffixW > strokeX, 'the whole suffix sits beyond the vessel');
    }
  });

  it('short and medium suffixed names take the SAME seat — the rules collapse', () => {
    const s = 58;
    assert.equal(place(70 + s, 70) + 70, place(217 + s, 217) + 217,
      'both land their last letter on the same point past the stroke');
  });

  it('a long suffixed name still starts at the corner, its suffix already clear', () => {
    const nameW = 520, suffixW = 58;
    assert.equal(place(nameW + suffixW, nameW), seat.labelX);
    assert.ok(seat.labelX + nameW >= strokeX, 'a corner-started name reaches past the vessel on its own');
  });

  it('ignores a nonsense name width rather than mis-seating', () => {
    const w = 300;
    assert.equal(place(w, w), place(w), 'a name as wide as the label means no suffix');
    assert.equal(place(w, w + 50), place(w), 'a name wider than its label is not believed');
    assert.equal(place(w, 0), place(w), 'and neither is an empty one');
  });
});
