/**
 * FocusRingView
 * Encapsulates focus ring rendering, positioning, and text layout for the mobile catalog.
 */
import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';

class FocusRingView {
    constructor(renderer) {
        this.renderer = renderer;
        this.focusElements = new Map();
        this.positionCache = new Map();
        this.focusRingDebugAttached = false;
        this._lastFocusItemsKey = null;
        this.lastRotationOffset = undefined;
        this.protectedRotationOffset = undefined; // Protection period after immediate settlement
    }

    showFocusRing() {
        const r = this.renderer;
        console.log('🎯🎪 showFocusRing CALLED');
        const focusRingGroup = r.elements.focusRingGroup;
        focusRingGroup.classList.remove('hidden');
        focusRingGroup.innerHTML = '';
        this.attachFocusRingDebugLogging(focusRingGroup);

        // Create Focus Ring background band (visual nzone differentiation)
        this.createFocusRingBackground();

        // Create magnifier at correct position when focus items are shown
        r.createMagnifier();

        // Initialize viewport filtering state
        r.allFocusItems = r.currentFocusItems; // Set the complete list for filtering

        Logger.debug(`Viewport filtering initialized: ${r.allFocusItems.length} total focus items`);

        // BUGFIX: Only calculate initial rotation offset on first load (not during navigation)
        // During navigation, the calling code (continueChildPyramidClick) already calculated
        // the correct centerOffset and will call updateFocusRingPositions() after this returns
        if (!r.forceImmediateFocusSettlement) {
            // Initial app load - use startup config to determine which item to magnify
            const initialOffset = this.calculateInitialRotationOffset();
            Logger.debug(`Using initial rotation offset: ${initialOffset} radians (${initialOffset * 180 / Math.PI}°)`);

            this.updateFocusRingPositions(initialOffset);

            // Store the initial offset for the touch handler
            r.initialRotationOffset = initialOffset;
        } else {
            // Navigation - skip calculation, caller will position the ring
            Logger.debug('🎯 Skipping calculateInitialRotationOffset (forceImmediateFocusSettlement=true)');
        }
    }

    createFocusRingBackground() {
        const r = this.renderer;
        console.log('🎨 === CREATING FOCUS RING CENTERLINE ===');

        const arcParams = r.viewport.getArcParameters();
        console.log('🎨 arcParams:', arcParams);

        // Draw band between 99% and 101% of Focus Ring radius (narrower for larger radius)
        const hubX = arcParams.centerX;
        const hubY = arcParams.centerY;
        const innerRadius = arcParams.radius * 0.99;  // 99% of Focus Ring radius
        const outerRadius = arcParams.radius * 1.01;  // 101% of Focus Ring radius

        console.log(`🎨 Hub: (${hubX}, ${hubY})`);
        console.log(`🎨 Inner radius (99%): ${innerRadius}`);
        console.log(`🎨 Outer radius (101%): ${outerRadius}`);

        // Insert at beginning so nodes appear on top
        const focusRingGroup = r.elements.focusRingGroup;

        // Create annular ring (donut) filled with white
        const pathData = [
            // Outer circle (clockwise)
            `M ${hubX + outerRadius} ${hubY}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${hubX - outerRadius} ${hubY}`,
            `A ${outerRadius} ${outerRadius} 0 1 1 ${hubX + outerRadius} ${hubY}`,
            // Inner circle (counter-clockwise to create hole)
            `M ${hubX + innerRadius} ${hubY}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${hubX - innerRadius} ${hubY}`,
            `A ${innerRadius} ${innerRadius} 0 1 0 ${hubX + innerRadius} ${hubY}`,
            `Z`
        ].join(' ');

        const path = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', '#7a7979ff');  // Slightly darker gray than background
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('id', 'focusRingBackground');

        console.log('🎨 White band created');

        if (focusRingGroup.firstChild) {
            focusRingGroup.insertBefore(path, focusRingGroup.firstChild);
            console.log('🎨 Inserted before first child');
        } else {
            focusRingGroup.appendChild(path);
            console.log('🎨 Appended to empty group');
        }

        console.log('🎨 focusRingGroup children after:', focusRingGroup.children.length);
        console.log('🎨 === WHITE BAND COMPLETE ===');

        Logger.debug('Focus Ring darker gray background band created (98% to 102%)');
    }

    attachFocusRingDebugLogging(focusRingGroup) {
        const r = this.renderer;
        if (this.focusRingDebugAttached || !focusRingGroup) {
            return;
        }

        const logEvent = (event) => {
            const target = event.target;
            const classes = target?.getAttribute('class') || 'none';
            const tagName = target?.tagName || 'unknown';
            let pointerEvents = 'n/a';
            try {
                pointerEvents = window.getComputedStyle(target).pointerEvents;
            } catch (error) {
                // Ignore failures on SVG elements without computed style
            }

            console.log('🎯📡 FOCUS RING EVENT', {
                type: event.type,
                tagName,
                classes,
                pointerEvents,
                timestamp: performance.now().toFixed(2)
            });
        };

        const focusDebugOptions = { capture: true, passive: true };
        ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend'].forEach(type => {
            focusRingGroup.addEventListener(type, logEvent, focusDebugOptions);
        });

        this.focusRingDebugAttached = true;
        console.log('🎯📡 Focus Ring debug listeners attached');
    }

    calculateInitialRotationOffset() {
        const r = this.renderer;
        if (!r.currentFocusItems.length) return 0;

        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (r.currentFocusItems.length - 1) / 2;

        // Get startup configuration from volume - use correct property path
        const rootData = r.dataManager.data?.[r.dataManager.rootDataKey];
        const startupConfig = rootData?.display_config?.focus_ring_startup;

        Logger.info(`🎯 calculateInitialRotationOffset: ${r.currentFocusItems.length} focus items, middleIndex=${middleIndex}`);
        Logger.info(`🎯 Config: ${JSON.stringify(startupConfig)}`);

        // Debug: Log first 10 items with their sort_numbers
        Logger.info(`🎯 First 10 focus items:`);
        r.currentFocusItems.slice(0, 10).forEach((item, idx) => {
            const sortNum = item.data?.sort_number ?? item.sort_number;
            Logger.info(`   [${idx}] ${item.name} (sort_number: ${sortNum})`);
        });

        if (startupConfig && startupConfig.initial_magnified_item !== undefined) {
            // Find item with specified sort_number
            const targetSortNumber = startupConfig.initial_magnified_item;
            const targetIndex = r.currentFocusItems.findIndex(item => {
                const itemSortNumber = item.data?.sort_number ?? item.sort_number;
                return itemSortNumber === targetSortNumber;
            });

            Logger.info(`🎯 Looking for sort_number ${targetSortNumber}, found at index: ${targetIndex}`);

            if (targetIndex === -1) {
                const availableSortNumbers = r.currentFocusItems
                    .map(item => item.data?.sort_number ?? item.sort_number)
                    .filter(n => n !== undefined)
                    .sort((a, b) => a - b)
                    .join(', ');
                Logger.error(`❌ STARTUP ERROR: initial_magnified_item ${targetSortNumber} not found`);
                Logger.error(`   Available sort_numbers: ${availableSortNumbers}`);
                // Fallback to first item
                const offsetFallback = (0 - middleIndex) * angleStep;
                Logger.warn(`   Falling back to first item (index 0), offset = ${offsetFallback * 180 / Math.PI}°`);
                return offsetFallback;
            }

            // Calculate offset to center the target item under magnifier
            const offset = (targetIndex - middleIndex) * angleStep;
            Logger.info(`🎯 Startup: Magnifying item at sort_number ${targetSortNumber} (index ${targetIndex}), offset = ${offset * 180 / Math.PI}°`);
            Logger.info(`🎯 Item name: ${r.currentFocusItems[targetIndex].name}`);
            return offset;
        }

        // Fallback: no configuration specified
        Logger.warn(`⚠️ No focus_ring_startup configuration found - using first item`);
        const offset = (0 - middleIndex) * angleStep;
        return offset;
    }

    updateFocusRingPositions(rotationOffset) {
        const r = this.renderer;
        // PERFORMANCE: Reduce verbose logging during animation frames
        if (r.DEBUG_VERBOSE) {
            console.log(`🎯🔄 updateFocusRingPositions CALLED with rotationOffset=${rotationOffset?.toFixed(3) || 'undefined'}`);
            console.log(`🎯🔄 At start: currentFocusItems=${r.currentFocusItems?.length || 0}, allFocusItems=${r.allFocusItems?.length || 0}`);
        }

        const focusRingGroup = r.elements.focusRingGroup;

        // For sprocket chain: use all focus items but apply viewport filtering during rendering
        const allFocusItems = r.allFocusItems.length > 0 ? r.allFocusItems : r.currentFocusItems;
        if (!allFocusItems.length) return;

        // Validate rotationOffset
        if (isNaN(rotationOffset)) {
            Logger.error(`Invalid rotationOffset: ${rotationOffset}`);
            rotationOffset = 0; // Safe fallback
        }

        // Track rotation changes - hide Child Pyramid during rotation
        const programmaticFocus = r.forceImmediateFocusSettlement === true;
        const rotationTriggered = this.lastRotationOffset !== undefined && Math.abs(rotationOffset - this.lastRotationOffset) > 0.001;
        // Don't hide Child Pyramid if we're within the protection period after immediate settlement
        const isProtected = r.protectedRotationOffset !== undefined && Math.abs(rotationOffset - r.protectedRotationOffset) < 0.01;
        const isRotating = !programmaticFocus && !isProtected && rotationTriggered;

        if (isRotating) {
            const errorDivCount = document.querySelectorAll('.sort-number-error').length;
            if (errorDivCount > 0) {
                console.log('🔄 ROTATION DETECTED - Removing error divs:', errorDivCount);
            }
            r.focusRingDebug('🔄 Rotation detected - hiding Child Pyramid temporarily');

            // Hide Child Pyramid and fan lines during rotation
            r.elements.childRingGroup.classList.add('hidden');
            r.elements.detailItemsGroup.classList.add('hidden');
            r.clearFanLines();
            r.navigationView.clearParentLine();

            // Remove any sort number error messages
            const errorDivs = document.querySelectorAll('.sort-number-error');

            errorDivs.forEach(div => {
                console.log('🗑️ Removing error div:', div.textContent.substring(0, 50));
                div.remove();
            });
        }
        this.lastRotationOffset = rotationOffset;

        // PERFORMANCE OPTIMIZATION: Check if focus items changed - only rebuild if needed
        const focusItemsKey = allFocusItems.map(item => item === null ? 'GAP' : item.key).join('|');
        const focusItemsChanged = this._lastFocusItemsKey !== focusItemsKey;
        this._lastFocusItemsKey = focusItemsKey;

        // Always clear and rebuild during rotation to prevent ghosting
        // The optimization is for static state (same items, same position) only
        const shouldRebuild = focusItemsChanged || isRotating || rotationTriggered;

        // Ensure background band stays in DOM; we'll diff visible nodes instead of clearing all
        const background = focusRingGroup.querySelector('#focusRingBackground');
        if (background && !background.parentNode) {
            focusRingGroup.appendChild(background);
        }

        // Use updated angle calculation logic to maintain JSON order
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD; // Keep original 4.3° spacing
        const centerAngle = r.viewport.getCenterAngle();
        const adjustedCenterAngle = centerAngle + rotationOffset;
        const middleIndex = (allFocusItems.length - 1) / 2;

        // Validate centerAngle
        if (isNaN(centerAngle) || isNaN(adjustedCenterAngle)) {
            Logger.error(`Invalid angles: centerAngle=${centerAngle}, adjustedCenterAngle=${adjustedCenterAngle}`);
            return;
        }

        // Calculate arc parameters
        const arcParams = r.viewport.getArcParameters();
        let selectedFocusItem = null;
        let selectedIndex = -1;

        // Only log for Bible books
        const isBibleBooks = allFocusItems.length > 0 && allFocusItems[0].name?.startsWith('Liber_');

        if (isBibleBooks) {
            r.focusRingDebug(`📚 BIBLE BOOKS - Focus items order (${allFocusItems.length} items):`);
            allFocusItems.forEach((item, idx) => {
                const sortNum = item.data?.sort_number ?? item.sort_number ?? 'none';
                r.focusRingDebug(`  [${idx}] ${item.name} (sort_number: ${sortNum})`);
            });
            r.focusRingDebug(`🎯 Center angle: ${(centerAngle * 180 / Math.PI).toFixed(1)}°, Rotation offset: ${(rotationOffset * 180 / Math.PI).toFixed(1)}°`);
            r.focusRingDebug(`🎯 Adjusted center angle: ${(adjustedCenterAngle * 180 / Math.PI).toFixed(1)}°`);
        }

        // Process all focus items but only render those in viewport window (with small buffer)
        const visibleEntries = [];
        const viewportBuffer = angleStep * 2; // keep a small buffer to reduce pop-in

        allFocusItems.forEach((focusItem, index) => {
            // Skip gap entries (null values used for visual separation between cousin groups)
            if (focusItem === null) {
                return; // Don't render anything for gaps
            }

            // Validate sort_number
            const sortNumber = focusItem.data?.sort_number ?? focusItem.sort_number;
            if (sortNumber === undefined || sortNumber === null) {
                Logger.error(`❌ RUNTIME ERROR: Item "${focusItem.name}" at index ${index} missing sort_number`);
            }

            // Calculate angle using original logic
            const angle = adjustedCenterAngle + (middleIndex - index) * angleStep;

            if (isBibleBooks) {
                r.focusRingDebug(`📐 Item [${index}] ${focusItem.name}: angle = ${(angle * 180 / Math.PI).toFixed(1)}°`);
            }

            // Validate calculated angle
            if (isNaN(angle)) {
                Logger.error(`Invalid calculated angle for focus item ${index}: ${angle}`);
                return;
            }

            // Check if this focus item should be visible (viewport filter)
            const angleDiff = Math.abs(angle - centerAngle);
            const maxViewportAngle = MOBILE_CONFIG.VIEWPORT.VIEWPORT_ARC / 2;

            if (angleDiff <= maxViewportAngle + viewportBuffer) {
                const position = this.calculateFocusPosition(angle, arcParams);
                const isSelected = angleDiff < (angleStep * 0.5);
                if (isSelected) {
                    selectedFocusItem = focusItem;
                    selectedIndex = index;
                    if (r.DEBUG_VERBOSE) {
                        console.log(`🎯🎯🎯 ITEM SELECTED AT CENTER: [${index}] ${focusItem.name}, angleDiff=${angleDiff.toFixed(3)}°, rotationOffset=${(rotationOffset * 180 / Math.PI).toFixed(1)}°`);
                    }
                    r.focusRingDebug('🎯 SELECTED during rotation:', focusItem.name, 'angleDiff:', angleDiff.toFixed(3), 'threshold:', (angleStep * 0.5).toFixed(3));
                }

                visibleEntries.push({
                    focusItem,
                    index,
                    position,
                    angle,
                    isSelected
                });
            }
        });

        // LOG: Show magnifier and adjacent nodes
        if (selectedIndex >= 0) {
            const prevIndex = selectedIndex - 1;
            const nextIndex = selectedIndex + 1;
            const prevItem = prevIndex >= 0 && prevIndex < allFocusItems.length ? allFocusItems[prevIndex] : null;
            const nextItem = nextIndex >= 0 && nextIndex < allFocusItems.length ? allFocusItems[nextIndex] : null;
            
            console.log('🔍 === MAGNIFIER + ADJACENT NODES ===');
            console.log(`🔍 [-1] Previous: ${prevItem ? prevItem.name : 'N/A'}`);
            console.log(`🔍 [0] MAGNIFIER: ${selectedFocusItem.name}`);
            console.log(`🔍 [+1] Next: ${nextItem ? nextItem.name : 'N/A'}`);
            console.log('🔍 === END ===');
        }

        // Update all visible focus items (create new elements as needed)
        const reuseFocusElements = !shouldRebuild;

        // Clear all elements if rebuilding
        if (!reuseFocusElements) {
            const beforeCount = focusRingGroup.children.length;
            focusRingGroup.innerHTML = '';
            console.log(`🧹 REBUILD: Cleared ${beforeCount} elements from focusRingGroup`);
            // Preserve background band at the start
            if (background) {
                focusRingGroup.appendChild(background);
                console.log('🧹 REBUILD: Re-appended background band');
            }
            this.focusElements.clear();
            console.log(`🧹 REBUILD: Cleared focusElements Map (was ${this.focusElements.size} entries)`);
        }

        for (const [key, element] of this.focusElements.entries()) {
            const stillVisible = visibleEntries.some(entry => entry.focusItem.key === key);
            if (!stillVisible) {
                element.remove();
                this.focusElements.delete(key);
                console.log(`🗑️ CLEANUP: Removed element for key="${key}"`);
            }
        }

        let createCount = 0;
        let updateCount = 0;

        visibleEntries.forEach(entry => {
            const { focusItem, position, angle, isSelected } = entry;
            let element = this.focusElements.get(focusItem.key);
            if (!element || !reuseFocusElements) {
                element = this.createFocusElement(focusItem, position, angle, isSelected);
                focusRingGroup.appendChild(element);
                this.focusElements.set(focusItem.key, element);
                createCount++;
            } else {
                this.updateFocusElement(element, position, angle, isSelected);
                updateCount++;
            }
        });

        if (createCount > 0 || updateCount > 0) {
            console.log(`📊 DOM OPERATIONS: Created ${createCount}, Updated ${updateCount} (reuseFocusElements=${reuseFocusElements})`);
        }

        if (selectedIndex === -1 && allFocusItems.length > 0) {
            // Find the item closest to center angle as a fallback
            let closestIndex = -1;
            let closestDiff = Infinity;
            visibleEntries.forEach(({ index, angle }) => {
                const diff = Math.abs(angle - centerAngle);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestIndex = index;
                }
            });

            if (closestIndex !== -1) {
                selectedIndex = closestIndex;
                selectedFocusItem = allFocusItems[closestIndex];
                Logger.debug(`🎯 Fallback selected item: [${selectedIndex}] ${selectedFocusItem?.name}`);
            } else {
                Logger.warn('🎯 No focus item selected');
            }
        }

        // If still not selected, choose nearest non-null item
        if (selectedIndex === -1 && allFocusItems.length > 0) {
            let searchRadius = 1;
            const maxSearch = allFocusItems.length;
            while (searchRadius < maxSearch && selectedIndex === -1) {
                const checkIndices = [Math.floor(middleIndex - searchRadius), Math.ceil(middleIndex + searchRadius)];

                for (const checkIndex of checkIndices) {
                    if (checkIndex >= 0 && checkIndex < allFocusItems.length) {
                        const candidate = allFocusItems[checkIndex];
                        if (candidate !== null) {
                            selectedFocusItem = candidate;
                            selectedIndex = checkIndex;
                            Logger.debug(`🎯 Gap at center - selected nearest item: [${selectedIndex}] ${selectedFocusItem.name}`);
                            break;
                        }
                    }
                }
                searchRadius++;
            }
        }

        // Update active path with selected focus item  
        if (selectedIndex >= 0 && selectedFocusItem) {
            // Build appropriate active path based on item type
            r.buildActivePath(selectedFocusItem);

            r.setSelectedFocusItem(selectedFocusItem);
            const parentLevel = r.getPreviousHierarchyLevel(r.getItemHierarchyLevel(selectedFocusItem));
            const parentName = parentLevel ? r.getParentNameForLevel(selectedFocusItem, parentLevel) : null;
            r.updateParentButton(parentName, true); // Skip animation during rotation

            const angle = adjustedCenterAngle + (middleIndex - selectedIndex) * angleStep;

            if (r.forceImmediateFocusSettlement) {
                r.focusRingDebug('🔺 Immediate focus settlement triggered - showing child content without rotation delay');
                r.isRotating = false;
                if (r.settleTimeout) {
                    clearTimeout(r.settleTimeout);
                }
                r.elements.detailItemsGroup.classList.add('hidden');
                r.clearFanLines();
                r.showChildContentForFocusItem(selectedFocusItem, angle);
            } else {
                // Mark as rotating and defer child display
                r.isRotating = true;

                // Store timeout to settle rotation after animation
                const settleDelay = 50; // milliseconds
                if (r.settleTimeout) {
                    clearTimeout(r.settleTimeout);
                }
                r.settleTimeout = setTimeout(() => {
                    r.triggerFocusSettlement();
                }, settleDelay);
            }
        }
    }

    calculateFocusPosition(angle, arcParams) {
        // Validate inputs
        if (isNaN(angle) || !arcParams || isNaN(arcParams.centerX) || isNaN(arcParams.centerY) || isNaN(arcParams.radius)) {
            Logger.error(`Invalid position calculation inputs: angle=${angle}, arcParams=${JSON.stringify(arcParams)}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }

        const key = `${angle}_${arcParams.centerX}_${arcParams.centerY}_${arcParams.radius}`;

        if (this.positionCache.has(key)) {
            return this.positionCache.get(key);
        }

        // Arc-based positioning with off-screen center
        const x = arcParams.centerX + arcParams.radius * Math.cos(angle);
        const y = arcParams.centerY + arcParams.radius * Math.sin(angle);

        // Validate calculated position
        if (isNaN(x) || isNaN(y)) {
            Logger.error(`Calculated NaN position: angle=${angle}, centerX=${arcParams.centerX}, centerY=${arcParams.centerY}, radius=${arcParams.radius}, x=${x}, y=${y}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }

        const position = { x, y, angle };
        this.positionCache.set(key, position);

        return position;
    }

    calculateFocusPositionBilingual(angle, arcParams) {
        // Validate inputs - same as original method
        if (isNaN(angle) || !arcParams || isNaN(arcParams.centerX) || isNaN(arcParams.centerY) || isNaN(arcParams.radius)) {
            Logger.error(`Invalid bilingual position calculation inputs: angle=${angle}, arcParams=${JSON.stringify(arcParams)}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }

        // Setup coordinate system with current viewport
        const viewport = this.renderer.viewport.getViewportInfo();
        CoordinateSystem.setViewport({
            LSd: Math.max(viewport.width, viewport.height),
            SSd: Math.min(viewport.width, viewport.height)
        });

        // Create Hub coordinate using polar representation
        const hubCoord = HubNucCoordinate.fromPolar(angle, arcParams.radius);

        // Get Nuc coordinates (calculated lazily using constitutional formula)
        const x = hubCoord.nucX;
        const y = hubCoord.nucY;

        // Validate calculated position - same as original method
        if (isNaN(x) || isNaN(y)) {
            Logger.error(`Bilingual calculated NaN position: angle=${angle}, radius=${arcParams.radius}, x=${x}, y=${y}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }

        Logger.debug(`Bilingual focus position: Hub(${angle * 180 / Math.PI}°, r=${arcParams.radius}) -> Nuc(${x.toFixed(1)}, ${y.toFixed(1)})`);

        return { 
            x, 
            y, 
            angle,
            // Include coordinate representation for debugging
            hubCoord 
        };
    }

    createFocusElement(focusItem, position, angle, isSelected = false) {
        const r = this.renderer;
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.classList.add('focusItem');
        g.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        g.setAttribute('data-focus-key', focusItem.key);
        g._focusItem = focusItem;  // Store full item reference for text updates

        console.log(`🎯📝 CREATE: Element for "${focusItem.name}" key="${focusItem.key}" isSelected=${isSelected}`);

        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('class', 'node');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', isSelected ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', r.getColor('focusItem', focusItem.name));

        if (isSelected) {
            g.classList.add('selected');
        }

        // Always attach click handler (even for selected) so a stuck selection can be re-centered
        if (r.DEBUG_VERBOSE) {
            console.log(`🎯📝 HANDLER: Adding click handler for "${focusItem.name}" key="${focusItem.key}" (selected=${isSelected})`);
        }

        // PERFORMANCE: Use passive event listeners for touch/mouse events that don't preventDefault
        g.addEventListener('mousedown', (e) => {
            if (r.DEBUG_VERBOSE) console.log(`🎯👆 MOUSEDOWN on "${focusItem.name}" key="${focusItem.key}"`);
        }, { passive: true });
        g.addEventListener('touchstart', (e) => {
            if (r.DEBUG_VERBOSE) console.log(`🎯👆 TOUCHSTART on "${focusItem.name}" key="${focusItem.key}"`);
        }, { passive: true });

        g.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Look up the item fresh from currentFocusItems using the stored key
            const clickedKey = g.getAttribute('data-focus-key');
            if (r.DEBUG_VERBOSE) {
                console.log(`🎯🔥 CLICK: Handler fired! clickedKey="${clickedKey}"`);
                console.log(`🎯🔥 CLICK: this.currentFocusItems has ${r.currentFocusItems?.length || 0} items`);
                console.log(`🎯🔥 CLICK: this.allFocusItems has ${r.allFocusItems?.length || 0} items`);
                console.log('🎯🔥 CLICK: currentFocusItems:', 
                    r.currentFocusItems?.map(item => `"${item.name}"(key=${item.key})`).join(', ') || 'NONE');
                console.log('🎯🔥 CLICK: allFocusItems:', 
                    r.allFocusItems?.map(item => `"${item.name}"(key=${item.key})`).join(', ') || 'NONE');
            }

            // Some focus arrays contain null gap placeholders; guard before reading key
            const currentItem = r.currentFocusItems?.find(item => item && item.key === clickedKey);

            if (currentItem) {
                if (r.DEBUG_VERBOSE) console.log(`🎯✅ CLICK: Found item "${currentItem.name}"`);
                Logger.debug(`🎯 Focus node clicked: ${currentItem.name}`);
                r.bringFocusNodeToCenter(currentItem);
            } else {
                console.log(`🎯❌ CLICK: Key "${clickedKey}" NOT FOUND in currentFocusItems`);
                Logger.warn(`🎯 Clicked node key ${clickedKey} not found in current focus items`);
            }
        });

        g.appendChild(circle);

        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        this.updateFocusItemText(text, angle, focusItem, isSelected);
        g.appendChild(text);

        return g;
    }

    updateFocusElement(element, position, angle, isSelected = false) {
        // Validate position to prevent NaN errors
        if (!position || isNaN(position.x) || isNaN(position.y)) {
            Logger.error(`Invalid focus element position: ${JSON.stringify(position)}, angle: ${angle}`);
            return;
        }

        element.setAttribute('transform', `translate(${position.x}, ${position.y})`);

        const circle = element.querySelector('circle');
        const allTextElements = element.querySelectorAll('text');
        const text = allTextElements[0];
        
        // BUG DETECTION: Check for duplicate text elements
        if (allTextElements.length > 1) {
            const itemName = (element._focusItem || {}).name || 'UNKNOWN';
            console.error(`❌ BUG FOUND: ${allTextElements.length} text elements in node "${itemName}"! Removing duplicates...`);
            // Remove all but the first text element
            for (let i = 1; i < allTextElements.length; i++) {
                console.log(`🗑️ Removing duplicate text[${i}]: "${allTextElements[i].textContent}"`);
                allTextElements[i].remove();
            }
        }

        const nodeRadius = isSelected ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED;
        circle.setAttribute('r', nodeRadius);
        circle.setAttribute('fill', this.renderer.getColor('focusItem', (element._focusItem || {}).name));

        circle.removeAttribute('stroke');
        circle.removeAttribute('stroke-width');

        if (isSelected) {
            element.classList.add('selected');
            const textElement = element.querySelector('text');
            Logger.debug(`Applied selected class to focus item: ${textElement && textElement.textContent}`);
        } else {
            element.classList.remove('selected');
        }

        if (text) {
            const storedItem = element._focusItem;
            if (storedItem) {
                this.updateFocusItemText(text, angle, storedItem, isSelected);
            } else {
                this.updateFocusItemText(text, angle, { name: text.textContent, __level: 'focusItem' }, isSelected);
            }
        }
    }

    updateFocusItemText(textElement, angle, item, isSelected = false) {
        const r = this.renderer;
        // Validate angle to prevent NaN errors
        if (isNaN(angle)) {
            Logger.error(`Invalid text angle: ${angle}`);
            return;
        }

        // Get configuration for this item's level (pure universal)
        const itemLevel = item.__level || 'focusItem';
        const levelConfig = r.dataManager.getHierarchyLevelConfig(itemLevel);
        const textPosition = levelConfig && levelConfig.focus_text_position || 'radial';
        const textTransform = levelConfig && levelConfig.focus_text_transform || 'none';

        let textX, textY, textAnchor;

        if (textPosition === 'centered') {
            // Center text over the node
            textX = 0;
            textY = 0;
            textAnchor = 'middle';
        } else {
            // Radial positioning - center text over circles for all items
            // No offset needed - text positioned at same coordinates as circle center
            const offset = 0;

            textX = offset * Math.cos(angle);
            textY = offset * Math.sin(angle);

            // Center all text over circles for consistent positioning
            textAnchor = 'middle';
        }

        let rotation = angle * 180 / Math.PI;

        if (Math.cos(angle) < 0) {
            rotation += 180;
        }

        // Validate calculated values
        if (isNaN(textX) || isNaN(textY) || isNaN(rotation)) {
            Logger.error(`Invalid text position: x=${textX}, y=${textY}, rotation=${rotation}, angle=${angle}`);
            return;
        }

        textElement.setAttribute('x', textX);
        textElement.setAttribute('y', textY);
        textElement.setAttribute('dy', '0.3em');
        textElement.setAttribute('text-anchor', textAnchor);
        textElement.setAttribute('transform', `rotate(${rotation}, ${textX}, ${textY})`);
        textElement.setAttribute('fill', 'black');

        // Let CSS handle font sizing and weight through the 'selected' class
        textElement.removeAttribute('font-size');
        textElement.removeAttribute('font-weight');

        // Apply text transformation based on configuration (pure universal)
        // Prefer translated display name when available, BUT NOT for numeric items
        // (verses have their content in language properties, not their display name)
        const isNumericLevel = levelConfig && levelConfig.is_numeric;
        const translationProp = (!isNumericLevel && typeof r.getTranslationTextProperty === 'function')
            ? r.getTranslationTextProperty()
            : null;
        // Only look for translated names on non-numeric items (books, sections, etc.)
        // For numeric items (chapters, verses), the language property contains content, not the name
        const translated = translationProp
            ? (item.translations?.[translationProp])  // Only check translations object, not item root
            : null;
        const baseName = translated || item.name;

        let displayText = baseName;
        if (textTransform === 'number_only_or_cil') {
            // Extract numeric part and optionally append CIL when selected
            const match = baseName && baseName.match(/^(\d+)/);
            if (match) {
                const number = match[1];
                displayText = isSelected ? `${number} CIL` : number;
            }
        } else if (textTransform === 'number_only') {
            // Show just the number for unselected, prepend display_name when selected
            const match = baseName && baseName.match(/^(\d+)/);
            if (match) {
                const number = match[1];
                if (isSelected && levelConfig) {
                    const translatedDisplayName = r.getTranslatedDisplayName(levelConfig);
                    if (translatedDisplayName) {
                        displayText = `${translatedDisplayName} ${number}`;
                    } else {
                        displayText = number;
                    }
                } else {
                    displayText = number;
                }
            }
        }

        textElement.textContent = displayText;

        // Log text size for Magnifier (selected focus item)
        if (isSelected) {
            // CSS sets font-size via .focusItem.selected text rule (20px bold)
            console.log('📏 MAGNIFIER TEXT SIZE:', '20px (CSS)', 'weight: bold (CSS)', 'item:', item.name);
        }
    }

    resetCaches() {
        this.focusElements.clear();
        this.positionCache.clear();
        this._lastFocusItemsKey = null;
        this.lastRotationOffset = undefined;
    }
}

export { FocusRingView };