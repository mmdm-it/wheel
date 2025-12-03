/**
 * Mobile Catalog Viewport Manager
 * Handles viewport calculations and responsive behavior
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';

/**
 * Manages viewport calculations and responsive behavior
 */
class ViewportManager {
    constructor() {
        this.cache = new Map();
        this.lastViewport = { width: 0, height: 0 };
    }
    
    getViewportInfo() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Return cached if viewport hasn't changed
        if (this.lastViewport.width === width && this.lastViewport.height === height) {
            return this.cache.get('viewportInfo');
        }
        
        const info = {
            width,
            height,
            isPortrait: height > width,
            center: { x: width / 2, y: height / 2 },
            LSd: Math.max(width, height),
            SSd: Math.min(width, height)
        };
        
        this.cache.set('viewportInfo', info);
        this.lastViewport = { width, height };
        Logger.debug('Viewport updated:', info);
        
        return info;
    }
    
    getCenterAngle() {
        // Calculate the angle from ring center that points toward screen center (0,0)
        // Calculate ring center directly to avoid circular dependency
        const viewport = this.getViewportInfo();
        
        // Corner-to-corner arc formula (same logic as getArcParameters)
        const LSd = viewport.LSd;
        const SSd = viewport.SSd;
        const radius = SSd / 2 + (LSd * LSd) / (2 * SSd);
        
        let ringCenterX, ringCenterY;
        
        if (viewport.isPortrait) {
            // Portrait: Hub at (Radius - SSd/2, -LSd/2)
            ringCenterX = radius - SSd / 2;
            ringCenterY = -(LSd / 2);
        } else {
            // Landscape: Hub at (LSd/2, -(Radius - SSd/2))
            ringCenterX = LSd / 2;
            ringCenterY = -(radius - SSd / 2);
        }
        
        // Vector from ring center to screen center (0,0)
        const vectorX = 0 - ringCenterX;  // Screen center is at (0,0)
        const vectorY = 0 - ringCenterY;
        
        // Calculate angle using atan2 (returns angle in radians from -π to π)
        const angle = Math.atan2(vectorY, vectorX);
        
        Logger.debug(`Dynamic center angle calculated: ${angle * 180 / Math.PI}° (ring center: ${ringCenterX}, ${ringCenterY})`);
        return angle;
    }
    
    getArcParameters() {
        const viewport = this.getViewportInfo();
        const cacheKey = `arc_${viewport.width}_${viewport.height}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Corner-to-corner arc formula
        // Arc enters at upper-left corner, exits at lower-right corner
        // Using "Radius from Chord Length and Arc Height" formula:
        // R = h/2 + c²/(8h) where h = SSd (arc height), c = 2*LSd (chord length)
        const LSd = viewport.LSd;
        const SSd = viewport.SSd;
        
        // Radius: R = SSd/2 + (2*LSd)² / (8*SSd) = SSd/2 + LSd²/(2*SSd)
        const radius = SSd / 2 + (LSd * LSd) / (2 * SSd);
        
        // Hub position based on orientation
        let centerX, centerY;
        
        if (viewport.isPortrait) {
            // Portrait: Hub at (Radius - SSd/2, -LSd/2)
            // Arc passes through (-SSd/2, -LSd/2) and (+SSd/2, +LSd/2)
            centerX = radius - SSd / 2;
            centerY = -(LSd / 2);
        } else {
            // Landscape: Mirror - Hub at (LSd/2, -(Radius - SSd/2))
            // Arc passes through (-LSd/2, -SSd/2) and (+LSd/2, +SSd/2)
            centerX = LSd / 2;
            centerY = -(radius - SSd / 2);
        }
        
        const params = { centerX, centerY, radius, viewport };
        this.cache.set(cacheKey, params);
        
        Logger.debug('Arc parameters calculated for', viewport.width, 'x', viewport.height + ':', {
            centerX, centerY, radius,
            'Expected for iPhone SE': 'center=(593.19, -333.5), radius=780.69'
        });
        return params;
    }
    
    getMarketPositions() {
        const viewport = this.getViewportInfo();
        const { HORIZONTAL, VERTICAL } = MOBILE_CONFIG.VIEWPORT.TOP_LEVEL_OFFSET;
        
        return [
            {
                x: viewport.width * HORIZONTAL,
                y: -viewport.height * VERTICAL
            },
            {
                x: -viewport.width * HORIZONTAL,
                y: viewport.height * VERTICAL
            }
        ];
    }
    
    adjustSVGForMobile(svg, mainGroup) {
        const viewport = this.getViewportInfo();
        
        svg.setAttribute('width', viewport.width);
        svg.setAttribute('height', viewport.height);
        mainGroup.setAttribute('transform', `translate(${viewport.center.x}, ${viewport.center.y})`);
        
        Logger.debug('SVG adjusted for mobile viewport');
    }
    
    getMagnifyingRingPosition() {
        const centerAngle = this.getCenterAngle();
        const arcParams = this.getArcParameters();
        
        // Position the magnifying ring using the SAME coordinate system as focus items
        // This ensures it's on the actual focus ring
        const x = arcParams.centerX + arcParams.radius * Math.cos(centerAngle);
        const y = arcParams.centerY + arcParams.radius * Math.sin(centerAngle);
        
        Logger.debug(`Magnifying ring positioned at angle ${centerAngle * 180 / Math.PI}°: (${x.toFixed(1)}, ${y.toFixed(1)}) using arc center (${arcParams.centerX}, ${arcParams.centerY}) radius ${arcParams.radius}`);
        return { x, y, angle: centerAngle };
    }
    
    // Phase 1 Consolidation: Bilingual coordinate method demonstration
    // Uses new coordinate system while preserving existing interface behavior
    getMagnifyingRingPositionBilingual() {
        const centerAngle = this.getCenterAngle();
        const arcParams = this.getArcParameters();
        
        // Set up coordinate system with current viewport
        const viewport = this.getViewportInfo();
        CoordinateSystem.setViewport({
            LSd: Math.max(viewport.width, viewport.height),
            SSd: Math.min(viewport.width, viewport.height)
        });
        
        // Create hub coordinate (polar) at focus ring using same radius as existing method
        const hubCoord = HubNucCoordinate.fromPolar(centerAngle, arcParams.radius);
        
        // Get Nuc coordinates (will be calculated lazily)
        const nucX = hubCoord.nucX;
        const nucY = hubCoord.nucY;
        
        Logger.debug(`Bilingual magnifying ring: Hub(${centerAngle * 180 / Math.PI}°, r=${arcParams.radius}) -> Nuc(${nucX.toFixed(1)}, ${nucY.toFixed(1)})`);
        
        return { 
            x: nucX, 
            y: nucY, 
            angle: centerAngle,
            // Include both coordinate representations for debugging
            hubCoord
        };
    }
}

export { ViewportManager };