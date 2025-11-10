/**
 * Mobile Viewport Manager - Modernized with Hub/Nuc Coordinate System
 * 
 * This updated version demonstrates the efficiency improvements using:
 * - Hub/Nuc terminology
 * - Bilingual coordinate storage
 * - Cached coordinate conversions
 */

class ViewportManagerModernized {
    constructor() {
        this.cache = new Map();
        this.hubNucCache = new Map();
    }
    
    getViewportInfo() {
        const info = {
            width: window.innerWidth,
            height: window.innerHeight,
            isPortrait: window.innerHeight > window.innerWidth,
            // Constitutional dimensions
            LSd: Math.max(window.innerWidth, window.innerHeight),
            SSd: Math.min(window.innerWidth, window.innerHeight)
        };
        
        // Update coordinate system with current viewport
        CoordinateSystem.setViewport(info);
        
        return info;
    }
    
    /**
     * Get the Hub position using constitutional formula
     * Returns HubNucCoordinate for maximum efficiency
     */
    getHubCoordinate() {
        const cacheKey = 'hub_position';
        
        if (this.hubNucCache.has(cacheKey)) {
            return this.hubNucCache.get(cacheKey);
        }
        
        const viewport = this.getViewportInfo();
        let hubX, hubY;
        
        if (viewport.isPortrait) {
            // Constitutional formula: Portrait mode
            hubX = viewport.LSd - (viewport.SSd / 2);
            hubY = -(viewport.LSd / 2);
        } else {
            // Constitutional formula: Landscape mode  
            hubX = viewport.LSd / 2;
            hubY = -(viewport.LSd - viewport.SSd / 2);
        }
        
        const hubCoord = HubNucCoordinate.fromHub(hubX, hubY);
        this.hubNucCache.set(cacheKey, hubCoord);
        
        Logger.debug(`Hub position calculated: ${hubCoord.toString()}`);
        return hubCoord;
    }
    
    /**
     * Get Focus Ring parameters with Hub/Nuc terminology
     * Returns object with HubNucCoordinate for efficiency
     */
    getFocusRingParameters() {
        const viewport = this.getViewportInfo();
        const cacheKey = `focus_ring_${viewport.width}_${viewport.height}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const hubCoord = this.getHubCoordinate();
        const focusRingRadius = viewport.LSd; // Always LSd
        
        const params = {
            hub: hubCoord,           // Hub position as HubNucCoordinate
            radius: focusRingRadius, // Focus Ring radius
            viewport: viewport       // Viewport info
        };
        
        this.cache.set(cacheKey, params);
        
        Logger.debug('Focus Ring parameters:', {
            hubX: hubCoord.hubX,
            hubY: hubCoord.hubY,
            radius: focusRingRadius
        });
        
        return params;
    }
    
    /**
     * Calculate the magnifier angle (Hub → Nuc direction)
     * This is the dynamic center angle that adjusts by aspect ratio
     */
    getMagnifierAngle() {
        return CoordinateSystem.getHubToNucAngle();
    }
    
    /**
     * Get magnifier position on Focus Ring
     * Returns HubNucCoordinate with both representations pre-calculated
     */
    getMagnifierCoordinate() {
        const magnifierAngle = this.getMagnifierAngle();
        const ringParams = this.getFocusRingParameters();
        
        // Create coordinate with polar representation
        const magnifierCoord = CoordinateSystem.createFocusRingCoordinate(
            magnifierAngle,
            ringParams.radius
        );
        
        Logger.debug(`Magnifier positioned at: ${magnifierCoord.toString()}`);
        return magnifierCoord;
    }
    
    /**
     * EFFICIENCY DEMO: Batch calculate multiple Focus Ring positions
     * This shows the power of the new coordinate system
     */
    calculateFocusRingPositions(angleArray) {
        const ringParams = this.getFocusRingParameters();
        
        // Create angle-radius pairs
        const angleRadiusPairs = angleArray.map(angle => ({
            angle: angle,
            radius: ringParams.radius
        }));
        
        // Batch convert with caching - much more efficient!
        const nucPositions = CoordinateSystem.batchConvertHubToNuc(angleRadiusPairs);
        
        // Return array of HubNucCoordinates with both representations
        return angleArray.map((angle, index) => {
            const coord = HubNucCoordinate.fromPolar(angle, ringParams.radius);
            // Pre-populate Nuc coordinates from batch calculation
            coord._nucX = nucPositions[index].x;
            coord._nucY = nucPositions[index].y;
            coord._nucCalculated = true;
            return coord;
        });
    }
    
    /**
     * Legacy compatibility method - returns old format
     * TODO: Gradually migrate all callers to use getFocusRingParameters()
     */
    getArcParameters() {
        const ringParams = this.getFocusRingParameters();
        const hub = ringParams.hub;
        
        // Return in old format for backward compatibility
        return {
            centerX: hub.hubX,  // Hub X coordinate
            centerY: hub.hubY,  // Hub Y coordinate  
            radius: ringParams.radius,
            viewport: ringParams.viewport
        };
    }
    
    /**
     * Legacy compatibility - returns old format  
     * TODO: Migrate callers to use getMagnifierCoordinate()
     */
    getMagnifyingRingPosition() {
        const magnifierCoord = this.getMagnifierCoordinate();
        
        return {
            x: magnifierCoord.nucX,     // Nuc coordinates for SVG positioning
            y: magnifierCoord.nucY,
            angle: magnifierCoord.angle // Polar angle from Hub
        };
    }
}

// Performance comparison logging
class PerformanceDemo {
    static demonstrateEfficiency() {
        const viewport = new ViewportManagerModernized();
        const angles = [];
        
        // Generate 50 test angles
        for (let i = 0; i < 50; i++) {
            angles.push((Math.PI / 2) + (i * Math.PI / 100));
        }
        
        console.time('Old Method (repeated conversions)');
        const oldResults = [];
        const arcParams = viewport.getArcParameters();
        for (const angle of angles) {
            // This is what happens in current code - repeated Math.cos/sin
            const x = arcParams.centerX + arcParams.radius * Math.cos(angle);
            const y = arcParams.centerY + arcParams.radius * Math.sin(angle);
            oldResults.push({ x, y });
        }
        console.timeEnd('Old Method (repeated conversions)');
        
        console.time('New Method (cached conversions)');
        const newResults = viewport.calculateFocusRingPositions(angles);
        console.timeEnd('New Method (cached conversions)');
        
        console.log(`Efficiency improvement: Cached ${CoordinateSystem._cache.size} conversions`);
        console.log('Results identical:', 
            oldResults[0].x.toFixed(3) === newResults[0].nucX.toFixed(3));
    }
}

// Usage examples
if (typeof window !== 'undefined') {
    window.ViewportManagerModernized = ViewportManagerModernized;
    window.PerformanceDemo = PerformanceDemo;
}