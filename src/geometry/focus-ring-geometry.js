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

export function calculateNodePositions(allItems, viewport, rotationOffset = 0, nodeRadius = 10, nodeSpacing) {
  if (!Array.isArray(allItems)) {
    throw new Error('calculateNodePositions: allItems must be an array');
  }
  const arc = getArcParameters(viewport);
  const spacing = nodeSpacing ?? getNodeSpacing(viewport);
  const windowInfo = getViewportWindow(viewport, spacing);
  const positions = [];

  const pushIfVisible = (item, index) => {
    if (item === null || item === undefined) return; // gap occupies space but does not render
    const order = Number.isFinite(item.order) ? item.order : index;
    const baseAngle = getBaseAngleForOrder(order, viewport, spacing); // reverse sort: lower order → larger angle
    const rotatedAngle = baseAngle + rotationOffset;
    if (rotatedAngle < windowInfo.startAngle || rotatedAngle > windowInfo.endAngle) {
      return;
    }
    positions.push({
      item,
      index,
      angle: rotatedAngle,
      x: arc.hubX + arc.radius * Math.cos(rotatedAngle),
      y: arc.hubY + arc.radius * Math.sin(rotatedAngle),
      radius: nodeRadius
    });
  };

  if (isIndexAligned(allItems)) {
    // Invert baseAngle(order) = magnifierAngle - (order+1)·spacing for the
    // window edges; ±1 of margin absorbs rounding at the boundaries.
    const magnifierAngle = getMagnifierAngle(viewport);
    const lo = Math.max(0, Math.floor((magnifierAngle + rotationOffset - windowInfo.endAngle) / spacing - 1) - 1);
    const hi = Math.min(allItems.length - 1, Math.ceil((magnifierAngle + rotationOffset - windowInfo.startAngle) / spacing - 1) + 1);
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
