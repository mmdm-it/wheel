import { getViewportInfo, calculateNodePositions, calculateAllNodePositions, getArcParameters, getViewportWindow, getBaseAngleForOrder, getMagnifierPosition, getNodeSpacing } from './geometry/focus-ring-geometry.js';
import { NavigationState } from './navigation/navigation-state.js';
import { buildBibleVerseCousinChain, buildBibleBookCousinChain } from './navigation/cousin-builder.js';
import { RotationChoreographer } from './interaction/rotation-choreographer.js';
import { FocusRingView } from './view/focus-ring-view.js';
import { VolumeLogo } from './view/volume-logo.js';
import { validateVolumeRoot } from './data/volume-validator.js';
import { safeEmit } from './core/telemetry.js';
import { computeChildPyramidGeometry } from './geometry/child-pyramid-geometry.js';
import './geometry/pyramid-tuning-knobs.js';
import { placePyramidNodes } from './geometry/child-pyramid.js';
import { buildPyramidInstructions } from './view/detail/pyramid-view.js';
import { animateIn, animateOut, isAnimating, clearStack as clearAnimationStack, animatePyramidFromHub, animatePyramidToHub, animateRingOutward, animateRingInward, animateMagnifierToParent, animateParentToMagnifier, animateParentButtonOutward, animateParentButtonInward, animateVolumeParentMerge, animateVolumeParentUnmerge } from './view/migration-animation.js';
import './diagnostics/child-pyramid-bounds.js'; // Exposes showPyramidBounds/hidePyramidBounds to console

export {
  getViewportInfo,
  calculateNodePositions,
  NavigationState,
  RotationChoreographer,
  FocusRingView,
  VolumeLogo,
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
  contextOptions = {},
  onParentClick,
  getParentLabel: externalGetParentLabel,
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

  // geometry inputs logged only when debug is enabled (previous log removed to reduce noise)
  const gapCount = normalizedItems.filter(item => item === null).length;
  const firstItem = normalizedItems.find(item => item !== null);
  const lastItem = [...normalizedItems].reverse().find(item => item !== null);
  const chainSummary = {
    total: normalizedItems.length,
    gaps: gapCount,
    first: firstItem?.name || firstItem?.id || null,
    last: lastItem?.name || lastItem?.id || null
  };
  emit({ type: 'focus-ring:chain-summary', payload: chainSummary });
  const nav = new NavigationState();
  const safeIndex = (() => {
    if (!normalizedItems.length) return 0;
    if (normalizedItems[selectedIndex] !== null) return selectedIndex;
    const fallback = normalizedItems.findIndex(item => item !== null);
    return fallback >= 0 ? fallback : 0;
  })();
  nav.setItems(normalizedItems, safeIndex);
  const view = new FocusRingView(svgRoot);
  view.init();
  
  // Initialize volume logo (domain-specific)
  const volumeLogo = new VolumeLogo(svgRoot, vp);
  
  // Make volumeLogo globally accessible for diagnostics
  if (typeof window !== 'undefined') {
    window.volumeLogo = volumeLogo;
  }
  
  // For manifests with a root key (like Gutenberg_Bible), extract display_config from the root object
  const manifestRoot = pyramidAdapter?.manifest 
    ? (Object.keys(pyramidAdapter.manifest).length === 1 
        ? pyramidAdapter.manifest[Object.keys(pyramidAdapter.manifest)[0]] 
        : pyramidAdapter.manifest)
    : null;
  
  const logoConfig = manifestRoot?.display_config?.detail_sector;
  if (logoConfig && (logoConfig.logo_base_path || logoConfig.default_image)) {
    volumeLogo.render({
      ...logoConfig,
      color_scheme: manifestRoot?.display_config?.color_scheme
    });
  }
  
  let choreographer = null;
  let isRotating = false;
  let rotation = 0;
  let snapId = null;
  let isLayerOut = false; // track layer migration state between parent button and magnifier
  let parentButtonsVisibility = { showOuter: true };
  let lastParentLabelOut = '';
  let lastSelectedLabelOut = '';
  const pyramidConfig = pyramid || null;
  let lastPyramidData = null; // stashed for SVG-level click delegation

  // Detail Sector leaf detection
  const leafLevel = pyramidNormalized?.meta?.leafLevel || null;
  const isCatalogVolume = Boolean(pyramidNormalized?.meta?.suffixMerge);
  let detailSectorShown = false; // tracks whether DS is currently expanded
  let forcedDetailOpen = false;   // request to open DS at a non-leaf level
  let freezeDetailSector = false; // survives one post-expansion render without re-collapsing
  let detailOpenCallback = null;  // called after forced-expansion animation completes

  // Notify the host page when the detail sector visibility changes.
  // `when` indicates the timing: 'immediate' (show/hide now) or 'after-animation'
  // (show after the expand animation has completed).
  const emitDetailSectorChange = (visible, when = 'immediate') => {
    console.log('[emitDetailSectorChange] visible:', visible, 'when:', when, 'leafLevel:', leafLevel, 'detailSectorShown:', detailSectorShown);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('detail-sector-change', {
        detail: { visible, when }
      }));
    }
  };

  const clampRotation = (value, bounds) => Math.max(bounds.minRotation, Math.min(bounds.maxRotation, value));

  const builtinGetParentLabel = item => {
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

  const getParentLabel = typeof externalGetParentLabel === 'function'
    ? externalGetParentLabel
    : builtinGetParentLabel;

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

  // Bounds depend only on the chain's first/last real links — memoized per
  // array identity so the render loop never pays an O(N) filter per frame
  // (at 86k links that sweep alone would eat the frame budget).
  let boundsCacheKey = null;
  let boundsCacheValue = null;
  const computeBounds = visibleItems => {
    if (visibleItems === boundsCacheKey && boundsCacheValue) return boundsCacheValue;
    const bounds = computeBoundsUncached(visibleItems);
    boundsCacheKey = visibleItems;
    boundsCacheValue = bounds;
    return bounds;
  };
  const computeBoundsUncached = visibleItems => {
    let first = null;
    let firstIdx = -1;
    let last = null;
    let lastIdx = -1;
    for (let i = 0; i < visibleItems.length; i += 1) {
      if (visibleItems[i] !== null) { first = visibleItems[i]; firstIdx = i; break; }
    }
    for (let i = visibleItems.length - 1; i >= 0; i -= 1) {
      if (visibleItems[i] !== null) { last = visibleItems[i]; lastIdx = i; break; }
    }
    if (!first) return { minRotation: 0, maxRotation: 0 };
    const firstOrder = Number.isFinite(first.order) ? first.order : firstIdx;
    const lastOrder = Number.isFinite(last.order) ? last.order : lastIdx;
    const firstAngle = getBaseAngleForOrder(firstOrder, vp, nodeSpacing);
    const lastAngle = getBaseAngleForOrder(lastOrder, vp, nodeSpacing);
    // Allow 3 node-spacings of overrun past each end of the chain
    // (i.e. the terminal node may travel 3 spacings beyond the magnifier).
    const overrun = 3 * nodeSpacing;
    return {
      minRotation: magnifier.angle - overrun - firstAngle,
      maxRotation: magnifier.angle + overrun - lastAngle
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

  const setPrimaryItems = (newItems, nextSelectedIndex = 0, nextPreserveOrder = preserveOrderFlag) => {
    preserveOrderFlag = nextPreserveOrder;
    normalizedItems = normalizeItems(newItems, { preserveOrder: preserveOrderFlag });
    const safePrimaryIndex = (() => {
      if (!normalizedItems.length) return 0;
      if (normalizedItems[nextSelectedIndex] !== null) return nextSelectedIndex;
      const fallback = normalizedItems.findIndex(item => item !== null);
      return fallback >= 0 ? fallback : 0;
    })();
    isLayerOut = false; // reset — new items replace the shifted-out context
    lastParentLabelOut = '';
    lastSelectedLabelOut = '';
    nav.setItems(normalizedItems, safePrimaryIndex);
    alignToSelected();
    render(rotation);
  };

  const setParentButtons = config => {
    const next = {};
    if (typeof config?.showOuter === 'boolean') next.showOuter = config.showOuter;
    parentButtonsVisibility = { ...parentButtonsVisibility, ...next };
    render(rotation);
  };

  // ── Migration Animation: IN (Child Pyramid → Focus Ring) ──────────
  // Snapshots current pyramid node positions, calculates where the new
  // items will land on the focus ring, runs the 600 ms CSS transform
  // animation, then calls setPrimaryItems to finish the swap.
  const migrateIn = (newItems, nextSelectedIndex = 0, nextPreserveOrder = preserveOrderFlag) => {
    // If animating or no pyramid data, fall back to instant swap
    if (isAnimating() || !lastPyramidData?.nodes?.length) {
      setPrimaryItems(newItems, nextSelectedIndex, nextPreserveOrder);
      return;
    }

    // 1. Snapshot current child pyramid node positions (they'll be cleared)
    const pyramidNodes = lastPyramidData.nodes.slice();

    // 2. Pre-calculate where the new items will land on the focus ring.
    //    We need to normalise them, align to selected, and compute positions
    //    *without* actually mutating state yet.
    const tempNormalized = normalizeItems(newItems, { preserveOrder: nextPreserveOrder });
    const safeTempIndex = (() => {
      if (!tempNormalized.length) return 0;
      if (tempNormalized[nextSelectedIndex] !== null) return nextSelectedIndex;
      const fb = tempNormalized.findIndex(i => i !== null);
      return fb >= 0 ? fb : 0;
    })();
    const tempSelected = tempNormalized[safeTempIndex];
    // Compute the rotation offset that will be used after setPrimaryItems
    // Must replicate alignToSelected + clamp logic to get accurate positions
    const tempBaseAngle = tempSelected
      ? getBaseAngleForOrder(tempSelected.order, vp, nodeSpacing)
      : magnifier.angle;
    const desiredTempRotation = magnifier.angle - tempBaseAngle;
    // Compute bounds for the new items to clamp rotation
    const tempNonNull = tempNormalized.filter(i => i !== null);
    let tempRotation = desiredTempRotation;
    if (tempNonNull.length > 0) {
      const tFirst = tempNonNull[0].order;
      const tLast = tempNonNull[tempNonNull.length - 1].order;
      const tMinRot = windowInfo.startAngle - getBaseAngleForOrder(tFirst, vp, nodeSpacing);
      const tMaxRot = windowInfo.endAngle - getBaseAngleForOrder(tLast, vp, nodeSpacing);
      tempRotation = Math.max(tMinRot, Math.min(tMaxRot, desiredTempRotation));
    }
    // Use calculateAllNodePositions (no visible-window filter) so every
    // sibling gets a target — nodes beyond the visible arc animate to their
    // implied off-screen positions on the focus ring.
    const ringTargets = calculateAllNodePositions(tempNormalized, vp, tempRotation, nodeRadius, nodeSpacing);

    // 3. Snapshot current focus-ring node positions before they vanish.
    //    These will animate radially outward while new nodes animate in.
    const currentVisible = buildVisibleItems();
    const currentRingNodes = calculateNodePositions(currentVisible, vp, rotation, nodeRadius, nodeSpacing)
      .map(node => ({
        ...node,
        label: formatLabel({ item: node.item, context: 'node' }),
        labelCentered: Boolean(shouldCenterLabel?.({ item: node.item }))
      }));

    // 4. Hide real focus-ring nodes + pyramid so only animated clones show
    if (view.pyramidView?.pyramidGroup) view.pyramidView.pyramidGroup.style.opacity = '0';
    // nodesGroup + labelsGroup are hidden by animateRingOutward below

    // 4b. Snapshot magnifier and parent-button state BEFORE setPrimaryItems.
    //     The magnifier circle travels to the parent-button position (straight line).
    //     The old parent button exits radially outward from the HUB.
    const prevSelected = nav.getCurrent();
    const prevMagnifierLabel = formatLabel({ item: prevSelected, context: 'magnifier' }) || '';
    const prevParentLabel = getParentLabel(prevSelected)
      || view.parentButtonOuterLabel?.textContent?.trim()
      || '';
    const parentButtonX = vp.SSd * 0.13;
    const parentButtonY = vp.LSd * 0.93;

    // 5. Commit the data swap NOW while real nodes are hidden behind clones.
    //    This lets us read lastPyramidData for the new child pyramid immediately.
    setPrimaryItems(newItems, nextSelectedIndex, nextPreserveOrder);

    // 5b. setPrimaryItems → render() has now repainted the magnifier and parent
    //     button with the NEW data.  Hide their labels and circle fills so only
    //     the animated clones are visible — the stroke rings stay empty until the
    //     animation completes.
    //     Use style.visibility (not display attr) because render() calls
    //     removeAttribute('display') which would undo our hiding.
    if (view.magnifierLabel) view.magnifierLabel.style.visibility = 'hidden';
    if (view.parentButtonOuterLabel) view.parentButtonOuterLabel.style.visibility = 'hidden';
    // Hide circle fills but keep stroke rings visible
    if (view.magnifierCircle) view.magnifierCircle.style.fill = 'none';
    if (view.parentButtonOuter) view.parentButtonOuter.style.fill = 'none';

    // 6. Kick off ALL animations simultaneously:
    //    a) Old child pyramid → focus ring (animateIn) — clicked node grows to magnifier size
    //    b) Hub → new child pyramid (animatePyramidFromHub)
    //    c) Old focus-ring nodes → radially outward off-screen (animateRingOutward)
    //    d) Old magnifier → parent-button position (straight line)
    //    e) Old parent button → radially outward off-screen
    const selectedId = tempSelected?.id ?? null;
    const outgoingMagnifierId = prevSelected?.id ?? null;

    const incomingParentLabel = tempSelected ? (getParentLabel(tempSelected) || '') : '';
    const isCatalogSuffixMergeIn = Boolean(
      isCatalogVolume
      && prevParentLabel
      && prevMagnifierLabel
      && incomingParentLabel
      && incomingParentLabel.toUpperCase() === `${prevParentLabel} ${prevMagnifierLabel}`.toUpperCase()
    );

    animateIn({
      svgRoot: view.contentGroup || view.svgRoot,
      pyramidNodes,
      ringTargets,
      magnifierAngle: magnifier.angle,
      clickedId: selectedId,
      nodeRadius,
      magnifierRadius,
      onComplete: () => {
        // If animateRingOutward is running (900 ms), it will restore
        // nodesGroup/labelsGroup when it finishes.  But if there were
        // no ring nodes to animate outward, restore them here.
        if (currentRingNodes.length === 0) {
          if (view.nodesGroup)  view.nodesGroup.style.opacity = '';
          if (view.labelsGroup) view.labelsGroup.style.opacity = '';
        }
        // If no pyramid-from-hub animation ran, restore pyramid too
        if (!lastPyramidData?.nodes?.length) {
          if (view.pyramidView?.pyramidGroup) view.pyramidView.pyramidGroup.style.opacity = '';
        }
        // Restore magnifier label + circle fill (hidden so clones travel in their place)
        if (view.magnifierLabel) view.magnifierLabel.style.visibility = '';
        if (view.magnifierCircle) view.magnifierCircle.style.fill = '';
        // Restore parent button label + circle fill
        if (view.parentButtonOuterLabel) view.parentButtonOuterLabel.style.visibility = '';
        if (view.parentButtonOuter) view.parentButtonOuter.style.fill = '';
      }
    });

    // Old focus-ring nodes: animate radially outward (expanding galaxy)
    if (currentRingNodes.length > 0) {
      animateRingOutward({
        svgRoot: view.contentGroup || view.svgRoot,
        ringNodes: currentRingNodes,
        hubX: arcParams.hubX,
        hubY: arcParams.hubY,
        arcRadius: arcParams.radius,
        // Keep a visual gap under the magnifier: the node currently inside
        // the magnifier should not animate outward as part of ring clones.
        skipId: outgoingMagnifierId,
        nodesGroup: view.nodesGroup,
        labelsGroup: view.labelsGroup
      });
    }

    // New child pyramid: animate from hub simultaneously with the ring migration
    if (lastPyramidData?.nodes?.length) {
      animatePyramidFromHub({
        svgRoot: view.contentGroup || view.svgRoot,
        pyramidNodes: lastPyramidData.nodes,
        hubX: arcParams.hubX,
        hubY: arcParams.hubY,
        pyramidGroup: view.pyramidView?.pyramidGroup
      });
    }

    // Old magnifier → parent-button position (straight line)
    if (isCatalogSuffixMergeIn) {
      animateVolumeParentMerge({
        svgRoot: view.contentGroup || view.svgRoot,
        fromX: magnifier.x,
        fromY: magnifier.y,
        toX: parentButtonX,
        toY: parentButtonY,
        radius: magnifierRadius,
        baseLabel: prevParentLabel,
        suffixLabel: prevMagnifierLabel,
        fromAngle: magnifier.angle
      });
    } else {
      animateMagnifierToParent({
        svgRoot: view.contentGroup || view.svgRoot,
        fromX: magnifier.x,
        fromY: magnifier.y,
        toX: parentButtonX,
        toY: parentButtonY,
        radius: magnifierRadius,
        label: prevMagnifierLabel,
        fromAngle: magnifier.angle
      });
    }

    // Old parent button → radially outward off-screen (leads the way)
    if (!isCatalogSuffixMergeIn) {
      animateParentButtonOutward({
        svgRoot: view.contentGroup || view.svgRoot,
        buttonX: parentButtonX,
        buttonY: parentButtonY,
        radius: magnifierRadius,
        label: prevParentLabel,
        hubX: arcParams.hubX,
        hubY: arcParams.hubY,
        arcRadius: arcParams.radius,
        buttonElement: view.parentButtonOuter,
        buttonLabelElement: view.parentButtonOuterLabel
      });
    }

    // 5. Detail Sector: expand simultaneously if the incoming selected item is a leaf.
    //    By triggering here (not waiting for onComplete), both animations run in parallel.
    //    No onComplete render — setPrimaryItems (in the migration onComplete) will
    //    trigger the authoritative render once nav state has been committed.
    const incomingIsLeaf = leafLevel && tempSelected?.level === leafLevel;
    if (incomingIsLeaf && !detailSectorShown && !volumeLogo.animating) {
      detailSectorShown = true;
      volumeLogo.expand(arcParams, magnifier.angle, () => {
        emitDetailSectorChange(true, 'after-animation');
      });
    }
  };

  // ── Migration Animation: OUT (Focus Ring → Child Pyramid) ─────────
  // Pops the most recent animation layer from the LIFO stack and
  // reverses the transform animation back to the child pyramid
  // positions, then calls setPrimaryItems to restore parent items.
  const migrateOut = (items, selectedIndex = 0, preserveOrder = false) => {
    if (isAnimating()) {
      setPrimaryItems(items, selectedIndex, preserveOrder);
      return;
    }

    // Pre-calculate where the parent items will land on the focus ring
    // so we can fire animateRingInward simultaneously with animateOut.
    const tempNormalized = normalizeItems(items, { preserveOrder });
    const safeTempIndex = (() => {
      if (!tempNormalized.length) return 0;
      if (tempNormalized[selectedIndex] !== null) return selectedIndex;
      const fb = tempNormalized.findIndex(i => i !== null);
      return fb >= 0 ? fb : 0;
    })();
    const tempSelected = tempNormalized[safeTempIndex];
    const tempBaseAngle = tempSelected
      ? getBaseAngleForOrder(tempSelected.order, vp, nodeSpacing)
      : magnifier.angle;
    const desiredTempRotation = magnifier.angle - tempBaseAngle;
    const tempNonNull = tempNormalized.filter(i => i !== null);
    let tempRotation = desiredTempRotation;
    if (tempNonNull.length > 0) {
      const tFirst = tempNonNull[0].order;
      const tLast = tempNonNull[tempNonNull.length - 1].order;
      const tMinRot = windowInfo.startAngle - getBaseAngleForOrder(tFirst, vp, nodeSpacing);
      const tMaxRot = windowInfo.endAngle - getBaseAngleForOrder(tLast, vp, nodeSpacing);
      tempRotation = Math.max(tMinRot, Math.min(tMaxRot, desiredTempRotation));
    }
    const parentRingNodes = calculateNodePositions(tempNormalized, vp, tempRotation, nodeRadius, nodeSpacing)
      .map(node => ({
        ...node,
        label: formatLabel({ item: node.item, context: 'node' }),
        labelCentered: Boolean(shouldCenterLabel?.({ item: node.item }))
      }));

    // Detail Sector: collapse simultaneously with the reverse migration animation.
    // By triggering here (not waiting for onComplete), both animations run in parallel.
    //    No onComplete render — setPrimaryItems (in the migration onComplete) will
    //    trigger the authoritative render once nav state has been committed.
    if (detailSectorShown && !volumeLogo.animating) {
      detailSectorShown = false;
      emitDetailSectorChange(false, 'immediate');
      volumeLogo.collapse(arcParams, magnifier.angle);
    }

    // Snapshot magnifier and parent-button state BEFORE animations start.
    const prevMagnifierLabel = formatLabel({ item: nav.getCurrent(), context: 'magnifier' }) || '';
    const prevParentLabel = getParentLabel(nav.getCurrent())
      || view.parentButtonOuterLabel?.textContent?.trim()
      || '';
    const parentButtonX = vp.SSd * 0.13;
    const parentButtonY = vp.LSd * 0.93;
    // The new parent label (after OUT) is the parent of tempSelected
    const newParentLabel = tempSelected ? (getParentLabel(tempSelected) || '') : '';
    const isCatalogSuffixMergeOut = Boolean(
      isCatalogVolume
      && newParentLabel
      && prevMagnifierLabel
      && prevParentLabel
      && prevParentLabel.toUpperCase() === `${newParentLabel} ${prevMagnifierLabel}`.toUpperCase()
    );

    // Hide magnifier and parent button fills — clone circles travel in their place.
    // Stroke rings stay visible (empty) during the animation.
    // Use style.visibility (not display attr) because render() would undo it.
    if (view.magnifierLabel) view.magnifierLabel.style.visibility = 'hidden';
    if (view.magnifierCircle) view.magnifierCircle.style.fill = 'none';
    if (view.parentButtonOuterLabel) view.parentButtonOuterLabel.style.visibility = 'hidden';
    if (view.parentButtonOuter) view.parentButtonOuter.style.fill = 'none';

    // Child Pyramid: animate existing nodes to the hub (off-screen) simultaneously
    // with the reverse migration animation, instead of letting them pop off.
    if (lastPyramidData?.nodes?.length) {
      animatePyramidToHub({
        svgRoot: view.contentGroup || view.svgRoot,
        pyramidNodes: lastPyramidData.nodes,
        hubX: arcParams.hubX,
        hubY: arcParams.hubY,
        pyramidGroup: view.pyramidView?.pyramidGroup
      });
    }

    // Parent's focus-ring nodes: animate inward from off-screen simultaneously
    if (parentRingNodes.length > 0) {
      animateRingInward({
        svgRoot: view.contentGroup || view.svgRoot,
        ringNodes: parentRingNodes,
        hubX: arcParams.hubX,
        hubY: arcParams.hubY,
        arcRadius: arcParams.radius,
        // Keep the magnifier slot empty during INWARD clone animation too.
        skipId: tempSelected?.id ?? null,
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        nodesGroup: view.nodesGroup,
        labelsGroup: view.labelsGroup
      });
    }

    animateOut({
      nodesGroup: view.nodesGroup,
      labelsGroup: view.labelsGroup,
      onComplete: () => {
        setPrimaryItems(items, selectedIndex, preserveOrder);
        // Restore pyramid group visibility — animatePyramidToHub hid it and
        // intentionally did not restore it.  setPrimaryItems → render() has
        // now repainted the children inside the group.
        if (view.pyramidView?.pyramidGroup) {
          view.pyramidView.pyramidGroup.style.opacity = '';
        }
        // If animateRingInward is running (900 ms), it will restore
        // nodesGroup/labelsGroup when it finishes.  But if there were
        // no parent ring nodes to animate inward, restore them here.
        if (parentRingNodes.length === 0) {
          if (view.nodesGroup)  view.nodesGroup.style.opacity = '';
          if (view.labelsGroup) view.labelsGroup.style.opacity = '';
        }
        // Restore magnifier + parent button fills and labels
        if (view.magnifierLabel) view.magnifierLabel.style.visibility = '';
        if (view.magnifierCircle) view.magnifierCircle.style.fill = '';
        if (view.parentButtonOuterLabel) view.parentButtonOuterLabel.style.visibility = '';
        if (view.parentButtonOuter) view.parentButtonOuter.style.fill = '';
      }
    });

    // Parent button → magnifier position (straight line, reverse of IN)
    if (isCatalogSuffixMergeOut) {
      animateVolumeParentUnmerge({
        svgRoot: view.contentGroup || view.svgRoot,
        fromX: magnifier.x,
        fromY: magnifier.y,
        toX: parentButtonX,
        toY: parentButtonY,
        radius: magnifierRadius,
        baseLabel: newParentLabel,
        suffixLabel: prevMagnifierLabel,
        fromAngle: magnifier.angle
      });
    } else {
      animateParentToMagnifier({
        svgRoot: view.contentGroup || view.svgRoot,
        fromX: magnifier.x,
        fromY: magnifier.y,
        toX: parentButtonX,
        toY: parentButtonY,
        radius: magnifierRadius,
        label: prevParentLabel,
        fromAngle: magnifier.angle
      });
    }

    // New parent button: fly in from off-screen radially
    if (newParentLabel && !isCatalogSuffixMergeOut) {
      animateParentButtonInward({
        svgRoot: view.contentGroup || view.svgRoot,
        buttonX: parentButtonX,
        buttonY: parentButtonY,
        radius: magnifierRadius,
        label: newParentLabel,
        hubX: arcParams.hubX,
        hubY: arcParams.hubY,
        arcRadius: arcParams.radius,
        buttonElement: view.parentButtonOuter,
        buttonLabelElement: view.parentButtonOuterLabel
      });
    }
  };

  const shiftLayersOut = () => {
    if (isAnimating()) return; // block during migration animation
    const prevSelected = nav.getCurrent();
    const prevParentLabel = getParentLabel(prevSelected) || '';
    const prevSelectedLabel = formatLabel({ item: prevSelected, context: 'magnifier' }) || '';
    if (typeof onParentClick === 'function') {
      const handled = onParentClick({ selected: nav.getCurrent(), nav, setItems: setPrimaryItems });
      if (handled) {
        // parentHandler replaced primary items via setPrimaryItems, which
        // already reset isLayerOut.  Nothing more to do.
        return;
      }
    }
    if (isLayerOut) return;
    isLayerOut = true;
    lastParentLabelOut = prevParentLabel;
    lastSelectedLabelOut = prevSelectedLabel;
    render(rotation);
  };

  const render = (nextRotation = rotation) => {
    const canTime = typeof performance !== 'undefined' && typeof performance.now === 'function';
    const renderStart = canTime ? performance.now() : null;
    rotation = nextRotation;
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
    const nodes = calculateNodePositions(visible, vp, rotation, nodeRadius, nodeSpacing).map(node => ({
      ...node,
      label: formatLabel({ item: node.item, context: 'node' }),
      labelCentered: Boolean(shouldCenterLabel?.({ item: node.item }))
    }));

    // Detail Sector leaf detection — expand/collapse based on selected item level.
    // forcedDetailOpen allows external callers (e.g. startup featured verse) to
    // open the sector at a non-leaf level; freezeDetailSector prevents the
    // immediately-following render from collapsing it again.
    const isLeaf = leafLevel && selected?.level === leafLevel;
    if ((isLeaf || forcedDetailOpen) && !detailSectorShown && !volumeLogo.animating) {
      detailSectorShown = true;
      forcedDetailOpen = false;
      const savedCb = detailOpenCallback;
      detailOpenCallback = null;
      volumeLogo.expand(arcParams, magnifier.angle, () => {
        emitDetailSectorChange(true, 'after-animation');
        freezeDetailSector = true;
        render(rotation);
        if (typeof savedCb === 'function') savedCb();
      });
    } else if (!isLeaf && detailSectorShown && !volumeLogo.animating) {
      if (freezeDetailSector) {
        // Allow this one post-expansion render to pass without collapsing.
        freezeDetailSector = false;
      } else {
        detailSectorShown = false;
        emitDetailSectorChange(false, 'immediate');
        volumeLogo.collapse(arcParams, magnifier.angle, () => render(rotation));
      }
    }

    // Suppress child pyramid when Detail Sector is shown or animating
    const suppressPyramid = detailSectorShown || volumeLogo.animating;

    // During rotation use the visible node currently closest to the magnifier so
    // the child pyramid refreshes live rather than waiting for a committed snap.
    const pyramidSelected = (() => {
      if (!isRotating || nodes.length === 0) return selected;
      // A cousin gap under the magnifier means no node is selected — the
      // pyramid must empty rather than borrow the nearest neighbor's
      // children. The magnified slot is arithmetic: order = rotation/spacing - 1.
      const nearestSlot = Math.round(rotation / nodeSpacing - 1);
      if (nearestSlot >= 0 && nearestSlot < visible.length && visible[nearestSlot] === null) return null;
      let closest = null;
      let closestDist = Infinity;
      for (const node of nodes) {
        const dist = Math.abs(node.angle - magnifier.angle);
        if (dist < closestDist) {
          closestDist = dist;
          closest = node.item;
        }
      }
      return closest ?? selected;
    })();

    const pyramidData = (() => {
      if (suppressPyramid) return null;
      if (!pyramidConfig) return null;
      try {
        // Pre-fetch children to pass count for dynamic spacing
        let children = [];
        if (typeof pyramidConfig.getChildren === 'function' && pyramidSelected) {
          children = pyramidConfig.getChildren({ selected: pyramidSelected });
        }
        const geo = computeChildPyramidGeometry(vp, magnifier, arcParams, {
          logoBounds: volumeLogo.getBounds(),
          magnifierAngle: magnifier.angle,
          parentId: pyramidSelected?.id ?? '',
          parentSortNumber: pyramidSelected?.order ?? 0,
          childCount: children.length
        });
        if (!geo) return null;
        // Map children onto intersection slots
        let nodes = [];
        let onNodeClick = null;
        if (children.length > 0 && geo.intersections.length > 0) {
            const slots = geo.intersections.slice(0, children.length);
            const nodeR = vp.SSd * NODE_RADIUS_RATIO;
            nodes = slots.map((slot, i) => {
              // Compute angle from hub (focus ring center) to slot for label rotation
              const dx = slot.x - arcParams.hubX;
              const dy = slot.y - arcParams.hubY;
              const angle = Math.atan2(dy, dx);
              return {
                id: children[i].id ?? `p-${i}`,
                label: children[i].name ?? children[i].label ?? children[i].id ?? `p-${i}`,
                item: children[i],
                arc: 'intersection',
                angle,
                x: slot.x,
                y: slot.y,
                r: nodeR
              };
            });
          }
          if (typeof pyramidConfig.onClick === 'function') {
            onNodeClick = instr => pyramidConfig.onClick(instr);
          }
        return { ...geo, nodes, onNodeClick };
      } catch (err) {
        if (debug) console.warn('[FocusRing] pyramid geometry error', err);
        return null;
      }
    })();
    lastPyramidData = pyramidData; // stash for SVG-level click delegation
    // Use the live nearest-to-magnifier node during rotation so the parent
    // button label updates as different items pass through the magnifier.
    // pyramidSelected already falls back to `selected` when not rotating.
    const parentLabel = getParentLabel(pyramidSelected);
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
        viewport: vp,
        debug,
        magnifierAngle: magnifier.angle,
        labelMaskEpsilon,
        onNodeClick: node => rotateNodeIntoMagnifier(node),
        selectedId: selected?.id,
        parentButtons: {
          outerLabel: parentOuterLabel,
          onOuterClick: shiftLayersOut,
          isLayerOut,
          showOuter: parentButtonsVisibility.showOuter
        },
        pyramidData,
        logoBounds: volumeLogo.getBounds()
      }
    );

    if (renderStart !== null && typeof performance !== 'undefined') {
      const elapsed = performance.now() - renderStart;
      const durationMs = Number(elapsed.toFixed(2));
      const overBudget = durationMs > perfRenderBudget;
      emit({ type: 'perf:render', durationMs, budgetMs: perfRenderBudget, overBudget });
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

  const primaryNodeDistance = (fromIndex, toIndex) => {
    if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return 1;
    const total = nav.items.length;
    if (total <= 0) return 1;
    const direct = Math.abs(toIndex - fromIndex);
    if (preserveOrderFlag) return direct;
    return Math.min(direct, total - direct);
  };

  const primaryClickDuration = (fromIndex, toIndex) => {
    const d = primaryNodeDistance(fromIndex, toIndex);
    if (d <= 0) return 0;
    const distance = Math.max(1, d);
    return 1000 * Math.log10(distance) + 250;
  };

  const rotateNodeIntoMagnifier = node => {
    if (!node?.item) return;
    const targetAngle = magnifier.angle;
    const baseAngle = getBaseAngleForOrder(node.item.order, vp, nodeSpacing);
    const desiredRotation = targetAngle - baseAngle;
    const bounds = computeBounds(nav.items);
    const clampedRotation = clampRotation(desiredRotation, bounds);
    const currentIndex = nav.getCurrentIndex();
    const duration = primaryClickDuration(currentIndex, node.index);
    if (typeof window !== 'undefined' && typeof window.__tapDebugLog === 'function') {
      window.__tapDebugLog('rotate-node-into-magnifier', {
        fromIndex: currentIndex,
        toIndex: node.index,
        itemId: node.item?.id || null,
        itemLevel: node.item?.level || null,
        durationMs: Number(duration.toFixed(2))
      });
    }
    nav.selectIndex(node.index);
    isRotating = true;
    animateSnapTo(clampedRotation, duration);
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

  alignToSelected();

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

  render(rotation);

  return {
    nav,
    view,
    choreographer,
    viewport: vp,
    selectNearest,
    beginRotation: () => {
      isRotating = true;
      cancelSnap();
    },
    endRotation: () => {
      selectNearest();
    },
    setPrimaryItems,
    setParentButtons,
    migrateIn,
    migrateOut,
    handlePyramidNodeClick: idx => {
      if (isAnimating()) return; // block clicks during migration animation
      if (!lastPyramidData) return;
      const { nodes, onNodeClick } = lastPyramidData;
      if (!onNodeClick || !nodes || idx < 0 || idx >= nodes.length) return;
      onNodeClick(nodes[idx]);
    },
    refreshPyramid: () => render(rotation),
    // Open the Detail Sector at the current position regardless of leaf level.
    // onOpen is called after the expansion animation completes.
    openDetailSector(onOpen) {
      console.log('[openDetailSector] called | detailSectorShown:', detailSectorShown, '| volumeLogo.animating:', volumeLogo?.animating);
      if (detailSectorShown) {
        if (typeof onOpen === 'function') onOpen();
        return;
      }
      forcedDetailOpen = true;
      if (typeof onOpen === 'function') detailOpenCallback = onOpen;
      render(rotation);
    }
  };
}
