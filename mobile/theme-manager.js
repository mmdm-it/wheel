/**
 * Theme Manager Module
 * Manages color schemes and theme configuration
 * 
 * Centralizes all color/theme decisions to prevent scattered
 * color logic throughout the codebase.
 */

/**
 * Manages application theming and color schemes
 */
class ThemeManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Get the color scheme from display_config
     * Returns default scheme if none configured
     */
    getColorScheme() {
        const displayConfig = this.dataManager.getDisplayConfig();
        return displayConfig && displayConfig.color_scheme || {
            background: '#868686',
            nodes: '#f1b800',
            detail_sector: '#362e6a',
            text_primary: '#000000',
            text_secondary: '#ffffff'
        };
    }

    /**
     * Get color for a specific node type
     * @param {string} type - Node type (e.g., 'book', 'chapter', 'verse')
     * @param {string} name - Node name (optional, for future use)
     * @returns {string} Hex color code
     */
    getColor(type, name = '') {
        // Special handling for volume selector
        if (type === 'volume_selector') {
            return '#362e6a'; // MMdM blue for volume selector
        }
        
        // Get color from display configuration
        const levelConfig = this.dataManager.getHierarchyLevelConfig(type);
        const colorScheme = this.getColorScheme();
        return levelConfig && levelConfig.color || colorScheme.nodes;
    }
    
    /**
     * Convenience method for getting color by type only
     * @param {string} type - Node type
     * @returns {string} Hex color code
     */
    getColorForType(type) {
        return this.getColor(type, '');
    }
}

export { ThemeManager };
