/**
 * DataHierarchyNavigator - JSON Hierarchy Navigation
 * 
 * Handles navigation through hierarchical JSON structures to retrieve child items.
 * Core navigation logic for traversing the data tree.
 * 
 * Part of: Phase 2A (Clean Architecture Initiative)
 * Extracted from: mobile-data.js
 */

import { Logger } from './mobile-logger.js';

export class DataHierarchyNavigator {
    /**
     * @param {Object} dataManager - Reference to MobileDataManager for config/helper access
     */
    constructor(dataManager) {
        this.dataManager = dataManager;
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

        const levelNames = this.dataManager.getHierarchyLevelNames();
        const parentLevelName = parentItem.__level;
        const parentLevelDepth = parentItem.__levelDepth;
        let childLevelDepth = this.dataManager.getHierarchyLevelDepth(childLevelName);
        let childLevelConfig = this.dataManager.getHierarchyLevelConfig(childLevelName);
        const parentLevelConfig = this.dataManager.getHierarchyLevelConfig(parentLevelName);
        const dataPath = parentItem.__dataPath || parentItem.__path || [];

        this.dataManager.traceItem(parentItem, `getItemsAtLevel request: ${parentLevelName} → ${childLevelName}`, {
            parentLevel: parentLevelName,
            childLevel: childLevelName,
            path: Array.isArray(dataPath) ? [...dataPath] : []
        });

        // Handle pseudo parent navigation before any structural validation
        if (parentItem.__isPseudoParent) {
            return this.dataManager.getItemsFromPseudoParent(parentItem, childLevelName, childLevelConfig);
        }

        if (this.dataManager.levelSupportsPseudoChild(parentLevelName, childLevelName)) {
            const pseudoItems = this.dataManager.getPseudoParentItems(parentItem, childLevelName, childLevelConfig);
            if (pseudoItems && pseudoItems.length) {
                return pseudoItems;
            }

            const terminalLevelName = this.dataManager.getPseudoTerminalLevel(childLevelName);
            if (terminalLevelName && terminalLevelName !== childLevelName) {
                const previousLevelName = childLevelName;
                Logger.debug(`getItemsAtLevel: No pseudo ${previousLevelName} nodes; falling back to ${terminalLevelName}`);
                this.dataManager.traceItem(parentItem, `Pseudo level empty → falling back to ${terminalLevelName}`, {
                    requestedLevel: previousLevelName,
                    terminalLevel: terminalLevelName
                });
                childLevelName = terminalLevelName;
                childLevelConfig = this.dataManager.getHierarchyLevelConfig(childLevelName);
                childLevelDepth = this.dataManager.getHierarchyLevelDepth(childLevelName);
            }
        }

        // Check if child level is virtual
        if (childLevelConfig && childLevelConfig.is_virtual) {
            return this.dataManager.getVirtualLevelItems(parentItem, childLevelName, childLevelConfig);
        }

        // Check if child level aggregates across an intermediate level
        if (childLevelConfig && childLevelConfig.aggregates_across) {
            return this.dataManager.getAggregatedLevelItems(parentItem, childLevelName, childLevelConfig);
        }

        // Check if this is requesting child items from a virtual level parent
        if (parentLevelConfig && parentLevelConfig.is_virtual) {
            return this.dataManager.getItemsFromVirtualParent(parentItem, childLevelName, parentLevelConfig);
        }
        
        // Special exception: Allow skipping empty virtual levels
        const allowSkipVirtual = this.dataManager.canSkipVirtualLevel(parentLevelName, childLevelName, levelNames);
        const isImmediateChild = childLevelDepth === parentLevelDepth + 1;
        
        if (!isImmediateChild) {
            if (!allowSkipVirtual) {
                Logger.warn(`getItemsAtLevel: ${childLevelName} is not the immediate child of ${parentLevelName}`);
                this.dataManager.traceItem(parentItem, `Rejected non-immediate level ${childLevelName}`, {
                    parentLevel: parentLevelName,
                    childLevel: childLevelName,
                    parentDepth: parentLevelDepth,
                    childDepth: childLevelDepth
                });
                return [];
            }

            this.dataManager.traceItem(parentItem, `Skipping virtual/pseudo levels between ${parentLevelName} and ${childLevelName}`, {
                parentDepth: parentLevelDepth,
                childDepth: childLevelDepth
            });
        }

        // Navigate to the data location using the parent's path
        let dataLocation = this.dataManager.getTopLevelCollection();
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
                    this.dataManager.traceItem(parentItem, `Missing top-level segment '${pathSegment}'`, {
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
                    this.dataManager.traceItem(parentItem, `Path segment '${pathSegment}' missing at level ${currentLevelName}`, {
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
            if (!childrenData && this.dataManager.isSplitStructure() && dataLocation && dataLocation._external_file) {
                // Data needs to be loaded from external file
                Logger.info(`📥 Split structure: ${childCollectionName} needs lazy loading from ${dataLocation._external_file}`);
                
                // Mark that lazy loading is needed but not yet loaded
                // Return empty array - the caller should trigger async load
                this.dataManager._pendingLazyLoad = {
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
            this.dataManager.traceItem(parentItem, `Missing child collection '${childCollectionName}' for ${childLevelName}`, {
                parentPath: dataPath
            });
            return [];
        }

        // Get the child items from this location
        const childItems = this.extractChildItems(childrenData, childLevelName, parentItem);
        this.dataManager.traceItem(parentItem, `Resolved ${childItems.length} ${childLevelName} item(s)`, {
            sampleNames: childItems.slice(0, 3).map(item => item.name)
        });
        return childItems;
    }

    /**
     * Extract child items from a data location
     */
    extractChildItems(dataLocation, childLevelName, parentItem) {
        const childLevelDepth = this.dataManager.getHierarchyLevelDepth(childLevelName);
        const levelConfig = this.dataManager.getHierarchyLevelConfig(childLevelName);
        const items = [];

        const hierarchyNames = this.dataManager.getHierarchyLevelNames();

        if (Array.isArray(dataLocation)) {
            // This is an array of leaf items (final level in hierarchy)
            dataLocation.forEach((itemData, index) => {
                const itemName = this.dataManager.getItemDisplayName(itemData, `item-${index}`);
                
                // Normalize v2.0 schema: map 'seq' to 'sort_number' for compatibility
                const normalizedData = this.dataManager.normalizeItemData(itemData);
                
                // Get parent's data path (fallback to __path if no __dataPath exists)
                const parentDataPath = parentItem.__dataPath || parentItem.__path || [];
                
                items.push({
                    name: itemName,
                    ...this.dataManager.extractParentProperties(parentItem),
                    key: `${parentItem.key}/${itemName}`,
                    data: normalizedData,
                    index: index,
                    __level: childLevelName,
                    __levelDepth: childLevelDepth,
                    __isLeaf: true,
                    __path: [...parentItem.__path, itemName],
                    // For arrays, use numeric index in data path for JSON navigation
                    __dataPath: [...parentDataPath, index]
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
                const normalizedData = this.dataManager.normalizeItemData(childData);
                
                // Get parent's data path (fallback to __path if no __dataPath exists)
                const parentDataPath = parentItem.__dataPath || parentItem.__path || [];
                
                // Create item with appropriate properties
                const item = {
                    name: displayName,
                    ...this.dataManager.extractParentProperties(parentItem),
                    key: `${parentItem.key}/${itemKey}`,
                    __level: childLevelName,
                    __levelDepth: childLevelDepth,
                    // Item is a leaf if we're at the last hierarchy level OR if it's an array with no further levels
                    __isLeaf: !hasFurtherLevels || (childIsArray && !hasFurtherLevels),
                    __path: [...parentItem.__path, itemKey],
                    // For objects, use property key in data path (same as __path)
                    __dataPath: [...parentDataPath, itemKey]
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
        return this.dataManager.sortItems(items, levelConfig);
    }

    /**
     * Get plural property name for a level (e.g., 'category' → 'categories')
     * Uses configuration-driven irregular plurals from catalog JSON
     */
    getPluralPropertyName(levelName) {
        // Check if level config specifies a custom plural
        const displayConfig = this.dataManager.getDisplayConfig();
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

    /**
     * Get the data location for an item by traversing its path
     */
    getDataLocationForItem(item) {
        const pathToTraverse = item && (item.__dataPath || item.__path);
        if (!item || !pathToTraverse || !pathToTraverse.length) {
            return null;
        }

        const levelNames = this.dataManager.getHierarchyLevelNames();
        let dataLocation = this.dataManager.getTopLevelCollection();

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
                    // For arrays, pathSegment should be a numeric index (stored as number or parseable string)
                    const numericIndex = typeof pathSegment === 'number' ? pathSegment : parseInt(pathSegment, 10);
                    if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < dataLocation.length) {
                        dataLocation = dataLocation[numericIndex];
                    } else {
                        Logger.warn(`getDataLocationForItem: numeric segment '${pathSegment}' not found in array (length=${dataLocation.length})`);
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
