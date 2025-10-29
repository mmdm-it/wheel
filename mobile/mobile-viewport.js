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
}

export { ViewportManager };