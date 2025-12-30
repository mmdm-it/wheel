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

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIAG_ID = 'childPyramidBoundsDiag';
const DETAIL_SECTOR_DIAG_ID = 'detailSectorBoundsDiag';

/**
 * Show the Child Pyramid bounds as lime green overlay
 */
export function showPyramidBounds() {
  const svg = document.querySelector('svg');
  if (!svg) {
    console.error('❌ Cannot show pyramid bounds - SVG element not found');
    return;
  }

  // Remove existing diagnostic if present
  hidePyramidBounds();

  const viewport = getViewportInfo(window.innerWidth, window.innerHeight);
  const arcParams = getArcParameters(viewport);
  const magnifierAngle = getMagnifierAngle(viewport);
  const magnifierPos = getMagnifierPosition(viewport);

  // SVG uses top-left origin (not centered), so coordinates are positive
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
  
  // Magnifier radius for bottom margin calculation
  const MAGNIFIER_RADIUS_RATIO = 0.060;
  const magnifierRadius = SSd * MAGNIFIER_RADIUS_RATIO;

  // Get logo bounds if available
  const logoBounds = (typeof window !== 'undefined' && window.volumeLogo) 
    ? window.volumeLogo.getBounds() 
    : null;
  
  // Apply margins
  const effectiveTopY = topY + topMargin;
  const effectiveRightX = rightX - rightMargin;
  
  // Crop CPUA at magnifier Y position, plus additional 1.5 * magnifier radius margin
  const effectiveBottomY = Math.min(bottomY, magnifierPos.y - (1.5 * magnifierRadius));

  // Create diagnostic group
  const diagGroup = document.createElementNS(SVG_NS, 'g');
  diagGroup.setAttribute('id', DIAG_ID);

  // Create filled region representing usable area (intersection of rect and circle)
  // Using SVG clipPath to clip the rectangle by the circle
  const clipPathId = 'pyramidBoundsClip';
  const clipPath = document.createElementNS(SVG_NS, 'clipPath');
  clipPath.setAttribute('id', clipPathId);
  
  const clipCircle = document.createElementNS(SVG_NS, 'circle');
  clipCircle.setAttribute('cx', ringCenterX);
  clipCircle.setAttribute('cy', ringCenterY);
  clipCircle.setAttribute('r', innerRadius);
  clipPath.appendChild(clipCircle);
  diagGroup.appendChild(clipPath);

  // Create CPUA filled area (DSUA minus logo exclusion if present)
  if (logoBounds) {
    // L-shaped CPUA: Create a path that excludes the logo square
    // This is the red filled area minus the upper-right logo square
    const cpuaPath = document.createElementNS(SVG_NS, 'path');
    
    // Draw L-shape: main rect with logo square cut out from upper-right
    const pathData = `
      M ${leftX},${effectiveTopY}
      L ${logoBounds.left},${effectiveTopY}
      L ${logoBounds.left},${logoBounds.bottom}
      L ${effectiveRightX},${logoBounds.bottom}
      L ${effectiveRightX},${effectiveBottomY}
      L ${leftX},${effectiveBottomY}
      Z
    `;
    
    cpuaPath.setAttribute('d', pathData);
    cpuaPath.setAttribute('fill', 'red');
    cpuaPath.setAttribute('fill-opacity', '0.2');
    cpuaPath.setAttribute('clip-path', `url(#${clipPathId})`);
    diagGroup.appendChild(cpuaPath);
    
    // Draw outline of CPUA (L-shape)
    const cpuaOutline = document.createElementNS(SVG_NS, 'path');
    cpuaOutline.setAttribute('d', pathData);
    cpuaOutline.setAttribute('fill', 'none');
    cpuaOutline.setAttribute('stroke', 'red');
    cpuaOutline.setAttribute('stroke-width', '2');
    diagGroup.appendChild(cpuaOutline);
    
    // Draw the excluded logo square outline
    const logoRect = document.createElementNS(SVG_NS, 'rect');
    logoRect.setAttribute('x', logoBounds.left);
    logoRect.setAttribute('y', logoBounds.top);
    logoRect.setAttribute('width', logoBounds.boxSize);
    logoRect.setAttribute('height', logoBounds.boxSize);
    logoRect.setAttribute('fill', 'none');
    logoRect.setAttribute('stroke', 'orange');
    logoRect.setAttribute('stroke-width', '2');
    logoRect.setAttribute('stroke-dasharray', '5,5');
    diagGroup.appendChild(logoRect);
    
    // Add label for excluded area
    const excludedLabel = document.createElementNS(SVG_NS, 'text');
    excludedLabel.setAttribute('x', logoBounds.centerX);
    excludedLabel.setAttribute('y', logoBounds.centerY);
    excludedLabel.setAttribute('fill', 'orange');
    excludedLabel.setAttribute('font-size', '14');
    excludedLabel.setAttribute('font-weight', 'bold');
    excludedLabel.setAttribute('text-anchor', 'middle');
    excludedLabel.setAttribute('dominant-baseline', 'middle');
    excludedLabel.textContent = 'LOGO';
    diagGroup.appendChild(excludedLabel);
  } else {
    // No logo: simple rectangle CPUA
    const filledRect = document.createElementNS(SVG_NS, 'rect');
    filledRect.setAttribute('x', leftX);
    filledRect.setAttribute('y', effectiveTopY);
    filledRect.setAttribute('width', effectiveRightX - leftX);
    filledRect.setAttribute('height', effectiveBottomY - effectiveTopY);
    filledRect.setAttribute('fill', 'red');
    filledRect.setAttribute('fill-opacity', '0.2');
    filledRect.setAttribute('clip-path', `url(#${clipPathId})`);
    diagGroup.appendChild(filledRect);
    
    // Draw outline
    const effectiveRect = document.createElementNS(SVG_NS, 'rect');
    effectiveRect.setAttribute('x', leftX);
    effectiveRect.setAttribute('y', effectiveTopY);
    effectiveRect.setAttribute('width', effectiveRightX - leftX);
    effectiveRect.setAttribute('height', effectiveBottomY - effectiveTopY);
    effectiveRect.setAttribute('fill', 'none');
    effectiveRect.setAttribute('stroke', 'red');
    effectiveRect.setAttribute('stroke-width', '2');
    diagGroup.appendChild(effectiveRect);
  }

  // Draw the Focus Ring arc (inner edge with margin)
  const arcCircle = document.createElementNS(SVG_NS, 'circle');
  arcCircle.setAttribute('cx', ringCenterX);
  arcCircle.setAttribute('cy', ringCenterY);
  arcCircle.setAttribute('r', innerRadius);
  arcCircle.setAttribute('fill', 'none');
  arcCircle.setAttribute('stroke', 'red');
  arcCircle.setAttribute('stroke-width', '2');
  arcCircle.setAttribute('stroke-dasharray', '8,4');
  diagGroup.appendChild(arcCircle);

  // Mark ring center with X
  const centerMarkerSize = 15;
  const centerX1 = document.createElementNS(SVG_NS, 'line');
  centerX1.setAttribute('x1', ringCenterX - centerMarkerSize);
  centerX1.setAttribute('y1', ringCenterY - centerMarkerSize);
  centerX1.setAttribute('x2', ringCenterX + centerMarkerSize);
  centerX1.setAttribute('y2', ringCenterY + centerMarkerSize);
  centerX1.setAttribute('stroke', 'red');
  centerX1.setAttribute('stroke-width', '2');
  diagGroup.appendChild(centerX1);

  const centerX2 = document.createElementNS(SVG_NS, 'line');
  centerX2.setAttribute('x1', ringCenterX - centerMarkerSize);
  centerX2.setAttribute('y1', ringCenterY + centerMarkerSize);
  centerX2.setAttribute('x2', ringCenterX + centerMarkerSize);
  centerX2.setAttribute('y2', ringCenterY - centerMarkerSize);
  centerX2.setAttribute('stroke', 'red');
  centerX2.setAttribute('stroke-width', '2');
  diagGroup.appendChild(centerX2);

  // Calculate and mark intersection points
  const intersections = [];

  // Top edge intersections
  const dyTop = effectiveTopY - ringCenterY;
  const discTop = innerRadius * innerRadius - dyTop * dyTop;
  if (discTop >= 0) {
    const sqrtTop = Math.sqrt(discTop);
    const x1 = ringCenterX - sqrtTop;
    const x2 = ringCenterX + sqrtTop;
    if (x1 >= leftX && x1 <= effectiveRightX) intersections.push({ x: x1, y: effectiveTopY, edge: 'top' });
    if (x2 >= leftX && x2 <= effectiveRightX && x2 !== x1) intersections.push({ x: x2, y: effectiveTopY, edge: 'top' });
  }

  // Right edge intersections
  const dxRight = effectiveRightX - ringCenterX;
  const discRight = innerRadius * innerRadius - dxRight * dxRight;
  if (discRight >= 0) {
    const sqrtRight = Math.sqrt(discRight);
    const y1 = ringCenterY - sqrtRight;
    const y2 = ringCenterY + sqrtRight;
    if (y1 >= effectiveTopY && y1 <= effectiveBottomY) intersections.push({ x: effectiveRightX, y: y1, edge: 'right' });
    if (y2 >= effectiveTopY && y2 <= effectiveBottomY && y2 !== y1) intersections.push({ x: effectiveRightX, y: y2, edge: 'right' });
  }

  // Mark intersection points
  intersections.forEach(pt => {
    const marker = document.createElementNS(SVG_NS, 'circle');
    marker.setAttribute('cx', pt.x);
    marker.setAttribute('cy', pt.y);
    marker.setAttribute('r', 6);
    marker.setAttribute('fill', 'red');
    diagGroup.appendChild(marker);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', pt.x + 10);
    label.setAttribute('y', pt.y + 5);
    label.setAttribute('fill', 'red');
    label.setAttribute('font-size', '12');
    label.textContent = `${pt.edge}(${pt.x.toFixed(0)},${pt.y.toFixed(0)})`;
    diagGroup.appendChild(label);
  });

  // Add center label
  const centerLabel = document.createElementNS(SVG_NS, 'text');
  centerLabel.setAttribute('x', ringCenterX + 20);
  centerLabel.setAttribute('y', ringCenterY + 5);
  centerLabel.setAttribute('fill', 'red');
  centerLabel.setAttribute('font-size', '12');
  centerLabel.textContent = `CENTER(${ringCenterX.toFixed(0)},${ringCenterY.toFixed(0)})`;
  diagGroup.appendChild(centerLabel);

  // Add magnifier angle indicator
  const magnifierDeg = (magnifierAngle * 180 / Math.PI).toFixed(1);
  const magnifierLabel = document.createElementNS(SVG_NS, 'text');
  magnifierLabel.setAttribute('x', leftX + 10);
  magnifierLabel.setAttribute('y', effectiveTopY + 20);
  magnifierLabel.setAttribute('fill', 'red');
  magnifierLabel.setAttribute('font-size', '12');
  magnifierLabel.textContent = `Magnifier: ${magnifierDeg}°`;
  diagGroup.appendChild(magnifierLabel);

  svg.appendChild(diagGroup);

  console.log('📐 Child Pyramid bounds diagnostic displayed (red)');
  console.log('   - Ring center:', `(${ringCenterX.toFixed(0)}, ${ringCenterY.toFixed(0)})`);
  console.log('   - Inner radius:', innerRadius.toFixed(0));
  console.log('   - Magnifier angle:', magnifierDeg + '°');
  console.log('   - Call hidePyramidBounds() to remove');
}

/**
 * Hide the Child Pyramid bounds diagnostic
 */
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

  // Margins
  const SSd = viewport.SSd;
  const marginPercent = 0.03;
  const topMargin = SSd * marginPercent;
  const rightMargin = SSd * marginPercent;
  
  const MAGNIFIER_RADIUS_RATIO = 0.060;
  const magnifierRadius = SSd * MAGNIFIER_RADIUS_RATIO;

  // Detail Sector area (placeholder - will be refined later)
  const effectiveTopY = topY + topMargin;
  const effectiveRightX = rightX - rightMargin;
  const effectiveBottomY = Math.min(bottomY, magnifierPos.y - (1.5 * magnifierRadius));

  // Create diagnostic group
  const diagGroup = document.createElementNS(SVG_NS, 'g');
  diagGroup.setAttribute('id', DETAIL_SECTOR_DIAG_ID);

  // Blue rectangle showing Detail Sector bounds
  const dsRect = document.createElementNS(SVG_NS, 'rect');
  dsRect.setAttribute('x', leftX);
  dsRect.setAttribute('y', effectiveTopY);
  dsRect.setAttribute('width', effectiveRightX - leftX);
  dsRect.setAttribute('height', effectiveBottomY - effectiveTopY);
  dsRect.setAttribute('fill', 'blue');
  dsRect.setAttribute('fill-opacity', '0.1');
  dsRect.setAttribute('stroke', 'blue');
  dsRect.setAttribute('stroke-width', '2');
  dsRect.setAttribute('stroke-dasharray', '5,5');
  diagGroup.appendChild(dsRect);

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
