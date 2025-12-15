/**
 * Parent Name Builder
 * Builds contextual breadcrumb names for the Parent Button
 * 
 * Responsibilities:
 * - Generate display names for parent levels
 * - Build contextual breadcrumbs from top navigation level
 * - Handle different parent button styles (simple vs cumulative)
 * - Pluralize parent names appropriately
 * 
 * This module encapsulates the complex logic for generating
 * meaningful parent button labels based on navigation context.
 */

export class ParentNameBuilder {
    /**
     * @param {Object} renderer - Reference to the main renderer for access to dataManager and hierarchy methods
     */
    constructor(renderer) {
        this.renderer = renderer;
    }

    /**
     * Get the display name for a parent level
     * Builds contextual breadcrumb from top navigation level through parent level
     * @param {Object} item - The current item (with __path metadata)
     * @param {string} parentLevel - The parent level name
     * @returns {string} Display name for the parent button
     */
    getParentNameForLevel(item, parentLevel) {
        const r = this.renderer;
        if (!item.__path || item.__path.length === 0) {
            return parentLevel;
        }
        
        // Get top navigation level configuration
        const rootData = r.dataManager.data?.[r.dataManager.rootDataKey];
        const startupConfig = rootData?.display_config?.focus_ring_startup;
        const topNavLevel = startupConfig?.top_navigation_level;
        const parentButtonStyle = startupConfig?.parent_button_style || 'cumulative';
        
        // If simple style, just return the immediate parent name
        if (parentButtonStyle === 'simple') {
            if (item.__path.length >= 2) {
                return item.__path[item.__path.length - 2].toUpperCase();
            }
            return parentLevel;
        }
        
        if (!topNavLevel) {
            // Fallback to simple parent name if no top nav level configured
            if (item.__path.length >= 2) {
                return item.__path[item.__path.length - 2];
            }
            return parentLevel;
        }
        
        // Get hierarchy information
        const levelNames = r.getHierarchyLevelNames();
        const topNavDepth = levelNames.indexOf(topNavLevel);
        const parentDepth = levelNames.indexOf(parentLevel);

        const normalizeSegment = (segment) => {
            if (typeof segment === 'string') return segment;
            if (segment && typeof segment === 'object') {
                return segment.name || segment.key || String(segment);
            }
            return segment === undefined || segment === null ? '' : String(segment);
        };
        
        if (topNavDepth === -1 || parentDepth === -1) {
            // Fallback if levels not found in hierarchy
            if (item.__path.length >= 2) {
                return item.__path[item.__path.length - 2];
            }
            return parentLevel;
        }
        
        // Build contextual breadcrumb: always show top ancestor, then immediate parent (if different)
        const contextSegments = [];
        
        // Determine actual parent from path (handles skipped hierarchy levels)
        const actualParentIndex = item.__path.length - 2;
        const actualParentSegment = actualParentIndex >= 0 ? item.__path[actualParentIndex] : null;
        
        // Case 1: Parent is ABOVE top navigation level
        // Show only the parent name, singular
        if (actualParentIndex < topNavDepth) {
            if (actualParentSegment) {
                contextSegments.push(normalizeSegment(actualParentSegment));
            }
        }
        // Case 2: Parent IS the top navigation level
        // Show only top ancestor, singular
        else if (actualParentIndex === topNavDepth) {
            const topAncestorSegment = normalizeSegment(item.__path[topNavDepth]);
            contextSegments.push(topAncestorSegment);
        }
        // Case 3: Parent is BELOW top navigation level
        // Show top ancestor + parent (pluralized)
        else if (actualParentIndex > topNavDepth) {
            // Add top ancestor first
            const topAncestorSegment = normalizeSegment(item.__path[topNavDepth]);
            contextSegments.push(topAncestorSegment);
            
            // Add actual parent (pluralized)
            if (actualParentSegment) {
                const levelName = levelNames[actualParentIndex] || parentLevel;
                const levelConfig = r.dataManager.getHierarchyLevelConfig(levelName);
                
                // Pluralize based on level type
                const normalizedParent = normalizeSegment(actualParentSegment);
                const pluralized = levelConfig?.is_numeric 
                    ? normalizedParent + "'s"  // Numbers: "8" → "8's"
                    : normalizedParent + "'s"; // Words: "Flathead" → "Flathead's"
                
                contextSegments.push(pluralized);
            }
        }
        
        // Join segments with space and convert to uppercase
        return contextSegments.join(' ').toUpperCase();
    }
}
