/**
 * Child Pyramid Bounds Diagnostic
 * Visualizes the usable area for Child Pyramid spiral layout
 * 
 * Usage from browser console:
 *   showPyramidBounds()       - Display Child Pyramid bounds (red)
 *   hidePyramidBounds()       - Remove Child Pyramid bounds
 *   showDetailSectorBounds()  - Display Detail Sector bounds (blue)
 *   hideDetailSectorBounds()  - Remove Detail Sector bounds
 */

import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { getArcParameters, getMagnifierAngle, getMagnifierPosition } from '../geometry/focus-ring-geometry.js';
import { computeCPUA, traceFence } from '../geometry/usable-areas.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIAG_ID = 'childPyramidBoundsDiag';
const DETAIL_SECTOR_DIAG_ID = 'detailSectorBoundsDiag';

/**
 * Show the Child Pyramid bounds as lime green overlay
 */
export function showPyramidBounds() {
  const svg = document.querySelector('svg');
  if (!svg) return;
  hidePyramidBounds();

  // THE FENCE: one closed polygon staking out the CPUA (Howell 2026-07-19 —
  // "just give me the fence"). Traced by the canon itself (usable-areas.js).
  const viewport = getViewportInfo(window.innerWidth, window.innerHeight);
  const arcParams = getArcParameters(viewport);
  const mag = getMagnifierPosition(viewport);
  const cpua = computeCPUA(viewport, arcParams, mag, {
    logoBounds: (typeof window !== 'undefined' && window.volumeLogo)
      ? window.volumeLogo.getBounds()
      : null
  });

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('id', DIAG_ID);
  // Solid = the fence (DSUA, and the CPUA's outer boundary — one law).
  const fence = document.createElementNS(SVG_NS, 'path');
  fence.setAttribute('d', traceFence(cpua));
  fence.setAttribute('fill', 'none');
  fence.setAttribute('stroke', 'limegreen');
  fence.setAttribute('stroke-width', '2.5');
  fence.setAttribute('stroke-linejoin', 'round');
  g.appendChild(fence);
  // Dashed = the conditional logo box (CPUA-only territory loss; volumes
  // without a logo have none — there the CPUA IS the DSUA).
  if (cpua.logoBounds) {
    const lb = cpua.logoBounds;
    const box = document.createElementNS(SVG_NS, 'rect');
    box.setAttribute('x', lb.left);
    box.setAttribute('y', Math.max(lb.top, cpua.top));
    box.setAttribute('width', Math.max(0, Math.min(lb.right, cpua.right) - lb.left));
    box.setAttribute('height', Math.max(0, lb.bottom - Math.max(lb.top, cpua.top)));
    box.setAttribute('fill', 'none');
    box.setAttribute('stroke', 'limegreen');
    box.setAttribute('stroke-width', '2');
    box.setAttribute('stroke-dasharray', '7 6');
    g.appendChild(box);
  }

  g.style.pointerEvents = 'none';
  svg.appendChild(g);
}

export function hidePyramidBounds() {
  const existing = document.getElementById(DIAG_ID);
  if (existing) {
    existing.remove();
    console.log('📐 Child Pyramid bounds diagnostic hidden');
  }
}

/**
 * Show the Detail Sector bounds as blue overlay
 */
export function showDetailSectorBounds() {
  const svg = document.querySelector('svg');
  if (!svg) {
    console.error('❌ Cannot show detail sector bounds - SVG element not found');
    return;
  }

  // Remove existing diagnostic if present
  hideDetailSectorBounds();

  const viewport = getViewportInfo(window.innerWidth, window.innerHeight);
  const arcParams = getArcParameters(viewport);
  const magnifierAngle = getMagnifierAngle(viewport);
  const magnifierPos = getMagnifierPosition(viewport);

  // SVG uses top-left origin
  const topY = 0;
  const rightX = viewport.width;
  const bottomY = viewport.height;
  const leftX = 0;

  // Focus Ring parameters
  const ringCenterX = arcParams.hubX;
  const ringCenterY = arcParams.hubY;
  const ringRadius = arcParams.radius;

  // Inner radius with margin (98% of ring radius)
  const innerRadius = ringRadius * 0.98;

  // Dynamic margins based on SSd (3%)
  const SSd = viewport.SSd;
  const marginPercent = 0.03;
  const topMargin = SSd * marginPercent;
  const rightMargin = SSd * marginPercent;
  
  const MAGNIFIER_RADIUS_RATIO = 0.060;
  const magnifierRadius = SSd * MAGNIFIER_RADIUS_RATIO;

  // Get logo bounds if available
  const logoBounds = (typeof window !== 'undefined' && window.volumeLogo) 
    ? window.volumeLogo.getBounds() 
    : null;

  // Apply margins
  const effectiveTopY = topY + topMargin;
  const effectiveRightX = rightX - rightMargin;
  const effectiveBottomY = Math.min(bottomY, magnifierPos.y - (4 * magnifierRadius));

  // Create diagnostic group
  const diagGroup = document.createElementNS(SVG_NS, 'g');
  diagGroup.setAttribute('id', DETAIL_SECTOR_DIAG_ID);

  // Create clip path (same as CPUA - follows Focus Ring arc)
  const clipPathId = 'detailSectorBoundsClip';
  const clipPath = document.createElementNS(SVG_NS, 'clipPath');
  clipPath.setAttribute('id', clipPathId);
  
  const clipCircle = document.createElementNS(SVG_NS, 'circle');
  clipCircle.setAttribute('cx', ringCenterX);
  clipCircle.setAttribute('cy', ringCenterY);
  clipCircle.setAttribute('r', innerRadius);
  clipPath.appendChild(clipCircle);
  diagGroup.appendChild(clipPath);

  // Create Detail Sector filled area (full rectangle - NO logo cutout)
  // This is DSUA = full Detail Sector Usable Area
  // CPUA (red) = DSUA minus logo exclusion square
  const filledRect = document.createElementNS(SVG_NS, 'rect');
  filledRect.setAttribute('x', leftX);
  filledRect.setAttribute('y', effectiveTopY);
  filledRect.setAttribute('width', effectiveRightX - leftX);
  filledRect.setAttribute('height', effectiveBottomY - effectiveTopY);
  filledRect.setAttribute('fill', 'blue');
  filledRect.setAttribute('fill-opacity', '0.1');
  filledRect.setAttribute('clip-path', `url(#${clipPathId})`);
  diagGroup.appendChild(filledRect);
  
  // Draw outline
  const effectiveRect = document.createElementNS(SVG_NS, 'rect');
  effectiveRect.setAttribute('x', leftX);
  effectiveRect.setAttribute('y', effectiveTopY);
  effectiveRect.setAttribute('width', effectiveRightX - leftX);
  effectiveRect.setAttribute('height', effectiveBottomY - effectiveTopY);
  effectiveRect.setAttribute('fill', 'none');
  effectiveRect.setAttribute('stroke', 'blue');
  effectiveRect.setAttribute('stroke-width', '2');
  effectiveRect.setAttribute('stroke-dasharray', '5,5');
  diagGroup.appendChild(effectiveRect);

  // Draw the Focus Ring arc (inner edge with margin)
  const arcCircle = document.createElementNS(SVG_NS, 'circle');
  arcCircle.setAttribute('cx', ringCenterX);
  arcCircle.setAttribute('cy', ringCenterY);
  arcCircle.setAttribute('r', innerRadius);
  arcCircle.setAttribute('fill', 'none');
  arcCircle.setAttribute('stroke', 'blue');
  arcCircle.setAttribute('stroke-width', '2');
  arcCircle.setAttribute('stroke-dasharray', '8,4');
  diagGroup.appendChild(arcCircle);

  // Label
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('x', leftX + 10);
  label.setAttribute('y', effectiveTopY + 40);
  label.setAttribute('fill', 'blue');
  label.setAttribute('font-size', '14');
  label.setAttribute('font-weight', 'bold');
  label.textContent = 'DETAIL SECTOR';
  diagGroup.appendChild(label);

  svg.appendChild(diagGroup);

  console.log('📐 Detail Sector bounds diagnostic displayed (blue)');
  console.log('   - Full rectangular area (DSUA)');
  console.log('   - CPUA (red) = DSUA minus logo exclusion');
  console.log('   - Call hideDetailSectorBounds() to remove');
}

/**
 * Hide the Detail Sector bounds diagnostic
 */
export function hideDetailSectorBounds() {
  const existing = document.getElementById(DETAIL_SECTOR_DIAG_ID);
  if (existing) {
    existing.remove();
    console.log('📐 Detail Sector bounds diagnostic hidden');
  }
}

// Expose to global window for console access
if (typeof window !== 'undefined') {
  window.showPyramidBounds = showPyramidBounds;
  window.hidePyramidBounds = hidePyramidBounds;
  window.showDetailSectorBounds = showDetailSectorBounds;
  window.hideDetailSectorBounds = hideDetailSectorBounds;
}
