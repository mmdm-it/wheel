/**
 * Mobile Volume Application
 * Main coordinator class and initialization logic
 */

import { MOBILE_CONFIG, VERSION } from './mobile-config.js';
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
                
                // Create volume object for loadSelectedVolume
                const volumeInfo = {
                    filename: volumeParam,
                    name: volumeParam.replace('.json', ''),
                    schemaVersion: 'unknown',
                    dataVersion: 'unknown'
                };
                await this.loadSelectedVolume(volumeInfo);
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
     * Volume selector for development mode
     */
    showSimpleVolumeSelector(volumes) {
        this.volumeSelectorMode = true;
        
        // Hide SVG and parent button
        const svg = document.getElementById('catalogSvg');
        const copyright = document.getElementById('copyright');
        const parentButtonGroup = document.getElementById('parentButtonGroup');
        const parentNodeCircle = document.getElementById('parentNodeCircle');
        
        if (svg) svg.style.display = 'none';
        if (parentButtonGroup) parentButtonGroup.style.display = 'none';
        if (parentNodeCircle) parentNodeCircle.style.display = 'none';
        
        // Create simple HTML selector
        const selectorDiv = document.createElement('div');
        selectorDiv.id = 'volumeSelector';
        selectorDiv.style.cssText = 'font-family: monospace; padding: 20px; max-width: 600px; margin: 0 auto; position: relative; z-index: 9999; background: #868686;';
        
        const versionString = this.getVersion();
        Logger.debug(`🔢 Version string: ${versionString}`);
        
        let html = '<h1 style="font-size: 18px; margin-bottom: 10px; color: black;">Caricatore di Volumi Wheel (Solo Dev)</h1>';
        html += '<p style="color: black; font-size: 12px; margin-bottom: 20px;">Seleziona Volume:</p>';
        html += '<ul style="list-style: none; padding: 0;">';
        
        volumes.forEach((volume, index) => {
            html += `<li style="margin-bottom: 10px;">`;
            html += `<a href="#" data-volume-index="${index}" style="display: block; padding: 10px; background: white; text-decoration: none; color: #333; border-radius: 4px;">`;
            html += `<strong>${volume.name}</strong><br>`;
            html += `<span style="font-size: 11px; color: #666;">${volume.filename}</span><br>`;
            html += `<span style="font-size: 10px; color: #999;">Schema: ${volume.schemaVersion} | Data: ${volume.dataVersion}</span>`;
            html += `</a></li>`;
        });
        
        html += '</ul>';
        
        Logger.debug(`🔢 About to add version paragraph with: ${versionString}`);
        html += `<p style="color: black; font-size: 11px; margin-top: 20px;">`;
        html += `Versione: ${versionString}</p>`;
        
        Logger.debug(`🔢 Full HTML length: ${html.length}`);
        Logger.debug(`🔢 HTML snippet (last 200 chars): ${html.slice(-200)}`);
        
        selectorDiv.innerHTML = html;
        Logger.debug(`🔢 selectorDiv innerHTML set, length: ${selectorDiv.innerHTML.length}`);
        
        document.body.appendChild(selectorDiv);
        Logger.debug(`🔢 selectorDiv appended to body`);
        
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
            Logger.debug('🔢 Getting version, VERSION object:', VERSION);
            const result = VERSION ? VERSION.display() : 'unknown';
            Logger.debug('🔢 Version result:', result);
            return result;
        } catch (e) {
            Logger.error('🔢 Error getting version:', e);
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
            
            // Create Detail Sector circle after data is loaded (so config is available)
            this.renderer.createDetailSectorCircle();
            
            // Apply color scheme from the volume
            this.applyColorScheme();
            
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

    /**
     * Apply the color scheme from the loaded volume
     */
    applyColorScheme() {
        const colorScheme = this.renderer.getColorScheme();
        
        // Apply background color
        document.body.style.backgroundColor = colorScheme.background;
        
        // Update Parent Button circle color
        const parentNodeCircle = document.getElementById('parentNodeCircle');
        if (parentNodeCircle) {
            parentNodeCircle.setAttribute('fill', colorScheme.nodes);
        }
        
        Logger.debug('🎨 Applied color scheme:', colorScheme);
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
        console.log('🎯🚀 animateRotationTo START', { targetOffset });
        if (!this.touchHandler) {
            console.log('🎯❌ No touchHandler - aborting animation');
            return;
        }

        const startOffset = this.touchHandler.rotationOffset;
        console.log('🎯📍 Animation params:', { startOffset, targetOffset, delta: targetOffset - startOffset });

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
            } else {
                // Animation complete - trigger Child Pyramid update
                console.log('🎯✅ animateRotationTo COMPLETE - calling triggerFocusSettlement');
                Logger.debug('🎯 animateRotationTo complete - triggering settle for Child Pyramid');
                this.renderer.triggerFocusSettlement();
            }
        };

        requestAnimationFrame(animate);
    }

    setupParentButtonHandler() {
        const parentButtonGroup = document.getElementById('parentButtonGroup');
        if (!parentButtonGroup) {
            Logger.warn('Parent button group not found in DOM');
            return;
        }
        
        // Add click handler for parent button
        parentButtonGroup.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if button is disabled
            if (parentButtonGroup.getAttribute('data-disabled') === 'true') {
                Logger.debug('🔼 Parent button click ignored - at top navigation level');
                return;
            }
            
            // Check if in volume selector mode
            if (parentButtonGroup.getAttribute('data-volume-selector-mode') === 'true') {
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
        
        // CRITICAL: Capture Focus Ring DOM nodes at the VERY START before any operations
        // Focus Ring nodes have class 'focusItem', not 'nzone-circle'
        const focusRingNodes = this.renderer.elements.focusRingGroup.querySelectorAll('.focusItem');
        const currentFocusItems = [...this.renderer.currentFocusItems];
        console.log('🔼🔼🔼 CAPTURED at start:', focusRingNodes.length, 'DOM nodes,', currentFocusItems.length, 'data items');
        
        // Clone the DOM nodes immediately for later animation
        const clonedNodes = Array.from(focusRingNodes).map((node, index) => {
            const transform = node.getAttribute('transform');
            const circle = node.querySelector('circle');
            const text = node.querySelector('text');
            const radius = circle ? circle.getAttribute('r') : 'N/A';
            const textTransform = text ? text.getAttribute('transform') : 'N/A';
            
            console.log(`🔼📸 Clone[${index}] ${currentFocusItems[index]?.name || 'unknown'}:`);
            console.log(`    transform="${transform}"`);
            console.log(`    radius=${radius}`);
            console.log(`    textTransform="${textTransform}"`);
            
            return {
                clone: node.cloneNode(true),
                transform: transform,
                itemKey: currentFocusItems[index]?.key,
                itemName: currentFocusItems[index]?.name
            };
        });
        console.log('🔼🔼🔼 CLONED:', clonedNodes.length, 'nodes with full metadata');
        
        // Log circle state before any operations
        const parentNodeCircle = document.getElementById('parentNodeCircle');
        if (parentNodeCircle) {
            const circleStyle = window.getComputedStyle(parentNodeCircle);
            console.log('🔼🔼🔼 BEFORE Parent Button click - Circle state:', {
                opacity: parentNodeCircle.getAttribute('opacity'),
                computedOpacity: circleStyle.opacity,
                fill: parentNodeCircle.getAttribute('fill'),
                classes: parentNodeCircle.classList.toString()
            });
        }

        // Always collapse Detail Sector first to reset state and reveal Child Pyramid
        this.renderer.collapseDetailSector();

        if (!this.renderer.selectedFocusItem) {
            Logger.warn('🔼❌ No focus item selected for parent navigation');
            return;
        }

        Logger.debug(`🔼✓ Current selectedFocusItem: ${this.renderer.selectedFocusItem.name}, key: ${this.renderer.selectedFocusItem.key}`);

        const currentFocus = this.renderer.selectedFocusItem;
        const currentLevel = this.renderer.getItemHierarchyLevel(currentFocus);
        if (!currentLevel) {
            Logger.warn('🔼❌ Could not determine hierarchy level for current focus item');
            return;
        }

        Logger.debug(`🔼✓ Current level: ${currentLevel}`);

        // Check if we're at the top navigation level - if so, don't allow OUT migration
        const displayConfig = this.dataManager.getDisplayConfig();
        const topNavLevel = displayConfig?.focus_ring_startup?.top_navigation_level;
        if (topNavLevel && currentLevel === topNavLevel) {
            Logger.debug(`🔼 Already at top navigation level (${topNavLevel}) - Parent Button should not trigger OUT migration`);
            return;
        }

        if (this.renderer.isLeafItem(currentFocus)) {
            Logger.debug('🔼 Is leaf item - Detail Sector already collapsed');
        }

        // For items with __path metadata, use the actual parent level from __path
        // (this handles cases where hierarchy levels are skipped, e.g., Lockwood-Ash has no family/subfamily)
        let parentLevel;
        
        if (currentFocus.__path && currentFocus.__path.length >= 2) {
            // The parent is at __path.length - 2 (second-to-last in path)
            // Map this back to the hierarchy level name
            const levelNames = this.renderer.getHierarchyLevelNames();
            const parentDepth = currentFocus.__path.length - 2; // 0-indexed depth of parent
            
            if (parentDepth >= 0 && parentDepth < levelNames.length) {
                parentLevel = levelNames[parentDepth];
                Logger.debug(`🔼 Using actual parent from __path: depth ${parentDepth} (${currentFocus.__path[parentDepth]}), level ${parentLevel}`);
            }
        }
        
        // Fallback to getPreviousHierarchyLevel if __path not available
        if (!parentLevel) {
            Logger.debug('🔼 No __path found, using getPreviousHierarchyLevel');
            parentLevel = this.renderer.getPreviousHierarchyLevel(currentLevel);
        }
        
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
            // The top level is at depth 0 in the hierarchy, so extract __path[0]
            const topLevelParentName = currentFocus.__path && currentFocus.__path.length > 0 
                ? currentFocus.__path[0] 
                : null;
            
            console.log('🔼🔍 OUT MIGRATION DIAGNOSIS:');
            console.log('  Current focus item:', currentFocus.name, '| key:', currentFocus.key);
            console.log('  Current focus __path:', currentFocus.__path);
            console.log('  Extracted parent name from __path[0]:', topLevelParentName);
            console.log('  Top level items (first 5):', topLevelItems.slice(0, 5).map(i => `${i.name}(${i.key}, sort:${i.sort_number})`));
            
            const selectedTopLevel = topLevelParentName 
                ? topLevelItems.find(item => item.name === topLevelParentName) || topLevelItems[0]
                : topLevelItems[0];
            
            console.log('  Selected top level item:', selectedTopLevel.name, '| key:', selectedTopLevel.key, '| sort_number:', selectedTopLevel.sort_number);
            
            Logger.debug(`🔼 Showing top level: ${topLevelItems.length} items, selected: ${selectedTopLevel.name || selectedTopLevel.key}`);
            
            // Update Focus Ring with top level items
            this.renderer.currentFocusItems = topLevelItems;
            this.renderer.allFocusItems = topLevelItems;
            
            const topLevelIndex = this.renderer.findItemIndexInArray(selectedTopLevel, topLevelItems, this.renderer.getHierarchyLevelNames()[0]);
            const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
            const middleIndex = (topLevelItems.length - 1) / 2;
            const centerOffset = topLevelIndex >= 0 ? (topLevelIndex - middleIndex) * angleStep : 0;
            
            console.log('  Found index in array:', topLevelIndex, '| middleIndex:', middleIndex, '| centerOffset:', centerOffset);
            console.log('🔼🔍 END DIAGNOSIS\n');
            
            Logger.debug(`🔼 Top level index: ${topLevelIndex}, centerOffset: ${centerOffset}`);
            
            console.log('🔼🔼 CAPTURED for OUT animation (top nav):', clonedNodes.length, 'items');
            
            // OUT MIGRATION ANIMATION for top nav level (Stage 2 + Stage 4)
            console.log('🔼🔼 STARTING OUT ANIMATION (top nav)');
            
            // Stage 4: Animate Parent Button content to Magnifier (OUT migration)
            const parentItem = currentFocus.__path && currentFocus.__path.length > 0 
                ? { name: currentFocus.__path[0] }
                : { name: 'Parent' };
            this.renderer.animation.animateParentButtonToMagnifier(parentItem);
            
            // Hide current Child Pyramid before OUT animation (prevents duplicate display)
            this.renderer.childPyramid.hide();
            this.renderer.clearFanLines();
            
            this.isAnimating = true;
            
            // Stage 2: Animate Focus Ring to Child Pyramid (OUT migration)
            this.renderer.animateFocusRingToChildPyramid(currentFocusItems, clonedNodes, () => {
                console.log('🔼🔼 OUT animation complete (top nav)');
                console.log('🔼🔼 Child Pyramid will be shown by updateFocusRingPositions()');
                
                // Clear fan lines during transition
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
                
                console.log('🔼🔼 About to call updateFocusRingPositions - NEW NODES WILL APPEAR');
                // Set lastRotationOffset BEFORE updateFocusRingPositions
                this.renderer.lastRotationOffset = centerOffset;
                // Force immediate settlement
                this.renderer.forceImmediateFocusSettlement = true;
                this.renderer.updateFocusRingPositions(centerOffset);
                this.renderer.forceImmediateFocusSettlement = false;
                console.log('🔼🔼 updateFocusRingPositions complete');
                
                this.renderer.selectedFocusItem = selectedTopLevel;
                this.renderer.activeType = this.renderer.getHierarchyLevelNames()[0];
                this.renderer.buildActivePath(selectedTopLevel);
                this.renderer.isRotating = false;
                this.isAnimating = false;
                
                // At top level, hide parent button
                this.renderer.updateParentButton(null);
                
                Logger.debug(`🔼 Reached top level - Parent Button hidden, showing ${topLevelItems.length} top-level items`);
            });
            return;
        }

        Logger.debug(`🔼 Navigating from ${currentLevel} to parent level ${parentLevel}`);

        // Special case: If navigating TO the top navigation level, show all top-level items
        if (topNavLevel && parentLevel === topNavLevel) {
            Logger.debug(`🔼 Navigating to top navigation level (${topNavLevel}) - showing all items`);
            
            const topLevelItems = this.dataManager.getAllInitialFocusItems();
            if (!topLevelItems || !topLevelItems.length) {
                Logger.warn('🔼 No top level items available');
                this.renderer.updateParentButton(null);
                return;
            }
            
            // Find which top-level item should be selected (the ancestor in path)
            // Need to extract the name at the correct depth in the hierarchy
            const levelNames = this.renderer.getHierarchyLevelNames();
            const topNavDepth = levelNames.indexOf(topNavLevel);
            
            const topLevelParentName = currentFocus.__path && currentFocus.__path.length > topNavDepth
                ? currentFocus.__path[topNavDepth]
                : null;
            
            console.log('🔼🔍 OUT MIGRATION TO TOP NAV LEVEL DIAGNOSIS:');
            console.log('  Current focus item:', currentFocus.name, '| key:', currentFocus.key);
            console.log('  Current focus __path:', currentFocus.__path);
            console.log('  Top nav level:', topNavLevel, '| depth:', topNavDepth);
            console.log('  Extracted parent name from __path[' + topNavDepth + ']:', topLevelParentName);
            console.log('  Top level items (first 5):', topLevelItems.slice(0, 5).map(i => `${i.name}(${i.key}, sort:${i.sort_number})`));
            
            const selectedTopLevel = topLevelParentName 
                ? topLevelItems.find(item => item.name === topLevelParentName) || topLevelItems[0]
                : topLevelItems[0];
            
            console.log('  Selected top level item:', selectedTopLevel.name, '| key:', selectedTopLevel.key, '| sort_number:', selectedTopLevel.sort_number);
            
            Logger.debug(`🔼 Showing all top level: ${topLevelItems.length} items, selected: ${selectedTopLevel.name || selectedTopLevel.key}`);
            
            // Capture current Focus Ring items BEFORE updating state
            const currentFocusRingItems = [...this.renderer.currentFocusItems];
            console.log('🔼🔼 CAPTURED for OUT animation (top nav):', currentFocusRingItems.length, 'items');
            
            // Update Focus Ring with all top level items
            this.renderer.currentFocusItems = topLevelItems;
            this.renderer.allFocusItems = topLevelItems;
            
            const topLevelIndex = this.renderer.findItemIndexInArray(selectedTopLevel, topLevelItems, topNavLevel);
            const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
            const middleIndex = (topLevelItems.length - 1) / 2;
            const centerOffset = topLevelIndex >= 0 ? (topLevelIndex - middleIndex) * angleStep : 0;
            
            console.log('  Found index in array:', topLevelIndex, '| middleIndex:', middleIndex, '| centerOffset:', centerOffset);
            console.log('🔼🔍 END DIAGNOSIS\n');
            
            Logger.debug(`🔼 Top level index: ${topLevelIndex}, centerOffset: ${centerOffset}`);
            
            // OUT MIGRATION ANIMATION for top nav level (Stage 2 + Stage 4)
            console.log('🔼🔼 STARTING OUT ANIMATION (top nav)');
            
            // Stage 4: Animate Parent Button content to Magnifier (OUT migration)
            const parentItem = this.renderer.buildParentItemFromChild(currentFocus, parentLevel);
            this.renderer.animation.animateParentButtonToMagnifier(parentItem);
            
            // Hide current Child Pyramid before OUT animation (prevents duplicate display)
            this.renderer.childPyramid.hide();
            this.renderer.clearFanLines();
            
            this.isAnimating = true;
            
            // Stage 2: Animate Focus Ring to Child Pyramid (OUT migration)
            this.renderer.animateFocusRingToChildPyramid(currentFocusRingItems, clonedNodes, () => {
                console.log('🔼🔼 OUT animation complete (top nav)');
                
                // DO NOT manually call showChildPyramid() here - updateFocusRingPositions() will handle it
                // with forceImmediateFocusSettlement flag ensuring immediate display
                console.log('🔼🔼 Child Pyramid will be shown by updateFocusRingPositions()');
                
                // Clear fan lines during transition
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
            
            console.log('🔼🔼 About to call updateFocusRingPositions - NEW NODES WILL APPEAR');
            // Set lastRotationOffset BEFORE updateFocusRingPositions to prevent Child Pyramid hiding
            this.renderer.lastRotationOffset = centerOffset;
            // Force immediate settlement to prevent Child Pyramid hiding during updateFocusRingPositions
            this.renderer.forceImmediateFocusSettlement = true;
            this.renderer.updateFocusRingPositions(centerOffset);
            this.renderer.forceImmediateFocusSettlement = false; // Reset flag
            console.log('🔼🔼 updateFocusRingPositions complete');
            this.renderer.selectedFocusItem = selectedTopLevel;
            this.renderer.activeType = topNavLevel;
            this.renderer.buildActivePath(selectedTopLevel);
            this.renderer.isRotating = false;
            
                // At top level, hide parent button (will be re-shown as disabled)
                const parentName = this.renderer.getParentNameForLevel(selectedTopLevel, topNavLevel);
                this.renderer.updateParentButton(parentName);
                
                this.isAnimating = false;
                Logger.debug(`🔼 Reached top navigation level - showing ${topLevelItems.length} items`);
            });
            return;
        }

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

        // Capture current Focus Ring items BEFORE updating state
        const currentFocusRingItems = [...this.renderer.currentFocusItems];
        console.log('🔼🔼 CAPTURED for OUT animation (general parent nav):', currentFocusRingItems.length, 'items');

        // Update Focus Ring with parent level items
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

        // Hide current Child Pyramid before OUT animation to prevent duplicates
        console.log('🔼🔼 Hiding current Child Pyramid before OUT animation');
        this.renderer.elements.childRingGroup.classList.add('hidden');
        this.renderer.clearFanLines();

        // Prepare the Child Pyramid data for the parent level (will show AFTER animation)
        console.log('🔼🔼 Preparing Child Pyramid for parent level (to show after OUT animation)');
        const childLevel = this.renderer.getNextHierarchyLevel(parentLevel);
        const childItems = this.renderer.getChildItemsForLevel(selectedParent, childLevel);
        console.log('🔼🔼 Child items for Child Pyramid:', childItems?.length || 0, childLevel);

        // OUT MIGRATION ANIMATION (Stage 2 + Stage 4)
        console.log('🔼🔼 STARTING OUT ANIMATION (general parent nav)');
        this.isAnimating = true;

        // Stage 4: Animate Parent Button content to Magnifier (OUT migration)
        const parentItemForAnimation = this.renderer.buildParentItemFromChild(currentFocus, parentLevel);
        this.renderer.animation.animateParentButtonToMagnifier(parentItemForAnimation);

        // Stage 2: Animate Focus Ring to Child Pyramid (OUT migration)
        this.renderer.animateFocusRingToChildPyramid(currentFocusRingItems, clonedNodes, () => {
            console.log('🔼🔼 OUT animation complete (general parent nav)');

            // NOW show the Child Pyramid for the parent level AFTER OUT animation
            if (childItems && childItems.length > 0) {
                console.log('🔼🔼 NOW showing Child Pyramid AFTER OUT animation');
                this.renderer.childPyramid.showChildPyramid(childItems, selectedParent);
                console.log('🔼🔼 Child Pyramid now showing', childItems.length, 'items');
            }

            // Clear fan lines (will be redrawn by showChildContentForFocusItem)
            this.renderer.clearFanLines();

            this.setupTouchRotation(parentSiblings);
            if (this.touchHandler) {
                this.touchHandler.rotationOffset = centerOffset;
            }

            if (this.renderer.settleTimeout) {
                clearTimeout(this.renderer.settleTimeout);
                this.renderer.settleTimeout = null;
            }

            console.log('🔼🔼 About to call updateFocusRingPositions - NEW NODES WILL APPEAR');
            this.renderer.updateFocusRingPositions(centerOffset);
            console.log('🔼🔼 updateFocusRingPositions complete');
            
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

            this.isAnimating = false;
            Logger.debug(`🔼 Parent navigation complete - Focus Ring now shows ${parentSiblings.length} ${parentLevel}s`);
        });
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