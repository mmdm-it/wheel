// Child pyramid STAR FIELD placement (C.5, Howell 2026-07-19).
//
// A golden-angle (sunflower/Vogel) scatter replaces the ray x spiral
// intersection engine. Node k sits at angle k*GOLDEN + phase, radius
// c*sqrt(k) from the CPUA center; positions failing the region tests are
// skipped and the walk continues until every child has a star.
//
// The scatter keeps everything the old engine was FOR (Howell's stated
// intent) and sheds what it merely happened to do:
//   - scattershot that reads as random, with uniform density (golden-angle
//     points never align into spokes or rings);
//   - deterministic and unique per parent: phase = sortNumber * GOLDEN,
//     the irrational multiplier guaranteeing no two parents share a sky;
//   - the DANCE: rotating the focus ring changes the magnified parent,
//     the phase, and thus the whole constellation — the background motion
//     that makes rotation legible;
//   - fan lines cannot cross by construction — they share one origin;
//   - radius is monotonic in k, so sibling order maps to CENTRALITY: the
//     first children sit centermost (the prominence axis, free);
//   - no starvation: rejection sampling walks k until childCount stars are
//     placed (the old hunt could yield 3 slots for 12 children).
//
// Pure module: geometry in, geometry out; no DOM access. Memoized in a
// single slot — render calls it every frame during rotation and the inputs
// only change when the magnified parent does.

const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5077640°

const NODE_RADIUS_RATIO = 0.04;   // matches the render's pyramid node size
const FILL_FRACTION = 0.55;       // how much of the usable area the field aims to cover
const MIN_SPACING_RADII = 2.3;    // min center-to-center distance, in node radii
const FAN_SEP_DEG = 8;            // min angle between fan lines at the magnifier
                                  // (aesthetic: the fan must FAN — Howell 2026-07-19)
// Region margins (Howell's eye, 2026-07-19, two rounds of tuning):
// bottom ruled correct at the first cut; top and arc split the difference
// between the original values and the first cut.
const TOP_MARGIN_RATIO = 0.115;   // original 0.05, first cut 0.18 — split
const ARC_MARGIN_RATIO = 0.225;   // original 0.35, first cut 0.10 — split
const BOTTOM_DROP_RATIO = 0.30;   // below magnifier latitude — ruled correct

let _geoCacheKey = null;
let _geoCacheValue = null;

export function computeChildPyramidGeometry(viewport = {}, magnifier = {}, arcParams = {}, options = {}) {
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const SSd = viewport.SSd ?? Math.min(width, height);
  const magnifierX = magnifier.cx ?? magnifier.x ?? 0;
  const magnifierY = magnifier.cy ?? magnifier.y ?? 0;
  const childCount = options.childCount ?? 0;
  const parentSortNumber = options.parentSortNumber ?? 0;
  const labelLengths = Array.isArray(options.labelLengths) ? options.labelLengths : [];
  const logoBounds = options.logoBounds ?? null;
  const hasDimButton = options.hasDimensionButton ?? true;

  const scaleMul = (typeof globalThis !== 'undefined' && globalThis.__starScaleMul != null)
    ? globalThis.__starScaleMul
    : 1;

  const cacheKey = [
    width, height, SSd, magnifierX, magnifierY,
    arcParams?.hubX, arcParams?.hubY, arcParams?.radius,
    childCount, parentSortNumber, hasDimButton, scaleMul,
    labelLengths.join(','),
    logoBounds ? `${logoBounds.left},${logoBounds.top},${logoBounds.right},${logoBounds.bottom}` : ''
  ].join('|');
  if (cacheKey === _geoCacheKey) return _geoCacheValue;

  // ── CPUA (Child Pyramid Usable Area) ─────────────────────────────────
  const topMargin = SSd * TOP_MARGIN_RATIO;
  const rightMargin = SSd * 0.1;
  const cpuaBottom = hasDimButton
    ? Math.min(height - SSd * 0.05, magnifierY + SSd * BOTTOM_DROP_RATIO)
    : height - SSd * 0.05;
  const cpua = {
    left: 0,
    top: topMargin,
    rightFull: width - rightMargin,
    right: width - rightMargin,
    bottom: cpuaBottom
  };

  const arcRadius = arcParams?.radius ?? SSd;
  const hubX = arcParams?.hubX ?? width / 2;
  const hubY = arcParams?.hubY ?? 0;
  const arcInnerMargin = SSd * ARC_MARGIN_RATIO;

  const nodeR = NODE_RADIUS_RATIO * SSd;
  const minSpacing = nodeR * MIN_SPACING_RADII;
  const LSd = viewport.LSd ?? Math.max(width, height);
  const vesselClearance = SSd * (0.06 + NODE_RADIUS_RATIO + 0.02);
  // Pyramid label metrics: ~1.6vmin font (clamped 14..26px), middle-anchored
  // on the star, half the label to each side. Glyph advance measured from a
  // real render: UPPERCASE Montserrat runs ≈0.85em (0.6em under-measured —
  // Moto g screenshot 2026-07-19, label ran onto the band while 'legal').
  const charWidth = Math.min(Math.max(14, 0.016 * LSd), 26) * 0.85;
  const edgeMargin = SSd * 0.02;

  // A candidate position must sit inside the CPUA (inset so the drawn circle
  // stays inside), outside the logo cutout, comfortably inside the arc, and
  // clear of the magnifier and of already-placed stars.
  const isValid = (x, y, placed, relax = 1, labelHalf = 0) => {
    if (x < cpua.left + nodeR || x > cpua.right - nodeR) return false;
    // A star's own label must fit. Labels are ROTATED along the hub ray
    // (middle-anchored), so the constraint is the two baseline ENDPOINTS,
    // not horizontal width (the first, horizontal-only rule let a long
    // label near the ring run its outward half across the band — Moto g
    // screenshot, 2026-07-19): both ends inside the viewport, and the
    // outward end short of the focus-ring band.
    if (labelHalf) {
      const ldx = x - hubX;
      const ldy = y - hubY;
      const ld = Math.hypot(ldx, ldy) || 1;
      if (ld + labelHalf > arcRadius - SSd * 0.1) return false; // band is law for text too
      const lux = ldx / ld;
      const luy = ldy / ld;
      for (const sign of [1, -1]) {
        const ex = x + sign * lux * labelHalf;
        const ey = y + sign * luy * labelHalf;
        if (ex < edgeMargin || ex > width - edgeMargin) return false;
        if (ey < edgeMargin || ey > height - edgeMargin) return false;
      }
    }
    if (y < cpua.top + nodeR || y > cpua.bottom - nodeR) return false;
    if (logoBounds
      && x > logoBounds.left - nodeR && x < logoBounds.right + nodeR
      && y > logoBounds.top - nodeR && y < logoBounds.bottom + nodeR) return false;
    // The arc margin is LAW — it never relaxes. (It briefly did, and the
    // overflow stars of big chapter sets crept up against the ring band —
    // Howell's screenshots, 2026-07-19.) Only star-to-star spacing bends.
    if (Math.hypot(x - hubX, y - hubY) > arcRadius - arcInnerMargin) return false;
    // The magnifier is sacrosanct: with the CPUA floor below its latitude,
    // it needs an exclusion zone (vessel radius + node radius + breathing
    // room). The parent button needs none — it lies outside the CPUA
    // (Howell 2026-07-19).
    if (Math.hypot(x - magnifierX, y - magnifierY) < vesselClearance) return false;
    const candAngle = Math.atan2(y - magnifierY, x - magnifierX);
    for (const p of placed) {
      if (Math.hypot(x - p.x, y - p.y) < minSpacing * relax) return false;
      // Fan lines share the magnifier origin; without an angular floor,
      // near-collinear stars stack their lines into one thick stroke.
      let da = Math.abs(candAngle - Math.atan2(p.y - magnifierY, p.x - magnifierX));
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da < fanSepRad * relax) return false;
    }
    return true;
  };

  // ── Measure the valid region ─────────────────────────────────────────
  // The CPUA rectangle overstates reality — the arc circle (minus its
  // margin) and the logo carve it down, often off-center. A coarse
  // deterministic grid gives the true region's centroid and area, so the
  // scatter is sized for and centered on where stars may actually live.
  const GRID = 24;
  const gw = (cpua.right - cpua.left) / GRID;
  const gh = (cpua.bottom - cpua.top) / GRID;
  let cellCount = 0;
  let sumX = 0;
  let sumY = 0;
  for (let gy = 0; gy < GRID; gy += 1) {
    for (let gx = 0; gx < GRID; gx += 1) {
      const x = cpua.left + (gx + 0.5) * gw;
      const y = cpua.top + (gy + 0.5) * gh;
      if (!isValid(x, y, [])) continue;
      cellCount += 1;
      sumX += x;
      sumY += y;
    }
  }
  const centerX = cellCount ? sumX / cellCount : (cpua.left + cpua.rightFull) / 2;
  const centerY = cellCount ? sumY / cellCount : (cpua.top + cpua.bottom) / 2;
  const usableArea = Math.max(1, cellCount * gw * gh);

  // c sizes the field so childCount stars cover ~FILL_FRACTION of the true
  // area; clamped so stars can never be forced closer than their spacing.
  const c = Math.max(
    Math.sqrt((FILL_FRACTION * usableArea) / (Math.PI * Math.max(childCount, 1))),
    minSpacing
  ) * scaleMul;

  const phase = parentSortNumber * GOLDEN_ANGLE_RAD; // the dance

  // Adaptive fan-line floor: 8° reads as a fan, but 26 chapters cannot each
  // claim 8° of the ~90° the magnifier actually sees — so the floor is the
  // smaller of FAN_SEP_DEG and a fair share of the region's angular span.
  const cornerAngles = [
    [cpua.left, cpua.top], [cpua.right, cpua.top],
    [cpua.left, cpua.bottom], [cpua.right, cpua.bottom]
  ].map(([cx2, cy2]) => Math.atan2(cy2 - magnifierY, cx2 - magnifierX));
  let regionSpan = 0;
  for (let i = 0; i < cornerAngles.length; i += 1) {
    for (let j = i + 1; j < cornerAngles.length; j += 1) {
      let da = Math.abs(cornerAngles[i] - cornerAngles[j]);
      if (da > Math.PI) da = 2 * Math.PI - da;
      regionSpan = Math.max(regionSpan, da);
    }
  }
  // The floor only governs SMALL families — that's where three near-collinear
  // lines read as one stroke. Dense skies (chapters, verses) legitimately
  // pack their fans tight, and an angular floor there fights the scatter's
  // packing order and starves placement.
  const fanSepRad = childCount <= 12
    ? Math.min(FAN_SEP_DEG * (Math.PI / 180), regionSpan / Math.max(childCount + 1, 1))
    : 0;

  // ── The scatter ──────────────────────────────────────────────────────
  // Walk k outward placing valid stars. If the region can't hold everyone
  // at full spacing, relax spacing progressively for the remainder — a
  // denser sky beats missing children (the old engine's starvation gave 3
  // slots to 12 months). relax=1 first, so roomy layouts are untouched.
  let intersections = [];
  const maxK = Math.max(childCount * 120, 600);
  // k starts at 1, never 0: the k=0 star sits at radius zero — the exact
  // field center, where phase cannot move it — so the FIRST sibling
  // (January, Chapter 1) hung motionless while everything else danced
  // (Howell 2026-07-19). From k=1 every star has a radius for the phase
  // to swing around.
  //
  // If a pass cannot seat everyone, DENSIFY and re-scatter with a smaller
  // radial step. Small families with long labels are the trap: a field
  // sized to spread 2 stars wide has only ~(R/c)^2 in-region candidates,
  // and the label law can veto all but one (the one-testament sky,
  // 2026-07-19). Densifying multiplies candidates; first pass keeps the
  // roomy layout wherever it suffices.
  for (let cCur = c; ; cCur *= 0.65) {
    intersections = [];
    for (const relax of [1, 0.8, 0.6, 0.45, 0.3]) {
      if (intersections.length >= childCount) break;
      for (let k = 1; k <= maxK && intersections.length < childCount; k += 1) {
        const r = cCur * Math.sqrt(k);
        const a = phase + k * GOLDEN_ANGLE_RAD;
        const x = centerX + r * Math.cos(a);
        const y = centerY + r * Math.sin(a);
        const labelHalf = ((labelLengths[intersections.length] ?? 0) * charWidth) / 2;
        if (!isValid(x, y, intersections, relax, labelHalf)) continue;
        intersections.push({ x, y, k, fanId: intersections.length });
      }
    }
    if (intersections.length >= childCount) break;
    if (cCur <= minSpacing) break; // densest honest field — take what seats
  }

  // ── At-least-one guarantee ───────────────────────────────────────────
  // Tapping ANY node migrates the complete sibling set, so a single star
  // guarantees access to everything. If even the relaxed walk placed
  // nothing (a truly crushed viewport), take the region centroid.
  if (childCount > 0 && intersections.length === 0) {
    intersections.push({ x: centerX, y: centerY, k: 0, fanId: null, synthetic: true });
  }

  // Fan lines are presentational (magnifier → each star); the view draws
  // its own connectors from magnifierOrigin, these serve diagnostics and
  // shape-compatibility. They cannot cross: one shared origin.
  const fanLines = intersections.map((p, i) => ({
    id: i, x1: magnifierX, y1: magnifierY, x2: p.x, y2: p.y
  }));

  const result = {
    cpua,
    fanLines,
    spiral: { path: '', points: [] }, // retired with the ray×spiral engine
    intersections,
    magnifierOrigin: { x: magnifierX, y: magnifierY }
  };
  _geoCacheKey = cacheKey;
  _geoCacheValue = result;
  return result;
}
