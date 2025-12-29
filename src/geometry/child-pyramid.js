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
  const siblings = Array.isArray(sampledSiblings) ? sampledSiblings : [];
  if (siblings.length === 0) return [];

  // Cartesian grid placement, origin at top-left
  const gap = 0.18 * viewport.SSd;
  const nodeCount = siblings.length;
  // Try to make a nearly square grid
  const cols = Math.ceil(Math.sqrt(nodeCount));
  const rows = Math.ceil(nodeCount / cols);
  const offsetX = 0.2 * viewport.SSd;
  const offsetY = 0.2 * viewport.SSd;

  const placements = [];
  for (let i = 0; i < nodeCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = offsetX + col * gap;
    const y = offsetY + row * gap;
    placements.push({
      item: siblings[i],
      x,
      y,
      // Provide dummy values for compatibility
      angle: 0,
      arc: 'cartesian',
      radius: gap * 0.4 // or a default node radius
    });
  }

  return placements;
}
