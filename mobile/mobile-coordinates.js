/**
 * Mobile Catalog Coordinate System Manager
 * 
 * Implements the Nuc/Hub dual coordinate system with bilingual storage
 * for maximum efficiency in position calculations.
 * 
 * Terminology:
 * - Hub: Off-screen rotational center (polar coordinates)
 * - Nuc: On-screen viewport center at SVG origin (0,0) (Cartesian coordinates)
 */

/**
 * Represents a point that can be expressed in both coordinate systems
 */
class HubNucCoordinate {
    constructor(hubX, hubY, nucX = null, nucY = null, angle = null, radius = null) {
        // Store both representations if provided
        this._hubX = hubX;
        this._hubY = hubY;
        this._nucX = nucX;
        this._nucY = nucY;
        this._angle = angle;
        this._radius = radius;
        
        // Lazy calculation flags
        this._hubCalculated = (hubX !== null && hubY !== null);
        this._nucCalculated = (nucX !== null && nucY !== null);
        this._polarCalculated = (angle !== null && radius !== null);
    }
    
    // Hub coordinates (Cartesian from Hub perspective)
    get hubX() {
        if (!this._hubCalculated) this._calculateHub();
        return this._hubX;
    }
    
    get hubY() {
        if (!this._hubCalculated) this._calculateHub();
        return this._hubY;
    }
    
    // Nuc coordinates (Cartesian from Nuc perspective - SVG coordinates)
    get nucX() {
        if (!this._nucCalculated) this._calculateNuc();
        return this._nucX;
    }
    
    get nucY() {
        if (!this._nucCalculated) this._calculateNuc();
        return this._nucY;
    }
    
    // Polar coordinates (from Hub origin)
    get angle() {
        if (!this._polarCalculated) this._calculatePolar();
        return this._angle;
    }
    
    get radius() {
        if (!this._polarCalculated) this._calculatePolar();
        return this._radius;
    }
    
    _calculateHub() {
        const hubPos = CoordinateSystem.getHubPosition();
        if (this._nucCalculated && hubPos) {
            // Convert from Nuc (screen) to Hub Cartesian (origin at Hub)
            this._hubX = this._nucX - hubPos.x;
            this._hubY = this._nucY - hubPos.y;
        } else if (this._polarCalculated) {
            // Convert from polar to Hub Cartesian
            this._hubX = this._radius * Math.cos(this._angle);
            this._hubY = this._radius * Math.sin(this._angle);
        }
        this._hubCalculated = true;
    }
    
    _calculateNuc() {
        const hubPos = CoordinateSystem.getHubPosition();
        if (this._hubCalculated && hubPos) {
            // Convert from Hub Cartesian to Nuc (screen) by adding hub origin
            this._nucX = hubPos.x + this._hubX;
            this._nucY = hubPos.y + this._hubY;
        } else if (this._polarCalculated && hubPos) {
            // Convert from polar (relative to Hub) to Nuc coordinates
            this._nucX = hubPos.x + this._radius * Math.cos(this._angle);
            this._nucY = hubPos.y + this._radius * Math.sin(this._angle);
        }
        this._nucCalculated = true;
    }
    
    _calculatePolar() {
        if (this._hubCalculated) {
            this._radius = Math.sqrt(this._hubX * this._hubX + this._hubY * this._hubY);
            this._angle = Math.atan2(this._hubY, this._hubX);
        }
        this._polarCalculated = true;
    }
    
    // Factory methods for common creation patterns
    static fromPolar(angle, radius) {
        return new HubNucCoordinate(null, null, null, null, angle, radius);
    }
    
    static fromHub(hubX, hubY) {
        return new HubNucCoordinate(hubX, hubY);
    }
    
    static fromNuc(nucX, nucY) {
        return new HubNucCoordinate(null, null, nucX, nucY);
    }
    
    // Debugging
    toString() {
        return `HubNuc(hub: ${this.hubX?.toFixed(1)}, ${this.hubY?.toFixed(1)}, nuc: ${this.nucX?.toFixed(1)}, ${this.nucY?.toFixed(1)}, polar: ${this.angle?.toFixed(3)}rad, ${this.radius?.toFixed(1)}px)`;
    }
}

/**
 * Coordinate System Manager with caching and Hub/Nuc terminology
 */
class CoordinateSystem {
    static _cache = new Map();
    static _hubPosition = null;
    static _viewport = null;
    
    static setViewport(viewport) {
        CoordinateSystem._viewport = viewport;
        CoordinateSystem._hubPosition = null; // Reset on viewport change
        CoordinateSystem._cache.clear(); // Clear conversion cache
    }
    
    static getHubPosition() {
        if (!CoordinateSystem._hubPosition && CoordinateSystem._viewport) {
            CoordinateSystem._hubPosition = CoordinateSystem._computeHubFromViewport(CoordinateSystem._viewport);
        }
        return CoordinateSystem._hubPosition;
    }
    
    static getNucPosition() {
        return { x: 0, y: 0 }; // Nuc is always at SVG origin
    }
    
    /**
     * Convert angle from Hub to Nuc coordinates with caching
     */
    static hubAngleToNuc(angle, radius) {
        const cacheKey = `${angle.toFixed(6)}_${radius}`;
        
        if (CoordinateSystem._cache.has(cacheKey)) {
            return CoordinateSystem._cache.get(cacheKey);
        }
        const hubPos = CoordinateSystem.getHubPosition();
        if (!hubPos) {
            return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
        }
        const nucX = hubPos.x + radius * Math.cos(angle);
        const nucY = hubPos.y + radius * Math.sin(angle);
        
        const result = { x: nucX, y: nucY };
        
        // LRU cache with size limit
        if (CoordinateSystem._cache.size > 1000) {
            const firstKey = CoordinateSystem._cache.keys().next().value;
            CoordinateSystem._cache.delete(firstKey);
        }
        
        CoordinateSystem._cache.set(cacheKey, result);
        return result;
    }
    
    /**
     * Calculate angle from Hub to Nuc (magnifier angle)
     */
    static getHubToNucAngle() {
        const hub = CoordinateSystem.getHubPosition();
        const nuc = CoordinateSystem.getNucPosition();
        if (!hub) return 0;
        
        const vectorX = nuc.x - hub.x;
        const vectorY = nuc.y - hub.y;
        
        return Math.atan2(vectorY, vectorX);
    }
    
    /**
     * Create a coordinate along the Focus Ring arc
     */
    static createFocusRingCoordinate(angleFromHub, radius) {
        return HubNucCoordinate.fromPolar(angleFromHub, radius);
    }
    
    /**
     * Batch convert multiple angles for efficiency
     */
    static batchConvertHubToNuc(angleRadiusPairs) {
        return angleRadiusPairs.map(({ angle, radius }) => 
            CoordinateSystem.hubAngleToNuc(angle, radius)
        );
    }

    // Compute hub position consistent with ViewportManager.getArcParameters()
    static _computeHubFromViewport(v) {
        if (!v || typeof v.LSd !== 'number' || typeof v.SSd !== 'number') {
            return null;
        }

        const LSd = v.LSd;
        const SSd = v.SSd;
        const radius = SSd / 2 + (LSd * LSd) / (2 * SSd);

        if (v.isPortrait !== false) {
            // Portrait: Hub at (Radius - SSd/2, -LSd/2)
            return { x: radius - SSd / 2, y: -(LSd / 2) };
        }

        // Landscape: Hub at (LSd/2, -(Radius - SSd/2))
        return { x: LSd / 2, y: -(radius - SSd / 2) };
    }
}

// Export for use in other modules (ES6 modules)
export { HubNucCoordinate, CoordinateSystem };

// Also provide window globals for browser compatibility
if (typeof window !== 'undefined') {
    window.HubNucCoordinate = HubNucCoordinate;
    window.CoordinateSystem = CoordinateSystem;
}