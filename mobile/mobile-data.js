/**
 * Mobile Volume Data Manager
 * Manages data loading with error handling and caching
 */

import { Logger } from './mobile-logger.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';
import { ItemUtils } from './item-utils.js';
import { DataCacheManager } from './data-cache-manager.js';
import { DataLazyLoader } from './data-lazy-loader.js';
import { DataVirtualLevels } from './data-virtual-levels.js';
import { DataHierarchyNavigator } from './data-hierarchy-navigator.js';
import { ItemBuilder } from './item-builder.js';
import { DataConfigManager } from './data-config-manager.js';
import { DataCoordinateCache } from './data-coordinate-cache.js';
import { DataDetailSectorManager } from './data-detailsector-manager.js';
import { DataItemTracer } from './data-item-tracer.js';
import { DataVolumeLoader } from './data-volume-loader.js';

/**
 * Manages data loading with error handling and caching
 */
class DataManager {
    constructor() {
        // Volume loading and discovery
        this.volumeLoader = new DataVolumeLoader(this);
        
        // Cache manager for persistent storage across sessions
        this.cacheManager = new DataCacheManager();
        
        // Lazy loader for split volume structures
        this.lazyLoader = new DataLazyLoader(this, this.cacheManager);
        
        // Virtual level handling
        this.virtualLevels = new DataVirtualLevels(this);
        
        // Hierarchy navigation (core getItemsAtLevel)
        this.hierarchyNavigator = new DataHierarchyNavigator(this);
        
        // Item building (normalization, parent properties, sorting)
        this.itemBuilder = new ItemBuilder(this);
        
        // Configuration and metadata access
        this.configManager = new DataConfigManager(this);
        
        // Coordinate caching for bilingual coordinate system
        this.coordinateCache = new DataCoordinateCache(this);
        
        // Detail sector configuration and context management
        this.detailSectorManager = new DataDetailSectorManager(this);
        
        // Item tracing for targeted debug logging
        this.itemTracer = new DataItemTracer(this);
    }

    // Delegated properties from volumeLoader
    get data() { return this.volumeLoader.data; }
    set data(value) { this.volumeLoader.data = value; }
    
    get loading() { return this.volumeLoader.loading; }
    set loading(value) { this.volumeLoader.loading = value; }
    
    get loadPromise() { return this.volumeLoader.loadPromise; }
    set loadPromise(value) { this.volumeLoader.loadPromise = value; }
    
    get currentVolumePath() { return this.volumeLoader.currentVolumePath; }
    set currentVolumePath(value) { this.volumeLoader.currentVolumePath = value; }
    
    get cacheVersion() { return this.volumeLoader.cacheVersion; }
    set cacheVersion(value) { this.volumeLoader.cacheVersion = value; }
    
    get availableVolumes() { return this.volumeLoader.availableVolumes; }
    set availableVolumes(value) { this.volumeLoader.availableVolumes = value; }
    
    get rootDataKey() { return this.volumeLoader.rootDataKey; }
    set rootDataKey(value) { this.volumeLoader.rootDataKey = value; }

    getActiveTraceTarget() {
        return this.itemTracer.getActiveTraceTarget();
    }

    shouldTraceItem(item) {
        return this.itemTracer.shouldTraceItem(item);
    }

    traceItem(item, message, extraContext = null) {
        return this.itemTracer.traceItem(item, message, extraContext);
    }


    /**
     * Clear all cached external files
     * Useful for forcing fresh data reload
     */
    async clearCache() {
        // Clear lazy loader tracking
        this.lazyLoader.clearLoadedFiles();
        
        // Clear persistent cache via cache manager
        await this.cacheManager.clearCache();
    }

    /**
     * Check if current volume uses split structure with lazy loading
     * Delegates to lazyLoader module
     * @returns {boolean} True if volume uses split structure
     */
    isSplitStructure() {
        return this.lazyLoader.isSplitStructure();
    }

    /**
     * Check if current volume uses chapter-level split structure
     * Delegates to lazyLoader module
     * @returns {boolean} True if volume uses chapter-level split structure
     */
    isChapterSplitStructure() {
        return this.lazyLoader.isChapterSplitStructure();
    }

    /**
     * Get the display name for an item, checking multiple possible property names.
     * This provides backwards compatibility with volumes using domain-specific naming.
     * @param {Object} item - The data item
     * @param {string} fallback - Fallback if no name found
     * @returns {string} The display name
     */
    getItemDisplayName(item, fallback = 'Unnamed') {
        if (!item) return fallback;
        // Check common name properties in order of preference
        return item.name || item.engine_model || item.title || item.__originalKey || fallback;
    }

    /**
     * Phase 4 Consolidation: Store bilingual coordinates for items
     * Enables efficient coordinate retrieval and analysis
     */
    storeItemCoordinates(items, viewport, angleCallback) {
        return this.coordinateCache.storeItemCoordinates(items, viewport, angleCallback);
    }

    /**
     * Phase 4 Consolidation: Retrieve stored bilingual coordinates
     */
    getItemCoordinates(itemKey) {
        return this.coordinateCache.getItemCoordinates(itemKey);
    }

    /**
     * Phase 4 Consolidation: Get coordinate statistics
     */
    getCoordinateStats() {
        return this.coordinateCache.getCoordinateStats();
    }

    /**
     * Phase 4 Consolidation: Clear coordinate cache
     */
    clearCoordinateCache(levelName = null) {
        return this.coordinateCache.clearCoordinateCache(levelName);
    }

    /**
     * Discover available Wheel volumes in the directory
     * Scans for JSON files and validates them as Wheel volumes
     * @returns {Promise<Array>} Array of discovered volume objects with metadata
     */
    async discoverVolumes() {
        return this.volumeLoader.discoverVolumes();
    }

    /**
     * Load a specific Wheel volume by filename
     * @param {string} filename - Name of the JSON file to load (e.g., 'mmdm_catalog.json')
     * @returns {Promise<Object>} The loaded volume data structure
     * @throws {Error} If volume cannot be loaded or is invalid
     */
    async loadVolume(filename) {
        return this.volumeLoader.loadVolume(filename);
    }

    /**
     * Load default volume (legacy support)
     * @returns {Promise<Object>} The loaded data
     */
    async load() {
        return this.volumeLoader.load();
    }

    /**
     * @deprecated Use load() instead
     */
    async performLoad() {
        return this.volumeLoader.performLoad();
    }

    /**
     * Validate that loaded data is a proper Wheel volume
     * @param {Object} data - The volume data to validate
     * @returns {boolean} True if valid
     */
    validateData(data) {
        return this.volumeLoader.validateData(data);
    }

    /**
     * Compute cache version string from display config
     * @param {Object} displayConfig - The display_config object
     * @param {string} filename - Current volume filename
     * @returns {string} Cache version string
     */
    computeCacheVersion(displayConfig, filename) {
        return this.volumeLoader.computeCacheVersion(displayConfig, filename);
    }

    getDisplayConfig() {
        if (!this.data || !this.rootDataKey) return null;
        const rootData = this.data[this.rootDataKey];
        return rootData && rootData.display_config || null;
    }

    getHierarchyLevelConfig(levelType) {
        const displayConfig = this.getDisplayConfig();
        return displayConfig && displayConfig.hierarchy_levels && displayConfig.hierarchy_levels[levelType] || null;
    }

    getUILimits() {
        const displayConfig = this.getDisplayConfig();
        return displayConfig && displayConfig.ui_limits || {
            focus_ring_max_depth: 6,
            parent_button_min_depth: 1
        };
    }

    /**
     * Retrieve merged detail sector configuration for a specific item
     * Combines volume defaults, hierarchy-level overrides, and item-level overrides
     * @param {Object} item - Item to get detail sector config for
     * @returns {Object|null} Merged configuration object or null if no config found
     */
    getDetailSectorConfigForItem(item) {
        return this.detailSectorManager.getDetailSectorConfigForItem(item);
    }

    /**
     * Build a rendering context for template resolution
     * Flattens item properties and data for template interpolation
     * @param {Object} item - Item to build context for
     * @returns {Object} Context object with flattened properties for templating
     */
    getDetailSectorContext(item) {
        return this.detailSectorManager.getDetailSectorContext(item);
    }

    /**
     * Merge detail sector config layers with predictable overrides
     */
    mergeDetailSectorConfigs(...configs) {
        return this.detailSectorManager.mergeDetailSectorConfigs(...configs);
    }

    /**
     * Resolve a dotted path within a context object
     */
    resolveDetailPath(path, context) {
        return this.configManager.resolveDetailPath(path, context);
    }

    /**
     * Interpolate template placeholders using context data
     * Supports {{property}} and {{object.property}} syntax
     */
    resolveDetailTemplate(template, context) {
        return this.configManager.resolveDetailTemplate(template, context);
    }

    /**
     * Get the ordered list of hierarchy level names
     */
    getHierarchyLevelNames() {
        return this.configManager.getHierarchyLevelNames();
    }

    /**
     * Get the depth/level index for a given level name
     */
    getHierarchyLevelDepth(levelName) {
        return this.configManager.getHierarchyLevelDepth(levelName);
    }

    getData() {
        return this.data;
    }

    getTopLevelCollectionName() {
        return this.configManager.getTopLevelCollectionName();
    }

    getTopLevelCollection() {
        return this.configManager.getTopLevelCollection();
    }

    getTopLevelKeys() {
        return this.configManager.getTopLevelKeys();
    }

    /**
     * Get items at the configured top navigation level (first hierarchy level)
     * Used when the UI needs to show the absolute top (e.g., testaments).
     */
    getTopNavigationItems() {
        if (!this.data || !this.rootDataKey) return [];

        const levelNames = this.getHierarchyLevelNames();
        if (!levelNames.length) return [];

        const topLevelName = levelNames[0];
        const topLevelConfig = this.getHierarchyLevelConfig(topLevelName);
        const topKeys = this.getTopLevelKeys();

        const items = topKeys.map((name, index) => ({
            name,
            [topLevelName]: name,
            key: name,
            sort_number: index + 1, // provide stable order when authored sort_number is missing
            __level: topLevelName,
            __levelDepth: 0,
            __isLeaf: false,
            __path: [name],
            __dataPath: [name]  // Add dataPath for consistent navigation
        }));

        return this.sortItems(items, topLevelConfig);
    }

    /**
     * UNIVERSAL METHOD: Get all initial focus items for display
     * Gets the THIRD level items aggregated across the first two hierarchy levels
     * (e.g., items from groups+subgroups)
     * @returns {Array} Array of third-level items ready for focus ring display
     */
    getAllInitialFocusItems() {
        if (!this.data || !this.rootDataKey) return [];

        const topLevelNames = this.getTopLevelKeys();
        const levelNames = this.getHierarchyLevelNames();
        
        if (levelNames.length < 3) {
            Logger.warn('getAllInitialFocusItems: Need at least 3 hierarchy levels');
            return [];
        }
        
        const topLevelName = levelNames[0]; // e.g., 'group1'
        const secondLevelName = levelNames[1]; // e.g., 'group2'
        const thirdLevelName = levelNames[2]; // e.g., 'item'

        const allThirdLevelItems = [];
        const thirdLevelConfig = this.getHierarchyLevelConfig(thirdLevelName);

        // Get third-level items from each top-level group
        topLevelNames.forEach(topLevelKey => {
            // Create top-level item
            const topLevelItem = {
                name: topLevelKey,
                [topLevelName]: topLevelKey,
                key: topLevelKey,
                __level: topLevelName,
                __levelDepth: 0,
                __isLeaf: false,
                __path: [topLevelKey]
            };

            // If third level is aggregated, get items directly from top-level (it will handle aggregation)
            // Otherwise, traverse through second level
            if (thirdLevelConfig && thirdLevelConfig.aggregates_across) {
                const thirdLevelItems = this.getItemsAtLevel(topLevelItem, thirdLevelName);
                allThirdLevelItems.push(...thirdLevelItems);
            } else {
                // Get second-level items
                const secondLevelItems = this.getItemsAtLevel(topLevelItem, secondLevelName);
                
                // For each second-level item, get third-level items
                secondLevelItems.forEach(secondLevelItem => {
                    const thirdLevelItems = this.getItemsAtLevel(secondLevelItem, thirdLevelName);
                    allThirdLevelItems.push(...thirdLevelItems);
                });
            }
        });

        // Apply sorting based on third level configuration
        return this.sortItems(allThirdLevelItems, thirdLevelConfig);
    }

    /**
     * UNIVERSAL METHOD: Get items for a virtual level
     * Virtual levels are computed from child data rather than existing in JSON
     */
    getVirtualLevelItems(parentItem, virtualLevelName, virtualLevelConfig) {
        return this.virtualLevels.getVirtualLevelItems(parentItem, virtualLevelName, virtualLevelConfig);
    }

    /**
     * UNIVERSAL METHOD: Get items for an aggregated level
     * Aggregated levels combine items from multiple intermediate levels
     */
    getAggregatedLevelItems(parentItem, aggregatedLevelName, aggregatedLevelConfig) {
        return this.virtualLevels.getAggregatedLevelItems(parentItem, aggregatedLevelName, aggregatedLevelConfig);
    }

    /**
     * UNIVERSAL METHOD: Get items from a virtual parent
     * When parent is a virtual grouping, get child items filtered by group membership
     */
    getItemsFromVirtualParent(virtualParentItem, childLevelName, virtualParentConfig) {
        return this.virtualLevels.getItemsFromVirtualParent(virtualParentItem, childLevelName, virtualParentConfig);
    }

    /**
     * UNIVERSAL METHOD: Check if a virtual level can be skipped
     */
    canSkipVirtualLevel(parentLevelName, childLevelName, levelNames) {
        return this.virtualLevels.canSkipVirtualLevel(parentLevelName, childLevelName, levelNames);
    }

    /**
     * UNIVERSAL HIERARCHY METHOD
     * Get items at a specific level depth given a parent item
     * This is the domain-agnostic navigation method that dynamically navigates JSON
     * @param {Object} parentItem - Parent item with __level and __path metadata
     * @param {string} childLevelName - Name of the child level to retrieve items from
     * @returns {Array} Array of child items with metadata (__level, __path, etc.)
     */
    getItemsAtLevel(parentItem, childLevelName) {
        return this.hierarchyNavigator.getItemsAtLevel(parentItem, childLevelName);
    }

    /**
     * Get plural property name for a level (e.g., 'category' → 'categories')
     * Uses configuration-driven irregular plurals from catalog JSON
     */
    getPluralPropertyName(levelName) {
        return this.hierarchyNavigator.getPluralPropertyName(levelName);
    }

    /**
     * Extract child items from a data location
     */
    extractChildItems(dataLocation, childLevelName, parentItem) {
        return this.hierarchyNavigator.extractChildItems(dataLocation, childLevelName, parentItem);
    }
    
    /**
     * Normalize item data to ensure compatibility between v1.0 and v2.0 schemas.
     * Maps v2.0 'seq' field to 'sort_number' for sorting compatibility.
     */
    normalizeItemData(itemData) {
        return this.itemBuilder.normalizeItemData(itemData);
    }

    /**
     * Extract parent properties to pass to child items
     */
    extractParentProperties(parentItem) {
        return this.itemBuilder.extractParentProperties(parentItem);
    }

    /**
     * Sort items based on level configuration
     */
    sortItems(items, levelConfig) {
        return this.itemBuilder.sortItems(items, levelConfig);
    }

    sortLeafItems(items, levelConfig) {
        return this.itemBuilder.sortLeafItems(items, levelConfig);
    }

    getDataLocationForItem(item) {
        return this.hierarchyNavigator.getDataLocationForItem(item);
    }
}

// Mock add to cart function
window.addToCart = function(item) {
    Logger.debug('Add to cart requested:', item);
    // Mobile-friendly alert or modal would go here
    if (confirm(`Add ${item} to cart?`)) {
        alert(`Added ${item} to cart!`);
    }
};

export { DataManager };