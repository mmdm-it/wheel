/**
 * Data Query Helper
 * Handles hierarchical data queries and navigation
 * 
 * Responsibilities:
 * - Query items at different hierarchy levels
 * - Resolve child levels (skipping pseudo-levels)
 * - Build cousin navigation (items across sibling groups with gaps)
 * - Construct parent items from child metadata
 * - Find item indices in arrays
 * 
 * This module encapsulates all the data traversal logic that was
 * previously mixed into the renderer.
 */

import { Logger } from './mobile-logger.js';

export class DataQueryHelper {
    /**
     * @param {Object} renderer - Reference to the main renderer for access to dataManager and validation
     */
    constructor(renderer) {
        this.renderer = renderer;
    }

    /**
     * Get child items at a specific level under a parent item
     * @param {Object} parentItem - The parent item
     * @param {string} childLevel - The level name of children to retrieve
     * @returns {Array} Array of child items with validated sort_numbers
     */
    getChildItemsForLevel(parentItem, childLevel) {
        const r = this.renderer;
        // Pure universal: Use DataManager's universal navigation method
        const childLevelName = childLevel;
        const items = r.dataManager.getItemsAtLevel(parentItem, childLevelName) || [];
        
        // Validate sort_numbers before returning
        return r.validateSortNumbers(items, `${childLevelName} under ${parentItem.name}`);
    }

    /**
     * Get cousin items for Focus Ring display - all items at the same level
     * across all parent groups, with gaps between sibling groups
     * IMPORTANT: Only includes current parent and subsequent parents (no wrap-around)
     * @param {Object} item - The current item
     * @param {string} itemLevel - The level of the current item
     * @returns {Array} Array of items with null gaps between sibling groups
     */
    getCousinItemsForLevel(item, itemLevel) {
        const r = this.renderer;
        // Get the grandparent level (two levels up)
        const parentLevel = r.getPreviousHierarchyLevel(itemLevel);
        if (!parentLevel) {
            Logger.warn('No parent level found for cousin navigation');
            return this.getChildItemsForLevel(this.buildParentItemFromChild(item, parentLevel), itemLevel);
        }
        
        const grandparentLevel = r.getPreviousHierarchyLevel(parentLevel);
        if (!grandparentLevel) {
            Logger.warn('No grandparent level found for cousin navigation - falling back to sibling navigation');
            const parentItem = this.buildParentItemFromChild(item, parentLevel);
            return this.getChildItemsForLevel(parentItem, itemLevel);
        }
        
        // Build parent and grandparent items from current item
        const parentItem = this.buildParentItemFromChild(item, parentLevel);
        const grandparentItem = this.buildParentItemFromChild(item, grandparentLevel);
        
        // Get all parents (uncles/aunts) at the parent level under the grandparent
        const allParents = this.getChildItemsForLevel(grandparentItem, parentLevel);
        
        // Find the index of the current parent in the list
        const currentParentIndex = allParents.findIndex(p => p.key === parentItem.key);
        
        if (currentParentIndex === -1) {
            Logger.warn(`🎯👥 Could not find current parent ${parentItem.name} in parent list - using all parents`);
        }
        
        // Only include parents from current parent forward (no wrap-around)
        const parentsToInclude = currentParentIndex >= 0 
            ? allParents.slice(currentParentIndex) 
            : allParents;
        
        Logger.debug(`🎯👥 Cousin navigation: ${itemLevel} across ${parentsToInclude.length}/${allParents.length} ${parentLevel}s starting from ${parentItem.name}`);
        
        // Collect all cousins with gaps
        const cousinsWithGaps = [];
        
        parentsToInclude.forEach((parent, parentIndex) => {
            // Get siblings under this parent
            const siblings = this.getChildItemsForLevel(parent, itemLevel);
            
            Logger.debug(`  ${parentLevel} "${parent.name}": ${siblings.length} ${itemLevel}s`);
            
            // Add all siblings
            cousinsWithGaps.push(...siblings);
            
            // Add 2 gaps after each sibling group (except the last one)
            if (parentIndex < parentsToInclude.length - 1) {
                cousinsWithGaps.push(null, null); // Two gap entries
            }
        });
        
        Logger.debug(`🎯👥 Total cousin items: ${cousinsWithGaps.filter(x => x !== null).length} + ${cousinsWithGaps.filter(x => x === null).length} gaps = ${cousinsWithGaps.length} total`);
        
        return cousinsWithGaps;
    }

    /**
     * Async version of getChildItemsForLevel that supports lazy loading
     * Used for split volumes where data may need to be fetched
     */
    async getChildItemsForLevelAsync(parentItem, childLevel) {
        const r = this.renderer;
        const childLevelName = childLevel;
        
        // Check if lazy loading is needed (for split volumes)
        if (r.dataManager.isSplitStructure()) {
            // For books getting chapters, ensure book data is loaded first
            const parentLevel = parentItem.__level;
            if (parentLevel === 'book' && childLevelName === 'chapter') {
                const loaded = await r.dataManager.ensureBookLoaded(parentItem);
                if (!loaded) {
                    console.error(`Failed to load book data for ${parentItem.name}`);
                    return [];
                }
            }
            // For chapters getting verses (chapter-level split), ensure chapter data is loaded first
            if (parentLevel === 'chapter' && childLevelName === 'verse' && r.dataManager.isChapterSplitStructure()) {
                const loaded = await r.dataManager.ensureChapterLoaded(parentItem);
                if (!loaded) {
                    console.error(`Failed to load chapter data for ${parentItem.name}`);
                    return [];
                }
            }
        }
        
        // Now get items (data should be available)
        const items = r.dataManager.getItemsAtLevel(parentItem, childLevelName) || [];
        
        // Validate sort_numbers before returning
        return r.validateSortNumbers(items, `${childLevelName} under ${parentItem.name}`);
    }

    /**
     * Resolve the actual child level, skipping pseudo-levels with no data
     * @param {Object} parentItem - The parent item
     * @param {string} startingLevel - The initial child level to try
     * @returns {Object} { level: resolvedLevelName, items: childItems }
     */
    resolveChildLevel(parentItem, startingLevel) {
        const r = this.renderer;
        if (!startingLevel) {
            return { level: null, items: [] };
        }

        const visited = new Set();
        let levelName = startingLevel;

        while (levelName && !visited.has(levelName)) {
            visited.add(levelName);

            const childItems = this.getChildItemsForLevel(parentItem, levelName);
            if (childItems && childItems.length) {
                return { level: levelName, items: childItems };
            }

            const isPseudo = typeof r.dataManager.isPseudoLevel === 'function'
                ? r.dataManager.isPseudoLevel(levelName)
                : false;

            if (!isPseudo) {
                break;
            }

            levelName = r.getNextHierarchyLevel(levelName);
        }

        return { level: levelName, items: [] };
    }

    /**
     * Async version of resolveChildLevel that supports lazy loading
     * Used for split volumes where data may need to be fetched
     */
    async resolveChildLevelAsync(parentItem, startingLevel) {
        const r = this.renderer;
        if (!startingLevel) {
            return { level: null, items: [] };
        }

        const visited = new Set();
        let levelName = startingLevel;

        while (levelName && !visited.has(levelName)) {
            visited.add(levelName);

            // Use async version for lazy loading support
            const childItems = await this.getChildItemsForLevelAsync(parentItem, levelName);
            if (childItems && childItems.length) {
                return { level: levelName, items: childItems };
            }

            const isPseudo = typeof r.dataManager.isPseudoLevel === 'function'
                ? r.dataManager.isPseudoLevel(levelName)
                : false;

            if (!isPseudo) {
                break;
            }

            levelName = r.getNextHierarchyLevel(levelName);
        }

        return { level: levelName, items: [] };
    }

    /**
     * Get all items at the top level of the hierarchy
     * @returns {Array} Array of top-level items with validated sort_numbers
     */
    getTopLevelItems() {
        const r = this.renderer;
        const levelNames = r.getHierarchyLevelNames();
        if (!levelNames.length) {
            return [];
        }

        const topLevelName = levelNames[0];
        const topLevelCollection = r.dataManager.getTopLevelCollection();
        if (!topLevelCollection || typeof topLevelCollection !== 'object') {
            return [];
        }

        const levelConfig = r.dataManager.getHierarchyLevelConfig(topLevelName);

        const items = Object.keys(topLevelCollection).map(key => {
            const entry = topLevelCollection[key];
            const displayName = (entry && (entry.display_name || entry.name)) || key;

            return {
                name: displayName,
                key: key,
                data: entry,
                __level: topLevelName,
                __levelDepth: 0,
                __isLeaf: false,
                __path: [key],
                [topLevelName]: key
            };
        });

        let sortedItems = items;
        if (typeof r.dataManager.sortItems === 'function') {
            sortedItems = r.dataManager.sortItems(items, levelConfig);
        }

        // Validate sort_numbers for top level items
        return r.validateSortNumbers(sortedItems, `Top level ${topLevelName}`);
    }

    /**
     * Build a parent item from a child item for navigation purposes
     * Reconstructs parent metadata from the child's __path
     * @param {Object} childItem - The child item with __path metadata
     * @param {string} parentLevel - The level name of the parent to build
     * @returns {Object} Reconstructed parent item
     */
    buildParentItemFromChild(childItem, parentLevel) {
        const r = this.renderer;
        if (!childItem.__path) {
            Logger.warn('buildParentItemFromChild: Child item missing __path metadata');
            return {};
        }

        const levelNames = r.getHierarchyLevelNames();
        const parentIndex = levelNames.indexOf(parentLevel);
        if (parentIndex === -1) {
            Logger.warn(`buildParentItemFromChild: Unknown parent level "${parentLevel}"`);
            return {};
        }

        // Build parent item from the path slice up to parentLevel
        const parentItem = {
            __level: parentLevel,
            __levelDepth: parentIndex,
            __path: childItem.__path.slice(0, parentIndex + 1),
            __isLeaf: false,
            key: childItem.__path.slice(0, parentIndex + 1).join('/')
        };

        // Reconstruct actual data properties from __path for legacy method compatibility
        // TODO: Remove this once getItemsAtLevel is refactored to use only metadata
        for (let i = 0; i <= parentIndex; i++) {
            const levelName = levelNames[i];
            const pathValue = childItem.__path[i];
            
            // Generic property mapping - property name matches level name
            parentItem[levelName] = pathValue;
            
            // Additional property aliases for legacy compatibility
            if (levelName === parentLevel && !parentItem.name) {
                parentItem.name = pathValue;
            }
            
            // Handle numeric conversions for count-based levels
            const levelConfig = r.dataManager.getHierarchyLevelConfig(levelName);
            if (levelConfig && levelConfig.is_numeric) {
                const countProperty = levelName + 'Count';
                parentItem[countProperty] = parseInt(pathValue);
            }
            
            // Handle code-based properties
            if (levelConfig && levelConfig.use_code_property) {
                const codeProperty = levelName + 'Code';
                parentItem[codeProperty] = pathValue;
            }
        }

        if (!parentItem.name) {
            parentItem.name = childItem.__path[parentIndex];
        }

        return parentItem;
    }

    /**
     * Find the index of an item in an array based on key matching
     * @param {Object} item - The item to find
     * @param {Array} array - Array of items (may contain null gaps)
     * @param {string} level - The hierarchy level (for logging)
     * @returns {number} Index of the item, or -1 if not found
     */
    findItemIndexInArray(item, array, level) {
        console.log(`🔺🔍 SEARCHING FOR: key="${item.key}" in array of ${array.length} items (including gaps)`);
        const index = array.findIndex(sibling => sibling !== null && sibling.key === item.key);
        console.log(`🔺🔍 FOUND AT INDEX: ${index} (${index >= 0 ? array[index].name : 'NOT FOUND'})`);
        
        if (index === -1) {
            Logger.warn(`🔺 findItemIndexInArray: Item key "${item.key}" not found in array of ${array.length} items`);
            Logger.warn(`🔺 Item keys in array:`, array.filter(s => s !== null).map(s => s.key));
            Logger.warn(`🔺 Searching for item:`, item);
        }
        
        return index;
    }
}
