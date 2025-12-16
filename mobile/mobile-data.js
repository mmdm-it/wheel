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

/**
 * Manages data loading with error handling and caching
 */
class DataManager {
    constructor() {
        this.data = null;
        this.loading = false;
        this.loadPromise = null;
        this.currentVolumePath = null;
        this.cacheVersion = 'unknown'; // versioned cache key (schema+data)
        this.availableVolumes = [];
        this.rootDataKey = null; // e.g., 'MMdM' or 'Gutenberg_Bible'
        
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
        Logger.debug('🔍 Discovering available Wheel volumes...');
        
        // Try to load volume index if available
        let volumeFiles = [];
        try {
            const indexResponse = await fetch('./volumes.json');
            if (indexResponse.ok) {
                const index = await indexResponse.json();
                const indexed = index.volumes || [];
                // Accept strings or objects { path, name }
                volumeFiles = indexed.map(entry => typeof entry === 'string' ? entry : entry?.path).filter(Boolean);
                Logger.debug('📋 Loaded volume index:', volumeFiles);
            }
        } catch (error) {
            Logger.debug('📋 No volume index found, scanning common locations');
        }
        
        // If no index, scan common volume file patterns
        if (volumeFiles.length === 0) {
            // Scan for any .json files that might be volumes
            // These are just common patterns - the validation below will reject non-volumes
            // Note: gutenberg.json removed - now uses split chapters in data/gutenberg/manifest.json
            volumeFiles = [
                'mmdm_catalog.json',
                'hg_mx.json',
                'fairhope.json'
            ];
        }
        
        // Also check for split manifests (these take precedence)
        const splitManifests = [
            { manifest: 'data/gutenberg/manifest.json', volumeId: 'gutenberg' }
        ];
        
        const volumes = [];
        const addedVolumeIds = new Set();
        
        // First, check for split manifests (they take precedence)
        for (const { manifest, volumeId } of splitManifests) {
            try {
                const response = await fetch(`./${manifest}`);
                
                if (!response.ok) {
                    continue;
                }
                
                const data = await response.json();
                const rootKey = Object.keys(data)[0];
                const rootData = data[rootKey];
                
                if (rootData &&
                    rootData.display_config &&
                    rootData.display_config.volume_type === 'wheel_hierarchical' &&
                    (rootData.display_config.structure_type === 'split' || rootData.display_config.structure_type === 'split_chapters')) {
                    
                    const schemaVersion = rootData.display_config.volume_schema_version || '1.0.0';
                    const dataVersion = rootData.display_config.volume_data_version || 'unknown';
                    const structureType = rootData.display_config.structure_type;
                    
                    Logger.info(`📦 Split volume discovered: ${rootData.display_config.volume_name}`);
                    Logger.info(`   Schema: ${schemaVersion} | Data: ${dataVersion} | Structure: ${structureType}`);
                    
                    volumes.push({
                        filename: manifest,
                        name: rootData.display_config.volume_name || volumeId,
                        description: rootData.display_config.volume_description || '',
                        version: rootData.display_config.wheel_volume_version,
                        schemaVersion: schemaVersion,
                        dataVersion: dataVersion,
                        structureType: structureType,
                        rootKey: rootKey
                    });
                    
                    addedVolumeIds.add(volumeId);
                    Logger.debug(`✅ Found split volume: ${rootData.display_config.volume_name}`);
                }
            } catch (error) {
                Logger.debug(`⏭️  Error checking split manifest ${manifest}: ${error.message}`);
            }
        }
        
        // Then check monolithic volumes (skip if split version already found)
        for (const filename of volumeFiles) {
            // Extract volume ID from filename (e.g., 'gutenberg.json' -> 'gutenberg')
            const volumeId = filename.replace('.json', '');
            
            // Skip if split version already discovered
            if (addedVolumeIds.has(volumeId)) {
                Logger.debug(`⏭️  Skipping ${filename} - split version already loaded`);
                continue;
            }
            
            try {
                const response = await fetch(`./${filename}`);
                
                if (!response.ok) {
                    continue;
                }
                
                const data = await response.json();
                
                // Check for Wheel volume identification keys
                const rootKey = Object.keys(data)[0];
                const rootData = data[rootKey];
                
                if (rootData &&
                    rootData.display_config &&
                    rootData.display_config.volume_type === 'wheel_hierarchical' &&
                    rootData.display_config.wheel_volume_version) {
                    
                    const schemaVersion = rootData.display_config.volume_schema_version || '1.0.0';
                    const dataVersion = rootData.display_config.volume_data_version || 'unknown';
                    const structureType = rootData.display_config.structure_type || 'monolithic';
                    
                    Logger.info(`📦 Volume schema: ${schemaVersion} | data: ${dataVersion} | structure: ${structureType}`);
                    
                    volumes.push({
                        filename: filename,
                        name: rootData.display_config.volume_name || filename,
                        description: rootData.display_config.volume_description || '',
                        version: rootData.display_config.wheel_volume_version,
                        schemaVersion: schemaVersion,
                        dataVersion: dataVersion,
                        structureType: structureType,
                        rootKey: rootKey
                    });
                    
                    Logger.debug(`✅ Found valid Wheel volume: ${rootData.display_config.volume_name}`);
                } else {
                    Logger.debug(`⏭️  ${filename} missing required Wheel volume keys`);
                }
            } catch (error) {
                // File doesn't exist or isn't valid JSON - skip it
                Logger.debug(`⏭️  Error checking ${filename}: ${error.message}`);
            }
        }
        
        this.availableVolumes = volumes;
        Logger.info(`🔍 Discovery complete: ${volumes.length} Wheel volume(s) found`);
        
        if (volumes.length > 0) {
            volumes.forEach(vol => {
                Logger.verbose(`   - ${vol.name} (${vol.filename}) [${vol.structureType}]`);
            });
        }
        
        return volumes;
    }

    /**
     * Load a specific Wheel volume by filename
     * @param {string} filename - Name of the JSON file to load (e.g., 'mmdm_catalog.json')
     * @returns {Promise<Object>} The loaded volume data structure
     * @throws {Error} If volume cannot be loaded or is invalid
     */
    async loadVolume(filename) {
        this.loading = true;
        Logger.debug(`📂 Loading volume: ${filename}`);
        
        try {
            const response = await fetch(`./${filename}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.data = await response.json();

            // Determine root data key (e.g., 'MMdM', 'Gutenberg_Bible')
            this.rootDataKey = Object.keys(this.data)[0];
            
            if (!this.validateData(this.data)) {
                throw new Error('Invalid data structure received');
            }
            
            // Log schema information
            const displayConfig = this.getDisplayConfig();
            if (displayConfig) {
                const schemaVersion = displayConfig.volume_schema_version || '1.0.0';
                const dataVersion = displayConfig.volume_data_version || 'unknown';
                const structureType = displayConfig.structure_type || 'monolithic';
                this.cacheVersion = this.computeCacheVersion(displayConfig, filename);
                
                Logger.info(`📦 Loaded volume schema: ${schemaVersion} | data: ${dataVersion} | structure: ${structureType}`);
                
                // Check if structure type is supported
                if (structureType === 'split') {
                    Logger.info(`📂 Split structure detected - lazy loading enabled for external book files`);
                } else if (structureType === 'split_chapters') {
                    Logger.info(`📂 Chapter-level split structure detected - lazy loading enabled for external chapter files`);
                }
            }
            
            this.currentVolumePath = filename;
            // Reset external load tracking for new volume context
            this.lazyLoader.clearLoadedFiles();
            Logger.info(`✅ Volume loaded successfully: ${filename}`);
            return this.data;
            
        } catch (error) {
            Logger.error(`❌ Failed to load volume ${filename}:`, error);
            this.data = null;
            throw new Error(`Unable to load volume: ${error.message}`);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Check if current volume uses split structure with lazy loading
     * @returns {boolean} True if volume uses split structure
     */
    isSplitStructure() {
        return this.lazyLoader.isSplitStructure();
    }

    /**
     * Check if current volume uses chapter-level split structure
     * @returns {boolean} True if volume uses chapter-level split structure
     */
    isChapterSplitStructure() {
        return this.lazyLoader.isChapterSplitStructure();
    }

    /**
     * Load external file data and merge into the main data structure
     * @param {string} externalFilePath - Path to the external JSON file
     * @param {Object} targetLocation - Location in data structure to merge into
     * @returns {Promise<Object>} The loaded data
     */
    async loadExternalFile(externalFilePath, targetLocation) {
        return this.lazyLoader.loadExternalFile(externalFilePath, targetLocation);
    }

    /**
     * Ensure book data is loaded before accessing its children (chapters)
     * @param {Object} bookItem - The book item that may need loading
     * @returns {Promise<boolean>} True if book is ready
     */
    async ensureBookLoaded(bookItem) {
        return this.lazyLoader.ensureBookLoaded(bookItem);
    }

    /**
     * Get the actual data location for a book item
     * @param {Object} bookItem - Book item with __path metadata
     * @returns {Object|null} The book data object
     */
    getBookDataLocation(bookItem) {
        return this.lazyLoader.getBookDataLocation(bookItem);
    }

    /**
     * Ensure chapter data is loaded before accessing its children (verses)
     * @param {Object} chapterItem - The chapter item that may need loading
     * @returns {Promise<boolean>} True if chapter is ready
     */
    async ensureChapterLoaded(chapterItem) {
        return this.lazyLoader.ensureChapterLoaded(chapterItem);
    }

    /**
     * Get the actual data location for a chapter item
     * @param {Object} chapterItem - Chapter item with __path metadata
     * @returns {Object|null} The chapter data object
     */
    getChapterDataLocation(chapterItem) {
        return this.lazyLoader.getChapterDataLocation(chapterItem);
    }

    async load() {
        // Legacy support - load default volume if no volume selector is used
        if (this.data) return this.data;
        if (this.loadPromise) return this.loadPromise;

        // Discover volumes and load the first one
        await this.discoverVolumes();
        const defaultVolume = this.availableVolumes?.[0]?.filename || 'mmdm_catalog.json';
        this.loadPromise = this.loadVolume(defaultVolume);
        return this.loadPromise;
    }

    async performLoad() {
        // Deprecated - use load() instead
        return this.load();
    }

    validateData(data) {
        if (!data || !this.rootDataKey) {
            Logger.error('Validation failed: missing data or root key');
            return false;
        }
        
        const rootData = data[this.rootDataKey];
        if (!rootData || !rootData.display_config) {
            Logger.error('Validation failed: missing display_config');
            return false;
        }
        
        const cfg = rootData.display_config;
        if (cfg.volume_type !== 'wheel_hierarchical') {
            Logger.error('Validation failed: volume_type must be wheel_hierarchical');
            return false;
        }
        if (!cfg.wheel_volume_version) {
            Logger.error('Validation failed: missing wheel_volume_version');
            return false;
        }
        if (!cfg.volume_schema_version) {
            Logger.error('Validation failed: missing volume_schema_version');
            return false;
        }
        if (!cfg.hierarchy_levels || Object.keys(cfg.hierarchy_levels).length === 0) {
            Logger.error('Validation failed: hierarchy_levels missing or empty');
            return false;
        }
        
        const levelNames = Object.keys(cfg.hierarchy_levels);
        const firstLevelPlural = this.getPluralPropertyName(levelNames[0]);
        const firstLevelData = rootData[firstLevelPlural];
        if (!firstLevelData || typeof firstLevelData !== 'object') {
            Logger.error('Validation failed: root collection missing');
            return false;
        }
        
        return true;
    }

    computeCacheVersion(displayConfig, filename) {
        const schema = displayConfig?.volume_schema_version || 'unknown-schema';
        const dataVersion = displayConfig?.volume_data_version || 'unknown-data';
        const volumeName = displayConfig?.volume_name || filename || 'unknown-volume';
        const version = `${volumeName}|${schema}|${dataVersion}`;
        
        // Update cache manager with the version
        this.cacheManager.setCacheVersion(version);
        
        return version;
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