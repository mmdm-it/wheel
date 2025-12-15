/**
 * ItemBuilder - Item Data Normalization and Sorting
 * 
 * Handles normalization of item data (v2.0 schema compatibility), parent property
 * extraction, and sorting with strict validation.
 * 
 * Part of: Phase 2A (Clean Architecture Initiative)
 * Extracted from: mobile-data.js
 */

import { Logger } from './mobile-logger.js';
import { ItemUtils } from './item-utils.js';

export class ItemBuilder {
    /**
     * @param {Object} dataManager - Reference to MobileDataManager for config access
     */
    constructor(dataManager) {
        this.dataManager = dataManager;
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
        const levelNames = this.dataManager.getHierarchyLevelNames();
        
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
        const displayConfig = this.dataManager.getDisplayConfig();
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

    /**
     * Sort leaf items with strict validation
     */
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
}
