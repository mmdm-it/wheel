// THE canonical usable areas (Howell 2026-07-19: "no random margins — with
// firm boundaries any volume or data gets a standard canvas").
//
//   DSUA — Detail Sector Usable Area: the full arc-clipped canvas.
//   CPUA — Child Pyramid Usable Area: the DSUA shaved by the canonical
//          margins, minus the volume logo's cutout, minus the magnifier's
//          clearance zone. EVERY pyramid layout engine (star field, day
//          grid, whatever comes) draws inside this and only this; the
//          ?bounds=1 diagnostic draws exactly these lines.
//
// Tune HERE and only here. The ratios below are the eye-tuned canon as of
// C.5 (converged over 2026-07-19's LAN sessions).

export const CPUA_SPEC = {
  TOP_RATIO: 0.15,             // top margin (× SSd) — clears the copyright block
  RIGHT_MARGIN_RATIO: 0.02,    // right margin (× SSd) — nearly the viewport edge
  LEFT: 0,                     // the left edge is the canvas edge
  // THE CONTROL DECK (Howell 2026-07-19): everything below the magnifier's
  // crown — magnifier, parent button, and Phase D's returning dimension
  // button — is a reserved horizontal band, not part of any usable area.
  // Floor = magY − (magnifier radius 0.06 + pad 0.02) × SSd. This retires
  // the vessel exclusion circle: the magnifier lives wholly below the floor.
  DECK_CLEARANCE_RATIO: 0.08,
  // THE TAPERED ARC (Howell): the arc margin is a function of height —
  // tight at the top (display territory), swelling toward the deck (thumb
  // territory, where scrubbing happens). Linear between these two.
  ARC_MARGIN_TOP_RATIO: 0.06,
  ARC_MARGIN_BOTTOM_RATIO: 0.28,
  // Logo notch padding (the drawn artwork spills past getBounds()).
  LOGO_PAD_LEFT_RATIO: 0.035,
  LOGO_PAD_BOTTOM_RATIO: 0.01
};

// DSUA = THE FENCE, always (Howell 2026-07-19): when the detail sector is
// open the corner logo has left for its watermark seat, so the reader owns
// the whole polygon. CPUA = the same fence minus the conditional logo box.
// CPUA ⊆ DSUA by construction.
export function computeDSUA(viewport, arcParams, magnifier) {
  return computeCPUA(viewport, arcParams, magnifier, { logoBounds: null });
}

/**
 * Trace THE FENCE: the usable area's boundary as one closed polygon
 * (SVG path d). Clockwise: in along the top from the arc's entry, around
 * the logo notch, down the right edge, along the deck floor if reached,
 * home up the (tapered) arc. One polygon = the real estate.
 */
export function traceFence(area) {
  const { left, top, right, bottom } = area;
  const pts = [];

  const entryX = Math.max(left, Math.min(area.arcXAt(top), right));
  pts.push([entryX, top], [right, top]);

  // Down the right edge until the arc reclaims it (or the deck floor).
  let exitY = bottom;
  for (let y = top; y <= bottom; y += 3) {
    if (area.arcXAt(y) >= right) { exitY = y; break; }
  }
  pts.push([right, exitY]);

  // Along the deck floor to the arc, if the floor was reached.
  if (exitY >= bottom) {
    pts.push([Math.max(left, area.arcXAt(bottom)), bottom]);
  }

  // Home up the tapered arc.
  for (let y = Math.min(exitY, bottom); y > top; y -= 5) {
    const x = area.arcXAt(y);
    if (x >= left - 1 && x <= right + 1) pts.push([Math.max(x, left), y]);
  }

  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
}

export function computeCPUA(viewport, arcParams, magnifier, { logoBounds = null } = {}) {
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const SSd = viewport.SSd ?? Math.min(width, height);
  const magY = magnifier?.y ?? magnifier?.cy ?? 0;
  const hubX = arcParams?.hubX ?? width * 2;
  const hubY = arcParams?.hubY ?? 0;
  const radius = arcParams?.radius ?? width * 2;

  const left = CPUA_SPEC.LEFT;
  const top = SSd * CPUA_SPEC.TOP_RATIO;
  const right = width - SSd * CPUA_SPEC.RIGHT_MARGIN_RATIO;
  // The control deck's ceiling is the usable area's floor.
  const bottom = Math.min(
    height - SSd * 0.02,
    magY - SSd * CPUA_SPEC.DECK_CLEARANCE_RATIO
  );

  // Padded logo notch: fence and law share the same padded rectangle.
  // If the strip between the logo and the right edge is too thin to seat
  // anything (the useless peninsula, Howell 2026-07-19), the notch annexes
  // it to the edge.
  let paddedLogo = logoBounds
    ? {
      left: logoBounds.left - SSd * CPUA_SPEC.LOGO_PAD_LEFT_RATIO,
      top: logoBounds.top,
      right: logoBounds.right,
      bottom: logoBounds.bottom + SSd * CPUA_SPEC.LOGO_PAD_BOTTOM_RATIO
    }
    : null;
  if (paddedLogo && right - paddedLogo.right < SSd * 0.1) {
    paddedLogo = { ...paddedLogo, right: width };
  }

  // The tapered arc: margin interpolates top→deck by height.
  const marginAt = y => {
    const t = Math.max(0, Math.min(1, (y - top) / Math.max(bottom - top, 1)));
    return SSd * (CPUA_SPEC.ARC_MARGIN_TOP_RATIO
      + t * (CPUA_SPEC.ARC_MARGIN_BOTTOM_RATIO - CPUA_SPEC.ARC_MARGIN_TOP_RATIO));
  };
  const arcInnerAt = y => radius - marginAt(y);
  const arcXAt = y => {
    const aI = arcInnerAt(y);
    const t = aI * aI - (y - hubY) * (y - hubY);
    return t > 0 ? hubX - Math.sqrt(t) : Infinity;
  };

  return {
    left,
    top,
    right,
    rightFull: right, // legacy alias (star-field centroid math)
    bottom,
    hubX,
    hubY,
    marginAt,
    arcInnerAt,
    arcXAt,
    logoBounds: paddedLogo,
    /**
     * The single membership test: may a mark of half-size `inset` sit at
     * (x, y)? Rect, tapered arc, and logo in one verdict. (No vessel — the
     * control deck floor subsumes the magnifier's territory.)
     */
    contains(x, y, inset = 0) {
      if (x < left + inset || x > right - inset) return false;
      if (y < top + inset || y > bottom - inset) return false;
      if (Math.hypot(x - hubX, y - hubY) > arcInnerAt(y) - inset) return false;
      if (paddedLogo
        && x > paddedLogo.left - inset && x < paddedLogo.right + inset
        && y > paddedLogo.top - inset && y < paddedLogo.bottom + inset) return false;
      return true;
    }
  };
}
