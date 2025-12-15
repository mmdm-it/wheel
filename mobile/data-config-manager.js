/**
 * Data Configuration Manager
 * Handles catalog configuration, hierarchy metadata, and template resolution
 * 
 * Responsibilities:
 * - Access to hierarchy level configuration
 * - Display configuration and metadata
 * - Template interpolation for dynamic text
 * - Top-level collection navigation
 * 
 * Extracted from mobile-data.js Phase 2A (v0.8.157+)
 */

import { Logger } from './mobile-logger.js';

export class DataConfigManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Get the root display configuration from catalog JSON
     * @returns {Object|null} Display config with hierarchy_levels, etc.
     */
    getDisplayConfig() {
        const data = this.dataManager.data;
        const rootKey = this.dataManager.rootDataKey;
        
        if (!data || !rootKey) return null;
        
        const rootData = data[rootKey];
        return rootData && rootData.display_config || null;
    }

    /**
     * Get configuration for a specific hierarchy level
     * @param {string} levelName - Level name (e.g., 'manufacturer', 'model')
     * @returns {Object|null} Level configuration object
     */
    getHierarchyLevelConfig(levelName) {
        const displayConfig = this.getDisplayConfig();
        if (!displayConfig || !displayConfig.hierarchy_levels) return null;
        return displayConfig.hierarchy_levels[levelName] || null;
    }

    /**
     * Get the ordered list of hierarchy level names
     * @returns {string[]} Array of level names in order (e.g., ['market', 'country', 'manufacturer'])
     */
    getHierarchyLevelNames() {
        const displayConfig = this.getDisplayConfig();
        if (!displayConfig || !displayConfig.hierarchy_levels) return [];
        return Object.keys(displayConfig.hierarchy_levels);
    }

    /**
     * Get the depth/level index for a given level name
     * @param {string} levelName - Level name to find
     * @returns {number} Zero-based depth index, or -1 if not found
     */
    getHierarchyLevelDepth(levelName) {
        const levelNames = this.getHierarchyLevelNames();
        return levelNames.indexOf(levelName);
    }

    /**
     * Get the name of the top-level collection
     * @returns {string|null} Plural form of first hierarchy level
     */
    getTopLevelCollectionName() {
        if (!this.dataManager.rootDataKey) return null;
        const levelNames = this.getHierarchyLevelNames();
        if (levelNames.length === 0) return null;
        return this.dataManager.getPluralPropertyName(levelNames[0]);
    }

    /**
     * Get the top-level collection object from catalog data
     * @returns {Object} Top-level collection (e.g., {'America': {...}, 'Asia': {...}})
     */
    getTopLevelCollection() {
        const data = this.dataManager.data;
        const rootKey = this.dataManager.rootDataKey;
        
        if (!data || !rootKey) return {};
        
        const rootData = data[rootKey];
        const collectionName = this.getTopLevelCollectionName();
        return rootData && rootData[collectionName] || {};
    }

    /**
     * Get keys from the top-level collection
     * @returns {string[]} Array of top-level item names
     */
    getTopLevelKeys() {
        const topLevel = this.getTopLevelCollection();
        return Object.keys(topLevel);
    }

    /**
     * Resolve a dotted path within a context object
     * Supports array indexing: path.to.array[0].property
     * @param {string} path - Dot-separated path (e.g., 'data.engine_model')
     * @param {Object} context - Context object to resolve from
     * @returns {*} Resolved value or undefined
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

            // Handle array indexing: property[index]
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
}
