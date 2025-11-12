/**
 * Mobile Catalog Renderer
 * Efficient renderer that minimizes DOM manipulation for mobile performance
 * 
 * This is part of the modular mobile volume system.
 * Edit this file directly - no bundling required.
 */

import { MOBILE_CONFIG, VERSION } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { MobileChildPyramid } from './mobile-childpyramid.js';
import { MobileDetailSector } from './mobile-detailsector.js';
import { CoordinateSystem, HubNucCoordinate } from './mobile-coordinates.js';

/**
 * Efficient renderer that minimizes DOM manipulation
 */
class MobileRenderer {
    constructor(viewportManager, dataManager) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        
        // Initialize Child Pyramid module
        this.childPyramid = new MobileChildPyramid(viewportManager, dataManager, this);
        
        // Initialize Detail Sector module
        this.detailSector = new MobileDetailSector(viewportManager, dataManager, this);
        
        // DOM element caches
        this.elements = {};
        this.focusElements = new Map();
        this.positionCache = new Map();
    this.leafStateCache = new Map(); // Cache leaf determinations per item
    this.detailSectorAnimating = false;
        
        // State
        this.selectedTopLevel = null;
        this.selectedFocusItem = null;
        this.currentFocusItems = [];
        this.activePath = [];
        this.activeType = null;
        
        // Settling state for smooth child item display
        this.isRotating = false;
        this.settleTimeout = null;
        
        // Sprocket chain viewport state
        this.allFocusItems = []; // Complete linear chain of all focus items
        this.chainPosition = 0; // Current position in the linear chain (0-based)
        this.visibleStartIndex = 0; // First visible focus item index
        this.visibleEndIndex = 0; // Last visible focus item index
    }
    
    async initialize() {
        await this.initializeElements();
        this.viewport.adjustSVGForMobile(this.elements.svg, this.elements.mainGroup);
        
        // Create blue circle at upper right corner for Detail Sector animation
        this.createDetailSectorCircle();
        
        return true;
    }
    
    positionMagnifyingRing() {
        const ring = this.elements.magnifier;
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
        
        Logger.debug(`Magnifier positioned at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) with radius ${MOBILE_CONFIG.RADIUS.MAGNIFIER}`);
    }
    
    handleViewportChange() {
        // Update focus ring positions if they're currently shown
        if (this.currentFocusItems.length > 0) {
            this.updateFocusRingPositions(0);
        }
        
        // Notify child pyramid of viewport changes
        this.childPyramid.handleViewportChange();
        
        // Notify detail sector of viewport changes
        this.detailSector.handleViewportChange();
    }
    
    async initializeElements() {
        const requiredElements = [
            'catalogSvg', 'mainGroup', 'centralGroup', 'topLevel', 
            'pathLines', 'focusRing', 'detailItems'
        ];
        
        const optionalElements = [
            'childRing'  // Will be created dynamically if needed
        ];
        
        const elementIds = [...requiredElements, ...optionalElements];
        
        const missing = [];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const key = id === 'catalogSvg' ? 'svg' : 
                           id === 'mainGroup' ? 'mainGroup' :
                           id === 'centralGroup' ? 'centralGroup' :
                           id === 'topLevel' ? 'topLevelGroup' :
                           id === 'pathLines' ? 'pathLinesGroup' :
                           id === 'focusRing' ? 'focusRingGroup' :
                           id === 'childRing' ? 'childRingGroup' :
                           id === 'detailItems' ? 'detailItemsGroup' :
                           id + 'Group';
                this.elements[key] = element;
            } else {
                // Only add to missing if it's a required element
                if (requiredElements.includes(id)) {
                    missing.push(id);
                } else {
                    Logger.debug(`Optional element ${id} not found - will create if needed`);
                }
            }
        });
        
        // Handle missing childRing by creating it dynamically
        if (!this.elements.childRingGroup) {
            Logger.debug('Creating childRing element dynamically');
            const childRing = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
            childRing.id = 'childRing';
            childRing.classList.add('hidden');
            this.elements.mainGroup.appendChild(childRing);
            this.elements.childRingGroup = childRing;
        }
        
        // Initialize Child Pyramid module with the DOM element
        this.childPyramid.initialize(this.elements.childRingGroup);
        
        // Initialize Detail Sector module with the DOM element
        this.detailSector.initialize(this.elements.detailItemsGroup);
        
        if (missing.length > 0) {
            Logger.error('Missing DOM elements:', missing);
            Logger.debug('Available elements in DOM:', elementIds.map(id => `${id}: ${!!document.getElementById(id)}`));
            throw new Error(`Required DOM elements not found: ${missing.join(', ')}`);
        }
        
        Logger.debug('DOM elements initialized:', Object.keys(this.elements));
        Logger.debug('UserAgent:', navigator.userAgent);
        Logger.debug('Window size:', window.innerWidth, 'x', window.innerHeight);
    }
    
    createMagnifier() {
        // Remove existing magnifier if it exists
        const existingRing = this.elements.magnifier;
        if (existingRing) {
            existingRing.remove();
        }
        
        // Create new magnifier
        const ring = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        ring.setAttribute('id', 'magnifier');
        
        // Add to main group (NOT to focus ring group, so it stays visible)
        this.elements.mainGroup.appendChild(ring);
        
        // Cache the element
        this.elements.magnifier = ring;
        
        // Position it
        this.positionMagnifyingRing();
        
        Logger.debug('Magnifier created and positioned');
        
        return ring;
    }
    
    onRotationEnd() {
        // Called when touch rotation has completely stopped
        if (this.settleTimeout) {
            clearTimeout(this.settleTimeout);
        }
        
        // Trigger immediate settling for the currently selected focus item
        this.isRotating = false;
        if (this.selectedFocusItem) {
            Logger.debug('Rotation ended, showing children for settled focus item:', this.selectedFocusItem.name);
            const selectedIndex = this.currentFocusItems.findIndex(m => m.key === this.selectedFocusItem.key);
            if (selectedIndex >= 0) {
                const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
                const centerAngle = this.viewport.getCenterAngle();
                const angle = centerAngle + (selectedIndex - (this.currentFocusItems.length - 1) / 2) * angleStep;
                this.showChildContentForFocusItem(this.selectedFocusItem, angle);
            }
        }
    }
    
    buildActivePath(focusItem) {
        // Pure universal: Use metadata __path property
        this.activePath = focusItem.__path || [];
        Logger.debug('Built active path:', this.activePath);
    }
    
    showChildContentForFocusItem(focusItem, angle) {
        Logger.debug('Showing child content for focus item:', focusItem.name);

        // Determine the hierarchy level of the focus item
        const currentLevel = this.getItemHierarchyLevel(focusItem);
        if (!currentLevel) {
            Logger.warn('Could not determine hierarchy level for focus item:', focusItem);
            return;
        }

        // Get the immediate next hierarchy level (universal navigation requires immediate children)
        const nextLevel = this.getNextHierarchyLevel(currentLevel);
        if (!nextLevel) {
            Logger.debug('No next level detected for', focusItem.name, '- treating as leaf');
            this.leafStateCache.set(this.getLeafCacheKey(focusItem, null), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        Logger.debug(`Focus item is at level '${currentLevel}', getting '${nextLevel}' items`);

        // Get child items at the immediate next level
        const childItems = this.getChildItemsForLevel(focusItem, nextLevel);
        
        if (!childItems || childItems.length === 0) {
            Logger.debug(`No ${nextLevel} items found for ${currentLevel}: ${focusItem.name} - treating as leaf`);
            this.leafStateCache.set(this.getLeafCacheKey(focusItem, nextLevel), true);
            this.handleLeafFocusSelection(focusItem);
            return;
        }

        this.leafStateCache.set(this.getLeafCacheKey(focusItem, nextLevel), false);

        const itemType = this.getLevelPluralLabel(nextLevel);
        Logger.debug(`Found ${childItems.length} ${itemType} for ${currentLevel}: ${focusItem.name}`);

        // Show child items in Child Pyramid
        Logger.debug('🔺 SHOWING Child Pyramid with', childItems.length, itemType, 'for focus item:', focusItem.name);
        this.childPyramid.showChildPyramid(childItems, itemType);
    }

    /**
     * Get child items for a specific hierarchy level
     */
    getChildItemsForLevel(parentItem, childLevel) {
        // Pure universal: Use DataManager's universal navigation method
        const childLevelName = childLevel;
        return this.dataManager.getItemsAtLevel(parentItem, childLevelName) || [];
    }

    getTopLevelItems() {
        const levelNames = this.getHierarchyLevelNames();
        if (!levelNames.length) {
            return [];
        }

        const topLevelName = levelNames[0];
        const topLevelCollection = this.dataManager.getTopLevelCollection();
        if (!topLevelCollection || typeof topLevelCollection !== 'object') {
            return [];
        }

        const levelConfig = this.dataManager.getHierarchyLevelConfig(topLevelName);

        const items = Object.keys(topLevelCollection).map(key => {
            const entry = topLevelCollection[key];
            const displayName = (entry && (entry.display_name || entry.name)) || key;

            return {
                name: displayName,
                key: key,
                data: entry,
                __level: topLevelName,
                __levelDepth: 0,
                __isLeaf: false,
                __path: [key],
                [topLevelName]: key
            };
        });

        if (typeof this.dataManager.sortItems === 'function') {
            return this.dataManager.sortItems(items, levelConfig);
        }

        return items;
    }

    getLevelPluralLabel(levelName) {
        if (!levelName) {
            return '';
        }

        // Prefer plural naming from hierarchy config when available
        const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
        if (levelConfig && levelConfig.plural_display_name) {
            return levelConfig.plural_display_name;
        }

        // Use data manager's plural property name when exposed
        if (typeof this.dataManager.getPluralPropertyName === 'function') {
            return this.dataManager.getPluralPropertyName(levelName);
        }

        // Fallback simple pluralization with basic irregulars
        const irregulars = {
            family: 'families',
            country: 'countries',
            category: 'categories'
        };

        if (irregulars[levelName]) {
            return irregulars[levelName];
        }

        return `${levelName}s`;
    }

    getLeafCacheKey(item, nextLevel) {
        const itemKey = item && (item.key || item.name || 'unknown');
        return nextLevel ? `${itemKey}::${nextLevel}` : `${itemKey}::terminal`;
    }

    isLeafItem(item) {
        if (!item) {
            return false;
        }

        if (item.__isLeaf === true) {
            return true;
        }

        if (item.__isLeaf === false) {
            return false;
        }

        const currentLevel = this.getItemHierarchyLevel(item);
        if (!currentLevel) {
            return false;
        }

        const nextLevel = this.getNextHierarchyLevel(currentLevel);
        if (!nextLevel) {
            this.leafStateCache.set(this.getLeafCacheKey(item, null), true);
            item.__isLeaf = true;
            return true;
        }

        const cacheKey = this.getLeafCacheKey(item, nextLevel);
        if (this.leafStateCache.has(cacheKey)) {
            const cached = this.leafStateCache.get(cacheKey);
            item.__isLeaf = cached;
            return cached;
        }

        const childItems = this.getChildItemsForLevel(item, nextLevel);
        const isLeaf = !childItems || childItems.length === 0;
        this.leafStateCache.set(cacheKey, isLeaf);
        item.__isLeaf = isLeaf;
        return isLeaf;
    }

    handleLeafFocusSelection(focusItem) {
        if (!focusItem) {
            return;
        }

        Logger.debug('Leaf focus item selected:', focusItem.name);

        // Hide child visuals when no children exist
        if (this.elements.childRingGroup) {
            this.elements.childRingGroup.classList.add('hidden');
        }
        this.clearFanLines();

        // Update current selection state
    this.selectedFocusItem = { ...focusItem };

        const itemLevel = this.getItemHierarchyLevel(focusItem);
        const parentLevel = itemLevel ? this.getPreviousHierarchyLevel(itemLevel) : null;
        const parentName = parentLevel ? this.getParentNameForLevel(focusItem, parentLevel) : null;
        this.updateParentButton(parentName);

        if (!this.detailSector) {
            return;
        }

        if (this.detailSector.isVisible) {
            this.detailSector.showDetailContent(focusItem);
        } else if (!this.detailSectorAnimating) {
            this.expandDetailSector();
        }
    }
    
    updateCenterNodeState(inactive) {
        const centralGroup = this.elements.centralGroup;
        if (inactive) {
            centralGroup.classList.add('inactive');
        } else {
            centralGroup.classList.remove('inactive');
        }
    }
    
    showFocusRing() {
        const focusRingGroup = this.elements.focusRingGroup;
        focusRingGroup.classList.remove('hidden');
        focusRingGroup.innerHTML = '';
        
        // Create magnifier at correct position when focus items are shown
        this.createMagnifier();
        
        // Initialize viewport filtering state
        this.allFocusItems = this.currentFocusItems; // Set the complete list for filtering
        
        Logger.debug(`Viewport filtering initialized: ${this.allFocusItems.length} total focus items`);
        
        // Calculate initial rotation to center nearest focus item (original logic)
        const initialOffset = this.calculateInitialRotationOffset();
        Logger.debug(`Using initial rotation offset: ${initialOffset} radians (${initialOffset * 180 / Math.PI}°)`);
        
        this.updateFocusRingPositions(initialOffset);
        
        // Store the initial offset for the touch handler
        this.initialRotationOffset = initialOffset;
    }
    
    calculateInitialRotationOffset() {
        if (!this.currentFocusItems.length) return 0;
        
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (this.currentFocusItems.length - 1) / 2;
        
        // Check if items have sort_number (indicating curated order)
        const hasSortNumbers = this.currentFocusItems.some(item => 
            (item.data?.sort_number !== undefined) || (item.sort_number !== undefined)
        );
        
        if (hasSortNumbers) {
            // For sorted items (like Bible books), position first item at arc top
            // Arc top is at highest angle (visual top), so we need positive offset
            // to move first item (index 0) from center toward highest visible angle
            const maxViewportAngle = MOBILE_CONFIG.VIEWPORT.VIEWPORT_ARC / 2;
            const arcTopOffset = maxViewportAngle - (angleStep * 1); // Position at arc top with small margin
            
            Logger.debug(`Sorted items (${this.currentFocusItems.length}): positioning at arc top, offset = ${arcTopOffset * 180 / Math.PI}°`);
            return arcTopOffset;
        }
        
        // For unsorted items, use original centering logic
        // For odd number of focus items, middle focus item is already centered
        if (this.currentFocusItems.length % 2 === 1) {
            return 0;
        }
        
        // For even number of focus items, we need to snap to the nearest focus item
        // The center falls between two focus items at indices floor(middleIndex) and ceil(middleIndex)
        // We'll snap to the lower index focus item (more intuitive)
        const targetIndex = Math.floor(middleIndex);
        
        // Calculate offset needed to center this focus item
        const offset = -(targetIndex - middleIndex) * angleStep;
        
        Logger.debug(`Even focus items (${this.currentFocusItems.length}): centering index ${targetIndex}, offset = ${offset * 180 / Math.PI}°`);
        return offset;
    }
    
    updateFocusRingPositions(rotationOffset) {
        const focusRingGroup = this.elements.focusRingGroup;
        
        // For sprocket chain: use all focus items but apply viewport filtering during rendering
        const allFocusItems = this.allFocusItems.length > 0 ? this.allFocusItems : this.currentFocusItems;
        if (!allFocusItems.length) return;
        
        // Validate rotationOffset
        if (isNaN(rotationOffset)) {
            Logger.error(`Invalid rotationOffset: ${rotationOffset}`);
            rotationOffset = 0; // Safe fallback
        }
        
        // Track rotation changes - hide Child Pyramid during rotation
        const isRotating = this.lastRotationOffset !== undefined && Math.abs(rotationOffset - this.lastRotationOffset) > 0.001;
        if (isRotating) {
            Logger.debug('🔄 Rotation detected - hiding Child Pyramid temporarily');
            
            // Hide Child Pyramid and fan lines during rotation
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.detailItemsGroup.classList.add('hidden');
            this.clearFanLines();
        }
        this.lastRotationOffset = rotationOffset;
        
        // Clear existing elements
        focusRingGroup.innerHTML = '';
        this.focusElements.clear();
        
        // Use original angle calculation logic 
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD; // Keep original 4.3° spacing
        const centerAngle = this.viewport.getCenterAngle();
        const adjustedCenterAngle = centerAngle + rotationOffset;
        
        // Validate centerAngle
        if (isNaN(centerAngle) || isNaN(adjustedCenterAngle)) {
            Logger.error(`Invalid angles: centerAngle=${centerAngle}, adjustedCenterAngle=${adjustedCenterAngle}`);
            return;
        }
        
        // Calculate arc parameters
        const arcParams = this.viewport.getArcParameters();
        let selectedFocusItem = null;
        let selectedIndex = -1;
        
        // Only log for Bible books
        const isBibleBooks = allFocusItems.length > 0 && allFocusItems[0].name?.startsWith('Liber_');
        
        if (isBibleBooks) {
            Logger.debug(`📚 BIBLE BOOKS - Focus items order (${allFocusItems.length} items):`);
            allFocusItems.forEach((item, idx) => {
                const sortNum = item.data?.sort_number ?? item.sort_number ?? 'none';
                Logger.debug(`  [${idx}] ${item.name} (sort_number: ${sortNum})`);
            });
            Logger.debug(`🎯 Center angle: ${(centerAngle * 180 / Math.PI).toFixed(1)}°, Rotation offset: ${(rotationOffset * 180 / Math.PI).toFixed(1)}°`);
            Logger.debug(`🎯 Adjusted center angle: ${(adjustedCenterAngle * 180 / Math.PI).toFixed(1)}°`);
        }

        // Process all focus items but only render those in viewport window
        allFocusItems.forEach((focusItem, index) => {
            // Calculate angle using original logic
            const angle = adjustedCenterAngle + (index - (allFocusItems.length - 1) / 2) * angleStep;
            
            if (isBibleBooks) {
                Logger.debug(`📐 Item [${index}] ${focusItem.name}: angle = ${(angle * 180 / Math.PI).toFixed(1)}°`);
            }
            
            // Validate calculated angle
            if (isNaN(angle)) {
                Logger.error(`Invalid calculated angle for focus item ${index}: ${angle}`);
                return;
            }
            
            // Check if this focus item should be visible (viewport filter)
            const angleDiff = Math.abs(angle - centerAngle);
            const maxViewportAngle = MOBILE_CONFIG.VIEWPORT.VIEWPORT_ARC / 2;
            
            if (angleDiff <= maxViewportAngle) {
                // This focus item is in the viewport - render it
                const position = this.calculateFocusPosition(angle, arcParams);
                
                // Check if selected (centered) - should match snapping range
                const isSelected = angleDiff < (angleStep * 0.5); // ~2.15° - matches snapping threshold
                if (isSelected) {
                    selectedFocusItem = focusItem;
                    selectedIndex = index;
                    Logger.debug('🎯 SELECTED during rotation:', focusItem.name, 'angleDiff:', angleDiff.toFixed(3), 'threshold:', (angleStep * 0.5).toFixed(3));
                }
                
                // Create focus element
                const element = this.createFocusElement(focusItem, position, angle, isSelected);
                this.focusElements.set(focusItem.key, element);
                focusRingGroup.appendChild(element);
            }
        });
        
        // Position magnifying ring at the calculated center angle
        this.positionMagnifyingRing();
        
        // Update active path with selected focus item  
        if (selectedIndex >= 0 && selectedFocusItem) {
            // Build appropriate active path based on item type
            this.buildActivePath(selectedFocusItem);
            
            // Mark as rotating and defer child display
            this.isRotating = true;
            this.selectedFocusItem = selectedFocusItem;
            
            // Clear any existing settle timeout
            if (this.settleTimeout) {
                clearTimeout(this.settleTimeout);
            }            // Hide child ring immediately during rotation to prevent strobing
            Logger.debug('🔄 ROTATION: Focus item selected but rotating - hiding Child Pyramid during rotation');
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.detailItemsGroup.classList.add('hidden');
            this.clearFanLines();
            
            // Update Parent Button to show the parent level name
            const parentLevel = this.getPreviousHierarchyLevel(this.getItemHierarchyLevel(selectedFocusItem));
            const parentName = parentLevel ? this.getParentNameForLevel(selectedFocusItem, parentLevel) : null;
            this.updateParentButton(parentName);
            
            // Set timeout to show appropriate child content after settling
            this.settleTimeout = setTimeout(() => {
                Logger.debug('⏰ TIMEOUT FIRED: isRotating=', this.isRotating, 'selectedFocusItem=', this.selectedFocusItem && this.selectedFocusItem.name, 'expectedItem=', selectedFocusItem.name);
                this.isRotating = false;
                if (this.selectedFocusItem && this.selectedFocusItem.key === selectedFocusItem.key) {
                    const angle = adjustedCenterAngle + (selectedIndex - (allFocusItems.length - 1) / 2) * angleStep;
                    Logger.debug('✅ Focus item settled:', selectedFocusItem.name, 'showing child content');
                    this.showChildContentForFocusItem(selectedFocusItem, angle);
                } else {
                    Logger.debug('❌ Timeout fired but item changed - not showing child content');
                }
            }, MOBILE_CONFIG.TIMING.FOCUS_ITEM_SETTLE_DELAY);
            
        } else {
            // Hide child ring immediately when no focus item is selected (during rotation)
            Logger.debug('🔄 ROTATION: No focus item selected - hiding Child Pyramid immediately');
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.detailItemsGroup.classList.add('hidden');
            this.clearFanLines();
            this.selectedFocusItem = null;
            this.hideParentButton();
        }
    }
    
    getSelectedFocusIndex(rotationOffset, focusCount) {
        if (focusCount === 0) return -1;
        
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (focusCount - 1) / 2;
        
        // Calculate which focus item index should be at the dynamic center angle position
        // For a focus item at index i to be at center angle:
        // centerAngle + rotationOffset + (i - middleIndex) * angleStep = centerAngle
        // Therefore: i = middleIndex - (rotationOffset / angleStep)
        const exactIndex = middleIndex - (rotationOffset / angleStep);
        const roundedIndex = Math.round(exactIndex);
        
        // Only select if the focus item is very close to the exact position (detent threshold)
        const detentThreshold = 0.15; // Allow small deviation for selection
        const deviation = Math.abs(exactIndex - roundedIndex);
        
        if (deviation <= detentThreshold && roundedIndex >= 0 && roundedIndex < focusCount) {
            return roundedIndex;
        }
        
        return -1; // No focus item selected if not close enough to detent position
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
    
    // Phase 2 Consolidation: Bilingual coordinate positioning method
    // Uses bilingual coordinate system while preserving exact positioning behavior
    calculateFocusPositionBilingual(angle, arcParams) {
        // Validate inputs - same as original method
        if (isNaN(angle) || !arcParams || isNaN(arcParams.centerX) || isNaN(arcParams.centerY) || isNaN(arcParams.radius)) {
            Logger.error(`Invalid bilingual position calculation inputs: angle=${angle}, arcParams=${JSON.stringify(arcParams)}`);
            return { x: 0, y: 0, angle: 0 }; // Safe fallback
        }
        
        // Setup coordinate system with current viewport
        const viewport = this.viewport.getViewportInfo();
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
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.classList.add('focusItem');
        g.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('class', 'node');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', isSelected ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', this.getColor('focusItem', focusItem.name));
        
        if (isSelected) {
            g.classList.add('selected');
        }
        
        // No strokes on focus nodes - clean styling
        
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
        const text = element.querySelector('text');
        
        // Simple binary selection: selected node is magnified, all others are normal
        const nodeRadius = isSelected ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED;
        circle.setAttribute('r', nodeRadius);
        
        // Clean styling - no strokes
        circle.removeAttribute('stroke');
        circle.removeAttribute('stroke-width');
        
        // Apply selected class based on selection state
        if (isSelected) {
            element.classList.add('selected');
            const textElement = element.querySelector('text');
            Logger.debug(`Applied selected class to focus item: ${textElement && textElement.textContent}`);
        } else {
            element.classList.remove('selected');
        }
        
        if (text) {
            this.updateFocusItemText(text, angle, { name: text.textContent, __level: 'focusItem' }, isSelected);
        }
    }
    
    updateFocusItemText(textElement, angle, item, isSelected = false) {
        // Validate angle to prevent NaN errors
        if (isNaN(angle)) {
            Logger.error(`Invalid text angle: ${angle}`);
            return;
        }
        
        // Get configuration for this item's level (pure universal)
        const itemLevel = item.__level || 'focusItem';
        const levelConfig = this.dataManager.getHierarchyLevelConfig(itemLevel);
        const textPosition = levelConfig && levelConfig.focus_text_position || 'radial';
        const textTransform = levelConfig && levelConfig.focus_text_transform || 'none';
        
        let textX, textY, textAnchor;
        
        if (textPosition === 'centered') {
            // Center text over the node
            textX = 0;
            textY = 0;
            textAnchor = 'middle';
        } else {
            // Standard radial positioning for other items
            const radius = MOBILE_CONFIG.RADIUS.UNSELECTED;
            let offset = -(radius + 5);
            
            // For selected items, shift text further outward
            if (isSelected) {
                offset = -(radius + 50);
            }
            
            textX = offset * Math.cos(angle);
            textY = offset * Math.sin(angle);
            
            // For selected items, use 'end' anchor so text block ends near the node
            if (isSelected) {
                textAnchor = 'end';
            } else {
                textAnchor = Math.cos(angle) >= 0 ? 'start' : 'end';
            }
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
        let displayText = item.name;
        if (textTransform === 'number_only_or_cil') {
            // Extract numeric part and optionally append CIL when selected
            const match = item.name.match(/^(\d+)/);
            if (match) {
                const number = match[1];
                displayText = isSelected ? `${number} CIL` : number;
            }
        }
        
        textElement.textContent = displayText;
    }
    
    addTimestampToCenter() {
        const existingTimestamp = this.elements.centralGroup.querySelector('.timestamp');
        if (existingTimestamp) {
            existingTimestamp.remove();
        }
        
        const timestamp = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        timestamp.setAttribute('class', 'timestamp');
        timestamp.setAttribute('x', '0');
        timestamp.setAttribute('y', '60');
        timestamp.setAttribute('text-anchor', 'middle');
        timestamp.setAttribute('fill', '#f2f2e6');
        timestamp.setAttribute('font-size', '8');
        timestamp.setAttribute('opacity', '0.7');
        timestamp.textContent = new Date().toLocaleTimeString();
        
        this.elements.centralGroup.appendChild(timestamp);
    }
    
    getColor(type, name) {
        // Special handling for volume selector
        if (type === 'volume_selector') {
            return '#362e6a'; // MMdM blue for volume selector
        }
        
        // Get color from display configuration
        const levelConfig = this.dataManager.getHierarchyLevelConfig(type);
        return levelConfig && levelConfig.color || '#f1b800'; // Default to yellow if not configured
    }
    
    getColorForType(type) {
        return this.getColor(type, '');
    }
    
    /**
     * Get the hierarchy levels configuration
     */
    getHierarchyLevels() {
        const displayConfig = this.dataManager.getDisplayConfig();
        return displayConfig && displayConfig.hierarchy_levels || {};
    }

    /**
     * Get the ordered list of hierarchy level names
     */
    getHierarchyLevelNames() {
        const levels = this.getHierarchyLevels();
        return Object.keys(levels);
    }

    /**
     * Get the depth/level index for a given level name
     */
    getHierarchyLevelDepth(levelName) {
        const levelNames = this.getHierarchyLevelNames();
        return levelNames.indexOf(levelName);
    }

    /**
     * Determine what hierarchy level an item belongs to based on its properties
     */
    getItemHierarchyLevel(item) {
        // Pure universal: Use metadata __level property
        return item.__level || null;
    }

    /**
     * Get the next hierarchy level name
     */
    getNextHierarchyLevel(currentLevelName) {
        const levelNames = this.getHierarchyLevelNames();
        const currentIndex = levelNames.indexOf(currentLevelName);
        if (currentIndex >= 0 && currentIndex < levelNames.length - 1) {
            return levelNames[currentIndex + 1];
        }
        return null;
    }

    /**
     * Get the previous hierarchy level name
     */
    getPreviousHierarchyLevel(currentLevelName) {
        const levelNames = this.getHierarchyLevelNames();
        const currentIndex = levelNames.indexOf(currentLevelName);
        if (currentIndex > 0) {
            return levelNames[currentIndex - 1];
        }
        return null;
    }
    
    reset() {
        this.selectedTopLevel = null;
        this.selectedFocusItem = null;
        this.hideParentButton();
        this.currentFocusItems = [];
        this.activePath = [];
        this.activeType = null;
        this.focusElements.clear();
        this.positionCache.clear();
        this.leafStateCache.clear();
    this.detailSectorAnimating = false;
        
        // Collapse Detail Sector
        this.collapseDetailSector();
        
        // Hide rings
        this.elements.focusRingGroup.classList.add('hidden');
        this.elements.childRingGroup.classList.add('hidden');
        this.elements.detailItemsGroup.classList.add('hidden');
        this.clearFanLines();
        
        // Reset top level visuals
        const levelGroups = document.querySelectorAll('.levelGroup');
        levelGroups.forEach(group => {
            group.classList.remove('active', 'inactive');
        });
        
        // Reset center node
        this.updateCenterNodeState(false);
        
        // Remove timestamp
        const timestamp = this.elements.centralGroup.querySelector('.timestamp');
        if (timestamp) {
            timestamp.remove();
        }
        
        // Reset detail sector
        this.detailSector.reset();
        
        Logger.debug('Renderer reset');
    }
    
    clearFanLines() {
        this.elements.pathLinesGroup.innerHTML = '';
    }
    
    updateParentButton(parentName) {
        const parentButton = document.getElementById('parentButton');
        const parentText = document.getElementById('parentText');
        
        if (parentName) {
            // Show button and set text to parent name
            parentText.textContent = parentName;
            parentButton.classList.remove('hidden');
        } else {
            // Hide button if no parent
            parentButton.classList.add('hidden');
        }
    }
    
    hideParentButton() {
        const parentButton = document.getElementById('parentButton');
        parentButton.classList.add('hidden');
    }
    
    /**
     * Handle Child Pyramid item clicks (nzone migration)
     */
    handleChildPyramidClick(item, event) {
        console.log('🔺🔺🔺 HANDLE CHILD PYRAMID CLICK CALLED!', item.name);
        Logger.debug('🔺 Child pyramid item clicked:', item.name, 'implementing nzone migration OUT');

        // NZONE MIGRATION: Child Pyramid → Focus Ring
        // This moves the clicked item OUT to become the new focus in the Focus Ring

        // Determine the hierarchy level of the clicked item
        const itemLevel = this.getItemHierarchyLevel(item);
        if (!itemLevel) {
            Logger.warn('🔺 Could not determine hierarchy level for clicked item:', item);
            return;
        }

        Logger.debug(`🔺 ${itemLevel} clicked:`, item.name, 'Full item:', item);

        // 1. Update the navigation state - this item becomes the new focus
        this.buildActivePath(item);
        this.activeType = itemLevel;
        this.selectedFocusItem = { ...item };

        // 2. Get all siblings at the same level and move them to Focus Ring
        const parentLevel = this.getPreviousHierarchyLevel(itemLevel);
        
        // Build the correct parent item from the clicked item's path
        // This ensures we get the right parent even if selectedFocusItem is at wrong level
        const parentItem = this.buildParentItemFromChild(item, parentLevel);
        
        // Get all siblings by asking for children of the parent at the clicked item's level
        const allSiblings = this.getChildItemsForLevel(parentItem, itemLevel);
        
        Logger.debug(`🔺 Getting siblings: parent="${parentItem.name}" (${parentLevel}), childLevel="${itemLevel}", found ${allSiblings.length} siblings`);

        this.currentFocusItems = allSiblings;
        this.allFocusItems = allSiblings;

        // 3. Clear current Child Pyramid immediately to remove child item nodes
        this.elements.childRingGroup.innerHTML = '';
        this.elements.childRingGroup.classList.add('hidden');

        // 4. Find the clicked item in the siblings and calculate the center offset FIRST
        const clickedIndex = this.findItemIndexInArray(item, allSiblings, itemLevel);
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (allSiblings.length - 1) / 2;
        const centerOffset = -(clickedIndex - middleIndex) * angleStep;
        
        Logger.debug(`🔺 Calculated centerOffset for ${item.name}: clickedIndex=${clickedIndex}, middleIndex=${middleIndex}, centerOffset=${centerOffset.toFixed(3)}`);

        // 5. Set up touch rotation with the correct offset
        if (window.mobileCatalogApp) {
            window.mobileCatalogApp.setupTouchRotation(allSiblings);
            Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
            
            // CRITICAL: Set the rotation offset AFTER setupTouchRotation to override its default
            if (window.mobileCatalogApp.touchHandler) {
                window.mobileCatalogApp.touchHandler.rotationOffset = centerOffset;
                Logger.debug('🔺 Set touch handler rotationOffset to', centerOffset.toFixed(3));
            }
        }
        
        // Also update lastRotationOffset to prevent rotation detection
        this.lastRotationOffset = centerOffset;

        // Update Focus Ring with siblings - clicked item should be centered
        this.updateFocusRingPositions(centerOffset);

        Logger.debug(`🔺 Focus Ring updated with ${allSiblings.length} ${itemLevel}s, selected:`, item.name, 'centerOffset:', centerOffset.toFixed(3));

        // 8. If a leaf item was selected, expand the blue circle to create the Detail Sector
        Logger.debug('🔵 DETAIL SECTOR CHECK: itemLevel =', itemLevel, 'item.__isLeaf =', item.__isLeaf);

        const nextLevel = this.getNextHierarchyLevel(itemLevel);
        let childItems = null;
        let isLeaf = false;

        if (!nextLevel) {
            isLeaf = true;
            this.leafStateCache.set(this.getLeafCacheKey(item, null), true);
        } else {
            childItems = this.getChildItemsForLevel(item, nextLevel);
            isLeaf = !childItems || childItems.length === 0;
            this.leafStateCache.set(this.getLeafCacheKey(item, nextLevel), isLeaf);
        }

        item.__isLeaf = isLeaf;

        if (isLeaf) {
            Logger.debug('🔵 Leaf item detected - routing to Detail Sector handler:', item.name);
            this.handleLeafFocusSelection(item);
        }

        // 6. Update Parent Button to show the parent level
        const parentName = this.getParentNameForLevel(item, parentLevel);
        this.updateParentButton(parentName);

        // 7. Get children for the next level and show in Child Pyramid
        // Skip this for leaf items since they show the Detail Sector instead
        if (!isLeaf && nextLevel) {
            const itemType = this.getLevelPluralLabel(nextLevel);
            const itemsToShow = childItems || [];

            setTimeout(() => {
                if (itemsToShow.length > 0) {
                    this.childPyramid.showChildPyramid(itemsToShow, itemType);
                    Logger.debug(`🔺 Showing ${itemsToShow.length} ${itemType} in Child Pyramid for ${itemLevel}:`, item.name);
                } else {
                    Logger.warn(`🔺 No ${itemType} found for ${itemLevel}:`, item.name);
                }
            }, 300);
        } else {
            // For leaf items, hide the Child Pyramid since Detail Sector is shown
            setTimeout(() => {
                this.elements.childRingGroup.innerHTML = '';
                this.elements.childRingGroup.classList.add('hidden');
                Logger.debug('🔺 Detail Sector shown - Child Pyramid hidden for leaf item:', item.name);
            }, 300);
        }

        Logger.debug(`🔺 ${itemLevel} nzone migration complete`);
    }

    /**
     * Get the display name for a parent level
     */
    getParentNameForLevel(item, parentLevel) {
        if (!item.__path || item.__path.length === 0) {
            return parentLevel;
        }
        const levelNames = this.getHierarchyLevelNames();
        const parentIndex = levelNames.indexOf(parentLevel);
        return item.__path[parentIndex] || parentLevel;
    }

    /**
     * Build a parent item from a child item for navigation purposes
     */
    buildParentItemFromChild(childItem, parentLevel) {
        if (!childItem.__path) {
            Logger.warn('buildParentItemFromChild: Child item missing __path metadata');
            return {};
        }

        const levelNames = this.getHierarchyLevelNames();
        const parentIndex = levelNames.indexOf(parentLevel);
        if (parentIndex === -1) {
            Logger.warn(`buildParentItemFromChild: Unknown parent level "${parentLevel}"`);
            return {};
        }

        // Build parent item from the path slice up to parentLevel
        const parentItem = {
            __level: parentLevel,
            __levelDepth: parentIndex,
            __path: childItem.__path.slice(0, parentIndex + 1),
            __isLeaf: false,
            key: childItem.__path.slice(0, parentIndex + 1).join('/')
        };

        // Reconstruct actual data properties from __path for legacy method compatibility
        // TODO: Remove this once getItemsAtLevel is refactored to use only metadata
        for (let i = 0; i <= parentIndex; i++) {
            const levelName = levelNames[i];
            const pathValue = childItem.__path[i];
            
            // Generic property mapping - property name matches level name
            parentItem[levelName] = pathValue;
            
            // Additional property aliases for legacy compatibility
            if (levelName === parentLevel && !parentItem.name) {
                parentItem.name = pathValue;
            }
            
            // Handle numeric conversions for count-based levels
            const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
            if (levelConfig && levelConfig.is_numeric) {
                const countProperty = levelName + 'Count';
                parentItem[countProperty] = parseInt(pathValue);
            }
            
            // Handle code-based properties
            if (levelConfig && levelConfig.use_code_property) {
                const codeProperty = levelName + 'Code';
                parentItem[codeProperty] = pathValue;
            }
        }

        if (!parentItem.name) {
            parentItem.name = childItem.__path[parentIndex];
        }

        return parentItem;
    }

    /**
     * Find the index of an item in an array based on level-specific matching
     */
    findItemIndexInArray(item, array, level) {
        const index = array.findIndex(sibling => sibling.key === item.key);
        
        if (index === -1) {
            Logger.warn(`🔺 findItemIndexInArray: Item key "${item.key}" not found in array of ${array.length} items`);
            Logger.warn(`🔺 Item keys in array:`, array.map(s => s.key));
            Logger.warn(`🔺 Searching for item:`, item);
        }
        
        return index;
    }

    /**
     * Expand the Detail Sector when a leaf item is selected
     * Animates the blue circle from upper right to focus ring center
     */
    expandDetailSector() {
        Logger.debug('🔵 expandDetailSector() called - animating blue circle and logo');
        this.detailSectorAnimating = true;
        const arcParams = this.viewport.getArcParameters();
        
        const detailCircle = document.getElementById('detailSectorCircle');
        const detailLogo = document.getElementById('detailSectorLogo');
        
        if (!detailCircle || !detailLogo) {
            Logger.error('🔵 Detail Sector elements not found for expansion');
            this.detailSectorAnimating = false;
            return;
        }
        
        // Calculate circle START position (upper right corner)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const margin = shorterSide * 0.03;
        const startRadius = shorterSide * 0.12;
        
        // Calculate logo dimensions for proper positioning
        const logoScaleFactor = 1.8;
        const startLogoWidth = startRadius * 2 * logoScaleFactor;
        const logoAspectRatio = 154 / 134;
        const startLogoHeight = startLogoWidth / logoAspectRatio;
        const logoHalfWidth = startLogoWidth / 2;
        
        // Circle START position
        const circleStartX = (viewportWidth / 2) - logoHalfWidth - margin;
        const circleStartY = -(viewportHeight / 2) + startRadius + margin;
        
        // Logo START position (top-left corner for image element)
        const logoStartX = circleStartX - (startLogoWidth / 2);
        const logoStartY = circleStartY - (startLogoHeight / 2);
        
        // Calculate circle END position (focus ring center)
        const circleEndX = arcParams.centerX;
        const circleEndY = arcParams.centerY;
        const endRadius = arcParams.radius * 0.98;
        
        // Calculate logo END position (centered horizontally, same top buffer)
        const logoEndState = this.getDetailSectorLogoEndState();
        
        // Opacity animation values
        const startOpacity = 0.5;
        const circleEndOpacity = 1.0;
        const logoEndOpacity = 0.10;
        
        // Rotation animation values
        const startRotation = 0; // Initial logo has no rotation
        const magnifierAngle = this.viewport.getCenterAngle();
        const endRotation = (magnifierAngle * 180 / Math.PI) - 180; // Match test logo rotation (CCW)
        
        // Animate to END state
        const duration = 600; // ms
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Interpolate circle position, radius, and opacity
            const currentCircleX = circleStartX + (circleEndX - circleStartX) * eased;
            const currentCircleY = circleStartY + (circleEndY - circleStartY) * eased;
            const currentRadius = startRadius + (endRadius - startRadius) * eased;
            const currentCircleOpacity = startOpacity + (circleEndOpacity - startOpacity) * eased;
            
            // Interpolate logo position and size
            const currentLogoX = logoStartX + (logoEndState.x - logoStartX) * eased;
            const currentLogoY = logoStartY + (logoEndState.y - logoStartY) * eased;
            const currentLogoWidth = startLogoWidth + (logoEndState.width - startLogoWidth) * eased;
            const currentLogoHeight = startLogoHeight + (logoEndState.height - startLogoHeight) * eased;
            const currentLogoOpacity = startOpacity + (logoEndOpacity - startOpacity) * eased;
            const currentRotation = startRotation + (endRotation - startRotation) * eased;
            
            // Apply animated values to circle
            detailCircle.setAttribute('cx', currentCircleX);
            detailCircle.setAttribute('cy', currentCircleY);
            detailCircle.setAttribute('r', currentRadius);
            detailCircle.setAttribute('opacity', currentCircleOpacity);
            
            // Apply animated values to logo
            detailLogo.setAttribute('x', currentLogoX);
            detailLogo.setAttribute('y', currentLogoY);
            detailLogo.setAttribute('width', currentLogoWidth);
            detailLogo.setAttribute('height', currentLogoHeight);
            detailLogo.setAttribute('opacity', currentLogoOpacity);
            
            // Apply rotation transform with current center as rotation point
            const currentCenterX = currentLogoX + currentLogoWidth / 2;
            const currentCenterY = currentLogoY + currentLogoHeight / 2;
            detailLogo.setAttribute('transform', `rotate(${currentRotation}, ${currentCenterX}, ${currentCenterY})`);
            
            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure exact END state for circle
                detailCircle.setAttribute('cx', circleEndX);
                detailCircle.setAttribute('cy', circleEndY);
                detailCircle.setAttribute('r', endRadius);
                detailCircle.setAttribute('opacity', '1.0'); // END state: 100% opacity
                
                // Ensure exact END state for logo
                detailLogo.setAttribute('x', logoEndState.x);
                detailLogo.setAttribute('y', logoEndState.y);
                detailLogo.setAttribute('width', logoEndState.width);
                detailLogo.setAttribute('height', logoEndState.height);
                detailLogo.setAttribute('opacity', '0.10'); // END state: 10% opacity
                
                // Apply rotation to match test logo
                const magnifierAngle = this.viewport.getCenterAngle();
                const rotationDegrees = (magnifierAngle * 180 / Math.PI) - 180;
                detailLogo.setAttribute('transform', `rotate(${rotationDegrees}, ${logoEndState.centerX}, ${logoEndState.centerY})`);
                
                // Calculate top buffer for debug logging
                const logoTopEdge = logoEndState.y;
                const screenTop = -(window.innerHeight / 2);
                const topBuffer = logoTopEdge - screenTop;
                
                Logger.debug(`🔵 Detail Sector animation COMPLETE - END STATE reached`);
                Logger.debug(`   Circle: (${circleEndX}, ${circleEndY}) r=${endRadius}px`);
                Logger.debug(`   Logo: (${logoEndState.x}, ${logoEndState.y}) ${logoEndState.width}x${logoEndState.height}px`);
                Logger.debug(`   Logo top edge: ${logoTopEdge.toFixed(1)}, Screen top: ${screenTop.toFixed(1)}`);
                Logger.debug(`   Logo top buffer from screen edge: ${topBuffer.toFixed(1)}px`);
                
                // Show detail content for the selected item
                if (this.selectedFocusItem) {
                    Logger.debug('📋 Displaying detail content for selected item:', this.selectedFocusItem.name);
                    this.detailSector.showDetailContent(this.selectedFocusItem);
                }

                this.detailSectorAnimating = false;
            }
        };
        
        // Start animation
        requestAnimationFrame(animate);
        
        Logger.debug(`🔵 Detail Sector animation STARTED`);
        Logger.debug(`   Circle FROM: (${circleStartX.toFixed(1)}, ${circleStartY.toFixed(1)}) r=${startRadius.toFixed(1)}`);
        Logger.debug(`   Circle TO: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
        Logger.debug(`   Logo FROM: ${startLogoWidth.toFixed(1)}x${startLogoHeight.toFixed(1)} TO: ${logoEndState.width}x${logoEndState.height}`);
    }

    /**
     * Collapse the Detail Sector when navigating away from leaf item
     * Animates from focus ring center back to upper right corner
     */
    collapseDetailSector() {
        const detailCircle = document.getElementById('detailSectorCircle');
        const detailLogo = document.getElementById('detailSectorLogo');
        
        if (!detailCircle || !detailLogo) {
            return;
        }

        this.detailSectorAnimating = true;
        
        // Hide detail content immediately when starting collapse
        this.detailSector.hideDetailContent();
        
        // Check if circle is already collapsed
        const currentRadius = parseFloat(detailCircle.getAttribute('r'));
        const vWidth = window.innerWidth;
        const vHeight = window.innerHeight;
        const shorter = Math.min(vWidth, vHeight);
        const collapsedRadius = shorter * 0.12;
        
        if (Math.abs(currentRadius - collapsedRadius) < 10) {
            Logger.debug('🔵 Detail Sector already collapsed - skipping animation');
            this.detailSectorAnimating = false;
            return;
        }
        
        // Get circle START state (expanded at focus ring center)
        const arcParams = this.viewport.getArcParameters();
        const circleStartX = arcParams.centerX;
        const circleStartY = arcParams.centerY;
        const startRadius = arcParams.radius * 0.98;
        
        // Get logo START state (centered horizontally, at top)
        const logoStartState = this.getDetailSectorLogoEndState();
        
        // Calculate circle END state (upper right corner)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const margin = shorterSide * 0.03;
        const endRadius = shorterSide * 0.12;
        
        // Calculate logo dimensions for END state
        const logoScaleFactor = 1.8;
        const endLogoWidth = endRadius * 2 * logoScaleFactor;
        const logoAspectRatio = 154 / 134;
        const endLogoHeight = endLogoWidth / logoAspectRatio;
        const logoHalfWidth = endLogoWidth / 2;
        
        // Circle END position
        const circleEndX = (viewportWidth / 2) - logoHalfWidth - margin;
        const circleEndY = -(viewportHeight / 2) + endRadius + margin;
        
        // Logo END position (top-left corner for image element)
        const logoEndX = circleEndX - (endLogoWidth / 2);
        const logoEndY = circleEndY - (endLogoHeight / 2);
        
        // Opacity animation values
        const startOpacity = 1.0;
        const endOpacity = 0.5;
        
        // Animate back to collapsed state
        const duration = 600; // ms
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Interpolate circle position, radius, and opacity
            const currentCircleX = circleStartX + (circleEndX - circleStartX) * eased;
            const currentCircleY = circleStartY + (circleEndY - circleStartY) * eased;
            const currentRadius = startRadius + (endRadius - startRadius) * eased;
            const currentOpacity = startOpacity + (endOpacity - startOpacity) * eased;
            
            // Interpolate logo position and size
            const currentLogoX = logoStartState.x + (logoEndX - logoStartState.x) * eased;
            const currentLogoY = logoStartState.y + (logoEndY - logoStartState.y) * eased;
            const currentLogoWidth = logoStartState.width + (endLogoWidth - logoStartState.width) * eased;
            const currentLogoHeight = logoStartState.height + (endLogoHeight - logoStartState.height) * eased;
            
            // Apply animated values to circle
            detailCircle.setAttribute('cx', currentCircleX);
            detailCircle.setAttribute('cy', currentCircleY);
            detailCircle.setAttribute('r', currentRadius);
            detailCircle.setAttribute('opacity', currentOpacity);
            
            // Apply animated values to logo
            detailLogo.setAttribute('x', currentLogoX);
            detailLogo.setAttribute('y', currentLogoY);
            detailLogo.setAttribute('width', currentLogoWidth);
            detailLogo.setAttribute('height', currentLogoHeight);
            detailLogo.setAttribute('opacity', currentOpacity);
            
            // Continue animation or finish
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Ensure exact collapsed state for circle
                detailCircle.setAttribute('cx', circleEndX);
                detailCircle.setAttribute('cy', circleEndY);
                detailCircle.setAttribute('r', endRadius);
                detailCircle.setAttribute('opacity', '0.5'); // START state: 50% opacity
                
                // Ensure exact collapsed state for logo
                detailLogo.setAttribute('x', logoEndX);
                detailLogo.setAttribute('y', logoEndY);
                detailLogo.setAttribute('width', endLogoWidth);
                detailLogo.setAttribute('height', endLogoHeight);
                detailLogo.setAttribute('opacity', '0.5'); // START state: 50% opacity
                
                Logger.debug(`🔵 Detail Sector collapse COMPLETE`);
                Logger.debug(`   Circle: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
                Logger.debug(`   Logo: ${endLogoWidth.toFixed(1)}x${endLogoHeight.toFixed(1)}`);

                this.detailSectorAnimating = false;
            }
        };
        
        // Start animation
        requestAnimationFrame(animate);
        
        Logger.debug(`🔵 Detail Sector collapse STARTED`);
        Logger.debug(`   Circle FROM: (${circleStartX.toFixed(1)}, ${circleStartY.toFixed(1)}) r=${startRadius.toFixed(1)}`);
        Logger.debug(`   Circle TO: (${circleEndX.toFixed(1)}, ${circleEndY.toFixed(1)}) r=${endRadius.toFixed(1)}`);
        Logger.debug(`   Logo FROM: ${logoStartState.width}x${logoStartState.height} TO: ${endLogoWidth.toFixed(1)}x${endLogoHeight.toFixed(1)}`);
    }
    
    /**
     * Create the Detail Sector circle at upper right corner
     * This circle animates to the focus ring center when a leaf item is selected
     */
    createDetailSectorCircle() {
        // Calculate radius as 12% of the shorter viewport dimension
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const radius = shorterSide * 0.12;
        
        // Calculate logo dimensions (needed for proper positioning)
        const logoScaleFactor = 1.8;
        const logoWidth = radius * 2 * logoScaleFactor;
        const logoHalfWidth = logoWidth / 2;
        
        // Calculate margin as 3% of shorter side for proportional spacing
        const margin = shorterSide * 0.03;
        
        // Position in upper right corner (origin at screen center)
        // Use logo half-width for right edge calculation since logo is wider than circle
        const cx = (viewportWidth / 2) - logoHalfWidth - margin;
        const cy = -(viewportHeight / 2) + radius + margin;
        
        // Create Detail Sector circle
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('id', 'detailSectorCircle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', '#362e6a'); // MMdM blue
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        circle.setAttribute('opacity', '0.5'); // START state: 50% opacity
        
        // Insert BEFORE detailItems group so text appears on top
        const detailItemsGroup = this.elements.detailItemsGroup;
        if (detailItemsGroup && detailItemsGroup.parentNode) {
            detailItemsGroup.parentNode.insertBefore(circle, detailItemsGroup);
            Logger.debug(`🔵 Detail Sector circle inserted BEFORE detailItems group`);
        } else {
            // Fallback: append to main group
            this.elements.mainGroup.appendChild(circle);
            Logger.warn(`🔵 detailItems group not found, appending circle to mainGroup`);
        }
        
        // Calculate top buffer for debug logging
        const circleTopEdge = cy - radius;
        const topBuffer = circleTopEdge - (-(viewportHeight / 2));
        
        Logger.debug(`🔵 Detail Sector circle created at (${cx.toFixed(1)}, ${cy.toFixed(1)}) with ${radius.toFixed(1)}px radius`);
        Logger.debug(`   Circle top edge: ${circleTopEdge.toFixed(1)}, Screen top: ${(-(viewportHeight/2)).toFixed(1)}`);
        Logger.debug(`   Circle top buffer from screen edge: ${topBuffer.toFixed(1)}px (margin: ${margin.toFixed(1)}px)`);
        
        // Create Detail Sector logo
        this.createDetailSectorLogo();
    }
    
    /**
     * Create the volume logo positioned over the Detail Sector circle
     * Logo is centered at the same position as the circle
     */
    createDetailSectorLogo() {
        // Calculate the same position as Detail Sector circle
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const shorterSide = Math.min(viewportWidth, viewportHeight);
        const radius = shorterSide * 0.12;
        
        // Scale logo relative to circle radius
        // Logo aspect ratio: 154:134 = ~1.149:1
        const logoAspectRatio = 154 / 134;
        const logoScaleFactor = 1.8; // Logo width = 180% of circle diameter (3.6× radius)
        const logoWidth = radius * 2 * logoScaleFactor;
        const logoHeight = logoWidth / logoAspectRatio;
        const logoHalfWidth = logoWidth / 2;
        
        // Calculate margin as 3% of shorter side for proportional spacing
        const margin = shorterSide * 0.03;
        
        // Position in upper right corner (origin at screen center)
        // Use logo half-width for right edge calculation
        const cx = (viewportWidth / 2) - logoHalfWidth - margin;
        const cy = -(viewportHeight / 2) + radius + margin;
        
        // Calculate top-left position to center logo over circle center
        const x = cx - (logoWidth / 2);
        const y = cy - (logoHeight / 2);
        
        // Create logo image element
        const logo = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'image');
        logo.setAttribute('id', 'detailSectorLogo');
        logo.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'assets/catalog_logo.png');
        logo.setAttribute('x', x);
        logo.setAttribute('y', y);
        logo.setAttribute('width', logoWidth);
        logo.setAttribute('height', logoHeight);
        logo.setAttribute('opacity', '0.5'); // START state: 50% opacity
        
        // Add to main group
        this.elements.mainGroup.appendChild(logo);
        
        Logger.debug(`🔵 Detail Sector logo created at (${x.toFixed(1)}, ${y.toFixed(1)}) with size ${logoWidth.toFixed(1)}x${logoHeight.toFixed(1)} (${logoScaleFactor * 100}% of circle diameter)`);
    }

    /**
     * VOLUME SELECTOR MODE
     * Show the volume selector interface
     */
    showVolumeSelector(volumes, onSelectCallback) {
        Logger.debug('📖 Showing volume selector with', volumes.length, 'volumes');
        
        this.volumeSelectionCallback = onSelectCallback;
        this.volumeItems = volumes.map((volume, index) => ({
            name: volume.name,
            description: volume.description,
            filename: volume.filename,
            __volumeData: volume,
            __index: index
        }));
        
        // 1. Expand Detail Sector with message
        this.showVolumeSelectorMessage();
        
        // 2. Show volumes in Focus Ring
        this.showVolumesInFocusRing();
        
        // 3. Show "Explore" button
        this.showExploreButton();
        
        Logger.debug('📖 Volume selector UI displayed');
    }

    /**
     * Show "What would you like to see?" message in expanded Detail Sector
     */
    showVolumeSelectorMessage() {
        const detailCircle = document.getElementById('detailSectorCircle');
        const detailLogo = document.getElementById('detailSectorLogo');
        
        if (!detailCircle || !detailLogo) {
            Logger.error('Detail Sector elements not found');
            return;
        }
        
        // Calculate expanded state
        const arcParams = this.viewport.getArcParameters();
        const endRadius = arcParams.radius * 0.98;
        const endX = arcParams.centerX;
        const endY = arcParams.centerY;
        
        // Move circle to expanded state (center of focus ring)
        detailCircle.setAttribute('cx', endX);
        detailCircle.setAttribute('cy', endY);
        detailCircle.setAttribute('r', endRadius);
        detailCircle.setAttribute('opacity', '1.0');
        
        // Position logo
        const logoEndState = this.getDetailSectorLogoEndState();
        detailLogo.setAttribute('x', logoEndState.x);
        detailLogo.setAttribute('y', logoEndState.y);
        detailLogo.setAttribute('width', logoEndState.width);
        detailLogo.setAttribute('height', logoEndState.height);
        detailLogo.setAttribute('opacity', '0.10');
        
        // Create message text
        const messageGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        messageGroup.setAttribute('id', 'catalogSelectorMessage');
        
        const message = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        message.setAttribute('x', endX);
        message.setAttribute('y', endY);
        message.setAttribute('text-anchor', 'middle');
        message.setAttribute('dominant-baseline', 'middle');
        message.setAttribute('fill', '#f1b800');
        message.setAttribute('font-family', 'Montserrat, sans-serif');
        message.setAttribute('font-size', '24');
        message.setAttribute('font-weight', '700');
        message.textContent = 'What would you like to see?';
        
        messageGroup.appendChild(message);
        
        // Add version number in upper-right corner
        const versionText = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        versionText.setAttribute('id', 'versionText');
        const viewport = this.viewport.getViewportInfo();
        versionText.setAttribute('x', (viewport.width / 2) - 15);
        versionText.setAttribute('y', -(viewport.height / 2) + 25);
        versionText.setAttribute('text-anchor', 'end');
        versionText.setAttribute('dominant-baseline', 'hanging');
        versionText.setAttribute('fill', '#333333');
        versionText.setAttribute('font-family', 'Montserrat, sans-serif');
        versionText.setAttribute('font-size', '22');
        versionText.setAttribute('font-weight', '600');
        versionText.setAttribute('opacity', '1.0');
        versionText.textContent = VERSION.display();
        
        messageGroup.appendChild(versionText);
        this.elements.mainGroup.appendChild(messageGroup);
        
        Logger.debug('📖 Catalog selector message displayed in Detail Sector');
        Logger.debug(`📋 Version: ${VERSION.display()}`);
    }

    /**
     * Show available volumes in the Focus Ring
     */
    showVolumesInFocusRing() {
        const focusRingGroup = this.elements.focusRingGroup;
        if (!focusRingGroup) {
            Logger.error('Focus ring group not found');
            return;
        }
        
        // Clear any existing focus items
        while (focusRingGroup.firstChild) {
            focusRingGroup.removeChild(focusRingGroup.firstChild);
        }
        
        // Show focus ring
        focusRingGroup.classList.remove('hidden');
        
        // Position volume items in focus ring
        this.updateVolumeSelectorPositions(0);
        
        // Add click handlers to volume items
        this.addVolumeClickHandlers();
        
        Logger.debug('📖 Volumes displayed in Focus Ring');
    }

    /**
     * Update positions of volumes in the Focus Ring
     */
    updateVolumeSelectorPositions(rotationOffset) {
        const focusRingGroup = this.elements.focusRingGroup;
        if (!focusRingGroup) return;
        
        // Clear existing elements
        while (focusRingGroup.firstChild) {
            focusRingGroup.removeChild(focusRingGroup.firstChild);
        }
        
        const arcParams = this.viewport.getArcParameters();
        const centerAngle = this.viewport.getCenterAngle();
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        
        const middleIndex = (this.volumeItems.length - 1) / 2;
        
        this.volumeItems.forEach((volume, index) => {
            const offsetFromMiddle = index - middleIndex;
            const itemAngle = centerAngle + (offsetFromMiddle * angleStep) + rotationOffset;
            
            // Position on arc
            const x = arcParams.centerX + arcParams.radius * Math.cos(itemAngle);
            const y = arcParams.centerY + arcParams.radius * Math.sin(itemAngle);
            
            // Check if this volume is centered (selected)
            const isCentered = Math.abs(offsetFromMiddle * angleStep + rotationOffset) < angleStep / 2;
            
            // Create a proper focus node element using the existing method
            const volumeFocusItem = {
                name: volume.name,
                __level: 'volume_selector',
                __volumeData: volume,
                __index: index
            };
            
            const focusElement = this.createFocusElement(
                volumeFocusItem,
                { x, y },
                itemAngle,
                isCentered
            );
            
            // Add volume-specific attributes
            focusElement.setAttribute('data-volume-index', index);
            focusElement.classList.add('volume-selector-item');
            focusElement.style.cursor = 'pointer';
            
            focusRingGroup.appendChild(focusElement);
        });
        
        Logger.debug(`📖 Updated ${this.volumeItems.length} volume positions`);
    }

    /**
     * Add click handlers to volume items
     */
    addVolumeClickHandlers() {
        const focusRingGroup = this.elements.focusRingGroup;
        if (!focusRingGroup) return;
        
        focusRingGroup.addEventListener('click', (e) => {
            // Find the volume item group (might click on circle or text inside it)
            let target = e.target;
            while (target && !target.classList.contains('volume-selector-item')) {
                target = target.parentElement;
                if (target === focusRingGroup) break; // Reached top without finding item
            }
            
            if (target && target.classList.contains('volume-selector-item')) {
                const index = parseInt(target.getAttribute('data-volume-index'));
                const volume = this.volumeItems[index];
                Logger.debug(`📖 Volume selected: ${volume.name}`);
                
                if (this.volumeSelectionCallback && volume.__volumeData) {
                    this.volumeSelectionCallback(volume.__volumeData);
                }
            }
        });
    }

    /**
     * Show "Explore" button in Parent Button position
     */
    showExploreButton() {
        const parentButton = document.getElementById('parentButton');
        if (!parentButton) {
            Logger.error('Parent button not found');
            return;
        }
        
        const parentText = document.getElementById('parentText');
        if (parentText) {
            parentText.textContent = 'Explore';
        }
        
        parentButton.classList.remove('hidden');
        
        // Make button trigger volume selection when clicked
        parentButton.setAttribute('data-volume-selector-mode', 'true');
        
        Logger.debug('📖 Explore button displayed');
    }

    /**
     * Transition from catalog selector to normal navigation
     */
    async transitionFromVolumeSelector() {
        Logger.debug('📖 Transitioning from volume selector to normal navigation');
        
        // 1. Remove volume selector message
        const messageGroup = document.getElementById('catalogSelectorMessage');
        if (messageGroup) {
            messageGroup.remove();
        }
        
        // 2. Collapse Detail Sector
        this.collapseDetailSector();
        
        // 3. Clear Focus Ring (will be repopulated with actual volume data)
        const focusRingGroup = this.elements.focusRingGroup;
        if (focusRingGroup) {
            while (focusRingGroup.firstChild) {
                focusRingGroup.removeChild(focusRingGroup.firstChild);
            }
        }
        
        // 4. Hide Parent Button temporarily (will be shown by normal navigation)
        const parentButton = document.getElementById('parentButton');
        if (parentButton) {
            parentButton.classList.add('hidden');
            parentButton.removeAttribute('data-volume-selector-mode');
        }
        
        // 5. Clear fan lines (will be drawn by normal navigation)
        this.clearFanLines();
        
        Logger.debug('📖 Transition complete - ready for normal navigation');
    }

    
    /**
     * Calculate END state position and size for Detail Sector logo
     * Returns logo dimensions and position for expanded state
     * Uses same calculation as test logo for consistency
     */
    getDetailSectorLogoEndState() {
        // Get Focus Ring parameters (same as test logo)
        const arcParams = this.viewport.getArcParameters();
        const focusRingRadius = arcParams.radius;
        
        // Get magnifier angle (same as test logo)
        const magnifierAngle = this.viewport.getCenterAngle();
        
        // Logo dimensions: 100% of Focus Ring radius for width (same as test logo)
        const logoAspectRatio = 154 / 134; // Original aspect ratio
        const logoWidth = focusRingRadius * 1.0;
        const logoHeight = logoWidth / logoAspectRatio;
        
        // Position center of logo along magnifier angle at -35% of Focus Ring radius (same as test logo)
        const logoCenterRadius = focusRingRadius * -0.35;
        const logoCenterX = logoCenterRadius * Math.cos(magnifierAngle);
        const logoCenterY = logoCenterRadius * Math.sin(magnifierAngle);
        
        // Position logo so its center is at the calculated point
        const endX = logoCenterX - (logoWidth / 2);
        const endY = logoCenterY - (logoHeight / 2);
        
        // Debug calculation
        Logger.debug(`🔵 getDetailSectorLogoEndState() calculation (matching test logo):`);
        Logger.debug(`   Focus Ring radius: ${focusRingRadius.toFixed(1)}`);
        Logger.debug(`   Logo center at (${logoCenterX.toFixed(1)}, ${logoCenterY.toFixed(1)}) (-35% of radius)`);
        Logger.debug(`   Logo size: ${logoWidth.toFixed(1)}x${logoHeight.toFixed(1)} (100% of radius)`);
        Logger.debug(`   Logo position: (${endX.toFixed(1)}, ${endY.toFixed(1)})`);
        
        return {
            x: endX,
            y: endY,
            width: logoWidth,
            height: logoHeight,
            centerX: logoCenterX,
            centerY: logoCenterY
        };
    }
}

export { MobileRenderer };
