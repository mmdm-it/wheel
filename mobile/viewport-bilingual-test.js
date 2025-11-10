// Phase 1 Consolidation Test: Bilingual Coordinate System
// Tests that new bilingual method produces same results as existing method

// Test function to compare existing vs bilingual magnifying ring positioning
function testBilingualCoordinates() {
    console.log('=== Phase 1 Consolidation Test: Bilingual Coordinates ===');
    
    try {
        // Get viewport manager instance from mobile app
        let viewportManager = null;
        
        if (window.mobileCatalogApp && window.mobileCatalogApp.viewport) {
            viewportManager = window.mobileCatalogApp.viewport;
            console.log('✓ Found viewport manager in mobile app');
        } else if (window.viewportManager) {
            viewportManager = window.viewportManager;
            console.log('✓ Found viewport manager in global scope');
        } else {
            console.log('❌ Debug info:', {
                mobileCatalogApp: !!window.mobileCatalogApp,
                viewport: !!(window.mobileCatalogApp?.viewport),
                appKeys: window.mobileCatalogApp ? Object.keys(window.mobileCatalogApp) : 'no app'
            });
            throw new Error('ViewportManager not found. Make sure the mobile app is initialized.');
        }
        
        // Test existing method
        const existingPosition = viewportManager.getMagnifyingRingPosition();
        console.log('Existing method result:', existingPosition);
        
        // Test new bilingual method
        const bilingualPosition = viewportManager.getMagnifyingRingPositionBilingual();
        console.log('Bilingual method result:', bilingualPosition);
        
        // Compare positions (should be identical within floating point precision)
        const deltaX = Math.abs(existingPosition.x - bilingualPosition.x);
        const deltaY = Math.abs(existingPosition.y - bilingualPosition.y);
        const tolerance = 0.001;
        
        const positionsMatch = deltaX < tolerance && deltaY < tolerance;
        
        console.log('Position comparison:');
        console.log(`  Delta X: ${deltaX.toFixed(6)} (tolerance: ${tolerance})`);
        console.log(`  Delta Y: ${deltaY.toFixed(6)} (tolerance: ${tolerance})`);
        console.log(`  Positions match: ${positionsMatch ? '✓ PASS' : '✗ FAIL'}`);
        
        // Show coordinate representations
        if (bilingualPosition.hubCoord && bilingualPosition.nucCoord) {
            console.log('Coordinate representations:');
            console.log(`  Hub: ${bilingualPosition.hubCoord.toString()}`);
            console.log(`  Nuc: ${bilingualPosition.nucCoord.toString()}`);
        }
        
        return positionsMatch;
        
    } catch (error) {
        console.error('Test failed:', error);
        return false;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testBilingualCoordinates };
}

// Make function globally available - force it onto window object
window.testBilingualCoordinates = testBilingualCoordinates;

console.log('📍 Bilingual coordinate test script loaded');

// Auto-run if loaded in browser - but wait for app to be ready
setTimeout(() => {
    if (window.mobileCatalogApp && window.mobileCatalogApp.viewport) {
        console.log('📍 Bilingual coordinate test ready! Run testBilingualCoordinates() when ready.');
        console.log('📍 ViewportManager found:', typeof window.mobileCatalogApp.viewport);
    } else {
        console.log('📍 Test loaded. App state:', {
            mobileCatalogApp: !!window.mobileCatalogApp,
            viewport: !!(window.mobileCatalogApp?.viewport),
            appKeys: window.mobileCatalogApp ? Object.keys(window.mobileCatalogApp) : 'no app'
        });
    }
}, 3000);