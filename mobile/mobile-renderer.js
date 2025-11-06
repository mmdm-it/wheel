/**
 * Mobile Catalog Renderer
 * Efficient renderer that minimizes DOM manipulation for mobile performance
 * 
 * This is part of the modular mobile catalog system.
 * Edit this file directly - no bundling required.
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { MobileChildPyramid } from './mobile-childpyramid.js';

/**
 * Efficient renderer that minimizes DOM manipulation
 */
class MobileRenderer {
    constructor(viewportManager, dataManager) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        
        // Initialize Child Pyramid module
        this.childPyramid = new MobileChildPyramid(viewportManager, dataManager, this);
        
        // DOM element caches
        this.elements = {};
        this.focusElements = new Map();
        this.positionCache = new Map();
        
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
            Logger.debug('No next level - this is a leaf node');
            return;
        }

        Logger.debug(`Focus item is at level '${currentLevel}', getting '${nextLevel}' items`);

        // Get child items at the immediate next level
        const childItems = this.getChildItemsForLevel(focusItem, nextLevel);
        
        if (!childItems || childItems.length === 0) {
            Logger.debug(`No ${nextLevel} items found for ${currentLevel}: ${focusItem.name} - this is a leaf node`);
            return;
        }

        const itemType = nextLevel === 'model' ? 'models' : nextLevel === 'family' ? 'families' : nextLevel + 's';
        Logger.debug(`Found ${childItems.length} ${itemType} for ${currentLevel}: ${focusItem.name}`);

        // Show child items in Child Pyramid
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
        
        // For odd number of focus items, middle focus item is already centered
        if (this.currentFocusItems.length % 2 === 1) {
            return 0;
        }
        
        // For even number of focus items, we need to snap to the nearest focus item
        // The center falls between two focus items at indices floor(middleIndex) and ceil(middleIndex)
        // We'll snap to the lower index focus item (more intuitive)
        const targetIndex = Math.floor(middleIndex);
        
        // Calculate offset needed to center this focus item
        // When rotationOffset = 0: focus item at index i has angle: centerAngle + (i - middleIndex) * angleStep
        // To center focus item at targetIndex: angle should be centerAngle
        // So: centerAngle + offset + (targetIndex - middleIndex) * angleStep = centerAngle
        // Therefore: offset = -(targetIndex - middleIndex) * angleStep
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
        
        // Process all focus items but only render those in viewport window
        allFocusItems.forEach((focusItem, index) => {
            // Calculate angle using original logic
            const angle = adjustedCenterAngle + (index - (allFocusItems.length - 1) / 2) * angleStep;
            
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
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.detailItemsGroup.classList.add('hidden');
            this.clearFanLines();
            
            // Update Parent Button to show the parent level name
            const parentLevel = this.getPreviousHierarchyLevel(this.getItemHierarchyLevel(selectedFocusItem));
            const parentName = parentLevel ? this.getParentNameForLevel(selectedFocusItem, parentLevel) : null;
            this.updateParentButton(parentName);
            
            // Set timeout to show appropriate child content after settling
            this.settleTimeout = setTimeout(() => {
                this.isRotating = false;
                if (this.selectedFocusItem && this.selectedFocusItem.key === selectedFocusItem.key) {
                    const angle = adjustedCenterAngle + (selectedIndex - (allFocusItems.length - 1) / 2) * angleStep;
                    Logger.debug('Focus item settled:', selectedFocusItem.name, 'showing child content');
                    this.showChildContentForFocusItem(selectedFocusItem, angle);
                }
            }, MOBILE_CONFIG.TIMING.FOCUS_ITEM_SETTLE_DELAY);
            
        } else if (this.selectedFocusItem) {
            // Hide child ring when no focus item is selected
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
            Logger.debug(`Applied selected class to focus item: ${element.querySelector('text')?.textContent}`);
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
        const textPosition = levelConfig?.focus_text_position || 'radial';
        const textTransform = levelConfig?.focus_text_transform || 'none';
        
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
        // Get color from display configuration
        const levelConfig = this.dataManager.getHierarchyLevelConfig(type);
        return levelConfig?.color || '#f1b800'; // Default to yellow if not configured
    }
    
    getColorForType(type) {
        return this.getColor(type, '');
    }
    
    /**
     * Get the hierarchy levels configuration
     */
    getHierarchyLevels() {
        return this.dataManager.getDisplayConfig()?.hierarchy_levels || {};
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
        this.focusItemElements.clear();
        this.positionCache.clear();
        
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

        Logger.debug(`🔺 ${itemLevel} clicked:`, item.name);

        // 1. Update the navigation state - this item becomes the new focus
        this.buildActivePath(item);
        this.activeType = itemLevel;
        this.selectedFocusItem = { ...item };

        // 2. Get all siblings at the same level and move them to Focus Ring
        const parentLevel = this.getPreviousHierarchyLevel(itemLevel);
        const parentItem = this.buildParentItemFromChild(item, parentLevel);
        const allSiblings = this.getChildItemsForLevel(parentItem, itemLevel);

        this.currentFocusItems = allSiblings;
        this.allFocusItems = allSiblings;

        // 3. Clear current Child Pyramid immediately to remove child item nodes
        this.elements.childRingGroup.innerHTML = '';
        this.elements.childRingGroup.classList.add('hidden');

        // 4. Set up touch rotation FIRST (this creates the touch handler)
        if (window.mobileCatalogApp) {
            window.mobileCatalogApp.setupTouchRotation(allSiblings);
            Logger.debug('🔺 Touch rotation re-setup for', allSiblings.length, itemLevel + 's');
        }

        // 5. Find the clicked item in the siblings and center it
        const clickedIndex = this.findItemIndexInArray(item, allSiblings, itemLevel);
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (allSiblings.length - 1) / 2;
        const centerOffset = -(clickedIndex - middleIndex) * angleStep;

        // Set the touch handler's rotation offset directly
        if (window.mobileCatalogApp && window.mobileCatalogApp.touchHandler) {
            window.mobileCatalogApp.touchHandler.rotationOffset = centerOffset;
        }

        // Update Focus Ring with siblings - clicked item should be centered
        this.updateFocusRingPositions(centerOffset);

        Logger.debug(`🔺 Focus Ring updated with ${allSiblings.length} ${itemLevel}s, selected:`, item.name);

        // 8. If a leaf item was selected, expand the blue circle to create the Detail Sector
        if (itemLevel === 'model') {
            this.expandDetailSector();
        } else {
            this.collapseDetailSector();
        }

        // 6. Update Parent Button to show the parent level
        const parentName = this.getParentNameForLevel(item, parentLevel);
        this.updateParentButton(parentName);

        // 7. Get children for the next level and show in Child Pyramid
        // Skip this for leaf items since they show the Detail Sector instead
        if (itemLevel !== 'model') {
            const nextLevel = this.getNextHierarchyLevel(itemLevel);
            if (nextLevel) {
                const childItems = this.getChildItemsForLevel(item, nextLevel);

                setTimeout(() => {
                    if (childItems && childItems.length > 0) {
                        const itemType = nextLevel === 'model' ? 'models' : nextLevel === 'family' ? 'families' : nextLevel + 's';
                        this.childPyramid.showChildPyramid(childItems, itemType);
                        Logger.debug(`🔺 Showing ${childItems.length} ${itemType} in Child Pyramid for ${itemLevel}:`, item.name);
                    } else {
                        const itemTypePlural = nextLevel === 'family' ? 'families' : nextLevel + 's';
                        Logger.warn(`🔺 No ${itemTypePlural} found for ${itemLevel}:`, item.name);
                    }
                }, 300);
            }
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
            __isLeaf: false
        };

        // Reconstruct actual data properties from __path for legacy method compatibility
        // TODO: Remove this once getItemsAtLevel is refactored to use only metadata
        for (let i = 0; i <= parentIndex; i++) {
            const levelName = levelNames[i];
            const pathValue = childItem.__path[i];
            
            // Generic property mapping - property name matches level name
            parentItem[levelName] = pathValue;
            
            // Additional property aliases for legacy compatibility
            if (levelName === 'manufacturer') {
                parentItem.name = pathValue; // Some methods check .name
            }
            
            // Handle numeric conversions for count-based levels
            const levelConfig = this.dataManager.getHierarchyLevelConfig(levelName);
            if (levelConfig?.is_numeric) {
                const countProperty = levelName + 'Count';
                parentItem[countProperty] = parseInt(pathValue);
            }
            
            // Handle code-based properties
            if (levelConfig?.use_code_property) {
                const codeProperty = levelName + 'Code';
                parentItem[codeProperty] = pathValue;
            }
        }

        return parentItem;
    }

    /**
     * Find the index of an item in an array based on level-specific matching
     */
    findItemIndexInArray(item, array, level) {
        return array.findIndex(sibling => sibling.key === item.key);
    }

    /**
     * Expand the blue circle to create the Detail Sector when a leaf item is selected
     */
    expandDetailSector() {
        const arcParams = this.viewport.getArcParameters();
        const centralGroup = this.elements.centralGroup;
        const circle = centralGroup.querySelector('circle');
        
        // Position the central group at the focus ring center
        centralGroup.setAttribute('transform', `translate(${arcParams.centerX}, ${arcParams.centerY})`);
        
        // Set circle radius to 90% of focus ring radius
        const detailRadius = arcParams.radius * 0.9;
        circle.setAttribute('r', detailRadius);
        
        // Add detail sector class for additional styling
        centralGroup.classList.add('detail-sector');
        
        Logger.debug(`Detail Sector expanded: center=(${arcParams.centerX}, ${arcParams.centerY}), radius=${detailRadius}`);
    }

    /**
     * Collapse the Detail Sector when navigating away from leaf item level
     */
    collapseDetailSector() {
        const centralGroup = this.elements.centralGroup;
        const circle = centralGroup.querySelector('circle');
        
        // Calculate actual pixel values for viewport-based positioning
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const xPos = viewportWidth * 0.4; // 40vw
        const yPos = -viewportHeight * 0.45; // -45vh
        const radius = Math.min(viewportWidth * 0.1, viewportHeight * 0.1); // min(10vw, 10vh)
        
        // Reset to original positioning and size
        centralGroup.setAttribute('transform', `translate(${xPos}, ${yPos})`);
        circle.setAttribute('r', radius);
        
        // Remove detail sector class
        centralGroup.classList.remove('detail-sector');
        
        Logger.debug('Detail Sector collapsed');
    }
}

export { MobileRenderer };