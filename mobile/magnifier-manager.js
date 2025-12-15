/**
 * Magnifier Manager
 * Handles magnifier ring creation, positioning, and navigation interactions
 * 
 * The magnifier is the circular indicator that shows which focus item is currently centered.
 * This module owns all magnifier-related functionality.
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

class MagnifierManager {
    constructor(viewport, renderer) {
        this.viewport = viewport;
        this.renderer = renderer;
        this.magnifierElement = null;
        this.touchHandler = null; // Injected later
    }
    
    /**
     * Set the touch handler (injected after controller initialization)
     */
    setTouchHandler(touchHandler) {
        this.touchHandler = touchHandler;
    }
    
    /**
     * Create and position the magnifier ring element
     * @returns {SVGElement} The created magnifier element
     */
    create() {
        // Remove existing magnifier if it exists
        if (this.magnifierElement) {
            this.magnifierElement.remove();
        }
        
        // Create new magnifier
        const ring = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        ring.setAttribute('id', 'magnifier');
        ring.style.cursor = 'pointer';
        ring.style.pointerEvents = 'all'; // Ensure it receives touch events
        
        console.log('✨ Magnifier created with click handler');
        
        // Add touch event handlers
        this.addTouchHandlers(ring);
        
        // Add to main group (NOT to focus ring group, so it stays visible)
        const mainGroup = this.renderer.elements.mainGroup;
        if (!mainGroup) {
            Logger.error('❌ Main group not found - cannot create magnifier');
            return null;
        }
        
        mainGroup.appendChild(ring);
        
        // Cache the element
        this.magnifierElement = ring;
        this.renderer.elements.magnifier = ring;
        
        // Position it
        this.position();
        
        Logger.debug('Magnifier created and positioned with click handler');
        
        return ring;
    }
    
    /**
     * Add touch event handlers to magnifier
     */
    addTouchHandlers(ring) {
        let touchStartPos = null;
        let touchStartTime = null;
        
        ring.addEventListener('touchstart', (e) => {
            console.log('✨ Magnifier TOUCHSTART');
            touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            touchStartTime = performance.now();
        }, { passive: true });
        
        ring.addEventListener('touchend', (e) => {
            console.log('✨ Magnifier TOUCHEND');
            if (!touchStartPos) return;
            
            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStartPos.x;
            const dy = touch.clientY - touchStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const duration = performance.now() - touchStartTime;
            
            Logger.debug('🔍 Magnifier touchend:', {
                distance: distance.toFixed(2),
                duration: duration.toFixed(2),
                willTrigger: distance < 10 && duration < 300
            });
            
            // Only trigger if touch didn't move much (click, not swipe) and was quick
            if (distance < 10 && duration < 300) {
                e.preventDefault();
                e.stopPropagation();
                console.log('✨ MAGNIFIER TAP - no action (clicks on unselected nodes move them to center)');
            } else {
                console.log('✨ Magnifier touch too long or moved too much:', { distance, duration });
            }
            touchStartPos = null;
            touchStartTime = null;
        }, { passive: false });
        
        // Magnifier click disabled - clicking unselected nodes brings them to center
        ring.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Logger.debug('🔍 Magnifier clicked - no action (clicks on unselected nodes move them to center)');
        });
    }
    
    /**
     * Position the magnifier ring at the calculated magnifier angle
     */
    position() {
        const ring = this.magnifierElement;
        if (!ring) {
            Logger.error('Magnifier not found');
            return;
        }
        
        const position = this.viewport.getMagnifyingRingPosition();
        
        // Position ring at calculated dynamic position
        ring.setAttribute('cx', position.x);
        ring.setAttribute('cy', position.y);
        ring.setAttribute('r', MOBILE_CONFIG.RADIUS.MAGNIFIER);
        
        // Final styling: black ring as requested
        ring.setAttribute('stroke', 'black');
        ring.setAttribute('stroke-width', '1');
        ring.setAttribute('opacity', '0.8');
        
        // Restore visibility if hidden during animation
        ring.style.opacity = '';
        
        // Log Magnifier position and current selected item text
        const selectedItem = this.renderer.selectedFocusItem;
        console.log('🔍 === MAGNIFIER AT LOAD ===');
        console.log('🔍 Magnifier position:', { x: position.x.toFixed(1), y: position.y.toFixed(1), radius: MOBILE_CONFIG.RADIUS.MAGNIFIER });
        console.log('🔍 Magnifier angle (from viewport):', (position.angle * 180 / Math.PI).toFixed(1) + '°');
        if (selectedItem) {
            console.log('🔍 Selected item text:', selectedItem.name);
            console.log('🔍 Selected item rotation:', '0° (text is horizontal at Magnifier)');
        } else {
            console.log('🔍 No selected item yet');
        }
        
        this.renderer.focusRingDebug(`Magnifier positioned at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) with radius ${MOBILE_CONFIG.RADIUS.MAGNIFIER}`);
    }
    
    /**
     * Advance Focus Ring by one node clockwise (increase sort_number by 1)
     * Triggered by clicking the magnifier
     */
    advance() {
        Logger.debug('🔍🔍🔍 advanceFocusRing CALLED');
        
        const currentFocusItems = this.renderer.currentFocusItems;
        if (!currentFocusItems || currentFocusItems.length === 0) {
            Logger.warn('🔍 No focus items to advance');
            return;
        }
        
        Logger.debug('🔍 Current focus items:', currentFocusItems.length);
        
        // Get current selected index
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (currentFocusItems.length - 1) / 2;
        const currentRotationOffset = this.touchHandler?.rotationOffset || 0;
        const currentIndex = this.renderer.getSelectedFocusIndex(currentRotationOffset, currentFocusItems.length);
        
        Logger.debug('🔍 Selection state:', {
            angleStep,
            middleIndex,
            currentRotationOffset: currentRotationOffset.toFixed(3),
            currentIndex
        });
        
        if (currentIndex < 0) {
            Logger.warn('🔍 No item currently selected at center');
            return;
        }
        
        const currentItem = currentFocusItems[currentIndex];
        Logger.debug('🔍 Current item:', currentItem.name);
        
        // Calculate next index (wrap around to 0 if at end)
        const nextIndex = (currentIndex + 1) % currentFocusItems.length;
        const nextItem = currentFocusItems[nextIndex];
        
        // Calculate rotation offset needed to center the next item
        const targetOffset = (nextIndex - middleIndex) * angleStep;
        
        Logger.debug(`🔍🎯 Magnifier clicked: advancing from [${currentIndex}] ${currentItem.name} to [${nextIndex}] ${nextItem.name}`);
        Logger.debug(`🔍🎯 Offset: ${currentRotationOffset.toFixed(3)} → ${targetOffset.toFixed(3)}`);
        
        // Animate to target position
        const controller = this.renderer.controller;
        if (controller && typeof controller.animateRotationTo === 'function') {
            Logger.debug('🔍 Calling animateRotationTo with targetOffset:', targetOffset.toFixed(3));
            controller.animateRotationTo(targetOffset);
        } else {
            Logger.error('🔍 rotation controller not available');
        }
    }
    
    /**
     * Bring a specific focus node to center (magnifier position)
     * Triggered by clicking an unselected focus node
     */
    bringToCenter(focusItem) {
        console.log('🎯🎯🎯 bringFocusNodeToCenter CALLED');
        console.log(`🎯🔍 SEARCH: Looking for item name="${focusItem.name}" key="${focusItem.key}"`);
        
        const currentFocusItems = this.renderer.currentFocusItems;
        console.log(`🎯🔍 SEARCH: currentFocusItems array has ${currentFocusItems.length} items`);
        
        Logger.debug('🎯🎯🎯 bringFocusNodeToCenter CALLED');
        Logger.debug('🎯 Target item:', focusItem.name);
        
        if (!currentFocusItems || currentFocusItems.length === 0) {
            Logger.warn('🎯 No current focus items');
            return;
        }
        
        // Find the index of the clicked item
        const targetIndex = currentFocusItems.findIndex(item => {
            return item !== null && item.key === focusItem.key;
        });
        
        if (targetIndex < 0) {
            Logger.warn('🎯 Target item not found in currentFocusItems:', focusItem.name);
            return;
        }
        
        Logger.debug('🎯 Target index:', targetIndex);
        
        // Calculate rotation offset needed to center this item
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (currentFocusItems.length - 1) / 2;
        const targetOffset = (targetIndex - middleIndex) * angleStep;
        
        Logger.debug(`🎯 Centering [${targetIndex}] ${focusItem.name} with offset: ${targetOffset.toFixed(3)}`);
        
        // Animate to target position
        const controller = this.renderer.controller;
        if (controller && typeof controller.animateRotationTo === 'function') {
            controller.animateRotationTo(targetOffset);
        } else {
            Logger.error('🎯 rotation controller not available');
        }
    }
    
    /**
     * Get the magnifier element
     */
    getElement() {
        return this.magnifierElement;
    }
}

export { MagnifierManager };
