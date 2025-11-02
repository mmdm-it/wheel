/**
 * Mobile Catalog Viewport Manager
 * Handles viewport calculations and responsive behavior
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

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
        
        let ringCenterX, ringCenterY;
        
        // Ring center position based on orientation (same logic as getArcParameters)
        if (viewport.isPortrait) {
            // Portrait: x = LSd - SSd/2, y = -(LSd/2)
            ringCenterX = viewport.LSd - viewport.SSd / 2;
            ringCenterY = -(viewport.LSd / 2);
        } else {
            // Landscape: x = LSd/2, y = -(LSd - SSd/2)
            ringCenterX = viewport.LSd / 2;
            ringCenterY = -(viewport.LSd - viewport.SSd / 2);
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
        
        // Universal arc parameters formula for any device aspect ratio
        // LSd = Long Side, SSd = Short Side
        const LSd = viewport.LSd;
        const SSd = viewport.SSd;
        
        // Ring radius is always LSd
        const radius = LSd;
        
        // Ring center position based on orientation
        let centerX, centerY;
        
        if (viewport.isPortrait) {
            // Portrait: x = LSd - SSd/2, y = -(LSd/2)
            centerX = LSd - SSd / 2;
            centerY = -(LSd / 2);
        } else {
            // Landscape: x = LSd/2, y = -(LSd - SSd/2)
            centerX = LSd / 2;
            centerY = -(LSd - SSd / 2);
        }
        
        const params = { centerX, centerY, radius, viewport };
        this.cache.set(cacheKey, params);
        
        Logger.debug('Arc parameters calculated for', viewport.width, 'x', viewport.height + ':', {
            centerX, centerY, radius,
            'Expected for iPhone SE': 'center=(480, 333.5), radius=667'
        });
        return params;
    }
    
    getMarketPositions() {
        const viewport = this.getViewportInfo();
        const { HORIZONTAL, VERTICAL } = MOBILE_CONFIG.VIEWPORT.MARKET_OFFSET;
        
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
        
        // Position the magnifying ring using the SAME coordinate system as manufacturers
        // This ensures it's on the actual manufacturer ring
        const x = arcParams.centerX + arcParams.radius * Math.cos(centerAngle);
        const y = arcParams.centerY + arcParams.radius * Math.sin(centerAngle);
        
        Logger.debug(`Magnifying ring positioned at angle ${centerAngle * 180 / Math.PI}°: (${x.toFixed(1)}, ${y.toFixed(1)}) using arc center (${arcParams.centerX}, ${arcParams.centerY}) radius ${arcParams.radius}`);
        return { x, y, angle: centerAngle };
    }
}

export { ViewportManager };