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

import { computeCPUA } from './usable-areas.js';

const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5077640°

// Label font growth is DAMPED above 1: a 1.45x star wears a ~1.22x label —
// prominence reads just as clearly, spills far less (the GENESIS-over-PR
// crowding, 2026-07-19). Below 1 the font tracks the star exactly, so the
// smudge floor stays an honest smudge. Shared by geometry (label room) and
// the render (labelFontPx) — one definition, no divergence.
export const dampLabelScale = s => (s >= 1 ? 1 + (s - 1) * 0.5 : s);

// Distance from point (px,py) to segment (x1,y1)-(x2,y2).
function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const NODE_RADIUS_RATIO = 0.04;   // matches the render's pyramid node size
const FILL_FRACTION = 0.55;       // how much of the usable area the field aims to cover
const MIN_SPACING_RADII = 2.3;    // min center-to-center distance, in node radii
const FAN_SEP_DEG = 8;            // min angle between fan lines at the magnifier
                                  // (aesthetic: the fan must FAN — Howell 2026-07-19)
// Region margins live in usable-areas.js — THE canonical CPUA (Howell
// 2026-07-19: firm boundaries, standard canvas; no local margins).
const LABEL_BAND_CLEARANCE_RATIO = 0.1; // TEXT-specific: labels may sit
                                        // closer to the band than nodes

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
  // Per-seat size scales (editorial prominence): seat i's star draws at
  // nodeR * sizeScales[i]. Spacing and edge insets honor the true sizes.
  const sizeScales = Array.isArray(options.sizeScales) ? options.sizeScales : [];
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
    sizeScales.join(','),
    options.labelBaseFontPx ?? '',
    logoBounds ? `${logoBounds.left},${logoBounds.top},${logoBounds.right},${logoBounds.bottom}` : ''
  ].join('|');
  if (cacheKey === _geoCacheKey) return _geoCacheValue;

  // ── THE canonical CPUA (usable-areas.js) — rect, arc, logo, vessel ───
  const cpua = computeCPUA(viewport, arcParams, magnifier, { logoBounds });
  const arcRadius = arcParams?.radius ?? SSd;
  const hubX = cpua.hubX;
  const hubY = cpua.hubY;

  const nodeR = NODE_RADIUS_RATIO * SSd;
  const minSpacing = nodeR * MIN_SPACING_RADII;
  const LSd = viewport.LSd ?? Math.max(width, height);
  // Pyramid label metrics: base font supplied by the caller (resolution-
  // aware), middle-anchored on the star, half the label to each side. Glyph
  // advance measured from a real render: UPPERCASE Montserrat ≈0.85em.
  const labelBaseFontPx = options.labelBaseFontPx
    ?? Math.min(Math.max(14, 0.016 * LSd), 26);
  const charWidth = labelBaseFontPx * 0.85;
  const edgeMargin = SSd * 0.02;

  // A candidate must be a member of the canonical CPUA (one verdict: rect,
  // arc — LAW, never relaxes — logo, vessel), then satisfy the engine's own
  // laws: label endpoints, spacing, fan separation.
  const isValid = (x, y, placed, relax = 1, labelHalf = 0, scale = 1, fanRelax = 1) => {
    const rSelf = nodeR * scale;
    if (!cpua.contains(x, y, rSelf)) return false;
    // A star's own label must fit. Labels are ROTATED along the hub ray
    // (middle-anchored), so the constraint is the two baseline ENDPOINTS,
    // not horizontal width (the first, horizontal-only rule let a long
    // label near the ring run its outward half across the band — Moto g
    // screenshot, 2026-07-19): both ends inside the viewport, and the
    // outward end short of the focus-ring band.
    let labelSeg = null;
    if (labelHalf) {
      const ldx = x - hubX;
      const ldy = y - hubY;
      const ld = Math.hypot(ldx, ldy) || 1;
      if (ld + labelHalf > arcRadius - SSd * LABEL_BAND_CLEARANCE_RATIO) return false; // band is law for text too
      const lux = ldx / ld;
      const luy = ldy / ld;
      labelSeg = {
        x1: x + lux * labelHalf, y1: y + luy * labelHalf,
        x2: x - lux * labelHalf, y2: y - luy * labelHalf
      };
      for (const [ex, ey] of [[labelSeg.x1, labelSeg.y1], [labelSeg.x2, labelSeg.y2]]) {
        if (ex < edgeMargin || ex > width - edgeMargin) return false;
        if (ey < edgeMargin || ey > height - edgeMargin) return false;
      }
      // The WHOLE baseline stays out of the logo notch — endpoint checks
      // let CALENDARIUM GREGORIANUM lie across the artwork (2026-07-19).
      if (cpua.logoBounds) {
        const lb = cpua.logoBounds;
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const sx = labelSeg.x2 + (labelSeg.x1 - labelSeg.x2) * t;
          const sy = labelSeg.y2 + (labelSeg.y1 - labelSeg.y2) * t;
          if (sx > lb.left && sx < lb.right && sy > lb.top && sy < lb.bottom) return false;
        }
      }
    }
    const candAngle = Math.atan2(y - magnifierY, x - magnifierX);
    const labelPad = nodeR * 0.35;
    for (const p of placed) {
      // Pairwise spacing on TRUE radii: a featured star and its neighbor
      // need (rA + rB) x the spacing factor, not the uniform default.
      const pairSpacing = nodeR * (MIN_SPACING_RADII / 2) * (scale + (p.scale ?? 1));
      if (Math.hypot(x - p.x, y - p.y) < pairSpacing * relax) return false;
      // Labels are citizens of the collision law (GENESIS lay across PR):
      // my label must clear your star; my star must clear your label.
      if (labelSeg
        && pointSegDist(p.x, p.y, labelSeg.x1, labelSeg.y1, labelSeg.x2, labelSeg.y2)
           < nodeR * (p.scale ?? 1) + labelPad) return false;
      if (p.labelSeg
        && pointSegDist(x, y, p.labelSeg.x1, p.labelSeg.y1, p.labelSeg.x2, p.labelSeg.y2)
           < rSelf + labelPad) return false;
      // Fan lines share the magnifier origin; without an angular floor,
      // near-collinear stars stack their lines into one thick stroke.
      let da = Math.abs(candAngle - Math.atan2(p.y - magnifierY, p.x - magnifierX));
      if (da > Math.PI) da = 2 * Math.PI - da;
      // The floor bends with its own ladder, and the FINAL rung drops it
      // entirely — seating every child outranks fanning (a floor at any
      // strength halves greedy packing in cramped cases). Label legibility
      // over line bundles is the HALO's job (styles), not angles': 28
      // lines in ~90° of fan cannot exceed ~3° separation by arithmetic.
      if (fanRelax > 0 && da < fanSepRad * fanRelax) return false;
    }
    return { labelSeg };
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
  // UNIVERSAL fan floor (Howell 2026-07-19, resurrecting the old engine's
  // min-angle rule): every sky gets FAN_SEP_DEG or a fair share of the
  // span, whichever is smaller. An earlier universal floor starved big
  // sets — but that predates densify-and-rescatter, whose denser candidate
  // streams can fill the fragmented angular gaps. Labels crossing bundled
  // near-parallel lines (GENESIS) were the legibility cost of exempting
  // dense skies.
  const fanSepRad = Math.min(
    FAN_SEP_DEG * (Math.PI / 180),
    regionSpan / Math.max(childCount + 1, 1)
  );

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
    for (const [relax, fanRelax] of [[1, 1], [0.8, 0.8], [0.6, 0.6], [0.45, 0.45], [0.3, 0.3], [0.3, 0]]) {
      if (intersections.length >= childCount) break;
      for (let k = 1; k <= maxK && intersections.length < childCount; k += 1) {
        const r = cCur * Math.sqrt(k);
        const a = phase + k * GOLDEN_ANGLE_RAD;
        const x = centerX + r * Math.cos(a);
        const y = centerY + r * Math.sin(a);
        const seat = intersections.length;
        const scale = sizeScales[seat] ?? 1;
        // Label room follows the DAMPED font scale (what will be rendered).
        const labelHalf = ((labelLengths[seat] ?? 0) * charWidth * dampLabelScale(scale)) / 2;
        const ok = isValid(x, y, intersections, relax, labelHalf, scale, fanRelax);
        if (!ok) continue;
        intersections.push({ x, y, k, fanId: seat, scale, labelSeg: ok.labelSeg });
      }
    }
    if (intersections.length >= childCount) break;
    // The densify floor follows the SMALLEST star in the set: a tapered
    // smudge tier (0.3x) can seat on a 0.3x candidate grid — stopping at
    // the full-size spacing capped overloaded skies at ~22 seats.
    const minScale = sizeScales.length
      ? Math.min(...sizeScales.slice(0, childCount).map(v => v || 1))
      : 1;
    if (cCur <= minSpacing * minScale) break; // densest honest field — take what seats
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
