const NODE_SPACING = Math.PI / 42; // 4.2857° spacing
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

export function getMagnifierAngle(viewport) {
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const { hubX, hubY } = getArcParameters(viewport);
  return Math.atan2(centerY - hubY, centerX - hubX);
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

export function getBaseAngleForOrder(order, viewport) {
  const magnifierAngle = getMagnifierAngle(viewport);
  const normalizedOrder = Number.isFinite(order) ? order : 0;
  return magnifierAngle + (normalizedOrder + 1) * NODE_SPACING * -1;
}

export function getViewportWindow(viewport) {
  const { width, height } = viewport;
  const { hubX, hubY } = getArcParameters(viewport);
  // Arc should cover from lower-right corner up to the upper-left edge (180°)
  const startAngle = Math.atan2(height - hubY, width - hubX);
  const endAngle = Math.PI; // constitutional constant at the left edge
  const arcLength = endAngle - startAngle;
  const maxNodes = Math.min(Math.floor(arcLength / NODE_SPACING), 21);
  return { startAngle, endAngle, arcLength, maxNodes };
}

export function calculateNodePositions(allItems, viewport, rotationOffset = 0) {
  if (!Array.isArray(allItems)) {
    throw new Error('calculateNodePositions: allItems must be an array');
  }
  const arc = getArcParameters(viewport);
  const windowInfo = getViewportWindow(viewport);
  const positions = [];

  allItems.forEach((item, index) => {
    const order = Number.isFinite(item.order) ? item.order : index;
    const baseAngle = getBaseAngleForOrder(order, viewport); // reverse sort: lower order → larger angle
    const rotatedAngle = baseAngle + rotationOffset;
    if (rotatedAngle < windowInfo.startAngle || rotatedAngle > windowInfo.endAngle) {
      return;
    }
    positions.push({
      item,
      index,
      angle: rotatedAngle,
      x: arc.hubX + arc.radius * Math.cos(rotatedAngle),
      y: arc.hubY + arc.radius * Math.sin(rotatedAngle)
    });
  });

  return positions;
}

export const GeometryConstants = {
  NODE_SPACING,
  SELECTION_THRESHOLD
};
