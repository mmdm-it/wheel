/**
 * Mobile Catalog Data Manager
 * Manages data loading with error handling and caching
 */

import { Logger } from './mobile-logger.js';

/**
 * Manages data loading with error handling and caching
 */
class DataManager {
    constructor() {
        this.data = null;
        this.loading = false;
        this.loadPromise = null;
    }

    async load() {
        if (this.data) return this.data;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.performLoad();
        return this.loadPromise;
    }

    async performLoad() {
        if (this.loading) return this.data;

        this.loading = true;
        Logger.debug('Loading catalog data...');

        try {
            const response = await fetch('./mmdm_catalog.json');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.data = await response.json();

            if (!this.validateData(this.data)) {
                throw new Error('Invalid data structure received');
            }

            Logger.debug('Data loaded successfully', this.data);
            return this.data;

        } catch (error) {
            Logger.error('Failed to load data:', error);
            this.data = null;
            throw new Error(`Unable to load catalog data: ${error.message}`);
        } finally {
            this.loading = false;
        }
    }

    validateData(data) {
        return data && data.MMdM && data.MMdM.markets && typeof data.MMdM.markets === 'object';
    }

    getDisplayConfig() {
        return this.data && this.data.MMdM && this.data.MMdM.display_config || null;
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

    getMarkets() {
        return this.data ? Object.keys(this.data.MMdM.markets) : [];
    }

    /**
     * Get all first-level items from all top-level groups (used for initial display)
     * This is a convenience method that aggregates first-level items across all top-level groups
     */
    getAllManufacturers() {
        if (!this.data || !this.data.MMdM.markets) return [];

        const markets = this.getMarkets();
        const allFirstLevelItems = [];

        // Get first-level items from each top-level group
        markets.forEach(marketName => {
            const marketItem = {
                name: marketName,
                market: marketName,
                key: marketName,
                __level: 'market',
                __levelDepth: 0,
                __isLeaf: false,
                __path: [marketName]
            };

            const manufacturers = this.getItemsAtLevel(marketItem, 'manufacturer');
            allFirstLevelItems.push(...manufacturers);
        });

        // Sort reverse alphabetically by item name (Z to A)
        return allFirstLevelItems.sort((a, b) => b.name.localeCompare(a.name));
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
        let dataLocation = this.data.MMdM.markets;
        for (let i = 0; i < parentItem.__path.length; i++) {
            const pathSegment = parentItem.__path[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (dataLocation && dataLocation.countries) {
                    dataLocation = dataLocation.countries;
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
        
        if (!rawData || !Array.isArray(rawData)) {
            Logger.warn(`getVirtualLevelItems: No array data found for ${dataLevelName} level`);
            return [];
        }
        
        // Extract virtual level configuration
        const groupingProperty = virtualLevelConfig.virtual_grouping_property;
        const membershipProperty = virtualLevelConfig.virtual_membership_property;
        const orphanGroupName = virtualLevelConfig.virtual_orphan_group_name || 'Other';
        
        // Check if any items actually belong to virtual groups
        const hasGroupedItems = rawData.some(item => item[membershipProperty] === true);
        
        if (!hasGroupedItems) {
            // No items are grouped - return raw data items directly as next level
            Logger.debug(`getVirtualLevelItems: No grouped items found, returning ${rawData.length} items from ${dataLevelName} level`);
            const dataLevelDepth = this.getHierarchyLevelDepth(dataLevelName);
            
            return rawData.map((item, index) => ({
                name: item.engine_model || item.name || `${dataLevelName}-${index}`,
                ...this.extractParentProperties(parentItem),
                key: `${parentItem.key}/${item.engine_model || item.name || index}`,
                data: item,
                index: index,
                __level: dataLevelName,
                __levelDepth: dataLevelDepth,
                __isLeaf: true,
                __path: [...parentItem.__path, item.engine_model || item.name || index]
            }));
        }
        
        // Create virtual groups
        const groupMap = new Map();
        const orphanItems = [];
        
        rawData.forEach(item => {
            if (item[membershipProperty] === true && item[groupingProperty]) {
                const groupName = item[groupingProperty];
                
                if (!groupMap.has(groupName)) {
                    groupMap.set(groupName, {
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
                    });
                    
                    // Remove empty property if use_code_property is false
                    if (!virtualLevelConfig.use_code_property) {
                        delete groupMap.get(groupName)[''];
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
        
        return groups;
    }

    /**
     * UNIVERSAL METHOD: Get items for an aggregated level
     * Aggregated levels combine items from multiple intermediate levels
     */
    getAggregatedLevelItems(parentItem, aggregatedLevelName, aggregatedLevelConfig) {
        const intermediateLevelName = aggregatedLevelConfig.aggregates_across;
        const levelDepth = this.getHierarchyLevelDepth(aggregatedLevelName);
        const items = [];
        
        // Navigate to parent location in JSON
        let parentLocation = this.data.MMdM.markets;
        if (parentItem.__level === 'market') {
            parentLocation = parentLocation[parentItem.name];
        }
        
        // Get the intermediate level collection
        const intermediateCollectionName = this.getPluralPropertyName(intermediateLevelName);
        const intermediateCollection = parentLocation && parentLocation[intermediateCollectionName];
        
        if (!intermediateCollection || typeof intermediateCollection !== 'object') {
            Logger.warn(`getAggregatedLevelItems: No ${intermediateCollectionName} found`);
            return [];
        }
        
        // Iterate through intermediate level and collect aggregated items
        const aggregatedCollectionName = this.getPluralPropertyName(aggregatedLevelName);
        
        Object.keys(intermediateCollection).forEach(intermediateName => {
            const intermediateData = intermediateCollection[intermediateName];
            const aggregatedData = intermediateData && intermediateData[aggregatedCollectionName];
            
            if (aggregatedData && typeof aggregatedData === 'object') {
                Object.keys(aggregatedData).forEach(itemName => {
                    items.push({
                        name: itemName,
                        [intermediateLevelName]: intermediateName,
                        ...this.extractParentProperties(parentItem),
                        key: `${parentItem.key}/${intermediateName}/${itemName}`,
                        __level: aggregatedLevelName,
                        __levelDepth: levelDepth,
                        __isLeaf: false,
                        __path: [...parentItem.__path, intermediateName, itemName]
                    });
                });
            }
        });
        
        // Sort based on configuration
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
        let dataLocation = this.data.MMdM.markets;
        
        for (let i = 0; i < pathToData.length; i++) {
            const pathSegment = pathToData[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (dataLocation && dataLocation.countries) {
                    dataLocation = dataLocation.countries;
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
        let dataLocation = this.data.MMdM.markets;
        
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
                // Top-level groups have a 'countries' property
                if (dataLocation.countries) {
                    dataLocation = dataLocation.countries;
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

        // Now dataLocation is at the parent item, we need to get its children
        const childCollectionName = this.getPluralPropertyName(childLevelName);
        const childrenData = dataLocation && dataLocation[childCollectionName];
        
        if (!childrenData) {
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
        // Handle irregular plurals
        const irregularPlurals = {
            'country': 'countries',
            'family': 'families'
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
        if (!levelConfig || !levelConfig.sort_type) {
            return items;
        }

        const sorted = [...items];
        
        switch(levelConfig.sort_type) {
            case 'numeric_desc':
                return sorted.sort((a, b) => {
                    const numA = parseFloat(a.name);
                    const numB = parseFloat(b.name);
                    return numB - numA;
                });
            
            case 'numeric_asc':
                return sorted.sort((a, b) => {
                    const numA = parseFloat(a.name);
                    const numB = parseFloat(b.name);
                    return numA - numB;
                });
            
            case 'alphabetical':
            default:
                return sorted.sort((a, b) => a.name.localeCompare(b.name));
        }
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