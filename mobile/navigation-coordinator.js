/**
 * Navigation Coordinator
 * Handles complex navigation state transitions
 * 
 * Responsibilities:
 * - Coordinate Child Pyramid → Focus Ring navigation (IN)
 * - Manage animation sequencing during navigation
 * - Handle leaf vs non-leaf navigation logic
 * - Update navigation state and active paths
 * - Set up rotation offsets for centered items
 * 
 * This module encapsulates the complex state coordination
 * that happens during hierarchical navigation.
 */

import { Logger } from './mobile-logger.js';
import { MOBILE_CONFIG } from './mobile-config.js';

export class NavigationCoordinator {
    /**
     * @param {Object} renderer - Reference to the main renderer
     */
    constructor(renderer) {
        this.renderer = renderer;
    }

    /**
     * Handle Child Pyramid item click - start IN navigation
     * Coordinates animation and state transition from Child Pyramid to Focus Ring
     */
    handleChildPyramidClick(item, event) {
        const r = this.renderer;
        
        // Block clicks during animation
        if (r.isAnimating) {
            Logger.debug('🔺 Click blocked - animation in progress');
            return;
        }
        
        console.log('🔺🔺🔺 HANDLE CHILD PYRAMID CLICK CALLED!', item.name);
        Logger.debug('🔺 Child pyramid item clicked:', item.name, 'implementing nzone migration OUT');

        // Set animation flag to block further clicks
        r.isAnimating = true;

        // Immediately disable touch handling to prevent race conditions with touch events
        const touchHandler = r.getTouchHandler();
        if (touchHandler) {
            touchHandler.tempDisabled = true;
        }
        
        // Capture all Child Pyramid node positions before clearing
        const allChildNodes = Array.from(r.elements.childRingGroup.querySelectorAll('.child-pyramid-item'));
        const nodePositions = allChildNodes.map(node => {
            const circle = node.querySelector('.node');
            const dataItem = JSON.parse(node.getAttribute('data-item'));
            return {
                node: node,
                key: dataItem.key,
                startX: parseFloat(circle.getAttribute('cx')),
                startY: parseFloat(circle.getAttribute('cy'))
            };
        });
        
        Logger.debug(`🎬 Captured ${nodePositions.length} Child Pyramid nodes for animation`);
        
        // Clear Child Pyramid and fan lines immediately to prevent duplicates during animation
        r.elements.childRingGroup.innerHTML = '';
        r.elements.childRingGroup.classList.add('hidden');
        r.clearFanLines();
        
        // Clear Focus Ring nodes but preserve the background band (wallpaper)
        const focusRingGroup = r.elements.focusRingGroup;
        const background = focusRingGroup.querySelector('#focusRingBackground');
        focusRingGroup.innerHTML = '';
        if (background) {
            focusRingGroup.appendChild(background);
        }
        // Don't hide the focusRingGroup - keep it visible to show the background band
        
        // Check if clicked item is a leaf - if so, start Detail Sector expansion immediately
        const isLeaf = r.isLeafItem(item);
        
        if (isLeaf) {
            Logger.debug('🔺 Leaf item detected - starting Detail Sector expansion during animation');
            const displayConfig = r.dataManager.getDisplayConfig();
            const leafLevel = displayConfig?.leaf_level;
            const itemLevel = r.getItemHierarchyLevel(item);
            const isActualLeaf = leafLevel && itemLevel === leafLevel;
            
            if (isActualLeaf && !r.detailSectorAnimating) {
                r.expandDetailSector();
            }
        }
        
        // Animate Magnifier node (current focus) to Parent Button and Parent Button off-screen
        r.animation.animateMagnifierToParentButton(item, r.selectedFocusItem);
        
        // Start animation for all nodes, then continue with state updates
        const allSiblings = r.currentChildItems || [];
        r.animation.animateSiblingsToFocusRing(item, nodePositions, allSiblings, () => {
            // Animation complete - now show the real focus ring
            r.isAnimating = false;
            const handler = r.getTouchHandler();
            if (handler) {
                handler.tempDisabled = false;
            }
            this.continueChildPyramidClick(item);
        });
    }

    /**
     * Continue with Child Pyramid click logic after animation completes
     * Handles the state transition and updates Focus Ring
     */
    continueChildPyramidClick(item) {
        const r = this.renderer;
        Logger.debug('🔺 Continuing child pyramid click after animation:', item.name);
        
        // NZONE MIGRATION: Child Pyramid → Focus Ring
        // This moves the clicked item OUT to become the new focus in the Focus Ring

        // Determine the hierarchy level of the clicked item
        const itemLevel = r.getItemHierarchyLevel(item);
        if (!itemLevel) {
            Logger.warn('🔺 Could not determine hierarchy level for clicked item:', item);
            return;
        }

        Logger.debug(`🔺 ${itemLevel} clicked:`, item.name, 'Full item:', item);

        // 1. Update the navigation state - this item becomes the new focus
        r.buildActivePath(item);
        r.activeType = itemLevel;
        r.setSelectedFocusItem({ ...item });

        // 2. Get all siblings at the same level
        // COUSIN NAVIGATION: Get all items at this level across all parents (with gaps)
        let allSiblings = [];
        
        // For Child Pyramid clicks, siblings are the other items currently in Child Pyramid
        // But we want to expand to cousin navigation
        if (r.currentChildItems && r.currentChildItems.length > 0) {
            // We have cached child items, but we want cousins instead
            Logger.debug(`🔺 Expanding from ${r.currentChildItems.length} siblings to cousin navigation`);
        }
        
        // Use cousin navigation for Focus Ring
        allSiblings = r.getCousinItemsForLevel(item, itemLevel);
        
        console.log(`🔺🔍 COUSINS ARRAY (${allSiblings.length} items including gaps):`, allSiblings.map((s, i) => s ? `[${i}]${s.name}(key:${s.key})` : `[${i}]GAP`).join(', '));
        console.log(`🔺🔍 CLICKED ITEM: name="${item.name}", key="${item.key}"`);
        
        Logger.debug(`🔺 Getting cousins for "${item.name}" at level ${itemLevel}, found ${allSiblings.length} items (including gaps)`);

        // Validate sort_numbers for non-null items only
        const nonNullItems = allSiblings.filter(s => s !== null);
        const validatedNonNull = r.validateSortNumbers(nonNullItems, `Focus Ring cousins at ${itemLevel}`);
        if (validatedNonNull.length === 0) {
            Logger.error('🔺 Cannot display Focus Ring - no valid items with sort_numbers');
            return;
        }
        
        // Rebuild array with gaps in original positions
        const validatedWithGaps = allSiblings.map(s => s === null ? null : s);

        r.currentFocusItems = validatedWithGaps;
        r.allFocusItems = validatedWithGaps;
        
        console.log(`🎯🔄 SET currentFocusItems: ${validatedWithGaps.length} items set (${nonNullItems.length} real + ${validatedWithGaps.length - nonNullItems.length} gaps)`);

        // 3. Clear current Child Pyramid (already cleared before animation)
        r.elements.childRingGroup.innerHTML = '';
        r.elements.childRingGroup.classList.add('hidden');

        // 4. Check if this is a leaf item (model with no children)
        if (r.isLeafItem(item)) {
            Logger.debug('🔺 Leaf item clicked:', item.name, '- moving siblings to Focus Ring and displaying in Detail Sector');
            
            // Find the clicked item in siblings and calculate center offset
            const clickedIndex = r.findItemIndexInArray(item, allSiblings, itemLevel);
            const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
            const middleIndex = (allSiblings.length - 1) / 2;
            const centerOffset = (clickedIndex - middleIndex) * angleStep;
            
            Logger.debug(`🔺 Calculated centerOffset for leaf ${item.name}: clickedIndex=${clickedIndex}, middleIndex=${middleIndex}, centerOffset=${centerOffset.toFixed(3)}`);

            // Set up touch rotation with the correct offset
            if (r.controller && typeof r.controller.setupTouchRotation === 'function') {
                r.controller.setupTouchRotation(allSiblings);
                Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
                
                const handler = r.getTouchHandler();
                if (handler) {
                    handler.rotationOffset = centerOffset;
                    Logger.debug('🔺 Set touch handler rotationOffset to', centerOffset.toFixed(3));
                }
            }
            
            r.focusRingView.lastRotationOffset = centerOffset;

            // Show Focus Ring with siblings - clicked item should be centered
            r.forceImmediateFocusSettlement = true;
            try {
                r.showFocusRing();
                // Immediately update with correct offset
                r.updateFocusRingPositions(centerOffset);
            } finally {
                r.forceImmediateFocusSettlement = false;
            }
            
            // Handle as leaf item - display in Detail Sector
            // (handleLeafFocusSelection already updates the parent button)
            r.handleLeafFocusSelection(item);
            
            Logger.debug(`🔺 Immediate focus settlement complete for leaf ${itemLevel} ${item.name}`);
            return;
        }

        // Non-leaf item handling: continue with regular nzone migration

        // 4. Find the clicked item in the siblings and calculate the center offset FIRST
        const clickedIndex = r.findItemIndexInArray(item, allSiblings, itemLevel);
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (allSiblings.length - 1) / 2;
        // FIX: Use positive offset to match the (middleIndex - index) formula in updateFocusRingPositions
        // If clicked item is at higher index (e.g., 14), we need positive offset to shift base angle UP
        // so that (middleIndex - 14) becomes less negative, bringing item 14 closer to center
        const centerOffset = (clickedIndex - middleIndex) * angleStep;
        
        Logger.debug(`🔺 Calculated centerOffset for ${item.name}: clickedIndex=${clickedIndex}, middleIndex=${middleIndex}, centerOffset=${centerOffset.toFixed(3)}`);

        // 5. Set up touch rotation with the correct offset
        if (r.controller && typeof r.controller.setupTouchRotation === 'function') {
            r.controller.setupTouchRotation(allSiblings);
            Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
            
            // CRITICAL: Set the rotation offset AFTER setupTouchRotation to override its default
            const handler = r.getTouchHandler();
            if (handler) {
                // Stop any ongoing inertial animation to prevent it from interfering
                handler.stopAnimation();
                handler.rotationOffset = centerOffset;
                Logger.debug('🔺 Set touch handler rotationOffset to', centerOffset.toFixed(3));
            }
        }
        
        // Also update lastRotationOffset to prevent rotation detection
        r.focusRingView.lastRotationOffset = centerOffset;

        // CRITICAL: Set selectedFocusItem BEFORE conditional check
        // This ensures showChildContentForFocusItem has the correct context
        r.setSelectedFocusItem(item);
        r.activeType = itemLevel;
        
        // Animate text migration from Magnifier (old focus) to Parent Button (new parent)
        // Get the new parent name that will appear in Parent Button
        const parentLevel = r.getPreviousHierarchyLevel(itemLevel);
        const newParentName = parentLevel ? r.getParentNameForLevel(item, parentLevel) : null;
        if (newParentName) {
            r.updateParentButton(newParentName, false); // Trigger animation
        }

        // Update Focus Ring with siblings - clicked item should be centered
        r.forceImmediateFocusSettlement = true;
        try {
            r.showFocusRing();
            // Immediately update with correct offset
            r.updateFocusRingPositions(centerOffset);
            
            // Protect this rotation position from triggering Child Pyramid hide
            r.focusRingView.protectedRotationOffset = centerOffset;
            setTimeout(() => {
                r.focusRingView.protectedRotationOffset = undefined;
            }, 100);
            
            // Show child content for the newly selected focus item (non-leaf)
            const magnifierPos = r.viewport.getMagnifyingRingPosition();
            r.showChildContentForFocusItem(item, magnifierPos.angle);
        } finally {
            r.forceImmediateFocusSettlement = false;
        }

        Logger.debug(`🔺 Immediate focus settlement complete for ${itemLevel} ${item.name}`);
        return;
    }
}
