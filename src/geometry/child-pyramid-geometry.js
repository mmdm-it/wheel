// Computes CPUA fan lines, spiral path, and intersection hits for the child pyramid.
// Pure functions: no DOM usage.

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_LINE_COUNT = 96;
const DEFAULT_ANGLE_DELTA_DEG = 3.75; // matches existing layout
const DEFAULT_EXPANSION_RATE = 0.005; // r = b * theta factor

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

export function computeChildPyramidGeometry(viewport = {}, magnifier = {}, arcParams = {}, options = {}) {
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const SSd = viewport.SSd ?? Math.min(width, height);
  const LSd = viewport.LSd ?? Math.max(width, height);
  const topMargin = SSd * 0.03;
  const rightMargin = SSd * 0.03;
  const magnifierRadius = SSd * 0.060;
  const magnifierX = magnifier.cx ?? magnifier.x ?? 0;
  const magnifierY = magnifier.cy ?? magnifier.y ?? 0;

  const cpua = {
    left: 0,
    top: topMargin,
    rightFull: width - rightMargin,
    right: width - rightMargin,
    bottom: Math.min(height, magnifierY - (4 * magnifierRadius))
  };

  const clipCircle = {
    cx: arcParams?.hubX ?? width / 2,
    cy: arcParams?.hubY ?? 0,
    r: (arcParams?.radius ?? SSd) * 0.98
  };

  const lineCount = options.lineCount ?? DEFAULT_LINE_COUNT;
  const angleDeltaRad = (options.angleDeltaDeg ?? DEFAULT_ANGLE_DELTA_DEG) * DEG_TO_RAD;
  const spiralOriginX = width / 2 + (width * 0.1);
  const spiralOriginY = SSd * 0.03 + Math.min(height, magnifierY - (1.5 * magnifierRadius)) / 2;
  const startAngleRad = Math.atan2(spiralOriginY - magnifierY, spiralOriginX - magnifierX);
  const lineLength = LSd || 1000;

  const fanLines = [];
  for (let i = 0; i < lineCount; i++) {
    const angleRad = startAngleRad + i * angleDeltaRad;
    const endX = magnifierX + Math.cos(angleRad) * lineLength;
    const endY = magnifierY + Math.sin(angleRad) * lineLength;
    const clipped = clipFanLine(magnifierX, magnifierY, endX, endY, cpua, clipCircle, options.logoBounds ?? null);
    if (clipped) {
      fanLines.push({ id: i, x1: magnifierX, y1: magnifierY, x2: clipped.x, y2: clipped.y });
    }
  }

  const expansionRate = typeof options.spiralExpansion === 'number' ? options.spiralExpansion : DEFAULT_EXPANSION_RATE;
  const b = expansionRate * SSd; // r = b * theta
  const spiralCenterAngle = ((options.magnifierAngle ?? magnifier.angle ?? 0) + Math.PI) / 2;
  const spiralCenterX = (cpua.left + cpua.rightFull) / 2 + ((cpua.rightFull - cpua.left) * 0.1);
  const spiralCenterY = (cpua.top + cpua.bottom) / 2;

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

  const intersections = [];
  const minHitDistance = (0.04 * SSd) * 4; // 4× node radius assumption
  const pending = new Set(fanLines.map(f => f.id));
  for (let i = 1; i < points.length && pending.size > 0; i++) {
    const segSpiral = { x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y };
    fanLines.forEach(segFan => {
      if (!pending.has(segFan.id)) return;
      const hit = intersectSegments(segSpiral, segFan);
      if (hit) {
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

  return {
    cpua,
    fanLines,
    spiral: { path: spiralPath, points },
    intersections
  };
}
