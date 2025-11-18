/**
 * Mobile Volume Application
 * Main coordinator class and initialization logic
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { ViewportManager } from './mobile-viewport.js';
import { TouchRotationHandler } from './mobile-touch.js';
import { DataManager } from './mobile-data.js';
import { MobileRenderer } from './mobile-renderer.js';

/**
 * Main application class that coordinates all components
 */
class MobileCatalogApp {
    constructor() {
        this.viewport = new ViewportManager();
        this.dataManager = new DataManager();
        this.renderer = new MobileRenderer(this.viewport, this.dataManager);
        this.touchHandler = null;

        this.initialized = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.volumeSelectorMode = true; // Start in volume selector mode
        this.selectedVolume = null;
    }

    async init() {
        try {
            Logger.debug('Starting mobile volume initialization...');

            // Check URL for direct volume loading
            const urlParams = new URLSearchParams(window.location.search);
            const volumeParam = urlParams.get('volume');
            
            if (volumeParam) {
                // Direct load from URL parameter
                Logger.debug(`Loading volume from URL parameter: ${volumeParam}`);
                await this.renderer.initialize();
                this.setupResizeHandling();
                this.setupParentButtonHandler();
                await this.dataManager.loadVolume(volumeParam);
                this.volumeSelectorMode = false;
                this.showAllFocusItems();
                this.initialized = true;
                return;
            }

            // Discover available volumes
            const volumes = await this.dataManager.discoverVolumes();
            
            if (volumes.length === 0) {
                throw new Error('No valid Wheel volumes found');
            }
            
            if (volumes.length === 1) {
                // Only one volume - load it directly
                Logger.debug('Single volume found - loading directly');
                await this.renderer.initialize();
                this.setupResizeHandling();
                this.setupParentButtonHandler();
                await this.loadSelectedVolume(volumes[0]);
            } else {
                // Multiple volumes - show simple HTML selector
                Logger.debug(`${volumes.length} volumes found - showing selector`);
                this.showSimpleVolumeSelector(volumes);
            }

            this.initialized = true;
            Logger.debug('Mobile volume initialized successfully');
        } catch (error) {
            this.handleInitError(error);
        }
    }

    /**
     * Show simple HTML volume selector (dev only)
     */
    showSimpleVolumeSelector(volumes) {
        this.volumeSelectorMode = true;
        
        // Hide SVG and parent button
        const svg = document.getElementById('catalogSvg');
        const parentButton = document.getElementById('parentButton');
        const copyright = document.getElementById('copyright');
        
        if (svg) svg.style.display = 'none';
        if (parentButton) parentButton.style.display = 'none';
        if (copyright) copyright.style.display = 'none';
        
        // Create simple HTML selector
        const selectorDiv = document.createElement('div');
        selectorDiv.id = 'volumeSelector';
        selectorDiv.style.cssText = 'font-family: monospace; padding: 20px; max-width: 600px; margin: 0 auto;';
        
        let html = '<h1 style="font-size: 18px; margin-bottom: 10px;">Wheel Volume Loader (Dev Only)</h1>';
        html += '<p style="color: #666; font-size: 12px; margin-bottom: 20px;">Select a catalog to load:</p>';
        html += '<ul style="list-style: none; padding: 0;">';
        
        volumes.forEach((volume, index) => {
            html += `<li style="margin-bottom: 10px;">`;
            html += `<a href="#" data-volume-index="${index}" style="display: block; padding: 10px; background: #f0f0f0; text-decoration: none; color: #333; border-radius: 4px;">`;
            html += `<strong>${volume.name}</strong><br>`;
            html += `<span style="font-size: 11px; color: #666;">${volume.filename}</span>`;
            html += `</a></li>`;
        });
        
        html += '</ul>';
        html += `<p style="color: gray; font-size: 11px; margin-top: 20px;">`;
        html += `Version: ${this.getVersion()} | `;
        html += `<span id="volume-count">${volumes.length}</span> volume(s) detected</p>`;
        html += '<p style="color: #999; font-size: 10px; margin-top: 10px;">Tip: Bookmark with ?volume=filename.json to skip this screen</p>';
        
        selectorDiv.innerHTML = html;
        document.body.appendChild(selectorDiv);
        
        // Add click handlers
        selectorDiv.querySelectorAll('a[data-volume-index]').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const index = parseInt(link.getAttribute('data-volume-index'));
                const volume = volumes[index];
                
                // Remove selector
                selectorDiv.remove();
                
                // Show SVG and initialize
                if (svg) svg.style.display = 'block';
                if (copyright) copyright.style.display = 'block';
                
                await this.renderer.initialize();
                this.setupResizeHandling();
                this.setupParentButtonHandler();
                await this.loadSelectedVolume(volume);
            });
        });
    }

    getVersion() {
        try {
            return MOBILE_CONFIG.VERSION ? MOBILE_CONFIG.VERSION.display() : 'unknown';
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Load the selected volume and transition to normal navigation
     */
    async loadSelectedVolume(volume) {
        try {
            Logger.debug(`📂 Loading selected volume: ${volume.name}`);
            this.selectedVolume = volume;
            
            // Load the volume data
            await this.dataManager.loadVolume(volume.filename);
            
            // Exit volume selector mode
            this.volumeSelectorMode = false;
            
            // Update logo to show catalog logo
            this.renderer.updateDetailSectorLogo();
            
            // Show all focus items for the loaded volume
            this.showAllFocusItems();
            
        } catch (error) {
            Logger.error('Failed to load selected volume:', error);
            alert(`Failed to load ${volume.name}. Please try another volume.`);
        }
    }

    handleInitError(error) {
        Logger.error('Initialization failed:', error);

        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            Logger.debug(`Retrying initialization (attempt ${this.retryCount}/${this.maxRetries})`);

            setTimeout(() => {
                this.init();
            }, 1000 * this.retryCount); // Exponential backoff
        } else {
            Logger.error('Max initialization retries reached. Catalog failed to load.');
            this.showErrorState();
        }
    }

    showErrorState() {
        // Try to show a basic error message
        const body = document.body;
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            font-family: 'Montserrat', sans-serif;
            z-index: 1000;
        `;
        errorDiv.innerHTML = `
            <h3>Catalog Error</h3>
            <p>Unable to load the volume. Please refresh the page.</p>
            <button onclick="location.reload()" style="
                background: #f1b800;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            ">Refresh</button>
        `;
        body.appendChild(errorDiv);
    }

    setupResizeHandling() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                Logger.debug('Handling resize event');
                this.handleResize();
            }, 250);
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                Logger.debug('Handling orientation change');
                this.handleResize();
            }, 500); // Wait for orientation change to complete
        });
    }

    handleResize() {
        if (!this.initialized) return;

        try {
            // Clear viewport cache
            this.viewport.cache.clear();

            // Re-adjust SVG
            this.viewport.adjustSVGForMobile(
                this.renderer.elements.svg,
                this.renderer.elements.mainGroup
            );

            // Handle viewport changes (repositions magnifying ring and updates focus items)
            this.renderer.handleViewportChange();

        } catch (error) {
            Logger.error('Error handling resize:', error);
        }
    }

    setupTouchRotation(focusItems) {
        // Clean up existing touch handler
        if (this.touchHandler) {
            this.touchHandler.deactivate();
        }

        // Create new touch handler (revert to original)
        this.touchHandler = new TouchRotationHandler(
            (offset) => this.renderer.updateFocusRingPositions(offset),
            (offset) => this.handleRotationEnd(offset)
        );

        // Calculate rotation limits
        const limits = this.calculateRotationLimits(focusItems);
        this.touchHandler.setRotationLimits(limits.min, limits.max);

        // Set initial rotation offset if renderer has calculated one
        if (this.renderer.initialRotationOffset !== undefined) {
            this.touchHandler.rotationOffset = this.renderer.initialRotationOffset;
            Logger.debug(`Set initial touch rotation offset: ${this.renderer.initialRotationOffset * 180 / Math.PI}°`);
        }

        // Activate touch handling
        this.touchHandler.activate();

        Logger.debug('Touch rotation setup complete');
    }

    showAllFocusItems() {
        // Hide top-level selection interface
        const topLevelGroup = this.renderer.elements.topLevelGroup;
        if (topLevelGroup) {
            topLevelGroup.classList.add('hidden');
        }

        // Get all focus items from the third hierarchy level
        let allFocusItems = this.dataManager.getAllInitialFocusItems();
        Logger.debug(`Loaded ${allFocusItems.length} focus items from all top-level groups`);

        if (allFocusItems.length === 0) {
            Logger.warn('No focus items found in any top-level group');
            return;
        }

        // Set current focus items and show them
        this.renderer.currentFocusItems = allFocusItems;
        this.renderer.showFocusRing();

        // Set up touch rotation
        this.setupTouchRotation(allFocusItems);
    }

    calculateRotationLimits(focusItems) {
        // For viewport filtering approach, calculate limits based on actual item count
        if (!focusItems.length) {
            return { min: -Infinity, max: Infinity };
        }

        // Calculate total arc needed for all items
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const totalArc = (focusItems.length - 1) * angleStep; // Total span from first to last item
        const halfArc = totalArc / 2;

        // Add buffer for comfortable rotation (25% extra on each side)
        const buffer = halfArc * 0.25;
        const maxRotation = halfArc + buffer;

        Logger.debug(`Calculated rotation limits: ${focusItems.length} items × ${angleStep * 180 / Math.PI}° spacing = ${totalArc * 180 / Math.PI}° total arc, limits ±${maxRotation * 180 / Math.PI}°`);

        return { min: -maxRotation, max: maxRotation };
    }

    handleRotationEnd(offset) {
        // Notify renderer that rotation has ended - triggers child item display
        this.renderer.onRotationEnd();

        // Validate input offset
        if (isNaN(offset)) {
            Logger.error(`Invalid offset in handleRotationEnd: ${offset}`);
            return;
        }

        // Snap to nearest focus item (restore original snapping behavior)
        if (!this.renderer.allFocusItems.length) return;

        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const focusItems = this.renderer.allFocusItems;
        const middleIndex = (focusItems.length - 1) / 2;

        // Validate angleStep
        if (isNaN(angleStep)) {
            Logger.error(`Invalid angleStep: ${angleStep}`);
            return;
        }

        // Find the focus item that should be centered with this offset
        const targetIndex = Math.round(middleIndex + (offset / angleStep));
        const clampedIndex = Math.max(0, Math.min(focusItems.length - 1, targetIndex));

        // Calculate the exact offset needed to center this focus item
        const targetOffset = (clampedIndex - middleIndex) * angleStep;

        // Apply rotation limits (match the limits from calculateRotationLimits)
        const limits = this.calculateRotationLimits(focusItems);
        const finalOffset = Math.max(limits.min, Math.min(limits.max, targetOffset));

        // Validate calculated targetOffset
        if (isNaN(finalOffset)) {
            Logger.error(`Invalid targetOffset calculation: clampedIndex=${clampedIndex}, middleIndex=${middleIndex}, angleStep=${angleStep}`);
            return;
        }

        // Animate to the target offset (snap behavior)
        this.animateRotationTo(finalOffset);

        // Safe logging with bounds checking
        if (focusItems[clampedIndex] && focusItems[clampedIndex].name) {
            Logger.debug(`Snapping to focus item ${clampedIndex}: ${focusItems[clampedIndex].name}`);
        } else {
            Logger.debug(`Snapping to focus item index ${clampedIndex} (name unavailable)`);
        }
    }

    animateRotationTo(targetOffset) {
        if (!this.touchHandler) return;

        const startOffset = this.touchHandler.rotationOffset;

        // Validate inputs
        if (isNaN(targetOffset)) {
            Logger.error(`Invalid targetOffset for animation: ${targetOffset}`);
            return;
        }
        if (isNaN(startOffset)) {
            Logger.error(`Invalid startOffset for animation: ${startOffset}`);
            this.touchHandler.rotationOffset = 0; // Reset to safe value
            return;
        }

        const deltaOffset = targetOffset - startOffset;
        const duration = 300;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out animation
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentOffset = startOffset + deltaOffset * easedProgress;

            // Validate calculated offset
            if (isNaN(currentOffset)) {
                Logger.error(`Animation produced NaN offset: startOffset=${startOffset}, deltaOffset=${deltaOffset}, easedProgress=${easedProgress}`);
                return; // Stop animation
            }

            this.touchHandler.rotationOffset = currentOffset;
            this.renderer.updateFocusRingPositions(currentOffset);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    setupParentButtonHandler() {
        const parentButton = document.getElementById('parentButton');
        if (!parentButton) {
            Logger.warn('Parent button not found in DOM');
            return;
        }
        
        // Add click handler for parent button
        parentButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if in volume selector mode
            if (parentButton.getAttribute('data-volume-selector-mode') === 'true') {
                this.handleExploreButtonClick();
            } else {
                this.handleParentButtonClick();
            }
        });
        
        Logger.debug('Parent button click handler initialized');
    }
    
    handleExploreButtonClick() {
        Logger.debug('📖 Explore button clicked in volume selector');
        
        // Find the centered volume (tracked by rotation handler)
        const volumes = this.dataManager.availableVolumes;
        if (!volumes.length) return;
        
        // Use the stored centered volume index, or default to middle
        const centerIndex = this.centeredVolumeIndex !== undefined 
            ? this.centeredVolumeIndex 
            : Math.floor((volumes.length - 1) / 2);
        
        const selectedVolume = volumes[centerIndex];
        
        Logger.debug(`📖 Loading centered volume: ${selectedVolume.name} (index ${centerIndex})`);
        this.loadSelectedVolume(selectedVolume);
    }
    
    handleParentButtonClick() {
        Logger.debug('🔼 Parent button clicked - migrating OUT toward root');

        // Always collapse Detail Sector first to reset state and reveal Child Pyramid
        this.renderer.collapseDetailSector();

        if (!this.renderer.selectedFocusItem) {
            Logger.warn('No focus item selected for parent navigation');
            return;
        }

        const currentFocus = this.renderer.selectedFocusItem;
        const currentLevel = this.renderer.getItemHierarchyLevel(currentFocus);
        if (!currentLevel) {
            Logger.warn('🔼 Could not determine hierarchy level for current focus item');
            return;
        }

        if (this.renderer.isLeafItem(currentFocus)) {
            this.renderer.collapseDetailSector();
        }

        const parentLevel = this.renderer.getPreviousHierarchyLevel(currentLevel);
        
        // If no parent level exists, we're at second-from-top level
        // Navigate to top level (the start point)
        if (!parentLevel) {
            Logger.debug('🔼 At second level - navigating OUT to top level');
            
            // Get top level items
            const topLevelItems = this.renderer.getTopLevelItems();
            if (!topLevelItems || !topLevelItems.length) {
                Logger.warn('🔼 No top level items available');
                this.renderer.updateParentButton(null);
                return;
            }
            
            // Find which top-level item is the parent of current focus
            const topLevelParentKey = currentFocus.__path && currentFocus.__path.length > 0 
                ? currentFocus.__path[0] 
                : null;
            
            const selectedTopLevel = topLevelParentKey 
                ? topLevelItems.find(item => item.key === topLevelParentKey) || topLevelItems[0]
                : topLevelItems[0];
            
            Logger.debug(`🔼 Showing top level: ${topLevelItems.length} items, selected: ${selectedTopLevel.name || selectedTopLevel.key}`);
            
            // Update Focus Ring with top level items
            this.renderer.currentFocusItems = topLevelItems;
            this.renderer.allFocusItems = topLevelItems;
            
            const topLevelIndex = this.renderer.findItemIndexInArray(selectedTopLevel, topLevelItems, this.renderer.getHierarchyLevelNames()[0]);
            const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
            const middleIndex = (topLevelItems.length - 1) / 2;
            const centerOffset = topLevelIndex >= 0 ? (topLevelIndex - middleIndex) * angleStep : 0;
            
            Logger.debug(`🔼 Top level index: ${topLevelIndex}, centerOffset: ${centerOffset}`);
            
            // Hide child pyramid
            if (this.renderer.elements.childRingGroup) {
                this.renderer.elements.childRingGroup.classList.add('hidden');
            }
            this.renderer.clearFanLines();
            
            // Setup rotation for top level
            this.setupTouchRotation(topLevelItems);
            if (this.touchHandler) {
                this.touchHandler.rotationOffset = centerOffset;
            }
            
            // Update display
            if (this.renderer.settleTimeout) {
                clearTimeout(this.renderer.settleTimeout);
                this.renderer.settleTimeout = null;
            }
            
            this.renderer.updateFocusRingPositions(centerOffset);
            this.renderer.lastRotationOffset = centerOffset;
            this.renderer.selectedFocusItem = selectedTopLevel;
            this.renderer.activeType = this.renderer.getHierarchyLevelNames()[0];
            this.renderer.buildActivePath(selectedTopLevel);
            this.renderer.isRotating = false;
            
            // At top level, hide parent button
            this.renderer.updateParentButton(null);
            
            Logger.debug(`🔼 Reached top level - Parent Button hidden, showing ${topLevelItems.length} top-level items`);
            return;
        }

        Logger.debug(`🔼 Navigating from ${currentLevel} to parent level ${parentLevel}`);

        const parentItem = this.renderer.buildParentItemFromChild(currentFocus, parentLevel);
        if (!parentItem || !parentItem.key) {
            Logger.warn('🔼 Unable to build parent item from current focus selection');
            return;
        }

        const grandParentLevel = this.renderer.getPreviousHierarchyLevel(parentLevel);
        let parentSiblings = [];

        if (grandParentLevel) {
            const grandParentItem = this.renderer.buildParentItemFromChild(parentItem, grandParentLevel);
            parentSiblings = this.renderer.getChildItemsForLevel(grandParentItem, parentLevel) || [];
        } else if (typeof this.renderer.getTopLevelItems === 'function') {
            parentSiblings = this.renderer.getTopLevelItems();
        }

        if (!parentSiblings.length) {
            Logger.warn(`🔼 No items found at parent level '${parentLevel}' for parent navigation`);
            return;
        }

        const selectedParent = parentSiblings.find(item => item.key === parentItem.key) || parentSiblings[0];
        if (!selectedParent) {
            Logger.warn('🔼 Parent level item not found among siblings');
            return;
        }

        Logger.debug(`🔼 Parent siblings count: ${parentSiblings.length}, selected parent: ${selectedParent.name || selectedParent.key}`);

        this.renderer.currentFocusItems = parentSiblings;
        this.renderer.allFocusItems = parentSiblings;

        const parentIndex = this.renderer.findItemIndexInArray(selectedParent, parentSiblings, parentLevel);
        if (parentIndex === -1) {
            Logger.warn('🔼 Could not locate selected parent in siblings array; defaulting to first position');
        }
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (parentSiblings.length - 1) / 2;
        const centerOffset = parentIndex >= 0 ? (parentIndex - middleIndex) * angleStep : 0;

        Logger.debug(`🔼 Parent index: ${parentIndex}, centerOffset: ${centerOffset}`);

        if (this.renderer.elements.childRingGroup) {
            this.renderer.elements.childRingGroup.classList.add('hidden');
        }
        this.renderer.clearFanLines();

        this.setupTouchRotation(parentSiblings);
        if (this.touchHandler) {
            this.touchHandler.rotationOffset = centerOffset;
        }

        if (this.renderer.settleTimeout) {
            clearTimeout(this.renderer.settleTimeout);
            this.renderer.settleTimeout = null;
        }

        this.renderer.updateFocusRingPositions(centerOffset);
        if (this.renderer.settleTimeout) {
            clearTimeout(this.renderer.settleTimeout);
            this.renderer.settleTimeout = null;
        }
        this.renderer.lastRotationOffset = centerOffset;
        this.renderer.selectedFocusItem = selectedParent;
        this.renderer.activeType = parentLevel;
        this.renderer.buildActivePath(selectedParent);
        this.renderer.isRotating = false;

        const centerAngle = this.renderer.viewport.getCenterAngle();
        const adjustedCenterAngle = centerAngle + centerOffset;
        const selectedAngle = parentIndex >= 0
            ? adjustedCenterAngle + (middleIndex - parentIndex) * angleStep
            : adjustedCenterAngle;

        this.renderer.showChildContentForFocusItem(selectedParent, selectedAngle);

        const grandParentName = grandParentLevel
            ? this.renderer.getParentNameForLevel(selectedParent, grandParentLevel)
            : null;
        Logger.debug(`🔼 Updating Parent Button label to: ${grandParentName || 'none'} (grandparent level: ${grandParentLevel || 'top'})`);
        this.renderer.updateParentButton(grandParentName);

        Logger.debug(`🔼 Parent navigation complete - Focus Ring now shows ${parentSiblings.length} ${parentLevel}s`);
    }

    reset() {
        Logger.debug('Resetting mobile volume');

        // Deactivate touch handling
        if (this.touchHandler) {
            this.touchHandler.deactivate();
            this.touchHandler = null;
        }

        // Reset renderer
        this.renderer.reset();
    }
}

// Global app instance
let mobileCatalogApp = null;

/**
 * Initialize the mobile volume application
 */
async function initMobileCatalog() {
    try {
        Logger.debug('Starting mobile volume initialization...');

        mobileCatalogApp = new MobileCatalogApp();
        await mobileCatalogApp.init();

        // Make app globally available
        window.mobileCatalogApp = mobileCatalogApp;

        // Set up global error handling
        window.addEventListener('error', (event) => {
            Logger.error('Global error:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            Logger.error('Unhandled promise rejection:', event.reason);
        });

    } catch (error) {
        Logger.error('Failed to initialize mobile volume:', error);
    }
}

export { MobileCatalogApp, initMobileCatalog, mobileCatalogApp };