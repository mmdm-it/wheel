import { getArcParameters, getMagnifierAngle, getViewportWindow, getNodeSpacing } from './focus-ring-geometry.js';

export const DEFAULT_ARCS = [
  { name: 'inner', radiusRatio: 0.65, weight: 0.3 },
  { name: 'middle', radiusRatio: 0.75, weight: 0.4 },
  { name: 'outer', radiusRatio: 0.85, weight: 0.3 }
];

const toRadians = deg => (deg * Math.PI) / 180;

export function calculatePyramidCapacity(viewport, options = {}) {
  const arcs = options.arcs ?? DEFAULT_ARCS;
  const minAngularSpacing = toRadians(options.minAngularSpacingDeg ?? 8);
  const nodeRadius = options.nodeRadius ?? 12;
  const nodeGap = options.nodeGap ?? 8;
  const { radius, hubX, hubY } = getArcParameters(viewport);
  const nodeSpacing = options.nodeSpacing ?? getNodeSpacing(viewport);
  const magnifierAngle = options.magnifierAngle ?? getMagnifierAngle(viewport);
  const cornerAngle = magnifierAngle;
  const angularRange = Math.max(0, Math.PI - cornerAngle); // magnifier -> 180deg
  const nodeSpan = nodeRadius * 2 + nodeGap;

  const capacityPerArc = arcs.map(arc => {
    const arcLength = arc.radiusRatio * radius * angularRange;
    const physical = Math.max(0, Math.floor(arcLength / nodeSpan));
    const angular = Math.max(0, Math.floor(angularRange / minAngularSpacing));
    const capacity = Math.min(physical, angular);
    return { ...arc, capacity };
  });

  const total = capacityPerArc.reduce((sum, arc) => sum + arc.capacity, 0);

  return {
    arcs: capacityPerArc,
    total,
    angularRange,
    magnifierAngle,
    cornerAngle
  };
}

export function sampleSiblings(siblings, pyramidCapacity) {
  if (!Array.isArray(siblings)) throw new Error('sampleSiblings: siblings must be an array');
  const capacity = Math.max(0, pyramidCapacity ?? siblings.length);
  const total = siblings.length;
  if (capacity === 0) return [];
  if (total <= capacity) return [...siblings];

  const sampled = [];
  const divisor = Math.max(1, capacity - 1);
  for (let i = 0; i < capacity; i += 1) {
    const index = Math.floor((i * (total - 1)) / divisor);
    sampled.push(siblings[index]);
  }
  return sampled;
}

export function getCenterOutwardOrder(count) {
  if (!Number.isInteger(count) || count < 0) throw new Error('getCenterOutwardOrder: count must be non-negative integer');
  if (count === 0) return [];
  const center = Math.floor((count - 1) / 2);
  const order = [center];
  for (let step = 1; order.length < count; step += 1) {
    const left = center - step;
    const right = center + step;
    if (right < count) order.push(right);
    if (left >= 0 && order.length < count) order.push(left);
  }
  return order;
}

const distributeAcrossArcs = (totalNodes, arcs) => {
  if (totalNodes === 0) return arcs.map(arc => ({ ...arc, count: 0 }));
  const capacitySum = arcs.reduce((sum, arc) => sum + (arc.capacity ?? 0), 0);
  const weightSum = arcs.reduce((sum, arc) => sum + (arc.weight ?? 1), 0);
  let remaining = totalNodes;

  return arcs.map((arc, idx) => {
    const cap = arc.capacity ?? Number.POSITIVE_INFINITY;
    const ratio = capacitySum > 0 ? (arc.capacity ?? 0) / capacitySum : (arc.weight ?? 1) / weightSum;
    const desired = idx === arcs.length - 1 ? remaining : Math.max(0, Math.round(totalNodes * ratio));
    const count = Math.min(cap, Math.max(0, Math.min(remaining, desired)));
    remaining -= count;
    return { ...arc, count };
  });
};

export function placePyramidNodes(sampledSiblings, viewport, options = {}) {
    // Debug: log placement coordinates for visibility troubleshooting
    if (typeof window !== 'undefined' && window.localStorage?.debug) {
      setTimeout(() => {
        console.info('[ChildPyramid] placements', placements.map(p => ({ x: p.x, y: p.y, radius: p.radius, angle: p.angle })));
      }, 0);
    }
  const siblings = Array.isArray(sampledSiblings) ? sampledSiblings : [];
  if (siblings.length === 0) return [];

  // Spiral placement, polar coordinates, centered at hub
  const { hubX, hubY, radius: focusRadius } = getArcParameters(viewport);
  const magnifierAngle = getMagnifierAngle(viewport);
  // Spiral center: at (hubX, hubY) plus offset at angle halfway between magnifier and 180°, radius 0.7*focusRadius
  const spiralCenterAngle = (magnifierAngle + Math.PI) / 2;
  // Place spiral center at viewport center (guaranteed visible)
  const spiralCenterX = viewport.width / 2;
  const spiralCenterY = viewport.height / 2;
  const n = siblings.length;
  // Use a fixed node radius and gap based on viewport size for visibility
  const nodeRadius = 0.04 * viewport.SSd;
  const desiredGap = 2.4 * nodeRadius * 2.5;
  // Equidistant spiral: r = a + b*theta, with b chosen so arc length between nodes is desiredGap
  // Approximate: for small angle steps, arc length ≈ sqrt((b*dTheta)^2 + (r*dTheta)^2)
  // We'll use a constant angle increment, but solve for b so that the distance between nodes is desiredGap
  // Start spiral at 0.5 turn offset
  // Archimedean spiral: r = b * theta
  // Find b so spiral fits well in viewport
  const maxTurns = 2.5;
  const maxTheta = maxTurns * 2 * Math.PI;
  const b = (0.38 * Math.min(viewport.width, viewport.height)) / maxTheta;

  let angle = Math.PI; // start after half a turn
  let r = b * angle;
  let prevX = spiralCenterX + r * Math.cos(spiralCenterAngle + angle);
  let prevY = spiralCenterY + r * Math.sin(spiralCenterAngle + angle);

  const placements = [];
  let x, y;
  for (let i = 0; i < n; i++) {
    r = b * angle;
    x = spiralCenterX + r * Math.cos(spiralCenterAngle + angle);
    y = spiralCenterY + r * Math.sin(spiralCenterAngle + angle);
    placements.push({
      item: siblings[i],
      x,
      y,
      angle: spiralCenterAngle + angle,
      arc: 'spiral',
      radius: nodeRadius
    });
    // For the next node, find the angle so that the distance to the previous node is exactly desiredGap
    if (i < n - 1) {
      let nextAngle = angle + 0.01;
      while (true) {
        const nextR = b * nextAngle;
        const nextX = spiralCenterX + nextR * Math.cos(spiralCenterAngle + nextAngle);
        const nextY = spiralCenterY + nextR * Math.sin(spiralCenterAngle + nextAngle);
        const dist = Math.sqrt((nextX - x) ** 2 + (nextY - y) ** 2);
        if (dist >= desiredGap) break;
        nextAngle += 0.01;
        // Prevent infinite loop if spiral is too tight
        if (nextAngle - angle > 0.5) break;
      }
      angle = nextAngle;
    }
  }

  return placements;
}
