/**
 * Mobile Volume Data Manager
 * Manages data loading with error handling and caching
 */

import { Logger } from './mobile-logger.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';

/**
 * Manages data loading with error handling and caching
 */
class DataManager {
    constructor() {
        this.data = null;
        this.loading = false;
        this.loadPromise = null;
        this.currentVolumePath = null;
        this.availableVolumes = [];
        this.rootDataKey = null; // e.g., 'MMdM' or 'Gutenberg_Bible'
        
        // Phase 4 Consolidation: Bilingual coordinate storage
        this.coordinateCache = new Map(); // Item key -> HubNucCoordinate
        this.coordinateMetadata = new Map(); // Level -> coordinate stats
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

        Logger.debug(`Stored bilingual coordinates: ${storedCount}/${items.length} items at level ${levelName}`);
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
     */
    async discoverVolumes() {
        Logger.debug('🔍 Discovering available Wheel volumes...');
        
        // List of potential volume files to check
        const candidateFiles = [
            'mmdm_catalog.json',
            'gutenberg.json'
            // Future volumes will be added here:
            // 'shakespeare.json',
            // 'sears_catalog.json',
            // 'britannica.json'
        ];
        
        const volumes = [];
        
        for (const filename of candidateFiles) {
            try {
                Logger.debug(`🔍 Checking ${filename}...`);
                const response = await fetch(`./${filename}`);
                
                if (!response.ok) {
                    Logger.debug(`⏭️  ${filename} not found (${response.status})`);
                    continue;
                }
                
                const data = await response.json();
                
                // Check for Wheel volume identification keys
                const rootKey = Object.keys(data)[0];
                const rootData = data[rootKey];
                
                Logger.debug(`📋 Examining ${filename} root key: ${rootKey}`);
                
                if (rootData &&
                    rootData.display_config &&
                    rootData.display_config.volume_type === 'wheel_hierarchical' &&
                    rootData.display_config.wheel_volume_version) {
                    
                    volumes.push({
                        filename: filename,
                        name: rootData.display_config.volume_name || filename,
                        description: rootData.display_config.volume_description || '',
                        version: rootData.display_config.wheel_volume_version,
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
        Logger.debug(`🔍 Discovery complete: ${volumes.length} Wheel volume(s) found`);
        
        if (volumes.length > 0) {
            volumes.forEach(vol => {
                Logger.debug(`   - ${vol.name} (${vol.filename})`);
            });
        }
        
        return volumes;
    }

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
            
            this.currentVolumePath = filename;
            Logger.debug(`✅ Volume loaded successfully: ${filename}`);
            return this.data;
            
        } catch (error) {
            Logger.error(`❌ Failed to load volume ${filename}:`, error);
            this.data = null;
            throw new Error(`Unable to load volume: ${error.message}`);
        } finally {
            this.loading = false;
        }
    }

    async load() {
        // Legacy support - load default volume if no volume selector is used
        if (this.data) return this.data;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.loadVolume('mmdm_catalog.json');
        return this.loadPromise;
    }

    async performLoad() {
        // Deprecated - use loadCatalog() instead
        return this.loadCatalog('mmdm_catalog.json');
    }

    validateData(data) {
        if (!data || !this.rootDataKey) return false;
        
        const rootData = data[this.rootDataKey];
        if (!rootData || !rootData.display_config) return false;
        
        // Validate Wheel volume structure
        if (rootData.display_config.volume_type !== 'wheel_hierarchical') return false;
        if (!rootData.display_config.wheel_volume_version) return false;
        
        // Get the first data collection (markets, testaments, etc.)
        const levelNames = Object.keys(rootData.display_config.hierarchy_levels || {});
        if (levelNames.length === 0) return false;
        
        const firstLevelPlural = this.getPluralPropertyName(levelNames[0]);
        const firstLevelData = rootData[firstLevelPlural];
        
        return firstLevelData && typeof firstLevelData === 'object';
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

    getMarkets() {
        // Legacy method - now returns keys from top-level collection
        const topLevel = this.getTopLevelCollection();
        return Object.keys(topLevel);
    }

    /**
     * UNIVERSAL METHOD: Get all initial focus items for display
     * Gets the THIRD level items aggregated across the first two hierarchy levels
     * (e.g., manufacturers from markets+countries, books from testaments+sections)
     */
    getAllInitialFocusItems() {
        if (!this.data || !this.rootDataKey) return [];

        const topLevelNames = this.getMarkets();
        const levelNames = this.getHierarchyLevelNames();
        
        if (levelNames.length < 3) {
            Logger.warn('getAllInitialFocusItems: Need at least 3 hierarchy levels');
            return [];
        }
        
        const topLevelName = levelNames[0]; // e.g., 'market' or 'testament'
        const secondLevelName = levelNames[1]; // e.g., 'country' or 'section'
        const thirdLevelName = levelNames[2]; // e.g., 'manufacturer' or 'book'

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
                // Get second-level items (e.g., countries)
                const secondLevelItems = this.getItemsAtLevel(topLevelItem, secondLevelName);
                
                // For each second-level item, get third-level items (e.g., manufacturers)
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
                    // Check for second-level collection (countries, books, etc.)
                    const secondLevelPlural = this.getPluralPropertyName(levelNames[1]);
                    if (dataLocation[secondLevelPlural]) {
                        dataLocation = dataLocation[secondLevelPlural];
                    }
                }
            } else {
                dataLocation = dataLocation && dataLocation[pathSegment];
                if (!dataLocation) {
                    Logger.warn(`getVirtualLevelItems: path segment '${pathSegment}' not found`);
                    return [];
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
        let rawData;
        
        if (Array.isArray(dataLocation)) {
            // dataLocation is already the array (direct parent-to-child array)
            rawData = dataLocation;
        } else {
            // Try to find the child collection
            const childCollectionName = this.getPluralPropertyName(dataLevelName);
            rawData = dataLocation && dataLocation[childCollectionName];
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
            
            return dataArray.map((item, index) => ({
                name: item.engine_model || item.name || item.__originalKey || `${dataLevelName}-${index}`,
                ...this.extractParentProperties(parentItem),
                key: `${parentItem.key}/${item.engine_model || item.name || item.__originalKey || index}`,
                data: item,
                index: index,
                __level: dataLevelName,
                __levelDepth: dataLevelDepth,
                __isLeaf: true,
                __path: [...parentItem.__path, item.engine_model || item.name || item.__originalKey || index]
            }));
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
        const items = filteredData.map((item, index) => ({
            name: item.engine_model || item.name || `${childLevelName}-${index}`,
            ...this.extractParentProperties(virtualParentItem),
            key: `${virtualParentItem.key}/${item.engine_model || item.name || index}`,
            data: item,
            index: index,
            __level: childLevelName,
            __levelDepth: childLevelDepth,
            __isLeaf: true,
            __path: [...virtualParentItem.__path, item.engine_model || item.name || index]
        }));
        
        return this.sortItems(items, levelConfig);
    }

    /**
     * UNIVERSAL METHOD: Check if a virtual level can be skipped
     */
    canSkipVirtualLevel(parentLevelName, childLevelName, levelNames) {
        const parentDepth = levelNames.indexOf(parentLevelName);
        const childDepth = levelNames.indexOf(childLevelName);
        
        if (childDepth !== parentDepth + 2) return false; // Not skipping exactly one level
        
        const skippedLevelName = levelNames[parentDepth + 1];
        const skippedLevelConfig = this.getHierarchyLevelConfig(skippedLevelName);
        
        return skippedLevelConfig && skippedLevelConfig.is_virtual === true;
    }

    /**
     * UNIVERSAL HIERARCHY METHOD
     * Get items at a specific level depth given a parent item
     * This is the domain-agnostic navigation method that dynamically navigates JSON
     */
    getItemsAtLevel(parentItem, childLevelName) {
        if (!parentItem || !childLevelName) {
            Logger.warn('getItemsAtLevel: missing parentItem or childLevelName');
            return [];
        }

        const levelNames = this.getHierarchyLevelNames();
        const parentLevelName = parentItem.__level;
        const parentLevelDepth = parentItem.__levelDepth;
        const childLevelDepth = this.getHierarchyLevelDepth(childLevelName);
        const childLevelConfig = this.getHierarchyLevelConfig(childLevelName);

        // Check if child level is virtual
        if (childLevelConfig && childLevelConfig.is_virtual) {
            return this.getVirtualLevelItems(parentItem, childLevelName, childLevelConfig);
        }

        // Check if child level aggregates across an intermediate level
        if (childLevelConfig && childLevelConfig.aggregates_across) {
            return this.getAggregatedLevelItems(parentItem, childLevelName, childLevelConfig);
        }

        // Check if this is requesting child items from a virtual level parent
        const parentLevelConfig = this.getHierarchyLevelConfig(parentLevelName);
        if (parentLevelConfig && parentLevelConfig.is_virtual) {
            return this.getItemsFromVirtualParent(parentItem, childLevelName, parentLevelConfig);
        }
        
        // Special exception: Allow skipping empty virtual levels
        const allowSkipVirtual = this.canSkipVirtualLevel(parentLevelName, childLevelName, levelNames);
        
        // Validate that child level immediately follows parent level (unless skipping virtual)
        if (!allowSkipVirtual && childLevelDepth !== parentLevelDepth + 1) {
            Logger.warn(`getItemsAtLevel: ${childLevelName} is not the immediate child of ${parentLevelName}`);
            return [];
        }

        // Navigate to the data location using the parent's path
        let dataLocation = this.getTopLevelCollection();
        let alreadyInChildCollection = false; // Track if we're already in the target child collection
        
        // Build the path through the JSON structure
        for (let i = 0; i < parentItem.__path.length; i++) {
            const pathSegment = parentItem.__path[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                // First level: navigate to the top-level group
                dataLocation = dataLocation[pathSegment];
                if (!dataLocation) {
                    Logger.warn(`getItemsAtLevel: top-level group '${pathSegment}' not found`);
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
                    return [];
                }
                
                // Then navigate to the child collection for the next iteration
                // (except on the last iteration, where we want to stay at the parent item)
                if (i < parentItem.__path.length - 1) {
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
        }
        
        if (!childrenData) {
            const childCollectionName = this.getPluralPropertyName(childLevelName);
            Logger.warn(`getItemsAtLevel: could not find '${childCollectionName}' property for ${childLevelName}`);
            return [];
        }

        // Get the child items from this location
        return this.extractChildItems(childrenData, childLevelName, parentItem);
    }

    /**
     * Get plural property name for a level (e.g., 'category' → 'categories')
     */
    getPluralPropertyName(levelName) {
        // Handle irregular plurals - now checking display_config for custom mappings
        const displayConfig = this.getDisplayConfig();
        const levelConfig = displayConfig && displayConfig.hierarchy_levels && displayConfig.hierarchy_levels[levelName];
        
        // Check if level config specifies a custom plural
        if (levelConfig && levelConfig.plural_property_name) {
            return levelConfig.plural_property_name;
        }
        
        // Built-in irregular plurals
        const irregularPlurals = {
            'country': 'countries',
            'family': 'families',
            'section': 'sections',
            'chapter_group': 'chapter_groups',
            'verse_group': 'verse_groups',
            'testament': 'testaments'
        };
        
        if (irregularPlurals[levelName]) {
            return irregularPlurals[levelName];
        }
        
        // Simple pluralization - add 's' (works for most levels)
        return levelName + 's';
    }

    /**
     * Extract child items from a data location
     */
    extractChildItems(dataLocation, childLevelName, parentItem) {
        const childLevelDepth = this.getHierarchyLevelDepth(childLevelName);
        const levelConfig = this.getHierarchyLevelConfig(childLevelName);
        const items = [];

        if (Array.isArray(dataLocation)) {
            // This is an array of leaf items (final level in hierarchy)
            dataLocation.forEach((itemData, index) => {
                const itemName = itemData.engine_model;
                items.push({
                    name: itemName,
                    ...this.extractParentProperties(parentItem),
                    key: `${parentItem.key}/${itemName}`,
                    data: itemData,
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
                
                // Create item with appropriate properties
                const item = {
                    name: isNumeric ? `${itemKey} ${levelConfig.display_name}` : itemKey,
                    ...this.extractParentProperties(parentItem),
                    key: `${parentItem.key}/${itemKey}`,
                    __level: childLevelName,
                    __levelDepth: childLevelDepth,
                    __isLeaf: Array.isArray(childData), // Leaf if child is array
                    __path: [...parentItem.__path, itemKey]
                };

                
                // Add level-specific property (e.g., levelCount for numeric levels)
                if (isNumeric) {
                    const propertyName = childLevelName + 'Count';
                    item[propertyName] = parseInt(itemKey);
                }
                // Store child data if it's not an array (arrays are leaf items, handled separately)
                if (!Array.isArray(childData)) {
                    item.data = childData;
                }

                items.push(item);
            });
        }

        // Apply sorting based on configuration
        return this.sortItems(items, levelConfig);
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

        // Copy hierarchy properties if they exist (market, country, manufacturer from our data structure)
        ['market', 'country', 'manufacturer'].forEach(prop => {
            if (parentItem[prop] !== undefined) {
                props[prop] = parentItem[prop];
            }
        });

        // Also copy numeric properties like levelCount
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
        const sorted = [...items];
        
        // Only log for Bible books (items with "Liber_" prefix)
        const isBibleBooks = items.length > 0 && items[0].name?.startsWith('Liber_');
        
        if (isBibleBooks) {
            Logger.debug(`📚 BIBLE BOOKS - BEFORE sorting (${items.length} items):`);
            items.forEach((item, idx) => {
                const sortNum = item.data?.sort_number ?? item.sort_number ?? 'none';
                Logger.debug(`  [${idx}] ${item.name} (sort_number: ${sortNum})`);
            });
        }
        
        // Universal sorting: sort_number overrides alphabetical when present
        const result = sorted.sort((a, b) => {
            const sortA = a.data?.sort_number ?? a.sort_number;
            const sortB = b.data?.sort_number ?? b.sort_number;
            
            // Both have sort_number: use numeric ordering
            if (sortA !== undefined && sortB !== undefined) {
                return sortA - sortB;  // Use explicit Publisher-assigned ordering
            }
            
            // Only A has sort_number: A comes first
            if (sortA !== undefined && sortB === undefined) {
                return -1;
            }
            
            // Only B has sort_number: B comes first
            if (sortA === undefined && sortB !== undefined) {
                return 1;
            }
            
            // Neither has sort_number: Focus Ring alphabetical Z to A (higher angles = visual top)
            // This matches human reading expectations where "first" items appear at visual top
            return b.name.localeCompare(a.name);  // Reverse alphabetical for Focus Ring
        });
        
        if (isBibleBooks) {
            Logger.debug(`📚 BIBLE BOOKS - AFTER sorting (${result.length} items):`);
            result.forEach((item, idx) => {
                const sortNum = item.data?.sort_number ?? item.sort_number ?? 'none';
                Logger.debug(`  [${idx}] ${item.name} (sort_number: ${sortNum})`);
            });
        }
        
        return result;
    }

    getDataLocationForItem(item) {
        if (!item || !item.__path || !item.__path.length) {
            return null;
        }

        const levelNames = this.getHierarchyLevelNames();
        let dataLocation = this.getTopLevelCollection();

        for (let i = 0; i < item.__path.length; i++) {
            const pathSegment = item.__path[i];
            const currentLevelName = levelNames[i];

            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (!dataLocation) {
                    Logger.warn(`getDataLocationForItem: top-level segment '${pathSegment}' not found`);
                    return null;
                }

                if (item.__path.length > 1) {
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

                if (i < item.__path.length - 1) {
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