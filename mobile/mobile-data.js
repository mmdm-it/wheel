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
        
        // Virtual levels and pseudo-parent handling
        this.virtualLevels = new DataVirtualLevels(this);
        
        // Hierarchy navigation (core getItemsAtLevel)
        this.hierarchyNavigator = new DataHierarchyNavigator(this);
        
        // Item building (normalization, parent properties, sorting)
        this.itemBuilder = new ItemBuilder(this);
        
        // Phase 4 Consolidation: Bilingual coordinate storage
        this.coordinateCache = new Map(); // Item key -> HubNucCoordinate
        this.coordinateMetadata = new Map(); // Level -> coordinate stats

        // Targeted item tracing (trace items matching this path/name)
        this.traceItemTarget = 'Lockwood-Ash';
    }

    getActiveTraceTarget() {
        if (typeof window !== 'undefined') {
            const runtimeOverride = window.DEBUG_ITEM_TRACE;
            if (typeof runtimeOverride === 'string') {
                const trimmed = runtimeOverride.trim();
                if (trimmed.length === 0) {
                    return null;
                }
                return trimmed;
            }
        }
        return this.traceItemTarget;
    }

    shouldTraceItem(item) {
        const target = this.getActiveTraceTarget();
        if (!target || !item) {
            return false;
        }

        const normalizedTarget = target.toLowerCase();
        const candidates = [];

        // Check top-level ancestor (first path segment)
        if (Array.isArray(item.__path) && item.__path.length > 0) {
            candidates.push(item.__path[0]);
        }

        if (item.name) {
            candidates.push(item.name);
        }

        if (Array.isArray(item.__path)) {
            candidates.push(...item.__path);
        }

        return candidates.some(value => typeof value === 'string' && value.toLowerCase().includes(normalizedTarget));
    }

    traceItem(item, message, extraContext = null) {
        if (!this.shouldTraceItem(item)) {
            return;
        }

        const prefix = this.getActiveTraceTarget() || 'Item';
        if (extraContext !== null) {
            Logger.info(`[Trace:${prefix}] ${message}`, extraContext);
        } else {
            Logger.info(`[Trace:${prefix}] ${message}`);
        }
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
     */
    getItemCoordinates(itemKey) {
        return this.coordinateCache.get(itemKey) || null;
    }

    /**
     * Phase 4 Consolidation: Get coordinate statistics
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
            this.loadedExternalFiles.clear();
            this.externalFileLoadingPromises.clear();
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
        if (!item) {
            return null;
        }

        const displayConfig = this.getDisplayConfig() || {};
        const baseConfig = displayConfig.detail_sector || {};
        const levelConfig = this.getHierarchyLevelConfig(item.__level) || {};
        const levelDetail = levelConfig.detail_sector || {};
        const itemDetail = (item.data && item.data.detail_sector) || item.detail_sector || {};

        return this.mergeDetailSectorConfigs(baseConfig, levelDetail, itemDetail);
    }

    /**
     * Build a rendering context for template resolution
     * Flattens item properties and data for template interpolation
     * @param {Object} item - Item to build context for
     * @returns {Object} Context object with flattened properties for templating
     */
    getDetailSectorContext(item) {
        if (!item) {
            return {};
        }

        const context = {
            name: item.name,
            level: item.__level,
            key: item.key,
            path: item.__path,
            data: item.data || {},
            display_config: this.getDisplayConfig() || {}
        };

        // Copy top-level properties from item
        Object.keys(item).forEach(key => {
            if (key.startsWith('__')) {
                return;
            }
            if (key === 'data' || key === 'detail_sector') {
                return;
            }
            context[key] = item[key];
        });

        // Also copy properties from item.data (where audio_file, year, etc. are stored)
        if (item.data && typeof item.data === 'object') {
            Object.keys(item.data).forEach(key => {
                // Don't overwrite existing context properties
                if (context[key] === undefined) {
                    context[key] = item.data[key];
                }
            });
        }

        // Add hierarchical ancestor labels (generic - works for any volume)
        // Maps path positions to ancestor1, ancestor2, etc.
        if (item.__path && item.__path.length >= 2) {
            const levelNames = this.getHierarchyLevelNames();
            item.__path.forEach((segment, index) => {
                if (index < item.__path.length - 1) { // Skip the current item
                    const levelName = levelNames[index] || `ancestor${index + 1}`;
                    // Add both generic and level-specific keys
                    context[`ancestor${index + 1}`] = segment;
                    context[levelName] = segment;
                }
            });
            Logger.verbose('📋 Added hierarchical context:', { path: item.__path, ancestors: item.__path.slice(0, -1) });
        }

        return context;
    }

    /**
     * Merge detail sector config layers with predictable overrides
     */
    mergeDetailSectorConfigs(...configs) {
        const merged = {
            mode: null,
            default_image: null,
            header: null,
            views: []
        };

        const viewOrder = [];
        const viewIndexById = new Map();

        configs.forEach(config => {
            if (!config) {
                return;
            }

            if (config.mode !== undefined) {
                merged.mode = config.mode;
            }

            if (config.default_image !== undefined) {
                merged.default_image = config.default_image;
            }

            if (config.header !== undefined) {
                merged.header = config.header;
            }

            if (Array.isArray(config.views)) {
                config.views.forEach(view => {
                    if (!view) {
                        return;
                    }

                    if (!view.id) {
                        viewOrder.push(view);
                        return;
                    }

                    if (viewIndexById.has(view.id)) {
                        const index = viewIndexById.get(view.id);
                        viewOrder[index] = view;
                    } else {
                        viewIndexById.set(view.id, viewOrder.length);
                        viewOrder.push(view);
                    }
                });
            }
        });

        merged.views = viewOrder;
        return merged;
    }

    /**
     * Resolve a dotted path within a context object
     */
    resolveDetailPath(path, context) {
        if (!path || !context) {
            return undefined;
        }

        return path.split('.').reduce((accumulator, segment) => {
            if (accumulator === undefined || accumulator === null) {
                return undefined;
            }

            const trimmed = segment.trim();

            if (!trimmed) {
                return accumulator;
            }

            if (trimmed.endsWith(']')) {
                const bracketIndex = trimmed.indexOf('[');
                if (bracketIndex === -1) {
                    return accumulator[trimmed];
                }

                const property = trimmed.slice(0, bracketIndex);
                const indexValue = trimmed.slice(bracketIndex + 1, trimmed.length - 1);
                const numericIndex = parseInt(indexValue, 10);

                const target = property ? accumulator[property] : accumulator;

                if (!Array.isArray(target)) {
                    return undefined;
                }

                if (isNaN(numericIndex)) {
                    return undefined;
                }

                return target[numericIndex];
            }

            return accumulator[trimmed];
        }, context);
    }

    /**
     * Interpolate template placeholders using context data
     * Supports {{property}} and {{object.property}} syntax
     * @param {string} template - Template string with {{placeholders}}
     * @param {Object} context - Context object with property values
     * @returns {string} Resolved template with placeholders replaced
     */
    resolveDetailTemplate(template, context) {
        if (typeof template !== 'string' || !template.includes('{{')) {
            return template || '';
        }

        return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, token) => {
            const value = this.resolveDetailPath(token, context);
            if (value === undefined || value === null) {
                return '';
            }
            return String(value);
        });
    }

    /**
     * Get the ordered list of hierarchy level names
     */
    getHierarchyLevelNames() {
        const displayConfig = this.getDisplayConfig();
        if (!displayConfig || !displayConfig.hierarchy_levels) return [];
        return Object.keys(displayConfig.hierarchy_levels);
    }

    /**
     * Get the depth/level index for a given level name
     */
    getHierarchyLevelDepth(levelName) {
        const levelNames = this.getHierarchyLevelNames();
        return levelNames.indexOf(levelName);
    }

    getData() {
        return this.data;
    }

    getTopLevelCollectionName() {
        if (!this.rootDataKey) return null;
        const levelNames = this.getHierarchyLevelNames();
        if (levelNames.length === 0) return null;
        return this.getPluralPropertyName(levelNames[0]);
    }

    getTopLevelCollection() {
        if (!this.data || !this.rootDataKey) return {};
        const rootData = this.data[this.rootDataKey];
        const collectionName = this.getTopLevelCollectionName();
        return rootData && rootData[collectionName] || {};
    }

    getTopLevelKeys() {
        // Generic method - returns keys from top-level collection
        const topLevel = this.getTopLevelCollection();
        return Object.keys(topLevel);
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
            __path: [name]
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

    levelSupportsPseudoChild(parentLevelName, childLevelName) {
        return this.virtualLevels.levelSupportsPseudoChild(parentLevelName, childLevelName);
    }

    isPseudoLevel(levelName) {
        return this.virtualLevels.isPseudoLevel(levelName);
    }

    getPseudoTriggerPrefix(config) {
        return this.virtualLevels.getPseudoTriggerPrefix(config);
    }

    getPseudoTerminalLevel(levelName) {
        return this.virtualLevels.getPseudoTerminalLevel(levelName);
    }

    getItemProperty(item, propertyName) {
        return this.virtualLevels.getItemProperty(item, propertyName);
    }

    filterItemsByPseudoFilters(items, filters) {
        return this.virtualLevels.filterItemsByPseudoFilters(items, filters);
    }

    cloneLeafForPseudo(baseItem, pseudoPath) {
        return this.virtualLevels.cloneLeafForPseudo(baseItem, pseudoPath);
    }

    clonePseudoItems(items) {
        return this.virtualLevels.clonePseudoItems(items);
    }

    getPseudoSourceItems(parentItem, terminalLevelName) {
        return this.virtualLevels.getPseudoSourceItems(parentItem, terminalLevelName);
    }

    buildPseudoParentItem(parentItem, pseudoLevelName, groupName, baseItems, terminalLevelName, pseudoConfig, isOrphan = false, sortNumber = undefined) {
        return this.virtualLevels.buildPseudoParentItem(parentItem, pseudoLevelName, groupName, baseItems, terminalLevelName, pseudoConfig, isOrphan, sortNumber);
    }

    getPseudoParentItems(parentItem, pseudoLevelName, pseudoConfig) {
        return this.virtualLevels.getPseudoParentItems(parentItem, pseudoLevelName, pseudoConfig);
    }

    getItemsFromPseudoParent(parentItem, childLevelName, childLevelConfig) {
        return this.virtualLevels.getItemsFromPseudoParent(parentItem, childLevelName, childLevelConfig);
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