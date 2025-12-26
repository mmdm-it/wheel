import { getViewportInfo, getArcParameters, getViewportWindow, getNodeSpacing, getMagnifierPosition, calculateNodePositions } from '../geometry/focus-ring-geometry.js';

const defaultLabel = item => item?.name ?? item?.id ?? '';

export function buildFocusRingLayout({ normalized, layoutSpec, viewport, parentId = null, rotation = 0 }) {
  if (!normalized || !Array.isArray(normalized.items)) {
    throw new Error('buildFocusRingLayout: normalized.items is required');
  }
  const labelFn = typeof layoutSpec?.label === 'function' ? layoutSpec.label : defaultLabel;
  const vp = viewport || getViewportInfo(1280, 720);
  const arcParams = getArcParameters(vp);
  const nodeSpacing = getNodeSpacing(vp);
  const viewportWindow = getViewportWindow(vp, nodeSpacing);
  const magnifier = getMagnifierPosition(vp);

  const itemsAtLevel = normalized.items.filter(item => {
    if (parentId === null) return item.parentId === null;
    return item.parentId === parentId;
  });

  const positioned = calculateNodePositions(itemsAtLevel, vp, rotation, vp.SSd * 0.035, nodeSpacing);
  const nodes = positioned.map(node => ({
    ...node,
    label: labelFn(node.item)
  }));

  return {
    nodes,
    arcParams,
    viewport: vp,
    viewportWindow,
    magnifier
  };
}
