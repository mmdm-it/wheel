const SELECTION_THRESHOLD = Math.PI / 12; // 15° snapping threshold

export function getViewportInfo(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('getViewportInfo: width/height must be finite numbers');
  }
  const LSd = Math.max(width, height);
  const SSd = Math.min(width, height);
  return { width, height, LSd, SSd, isPortrait: height >= width };
}

export function getArcParameters(viewport) {
  const { LSd, SSd } = viewport;
  const hubX = (2 * LSd) ** 2 / (8 * SSd) + SSd / 2; // v2 constitutional formula
  const hubY = 0;
  const radius = SSd / 2 + (LSd * LSd) / (2 * SSd);
  return { hubX, hubY, radius };
}

export function getNodeSpacing(viewport) {
  const arc = getArcParameters(viewport);
  const desiredArcLength = viewport.SSd * 0.156; // proportional to SSd
  return desiredArcLength / arc.radius;
}

export function getMagnifierAngle(viewport) {
  // Fixed magnifier angle to reduce cross-device variance (142°)
  return (142 * Math.PI) / 180;
}

export function getMagnifierPosition(viewport) {
  const arc = getArcParameters(viewport);
  const angle = getMagnifierAngle(viewport);
  return {
    angle,
    x: arc.hubX + arc.radius * Math.cos(angle),
    y: arc.hubY + arc.radius * Math.sin(angle)
  };
}

export function getBaseAngleForOrder(order, viewport, nodeSpacing) {
  const magnifierAngle = getMagnifierAngle(viewport);
  const normalizedOrder = Number.isFinite(order) ? order : 0;
  const spacing = nodeSpacing ?? getNodeSpacing(viewport);
  return magnifierAngle + (normalizedOrder + 1) * spacing * -1;
}

export function getViewportWindow(viewport, nodeSpacing) {
  const { width, height } = viewport;
  const { hubX, hubY } = getArcParameters(viewport);
  // Arc should cover from lower-right corner up to the upper-left edge (180°)
  const startAngle = Math.atan2(height - hubY, width - hubX);
  const endAngle = Math.PI; // constitutional constant at the left edge
  const arcLength = endAngle - startAngle;
  const spacing = nodeSpacing ?? getNodeSpacing(viewport);
  const maxNodes = Math.min(Math.floor(arcLength / spacing), 21);
  return { startAngle, endAngle, arcLength, maxNodes };
}

// The sprocket chain, told honestly (Howell 2026-07-21). The focus ring is
// NOT a circle — it is a bounded chain riding an off-screen sprocket. Over the
// viewport the chain wraps the sprocket (the arc we see); beyond the two
// viewport exits it leaves the sprocket and runs DEAD STRAIGHT along the
// tangent — vertical up at the upper-left (180°), ~south-east at the
// lower-right (the exact angle set by the device's viewport ratio). At full
// size the straight runs are off-screen; when the ring recedes (a dimension
// z-pull-back) they scale into view, and the eye reads a straight chain
// vanishing off the top — never a hose-reel coil.
//
// Returns the centreline as an ordered point list: far-SE tangent → lower
// exit → arc → upper exit → far-up tangent. Stroke it with the band width.
export function bandCenterlinePoints(arcParams, startAngle, endAngle) {
  const { hubX, hubY, radius } = arcParams;
  const T = radius * 3; // tangent run; clipped at 1.0, reaches the edge by 0.2
  const pt = a => [hubX + radius * Math.cos(a), hubY + radius * Math.sin(a)];
  const lower = pt(startAngle);
  const upper = pt(endAngle);
  // Tangent unit vectors, each continuing the chain AWAY from the arc: past
  // the lower exit (decreasing angle) and past the upper exit (increasing).
  const downDir = [Math.sin(startAngle), -Math.cos(startAngle)];
  const upDir = [-Math.sin(endAngle), Math.cos(endAngle)];
  const pts = [[lower[0] + downDir[0] * T, lower[1] + downDir[1] * T]];
  const N = 48;
  for (let i = 0; i <= N; i += 1) pts.push(pt(startAngle + ((endAngle - startAngle) * i) / N));
  pts.push([upper[0] + upDir[0] * T, upper[1] + upDir[1] * T]);
  return pts;
}

// The standard primary chain centreline for a viewport. A mirrored stratum
// reflects these points across the horizontal centreline (y → height − y),
// which turns the vertical-up exit into vertical-DOWN and the SE tangent into
// NE — the mirror the secondary needs, for free.
export function standardBandCenterline(viewport) {
  const w = getViewportWindow(viewport);
  return bandCenterlinePoints(getArcParameters(viewport), w.startAngle, w.endAngle);
}

export function pointsToPath(pts) {
  return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
}

// Long-chain fast path: when every non-null item's order equals its array
// index (true for all chain builders — gaps hold their slots), the visible
// index range is pure arithmetic and each frame touches ~21 links instead
// of the whole chain. Validated once per array; misaligned chains fall back
// to the full scan. Without this, an 86k-link months chain pays an O(N)
// sweep per frame.
const indexAlignedChains = new WeakMap();

function isIndexAligned(allItems) {
  let aligned = indexAlignedChains.get(allItems);
  if (aligned !== undefined) return aligned;
  aligned = true;
  for (let i = 0; i < allItems.length; i += 1) {
    const item = allItems[i];
    if (item !== null && Number.isFinite(item?.order) && item.order !== i) { aligned = false; break; }
  }
  indexAlignedChains.set(allItems, aligned);
  return aligned;
}

// Map a chain angle to a point on the honest sprocket chain: on the arc while
// within the viewport window, else on the STRAIGHT tangent run beyond the exit
// (vertical up past the upper exit, ~SE past the lower). Same centreline the
// band follows (bandCenterlinePoints). tangentAngle is the label rotation — the
// true angle on the arc, CLAMPED to the exit on the straight runs so tangent
// labels stay square to the chain instead of continuing to turn.
export function chainPointAt(arc, startAngle, endAngle, a) {
  const { hubX, hubY, radius } = arc;
  if (a > endAngle) {
    const d = (a - endAngle) * radius;
    return {
      x: hubX + radius * Math.cos(endAngle) - Math.sin(endAngle) * d,
      y: hubY + radius * Math.sin(endAngle) + Math.cos(endAngle) * d,
      tangentAngle: endAngle, onArc: false
    };
  }
  if (a < startAngle) {
    const d = (startAngle - a) * radius;
    return {
      x: hubX + radius * Math.cos(startAngle) + Math.sin(startAngle) * d,
      y: hubY + radius * Math.sin(startAngle) - Math.cos(startAngle) * d,
      tangentAngle: startAngle, onArc: false
    };
  }
  return { x: hubX + radius * Math.cos(a), y: hubY + radius * Math.sin(a), tangentAngle: a, onArc: true };
}

// tangentSpan (radians, default 0) widens the window past both exits so the
// beyond-arc links populate the STRAIGHT tangent runs — the chain climbing
// vertically overhead when the ring recedes (Howell 2026-07-21). 0 keeps the
// hot rotation path arc-only, as before; a receded ring passes a span sized to
// reach the viewport edge at its scale.
export function calculateNodePositions(allItems, viewport, rotationOffset = 0, nodeRadius = 10, nodeSpacing, tangentSpan = 0) {
  if (!Array.isArray(allItems)) {
    throw new Error('calculateNodePositions: allItems must be an array');
  }
  const arc = getArcParameters(viewport);
  const spacing = nodeSpacing ?? getNodeSpacing(viewport);
  const windowInfo = getViewportWindow(viewport, spacing);
  const loA = windowInfo.startAngle - tangentSpan;
  const hiA = windowInfo.endAngle + tangentSpan;
  const positions = [];

  const pushIfVisible = (item, index) => {
    if (item === null || item === undefined) return; // gap occupies space but does not render
    const order = Number.isFinite(item.order) ? item.order : index;
    const baseAngle = getBaseAngleForOrder(order, viewport, spacing); // reverse sort: lower order → larger angle
    const rotatedAngle = baseAngle + rotationOffset;
    if (rotatedAngle < loA || rotatedAngle > hiA) {
      return;
    }
    const p = chainPointAt(arc, windowInfo.startAngle, windowInfo.endAngle, rotatedAngle);
    positions.push({
      item,
      index,
      angle: p.tangentAngle,
      x: p.x,
      y: p.y,
      radius: nodeRadius,
      onTangent: !p.onArc
    });
  };

  if (isIndexAligned(allItems)) {
    // Invert baseAngle(order) = magnifierAngle - (order+1)·spacing for the
    // (tangent-widened) window edges; ±1 of margin absorbs rounding.
    const magnifierAngle = getMagnifierAngle(viewport);
    const lo = Math.max(0, Math.floor((magnifierAngle + rotationOffset - hiA) / spacing - 1) - 1);
    const hi = Math.min(allItems.length - 1, Math.ceil((magnifierAngle + rotationOffset - loA) / spacing - 1) + 1);
    for (let i = lo; i <= hi; i += 1) pushIfVisible(allItems[i], i);
    return positions;
  }

  allItems.forEach(pushIfVisible);
  return positions;
}

/**
 * Like calculateNodePositions but without the visible-window filter.
 * Returns arc positions for ALL items so migration animations can
 * animate nodes to their implied off-screen positions on the arc.
 */
export function calculateAllNodePositions(allItems, viewport, rotationOffset = 0, nodeRadius = 10, nodeSpacing) {
  if (!Array.isArray(allItems)) {
    throw new Error('calculateAllNodePositions: allItems must be an array');
  }
  const arc = getArcParameters(viewport);
  const spacing = nodeSpacing ?? getNodeSpacing(viewport);
  const positions = [];

  allItems.forEach((item, index) => {
    if (item === null) return;
    const order = Number.isFinite(item.order) ? item.order : index;
    const baseAngle = getBaseAngleForOrder(order, viewport, spacing);
    const rotatedAngle = baseAngle + rotationOffset;
    positions.push({
      item,
      index,
      angle: rotatedAngle,
      x: arc.hubX + arc.radius * Math.cos(rotatedAngle),
      y: arc.hubY + arc.radius * Math.sin(rotatedAngle),
      radius: nodeRadius
    });
  });

  return positions;
}

export const GeometryConstants = {
  SELECTION_THRESHOLD
};
