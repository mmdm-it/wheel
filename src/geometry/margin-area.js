// THE GROUND BEYOND THE RING — where a margin note is set (W-127, W-165).
//
// "THE MARGIN GOES BEYOND THE RING" is W-127's own title, and it is literal.
// The Detail Sector is the expanded circle INSIDE the arc, and everything the
// wheel has ever displayed lives there. Swete's apparatus does not: on his page
// it sits at the foot, outside the block of scripture, and here it sits outside
// the ring, on the ground the arc sweeps past. Howell drew it there himself on
// 2026-08-26 before either of us had looked up what W-127 said.
//
// THE REGION IS A LENS, not a rectangle. The arc runs from the top-left corner
// down to the lower right; the ground left of it is nothing at the top and
// widens all the way down, so a line table is the only honest description —
// each row gets the width the arc actually leaves it, exactly as the Detail
// Sector's own table does on the other side of the same curve.
//
// EVERY BOUND HERE IS A KNOB AND IS MEANT TO BE ARGUED WITH. The note tier was
// set at 5% (O-91) "provisional until his eye meets a note", and a note that
// outgrows the margin was ruled to split across half-settles (O-86) — both
// decided before anyone had seen one. They have now been seen: median 514
// characters, 13% over a thousand, longest 3,006.
import { getViewportInfo, getArcParameters, getMagnifierPosition } from './focus-ring-geometry.js';

export const MARGIN_SPEC = {
  /** Left edge, as a fraction of the short side. */
  LEFT_RATIO: 0.04,
  /** Clearance between the arc's OUTER band edge and the longest line. */
  ARC_GAP_RATIO: 0.035,
  /** Floor: clear of the unit label at the foot, whose baseline sits at
   *  0.93 of the long side (getParentSeat), with its ascenders above that.
   *  Measured from the HEIGHT and not the short side — on a tall phone those
   *  are different numbers, and using the wrong one drew the margin over the
   *  furniture below it. The proofread badge USED to be down here too and no
   *  longer is (2026-08-27), which gives the margin a row back. */
  LABEL_BASELINE: 0.93,
  LABEL_ASCENDER: 0.06,
  /** How narrow a row may be before it is not worth setting type on — and so,
   *  in effect, HOW HIGH THE MARGIN STARTS, because the lens closes as it
   *  rises and this is what decides where to stop climbing.
   *
   *  LOWERED FROM 0.28 ON 2026-08-27 (Howell, marking three empty rows above
   *  the first on a screenshot: "let's see if we can add two or three rows of
   *  text above the current first row"). It buys three, at 147, 176 and 208
   *  pixels against the old top row's 242 — nine, eleven and thirteen
   *  characters at the ruled type size. Short lines, but the apparatus is made
   *  of short tokens and they break tolerably.
   *
   *  MEASURED, because the point of it is a number: verses whose notes eclipse
   *  fall from 29% to 19%. That is the same gain as dropping the type from 5%
   *  to 4% and it costs no legibility — Howell had already said he was happy
   *  with the size. A fourth row is available and buys two more points at 120
   *  pixels, about seven characters, which is where the lines start to break
   *  badly. Three is where he drew it and three is where this stops. */
  MIN_WIDTH_RATIO: 0.16,
  /** Note type size, as a fraction of the short side (O-91's 5%). */
  FONT_RATIO: 0.05,
  /** Line height, as a multiple of the font size. */
  LINE_HEIGHT: 1.35,
  /** The band is a 0.99r–1.01r annulus (focus-ring-view). */
  BAND_OUTER: 1.01,
};

/**
 * The margin's line table: rows top-to-bottom, each with its own left edge,
 * right edge and available width, in viewport coordinates.
 */
export function computeMarginArea(width, height, spec = MARGIN_SPEC) {
  const viewport = getViewportInfo(width, height);
  const { SSd } = viewport;
  const arc = getArcParameters(viewport);
  const magnifier = getMagnifierPosition(viewport);

  const leftX = SSd * spec.LEFT_RATIO;
  const bottomY = height * spec.LABEL_BASELINE - SSd * spec.LABEL_ASCENDER;
  const fontPx = SSd * spec.FONT_RATIO;
  const pitch = fontPx * spec.LINE_HEIGHT;
  const gap = SSd * spec.ARC_GAP_RATIO;
  const outer = arc.radius * spec.BAND_OUTER;

  // The x at which the arc's outer band edge crosses this height. Beyond the
  // ring means FARTHER from the hub, and the hub is off to the right, so the
  // usable ground is everything to the LEFT of this.
  const arcOuterAt = y => {
    const t = outer * outer - (y - arc.hubY) * (y - arc.hubY);
    return t > 0 ? arc.hubX - Math.sqrt(t) : -Infinity;
  };

  const minWidth = SSd * spec.MIN_WIDTH_RATIO;
  // The ceiling is where the lens first opens wide enough to set a line in.
  // Derived rather than declared: it moves correctly when the arc does.
  let topY = bottomY;
  for (let y = bottomY; y > 0; y -= pitch) {
    if (arcOuterAt(y) - gap - leftX < minWidth) break;
    topY = y;
  }

  const lineTable = [];
  for (let y = topY; y <= bottomY - pitch; y += pitch) {
    // Each row is measured at its BASELINE-ish lower edge, which is where the
    // arc bites deepest into that row. Measuring at the top would let the last
    // word of a line cross the band.
    const rightX = arcOuterAt(y + pitch) - gap;
    const availableWidth = rightX - leftX;
    if (availableWidth < minWidth) continue;
    // The magnifier sits ON the band and its circle bulges past the outer edge.
    const magR = SSd * 0.06;
    const dy = Math.abs((y + pitch / 2) - magnifier.y);
    const bite = dy < magR ? Math.sqrt(magR * magR - dy * dy) : 0;
    lineTable.push({
      y,
      leftX,
      rightX: rightX - bite,
      availableWidth: availableWidth - bite,
    });
  }

  return { topY, bottomY, leftX, fontPx, pitch, lineTable, viewport, arc, magnifier };
}
