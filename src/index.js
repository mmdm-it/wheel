import { getViewportInfo, calculateNodePositions, getArcParameters, getViewportWindow, getBaseAngleForOrder, getMagnifierPosition, getNodeSpacing } from './geometry/focus-ring-geometry.js';
import { NavigationState } from './navigation/navigation-state.js';
import { buildBibleVerseCousinChain, buildBibleBookCousinChain } from './navigation/cousin-builder.js';
import { RotationChoreographer } from './interaction/rotation-choreographer.js';
import { FocusRingView } from './view/focus-ring-view.js';

export {
  getViewportInfo,
  calculateNodePositions,
  NavigationState,
  RotationChoreographer,
  FocusRingView,
  buildBibleVerseCousinChain,
  buildBibleBookCousinChain
};

const NODE_RADIUS_RATIO = 0.035; // 3.5% of shorter side
const MAGNIFIER_RADIUS_RATIO = 0.060; // larger than nodes

const logOnce = (() => {
  let logged = false;
  return (...args) => {
    if (logged) return;
    logged = true;
    console.log(...args);
  };
})();

function normalizeItems(items, { preserveOrder = false } = {}) {
  if (!Array.isArray(items)) throw new Error('createApp: items must be an array');
  const hasGaps = items.some(item => item === null);
  if (preserveOrder || hasGaps) {
    return items.map((item, idx) => {
      if (item === null) return null;
      const order = Number.isFinite(item.order) ? item.order : idx;
      return { ...item, order };
    });
  }
  const sorted = [...items]
    .sort((a, b) => {
      const as = a.sort ?? a.order ?? 0;
      const bs = b.sort ?? b.order ?? 0;
      if (as === bs) return (a.name || '').localeCompare(b.name || '');
      return as - bs;
    })
    .map((item, idx) => ({ ...item, order: idx }));
  return sorted;
}

export function createApp({ svgRoot, items, viewport, selectedIndex = 0, preserveOrder = false }) {
  if (!svgRoot) throw new Error('createApp: svgRoot is required');
  const normalized = normalizeItems(items, { preserveOrder });

  const vp = viewport || getViewportInfo(window.innerWidth, window.innerHeight);
  const nodeRadius = vp.SSd * NODE_RADIUS_RATIO;
  const magnifierRadius = vp.SSd * MAGNIFIER_RADIUS_RATIO;
  const nodeSpacing = getNodeSpacing(vp);
  const arcParams = getArcParameters(vp);
  const windowInfo = getViewportWindow(vp, nodeSpacing);
  const magnifier = getMagnifierPosition(vp);

  logOnce('[FocusRing] geometry inputs', {
    viewport: vp,
    nodeRadius,
    magnifierRadius,
    nodeSpacing,
    arcParams,
    windowInfo,
    magnifier
  });
  const gapCount = normalized.filter(item => item === null).length;
  const firstItem = normalized.find(item => item !== null);
  const lastItem = [...normalized].reverse().find(item => item !== null);
  console.info('[FocusRing] chain summary', {
    total: normalized.length,
    gaps: gapCount,
    first: firstItem?.name || firstItem?.id || null,
    last: lastItem?.name || lastItem?.id || null
  });
  const nav = new NavigationState();
  const safeIndex = (() => {
    if (!normalized.length) return 0;
    if (normalized[selectedIndex] !== null) return selectedIndex;
    const fallback = normalized.findIndex(item => item !== null);
    return fallback >= 0 ? fallback : 0;
  })();
  nav.setItems(normalized, safeIndex);
  const view = new FocusRingView(svgRoot);
  view.init();
  let choreographer = null;
  let isRotating = false;
  let rotation = 0;
  let snapId = null;

  const clampRotation = (value, bounds) => Math.max(bounds.minRotation, Math.min(bounds.maxRotation, value));

  const buildVisibleItems = () => nav.items;

  const computeBounds = visibleItems => {
    const nonNull = visibleItems.filter(item => item !== null);
    if (!nonNull.length) return { minRotation: 0, maxRotation: 0 };
    const firstOrder = Number.isFinite(nonNull[0].order) ? nonNull[0].order : visibleItems.indexOf(nonNull[0]);
    const lastOrder = Number.isFinite(nonNull[nonNull.length - 1].order)
      ? nonNull[nonNull.length - 1].order
      : visibleItems.lastIndexOf(nonNull[nonNull.length - 1]);
    const firstAngle = getBaseAngleForOrder(firstOrder, vp, nodeSpacing);
    const lastAngle = getBaseAngleForOrder(lastOrder, vp, nodeSpacing);
    return {
      minRotation: windowInfo.startAngle - firstAngle,
      maxRotation: windowInfo.endAngle - lastAngle
    };
  };

  const render = (nextRotation = rotation) => {
    rotation = nextRotation;
    const selected = nav.getCurrent() || nav.items.find(item => item !== null) || nav.items[0];
    const visible = buildVisibleItems();
    const bounds = computeBounds(visible);
    if (choreographer) {
      choreographer.setBounds(bounds.minRotation, bounds.maxRotation);
      rotation = clampRotation(rotation, bounds);
      choreographer.setRotation(rotation, { emit: false });
      rotation = choreographer.getRotation();
    }
    const nodes = calculateNodePositions(visible, vp, rotation, nodeRadius, nodeSpacing);
    view.render(
      nodes,
      arcParams,
      windowInfo,
      { ...magnifier, radius: magnifierRadius, label: selected?.name || '' },
      {
        isRotating,
        magnifierAngle: magnifier.angle,
        labelMaskEpsilon: nodeSpacing * 0.6
      }
    );
  };

  const cancelSnap = () => {
    if (snapId) {
      cancelAnimationFrame(snapId);
      snapId = null;
    }
  };

  const animateSnapTo = (targetRotation, duration = 100) => {
    cancelSnap();
    const delta = targetRotation - rotation;
    if (Math.abs(delta) < 1e-6 || duration <= 0) {
      if (choreographer) {
        choreographer.setRotation(targetRotation, { emit: false });
        rotation = choreographer.getRotation();
      } else {
        rotation = targetRotation;
      }
      isRotating = false;
      render(rotation);
      return;
    }
    isRotating = true;
    const startRotation = rotation;
    const startTime = performance.now();
    const step = now => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const next = startRotation + (targetRotation - startRotation) * t;
      if (choreographer) {
        choreographer.setRotation(next, { emit: false });
        rotation = choreographer.getRotation();
      } else {
        rotation = next;
      }
      render(rotation, false);
      if (t < 1) {
        snapId = requestAnimationFrame(step);
      } else {
        snapId = null;
        isRotating = false;
        render(rotation);
      }
    };
    snapId = requestAnimationFrame(step);
  };

  const bounds = computeBounds(buildVisibleItems(nav.getCurrent()));
  choreographer = new RotationChoreographer({
    onRender: angle => {
      isRotating = true;
      rotation = angle;
      render(rotation, true);
    },
    onSelection: () => {},
    minRotation: bounds.minRotation,
    maxRotation: bounds.maxRotation
  });

  const selectNearest = () => {
    cancelSnap();
    if (!nav.items.length) return;
    const targetAngle = magnifier.angle;
    let closestIdx = nav.getCurrentIndex();
    let closestDiff = Infinity;
    let closestAngle = null;
    nav.items.forEach((item, idx) => {
      if (item === null) return;
      const baseAngle = getBaseAngleForOrder(item.order, vp, nodeSpacing);
      const rotated = baseAngle + rotation;
      const diff = Math.abs(rotated - targetAngle);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = idx;
        closestAngle = rotated;
      }
    });
    nav.selectIndex(closestIdx);
    if (closestAngle !== null) {
      const delta = targetAngle - closestAngle;
      const targetRotation = rotation + delta;
      isRotating = true;
      animateSnapTo(targetRotation, 100);
      return;
    }
    isRotating = false;
    render(rotation, false);
  };

  render(0);

  return {
    nav,
    view,
    choreographer,
    viewport: vp,
    selectNearest,
    beginRotation: () => { isRotating = true; cancelSnap(); },
    endRotation: () => selectNearest()
  };
}
