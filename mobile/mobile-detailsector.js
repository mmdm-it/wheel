/**
 * Mobile Detail Sector Module
 * Displays catalog information within the expanded Detail Sector area
 *
 * This module manages the display of detailed product information,
 * including descriptions, specifications, pricing, and media content
 * within the expanded blue circle area when a leaf item is selected.
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { DetailSectorGeometry } from './detailsector-geometry.js';
import { DetailSectorAnimation } from './detailsector-animation.js';
import { DetailSectorViews } from './detailsector-views.js';
import { DetailSectorContent } from './detailsector-content.js';

/**
 * Manages the Detail Sector content display
 */
class MobileDetailSector {
    constructor(viewportManager, dataManager, renderer) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        this.renderer = renderer; // Reference to parent renderer

        // Initialize modules
        this.geometry = new DetailSectorGeometry(viewportManager);
        this.animation = new DetailSectorAnimation(viewportManager, dataManager, renderer);
        this.content = new DetailSectorContent(dataManager, renderer, this.geometry);
        this.views = new DetailSectorViews(dataManager, renderer, this.geometry, this.content);

        // DOM element cache
        this.detailItemsGroup = null;

        // Current state
        this.currentItem = null;
        this.isVisible = false;
    }

    /**
     * Initialize the Detail Sector with DOM element
     */
    initialize(detailItemsGroup) {
        this.detailItemsGroup = detailItemsGroup;
        Logger.debug('MobileDetailSector initialized');
    }

    /**
     * Create the Detail Sector circle - delegates to animation module
     */
    createCircle() {
        return this.animation.createCircle();
    }
    
    /**
     * Create the volume logo - delegates to animation module
     */
    createLogo() {
        return this.animation.createLogo();
    }
    
    /**
     * Update the Detail Sector logo - delegates to animation module
     */
    updateLogo() {
        return this.animation.updateLogo();
    }

    /**
     * Calculate END state for logo - delegates to animation module
     */
    getLogoEndState() {
        return this.animation.getLogoEndState();
    }
    
    /**
     * DIAGNOSTIC: Visualize the Detail Sector bounding area
     * Delegates to geometry module
     */
    showBounds() {
        const mainGroup = this.renderer.elements.mainGroup;
        return this.geometry.showBounds(mainGroup);
    }

    /**
     * Hide the Detail Sector bounds diagnostic
     * Delegates to geometry module
     */
    hideBounds() {
        return this.geometry.hideBounds();
    }

    /**
     * Calculate the usable content bounds for the Detail Sector
     * Delegates to geometry module
     */
    getContentBounds() {
        return this.geometry.getContentBounds();
    }    /**
     * Show detail content for a selected item
     * Called after the Detail Sector expansion animation completes
     */
    showDetailContent(item) {
        if (!item) {
            Logger.warn('No item provided for detail display');
            return;
        }

        Logger.debug('📋 Showing detail content for item:', item.name);
        this.currentItem = item;
        this.isVisible = true;

        // Clear any existing content
        if (this.detailItemsGroup) {
            this.detailItemsGroup.innerHTML = '';
            this.detailItemsGroup.classList.remove('hidden');
        }

        // Create and display the detail content
        this.renderDetailContent(item);
    }

    /**
     * Hide the detail content
     * Called when collapsing the Detail Sector
     */
    hideDetailContent() {
        Logger.debug('📋 Hiding detail content');
        this.currentItem = null;
        this.isVisible = false;

        // Delegate audio overlay cleanup to views module
        this.views.closeAudioOverlay();

        if (this.detailItemsGroup) {
            this.detailItemsGroup.innerHTML = '';
            this.detailItemsGroup.classList.add('hidden');
        }
    }

    /**
     * Render the detailed content for an item
     */
    renderDetailContent(item) {
        if (!this.detailItemsGroup) {
            Logger.error('Detail items group not initialized');
            return;
        }

        this.detailItemsGroup.innerHTML = '';

        const arcParams = this.viewport.getArcParameters();
        const circleRadius = (arcParams && typeof arcParams.radius === 'number' ? arcParams.radius : 0) * 0.98;

        const contentGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        contentGroup.setAttribute('class', 'detail-content');
        contentGroup.setAttribute('transform', `translate(0, 0)`); // Position at SVG origin (screen center)
        contentGroup.style.pointerEvents = 'none'; // Allow clicks to pass through to magnifier below

        // Offset inner group toward the on-screen focus anchor so content stays within the visible arc
        const contentInnerGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        contentInnerGroup.setAttribute('class', 'detail-content-inner');
        const innerOffsetX = 0; // Center content at viewport center instead of offsetting to magnifier
        contentInnerGroup.setAttribute('transform', `translate(${innerOffsetX} 0)`);
        contentGroup.appendChild(contentInnerGroup);

        const contentRadius = circleRadius * 0.82;
        const detailConfig = this.dataManager.getDetailSectorConfigForItem(item);
        const detailContext = this.dataManager.getDetailSectorContext(item);

        Logger.debug('📋 DetailSector: content rendering context', {
            itemName: detailContext.name,
            level: detailContext.level,
            viewCount: detailConfig?.views?.length || 0
        });

        if (!detailConfig || (!detailConfig.header && (!detailConfig.views || detailConfig.views.length === 0))) {
            // Delegate to content module
            this.content.renderLegacyFallback(contentInnerGroup, item, contentRadius);
            this.detailItemsGroup.appendChild(contentGroup);
            return;
        }

        // Start content near the top of the visible screen area
        let currentY = -250; // Start 250px above screen center (higher up in viewport)
        
        // Delegate header rendering to content module
        currentY = this.content.renderHeader(detailConfig.header, detailContext, contentInnerGroup, currentY);

        // Delegate view rendering to views module
        (detailConfig.views || []).forEach(view => {
            currentY = this.views.renderView(view, detailContext, contentInnerGroup, currentY, contentRadius, arcParams);
        });

        this.detailItemsGroup.appendChild(contentGroup);
    }

    /**
     * Handle viewport changes
     */
    handleViewportChange() {
        // If detail content is currently visible, re-render it with new viewport
        if (this.isVisible && this.currentItem) {
            Logger.debug('📋 Re-rendering detail content due to viewport change');
            this.renderDetailContent(this.currentItem);
        }
    }

    /**
     * Reset the module state
     */
    reset() {
        this.hideDetailContent();
        // Delegate audio overlay cleanup to views module
        this.views.closeAudioOverlay();
        Logger.debug('MobileDetailSector reset');
    }

    /**
     * Expand the Detail Sector circle and logo
     * Animates from upper right corner to focus ring center
     */
    expand() {
        // Show detail content for the selected item after animation completes
        this.animation.expand(() => {
            if (this.renderer.selectedFocusItem) {
                Logger.debug('📋 Displaying detail content for selected item:', this.renderer.selectedFocusItem.name);
                this.showDetailContent(this.renderer.selectedFocusItem);
            }
        });
    }

    /**
     * Collapse the Detail Sector when navigating away from leaf item
     * Animates from focus ring center back to upper right corner
     */
    collapse() {
        // Hide detail content immediately when starting collapse
        this.hideDetailContent();
        
        // Delegate to animation module
        this.animation.collapse();
    }
}

export { MobileDetailSector };

export { MobileDetailSector };