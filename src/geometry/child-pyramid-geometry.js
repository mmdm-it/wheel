// Computes CPUA fan lines, spiral path, and intersection hits for the child pyramid.
// Pure functions: no DOM usage, no side effects on import. Dev-time console
// tuning knobs live in ./pyramid-tuning-knobs.js (view layer imports them);
// this module only READS the globalThis.__* overrides they set.

const DEG_TO_RAD = Math.PI / 180;

// ── Child-count → parameter lookup table ─────────────────────────────
// Source: docs/child_pyramid_params.csv
// Rows keyed by maxChildren (inclusive). Last row (Infinity) is the catch-all.
// Console knobs override these values when set.
const CHILD_PARAM_TABLE = [
  { maxChildren:  2, arcMargin: 0.4, fanAngle: 17,   minNodeDist: 7,   spiralGrowth: 0.005 },
  { maxChildren:  3, arcMargin: 0.4, fanAngle: 17,   minNodeDist: 7,   spiralGrowth: 0.005 },
  { maxChildren:  4, arcMargin: 0.4, fanAngle: 11,   minNodeDist: 7,   spiralGrowth: 0.005 },
  { maxChildren:  5, arcMargin: 0.4, fanAngle:  7,   minNodeDist: 6,   spiralGrowth: 0.005 },
  { maxChildren:  6, arcMargin: 0.4, fanAngle:  5,   minNodeDist: 6,   spiralGrowth: 0.005 },
  { maxChildren:  7, arcMargin: 0.4, fanAngle:  4,   minNodeDist: 5,   spiralGrowth: 0.005 },
  { maxChildren:  8, arcMargin: 0.4, fanAngle:  3.5, minNodeDist: 5,   spiralGrowth: 0.005 },
  { maxChildren:  9, arcMargin: 0.4, fanAngle:  3.5, minNodeDist: 5,   spiralGrowth: 0.005 },
  { maxChildren: 10, arcMargin: 0.4, fanAngle:  3,   minNodeDist: 4,   spiralGrowth: 0.005 },
  { maxChildren: 11, arcMargin: 0.4, fanAngle:  3,   minNodeDist: 4,   spiralGrowth: 0.005 },
  { maxChildren: 12, arcMargin: 0.4, fanAngle:  2.5, minNodeDist: 3.5, spiralGrowth: 0.005 },
  { maxChildren: Infinity, arcMargin: 0.3, fanAngle: 2, minNodeDist: 3.5, spiralGrowth: 0.025 }
];

function getChildParams(childCount) {
  for (const row of CHILD_PARAM_TABLE) {
    if (childCount <= row.maxChildren) return row;
  }
  return CHILD_PARAM_TABLE[CHILD_PARAM_TABLE.length - 1];
}

function segmentIntervalRect(x1, y1, x2, y2, left, right, top, bottom) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - left, right - x1, y1 - top, bottom - y1];
  for (let i = 0; i < 4; i++) {
    const pi = p[i];
    const qi = q[i];
    if (pi === 0) {
      if (qi < 0) return null;
      continue;
    }
    const t = qi / pi;
    if (pi < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  return { t0, t1 };
}

function segmentIntervalCircle(x1, y1, x2, y2, cx, cy, r) {
  if (!(r > 0)) return { t0: 0, t1: 1 };
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return { t0: 0, t1: 1 };
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  let t0 = (-b - sqrt) / (2 * a);
  let t1 = (-b + sqrt) / (2 * a);
  if (t0 > t1) [t0, t1] = [t1, t0];
  const enter = Math.max(0, t0);
  const exit = Math.min(1, t1);
  if (exit < 0 || enter > 1) return null;
  return { t0: enter, t1: exit };
}

function intersectIntervals(a, b) {
  if (!a || !b) return null;
  const t0 = Math.max(a.t0, b.t0, 0);
  const t1 = Math.min(a.t1, b.t1, 1);
  return t1 >= t0 ? { t0, t1 } : null;
}

function subtractLogoInterval(baseInterval, logoInterval) {
  if (!baseInterval) return [];
  if (!logoInterval) return [baseInterval];
  const { t0, t1 } = baseInterval;
  const { t0: l0, t1: l1 } = logoInterval;
  const segments = [];
  if (l1 <= t0 || l0 >= t1) return [baseInterval];
  if (l0 > t0) segments.push({ t0, t1: Math.min(l0, t1) });
  if (l1 < t1) segments.push({ t0: Math.max(l1, t0), t1 });
  return segments.filter(seg => seg.t1 > seg.t0);
}

function clipFanLine(magX, magY, endX, endY, cpua, clipCircle, logoBounds) {
  const rectInterval = segmentIntervalRect(magX, magY, endX, endY, cpua.left, cpua.right, cpua.top, cpua.bottom);
  const circleInterval = segmentIntervalCircle(magX, magY, endX, endY, clipCircle.cx, clipCircle.cy, clipCircle.r);
  const base = intersectIntervals(rectInterval, circleInterval);
  if (!base) return null;
  const logoInterval = logoBounds
    ? segmentIntervalRect(magX, magY, endX, endY, logoBounds.left, logoBounds.right, logoBounds.top, logoBounds.bottom)
    : null;
  const candidates = subtractLogoInterval(base, logoInterval);
  if (!candidates.length) return null;
  const best = candidates.reduce((acc, cur) => (cur.t1 > acc.t1 ? cur : acc), candidates[0]);
  const { t1 } = best;
  return {
    x: magX + (endX - magX) * t1,
    y: magY + (endY - magY) * t1
  };
}

function buildSpiralPath(points) {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function intersectSegments(a, b) {
  const { x1, y1, x2, y2 } = a;
  const { x1: x3, y1: y3, x2: x4, y2: y4 } = b;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denom === 0) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom; // along spiral
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom; // along fan line
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      t,
      u
    };
  }
  return null;
}

// The spiral + fan-line intersection trace below is heavy, and the render
// loop calls it every frame during a scrub. But its output depends ONLY on
// the geometry inputs and childCount — NOT on rotation or which children map
// onto the slots. So during a scrub through same-size pyramids (e.g. a chain
// whose every node has 12 children) it recomputes an identical result 60x/sec.
// Memoize on the inputs that actually affect the output; a scrub becomes a
// cache hit every frame (iPhone probe 2026-07-17: render self-time 64ms →
// this was the bulk of it). The result is read-only at the call site.
let _geoCacheKey = null;
let _geoCacheValue = null;

function geoKey(viewport, magnifier, arcParams, options) {
  const b = options.logoBounds;
  const bSig = b ? `${b.x},${b.y},${b.width},${b.height}` : '_';
  const knobs = (typeof globalThis !== 'undefined')
    ? `${globalThis.__arcMarginMul ?? '_'},${globalThis.__fanAngleDeg ?? '_'}`
    : '_';
  return [
    viewport.width, viewport.height, viewport.SSd, viewport.LSd,
    magnifier.cx ?? magnifier.x, magnifier.cy ?? magnifier.y,
    arcParams.radius, arcParams.hubX, arcParams.hubY,
    options.childCount ?? 0, options.hasDimensionButton ?? true,
    options.angleDeltaDeg ?? '_', bSig, knobs
  ].join('|');
}

export function computeChildPyramidGeometry(viewport = {}, magnifier = {}, arcParams = {}, options = {}) {
  const cacheKey = geoKey(viewport, magnifier, arcParams, options);
  if (cacheKey === _geoCacheKey) return _geoCacheValue;

  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const SSd = viewport.SSd ?? Math.min(width, height);
  const LSd = viewport.LSd ?? Math.max(width, height);
  const topMargin = SSd * 0.05;
  const rightMargin = SSd * 0.1;
  const magnifierX = magnifier.cx ?? magnifier.x ?? 0;
  const magnifierY = magnifier.cy ?? magnifier.y ?? 0;

  // Look up child-count-dependent parameters (console knobs override)
  const childCount = options.childCount ?? 0;
  const tableParams = getChildParams(childCount);

  // #4: CPUA bottom uses the arc (focus ring) inner edge with a comfortable margin,
  // rather than clearing space for the Dimension Button.
  const arcRadius = arcParams?.radius ?? SSd;
  const hubY = arcParams?.hubY ?? 0;
  const arcMarginMul = (typeof globalThis !== 'undefined' && globalThis.__arcMarginMul != null)
    ? globalThis.__arcMarginMul
    : tableParams.arcMargin;
  const arcInnerMargin = SSd * arcMarginMul;
  // When there's no Dimension Button, allow CPUA to extend to full viewport bottom
  const hasDimButton = options.hasDimensionButton ?? true;
  const cpuaBottom = hasDimButton
    ? Math.min(height - topMargin, magnifierY - SSd * 0.08)
    : height - topMargin;

  const cpua = {
    left: 0,
    top: topMargin,
    rightFull: width - rightMargin,
    right: width - rightMargin,
    bottom: cpuaBottom
  };

  // Clip circle: fan lines extend to the full arc edge
  const clipCircleCx = arcParams?.hubX ?? width / 2;
  const clipCircleCy = hubY;
  const clipCircle = {
    cx: clipCircleCx,
    cy: clipCircleCy,
    r: arcRadius
  };

  const fanOverride = (typeof globalThis !== 'undefined') ? globalThis.__fanAngleDeg : null;
  const angleDeltaDeg = fanOverride ?? options.angleDeltaDeg ?? tableParams.fanAngle;
  const angleDeltaRad = angleDeltaDeg * DEG_TO_RAD;

  // If the magnifier is inside the CPUA, fan lines must sweep a full 360°.
  // Otherwise, compute the angular span of the CPUA corners from the magnifier.
  const magInsideCPUA = magnifierX >= cpua.left && magnifierX <= cpua.rightFull &&
                        magnifierY >= cpua.top  && magnifierY <= cpua.bottom;

  let sweepStart, lineCount, actualAngleDeltaRad;
  if (magInsideCPUA) {
    sweepStart = 0;
    // Snap lineCount so the angle divides 360° evenly — avoids a short
    // remainder gap at the wraparound seam (e.g. 9° gap with 13° delta).
    lineCount = Math.round(360 / angleDeltaDeg);
    actualAngleDeltaRad = (2 * Math.PI) / lineCount;
  } else {
    const cpuaCorners = [
      { x: cpua.left, y: cpua.top },
      { x: cpua.rightFull, y: cpua.top },
      { x: cpua.rightFull, y: cpua.bottom },
      { x: cpua.left, y: cpua.bottom }
    ];
    const cornerAngles = cpuaCorners.map(c => Math.atan2(c.y - magnifierY, c.x - magnifierX));
    const sorted = [...cornerAngles].sort((a, b) => a - b);
    let bestSpan = Infinity;
    let bestStartAngle = sorted[0];
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i];
      let maxSpan = 0;
      for (let j = 0; j < sorted.length; j++) {
        let span = sorted[j] - start;
        if (span < 0) span += 2 * Math.PI;
        if (span > maxSpan) maxSpan = span;
      }
      if (maxSpan < bestSpan) {
        bestSpan = maxSpan;
        bestStartAngle = start;
      }
    }
    sweepStart = bestStartAngle - angleDeltaRad;
    const sweepSpan = bestSpan + 2 * angleDeltaRad;
    lineCount = Math.ceil(sweepSpan / angleDeltaRad) + 1;
    actualAngleDeltaRad = angleDeltaRad;
  }

  // #5: Deterministic fan-line rotation offset based on parent sort number.
  // Formula: (actualFanAngle / π) × sortNumber — the irrational divisor
  // prevents repeating offsets, giving each parent a unique constellation.
  const parentSortNumber = options.parentSortNumber ?? 0;
  const actualAngleDeltaDeg = actualAngleDeltaRad * 180 / Math.PI;
  const rotationOffset = (actualAngleDeltaDeg / Math.PI * parentSortNumber) * DEG_TO_RAD;

  // #1: Spiral origin defaults to the magnifier center
  const so = (typeof globalThis !== 'undefined' && globalThis.__spiralOverride) || {};
  const spiralOriginX = (so.x != null)
    ? cpua.left + so.x * (cpua.rightFull - cpua.left)
    : magnifierX;
  const spiralOriginY = (so.y != null)
    ? cpua.top + so.y * (cpua.bottom - cpua.top)
    : magnifierY;
  const startAngleRad = sweepStart + rotationOffset;
  const lineLength = LSd || 1000;

  const fanLines = [];
  for (let i = 0; i < lineCount; i++) {
    const angleRad = startAngleRad + i * actualAngleDeltaRad;
    const angleDeg = (angleRad * 180 / Math.PI) % 360;
    const endX = magnifierX + Math.cos(angleRad) * lineLength;
    const endY = magnifierY + Math.sin(angleRad) * lineLength;
    const clipped = clipFanLine(magnifierX, magnifierY, endX, endY, cpua, clipCircle, options.logoBounds ?? null);
    if (clipped) {
      fanLines.push({ id: i, x1: magnifierX, y1: magnifierY, x2: clipped.x, y2: clipped.y });
    }
  }

  const growthOverride = (typeof globalThis !== 'undefined') ? globalThis.__spiralGrowth : null;
  const expansionRate = growthOverride ?? (typeof options.spiralExpansion === 'number' ? options.spiralExpansion : tableParams.spiralGrowth);
  const b = expansionRate * SSd; // r = b * theta
  const spiralCenterAngle = ((options.magnifierAngle ?? magnifier.angle ?? 0) + Math.PI) / 2;
  const spiralCenterX = spiralOriginX;
  const spiralCenterY = spiralOriginY;

  const points = [];
  let theta = 0;
  const step = 0.03;
  const maxR = Math.max(width, height) * 1.5;
  const maxTheta = maxR / Math.max(b, 1e-6);
  while (theta <= maxTheta) {
    const r = b * theta;
    const x = spiralCenterX + r * Math.cos(spiralCenterAngle + theta);
    const y = spiralCenterY + r * Math.sin(spiralCenterAngle + theta);
    points.push({ x, y });
    theta += step;
  }

  const spiralPath = buildSpiralPath(points);

  // #3: Minimum distance between nodes — tuneable from console via minNodeDist(mul)
  const baseNodeRadius = 0.04 * SSd;
  const distMul = (typeof globalThis !== 'undefined' && globalThis.__minNodeDistMul != null)
    ? globalThis.__minNodeDistMul
    : tableParams.minNodeDist;
  const minHitDistance = baseNodeRadius * distMul;

  const intersections = [];
  const pending = new Set(fanLines.map(f => f.id));
  // Minimum distance from spiral/magnifier center — reject intersections
  // that land on top of the magnifier (causes visual oscillation).
  const minDistFromOrigin = baseNodeRadius * 3;

  // Shared placement predicate — the ONLY definition of "this point may
  // hold a node" relative to hub margin and magnifier origin. Both the
  // main hunt and the at-least-one fallback use it, so Phase C retuning
  // cannot silently diverge the two (Phase B audit, M7).
  const isValidNodePosition = (p, margin) => {
    if (Math.hypot(p.x - clipCircleCx, p.y - clipCircleCy) > arcRadius - margin) return false;
    if (Math.hypot(p.x - spiralCenterX, p.y - spiralCenterY) < minDistFromOrigin) return false;
    return true;
  };
  for (let i = 1; i < points.length && pending.size > 0; i++) {
    const segSpiral = { x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y };
    fanLines.forEach(segFan => {
      if (!pending.has(segFan.id)) return;
      const hit = intersectSegments(segSpiral, segFan);
      if (hit) {
        if (!isValidNodePosition(hit, arcInnerMargin)) return;

        const tooClose = intersections.some(h => {
          const dx = h.x - hit.x;
          const dy = h.y - hit.y;
          return Math.hypot(dx, dy) < minHitDistance;
        });
        if (!tooClose) {
          intersections.push({ ...hit, fanId: segFan.id });
          pending.delete(segFan.id);
        }
      }
    });
  }

  // ── At-least-one guarantee ───────────────────────────────────────────
  // The pyramid is the only IN path, and tapping ANY node migrates the
  // COMPLETE sibling set to the focus ring — so a single visible node
  // guarantees access to everything. The fan/spiral hunt can starve to
  // zero at some child counts (childCount 4 on phone viewports); when it
  // does, harvest exactly one spiral point under progressively relaxed
  // constraints. Everything beyond one node is presentation, and the
  // pyramid's arrangement is deliberately untouched until the Phase C
  // redesign (see docs/PUNCHLIST.md: stride sampling, planetary cluster).
  if (childCount > 0 && intersections.length === 0) {
    const lb = options.logoBounds ?? null;
    const inLogo = p => lb && p.x >= lb.left && p.x <= lb.right && p.y >= lb.top && p.y <= lb.bottom;
    const inCpua = p => p.x >= cpua.left && p.x <= cpua.right && p.y >= cpua.top && p.y <= cpua.bottom;
    const relaxSteps = [1, 0.6, 0.35, 0.2, 0.1];
    outer:
    for (const relax of relaxSteps) {
      const margin = arcInnerMargin * relax;
      for (let i = 0; i < points.length; i += 4) {
        const p = points[i];
        if (!inCpua(p) || inLogo(p)) continue;
        if (!isValidNodePosition(p, margin)) continue;
        intersections.push({ x: p.x, y: p.y, t: 0, u: 0, fanId: null, synthetic: true });
        break outer;
      }
    }
  }

  const result = {
    cpua,
    fanLines,
    spiral: { path: spiralPath, points },
    intersections,
    magnifierOrigin: { x: magnifierX, y: magnifierY }
  };
  _geoCacheKey = cacheKey;
  _geoCacheValue = result;
  return result;
}
