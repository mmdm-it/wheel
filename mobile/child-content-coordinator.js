/**
 * Child Content Coordinator
 * Handles display of child content for focus items
 * 
 * Responsibilities:
 * - Determine if focus item has children or is a leaf
 * - Handle lazy loading for split volumes
 * - Show Child Pyramid for non-leaf items
 * - Handle Detail Sector for leaf items
 * - Manage parent button updates
 * - Cache leaf state for performance
 * 
 * This module encapsulates the logic for displaying the
 * appropriate child content (Child Pyramid or Detail Sector)
 * based on the selected focus item.
 */

import { Logger } from './mobile-logger.js';

// Debug flag - set to false to disable verbose console logging
const DEBUG_VERBOSE = false;

export class ChildContentCoordinator {
    /**
     * @param {Object} renderer - Reference to the main renderer
     */
    constructor(renderer) {
        this.renderer = renderer;
        // Performance optimization: track last shown item to debounce redundant calls
        this._lastChildContentItem = null;
        this._lastChildContentTime = null;
    }

    /**
     * Show child content for the selected focus item
     * Determines if item is a leaf or has children, then displays appropriate content
     */
    showChildContentForFocusItem(focusItem, angle) {
        const r = this.renderer;
        
        // PERFORMANCE: Debounce - skip if we've shown content for same item recently
        const itemKey = focusItem.key || focusItem.name;
        if (this._lastChildContentItem === itemKey && 
            this._lastChildContentTime && 
            performance.now() - this._lastChildContentTime < 50) {
            // Skip redundant call
            return;
        }
        this._lastChildContentItem = itemKey;
        this._lastChildContentTime = performance.now();
        
        if (DEBUG_VERBOSE) console.log('📦📦📦 showChildContentForFocusItem CALLED:', focusItem.name, 'path:', focusItem.__path);
        Logger.debug('Showing child content for focus item:', focusItem.name);

        // Determine the hierarchy level of the focus item
        const currentLevel = r.getItemHierarchyLevel(focusItem);
        if (DEBUG_VERBOSE) console.log('📦 Current level:', currentLevel);
        if (!currentLevel) {
            Logger.warn('Could not determine hierarchy level for focus item:', focusItem);
            return;
        }

        // Get the immediate next hierarchy level (universal navigation requires immediate children)
        const nextLevel = r.getNextHierarchyLevel(currentLevel);
        if (DEBUG_VERBOSE) console.log('📦 Next level:', nextLevel);
        if (!nextLevel) {
            Logger.debug('No next level detected for', focusItem.name, '- treating as leaf');
            r.leafStateCache.set(r.getLeafCacheKey(focusItem, null), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        // Check if we need lazy loading (split volume, book level getting chapters)
        if (r.dataManager.isSplitStructure() && currentLevel === 'book' && nextLevel === 'chapter') {
            // Use async version for lazy loading
            this._showChildContentForFocusItemAsync(focusItem, angle, currentLevel, nextLevel);
            return;
        }

        // Check if we need lazy loading for chapters (chapter-level split, chapter getting verses)
        if (r.dataManager.isChapterSplitStructure() && currentLevel === 'chapter' && nextLevel === 'verse') {
            // Use async version for lazy loading
            this._showChildContentForChapterAsync(focusItem, angle, currentLevel, nextLevel);
            return;
        }

        // Synchronous path for monolithic volumes
        this._showChildContentSync(focusItem, angle, currentLevel, nextLevel);
    }

    /**
     * Async helper for showChildContentForFocusItem - handles lazy loading of books
     */
    async _showChildContentForFocusItemAsync(focusItem, angle, currentLevel, nextLevel) {
        const r = this.renderer;
        Logger.info(`📥 Lazy loading chapters for book: ${focusItem.name}`);
        
        // Ensure book data is loaded
        const loaded = await r.dataManager.ensureBookLoaded(focusItem);
        if (!loaded) {
            Logger.error(`Failed to load book data for ${focusItem.name}`);
            this.handleLeafFocusSelection(focusItem);
            return;
        }
        
        // Now continue with sync path since data is loaded
        this._showChildContentSync(focusItem, angle, currentLevel, nextLevel);
    }

    /**
     * Async helper for showChildContentForFocusItem - handles lazy loading of chapters
     */
    async _showChildContentForChapterAsync(focusItem, angle, currentLevel, nextLevel) {
        const r = this.renderer;
        console.log(`🔍 DEBUG _showChildContentForChapterAsync: chapter=${focusItem.name}, path=${JSON.stringify(focusItem.__path)}`);
        Logger.info(`📥 Lazy loading verses for chapter: ${focusItem.name}`);
        
        // Ensure chapter data is loaded
        const loaded = await r.dataManager.ensureChapterLoaded(focusItem);
        console.log(`🔍 DEBUG ensureChapterLoaded returned: ${loaded}`);
        if (!loaded) {
            Logger.error(`Failed to load chapter data for ${focusItem.name}`);
            this.handleLeafFocusSelection(focusItem);
            return;
        }
        
        // Now continue with sync path since data is loaded
        this._showChildContentSync(focusItem, angle, currentLevel, nextLevel);
    }

    /**
     * Synchronous helper for showChildContentForFocusItem
     */
    _showChildContentSync(focusItem, angle, currentLevel, nextLevel) {
        const r = this.renderer;
        const { level: resolvedLevel, items: childItems } = r.resolveChildLevel(focusItem, nextLevel);
        const cacheLevel = resolvedLevel || nextLevel;

        if (DEBUG_VERBOSE) console.log(`📦 Resolved level: '${cacheLevel}', child items:`, childItems?.length);
        Logger.debug(`Focus item is at level '${currentLevel}', requested '${nextLevel}', resolved to '${cacheLevel}'`);
        
        if (!childItems || childItems.length === 0) {
            if (DEBUG_VERBOSE) console.log(`📦 NO CHILD ITEMS - treating as leaf`);
            Logger.debug(`No child items found for ${currentLevel}: ${focusItem.name} - treating as leaf`);
            r.leafStateCache.set(r.getLeafCacheKey(focusItem, cacheLevel), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        r.leafStateCache.set(r.getLeafCacheKey(focusItem, cacheLevel), false);

        const itemType = r.getLevelPluralLabel(cacheLevel);
        if (DEBUG_VERBOSE) console.log(`📦 Found ${childItems.length} ${itemType}, calling showChildPyramid`);
        Logger.debug(`Found ${childItems.length} ${itemType} for ${currentLevel}: ${focusItem.name}`);

        // Set the active type to the current focus item's level
        r.activeType = currentLevel;
        r.setSelectedFocusItem(focusItem);
        
        // Update Parent Button for non-leaf items
        const itemLevel = r.getItemHierarchyLevel(focusItem);
        const parentLevel = itemLevel ? r.getPreviousHierarchyLevel(itemLevel) : null;
        const parentName = parentLevel ? r.getParentNameForLevel(focusItem, parentLevel) : null;
        Logger.debug(`🔼 Parent Button update: itemLevel=${itemLevel}, parentLevel=${parentLevel}, parentName=${parentName}, path=${JSON.stringify(focusItem.__path)}`);
        r.updateParentButton(parentName, true); // Skip animation during rotation

        // Collapse Detail Sector when showing Child Pyramid (non-leaf items)
        if (r.detailSector && r.detailSector.isVisible) {
            Logger.debug('🔵 Collapsing Detail Sector - Child Pyramid visible');
            r.collapseDetailSector();
        }

        // Show child items in Child Pyramid
        Logger.debug('🔺 SHOWING Child Pyramid with', childItems.length, itemType, 'for focus item:', focusItem.name);
        r.currentChildItems = childItems; // Cache for sibling retrieval when child is clicked
        r.childPyramid.showChildPyramid(childItems, itemType);
    }

    /**
     * Handle selection of a leaf focus item (item with no children)
     * Updates UI to show Detail Sector instead of Child Pyramid
     */
    handleLeafFocusSelection(focusItem) {
        const r = this.renderer;
        if (!focusItem) {
            return;
        }

        Logger.debug('Leaf focus item selected:', focusItem.name);

        // Hide child visuals when no children exist
        if (r.elements.childRingGroup) {
            r.elements.childRingGroup.classList.add('hidden');
        }
        r.clearFanLines();

        // Update current selection state
        r.setSelectedFocusItem({ ...focusItem });

        // Set the active type to the current focus item's level
        const itemLevel = r.getItemHierarchyLevel(focusItem);
        r.activeType = itemLevel;
        
        const parentLevel = itemLevel ? r.getPreviousHierarchyLevel(itemLevel) : null;
        const parentName = parentLevel ? r.getParentNameForLevel(focusItem, parentLevel) : null;
        Logger.debug(`🔼 Parent Button update (leaf): itemLevel=${itemLevel}, parentLevel=${parentLevel}, parentName=${parentName}, path=${JSON.stringify(focusItem.__path)}`);
        r.updateParentButton(parentName, true); // Skip animation during rotation

        if (!r.detailSector) {
            return;
        }

        // Check if this is actually at the leaf level (not just childless)
        const displayConfig = r.dataManager.getDisplayConfig();
        const leafLevel = displayConfig?.leaf_level;
        const isActualLeaf = leafLevel && itemLevel === leafLevel;
        
        // Only expand Detail Sector for actual leaf items (e.g., models, verses)
        // Don't expand for childless non-leaf items (e.g., cylinder counts without models)
        
        if (isActualLeaf) {
            if (r.detailSector.isVisible) {
                r.detailSector.showDetailContent(focusItem);
            } else if (!r.detailSectorAnimating) {
                r.expandDetailSector();
            }
        }
        // For childless non-leaf items, don't show Detail Sector at all
    }
}
