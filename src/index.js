import { getViewportInfo, calculateNodePositions, getArcParameters, getViewportWindow, getBaseAngleForOrder, getMagnifierPosition, getNodeSpacing } from './geometry/focus-ring-geometry.js';
import { NavigationState } from './navigation/navigation-state.js';
import { buildBibleVerseCousinChain, buildBibleBookCousinChain } from './navigation/cousin-builder.js';
import { RotationChoreographer } from './interaction/rotation-choreographer.js';
import { FocusRingView } from './view/focus-ring-view.js';
import { validateVolumeRoot } from './data/volume-validator.js';
import { safeEmit } from './core/telemetry.js';
import { buildPyramidPreview } from './core/pyramid-preview.js';

export {
  getViewportInfo,
  calculateNodePositions,
  NavigationState,
  RotationChoreographer,
  FocusRingView,
  validateVolumeRoot,
  buildBibleVerseCousinChain,
  buildBibleBookCousinChain
};

const NODE_RADIUS_RATIO = 0.035; // 3.5% of shorter side
const MAGNIFIER_RADIUS_RATIO = 0.060; // larger than nodes

const logOnceFactory = logger => {
  let logged = false;
  return (...args) => {
    if (logged) return;
    logged = true;
    logger(...args);
  };
};

const normalizeAngle = angle => {
  const twoPi = 2 * Math.PI;
  return ((angle % twoPi) + twoPi) % twoPi;
};

const isNearAngle = (angle, target, epsilon) => {
  if (target === undefined) return false;
  const diff = Math.abs(normalizeAngle(angle) - normalizeAngle(target));
  const wrapped = diff > Math.PI ? (2 * Math.PI) - diff : diff;
  return wrapped <= epsilon;
};

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

export function createApp({
  svgRoot,
  items,
  viewport,
  selectedIndex = 0,
  preserveOrder = false,
  labelFormatter,
  shouldCenterLabel,
  secondaryItems = [],
  secondarySelectedIndex = 0,
  onSelectSecondary,
  contextOptions = {},
  onParentClick,
  onChildrenClick,
  pyramid,
  pyramidLayoutSpec = null,
  pyramidAdapter = null,
  pyramidNormalized = null
}) {
  if (!svgRoot) throw new Error('createApp: svgRoot is required');
  const debug = Boolean(contextOptions.debug);
  const prefersReducedMotion = Boolean(
    contextOptions?.reducedMotion ?? (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
  const debugPerf = Boolean(contextOptions.debugPerf);
  const perfRenderBudget = Number(contextOptions?.perfRenderBudgetMs) || 17;
  const emit = payload => safeEmit(contextOptions.onEvent, payload);
  const hasDimensions = contextOptions?.hasDimensions ?? true;
  const logOnce = logOnceFactory((...args) => {
    if (debug) console.log(...args);
  });
  let preserveOrderFlag = preserveOrder;
  let normalizedItems = normalizeItems(items, { preserveOrder: preserveOrderFlag });
  const formatLabel = typeof labelFormatter === 'function'
    ? labelFormatter
    : ({ item }) => item?.name || item?.id || '';

  const vp = viewport || getViewportInfo(window.innerWidth, window.innerHeight);
  const nodeRadius = vp.SSd * NODE_RADIUS_RATIO;
  const magnifierRadius = vp.SSd * MAGNIFIER_RADIUS_RATIO;
  const nodeSpacing = getNodeSpacing(vp);
  const arcParams = getArcParameters(vp);
  const windowInfo = getViewportWindow(vp, nodeSpacing);
  const magnifier = getMagnifierPosition(vp);

  // Dimension button placement: bottom-right corner angle + 9° at 90% radius, sized to 1.8× magnifier radius
  const bottomRightAngle = windowInfo.startAngle;
  const dimensionAngle = bottomRightAngle + (9 * Math.PI) / 180;
  const dimensionRadius = arcParams.radius * 0.9;
  const dimensionSize = magnifierRadius * 1.8;
  const dimensionPosition = {
    x: arcParams.hubX + dimensionRadius * Math.cos(dimensionAngle),
    y: arcParams.hubY + dimensionRadius * Math.sin(dimensionAngle)
  };

  logOnce('[FocusRing] geometry inputs', {
    viewport: vp,
    nodeRadius,
    magnifierRadius,
    nodeSpacing,
    arcParams,
    windowInfo,
    magnifier
  });
  const gapCount = normalizedItems.filter(item => item === null).length;
  const firstItem = normalizedItems.find(item => item !== null);
  const lastItem = [...normalizedItems].reverse().find(item => item !== null);
  const chainSummary = {
    total: normalizedItems.length,
    gaps: gapCount,
    first: firstItem?.name || firstItem?.id || null,
    last: lastItem?.name || lastItem?.id || null
  };
  if (debug) {
    console.info('[FocusRing] chain summary', chainSummary);
  }
  emit({ type: 'focus-ring:chain-summary', payload: chainSummary });
  const nav = new NavigationState();
  const safeIndex = (() => {
    if (!normalizedItems.length) return 0;
    if (normalizedItems[selectedIndex] !== null) return selectedIndex;
    const fallback = normalizedItems.findIndex(item => item !== null);
    return fallback >= 0 ? fallback : 0;
  })();
  nav.setItems(normalizedItems, safeIndex);
  const secondaryNav = new NavigationState();
  const safeSecondaryIndex = (() => {
    if (!secondaryItems?.length) return 0;
    if (secondaryItems[secondarySelectedIndex] !== null) return secondarySelectedIndex;
    const fallback = secondaryItems.findIndex(item => item !== null);
    return fallback >= 0 ? fallback : 0;
  })();
  secondaryNav.setItems(secondaryItems || [], safeSecondaryIndex);
  const view = new FocusRingView(svgRoot);
  view.init();
  let isBlurred = false;
  let choreographer = null;
  let isRotating = false;
  let rotation = 0;
  let snapId = null;
  let secondaryChoreographer = null;
  let secondaryIsRotating = false;
  let secondaryRotation = 0;
  let secondarySnapId = null;
  let isLayerOut = false; // track layer migration state between parent button and magnifier
  let parentButtonsVisibility = { showOuter: true, showInner: true };
  let lastParentLabelOut = '';
  let lastSelectedLabelOut = '';
  const pyramidConfig = pyramid || null;
  const getPyramidChildren = typeof pyramidConfig?.getChildren === 'function'
    ? args => pyramidConfig.getChildren({ ...args, items: nav.items, normalized: pyramidNormalized ?? normalizedItems, viewport: vp })
    : null;
  const buildPyramid = selected => {
    try {
      const instructions = buildPyramidPreview({
        viewport: vp,
        selected,
        getChildren: getPyramidChildren ? (ctx => getPyramidChildren({ ...ctx, selected })) : null,
        pyramidConfig,
        normalized: pyramidNormalized ?? normalizedItems,
        adapter: pyramidAdapter,
        layoutSpec: pyramidLayoutSpec
      });
      return Array.isArray(instructions) && instructions.length > 0 ? instructions : null;
    } catch (err) {
      if (debug) console.warn('[FocusRing] pyramid preview error', err);
      return null;
    }
  };

  const setBlur = enabled => {
    isBlurred = Boolean(enabled);
    view.setBlur(isBlurred);
    if (isBlurred) {
      isRotating = false;
      secondaryIsRotating = false;
      if (choreographer) {
        choreographer.stopMomentum();
      }
      if (secondaryChoreographer) {
        secondaryChoreographer.stopMomentum();
      }
    }
    if (typeof render === 'function') {
      render(rotation);
    }
  };

  const toggleBlur = () => {
    if (!hasDimensions) return;
    setBlur(!isBlurred);
  };

  const clampRotation = (value, bounds) => Math.max(bounds.minRotation, Math.min(bounds.maxRotation, value));
  const clampSecondaryRotation = (value, bounds) => Math.max(bounds.minRotation, Math.min(bounds.maxRotation, value));

  const secondaryArc = { ...arcParams, hubY: vp.LSd ?? arcParams.hubY };

  const getSecondaryMagnifier = () => {
    const y = (vp.height ?? vp.LSd ?? magnifier.y) - magnifier.y;
    const angle = Math.atan2(y - secondaryArc.hubY, magnifier.x - secondaryArc.hubX);
    return {
      angle,
      x: magnifier.x,
      y,
      radius: magnifierRadius
    };
  };

  const getSecondaryWindow = () => {
    const secMag = getSecondaryMagnifier();
    const arcLength = windowInfo.arcLength;
    const startAngle = secMag.angle - arcLength / 2;
    const endAngle = secMag.angle + arcLength / 2;
    const maxNodes = windowInfo.maxNodes;
    return { startAngle, endAngle, arcLength, maxNodes };
  };

  const getParentLabel = item => {
    if (!item) return '';
    const pick = () => {
      if (item.parentName) return item.parentName;
      if (item.sectionId) return item.sectionId;
      if (item.section) return item.section;
      if (item.parent) return item.parent;
      if (item.chapter && item.book) return `${item.book} ${item.chapter}`;
      if (item.book) return item.book;
      if (typeof item.id === 'string' && item.id.includes('__')) {
        const parts = item.id.split('__');
        if (parts.length >= 2) return parts[1];
      }
      return '';
    };
    const label = pick();
    return label;
  };

  const getParentKey = entry => {
    if (!entry) return null;
    const parentId = entry.parentId ?? entry.parent_id;
    if (parentId !== undefined && parentId !== null) return parentId;
    if (entry.sectionId) return entry.sectionId;
    if (entry.section) return entry.section;
    if (entry.parentName) return entry.parentName;
    if (entry.parent) return entry.parent;
    return null;
  };

  const buildVisibleItems = () => {
    if (!isLayerOut) return nav.items;
    const selected = nav.getCurrent();
    if (!selected) return nav.items;
    const parentKey = getParentKey(selected);
    if (parentKey === null || parentKey === undefined || parentKey === '') return nav.items;
    const targetKey = String(parentKey);
    return nav.items.map(candidate => {
      if (!candidate) return null;
      const candidateKey = getParentKey(candidate);
      if (candidateKey === null || candidateKey === undefined || candidateKey === '') return null;
      return String(candidateKey) === targetKey ? candidate : null;
    });
  };

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

  const getSecondaryBaseAngle = order => {
    const secMag = getSecondaryMagnifier();
    return secMag.angle + (order + 1) * nodeSpacing * -1;
  };

  const computeSecondaryBounds = visibleItems => {
    const nonNull = visibleItems.filter(item => item !== null);
    if (!nonNull.length) return { minRotation: 0, maxRotation: 0 };
    const window = getSecondaryWindow();
    const firstOrder = Number.isFinite(nonNull[0].order) ? nonNull[0].order : visibleItems.indexOf(nonNull[0]);
    const lastOrder = Number.isFinite(nonNull[nonNull.length - 1].order)
      ? nonNull[nonNull.length - 1].order
      : visibleItems.lastIndexOf(nonNull[nonNull.length - 1]);
    const firstAngle = getSecondaryBaseAngle(firstOrder);
    const lastAngle = getSecondaryBaseAngle(lastOrder);
    return {
      minRotation: window.startAngle - firstAngle,
      maxRotation: window.endAngle - lastAngle
    };
  };

  const alignToSelected = () => {
    const selected = nav.getCurrent();
    if (!selected) return;
    const baseAngle = getBaseAngleForOrder(selected.order, vp, nodeSpacing);
    const desiredRotation = magnifier.angle - baseAngle;
    const bounds = computeBounds(buildVisibleItems());
    rotation = clampRotation(desiredRotation, bounds);
  };

  const alignSecondaryToSelected = () => {
    const selected = secondaryNav.getCurrent();
    if (!selected) return;
    const baseAngle = getSecondaryBaseAngle(selected.order);
    const desiredRotation = getSecondaryMagnifier().angle - baseAngle;
    const bounds = computeSecondaryBounds(secondaryNav.items);
    secondaryRotation = clampSecondaryRotation(desiredRotation, bounds);
  };

  const setPrimaryItems = (newItems, nextSelectedIndex = 0, nextPreserveOrder = preserveOrderFlag) => {
    preserveOrderFlag = nextPreserveOrder;
    normalizedItems = normalizeItems(newItems, { preserveOrder: preserveOrderFlag });
    const safePrimaryIndex = (() => {
      if (!normalizedItems.length) return 0;
      if (normalizedItems[nextSelectedIndex] !== null) return nextSelectedIndex;
      const fallback = normalizedItems.findIndex(item => item !== null);
      return fallback >= 0 ? fallback : 0;
    })();
    nav.setItems(normalizedItems, safePrimaryIndex);
    alignToSelected();
    render(rotation);
  };

  const setParentButtons = config => {
    parentButtonsVisibility = { ...parentButtonsVisibility, ...config };
    render(rotation);
  };

  const shiftLayersOut = () => {
    const prevSelected = nav.getCurrent();
    const prevParentLabel = getParentLabel(prevSelected) || '';
    const prevSelectedLabel = formatLabel({ item: prevSelected, context: 'magnifier' }) || '';
    if (typeof onParentClick === 'function') {
      const handled = onParentClick({ selected: nav.getCurrent(), nav, setItems: setPrimaryItems });
      if (handled) {
        if (!isLayerOut) {
          isLayerOut = true;
          lastParentLabelOut = prevParentLabel;
          lastSelectedLabelOut = prevSelectedLabel;
          render(rotation);
        }
        return;
      }
    }
    if (isLayerOut) return;
    isLayerOut = true;
    lastParentLabelOut = prevParentLabel;
    lastSelectedLabelOut = prevSelectedLabel;
    render(rotation);
  };

  const shiftLayersIn = () => {
    if (typeof onChildrenClick === 'function') {
      const handled = onChildrenClick({ selected: nav.getCurrent(), nav, setItems: setPrimaryItems });
      if (handled) {
        if (isLayerOut) {
          isLayerOut = false;
          lastParentLabelOut = '';
          lastSelectedLabelOut = '';
          render(rotation);
        }
        return;
      }
    }
    if (!isLayerOut) return;
    isLayerOut = false;
    lastParentLabelOut = '';
    lastSelectedLabelOut = '';
    render(rotation);
  };

  const calculateSecondaryNodePositions = (allItems, rotationOffset = secondaryRotation) => {
    const secMag = getSecondaryMagnifier();
    const secWindow = getSecondaryWindow();
    const positions = [];
    allItems.forEach((item, index) => {
      if (item === null) return;
      const order = Number.isFinite(item.order) ? item.order : index;
      const baseAngle = getSecondaryBaseAngle(order);
      const rotatedAngle = baseAngle + rotationOffset;
      if (rotatedAngle < secWindow.startAngle || rotatedAngle > secWindow.endAngle) return;
      positions.push({
        item,
        index,
        angle: rotatedAngle,
        x: secondaryArc.hubX + secondaryArc.radius * Math.cos(rotatedAngle),
        y: secondaryArc.hubY + secondaryArc.radius * Math.sin(rotatedAngle),
        radius: nodeRadius,
        label: item.name,
        labelCentered: true
      });
    });
    return positions;
  };

  const render = (nextRotation = rotation) => {
    const canTime = typeof performance !== 'undefined' && typeof performance.now === 'function';
    const renderStart = canTime ? performance.now() : null;
    rotation = nextRotation;
    const secondaryWindow = getSecondaryWindow();
    const selected = nav.getCurrent() || nav.items.find(item => item !== null) || nav.items[0];
    const visible = buildVisibleItems();
    const bounds = computeBounds(visible);
    const labelMaskEpsilon = nodeSpacing * 0.6;
    if (choreographer) {
      choreographer.setBounds(bounds.minRotation, bounds.maxRotation);
      rotation = clampRotation(rotation, bounds);
      choreographer.setRotation(rotation, { emit: false });
      rotation = choreographer.getRotation();
    }

    if (secondaryChoreographer && secondaryNav.items.length) {
      const secBounds = computeSecondaryBounds(secondaryNav.items);
      secondaryChoreographer.setBounds(secBounds.minRotation, secBounds.maxRotation);
      secondaryRotation = clampSecondaryRotation(secondaryRotation, secBounds);
      secondaryChoreographer.setRotation(secondaryRotation, { emit: false });
      secondaryRotation = secondaryChoreographer.getRotation();
    }
    const nodes = calculateNodePositions(visible, vp, rotation, nodeRadius, nodeSpacing).map(node => ({
      ...node,
      label: formatLabel({ item: node.item, context: 'node' }),
      labelCentered: Boolean(shouldCenterLabel?.({ item: node.item }))
    }));
    const secondaryMagnifier = getSecondaryMagnifier();
    const secondarySelected = secondaryNav.getCurrent();
    const secondaryNodes = calculateSecondaryNodePositions(secondaryNav.items, secondaryRotation);
    const pyramidInstructions = buildPyramid(selected);
    const parentLabel = getParentLabel(selected);
    const selectedMagnifierLabel = formatLabel({ item: selected, context: 'magnifier' });
    const magnifierLabel = isLayerOut
      ? (lastParentLabelOut || parentLabel || selectedMagnifierLabel)
      : selectedMagnifierLabel;
    const parentOuterLabel = isLayerOut
      ? (parentLabel || lastSelectedLabelOut || selectedMagnifierLabel)
      : parentLabel;

    view.render(
      nodes,
      arcParams,
      windowInfo,
      { ...magnifier, radius: magnifierRadius, label: magnifierLabel },
      {
        isRotating,
        isBlurred,
        viewport: vp,
        debug: true,
        magnifierAngle: magnifier.angle,
        labelMaskEpsilon,
        onNodeClick: node => rotateNodeIntoMagnifier(node),
        selectedId: selected?.id,
        dimensionIcon: hasDimensions ? {
          href: './art/dimension_sphere_black.svg',
          x: dimensionPosition.x,
          y: dimensionPosition.y,
          size: dimensionSize,
          onClick: () => toggleBlur()
        } : null,
        parentButtons: {
          innerLabel: 'CHILDREN (IN)',
          outerLabel: parentOuterLabel,
          onOuterClick: shiftLayersOut,
          onInnerClick: shiftLayersIn,
          isLayerOut,
          showOuter: parentButtonsVisibility.showOuter,
          showInner: parentButtonsVisibility.showInner
        },
        secondary: isBlurred && secondaryNav.items.length > 0 ? {
          nodes: secondaryNodes,
          isRotating: secondaryIsRotating,
          magnifierAngle: secondaryMagnifier.angle,
          labelMaskEpsilon,
          onNodeClick: node => rotateSecondaryNodeIntoMagnifier(node),
          selectedId: secondarySelected?.id,
          magnifierLabel: secondarySelected?.name || ''
        } : null,
        pyramidInstructions,
        onPyramidClick: pyramidConfig?.onClick
      }
    );

    if (renderStart !== null && typeof performance !== 'undefined') {
      const elapsed = performance.now() - renderStart;
      const durationMs = Number(elapsed.toFixed(2));
      const overBudget = durationMs > perfRenderBudget;
      emit({ type: 'perf:render', durationMs, budgetMs: perfRenderBudget, overBudget });
      if (debugPerf) {
        console.info('[FocusRing] render duration (ms)', durationMs, 'budget', perfRenderBudget, overBudget ? 'OVER' : 'within');
      }
    }

    if (!isRotating && selected) {
      const neighbors = getNeighbors(nav.getCurrentIndex(), 2);
      const labelOrGap = item => {
        if (item === null) return '(gap)';
        if (item?.name) return item.name;
        return item?.id || '(unknown)';
      };
      const findNode = idx => nodes.find(n => n.index === idx);
      const formatNeighbor = neighbor => {
        if (!neighbor) return { index: null, label: '(unknown)', visible: '' };
        const { index: idx, item, boundary } = neighbor;
        if (boundary) {
          return { index: idx, label: '(boundary)', visible: '' };
        }
        if (item === null) {
          return { index: idx, label: '(gap)', visible: '' };
        }
        const baseLabel = labelOrGap(item);
        const node = findNode(idx);
        const masked = node ? isNearAngle(node.angle, magnifier.angle, labelMaskEpsilon) : false;
        const isSelected = Boolean(selected?.id && item.id === selected.id);
        return {
          index: idx,
          label: baseLabel,
          visible: masked || isSelected ? '' : baseLabel,
          masked,
          selected: isSelected
        };
      };
      const formatMagnifier = () => {
        const baseLabel = labelOrGap(selected);
        const node = findNode(nav.getCurrentIndex());
        const masked = node ? isNearAngle(node.angle, magnifier.angle, labelMaskEpsilon) : false;
        return {
          label: baseLabel,
          visible: masked ? '' : baseLabel,
          masked,
          selected: true,
          index: nav.getCurrentIndex()
        };
      };

      console.info('[FocusRing] magnifier + neighbors', {
        language: contextOptions?.locale || 'english',
        magnifier: formatMagnifier(),
        parentButton: {
          outerLabel: parentOuterLabel || '',
          innerLabel: 'CHILDREN (IN)'
        },
        layerDirection: isLayerOut ? 'out' : 'in',
        before: neighbors.before.map(formatNeighbor),
        after: neighbors.after.map(formatNeighbor)
      });
    }
  };

  const getNeighbors = (index, count = 2) => {
    const before = [];
    const after = [];
    if (!nav.items.length) return { before, after };
    for (let i = 1; i <= nav.items.length && (before.length < count || after.length < count); i += 1) {
      if (before.length < count) {
        const prevIdx = index - i;
        if (prevIdx >= 0) {
          before.push({ index: prevIdx, item: nav.items[prevIdx], boundary: false });
        } else if (!preserveOrderFlag) {
          const wrapped = nav.wrapIndex(prevIdx);
          before.push({ index: wrapped, item: nav.items[wrapped], boundary: false });
        } else {
          before.push({ index: null, item: null, boundary: true });
        }
      }
      if (after.length < count) {
        const nextIdx = index + i;
        if (nextIdx < nav.items.length) {
          after.push({ index: nextIdx, item: nav.items[nextIdx], boundary: false });
        } else if (!preserveOrderFlag) {
          const wrapped = nav.wrapIndex(nextIdx);
          after.push({ index: wrapped, item: nav.items[wrapped], boundary: false });
        } else {
          after.push({ index: null, item: null, boundary: true });
        }
      }
    }
    return { before, after };
  };

  const invokeSecondarySelection = selectedItem => {
    if (typeof onSelectSecondary === 'function' && selectedItem?.translation) {
      const wasBlurred = isBlurred;
      onSelectSecondary(selectedItem.translation);
      if (wasBlurred) setBlur(true); // keep dimension mode active
    }
  };

  const rotateNodeIntoMagnifier = node => {
    if (!node?.item || isBlurred) return;
    const targetAngle = magnifier.angle;
    const baseAngle = getBaseAngleForOrder(node.item.order, vp, nodeSpacing);
    const desiredRotation = targetAngle - baseAngle;
    const bounds = computeBounds(nav.items);
    const clampedRotation = clampRotation(desiredRotation, bounds);
    nav.selectIndex(node.index);
    isRotating = true;
    animateSnapTo(clampedRotation, 120);
  };

  const rotateSecondaryNodeIntoMagnifier = node => {
    if (!node?.item) return;
    const secMag = getSecondaryMagnifier();
    const targetAngle = secMag.angle;
    const baseAngle = getSecondaryBaseAngle(node.item.order);
    const desiredRotation = targetAngle - baseAngle;
    const bounds = computeSecondaryBounds(secondaryNav.items);
    secondaryNav.selectIndex(node.index);
    secondaryRotation = clampSecondaryRotation(desiredRotation, bounds);
    secondaryIsRotating = false;
    render(rotation);
    invokeSecondarySelection(node.item);
  };

  const cancelSnap = () => {
    if (snapId) {
      cancelAnimationFrame(snapId);
      snapId = null;
    }
  };

  const animateSnapTo = (targetRotation, duration = 100) => {
    if (prefersReducedMotion) {
      cancelSnap();
      rotation = targetRotation;
      if (choreographer) {
        choreographer.setRotation(targetRotation, { emit: false });
        rotation = choreographer.getRotation();
      }
      isRotating = false;
      render(rotation);
      return;
    }
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

  const secondaryBounds = computeSecondaryBounds(secondaryNav.items);
  secondaryChoreographer = new RotationChoreographer({
    onRender: angle => {
      secondaryIsRotating = true;
      secondaryRotation = angle;
      render(rotation, true);
    },
    onSelection: () => {},
    minRotation: secondaryBounds.minRotation,
    maxRotation: secondaryBounds.maxRotation
  });

  alignToSelected();
  alignSecondaryToSelected();

  const selectNearest = () => {
    cancelSnap();
      if (isBlurred) return;
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

  const selectSecondaryNearest = () => {
    if (!secondaryNav.items.length) return;
    const secMag = getSecondaryMagnifier();
    let closestIdx = secondaryNav.getCurrentIndex();
    let closestDiff = Infinity;
    let closestAngle = null;
    secondaryNav.items.forEach((item, idx) => {
      if (item === null) return;
      const baseAngle = getSecondaryBaseAngle(item.order);
      const rotated = baseAngle + secondaryRotation;
      const diff = Math.abs(rotated - secMag.angle);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = idx;
        closestAngle = rotated;
      }
    });
    secondaryNav.selectIndex(closestIdx);
    const selectedItem = secondaryNav.items[closestIdx];
    if (closestAngle !== null) {
      const delta = secMag.angle - closestAngle;
      const targetRotation = secondaryRotation + delta;
      secondaryRotation = targetRotation;
      secondaryIsRotating = false;
      render(rotation);
      invokeSecondarySelection(selectedItem);
      return;
    }
    secondaryIsRotating = false;
    render(rotation, false);
    invokeSecondarySelection(selectedItem);
  };

  render(rotation);
  if (isBlurred) return;

  return {
    nav,
    view,
    choreographer,
    viewport: vp,
    selectNearest,
    beginRotation: () => {
      if (isBlurred) return;
      isRotating = true;
      cancelSnap();
    },
    endRotation: () => {
      if (isBlurred) return;
      selectNearest();
    },
    isBlurred: () => isBlurred,
    setBlur,
    toggleBlur,
    hasSecondary: () => secondaryNav.items.length > 0,
    rotateSecondary: delta => {
      if (!secondaryChoreographer) return;
      secondaryChoreographer.rotate(delta);
    },
    beginSecondaryRotation: () => {
      if (!secondaryChoreographer) return;
      secondaryIsRotating = true;
      if (secondarySnapId) {
        cancelAnimationFrame(secondarySnapId);
        secondarySnapId = null;
      }
    },
    endSecondaryRotation: () => {
      if (!secondaryChoreographer) return;
      selectSecondaryNearest();
      secondaryChoreographer.stopMomentum();
      secondaryIsRotating = false;
    },
    selectSecondaryNearest,
    secondaryChoreographer,
    setPrimaryItems,
    setParentButtons
  };
}
