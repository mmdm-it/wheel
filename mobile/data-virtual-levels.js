/**
 * DataVirtualLevels - Virtual and Pseudo-Parent Level Handling
 * 
 * Manages virtual grouping levels and pseudo-parent hierarchies that don't exist
 * in the raw JSON data but are computed dynamically for UI navigation.
 * 
 * Virtual Levels: Grouped views of child data (e.g., grouping verses by literary device)
 * Pseudo-Parent Levels: Dynamic parent nodes filtered by trigger properties
 * 
 * Part of: Phase 2A (Clean Architecture Initiative)
 * Extracted from: mobile-data.js
 */

import { Logger } from './mobile-logger.js';
import { ItemUtils } from './item-utils.js';

export class DataVirtualLevels {
    /**
     * @param {Object} dataManager - Reference to MobileDataManager for hierarchy access
     */
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Get items for a virtual level that groups child data
     * Virtual levels are computed from child data rather than existing in JSON
     */
    getVirtualLevelItems(parentItem, virtualLevelName, virtualLevelConfig) {
        const levelNames = this.dataManager.getHierarchyLevelNames();
        const virtualLevelDepth = this.dataManager.getHierarchyLevelDepth(virtualLevelName);
        
        // Get the next level after virtual (the level that contains the raw data)
        const dataLevelName = levelNames[virtualLevelDepth + 1];
        if (!dataLevelName) {
            Logger.warn(`getVirtualLevelItems: No data level found after virtual level ${virtualLevelName}`);
            return [];
        }
        
        // Navigate to the parent location - the raw data should be directly accessible from parent
        let dataLocation = this.dataManager.getTopLevelCollection();
        for (let i = 0; i < parentItem.__path.length; i++) {
            const pathSegment = parentItem.__path[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (dataLocation) {
                    // Check for second-level collection
                    const secondLevelPlural = this.dataManager.getPluralPropertyName(levelNames[1]);
                    if (dataLocation[secondLevelPlural]) {
                        dataLocation = dataLocation[secondLevelPlural];
                    }
                }
            } else {
                let currentLocation = dataLocation;
                dataLocation = dataLocation && dataLocation[pathSegment];
                if (!dataLocation) {
                    // Fallback: try navigating through the collection for the parent level
                    const collectionName = this.dataManager.getPluralPropertyName(parentItem.__level);
                    dataLocation = currentLocation && currentLocation[collectionName] && currentLocation[collectionName][pathSegment];
                    if (!dataLocation) {
                        Logger.warn(`getVirtualLevelItems: path segment '${pathSegment}' not found`);
                        return [];
                    }
                }
                if (i < parentItem.__path.length - 1) {
                    const nextLevelName = levelNames[i + 1];
                    const childCollectionName = this.dataManager.getPluralPropertyName(nextLevelName);
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
        
        const childCollectionName = this.dataManager.getPluralPropertyName(dataLevelName);
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
            const dataLevelDepth = this.dataManager.getHierarchyLevelDepth(dataLevelName);
            
            return dataArray.map((item, index) => {
                const itemName = this.dataManager.getItemDisplayName(item, `${dataLevelName}-${index}`);
                return {
                    name: itemName,
                    ...this.dataManager.extractParentProperties(parentItem),
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
                        ...this.dataManager.extractParentProperties(parentItem),
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
                ...this.dataManager.extractParentProperties(parentItem),
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
        return this.dataManager.sortItems(groups, virtualLevelConfig);
    }

    /**
     * Get items for an aggregated level
     * Aggregated levels combine items from multiple intermediate levels
     */
    getAggregatedLevelItems(parentItem, aggregatedLevelName, aggregatedLevelConfig) {
        const intermediateLevelName = aggregatedLevelConfig.aggregates_across;
        const levelDepth = this.dataManager.getHierarchyLevelDepth(aggregatedLevelName);
        const items = [];

        const parentLabel = parentItem.name || parentItem.key || 'unknown';
        Logger.debug(`getAggregatedLevelItems: parent=${parentLabel}, level=${aggregatedLevelName}, aggregates_across=${intermediateLevelName}`);

        const parentLocation = this.dataManager.getDataLocationForItem(parentItem);
        if (!parentLocation) {
            Logger.warn('getAggregatedLevelItems: Unable to resolve parent location for aggregated retrieval');
            return [];
        }

        const aggregatedCollectionName = this.dataManager.getPluralPropertyName(aggregatedLevelName);
        const intermediateCollectionName = this.dataManager.getPluralPropertyName(intermediateLevelName);

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
                        ...this.dataManager.extractParentProperties(parentItem),
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
                        ...this.dataManager.extractParentProperties(parentItem),
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
            return this.dataManager.sortItems(items, aggregatedLevelConfig);
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
                        ...this.dataManager.extractParentProperties(parentItem),
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

        return this.dataManager.sortItems(items, aggregatedLevelConfig);
    }

    /**
     * Get items from a virtual parent
     * When parent is a virtual grouping, get child items filtered by group membership
     */
    getItemsFromVirtualParent(virtualParentItem, childLevelName, virtualParentConfig) {
        const levelNames = this.dataManager.getHierarchyLevelNames();
        const virtualParentLevelDepth = virtualParentItem.__levelDepth;
        const childLevelDepth = this.dataManager.getHierarchyLevelDepth(childLevelName);
        
        // Navigate to the raw data location (one level above virtual parent in path)
        const pathToData = virtualParentItem.__path.slice(0, -1); // Remove virtual group name
        let dataLocation = this.dataManager.getTopLevelCollection();
        
        for (let i = 0; i < pathToData.length; i++) {
            const pathSegment = pathToData[i];
            const currentLevelName = levelNames[i];
            
            if (i === 0) {
                dataLocation = dataLocation[pathSegment];
                if (dataLocation) {
                    // Check for second-level collection
                    const secondLevelPlural = this.dataManager.getPluralPropertyName(levelNames[1]);
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
                    const childCollectionName = this.dataManager.getPluralPropertyName(nextLevelName);
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
            const childCollectionName = this.dataManager.getPluralPropertyName(childLevelName);
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
        const levelConfig = this.dataManager.getHierarchyLevelConfig(childLevelName);
        const items = filteredData.map((item, index) => {
            const itemName = this.dataManager.getItemDisplayName(item, `${childLevelName}-${index}`);
            return {
                name: itemName,
                ...this.dataManager.extractParentProperties(virtualParentItem),
                key: `${virtualParentItem.key}/${itemName}`,
                data: item,
                index: index,
                __level: childLevelName,
                __levelDepth: childLevelDepth,
                __isLeaf: true,
                __path: [...virtualParentItem.__path, itemName]
            };
        });
        
        return this.dataManager.sortItems(items, levelConfig);
    }

    /**
     * Check if a parent level supports pseudo-parent children of the given type
     */
    levelSupportsPseudoChild(parentLevelName, childLevelName) {
        if (!parentLevelName || !childLevelName) {
            return false;
        }

        const parentConfig = this.dataManager.getHierarchyLevelConfig(parentLevelName);
        if (!parentConfig || !Array.isArray(parentConfig.supports_pseudo_parents)) {
            return false;
        }

        return parentConfig.supports_pseudo_parents.includes(childLevelName);
    }

    /**
     * Check if a level is a pseudo-parent level
     */
    isPseudoLevel(levelName) {
        const config = this.dataManager.getHierarchyLevelConfig(levelName);
        return !!(config && config.is_pseudo_parent);
    }

    /**
     * Get the trigger property prefix for pseudo-parents
     * Default is 'rpp_' (responsive pseudo parent)
     */
    getPseudoTriggerPrefix(config) {
        if (config && config.pseudo_trigger_prefix) {
            return config.pseudo_trigger_prefix;
        }
        return 'rpp_';
    }

    /**
     * Get the terminal (leaf) level after skipping pseudo levels
     */
    getPseudoTerminalLevel(levelName) {
        const levelNames = this.dataManager.getHierarchyLevelNames();
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

    /**
     * Get a property value from an item (checks both item and item.data)
     */
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

    /**
     * Filter items by pseudo-parent filter criteria
     */
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

    /**
     * Clone a leaf item for pseudo-parent hierarchy
     */
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

    /**
     * Clone pseudo items (deep copy of metadata arrays)
     */
    clonePseudoItems(items) {
        return items.map(item => ({
            ...item,
            __path: Array.isArray(item.__path) ? [...item.__path] : [],
            __dataPath: item.__dataPath ? [...item.__dataPath] : undefined
        }));
    }

    /**
     * Get source items for pseudo-parent construction
     */
    getPseudoSourceItems(parentItem, terminalLevelName) {
        if (parentItem.__isPseudoParent && Array.isArray(parentItem.__pseudoSourceItems)) {
            return this.clonePseudoItems(parentItem.__pseudoSourceItems);
        }

        const parentData = this.dataManager.getDataLocationForItem(parentItem);
        if (!parentData) {
            Logger.warn('getPseudoSourceItems: Unable to resolve parent data location');
            return [];
        }

        let rawData;
        if (Array.isArray(parentData)) {
            rawData = parentData;
        } else {
            const collectionName = this.dataManager.getPluralPropertyName(terminalLevelName);
            rawData = parentData[collectionName];
        }

        if (!rawData) {
            Logger.warn(`getPseudoSourceItems: No raw data found for terminal level ${terminalLevelName}`);
            return [];
        }

        return this.dataManager.extractChildItems(rawData, terminalLevelName, parentItem);
    }

    /**
     * Build a pseudo-parent item with filtered child items
     */
    buildPseudoParentItem(parentItem, pseudoLevelName, groupName, baseItems, terminalLevelName, pseudoConfig, isOrphan = false, sortNumber = undefined) {
        const pseudoPath = [...(parentItem.__path || []), groupName];
        const childClones = baseItems.map(item => this.cloneLeafForPseudo(item, pseudoPath));

        const pseudoItem = {
            name: groupName,
            key: pseudoPath.join('/'),
            __level: pseudoLevelName,
            __levelDepth: this.dataManager.getHierarchyLevelDepth(pseudoLevelName),
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

    /**
     * Get pseudo-parent items for a level
     */
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

        return this.dataManager.sortItems(pseudoItems, pseudoConfig);
    }

    /**
     * Get items from a pseudo-parent node
     */
    getItemsFromPseudoParent(parentItem, childLevelName, childLevelConfig) {
        if (!parentItem.__isPseudoParent) {
            return [];
        }

        const parentConfig = this.dataManager.getHierarchyLevelConfig(parentItem.__level);
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
            return this.dataManager.sortItems(leafItems, childLevelConfig);
        }

        Logger.warn(`getItemsFromPseudoParent: ${parentItem.__level} cannot provide ${childLevelName}`);
        return [];
    }

    /**
     * Check if a virtual level can be skipped
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
            const skippedLevelConfig = this.dataManager.getHierarchyLevelConfig(skippedLevelName);
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
}
