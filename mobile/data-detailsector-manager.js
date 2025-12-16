/**
 * Detail Sector Configuration Manager
 * Handles configuration merging, context building, and template resolution
 * for Detail Sector display across all hierarchy levels
 */

import { Logger } from './mobile-logger.js';

export class DataDetailSectorManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
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

        const displayConfig = this.dataManager.getDisplayConfig() || {};
        const baseConfig = displayConfig.detail_sector || {};
        const levelConfig = this.dataManager.getHierarchyLevelConfig(item.__level) || {};
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
            display_config: this.dataManager.getDisplayConfig() || {}
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
            const levelNames = this.dataManager.getHierarchyLevelNames();
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
     * Later configs override earlier ones
     * @param {...Object} configs - Variable number of config objects to merge
     * @returns {Object} Merged configuration with mode, default_image, header, and views
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
}
