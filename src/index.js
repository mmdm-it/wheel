import { getViewportInfo, calculateNodePositions, getArcParameters, getViewportWindow, getBaseAngleForOrder, getMagnifierPosition } from './geometry/focus-ring-geometry.js';
import { NavigationState } from './navigation/navigation-state.js';
import { RotationChoreographer } from './interaction/rotation-choreographer.js';
import { FocusRingView } from './view/focus-ring-view.js';

export {
  getViewportInfo,
  calculateNodePositions,
  NavigationState,
  RotationChoreographer,
  FocusRingView
};

export function createApp({ svgRoot, items, viewport }) {
  if (!svgRoot) throw new Error('createApp: svgRoot is required');
  const normalized = [...items]
    .sort((a, b) => {
      const as = a.sort ?? a.order ?? 0;
      const bs = b.sort ?? b.order ?? 0;
      if (as === bs) return (a.name || '').localeCompare(b.name || '');
      return as - bs;
    })
    .map((item, idx) => ({ ...item, order: idx }));

  const vp = viewport || getViewportInfo(window.innerWidth, window.innerHeight);
  const arcParams = getArcParameters(vp);
  const windowInfo = getViewportWindow(vp);
  const magnifier = getMagnifierPosition(vp);
  const nav = new NavigationState(normalized);
  const view = new FocusRingView(svgRoot);
  view.init();
  let rotationOffset = 0;
  let choreographer = null;

  const clampRotation = (value, bounds) => Math.max(bounds.minRotation, Math.min(bounds.maxRotation, value));

  const buildVisibleItems = selected => {
    const selectedId = selected?.id;
    return nav.items
      .filter(item => item.id !== selectedId)
      .map((item, idx) => ({ ...item, order: idx }));
  };

  const computeBounds = visibleItems => {
    if (!visibleItems.length) return { minRotation: 0, maxRotation: 0 };
    const firstAngle = getBaseAngleForOrder(visibleItems[0].order, vp);
    const lastAngle = getBaseAngleForOrder(visibleItems[visibleItems.length - 1].order, vp);
    return {
      minRotation: windowInfo.startAngle - firstAngle,
      maxRotation: windowInfo.endAngle - lastAngle
    };
  };

  const render = (nextRotation = rotationOffset) => {
    rotationOffset = nextRotation;
    const selected = nav.getCurrent() || nav.items[0];
    const visible = buildVisibleItems(selected);
    const bounds = computeBounds(visible);
    if (choreographer) {
      choreographer.setBounds(bounds.minRotation, bounds.maxRotation);
      rotationOffset = clampRotation(rotationOffset, bounds);
      choreographer.visualRotation = rotationOffset;
    }
    const nodes = calculateNodePositions(visible, vp, rotationOffset);
    view.render(nodes, arcParams, windowInfo, { ...magnifier, label: selected?.name || '' });
  };

  const bounds = computeBounds(buildVisibleItems(nav.getCurrent()));
  choreographer = new RotationChoreographer({
    onRender: render,
    onSelection: () => {},
    minRotation: bounds.minRotation,
    maxRotation: bounds.maxRotation
  });

  const selectNearest = () => {
    if (!nav.items.length) return;
    const targetAngle = magnifier.angle;
    let closestIdx = nav.getCurrentIndex();
    let closestDiff = Infinity;
    nav.items.forEach((item, idx) => {
      const baseAngle = getBaseAngleForOrder(item.order, vp);
      const rotated = baseAngle + rotationOffset;
      const diff = Math.abs(rotated - targetAngle);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = idx;
      }
    });
    nav.selectIndex(closestIdx);
    render(rotationOffset);
  };

  render(0);

  return { nav, view, choreographer, viewport: vp, selectNearest };
}
