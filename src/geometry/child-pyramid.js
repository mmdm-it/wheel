import { getArcParameters, getMagnifierAngle, getMagnifierPosition, getViewportWindow, getNodeSpacing } from './focus-ring-geometry.js';

export const DEFAULT_ARCS = [
  { name: 'inner', radiusRatio: 0.65, weight: 0.3 },
  { name: 'middle', radiusRatio: 0.75, weight: 0.4 },
  { name: 'outer', radiusRatio: 0.85, weight: 0.3 }
];

const toRadians = deg => (deg * Math.PI) / 180;

// Spiral parameters (adjustable via console)
let spiralConfig = {
  expansionRate: 0.03,  // Controls how quickly spiral expands radially (b parameter)
  gapMultiplier: 3  // Spacing between nodes (multiple of node diameter)
};

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

  // Calculate CPUA (Child Pyramid Usable Area) bounds
  const { hubX, hubY, radius: focusRadius } = getArcParameters(viewport);
  const magnifierAngle = getMagnifierAngle(viewport);
  const magnifierPos = getMagnifierPosition(viewport);
  
  // CPUA boundaries
  const SSd = viewport.SSd;
  const topMargin = SSd * 0.03;
  const rightMargin = SSd * 0.03;
  const MAGNIFIER_RADIUS_RATIO = 0.060;
  const magnifierRadius = SSd * MAGNIFIER_RADIUS_RATIO;
  
  // Get logo bounds if available (volume-specific)
  const logoBounds = options.logoBounds || null;
  
  const cpuaTopY = topMargin;
  const cpuaRightXFull = viewport.width - rightMargin;  // Full width for spiral center calculation
  const cpuaBottomY = Math.min(viewport.height, magnifierPos.y - (1.5 * magnifierRadius));
  const cpuaLeftX = 0;
  
  // Crop right edge for boundary checking if logo is present
  const cpuaRightX = logoBounds 
    ? Math.min(cpuaRightXFull, logoBounds.left - rightMargin)
    : cpuaRightXFull;
  
  // CPUA center: use full width (ignore logo) for spiral center to keep it stable
  const cpuaCenterX = (cpuaLeftX + cpuaRightXFull) / 2;
  const cpuaCenterY = (cpuaTopY + cpuaBottomY) / 2;
  
  // Shift spiral center slightly right (10% of full CPUA width)
  const spiralCenterX = cpuaCenterX + ((cpuaRightXFull - cpuaLeftX) * 0.1);
  const spiralCenterY = cpuaCenterY;
  const spiralCenterAngle = (magnifierAngle + Math.PI) / 2;
  
  const n = siblings.length;
  // Use a fixed node radius and gap based on viewport size for visibility
  const nodeRadius = 0.04 * viewport.SSd;
  const desiredGap = spiralConfig.gapMultiplier * nodeRadius * 2;
  // Archimedean spiral: r = b*theta
  // Controls how quickly the spiral expands radially
  const b = spiralConfig.expansionRate * viewport.SSd;

  // Arc length from theta0 to theta1 for Archimedean spiral (a=0):
  function spiralArcLength(b, theta0, theta1) {
    function F(x) {
      return x * Math.sqrt(x * x + b * b) + b * b * Math.log(x + Math.sqrt(x * x + b * b));
    }
    return (F(b * theta1) - F(b * theta0)) / (2 * b);
  }

  // Find theta2 so that arc length from theta1 to theta2 is desiredGap
  function findNextTheta(b, theta1, gap) {
    let low = theta1, high = theta1 + 2 * Math.PI;
    while (high - low > 1e-6) {
      let mid = (low + high) / 2;
      let s = spiralArcLength(b, theta1, mid);
      if (s < gap) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  }

  let angle = Math.PI; // start after half a turn
  // Helper function to check if point is within logo exclusion area
  function isInLogoExclusion(x, y) {
    if (!logoBounds) return false;
    return x >= logoBounds.left && x <= logoBounds.right &&
           y >= logoBounds.top && y <= logoBounds.bottom;
  }

  const placements = [];
  let skipped = 0;
  for (let i = 0; i < n; i++) {
    const r = b * angle;
    const x = spiralCenterX + r * Math.cos(spiralCenterAngle + angle);
    const y = spiralCenterY + r * Math.sin(spiralCenterAngle + angle);
    
    // Check if node center is within logo exclusion square
    if (isInLogoExclusion(x, y)) {
      // Skip this position, advance to next theta
      skipped++;
      angle = findNextTheta(b, angle, desiredGap);
      i--; // Don't consume a sibling for this position
      
      // Safety: prevent infinite loop if we can't find valid positions
      if (skipped > n * 10) {
        console.warn('[ChildPyramid] Too many skipped positions, stopping placement');
        break;
      }
      continue;
    }
    
    placements.push({
      item: siblings[i],
      x,
      y,
      angle: spiralCenterAngle + angle,
      arc: 'spiral',
      radius: nodeRadius
    });
    if (i < n - 1) {
      angle = findNextTheta(b, angle, desiredGap);
    }
  }

  return placements;
}

// Console API for spiral adjustment
if (typeof window !== 'undefined') {
  window.setSpiralExpansion = function(rate) {
    spiralConfig.expansionRate = rate;
    console.log(`Spiral expansion rate set to ${rate}`);
    // Trigger re-render if app exists
    if (window.app?.choreographer) {
      window.app.choreographer.onRender(window.app.choreographer.getRotation());
    }
  };

  window.setSpiralGap = function(multiplier) {
    spiralConfig.gapMultiplier = multiplier;
    console.log(`Spiral gap multiplier set to ${multiplier}`);
    // Trigger re-render if app exists
    if (window.app?.choreographer) {
      window.app.choreographer.onRender(window.app.choreographer.getRotation());
    }
  };

  window.getSpiralConfig = function() {
    console.log('Current spiral configuration:', spiralConfig);
    return spiralConfig;
  };
}
