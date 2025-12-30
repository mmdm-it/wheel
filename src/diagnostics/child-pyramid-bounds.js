/**
 * Child Pyramid Bounds Diagnostic
 * Visualizes the usable area for Child Pyramid spiral layout
 * 
 * Usage from browser console:
 *   showPyramidBounds()  - Display lime green boundary visualization
 *   hidePyramidBounds()  - Remove the visualization
 */

import { getViewportInfo } from '../geometry/focus-ring-geometry.js';
import { getArcParameters, getMagnifierAngle } from '../geometry/focus-ring-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIAG_ID = 'childPyramidBoundsDiag';

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

  // Apply margins
  const effectiveTopY = topY + topMargin;
  const effectiveRightX = rightX - rightMargin;

  // Create diagnostic group
  const diagGroup = document.createElementNS(SVG_NS, 'g');
  diagGroup.setAttribute('id', DIAG_ID);

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

  // Draw effective content boundary (with margins)
  const effectiveRect = document.createElementNS(SVG_NS, 'rect');
  effectiveRect.setAttribute('x', leftX);
  effectiveRect.setAttribute('y', effectiveTopY);
  effectiveRect.setAttribute('width', effectiveRightX - leftX);
  effectiveRect.setAttribute('height', bottomY - effectiveTopY);
  effectiveRect.setAttribute('fill', 'none');
  effectiveRect.setAttribute('stroke', 'red');
  effectiveRect.setAttribute('stroke-width', '2');
  diagGroup.appendChild(effectiveRect);

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
    if (y1 >= effectiveTopY && y1 <= bottomY) intersections.push({ x: effectiveRightX, y: y1, edge: 'right' });
    if (y2 >= effectiveTopY && y2 <= bottomY && y2 !== y1) intersections.push({ x: effectiveRightX, y: y2, edge: 'right' });
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

// Expose to global window for console access
if (typeof window !== 'undefined') {
  window.showPyramidBounds = showPyramidBounds;
  window.hidePyramidBounds = hidePyramidBounds;
}
