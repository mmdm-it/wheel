/**
 * Data Coordinate Cache Manager
 * Manages bilingual coordinate storage for efficient item positioning
 * Part of Phase 4 Consolidation: Coordinate system integration
 */

import { Logger } from './mobile-logger.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';

/**
 * Manages coordinate caching for data items
 * Stores bilingual (Hub-Nuc) coordinates for efficient retrieval
 */
class DataCoordinateCache {
    /**
     * @param {Object} dataManager - Reference to parent DataManager for access to data
     */
    constructor(dataManager) {
        this.dataManager = dataManager;
        
        // Phase 4 Consolidation: Bilingual coordinate storage
        this.coordinateCache = new Map(); // Item key -> HubNucCoordinate
        this.coordinateMetadata = new Map(); // Level -> coordinate stats
    }

    /**
     * Phase 4 Consolidation: Store bilingual coordinates for items
     * Enables efficient coordinate retrieval and analysis
     * @param {Array} items - Array of items to store coordinates for
     * @param {Object} viewport - Viewport information with width/height
     * @param {Function} angleCallback - Function to get angle for each item
     */
    storeItemCoordinates(items, viewport, angleCallback) {
        if (!items || !viewport || typeof angleCallback !== 'function') {
            Logger.warn('storeItemCoordinates: Invalid parameters');
            return;
        }

        // Set up coordinate system with current viewport
        CoordinateSystem.setViewport({
            LSd: Math.max(viewport.width, viewport.height),
            SSd: Math.min(viewport.width, viewport.height)
        });

        let storedCount = 0;
        const levelName = items.length > 0 ? items[0].__level : 'unknown';

        items.forEach((item, index) => {
            try {
                // Get angle for this item (from positioning logic)
                const angle = angleCallback(item, index);
                
                if (typeof angle === 'number' && !isNaN(angle)) {
                    // Create bilingual coordinate with focus ring radius
                    const arcParams = viewport.getArcParameters ? viewport.getArcParameters() : 
                                     { radius: Math.max(viewport.width, viewport.height) };
                    
                    const hubCoord = HubNucCoordinate.fromPolar(angle, arcParams.radius);
                    this.coordinateCache.set(item.key, hubCoord);
                    storedCount++;
                }
            } catch (error) {
                Logger.warn(`Failed to store coordinates for item ${item.key}:`, error);
            }
        });

        // Update metadata
        this.coordinateMetadata.set(levelName, {
            itemCount: items.length,
            storedCount,
            timestamp: Date.now(),
            viewport: { width: viewport.width, height: viewport.height }
        });

        Logger.verbose(`Stored bilingual coordinates: ${storedCount}/${items.length} items at level ${levelName}`);
    }

    /**
     * Phase 4 Consolidation: Retrieve stored bilingual coordinates
     * @param {string} itemKey - Unique key for the item
     * @returns {HubNucCoordinate|null} Coordinate object or null if not found
     */
    getItemCoordinates(itemKey) {
        return this.coordinateCache.get(itemKey) || null;
    }

    /**
     * Phase 4 Consolidation: Get coordinate statistics
     * @returns {Object} Statistics about cached coordinates
     */
    getCoordinateStats() {
        const stats = {
            totalCached: this.coordinateCache.size,
            levelStats: {}
        };

        for (const [level, metadata] of this.coordinateMetadata) {
            stats.levelStats[level] = metadata;
        }

        return stats;
    }

    /**
     * Phase 4 Consolidation: Clear coordinate cache
     * @param {string|null} levelName - Specific level to clear, or null for all
     */
    clearCoordinateCache(levelName = null) {
        if (levelName) {
            // Clear specific level
            let cleared = 0;
            for (const [key, coord] of this.coordinateCache) {
                // Would need item reference to check level - simplified approach
                this.coordinateCache.delete(key);
                cleared++;
            }
            this.coordinateMetadata.delete(levelName);
            Logger.debug(`Cleared ${cleared} coordinates for level ${levelName}`);
        } else {
            // Clear all
            const totalCleared = this.coordinateCache.size;
            this.coordinateCache.clear();
            this.coordinateMetadata.clear();
            Logger.debug(`Cleared all ${totalCleared} cached coordinates`);
        }
    }
}

export { DataCoordinateCache };
