/**
 * Detail Sector Geometry Module
 * Handles geometric calculations, content bounds, and line positioning
 * 
 * Responsibilities:
 * - Calculate usable content bounds within Focus Ring arc
 * - Build line position tables for text wrapping along arc
 * - Provide diagnostic visualization of bounds
 * - Handle dynamic margin calculations
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

export class DetailSectorGeometry {
    constructor(viewportManager) {
        this.viewport = viewportManager;
    }

    /**
     * Calculate the usable content bounds for the Detail Sector
     * Returns the bounding box within the Focus Ring arc, with margins
     */
    getContentBounds() {
        const viewport = this.viewport.getViewportInfo();
        const arcParams = this.viewport.getArcParameters();
        
        // Viewport bounds in SVG coordinates (origin at center)
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;
        const topY = -halfHeight;
        const rightX = halfWidth;
        const bottomY = halfHeight;
        const leftX = -halfWidth;
        
        // Focus Ring parameters
        const ringCenterX = arcParams.centerX;
        const ringCenterY = arcParams.centerY;
        const ringRadius = arcParams.radius;
        
        // Focus Ring band is drawn at 99%-101% of radius
        // Text margin should be inside the inner edge (98% for margin)
        const innerRadius = ringRadius * 0.98;
        
        // Dynamic margins based on shorter side (SSd) - 3% of shorter side
        const SSd = viewport.SSd;
        const marginPercent = 0.03;
        const topMargin = SSd * marginPercent;
        const rightMargin = SSd * marginPercent;
        
        // Apply margins to viewport bounds
        const effectiveTopY = topY + topMargin;
        const effectiveRightX = rightX - rightMargin;
        
        // Find intersection of arc with effective top edge
        const dyTop = effectiveTopY - ringCenterY;
        const discTop = innerRadius * innerRadius - dyTop * dyTop;
        let arcLeftAtTop = leftX;
        if (discTop >= 0) {
            const sqrtTop = Math.sqrt(discTop);
            arcLeftAtTop = Math.max(leftX, ringCenterX - sqrtTop);
        }
        
        // Find intersection of arc with effective right edge
        const dxRight = effectiveRightX - ringCenterX;
        const discRight = innerRadius * innerRadius - dxRight * dxRight;
        let arcTopAtRight = effectiveTopY;
        if (discRight >= 0) {
            const sqrtRight = Math.sqrt(discRight);
            arcTopAtRight = Math.max(effectiveTopY, ringCenterY - sqrtRight);
        }
        
        return {
            // Usable rectangle (conservative estimate inside the arc)
            topY: effectiveTopY,
            bottomY: bottomY,
            leftX: arcLeftAtTop, // Left edge constrained by arc at top
            rightX: effectiveRightX,
            // Raw values for advanced positioning
            arcCenterX: ringCenterX,
            arcCenterY: ringCenterY,
            arcRadius: innerRadius,
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
            SSd: SSd
        };
    }

    /**
     * Build a table of line positions with per-line available width
     * Each line's left boundary is calculated from the arc intersection at that Y position
     * @param {Object} bounds - Content bounds from getContentBounds()
     * @param {number} fontSize - Font size for line height calculation
     * @param {number} maxLines - Maximum number of lines to compute
     * @param {number} charWidthRatio - Character width as ratio of fontSize (0.45 for large, 0.35 for small)
     * @returns {Array} Array of {y, leftX, rightX, availableWidth, maxChars}
     */
    buildLineTable(bounds, fontSize, maxLines = 20, charWidthRatio = 0.45) {
        const lineHeight = fontSize * 1.4;
        // charWidth ratio varies by font tier: 0.45 for 30px, 0.35 for 22px
        const charWidth = fontSize * charWidthRatio;
        const startY = bounds.topY + (fontSize * 1.5);
        const rightX = bounds.rightX - (bounds.SSd * 0.05); // 5% SSd padding from right
        
        const lineTable = [];
        
        for (let i = 0; i < maxLines; i++) {
            const y = startY + (i * lineHeight);
            
            // Stop if we've gone past the usable vertical area
            if (y > bounds.bottomY - fontSize) break;
            
            // Calculate arc intersection at this Y position
            // Arc equation: (x - centerX)² + (y - centerY)² = radius²
            // Solve for x: x = centerX - sqrt(radius² - (y - centerY)²)
            const dy = y - bounds.arcCenterY;
            const discriminant = bounds.arcRadius * bounds.arcRadius - dy * dy;
            
            let leftX;
            if (discriminant >= 0) {
                // Arc intersects this horizontal line
                const sqrtDisc = Math.sqrt(discriminant);
                leftX = bounds.arcCenterX - sqrtDisc;
                // Add padding so text sits inside the arc
                leftX += bounds.SSd * 0.03;
            } else {
                // Y is outside arc range - use viewport left edge
                leftX = -bounds.viewportWidth / 2 + (bounds.SSd * 0.03);
            }
            
            const availableWidth = rightX - leftX;
            const maxChars = Math.max(10, Math.floor(availableWidth / charWidth));
            
            lineTable.push({
                y,
                leftX,
                rightX,
                availableWidth,
                maxChars
            });
        }
        
        return lineTable;
    }

    /**
     * Word-wrap text using per-line character limits from line table
     * Returns array of {text, lineIndex} for each wrapped line
     */
    wrapTextWithLineTable(text, lineTable) {
        if (!text || !lineTable.length) return [];
        
        const words = String(text).split(/\s+/);
        const wrappedLines = [];
        let lineIndex = 0;
        let currentLine = '';
        
        for (const word of words) {
            if (lineIndex >= lineTable.length) {
                // No more lines available - truncate
                break;
            }
            
            const maxChars = lineTable[lineIndex].maxChars;
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            
            if (candidate.length > maxChars && currentLine) {
                // Current line is full - save it and start new line
                wrappedLines.push({ text: currentLine, lineIndex });
                lineIndex++;
                currentLine = word;
                
                // Check if single word exceeds next line's limit
                if (lineIndex < lineTable.length && word.length > lineTable[lineIndex].maxChars) {
                    // Word too long - truncate it
                    currentLine = word.substring(0, lineTable[lineIndex].maxChars - 3) + '...';
                }
            } else {
                currentLine = candidate;
            }
        }
        
        // Don't forget the last line
        if (currentLine && lineIndex < lineTable.length) {
            wrappedLines.push({ text: currentLine, lineIndex });
        }
        
        return wrappedLines;
    }

    /**
     * DIAGNOSTIC: Visualize the Detail Sector bounding area
     * Shows the usable content region bounded by:
     * - Inner arc of Focus Ring
     * - Top edge of viewport
     * - Right edge of viewport
     * 
     * Call this method to see the actual available space for Detail Sector content
     */
    showBounds(mainGroup) {
        const SVG_NS = MOBILE_CONFIG.SVG_NS;
        
        if (!mainGroup) {
            Logger.error('Cannot show Detail Sector bounds - mainGroup not found');
            return;
        }
        
        // Remove any existing diagnostic elements
        const existing = document.getElementById('detailSectorBoundsDiag');
        if (existing) existing.remove();
        
        const diagGroup = document.createElementNS(SVG_NS, 'g');
        diagGroup.setAttribute('id', 'detailSectorBoundsDiag');
        
        // Get viewport and arc parameters
        const viewport = this.viewport.getViewportInfo();
        const arcParams = this.viewport.getArcParameters();
        
        // Viewport bounds in SVG coordinates (origin at center)
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;
        const topY = -halfHeight;
        const rightX = halfWidth;
        const bottomY = halfHeight;
        const leftX = -halfWidth;
        
        // Focus Ring parameters
        const ringCenterX = arcParams.centerX;
        const ringCenterY = arcParams.centerY;
        const ringRadius = arcParams.radius;
        
        // Calculate the text margin arc inside the Focus Ring band
        // Using 98% to provide margin from the 99% inner edge of the Focus Ring band
        const innerRadius = ringRadius * 0.98;
        
        // Dynamic margins based on shorter side (SSd) - same approach as Detail Sector circle
        const SSd = viewport.SSd;
        const marginPercent = 0.03; // 3% of shorter side
        const topMargin = SSd * marginPercent;
        const rightMargin = SSd * marginPercent;
        
        // Apply margins to viewport bounds
        const effectiveTopY = topY + topMargin;
        const effectiveRightX = rightX - rightMargin;
        
        // Find ALL intersection points of the inner Focus Ring arc with EFFECTIVE viewport edges
        const intersections = [];
        
        // Check EFFECTIVE TOP edge (y = effectiveTopY)
        const dyTop = effectiveTopY - ringCenterY;
        const discTop = innerRadius * innerRadius - dyTop * dyTop;
        if (discTop >= 0) {
            const sqrtTop = Math.sqrt(discTop);
            const x1 = ringCenterX - sqrtTop;
            const x2 = ringCenterX + sqrtTop;
            if (x1 >= leftX && x1 <= effectiveRightX) intersections.push({x: x1, y: effectiveTopY, edge: 'top'});
            if (x2 >= leftX && x2 <= effectiveRightX && x2 !== x1) intersections.push({x: x2, y: effectiveTopY, edge: 'top'});
        }
        
        // Check BOTTOM edge (y = bottomY) - no margin on bottom
        const dyBottom = bottomY - ringCenterY;
        const discBottom = innerRadius * innerRadius - dyBottom * dyBottom;
        if (discBottom >= 0) {
            const sqrtBottom = Math.sqrt(discBottom);
            const x1 = ringCenterX - sqrtBottom;
            const x2 = ringCenterX + sqrtBottom;
            if (x1 >= leftX && x1 <= effectiveRightX) intersections.push({x: x1, y: bottomY, edge: 'bottom'});
            if (x2 >= leftX && x2 <= effectiveRightX && x2 !== x1) intersections.push({x: x2, y: bottomY, edge: 'bottom'});
        }
        
        // Check LEFT edge (x = leftX) - no margin on left
        const dxLeft = leftX - ringCenterX;
        const discLeft = innerRadius * innerRadius - dxLeft * dxLeft;
        if (discLeft >= 0) {
            const sqrtLeft = Math.sqrt(discLeft);
            const y1 = ringCenterY - sqrtLeft;
            const y2 = ringCenterY + sqrtLeft;
            if (y1 >= effectiveTopY && y1 <= bottomY) intersections.push({x: leftX, y: y1, edge: 'left'});
            if (y2 >= effectiveTopY && y2 <= bottomY && y2 !== y1) intersections.push({x: leftX, y: y2, edge: 'left'});
        }
        
        // Check EFFECTIVE RIGHT edge (x = effectiveRightX)
        const dxRight = effectiveRightX - ringCenterX;
        const discRight = innerRadius * innerRadius - dxRight * dxRight;
        if (discRight >= 0) {
            const sqrtRight = Math.sqrt(discRight);
            const y1 = ringCenterY - sqrtRight;
            const y2 = ringCenterY + sqrtRight;
            if (y1 >= effectiveTopY && y1 <= bottomY) intersections.push({x: effectiveRightX, y: y1, edge: 'right'});
            if (y2 >= effectiveTopY && y2 <= bottomY && y2 !== y1) intersections.push({x: effectiveRightX, y: y2, edge: 'right'});
        }
        
        // Draw the Focus Ring arc (inner edge with margin) 
        const arcPath = document.createElementNS(SVG_NS, 'circle');
        arcPath.setAttribute('cx', ringCenterX);
        arcPath.setAttribute('cy', ringCenterY);
        arcPath.setAttribute('r', innerRadius);
        arcPath.setAttribute('fill', 'none');
        arcPath.setAttribute('stroke', 'lime');
        arcPath.setAttribute('stroke-width', '2');
        arcPath.setAttribute('stroke-dasharray', '8,4');
        diagGroup.appendChild(arcPath);
        
        // Draw EFFECTIVE content boundary (with margins applied)
        const effectiveRect = document.createElementNS(SVG_NS, 'rect');
        effectiveRect.setAttribute('x', leftX);
        effectiveRect.setAttribute('y', effectiveTopY);
        effectiveRect.setAttribute('width', effectiveRightX - leftX);
        effectiveRect.setAttribute('height', bottomY - effectiveTopY);
        effectiveRect.setAttribute('fill', 'none');
        effectiveRect.setAttribute('stroke', 'lime');
        effectiveRect.setAttribute('stroke-width', '2');
        diagGroup.appendChild(effectiveRect);
        
        // Mark ring center with an X
        const centerMarkerSize = 15;
        const centerX1 = document.createElementNS(SVG_NS, 'line');
        centerX1.setAttribute('x1', ringCenterX - centerMarkerSize);
        centerX1.setAttribute('y1', ringCenterY - centerMarkerSize);
        centerX1.setAttribute('x2', ringCenterX + centerMarkerSize);
        centerX1.setAttribute('y2', ringCenterY + centerMarkerSize);
        centerX1.setAttribute('stroke', 'lime');
        centerX1.setAttribute('stroke-width', '2');
        diagGroup.appendChild(centerX1);
        
        const centerX2 = document.createElementNS(SVG_NS, 'line');
        centerX2.setAttribute('x1', ringCenterX - centerMarkerSize);
        centerX2.setAttribute('y1', ringCenterY + centerMarkerSize);
        centerX2.setAttribute('x2', ringCenterX + centerMarkerSize);
        centerX2.setAttribute('y2', ringCenterY - centerMarkerSize);
        centerX2.setAttribute('stroke', 'lime');
        centerX2.setAttribute('stroke-width', '2');
        diagGroup.appendChild(centerX2);
        
        // Mark all intersection points
        intersections.forEach((pt, i) => {
            const marker = document.createElementNS(SVG_NS, 'circle');
            marker.setAttribute('cx', pt.x);
            marker.setAttribute('cy', pt.y);
            marker.setAttribute('r', 6);
            marker.setAttribute('fill', 'lime');
            diagGroup.appendChild(marker);
            
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', pt.x + 10);
            label.setAttribute('y', pt.y + 5);
            label.setAttribute('fill', 'lime');
            label.setAttribute('font-size', '12px');
            label.setAttribute('font-family', 'monospace');
            label.textContent = `${pt.edge}(${pt.x.toFixed(0)},${pt.y.toFixed(0)})`;
            diagGroup.appendChild(label);
        });
        
        // Add label for ring center
        const centerLabel = document.createElementNS(SVG_NS, 'text');
        centerLabel.setAttribute('x', ringCenterX + 20);
        centerLabel.setAttribute('y', ringCenterY + 5);
        centerLabel.setAttribute('fill', 'lime');
        centerLabel.setAttribute('font-size', '12px');
        centerLabel.setAttribute('font-family', 'monospace');
        centerLabel.textContent = `CENTER(${ringCenterX.toFixed(0)},${ringCenterY.toFixed(0)})`;
        diagGroup.appendChild(centerLabel);
        
        mainGroup.appendChild(diagGroup);
        
        Logger.info('📐 Detail Sector bounds diagnostic displayed (lime green outline)');
        
        return {
            viewport: {topY, bottomY, leftX, rightX},
            ring: {centerX: ringCenterX, centerY: ringCenterY, innerRadius},
            intersections
        };
    }

    /**
     * Hide the Detail Sector bounds diagnostic
     */
    hideBounds() {
        const existing = document.getElementById('detailSectorBoundsDiag');
        if (existing) {
            existing.remove();
            Logger.info('📐 Detail Sector bounds diagnostic hidden');
        }
    }
}
