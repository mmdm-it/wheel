/**
 * Mobile Volume Data Manager
 * Manages data loading with error handling and caching
 */

import { Logger } from './mobile-logger.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';
import { ItemUtils } from './item-utils.js';
import { DataCacheManager } from './data-cache-manager.js';

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
        
        // Split structure support: Track loaded external files
        this.loadedExternalFiles = new Set();
        this.externalFileLoadingPromises = new Map(); // Prevent duplicate loads
        
        // Cache manager for persistent storage across sessions
        this.cacheManager = new DataCacheManager();
        
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
        // Clear memory cache
        this.loadedExternalFiles.clear();
        
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
        const displayConfig = this.getDisplayConfig();
        const structureType = displayConfig && displayConfig.structure_type;
        return structureType === 'split' || structureType === 'split_chapters';
    }

    /**
     * Check if current volume uses chapter-level split structure
     * @returns {boolean} True if volume uses chapter-level split structure
     */
    isChapterSplitStructure() {
        const displayConfig = this.getDisplayConfig();
        return displayConfig && displayConfig.structure_type === 'split_chapters';
    }

    /**
     * Load external file data and merge into the main data structure
     * Used for split volumes where books/sections are stored in separate files
     * @param {string} externalFilePath - Path to the external JSON file
     * @param {Object} targetLocation - Location in data structure to merge into
     * @returns {Promise<Object>} The loaded data
     */
    async loadExternalFile(externalFilePath, targetLocation) {
        // Check if already loaded
        if (this.loadedExternalFiles.has(externalFilePath)) {
            Logger.debug(`📦 External file already loaded: ${externalFilePath}`);
            return targetLocation;
        }
        
        // Check if load is already in progress
        if (this.externalFileLoadingPromises.has(externalFilePath)) {
            Logger.debug(`⏳ Waiting for in-progress load: ${externalFilePath}`);
            return this.externalFileLoadingPromises.get(externalFilePath);
        }
        
        // Start loading
        const loadPromise = this._performExternalFileLoad(externalFilePath, targetLocation);
        this.externalFileLoadingPromises.set(externalFilePath, loadPromise);
        
        try {
            const result = await loadPromise;
            return result;
        } finally {
            this.externalFileLoadingPromises.delete(externalFilePath);
        }
    }

    async _performExternalFileLoad(externalFilePath, targetLocation) {
        console.log(`🔍 DEBUG _performExternalFileLoad: path=${externalFilePath}`);
        Logger.info(`📥 Lazy loading external file: ${externalFilePath}`);
        
        try {
            // Check IndexedDB cache first
            const cachedData = await this.cacheManager.getCachedFile(externalFilePath);
            let externalData;
            
            if (cachedData) {
                console.log(`🔍 DEBUG: Using CACHED data for ${externalFilePath}`);
                Logger.info(`💾 Using cached data for: ${externalFilePath}`);
                externalData = cachedData;
            } else {
                console.log(`🔍 DEBUG: FETCHING from network: ${externalFilePath}`);
                // Fetch from network
                const response = await fetch(`./${externalFilePath}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                externalData = await response.json();
                console.log(`🔍 DEBUG: Fetched data, verses keys:`, externalData.verses ? Object.keys(externalData.verses).slice(0, 5) : 'no verses');
                
                // Cache for future use
                await this.cacheManager.setCachedFile(externalFilePath, externalData);
            }
            
            // Merge external data into target location
            // For book files, this means adding chapters data
            // For chapter files (split_chapters), this means adding verses data
            if (externalData.chapters) {
                targetLocation.chapters = externalData.chapters;
                targetLocation._loaded = true;
                Logger.info(`✅ Loaded ${Object.keys(externalData.chapters).length} chapters from ${externalFilePath}`);
            } else if (externalData.verses) {
                targetLocation.verses = externalData.verses;
                targetLocation._loaded = true;
                console.log(`🔍 DEBUG: Merged ${Object.keys(externalData.verses).length} verses into targetLocation`);
                console.log(`🔍 DEBUG: Sample verse 6:`, JSON.stringify(externalData.verses['6']).substring(0, 200));
                Logger.info(`✅ Loaded ${Object.keys(externalData.verses).length} verses from ${externalFilePath}`);
            } else {
                // Generic merge - copy all properties except metadata
                Object.keys(externalData).forEach(key => {
                    if (!key.startsWith('_')) {
                        targetLocation[key] = externalData[key];
                    }
                });
                targetLocation._loaded = true;
                Logger.info(`✅ Loaded external file: ${externalFilePath}`);
            }
            
            this.loadedExternalFiles.add(externalFilePath);
            return targetLocation;
            
        } catch (error) {
            Logger.error(`❌ Failed to load external file ${externalFilePath}:`, error);
            throw error;
        }
    }

    /**
     * Ensure book data is loaded before accessing its children (chapters)
     * @param {Object} bookItem - The book item that may need loading
     * @returns {Promise<boolean>} True if book is ready (already loaded or successfully loaded)
     */
    async ensureBookLoaded(bookItem) {
        if (!this.isSplitStructure()) {
            return true; // Monolithic structure - already loaded
        }
        
        // Navigate to the book in the data structure
        const bookData = this.getBookDataLocation(bookItem);
        
        if (!bookData) {
            Logger.warn(`ensureBookLoaded: Could not find book data for ${bookItem.name}`);
            return false;
        }
        
        // Check if book needs loading
        if (bookData._loaded === true) {
            return true; // Already loaded
        }
        
        if (!bookData._external_file) {
            Logger.debug(`ensureBookLoaded: Book ${bookItem.name} has no external file reference`);
            return true; // No external file - already has data
        }
        
        // Load the external file
        try {
            await this.loadExternalFile(bookData._external_file, bookData);
            return true;
        } catch (error) {
            Logger.error(`Failed to load book ${bookItem.name}:`, error);
            return false;
        }
    }

    /**
     * Get the actual data location for a book item
     * @param {Object} bookItem - Book item with __path metadata
     * @returns {Object|null} The book data object in the loaded data structure
     */
    getBookDataLocation(bookItem) {
        if (!bookItem || !bookItem.__path || bookItem.__path.length < 3) {
            return null;
        }
        
        const [testament, section, book] = bookItem.__path;
        const rootData = this.data && this.data[this.rootDataKey];
        
        if (!rootData || !rootData.testaments) {
            return null;
        }
        
        const testamentData = rootData.testaments[testament];
        if (!testamentData || !testamentData.sections) {
            return null;
        }
        
        const sectionData = testamentData.sections[section];
        if (!sectionData || !sectionData.books) {
            return null;
        }
        
        return sectionData.books[book];
    }

    /**
     * Ensure chapter data is loaded before accessing its children (verses)
     * @param {Object} chapterItem - The chapter item that may need loading
     * @returns {Promise<boolean>} True if chapter is ready (already loaded or successfully loaded)
     */
    async ensureChapterLoaded(chapterItem) {
        if (!this.isChapterSplitStructure()) {
            return true; // Not a chapter-split structure
        }
        
        // Navigate to the chapter in the data structure
        const chapterData = this.getChapterDataLocation(chapterItem);
        
        if (!chapterData) {
            Logger.warn(`ensureChapterLoaded: Could not find chapter data for ${chapterItem.name}`);
            return false;
        }
        
        // Check if chapter needs loading
        if (chapterData._loaded === true) {
            return true; // Already loaded
        }
        
        if (!chapterData._external_file) {
            Logger.debug(`ensureChapterLoaded: Chapter ${chapterItem.name} has no external file reference`);
            return true; // No external file - already has data
        }
        
        // Load the external file
        try {
            await this.loadExternalFile(chapterData._external_file, chapterData);
            return true;
        } catch (error) {
            Logger.error(`Failed to load chapter ${chapterItem.name}:`, error);
            return false;
        }
    }

    /**
     * Get the actual data location for a chapter item
     * @param {Object} chapterItem - Chapter item with __path metadata
     * @returns {Object|null} The chapter data object in the loaded data structure
     */
    getChapterDataLocation(chapterItem) {
        if (!chapterItem || !chapterItem.__path || chapterItem.__path.length < 4) {
            return null;
        }
        
        const [testament, section, book, chapter] = chapterItem.__path;
        const rootData = this.data && this.data[this.rootDataKey];
        
        if (!rootData || !rootData.testaments) {
            return null;
        }
        
        const testamentData = rootData.testaments[testament];
        if (!testamentData || !testamentData.sections) {
            return null;
        }
        
        const sectionData = testamentData.sections[section];
        if (!sectionData || !sectionData.books) {
            return null;
        }
        
        const bookData = sectionData.books[book];
        if (!bookData || !bookData.chapters) {
            return null;
        }
        
        return bookData.chapters[chapter];
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
        const levelNames = this.getHierarchyLevelNames();
        const virtualLevelDepth = this.getHierarchyLevelDepth(virtualLevelName);
        
        // Get the next level after virtual (the level that contains the raw data)
        const dataLevelName = levelNames[virtualLevelDepth + 1];
        if (!dataLevelName) {
            Logger.warn(`getVirtualLevelItems: No data level found after virtual level ${virtualLevelName}`);
            return [];
        }
        
        // Navigate to the parent location - the raw data should be directly accessible from parent
        let dataLocation = this.getTopLevelCollection();
        for (let i = 0; i < parentItem.__path.length; i++) {
            const pathSegment = parentItem.__path[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (dataLocation) {
                    // Check for second-level collection
                    const secondLevelPlural = this.getPluralPropertyName(levelNames[1]);
                    if (dataLocation[secondLevelPlural]) {
                        dataLocation = dataLocation[secondLevelPlural];
                    }
                }
            } else {
                let currentLocation = dataLocation;
                dataLocation = dataLocation && dataLocation[pathSegment];
                if (!dataLocation) {
                    // Fallback: try navigating through the collection for the parent level
                    const collectionName = this.getPluralPropertyName(parentItem.__level);
                    dataLocation = currentLocation && currentLocation[collectionName] && currentLocation[collectionName][pathSegment];
                    if (!dataLocation) {
                        Logger.warn(`getVirtualLevelItems: path segment '${pathSegment}' not found`);
                        return [];
                    }
                }
                if (i < parentItem.__path.length - 1) {
                    const nextLevelName = levelNames[i + 1];
                    const childCollectionName = this.getPluralPropertyName(nextLevelName);
                    if (dataLocation[childCollectionName]) {
                        dataLocation = dataLocation[childCollectionName];
                    }
                }
            }
        }
        
        // The data location now points to the parent item
        // For numeric levels with virtual groups, dataLocation is the specific numeric item
        // which may directly contain the child array (not in a separate collection property)
        let rawData = dataLocation;
        
        const childCollectionName = this.getPluralPropertyName(dataLevelName);
        if (rawData && rawData[childCollectionName]) {
            rawData = rawData[childCollectionName];
        }
        
        // Handle both arrays and objects with numeric/string keys
        let dataArray;
        if (Array.isArray(rawData)) {
            dataArray = rawData;
        } else if (rawData && typeof rawData === 'object') {
            // Convert object to array of values (for chapters, verses stored as objects)
            dataArray = Object.keys(rawData).map(key => ({
                ...rawData[key],
                name: key,
                __originalKey: key
            }));
        } else {
            Logger.warn(`getVirtualLevelItems: No data found for ${dataLevelName} level`);
            return [];
        }
        
        // Extract virtual level configuration
        const groupingProperty = virtualLevelConfig.virtual_grouping_property;
        const membershipProperty = virtualLevelConfig.virtual_membership_property;
        const orphanGroupName = virtualLevelConfig.virtual_orphan_group_name || 'Other';
        
        // Check if any items actually belong to virtual groups
        const hasGroupedItems = dataArray.some(item => item[membershipProperty] === true);
        
        if (!hasGroupedItems) {
            // No items are grouped - return raw data items directly as next level
            Logger.debug(`getVirtualLevelItems: No grouped items found, returning ${dataArray.length} items from ${dataLevelName} level`);
            const dataLevelDepth = this.getHierarchyLevelDepth(dataLevelName);
            
            return dataArray.map((item, index) => {
                const itemName = this.getItemDisplayName(item, `${dataLevelName}-${index}`);
                return {
                    name: itemName,
                    ...this.extractParentProperties(parentItem),
                    key: `${parentItem.key}/${itemName}`,
                    data: item,
                    index: index,
                    __level: dataLevelName,
                    __levelDepth: dataLevelDepth,
                    __isLeaf: true,
                    __path: [...parentItem.__path, itemName]
                };
            });
        }
        
        // Create virtual groups
        const groupMap = new Map();
        const orphanItems = [];
        
        dataArray.forEach(item => {
            if (item[membershipProperty] === true && item[groupingProperty]) {
                const groupName = item[groupingProperty];
                
                if (!groupMap.has(groupName)) {
                    const group = {
                        name: groupName,
                        [virtualLevelConfig.use_code_property ? `${virtualLevelName}Code` : '']: groupName,
                        ...this.extractParentProperties(parentItem),
                        key: `${parentItem.key}/${groupName}`,
                        itemCount: 0,
                        isOrphanGroup: false,
                        __level: virtualLevelName,
                        __levelDepth: virtualLevelDepth,
                        __isLeaf: false,
                        __path: [...parentItem.__path, groupName]
                    };
                    
                    // Add sort_number from curatorial judgment field if present
                    const rcjSortProperty = `rcj_${groupingProperty}_sort_number`;
                    if (item[rcjSortProperty] !== undefined) {
                        group.sort_number = item[rcjSortProperty];
                    }
                    
                    groupMap.set(groupName, group);
                    
                    // Remove empty property if use_code_property is false
                    if (!virtualLevelConfig.use_code_property) {
                        delete group[''];
                    }
                }
                
                groupMap.get(groupName).itemCount++;
            } else {
                orphanItems.push(item);
            }
        });
        
        // Add orphan group if there are orphans
        if (orphanItems.length > 0) {
            groupMap.set(orphanGroupName, {
                name: orphanGroupName,
                [virtualLevelConfig.use_code_property ? `${virtualLevelName}Code` : '']: orphanGroupName,
                ...this.extractParentProperties(parentItem),
                key: `${parentItem.key}/${orphanGroupName}`,
                itemCount: orphanItems.length,
                isOrphanGroup: true,
                __level: virtualLevelName,
                __levelDepth: virtualLevelDepth,
                __isLeaf: false,
                __path: [...parentItem.__path, orphanGroupName]
            });
            
            // Remove empty property if use_code_property is false
            if (!virtualLevelConfig.use_code_property) {
                delete groupMap.get(orphanGroupName)[''];
            }
            
            Logger.debug(`getVirtualLevelItems: Adopted ${orphanItems.length} orphan items into "${orphanGroupName}" group`);
        }
        
        const groups = Array.from(groupMap.values());
        Logger.debug(`getVirtualLevelItems: Found ${groups.length} ${virtualLevelName} groups`);
        
        // Apply universal sorting to virtual groups
        return this.sortItems(groups, virtualLevelConfig);
    }

    /**
     * UNIVERSAL METHOD: Get items for an aggregated level
     * Aggregated levels combine items from multiple intermediate levels
     */
    getAggregatedLevelItems(parentItem, aggregatedLevelName, aggregatedLevelConfig) {
        const intermediateLevelName = aggregatedLevelConfig.aggregates_across;
        const levelDepth = this.getHierarchyLevelDepth(aggregatedLevelName);
        const items = [];

        const parentLabel = parentItem.name || parentItem.key || 'unknown';
        Logger.debug(`getAggregatedLevelItems: parent=${parentLabel}, level=${aggregatedLevelName}, aggregates_across=${intermediateLevelName}`);

        const parentLocation = this.getDataLocationForItem(parentItem);
        if (!parentLocation) {
            Logger.warn('getAggregatedLevelItems: Unable to resolve parent location for aggregated retrieval');
            return [];
        }

        const aggregatedCollectionName = this.getPluralPropertyName(aggregatedLevelName);
        const intermediateCollectionName = this.getPluralPropertyName(intermediateLevelName);

        if (parentItem.__level === intermediateLevelName) {
            const aggregatedCollection = parentLocation[aggregatedCollectionName];

            if (!aggregatedCollection || typeof aggregatedCollection !== 'object') {
                Logger.warn(`getAggregatedLevelItems: No ${aggregatedCollectionName} found for ${parentLabel}`);
                return [];
            }

            if (Array.isArray(aggregatedCollection)) {
                aggregatedCollection.forEach((entry, index) => {
                    const itemName = entry && entry.name ? entry.name : `${aggregatedLevelName}-${index}`;
                    items.push({
                        name: itemName,
                        [intermediateLevelName]: parentItem.name || parentItem[intermediateLevelName],
                        ...this.extractParentProperties(parentItem),
                        key: `${parentItem.key}/${itemName}`,
                        data: entry,
                        __level: aggregatedLevelName,
                        __levelDepth: levelDepth,
                        __isLeaf: false,
                        __path: [...parentItem.__path, itemName]
                    });
                });
            } else {
                Object.keys(aggregatedCollection).forEach(itemName => {
                    const entry = aggregatedCollection[itemName];
                    items.push({
                        name: entry && entry.display_name ? entry.display_name : itemName,
                        [intermediateLevelName]: parentItem.name || parentItem[intermediateLevelName],
                        ...this.extractParentProperties(parentItem),
                        key: `${parentItem.key}/${itemName}`,
                        data: entry,
                        __level: aggregatedLevelName,
                        __levelDepth: levelDepth,
                        __isLeaf: false,
                        __path: [...parentItem.__path, itemName]
                    });
                });
            }

            Logger.debug(`getAggregatedLevelItems: collected ${items.length} aggregated items from intermediate parent ${parentLabel}`);
            return this.sortItems(items, aggregatedLevelConfig);
        }

        const intermediateCollection = parentLocation[intermediateCollectionName];

        if (!intermediateCollection || typeof intermediateCollection !== 'object') {
            Logger.warn(`getAggregatedLevelItems: No ${intermediateCollectionName} found at parent location`);
            Logger.debug(`getAggregatedLevelItems: parentLocation keys: ${parentLocation ? Object.keys(parentLocation) : 'null'}`);
            return [];
        }

        Logger.debug(`getAggregatedLevelItems: found ${Object.keys(intermediateCollection).length} intermediate items`);

        Object.keys(intermediateCollection).forEach(intermediateName => {
            const intermediateData = intermediateCollection[intermediateName];
            const aggregatedData = intermediateData && intermediateData[aggregatedCollectionName];

            if (aggregatedData && typeof aggregatedData === 'object') {
                Object.keys(aggregatedData).forEach(itemName => {
                    const entry = aggregatedData[itemName];
                    items.push({
                        name: entry && entry.display_name ? entry.display_name : itemName,
                        [intermediateLevelName]: intermediateName,
                        ...this.extractParentProperties(parentItem),
                        key: `${parentItem.key}/${intermediateName}/${itemName}`,
                        data: entry,
                        __level: aggregatedLevelName,
                        __levelDepth: levelDepth,
                        __isLeaf: false,
                        __path: [...parentItem.__path, intermediateName, itemName]
                    });
                });
            }
        });

        Logger.debug(`getAggregatedLevelItems: collected ${items.length} aggregated items`);

        return this.sortItems(items, aggregatedLevelConfig);
    }

    /**
     * UNIVERSAL METHOD: Get items from a virtual parent
     * When parent is a virtual grouping, get child items filtered by group membership
     */
    getItemsFromVirtualParent(virtualParentItem, childLevelName, virtualParentConfig) {
        const levelNames = this.getHierarchyLevelNames();
        const virtualParentLevelDepth = virtualParentItem.__levelDepth;
        const childLevelDepth = this.getHierarchyLevelDepth(childLevelName);
        
        // Navigate to the raw data location (one level above virtual parent in path)
        const pathToData = virtualParentItem.__path.slice(0, -1); // Remove virtual group name
        let dataLocation = this.getTopLevelCollection();
        
        for (let i = 0; i < pathToData.length; i++) {
            const pathSegment = pathToData[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (dataLocation) {
                    // Check for second-level collection
                    const secondLevelPlural = this.getPluralPropertyName(levelNames[1]);
                    if (dataLocation[secondLevelPlural]) {
                        dataLocation = dataLocation[secondLevelPlural];
                    }
                }
            } else {
                dataLocation = dataLocation && dataLocation[pathSegment];
                if (!dataLocation) {
                    Logger.warn(`getItemsFromVirtualParent: path segment '${pathSegment}' not found`);
                    return [];
                }
                if (i < pathToData.length - 1) {
                    const nextLevelName = levelNames[i + 1];
                    const childCollectionName = this.getPluralPropertyName(nextLevelName);
                    if (dataLocation[childCollectionName]) {
                        dataLocation = dataLocation[childCollectionName];
                    }
                }
            }
        }
        
        // Get raw data array
        // The dataLocation might already be an array (numeric levels may point directly to child arrays)
        let rawData;
        
        if (Array.isArray(dataLocation)) {
            rawData = dataLocation;
        } else {
            const childCollectionName = this.getPluralPropertyName(childLevelName);
            rawData = dataLocation && dataLocation[childCollectionName];
        }
        
        if (!rawData || !Array.isArray(rawData)) {
            Logger.warn(`getItemsFromVirtualParent: No array data found for ${childLevelName}`);
            return [];
        }
        
        // Filter by virtual group membership
        const groupName = virtualParentItem.__path[virtualParentItem.__path.length - 1];
        const groupingProperty = virtualParentConfig.virtual_grouping_property;
        const membershipProperty = virtualParentConfig.virtual_membership_property;
        const orphanGroupName = virtualParentConfig.virtual_orphan_group_name || 'Other';
        
        const filteredData = rawData.filter(item => {
            if (groupName === orphanGroupName) {
                return item[membershipProperty] !== true;
            } else {
                return item[membershipProperty] === true && item[groupingProperty] === groupName;
            }
        });
        
        // Convert to item objects
        const levelConfig = this.getHierarchyLevelConfig(childLevelName);
        const items = filteredData.map((item, index) => {
            const itemName = this.getItemDisplayName(item, `${childLevelName}-${index}`);
            return {
                name: itemName,
                ...this.extractParentProperties(virtualParentItem),
                key: `${virtualParentItem.key}/${itemName}`,
                data: item,
                index: index,
                __level: childLevelName,
                __levelDepth: childLevelDepth,
                __isLeaf: true,
                __path: [...virtualParentItem.__path, itemName]
            };
        });
        
        return this.sortItems(items, levelConfig);
    }

    /**
     * UNIVERSAL METHOD: Check if a virtual level can be skipped
     */
    canSkipVirtualLevel(parentLevelName, childLevelName, levelNames) {
        const parentDepth = levelNames.indexOf(parentLevelName);
        const childDepth = levelNames.indexOf(childLevelName);

        if (parentDepth === -1 || childDepth === -1) {
            return false;
        }

        if (childDepth <= parentDepth + 1) {
            return false;
        }

        for (let i = parentDepth + 1; i < childDepth; i++) {
            const skippedLevelName = levelNames[i];
            const skippedLevelConfig = this.getHierarchyLevelConfig(skippedLevelName);
            if (!skippedLevelConfig) {
                return false;
            }

            const isVirtual = skippedLevelConfig.is_virtual === true;
            const isPseudo = skippedLevelConfig.is_pseudo_parent === true;
            if (!isVirtual && !isPseudo) {
                return false;
            }
        }

        return true;
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
        if (!parentItem || !childLevelName) {
            Logger.warn('getItemsAtLevel: missing parentItem or childLevelName');
            return [];
        }

        const levelNames = this.getHierarchyLevelNames();
        const parentLevelName = parentItem.__level;
        const parentLevelDepth = parentItem.__levelDepth;
        let childLevelDepth = this.getHierarchyLevelDepth(childLevelName);
        let childLevelConfig = this.getHierarchyLevelConfig(childLevelName);
        const parentLevelConfig = this.getHierarchyLevelConfig(parentLevelName);
        const dataPath = parentItem.__dataPath || parentItem.__path || [];

        this.traceItem(parentItem, `getItemsAtLevel request: ${parentLevelName} → ${childLevelName}`, {
            parentLevel: parentLevelName,
            childLevel: childLevelName,
            path: Array.isArray(dataPath) ? [...dataPath] : []
        });

        // Handle pseudo parent navigation before any structural validation
        if (parentItem.__isPseudoParent) {
            return this.getItemsFromPseudoParent(parentItem, childLevelName, childLevelConfig);
        }

        if (this.levelSupportsPseudoChild(parentLevelName, childLevelName)) {
            const pseudoItems = this.getPseudoParentItems(parentItem, childLevelName, childLevelConfig);
            if (pseudoItems && pseudoItems.length) {
                return pseudoItems;
            }

            const terminalLevelName = this.getPseudoTerminalLevel(childLevelName);
            if (terminalLevelName && terminalLevelName !== childLevelName) {
                const previousLevelName = childLevelName;
                Logger.debug(`getItemsAtLevel: No pseudo ${previousLevelName} nodes; falling back to ${terminalLevelName}`);
                this.traceItem(parentItem, `Pseudo level empty → falling back to ${terminalLevelName}`, {
                    requestedLevel: previousLevelName,
                    terminalLevel: terminalLevelName
                });
                childLevelName = terminalLevelName;
                childLevelConfig = this.getHierarchyLevelConfig(childLevelName);
                childLevelDepth = this.getHierarchyLevelDepth(childLevelName);
            }
        }

        // Check if child level is virtual
        if (childLevelConfig && childLevelConfig.is_virtual) {
            return this.getVirtualLevelItems(parentItem, childLevelName, childLevelConfig);
        }

        // Check if child level aggregates across an intermediate level
        if (childLevelConfig && childLevelConfig.aggregates_across) {
            return this.getAggregatedLevelItems(parentItem, childLevelName, childLevelConfig);
        }

        // Check if this is requesting child items from a virtual level parent
        if (parentLevelConfig && parentLevelConfig.is_virtual) {
            return this.getItemsFromVirtualParent(parentItem, childLevelName, parentLevelConfig);
        }
        
        // Special exception: Allow skipping empty virtual levels
        const allowSkipVirtual = this.canSkipVirtualLevel(parentLevelName, childLevelName, levelNames);
        const isImmediateChild = childLevelDepth === parentLevelDepth + 1;
        
        if (!isImmediateChild) {
            if (!allowSkipVirtual) {
                Logger.warn(`getItemsAtLevel: ${childLevelName} is not the immediate child of ${parentLevelName}`);
                this.traceItem(parentItem, `Rejected non-immediate level ${childLevelName}`, {
                    parentLevel: parentLevelName,
                    childLevel: childLevelName,
                    parentDepth: parentLevelDepth,
                    childDepth: childLevelDepth
                });
                return [];
            }

            this.traceItem(parentItem, `Skipping virtual/pseudo levels between ${parentLevelName} and ${childLevelName}`, {
                parentDepth: parentLevelDepth,
                childDepth: childLevelDepth
            });
        }

        // Navigate to the data location using the parent's path
        let dataLocation = this.getTopLevelCollection();
        let alreadyInChildCollection = false; // Track if we're already in the target child collection
        
        // Build the path through the JSON structure
        for (let i = 0; i < dataPath.length; i++) {
            const pathSegment = dataPath[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                // First level: navigate to the top-level group
                dataLocation = dataLocation[pathSegment];
                if (!dataLocation) {
                    Logger.warn(`getItemsAtLevel: top-level group '${pathSegment}' not found`);
                    this.traceItem(parentItem, `Missing top-level segment '${pathSegment}'`, {
                        level: currentLevelName,
                        path: dataPath
                    });
                    return [];
                }
                // Top-level groups may have a second-level collection property
                const secondLevelPlural = this.getPluralPropertyName(levelNames[1]);
                if (dataLocation[secondLevelPlural]) {
                    // If the requested child level IS the second level, we're done navigating
                    if (childLevelName === levelNames[1]) {
                        dataLocation = dataLocation[secondLevelPlural];
                        alreadyInChildCollection = true;
                    } else {
                        // Otherwise, navigate into it for further traversal
                        dataLocation = dataLocation[secondLevelPlural];
                    }
                }
            } else {
                // For subsequent levels, we're already at the parent collection
                // Navigate to the specific item
                dataLocation = dataLocation && dataLocation[pathSegment];
                if (!dataLocation) {
                    Logger.warn(`getItemsAtLevel: '${pathSegment}' not found at level ${currentLevelName}`);
                    this.traceItem(parentItem, `Path segment '${pathSegment}' missing at level ${currentLevelName}`, {
                        path: dataPath
                    });
                    return [];
                }
                
                // Then navigate to the child collection for the next iteration
                // (except on the last iteration, where we want to stay at the parent item)
                if (i < dataPath.length - 1) {
                    const nextLevelName = levelNames[i + 1];
                    const childCollectionName = this.getPluralPropertyName(nextLevelName);
                    if (dataLocation[childCollectionName]) {
                        dataLocation = dataLocation[childCollectionName];
                    }
                }
            }
        }

        // Now dataLocation is at the parent item (or already in child collection if alreadyInChildCollection)
        let childrenData;
        
        if (alreadyInChildCollection) {
            // We're already in the child collection, use it directly
            childrenData = dataLocation;
        } else {
            // Navigate to child collection from parent item
            const childCollectionName = this.getPluralPropertyName(childLevelName);
            childrenData = dataLocation && dataLocation[childCollectionName];
            
            // Split structure support: Check if data needs lazy loading
            if (!childrenData && this.isSplitStructure() && dataLocation && dataLocation._external_file) {
                // Data needs to be loaded from external file
                Logger.info(`📥 Split structure: ${childCollectionName} needs lazy loading from ${dataLocation._external_file}`);
                
                // Mark that lazy loading is needed but not yet loaded
                // Return empty array - the caller should trigger async load
                this._pendingLazyLoad = {
                    parentItem: parentItem,
                    childLevelName: childLevelName,
                    externalFile: dataLocation._external_file,
                    targetLocation: dataLocation
                };
                
                // Return empty for now - UI should detect and trigger async load
                return [];
            }
        }
        
        if (!childrenData) {
            const childCollectionName = this.getPluralPropertyName(childLevelName);
            Logger.warn(`getItemsAtLevel: could not find '${childCollectionName}' property for ${childLevelName}`);
            this.traceItem(parentItem, `Missing child collection '${childCollectionName}' for ${childLevelName}`, {
                parentPath: dataPath
            });
            return [];
        }

        // Get the child items from this location
        const childItems = this.extractChildItems(childrenData, childLevelName, parentItem);
        this.traceItem(parentItem, `Resolved ${childItems.length} ${childLevelName} item(s)`, {
            sampleNames: childItems.slice(0, 3).map(item => item.name)
        });
        return childItems;
    }

    /**
     * Get plural property name for a level (e.g., 'category' → 'categories')
     * Uses configuration-driven irregular plurals from catalog JSON
     */
    getPluralPropertyName(levelName) {
        // Check if level config specifies a custom plural
        const displayConfig = this.getDisplayConfig();
        const levelConfig = displayConfig && displayConfig.hierarchy_levels && displayConfig.hierarchy_levels[levelName];
        
        if (levelConfig && levelConfig.plural_property_name) {
            return levelConfig.plural_property_name;
        }
        
        // Check for irregular plurals in display_config
        if (displayConfig && displayConfig.irregular_plurals && displayConfig.irregular_plurals[levelName]) {
            return displayConfig.irregular_plurals[levelName];
        }
        
        // Simple pluralization - handle common cases
        if (levelName.endsWith('y')) {
            return levelName.slice(0, -1) + 'ies';
        } else {
            return levelName + 's';
        }
    }

    levelSupportsPseudoChild(parentLevelName, childLevelName) {
        if (!parentLevelName || !childLevelName) {
            return false;
        }

        const parentConfig = this.getHierarchyLevelConfig(parentLevelName);
        if (!parentConfig || !Array.isArray(parentConfig.supports_pseudo_parents)) {
            return false;
        }

        return parentConfig.supports_pseudo_parents.includes(childLevelName);
    }

    isPseudoLevel(levelName) {
        const config = this.getHierarchyLevelConfig(levelName);
        return !!(config && config.is_pseudo_parent);
    }

    getPseudoTriggerPrefix(config) {
        if (config && config.pseudo_trigger_prefix) {
            return config.pseudo_trigger_prefix;
        }
        return 'rpp_';
    }

    getPseudoTerminalLevel(levelName) {
        const levelNames = this.getHierarchyLevelNames();
        const startIndex = levelNames.indexOf(levelName);
        if (startIndex === -1) {
            return null;
        }

        for (let i = startIndex + 1; i < levelNames.length; i++) {
            const candidate = levelNames[i];
            if (!this.isPseudoLevel(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    getItemProperty(item, propertyName) {
        if (!item || !propertyName) {
            return undefined;
        }

        if (item[propertyName] !== undefined) {
            return item[propertyName];
        }

        if (item.data && item.data[propertyName] !== undefined) {
            return item.data[propertyName];
        }

        return undefined;
    }

    filterItemsByPseudoFilters(items, filters) {
        if (!filters || !Object.keys(filters).length) {
            return items;
        }

        return items.filter(item => {
            return Object.entries(filters).every(([levelName, expectedValue]) => {
                if (expectedValue === null || expectedValue === undefined) {
                    return true;
                }
                const actualValue = this.getItemProperty(item, levelName);
                return actualValue === expectedValue;
            });
        });
    }

    cloneLeafForPseudo(baseItem, pseudoPath) {
        const clone = { ...baseItem };
        const safePseudoPath = Array.isArray(pseudoPath) ? [...pseudoPath] : [];
        const leafName = baseItem.name || baseItem.key || 'item';
        clone.__path = [...safePseudoPath, leafName];
        const dataPath = baseItem.__dataPath || baseItem.__path || [];
        clone.__dataPath = Array.isArray(dataPath) ? [...dataPath] : [];
        clone.key = clone.__path.join('/');
        clone.__isLeaf = true;
        clone.__hasPseudoParent = true; // Mark that this item has a pseudo parent
        return clone;
    }

    clonePseudoItems(items) {
        return items.map(item => ({
            ...item,
            __path: Array.isArray(item.__path) ? [...item.__path] : [],
            __dataPath: item.__dataPath ? [...item.__dataPath] : undefined
        }));
    }

    getPseudoSourceItems(parentItem, terminalLevelName) {
        if (parentItem.__isPseudoParent && Array.isArray(parentItem.__pseudoSourceItems)) {
            return this.clonePseudoItems(parentItem.__pseudoSourceItems);
        }

        const parentData = this.getDataLocationForItem(parentItem);
        if (!parentData) {
            Logger.warn('getPseudoSourceItems: Unable to resolve parent data location');
            return [];
        }

        let rawData;
        if (Array.isArray(parentData)) {
            rawData = parentData;
        } else {
            const collectionName = this.getPluralPropertyName(terminalLevelName);
            rawData = parentData[collectionName];
        }

        if (!rawData) {
            Logger.warn(`getPseudoSourceItems: No raw data found for terminal level ${terminalLevelName}`);
            return [];
        }

        return this.extractChildItems(rawData, terminalLevelName, parentItem);
    }

    buildPseudoParentItem(parentItem, pseudoLevelName, groupName, baseItems, terminalLevelName, pseudoConfig, isOrphan = false, sortNumber = undefined) {
        const pseudoPath = [...(parentItem.__path || []), groupName];
        const childClones = baseItems.map(item => this.cloneLeafForPseudo(item, pseudoPath));

        const pseudoItem = {
            name: groupName,
            key: pseudoPath.join('/'),
            __level: pseudoLevelName,
            __levelDepth: this.getHierarchyLevelDepth(pseudoLevelName),
            __isLeaf: false,
            __path: pseudoPath,
            __dataPath: parentItem.__dataPath || parentItem.__path,
            __isPseudoParent: true,
            __pseudoLevel: pseudoLevelName,
            __pseudoTerminalLevel: terminalLevelName,
            __pseudoSourceItems: childClones,
            __pseudoFilters: {
                ...(parentItem.__pseudoFilters || {}),
                [pseudoLevelName]: isOrphan ? null : groupName
            },
            __pseudoIsOrphanGroup: isOrphan,
            data: {
                is_pseudo_parent: true,
                group_label: groupName,
                child_count: childClones.length,
                is_orphan: isOrphan
            }
        };

        // Add sort_number if provided (authored in configuration)
        if (sortNumber !== undefined) {
            pseudoItem.sort_number = sortNumber;
            pseudoItem.data.sort_number = sortNumber;
        }

        return pseudoItem;
    }

    getPseudoParentItems(parentItem, pseudoLevelName, pseudoConfig) {
        if (!pseudoConfig) {
            Logger.warn(`getPseudoParentItems: Missing config for level ${pseudoLevelName}`);
            return [];
        }

        const terminalLevelName = this.getPseudoTerminalLevel(pseudoLevelName);
        if (!terminalLevelName) {
            Logger.warn(`getPseudoParentItems: Unable to determine terminal level for ${pseudoLevelName}`);
            return [];
        }

        const sourceItems = this.getPseudoSourceItems(parentItem, terminalLevelName);
        if (!sourceItems.length) {
            return [];
        }

        const filteredItems = this.filterItemsByPseudoFilters(sourceItems, parentItem.__pseudoFilters || {});
        if (!filteredItems.length) {
            return [];
        }

        const triggerPrefix = this.getPseudoTriggerPrefix(pseudoConfig);
        const triggerProperty = `${triggerPrefix}${pseudoLevelName}`;
        const valueProperty = pseudoConfig.pseudo_value_property || pseudoLevelName;
        const orphanGroupName = pseudoConfig.pseudo_orphan_group || `Uncategorized ${pseudoLevelName}`;

        const groupMap = new Map();
        const orphanItems = [];

        filteredItems.forEach(item => {
            const isTriggered = this.getItemProperty(item, triggerProperty) === true;
            const groupValue = this.getItemProperty(item, valueProperty);

            if (isTriggered && groupValue) {
                if (!groupMap.has(groupValue)) {
                    groupMap.set(groupValue, []);
                }
                groupMap.get(groupValue).push(item);
            } else {
                orphanItems.push(item);
            }
        });

        if (!groupMap.size) {
            return [];
        }

        // Get pseudo_parent_sort configuration for this level
        const sortLookup = pseudoConfig?.pseudo_parent_sort || {};

        const pseudoItems = [];
        groupMap.forEach((items, groupName) => {
            const sortNumber = sortLookup[groupName]; // Look up authored sort_number
            pseudoItems.push(
                this.buildPseudoParentItem(parentItem, pseudoLevelName, groupName, items, terminalLevelName, pseudoConfig, false, sortNumber)
            );
        });

        if (orphanItems.length) {
            // Orphan group gets sort_number = 9999 to always appear last
            pseudoItems.push(
                this.buildPseudoParentItem(parentItem, pseudoLevelName, orphanGroupName, orphanItems, terminalLevelName, pseudoConfig, true, 9999)
            );
        }

        return this.sortItems(pseudoItems, pseudoConfig);
    }

    getItemsFromPseudoParent(parentItem, childLevelName, childLevelConfig) {
        if (!parentItem.__isPseudoParent) {
            return [];
        }

        const parentConfig = this.getHierarchyLevelConfig(parentItem.__level);
        const supportsNestedPseudo = parentConfig && Array.isArray(parentConfig.supports_pseudo_parents)
            ? parentConfig.supports_pseudo_parents.includes(childLevelName)
            : false;

        if (supportsNestedPseudo) {
            return this.getPseudoParentItems(parentItem, childLevelName, childLevelConfig);
        }

        if (childLevelName === parentItem.__pseudoTerminalLevel) {
            const leafItems = this.clonePseudoItems(parentItem.__pseudoSourceItems || []);
            Logger.debug(`📋 Returning ${leafItems.length} leaf items from pseudo parent "${parentItem.name}"`);
            leafItems.forEach((item, idx) => {
                const sortNum = ItemUtils.getSortNumber(item);
                Logger.debug(`   [${idx}] ${item.name || item.key}: sort_number=${sortNum}, __level=${item.__level}`);
            });
            return this.sortItems(leafItems, childLevelConfig);
        }

        Logger.warn(`getItemsFromPseudoParent: ${parentItem.__level} cannot provide ${childLevelName}`);
        return [];
    }

    /**
     * Extract child items from a data location
     */
    extractChildItems(dataLocation, childLevelName, parentItem) {
        const childLevelDepth = this.getHierarchyLevelDepth(childLevelName);
        const levelConfig = this.getHierarchyLevelConfig(childLevelName);
        const items = [];

        const hierarchyNames = this.getHierarchyLevelNames();

        if (Array.isArray(dataLocation)) {
            // This is an array of leaf items (final level in hierarchy)
            dataLocation.forEach((itemData, index) => {
                const itemName = this.getItemDisplayName(itemData, `item-${index}`);
                
                // Normalize v2.0 schema: map 'seq' to 'sort_number' for compatibility
                const normalizedData = this.normalizeItemData(itemData);
                
                items.push({
                    name: itemName,
                    ...this.extractParentProperties(parentItem),
                    key: `${parentItem.key}/${itemName}`,
                    data: normalizedData,
                    index: index,
                    __level: childLevelName,
                    __levelDepth: childLevelDepth,
                    __isLeaf: true,
                    __path: [...parentItem.__path, itemName]
                });
            });
        } else if (typeof dataLocation === 'object') {
            // This is an object with keys as item names
            Object.keys(dataLocation).forEach(itemKey => {
                const childData = dataLocation[itemKey];
                const isNumeric = levelConfig && levelConfig.is_numeric || false;
                const hasFurtherLevels = childLevelDepth < hierarchyNames.length - 1;
                const childIsArray = Array.isArray(childData);
                
                // Determine display name: use explicit name from data, or construct from key
                let displayName;
                if (childData && typeof childData === 'object' && childData.name) {
                    displayName = childData.name;
                } else if (isNumeric) {
                    displayName = `${itemKey} ${levelConfig.display_name}`;
                } else {
                    displayName = itemKey;
                }
                
                // Normalize v2.0 schema: map 'seq' to 'sort_number' for compatibility
                const normalizedData = this.normalizeItemData(childData);
                
                // Create item with appropriate properties
                const item = {
                    name: displayName,
                    ...this.extractParentProperties(parentItem),
                    key: `${parentItem.key}/${itemKey}`,
                    __level: childLevelName,
                    __levelDepth: childLevelDepth,
                    // Item is a leaf if we're at the last hierarchy level OR if it's an array with no further levels
                    __isLeaf: !hasFurtherLevels || (childIsArray && !hasFurtherLevels),
                    __path: [...parentItem.__path, itemKey]
                };

                
                // Add level-specific property (e.g., levelCount for numeric levels)
                if (isNumeric) {
                    const propertyName = childLevelName + 'Count';
                    item[propertyName] = parseInt(itemKey);
                }
                // Store child data if it's not an array (arrays are leaf items, handled separately)
                if (!childIsArray) {
                    item.data = normalizedData;
                }

                items.push(item);
            });
        }

        // Apply sorting based on configuration
        return this.sortItems(items, levelConfig);
    }
    
    /**
     * Normalize item data to ensure compatibility between v1.0 and v2.0 schemas.
     * Maps v2.0 'seq' field to 'sort_number' for sorting compatibility.
     */
    normalizeItemData(itemData) {
        if (!itemData || typeof itemData !== 'object') {
            return itemData;
        }
        
        let normalized = { ...itemData };
        
        // If item has 'seq' but no 'sort_number', map seq → sort_number
        if (itemData.seq !== undefined && itemData.sort_number === undefined) {
            normalized.sort_number = itemData.seq;
        }
        
        // v2.0 schema: flatten 'text' object to old language-code format
        // Maps text.VUL → latin, text.WLC → hebrew, text.LXX → greek, etc.
        if (itemData.text && typeof itemData.text === 'object') {
            const translationMap = {
                'VUL': 'latin',
                'WLC': 'hebrew',
                'LXX': 'greek',
                'BYZ': 'greek',  // NT Greek
                'NAB': 'english',
                'DRA': 'english',
                'SYN': 'russian',
                'NEO': 'french',
                'VAT_ES': 'spanish',
                'CEI_ES': 'spanish',
                'CEI': 'italian',
                'POR': 'portuguese'
            };
            
            Object.entries(itemData.text).forEach(([code, text]) => {
                const langKey = translationMap[code] || code.toLowerCase();
                if (normalized[langKey] === undefined) {
                    normalized[langKey] = text;
                }
            });
        }
        
        return normalized;
    }

    /**
     * Extract parent properties to pass to child items
     */
    extractParentProperties(parentItem) {
        const props = {};
        const levelNames = this.getHierarchyLevelNames();
        
        // Copy all level-name properties from parent
        levelNames.forEach(levelName => {
            if (parentItem[levelName] !== undefined) {
                props[levelName] = parentItem[levelName];
            }
        });

        // Also copy specific parent item properties by level name
        // (e.g., if parent is a category, copy category property)
        if (parentItem.__level && parentItem.name) {
            props[parentItem.__level] = parentItem.name;
        }

        // Copy numeric properties like levelCount
        Object.keys(parentItem).forEach(key => {
            if (key.endsWith('Count')) {
                props[key] = parentItem[key];
            }
        });

        return props;
    }

    /**
     * Sort items based on level configuration
     */
    sortItems(items, levelConfig) {
        if (!items || items.length === 0) return items;

        // Check if this is the leaf level (explicit configuration)
        const displayConfig = this.getDisplayConfig();
        const leafLevel = displayConfig?.leaf_level;
        const currentLevel = items[0]?.__level;
        const isLeafLevel = leafLevel && currentLevel === leafLevel;

        // Check if this level should skip sort validation (configured in hierarchy_levels)
        const skipValidation = levelConfig?.skip_sort_validation === true;
        
        // For NON-LEAF levels: sort_number is MANDATORY (unless explicitly skipped)
        if (!isLeafLevel && !skipValidation) {
            const itemsWithoutSort = items.filter(item => {
                const sortNum = ItemUtils.getSortNumber(item);
                return sortNum === undefined || sortNum === null;
            });

            if (itemsWithoutSort.length > 0) {
                // Display critical error to user
                const errorDiv = document.createElement('div');
                errorDiv.className = 'sort-number-error';
                errorDiv.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #ff3333;
                    color: white;
                    padding: 30px;
                    border-radius: 10px;
                    font-size: 20px;
                    font-weight: bold;
                    z-index: 10000;
                    text-align: center;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    max-width: 80%;
                `;
                
                const levelName = levelConfig?.display_name || 'items';
                
                // Extract parent context from first item's path
                const firstItem = itemsWithoutSort[0];
                let parentContext = '';
                if (firstItem.__path && firstItem.__path.length > 0) {
                    // Get parent names from path (exclude the item itself)
                    const parentNames = firstItem.__path.slice(0, -1).map(segment => {
                        // Handle both string segments and object segments
                        if (typeof segment === 'string') return segment;
                        return segment.name || segment.key || segment;
                    });
                    if (parentNames.length > 0) {
                        parentContext = ` under ${parentNames.join(' → ')}`;
                    }
                }
                
                const itemList = itemsWithoutSort.slice(0, 5).map(item => 
                    `• ${item.name || item.key}`
                ).join('<br>');
                const moreCount = itemsWithoutSort.length > 5 ? `<br>...and ${itemsWithoutSort.length - 5} more` : '';
                
                errorDiv.innerHTML = `
                    <div style="font-size: 24px; margin-bottom: 15px;">⚠️ ERROR - Sort Number Missing</div>
                    <div style="font-size: 16px; margin-bottom: 10px;">Navigation level: ${levelName}${parentContext}</div>
                    <div style="font-size: 14px; text-align: left; margin-top: 15px;">${itemList}${moreCount}</div>
                    <div style="font-size: 12px; margin-top: 20px; opacity: 0.9;">Navigation items require sort_number</div>
                `;
                
                document.body.appendChild(errorDiv);
                
                Logger.error(`❌ CRITICAL: ${itemsWithoutSort.length} navigation items missing sort_number at level ${currentLevel}`);
                itemsWithoutSort.forEach(item => {
                    Logger.error(`   Missing sort_number: ${item.name || item.key}`);
                });
                
                // Return empty array - refuse to sort navigation items without sort_numbers
                return [];
            }
        }

        // For LEAF levels: use context-aware sorting
        if (isLeafLevel) {
            Logger.debug(`🍃 Leaf level detected: ${currentLevel} - using context-aware sorting`);
            return this.sortLeafItems(items, levelConfig);
        }

        // If skip_sort_validation is set, return as-is without sorting
        if (skipValidation) {
            return items;
        }

        // Navigation level with sort_numbers - proceed with standard sorting
        const sorted = [...items];
        
        sorted.forEach((item, idx) => {
            if (item.__sortFallbackIndex === undefined) {
                Object.defineProperty(item, '__sortFallbackIndex', {
                    value: idx,
                    enumerable: false,
                    writable: true
                });
            }
        });
        
        return sorted.sort((a, b) => {
            const sortA = a.data?.sort_number ?? a.sort_number;
            const sortB = b.data?.sort_number ?? b.sort_number;
            
            if (sortA !== sortB) {
                return sortA - sortB;
            }
            return a.__sortFallbackIndex - b.__sortFallbackIndex;
        });
    }

    sortLeafItems(items, levelConfig) {
        if (!items || !items.length) {
            return items;
        }

        // Validate that every leaf item is explicitly authored with sort_number
        const itemsWithoutSort = items.filter(item => {
            const sortNum = ItemUtils.getSortNumber(item);
            return sortNum === undefined || sortNum === null;
        });

        if (itemsWithoutSort.length > 0) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'sort-number-error';
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #ff3333;
                color: white;
                padding: 30px;
                border-radius: 10px;
                font-size: 20px;
                font-weight: bold;
                z-index: 10000;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                max-width: 80%;
            `;

            const levelName = levelConfig?.display_name || 'leaf items';

            const firstItem = itemsWithoutSort[0];
            let parentContext = '';
            if (firstItem.__path && firstItem.__path.length > 0) {
                const parentNames = firstItem.__path.slice(0, -1).map(segment => {
                    if (typeof segment === 'string') return segment;
                    return segment?.name || segment?.key || segment;
                });
                if (parentNames.length > 0) {
                    parentContext = ` under ${parentNames.join(' → ')}`;
                }
            }

            const itemList = itemsWithoutSort.slice(0, 5).map(item =>
                `• ${item.name || item.key}`
            ).join('\n');
            const moreCount = itemsWithoutSort.length > 5
                ? `\n...and ${itemsWithoutSort.length - 5} more`
                : '';

            const titleEl = document.createElement('div');
            titleEl.style.fontSize = '24px';
            titleEl.style.marginBottom = '15px';
            titleEl.textContent = '⚠️ ERROR - Sort Number Missing';

            const contextEl = document.createElement('div');
            contextEl.style.fontSize = '16px';
            contextEl.style.marginBottom = '10px';
            contextEl.textContent = `Leaf level: ${levelName}${parentContext}`;

            const listEl = document.createElement('div');
            listEl.style.fontSize = '14px';
            listEl.style.textAlign = 'left';
            listEl.style.marginTop = '15px';
            listEl.style.whiteSpace = 'pre-line';
            listEl.textContent = `${itemList}${moreCount}`;

            const footerEl = document.createElement('div');
            footerEl.style.fontSize = '12px';
            footerEl.style.marginTop = '20px';
            footerEl.style.opacity = '0.9';
            footerEl.textContent = 'Leaf items require authored sort_number';

            errorDiv.appendChild(titleEl);
            errorDiv.appendChild(contextEl);
            errorDiv.appendChild(listEl);
            errorDiv.appendChild(footerEl);

            document.body.appendChild(errorDiv);

            Logger.error(`❌ CRITICAL: ${itemsWithoutSort.length} leaf items missing sort_number at level ${levelName}`);
            itemsWithoutSort.forEach(item => {
                Logger.error(`   Missing sort_number: ${item.name || item.key}`);
            });

            return [];
        }

        const sorted = [...items];

        // Preserve original index for stable sorting
        sorted.forEach((item, idx) => {
            if (item.__sortFallbackIndex === undefined) {
                Object.defineProperty(item, '__sortFallbackIndex', {
                    value: idx,
                    enumerable: false,
                    writable: true
                });
            }
        });

        return sorted.sort((a, b) => {
            const sortA = a.data?.sort_number ?? a.sort_number;
            const sortB = b.data?.sort_number ?? b.sort_number;

            if (sortA !== sortB) {
                return sortA - sortB;
            }
            return a.__sortFallbackIndex - b.__sortFallbackIndex;
        });
    }

    getDataLocationForItem(item) {
        const pathToTraverse = item && (item.__dataPath || item.__path);
        if (!item || !pathToTraverse || !pathToTraverse.length) {
            return null;
        }

        const levelNames = this.getHierarchyLevelNames();
        let dataLocation = this.getTopLevelCollection();

        for (let i = 0; i < pathToTraverse.length; i++) {
            const pathSegment = pathToTraverse[i];
            const currentLevelName = levelNames[i];

            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (!dataLocation) {
                    Logger.warn(`getDataLocationForItem: top-level segment '${pathSegment}' not found`);
                    return null;
                }

                if (pathToTraverse.length > 1) {
                    const nextLevelName = levelNames[1];
                    const childCollectionName = this.getPluralPropertyName(nextLevelName);
                    if (dataLocation && dataLocation[childCollectionName]) {
                        dataLocation = dataLocation[childCollectionName];
                    }
                }
            } else {
                if (Array.isArray(dataLocation)) {
                    const numericIndex = parseInt(pathSegment, 10);
                    if (!isNaN(numericIndex) && dataLocation[numericIndex]) {
                        dataLocation = dataLocation[numericIndex];
                    } else {
                        Logger.warn(`getDataLocationForItem: numeric segment '${pathSegment}' not found in array`);
                        return null;
                    }
                } else {
                    dataLocation = dataLocation && dataLocation[pathSegment];
                }

                if (!dataLocation) {
                    Logger.warn(`getDataLocationForItem: segment '${pathSegment}' not found at level ${currentLevelName}`);
                    return null;
                }

                if (i < pathToTraverse.length - 1) {
                    const nextLevelName = levelNames[i + 1];
                    const childCollectionName = this.getPluralPropertyName(nextLevelName);
                    if (dataLocation && dataLocation[childCollectionName]) {
                        dataLocation = dataLocation[childCollectionName];
                    }
                }
            }
        }

        return dataLocation;
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