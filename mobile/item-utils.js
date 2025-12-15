/**
 * Item Property Access Utilities
 * 
 * Eliminates 100+ redundant patterns across the codebase:
 * - Null-safe sort_number access
 * - Item lookup by key
 * - Property fallback chains (item.data?.prop ?? item.prop)
 * 
 * Usage:
 *   import { ItemUtils } from './item-utils.js';
 *   const sortNum = ItemUtils.getSortNumber(item);
 *   const foundItem = ItemUtils.findItemByKey(array, 'key123');
 */

export class ItemUtils {
    /**
     * Get sort_number from item (handles both item.sort_number and item.data.sort_number)
     * Replaces 50+ occurrences of: item.data?.sort_number ?? item.sort_number
     * 
     * @param {Object} item - The item to get sort_number from
     * @returns {number|undefined} The sort_number value, or undefined if not found
     */
    static getSortNumber(item) {
        if (!item) return undefined;
        return item.data?.sort_number ?? item.sort_number;
    }

    /**
     * Find item in array by key
     * Replaces 10+ occurrences of: array.find(item => item && item.key === targetKey)
     * 
     * @param {Array} array - Array of items to search
     * @param {string} key - The key to search for
     * @returns {Object|undefined} The found item, or undefined
     */
    static findItemByKey(array, key) {
        if (!array || !key) return undefined;
        return array.find(item => item && item.key === key);
    }

    /**
     * Find index of item in array by key
     * Replaces 10+ occurrences of: array.findIndex(item => item && item.key === targetKey)
     * 
     * @param {Array} array - Array of items to search
     * @param {string} key - The key to search for
     * @returns {number} The index of the found item, or -1
     */
    static findItemIndexByKey(array, key) {
        if (!array || !key) return -1;
        return array.findIndex(item => item && item.key === key);
    }

    /**
     * Get property from item with fallback chain (item.data?.prop ?? item.prop ?? default)
     * Replaces 20+ occurrences of complex null-safe property access
     * 
     * @param {Object} item - The item to get property from
     * @param {string} prop - The property name
     * @param {*} defaultValue - Default value if property not found
     * @returns {*} The property value, or defaultValue
     */
    static getItemProperty(item, prop, defaultValue = null) {
        if (!item || !prop) return defaultValue;
        return item.data?.[prop] ?? item[prop] ?? defaultValue;
    }

    /**
     * Validate that all items in array have sort_numbers
     * Replaces scattered validation logic across multiple files
     * 
     * @param {Array} items - Array of items to validate
     * @returns {boolean} True if all items have valid sort_numbers
     */
    static validateSortNumbers(items) {
        if (!items || !Array.isArray(items)) return false;
        return items.every(item => {
            if (item === null) return true; // Gaps are allowed
            const sortNum = this.getSortNumber(item);
            return sortNum !== undefined && sortNum !== null;
        });
    }

    /**
     * Filter array to only items with valid sort_numbers
     * 
     * @param {Array} items - Array of items to filter
     * @returns {Array} Filtered array containing only items with valid sort_numbers
     */
    static filterValidSortNumbers(items) {
        if (!items || !Array.isArray(items)) return [];
        return items.filter(item => {
            if (item === null) return false; // Remove gaps
            const sortNum = this.getSortNumber(item);
            return sortNum !== undefined && sortNum !== null;
        });
    }

    /**
     * Get items missing sort_numbers (for error reporting)
     * 
     * @param {Array} items - Array of items to check
     * @returns {Array} Array of items missing sort_numbers
     */
    static getItemsMissingSortNumbers(items) {
        if (!items || !Array.isArray(items)) return [];
        return items.filter(item => {
            if (item === null) return false; // Skip gaps
            const sortNum = this.getSortNumber(item);
            return sortNum === undefined || sortNum === null;
        });
    }

    /**
     * Compare two items by key for equality
     * Replaces: item1 && item2 && item1.key === item2.key
     * 
     * @param {Object} item1 - First item
     * @param {Object} item2 - Second item
     * @returns {boolean} True if items have the same key
     */
    static isSameItem(item1, item2) {
        if (!item1 || !item2) return false;
        return item1.key === item2.key;
    }

    /**
     * Get hierarchy level from item
     * Replaces: item.__level || null
     * 
     * @param {Object} item - The item
     * @returns {string|null} The hierarchy level, or null
     */
    static getHierarchyLevel(item) {
        if (!item) return null;
        return item.__level || null;
    }

    /**
     * Get path from item (ancestry)
     * Replaces: item.__path || []
     * 
     * @param {Object} item - The item
     * @returns {Array<string>} The ancestry path
     */
    static getPath(item) {
        if (!item) return [];
        return item.__path || [];
    }
}
