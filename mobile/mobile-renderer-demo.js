/**
 * Mobile Renderer - Efficiency Demo with Hub/Nuc Coordinates
 * 
 * This demonstrates how the new coordinate system eliminates redundant
 * calculations and introduces proper Hub/Nuc terminology.
 */

class MobileRendererModernized {
    constructor(viewport) {
        this.viewport = viewport;
        this.positionCache = new Map(); // Legacy cache - can be removed
        this.coordinateCache = new Map(); // New HubNuc coordinate cache
    }
    
    /**
     * OLD METHOD: Repeated conversions
     */
    calculateFocusPositionOld(angle, arcParams) {
        // This is what happens currently - every call does Math.cos/sin
        const x = arcParams.centerX + arcParams.radius * Math.cos(angle);
        const y = arcParams.centerY + arcParams.radius * Math.sin(angle);
        return { x, y, angle };
    }
    
    /**
     * NEW METHOD: Efficient with HubNucCoordinate
     */
    calculateFocusPositionNew(angle, ringParams) {
        const cacheKey = `focus_${angle.toFixed(6)}_${ringParams.radius}`;
        
        if (this.coordinateCache.has(cacheKey)) {
            return this.coordinateCache.get(cacheKey);
        }
        
        // Create HubNucCoordinate - conversion is cached internally
        const coord = CoordinateSystem.createFocusRingCoordinate(angle, ringParams.radius);
        
        this.coordinateCache.set(cacheKey, coord);
        return coord;
    }
    
    /**
     * EFFICIENCY DEMO: Update all Focus Ring positions
     */
    updateFocusRingPositionsEfficient(focusItems, rotationOffset = 0) {
        if (!focusItems || focusItems.length === 0) return;
        
        const ringParams = this.viewport.getFocusRingParameters();
        const magnifierAngle = this.viewport.getMagnifierAngle();
        const adjustedMagnifierAngle = magnifierAngle + rotationOffset;
        
        // Calculate all angles first
        const middleIndex = (focusItems.length - 1) / 2;
        const angleStep = Math.PI / 24; // From config
        
        const angles = focusItems.map((_, index) => 
            adjustedMagnifierAngle + (middleIndex - index) * angleStep
        );
        
        // BATCH CONVERT - Much more efficient!
        const coordinates = this.viewport.calculateFocusRingPositions(angles);
        
        // Update DOM elements using pre-calculated coordinates
        focusItems.forEach((item, index) => {
            const coord = coordinates[index];
            
            // Both Hub and Nuc coordinates are available without conversion
            this.updateFocusItemElement(item, coord);
            
            Logger.debug(`Item ${index}: Hub(${coord.hubX.toFixed(1)}, ${coord.hubY.toFixed(1)}) → Nuc(${coord.nucX.toFixed(1)}, ${coord.nucY.toFixed(1)})`);
        });
        
        return coordinates;
    }
    
    /**
     * Update a single focus item using HubNucCoordinate
     */
    updateFocusItemElement(item, coordinate) {
        const element = item.element;
        if (!element) return;
        
        // Use Nuc coordinates for SVG positioning
        element.setAttribute('transform', `translate(${coordinate.nucX}, ${coordinate.nucY})`);
        
        // Use polar angle for text rotation
        const rotationDegrees = coordinate.angle * 180 / Math.PI;
        const textElement = element.querySelector('text');
        if (textElement) {
            textElement.setAttribute('transform', `rotate(${rotationDegrees})`);
        }
        
        // Store coordinate for other systems (like touch handling)
        element._hubNucCoordinate = coordinate;
    }
    
    /**
     * PERFORMANCE COMPARISON: Old vs New method
     */
    performanceTest(focusItems) {
        const iterations = 1000;
        
        // Old method test
        console.time('Old Method - Repeated Conversions');
        const arcParams = this.viewport.getArcParameters();
        for (let i = 0; i < iterations; i++) {
            focusItems.forEach((_, index) => {
                const angle = Math.PI + (index * Math.PI / 24);
                this.calculateFocusPositionOld(angle, arcParams);
            });
        }
        console.timeEnd('Old Method - Repeated Conversions');
        
        // New method test  
        console.time('New Method - Cached Conversions');
        const ringParams = this.viewport.getFocusRingParameters();
        for (let i = 0; i < iterations; i++) {
            focusItems.forEach((_, index) => {
                const angle = Math.PI + (index * Math.PI / 24);
                this.calculateFocusPositionNew(angle, ringParams);
            });
        }
        console.timeEnd('New Method - Cached Conversions');
        
        console.log(`Cache hits: ${CoordinateSystem._cache.size}`);
        console.log(`Memory usage: ~${CoordinateSystem._cache.size * 64} bytes for coordinate cache`);
    }
    
    /**
     * DEMONSTRATION: How terminology clarifies code intent
     */
    positionChildPyramidWithHubNuc(childItems) {
        const ringParams = this.viewport.getFocusRingParameters();
        const magnifierCoord = this.viewport.getMagnifierCoordinate();
        
        // Clear terminology - we're positioning relative to Hub
        const pyramidRadius = ringParams.radius * 0.7; // 70% of Focus Ring radius
        
        childItems.forEach((item, index) => {
            // Calculate angle relative to magnifier (Hub perspective)
            const angleOffset = (index - (childItems.length - 1) / 2) * Math.PI / 45;
            const childAngle = magnifierCoord.angle + angleOffset;
            
            // Create coordinate at smaller radius (Child Pyramid radius)
            const childCoord = CoordinateSystem.createFocusRingCoordinate(childAngle, pyramidRadius);
            
            // Position using Nuc coordinates for SVG
            item.element.setAttribute('transform', 
                `translate(${childCoord.nucX}, ${childCoord.nucY})`);
            
            Logger.debug(`Child ${index}: Angle ${childAngle.toFixed(3)}rad from Hub, positioned at Nuc(${childCoord.nucX.toFixed(1)}, ${childCoord.nucY.toFixed(1)})`);
        });
    }
}

/**
 * Usage demonstration showing efficiency gains
 */
function demonstrateHubNucEfficiency() {
    const viewport = new ViewportManagerModernized();
    const renderer = new MobileRendererModernized(viewport);
    
    // Simulate 20 focus items
    const mockFocusItems = Array.from({ length: 20 }, (_, i) => ({
        id: `item_${i}`,
        element: document.createElementNS('http://www.w3.org/2000/svg', 'g')
    }));
    
    console.log('=== Hub/Nuc Coordinate System Efficiency Demo ===');
    
    // Show terminology benefits
    console.log('\n1. Clear Terminology:');
    console.log('   Hub = Off-screen rotational center (constitutional position)');
    console.log('   Nuc = On-screen viewport center (SVG origin)');
    
    // Show efficiency benefits
    console.log('\n2. Performance Comparison:');
    renderer.performanceTest(mockFocusItems);
    
    // Show bilingual coordinate benefits
    console.log('\n3. Bilingual Coordinate Benefits:');
    const sampleCoord = CoordinateSystem.createFocusRingCoordinate(Math.PI * 1.25, 500);
    console.log(`   Single coordinate stores both: ${sampleCoord.toString()}`);
    console.log(`   No repeated Math.cos/sin calls needed!`);
    
    // Show batch processing benefits
    console.log('\n4. Batch Processing:');
    console.time('Batch convert 20 positions');
    renderer.updateFocusRingPositionsEfficient(mockFocusItems);
    console.timeEnd('Batch convert 20 positions');
}

// Export for testing
if (typeof window !== 'undefined') {
    window.MobileRendererModernized = MobileRendererModernized;
    window.demonstrateHubNucEfficiency = demonstrateHubNucEfficiency;
}