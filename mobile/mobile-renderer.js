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
        this.selectedMarket = null;
        this.selectedFocusItem = null;
        this.currentFocusItems = [];
        this.activePath = [];
        this.activeType = null;
        
        // Settling state for smooth cylinder display
        this.isRotating = false;
        this.settleTimeout = null;
        
        // Sprocket chain viewport state
        this.allFocusItems = []; // Complete linear chain of all manufacturers
        this.chainPosition = 0; // Current position in the linear chain (0-based)
        this.visibleStartIndex = 0; // First visible manufacturer index
        this.visibleEndIndex = 0; // Last visible manufacturer index
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
            'catalogSvg', 'mainGroup', 'centralGroup', 'markets', 
            'pathLines', 'focusRing', 'models'
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
                           id === 'markets' ? 'marketsGroup' :
                           id === 'pathLines' ? 'pathLinesGroup' :
                           id === 'focusRing' ? 'focusRingGroup' :
                           id === 'childRing' ? 'childRingGroup' :
                           id === 'models' ? 'modelsGroup' :
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
        // Build active path based on the item's hierarchy properties
        const path = [];
        const levelNames = this.getHierarchyLevelNames();

        // Add each level's value if it exists on the item
        for (const levelName of levelNames) {
            let value = null;

            // Map level names to item properties
            switch (levelName) {
                case 'market':
                    value = focusItem.market;
                    break;
                case 'country':
                    value = focusItem.country;
                    break;
            case 'manufacturer':
                value = focusItem.manufacturer || focusItem.name;
                break;
                case 'cylinder':
                    value = focusItem.cylinderCount ? `${focusItem.cylinderCount} Cylinders` : null;
                    break;
                case 'family':
                    value = focusItem.familyCode || focusItem.name;
                    break;
                case 'model':
                    value = focusItem.engine_model;
                    break;
            }

            if (value) {
                path.push(value);
            }
        }

        this.activePath = path;
        Logger.debug('Built active path:', path);
    }
    
    showChildContentForFocusItem(focusItem, angle) {
        Logger.debug('Showing child content for focus item:', focusItem.name);

        // Determine the hierarchy level of the focus item
        const currentLevel = this.getItemHierarchyLevel(focusItem);
        if (!currentLevel) {
            Logger.warn('Could not determine hierarchy level for focus item:', focusItem);
            return;
        }

        // Get the next hierarchy level, skipping empty levels
        let nextLevel = this.getNextHierarchyLevel(currentLevel);
        let childItems = [];
        let itemType = '';

        // Loop through hierarchy levels until we find one with items or reach the end
        while (nextLevel) {
            Logger.debug(`Focus item is at level '${currentLevel}', checking '${nextLevel}' items`);

            // Get child items based on the next level type
            childItems = this.getChildItemsForLevel(focusItem, nextLevel);
            
            if (childItems && childItems.length > 0) {
                // Found items at this level
                itemType = nextLevel === 'model' ? 'models' : nextLevel === 'family' ? 'families' : nextLevel + 's';
                Logger.debug(`Found ${childItems.length} ${itemType} for ${currentLevel}: ${focusItem.name}`);
                break;
            } else {
                // No items at this level, try the next one
                Logger.debug(`No ${nextLevel} items found for ${currentLevel}: ${focusItem.name}, skipping to next level`);
                nextLevel = this.getNextHierarchyLevel(nextLevel);
            }
        }

        if (!nextLevel || !childItems || childItems.length === 0) {
            Logger.debug('No child items found at any level - this is a leaf node');
            return;
        }

        // Show child items in Child Pyramid
        this.childPyramid.showChildPyramid(childItems, itemType);
    }

    /**
     * Get child items for a specific hierarchy level
     */
    getChildItemsForLevel(parentItem, childLevel) {
        // Use the actual data access methods based on the parent item's level and desired child level
        const parentLevel = this.getItemHierarchyLevel(parentItem);

        switch (childLevel) {
            case 'manufacturer':
                // From market level, get manufacturers
                if (parentLevel === 'market') {
                    return this.dataManager.getManufacturers(parentItem.market);
                }
                break;
            case 'cylinder':
                // From manufacturer level, get cylinders
                if (parentLevel === 'manufacturer') {
                    return this.dataManager.getCylinders(parentItem.market, parentItem.country, parentItem.manufacturer || parentItem.name);
                }
                break;
            case 'family':
                // From cylinder level, get families
                if (parentLevel === 'cylinder') {
                    return this.dataManager.getFamilies(parentItem.market, parentItem.country, parentItem.manufacturer || parentItem.name, parentItem.cylinderCount.toString());
                }
                break;
            case 'model':
                // From cylinder level (no families) or family level, get models
                if (parentLevel === 'cylinder') {
                    // Check if we have families first
                    const families = this.dataManager.getFamilies(parentItem.market, parentItem.country, parentItem.manufacturer, parentItem.cylinderCount.toString());
                    if (families && families.length > 0) {
                        // If families exist, we shouldn't get models directly from cylinder
                        // Instead, the families will be shown first
                        return [];
                    } else {
                        // No families - get models directly
                        return this.dataManager.getModels(parentItem.market, parentItem.country, parentItem.manufacturer || parentItem.name, parentItem.cylinderCount.toString());
                    }
                } else if (parentLevel === 'family') {
                    // From family level, get models for that family
                    return this.dataManager.getModelsByFamily(parentItem.market, parentItem.country, parentItem.manufacturer, parentItem.cylinderCount.toString(), parentItem.familyCode);
                }
                break;
        }

        Logger.warn(`Cannot get ${childLevel} items for ${parentLevel} parent:`, parentItem);
        return [];
    }
    
    renderMarkets() {
        const marketsGroup = this.elements.marketsGroup;
        marketsGroup.innerHTML = '';
        
        const markets = this.dataManager.getMarkets();
        if (markets.length === 0) {
            Logger.warn('No markets found to render');
            return;
        }
        
        const positions = this.viewport.getMarketPositions();
        
        markets.forEach((market, index) => {
            if (index >= positions.length) {
                Logger.warn(`No position defined for market ${index}: ${market}`);
                return;
            }
            
            const position = positions[index];
            const marketGroup = this.createMarketElement(market, position);
            marketsGroup.appendChild(marketGroup);
        });
        
        Logger.debug('Markets rendered:', markets.length);
    }
    
    createMarketElement(market, position) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        g.setAttribute('class', 'marketGroup');
        
        // Market text with configurable formatting
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        text.setAttribute('class', 'marketText');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dy', '0.35em');
        text.textContent = this.formatText(market, 'market');
        g.appendChild(text);
        
        // Hit area
        const hitArea = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        hitArea.setAttribute('class', 'marketHitArea');
        hitArea.setAttribute('cx', '0');
        hitArea.setAttribute('cy', '0');
        hitArea.setAttribute('r', '60');
        hitArea.setAttribute('fill', 'transparent');
        hitArea.style.cursor = 'pointer';
        g.appendChild(hitArea);
        
        // Event handling
        hitArea.addEventListener('click', () => this.handleMarketSelection(market, g));
        
        return g;
    }
    
    handleMarketSelection(market, marketElement) {
        if (this.selectedMarket === market) {
            Logger.debug('Market already selected:', market);
            return;
        }

        Logger.debug('Market selected:', market);
        this.selectedMarket = market;
        this.activeType = 'market';
        this.activePath = [market];

        // Update market visuals
        this.updateMarketVisuals(marketElement);

        // Update center node
        this.updateCenterNodeState(true);

        // Add timestamp for testing
        this.addTimestampToCenter();

        // Get child items for the first hierarchy level (typically countries)
        const firstLevel = this.getHierarchyLevelNames()[0];
        const nextLevel = this.getNextHierarchyLevel(firstLevel);
        if (nextLevel) {
            this.currentFocusItems = this.getChildItemsForLevel({ market }, nextLevel);
        } else {
            this.currentFocusItems = [];
        }

        if (this.currentFocusItems.length === 0) {
            Logger.warn('No focus items found for market:', market);
            return;
        }

        // Show focus ring and set up rotation
        this.showFocusRing();
    }
    
    updateMarketVisuals(selectedElement) {
        const marketGroups = document.querySelectorAll('.marketGroup');
        
        marketGroups.forEach(group => {
            if (group === selectedElement) {
                group.classList.add('active');
                group.classList.remove('inactive');
            } else {
                group.classList.add('inactive');
                group.classList.remove('active');
            }
        });
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
        
        Logger.debug(`Viewport filtering initialized: ${this.allFocusItems.length} total manufacturers`);
        
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
        // To center manufacturer at targetIndex: angle should be centerAngle
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
        
        // Process all manufacturers but only render those in viewport window
        allFocusItems.forEach((focusItem, index) => {
            // Calculate angle using original logic
            const angle = adjustedCenterAngle + (index - (allFocusItems.length - 1) / 2) * angleStep;
            
            // Validate calculated angle
            if (isNaN(angle)) {
                Logger.error(`Invalid calculated angle for focus item ${index}: ${angle}`);
                return;
            }
            
            // Check if this manufacturer should be visible (viewport filter)
            const angleDiff = Math.abs(angle - centerAngle);
            const maxViewportAngle = MOBILE_CONFIG.VIEWPORT.VIEWPORT_ARC / 2;
            
            if (angleDiff <= maxViewportAngle) {
                // This manufacturer is in the viewport - render it
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
            this.elements.modelsGroup.classList.add('hidden');
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
            }, MOBILE_CONFIG.TIMING.CYLINDER_SETTLE_DELAY);
            
        } else if (this.selectedFocusItem) {
            // Hide child ring when no focus item is selected
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.modelsGroup.classList.add('hidden');
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
    
    createFocusElement(manufacturer, position, angle, isSelected = false) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.classList.add('manufacturer');
        g.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('class', 'node');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', isSelected ? MOBILE_CONFIG.RADIUS.MAGNIFIED : MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', this.getColor('manufacturer', manufacturer.name));
        
        if (isSelected) {
            g.classList.add('selected');
        }
        
        // No strokes on focus nodes - clean styling
        
        g.appendChild(circle);
        
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        this.updateManufacturerText(text, angle, manufacturer.name, isSelected);
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
            Logger.debug(`Applied selected class to manufacturer: ${element.querySelector('text')?.textContent}`);
        } else {
            element.classList.remove('selected');
        }
        
        if (text) {
            this.updateManufacturerText(text, angle, text.textContent, isSelected);
        }
    }
    
    updateManufacturerText(textElement, angle, content, isSelected = false) {
        // Validate angle to prevent NaN errors
        if (isNaN(angle)) {
            Logger.error(`Invalid text angle: ${angle}`);
            return;
        }
        
        // Check if this is a cylinder for special centering logic
        const isCylinder = content.match(/^(\d+) Cylinders?$/);
        
        let textX, textY, textAnchor;
        
        if (isCylinder) {
            // Center cylinder text over the node
            textX = 0;
            textY = 0;
            textAnchor = 'middle';
        } else {
            // Standard positioning for other items
            const radius = MOBILE_CONFIG.RADIUS.UNSELECTED;
            let offset = -(radius + 5);
            
            // For selected manufacturers, shift text further outward (40px more to the right)
            if (isSelected) {
                offset = -(radius + 50); // Move text 40px more outward from the current 10px offset
            }
            
            textX = offset * Math.cos(angle);
            textY = offset * Math.sin(angle);
            
            // For selected manufacturers, use 'end' anchor so text block ends near the node
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
        // Remove any inline font styles to allow CSS to take precedence
        textElement.removeAttribute('font-size');
        textElement.removeAttribute('font-weight');
        
        // Special formatting for cylinders in Focus Ring
        let displayText = content;
        if (isCylinder) {
            const cylinderNumber = isCylinder[1];
            if (isSelected) {
                // Selected cylinder (in magnifier): show "X CIL"
                displayText = `${cylinderNumber} CIL`;
            } else {
                // Non-selected cylinders: show just the number
                displayText = cylinderNumber;
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
        const levels = this.getHierarchyLevels();
        const levelNames = this.getHierarchyLevelNames();
        
        // Check levels from most specific to least specific to ensure correct matching
        // Reverse the order: model, family, cylinder, manufacturer, country, market
        const reversedLevelNames = [...levelNames].reverse();
        
        for (const levelName of reversedLevelNames) {
            if (this.itemMatchesLevel(item, levelName)) {
                return levelName;
            }
        }
        
        Logger.warn('Could not determine hierarchy level for item:', item);
        return null;
    }

    /**
     * Check if an item matches a specific hierarchy level
     */
    itemMatchesLevel(item, levelName) {
        // More precise level detection based on the defining characteristics of each level
        switch (levelName) {
            case 'market':
                // Market level: has market, no country
                return item.market && !item.country;
            case 'country':
                // Country level: has market + country, no manufacturer/name
                return item.market && item.country && !item.manufacturer && !item.name;
            case 'manufacturer':
                // Manufacturer level: has market + country + (manufacturer or name), no cylinderCount, no cylinder string
                return item.market && item.country && (item.manufacturer || item.name) && item.cylinderCount === undefined && item.cylinder === undefined;
            case 'cylinder':
                // Cylinder level: has cylinderCount (number), no cylinder string, no familyCode
                return item.cylinderCount !== undefined && item.cylinder === undefined && !item.familyCode;
            case 'family':
                // Family level: has familyCode
                return item.familyCode !== undefined;
            case 'model':
                // Model level: has cylinder (string) - this is the distinguishing feature
                // Models have 'cylinder' (string) not 'cylinderCount' (number)
                return item.cylinder !== undefined;
            default:
                return false;
        }
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
        this.selectedMarket = null;
        this.selectedManufacturer = null;
        this.hideParentButton();
        this.currentFocusItems = [];
        this.activePath = [];
        this.activeType = null;
        this.manufacturerElements.clear();
        this.positionCache.clear();
        
        // Collapse Detail Sector
        this.collapseDetailSector();
        
        // Hide rings
        this.elements.focusRingGroup.classList.add('hidden');
        this.elements.childRingGroup.classList.add('hidden');
        this.elements.modelsGroup.classList.add('hidden');
        this.clearFanLines();
        
        // Reset market visuals
        const marketGroups = document.querySelectorAll('.marketGroup');
        marketGroups.forEach(group => {
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
    
    showCylinderRing(market, country, manufacturer, manufacturerAngle) {
        Logger.debug('Showing cylinder ring for', manufacturer);
        
        // Get cylinders for this manufacturer
        const cylinders = this.dataManager.getCylinders(market, country, manufacturer);
        
        if (cylinders.length === 0) {
            Logger.warn('No cylinders found for', manufacturer);
            return;
        }
        
        // Use Child Pyramid for cylinders
        this.childPyramid.showChildPyramid(cylinders, 'cylinders');
    }
    
    renderFanLines(manufacturerAngle, cylinderStartAngle, cylinderCount, angleStep) {
        // Clear existing fan lines
        this.elements.pathLinesGroup.innerHTML = '';
        
        if (cylinderCount === 0) return;
        
        // Get arc parameters for positioning calculations
        const arcParams = this.viewport.getArcParameters();
        
        // Calculate manufacturer position (on manufacturer ring)
        const manufacturerRadius = arcParams.radius; // Manufacturer ring radius
        const manufacturerNodeRadius = MOBILE_CONFIG.RADIUS.MAGNIFIED; // 22px
        
        // Calculate cylinder ring radius (85% of manufacturer radius - matches actual positioning)
        const cylinderRadius = manufacturerRadius * 0.85;
        const cylinderNodeRadius = MOBILE_CONFIG.RADIUS.CHILD_NODE; // 10px
        
        // Draw lines from magnifier edge to child edge (fanning outward from magnifier)
        for (let i = 0; i < cylinderCount; i++) {
            const cylinderAngle = cylinderStartAngle + i * angleStep;
            
            // Calculate manufacturer position and edge point toward cylinder
            const manufacturerCenterX = arcParams.centerX + manufacturerRadius * Math.cos(manufacturerAngle);
            const manufacturerCenterY = arcParams.centerY + manufacturerRadius * Math.sin(manufacturerAngle);
            
            // Calculate cylinder position and edge point toward manufacturer
            const cylinderCenterX = arcParams.centerX + cylinderRadius * Math.cos(cylinderAngle);
            const cylinderCenterY = arcParams.centerY + cylinderRadius * Math.sin(cylinderAngle);
            
            // Calculate direction from manufacturer to cylinder
            const dx = cylinderCenterX - manufacturerCenterX;
            const dy = cylinderCenterY - manufacturerCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance === 0) continue; // Skip if positions are identical
            
            // Normalize direction vector
            const dirX = dx / distance;
            const dirY = dy / distance;
            
                        // Calculate start point (magnifier edge toward child)
            const startX = manufacturerCenterX + dirX * manufacturerNodeRadius;
            const startY = manufacturerCenterY + dirY * manufacturerNodeRadius;
            
            // Calculate end point (child edge toward magnifier)
            const endX = cylinderCenterX - dirX * cylinderNodeRadius;
            const endY = cylinderCenterY - dirY * cylinderNodeRadius;
            
            // Create line element
            const line = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'line');
            line.setAttribute('x1', startX);
            line.setAttribute('y1', startY);
            line.setAttribute('x2', endX);
            line.setAttribute('y2', endY);
            line.setAttribute('stroke', 'black');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('opacity', '0.6');
            
            this.elements.pathLinesGroup.appendChild(line);
        }
        
        Logger.debug(`Rendered ${cylinderCount} fan lines from manufacturer at ${manufacturerAngle * 180 / Math.PI}°`);
    }
    
    clearFanLines() {
        this.elements.pathLinesGroup.innerHTML = '';
    }
    
    createCylinderElement(cylinder, angle) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.setAttribute('class', 'cylinder');
        g.setAttribute('data-cylinder', cylinder.name);
        g.setAttribute('data-key', cylinder.key);
        
        // Calculate position on cylinder ring (85% of manufacturer ring radius)
        const arcParams = this.viewport.getArcParameters();
        const manufacturerRadius = arcParams.radius;
        const radius = manufacturerRadius * 0.85;  // 85% of manufacturer ring radius for optimal visibility
        const x = arcParams.centerX + radius * Math.cos(angle);
        const y = arcParams.centerY + radius * Math.sin(angle);
        
        Logger.debug('Cylinder positioning - manufacturerRadius:', manufacturerRadius, 'cylinderRadius:', radius, 'x:', x, 'y:', y, 'angle:', angle * 180 / Math.PI, '°');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        
        // Create circle node
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('r', MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', this.getColorForType('cylinder'));
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        
        g.appendChild(circle);
        
        // Create text label
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        this.updateCylinderText(text, angle, cylinder.name);
        g.appendChild(text);
        
        // Add click handler
        g.style.cursor = 'pointer';
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCylinderSelection(cylinder);
        });
        
        // Debug: Log the final element attributes
        Logger.debug('Created cylinder element:');
        Logger.debug('- Transform:', g.getAttribute('transform'));
        Logger.debug('- Circle radius:', circle.getAttribute('r'));
        Logger.debug('- Circle fill:', circle.getAttribute('fill'));
        Logger.debug('- Circle position: relative to transform');
        
        return g;
    }
    
    updateCylinderText(textElement, angle, content) {
        const radius = MOBILE_CONFIG.RADIUS.CYLINDER_NODE;
        const offset = -(radius + 3);
        
        // Position text at center of node (0, 0) for centered alignment
        const textX = 0;
        const textY = 0;
        let rotation = angle * 180 / Math.PI;
        
        // Center the text regardless of angle
        let textAnchor = 'middle';
        
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        
        textElement.setAttribute('x', textX);
        textElement.setAttribute('y', textY);
        textElement.setAttribute('dy', '0.3em');
        textElement.setAttribute('text-anchor', textAnchor);
        textElement.setAttribute('transform', `rotate(${rotation}, ${textX}, ${textY})`);
        textElement.setAttribute('fill', 'black');
        textElement.setAttribute('font-size', '18px');
        textElement.textContent = content;
    }
    
    handleCylinderSelection(cylinder) {
        Logger.debug('Cylinder selected:', cylinder.name);
        
        // Update active path
        this.activePath = [cylinder.market, cylinder.country, cylinder.manufacturer, cylinder.name];
        this.activeType = 'cylinder';
        
        // Show models for this cylinder
        this.showModelRing(cylinder.market, cylinder.country, cylinder.manufacturer, cylinder.name);
        
        // Update visual states
        this.updateCylinderVisuals(cylinder.key);
        
        // Render path lines
        this.renderPathLines();
    }
    
    updateCylinderVisuals(selectedKey) {
        const cylinders = this.elements.childRingGroup.querySelectorAll('.cylinder');
        
        cylinders.forEach(cylinder => {
            const key = cylinder.getAttribute('data-key');
            const circle = cylinder.querySelector('circle');
            
            if (key === selectedKey) {
                circle.setAttribute('r', MOBILE_CONFIG.RADIUS.CYLINDER_NODE + 2);
                circle.setAttribute('stroke-width', '2');
                cylinder.classList.add('selected');
            } else {
                circle.setAttribute('r', MOBILE_CONFIG.RADIUS.CYLINDER_NODE);
                circle.setAttribute('stroke-width', '1');
                cylinder.classList.remove('selected');
            }
        });
    }
    
    renderPathLines() {
        // Clear existing path lines
        this.elements.pathLinesGroup.innerHTML = '';
        
        if (this.activePath.length < 3) return; // Need at least market/country/manufacturer
        
        let prevX, prevY;
        
        // Get manufacturer position (selected manufacturer)
        if (this.selectedManufacturer && this.activePath.length >= 3) {
            const selectedElement = this.manufacturerElements.get(this.selectedManufacturer.key);
            if (selectedElement) {
                const transform = selectedElement.getAttribute('transform');
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (match) {
                    prevX = parseFloat(match[1]);
                    prevY = parseFloat(match[2]);
                }
            }
        }
        
        // Draw lines from focus item to child ring items
        if (this.activePath.length >= 4 && prevX !== undefined && prevY !== undefined) {
            const cylinders = this.elements.childRingGroup.querySelectorAll('.cylinder');
            
            cylinders.forEach(cylinderElement => {
                const transform = cylinderElement.getAttribute('transform');
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const cylX = parseFloat(match[1]);
                    const cylY = parseFloat(match[2]);
                    
                    this.createPathLine(prevX, prevY, cylX, cylY, 'manufacturer-cylinder');
                }
            });
        }
        
        // Draw lines from selected child ring item to its models
        if (this.activePath.length >= 5) {
            const selectedCylinder = this.elements.childRingGroup.querySelector('.cylinder.selected');
            if (selectedCylinder) {
                const transform = selectedCylinder.getAttribute('transform');
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const cylX = parseFloat(match[1]);
                    const cylY = parseFloat(match[2]);
                    
                    const models = this.elements.modelsGroup.querySelectorAll('.model');
                    models.forEach(modelElement => {
                        const modelTransform = modelElement.getAttribute('transform');
                        const modelMatch = modelTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                        if (modelMatch) {
                            const modelX = parseFloat(modelMatch[1]);
                            const modelY = parseFloat(modelMatch[2]);
                            
                            this.createPathLine(cylX, cylY, modelX, modelY, 'cylinder-model');
                        }
                    });
                }
            }
        }
    }
    
    createPathLine(x1, y1, x2, y2, lineClass) {
        const line = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'line');
        line.setAttribute('x1', x1.toString());
        line.setAttribute('y1', y1.toString());
        line.setAttribute('x2', x2.toString());
        line.setAttribute('y2', y2.toString());
        line.setAttribute('stroke', 'black');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('opacity', '0.6');
        line.setAttribute('class', lineClass);
        
        this.elements.pathLinesGroup.appendChild(line);
    }
    
    showModelRing(market, country, manufacturer, cylinder) {
        Logger.debug('Showing model ring for cylinder', cylinder);
        
        // Get models for this cylinder
        const models = this.dataManager.getModels(market, country, manufacturer, cylinder);
        
        if (models.length === 0) {
            Logger.warn('No models found for cylinder', cylinder);
            return;
        }
        
        // Clear existing models
        this.elements.modelsGroup.innerHTML = '';
        this.elements.modelsGroup.classList.remove('hidden');
        
        // Find the selected child ring item's angle
        const selectedCylinder = this.elements.childRingGroup.querySelector('.cylinder.selected');
        let cylinderAngle = 0;
        
        if (selectedCylinder) {
            const cylinderKey = selectedCylinder.getAttribute('data-key');
            // Extract angle from transform or calculate from position
            const transform = selectedCylinder.getAttribute('transform');
            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                const x = parseFloat(match[1]);
                const y = parseFloat(match[2]);
                cylinderAngle = Math.atan2(y, x);
            }
        }
        
        // Calculate model positions around the cylinder angle
        const angleStep = MOBILE_CONFIG.ANGLES.MODEL_SPREAD;
        const startAngle = cylinderAngle - (models.length - 1) * angleStep / 2;
        
        models.forEach((model, index) => {
            const angle = startAngle + index * angleStep;
            const modelElement = this.createModelElement(model, angle);
            this.elements.modelsGroup.appendChild(modelElement);
        });
    }
    
    createModelElement(model, angle) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.setAttribute('class', 'model');
        g.setAttribute('data-model', model.name);
        g.setAttribute('data-key', model.key);
        
        // Calculate position on model ring (15% of manufacturer ring radius - innermost ring)
        const arcParams = this.viewport.getArcParameters();
        const manufacturerRadius = arcParams.radius;
        const radius = manufacturerRadius * 0.15;  // Very small innermost ring, guaranteed within viewport
        const x = arcParams.centerX + radius * Math.cos(angle);
        const y = arcParams.centerY + radius * Math.sin(angle);
        
        g.setAttribute('transform', `translate(${x}, ${y})`);
        
        // Create circle node
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('r', MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', this.getColorForType('model'));
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '1');
        
        g.appendChild(circle);
        
        // Create text label
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        this.updateModelText(text, angle, model.name);
        g.appendChild(text);
        
        // Add click handler
        g.style.cursor = 'pointer';
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleModelSelection(model);
        });
        
        return g;
    }
    
    updateModelText(textElement, angle, content) {
        const radius = MOBILE_CONFIG.RADIUS.MODEL_NODE;
        const offset = -(radius + 2);
        const textX = offset * Math.cos(angle);
        const textY = offset * Math.sin(angle);
        let rotation = angle * 180 / Math.PI;
        let textAnchor = Math.cos(angle) >= 0 ? 'start' : 'end';
        
        if (Math.cos(angle) < 0) {
            rotation += 180;
        }
        
        textElement.setAttribute('x', textX);
        textElement.setAttribute('y', textY);
        textElement.setAttribute('dy', '0.3em');
        textElement.setAttribute('text-anchor', textAnchor);
        textElement.setAttribute('transform', `rotate(${rotation}, ${textX}, ${textY})`);
        textElement.setAttribute('fill', 'black');
        textElement.setAttribute('font-size', '15px');
        textElement.textContent = content;
    }
    
    handleModelSelection(model) {
        Logger.debug('Model selected:', model.name);
        
        // Update active path
        this.activePath = [model.market, model.country, model.manufacturer, model.cylinder, model.name];
        this.activeType = 'model';
        
        // Update visual states
        this.updateModelVisuals(model.key);
        
        // Render path lines
        this.renderPathLines();
        
        // Could trigger model details display here
        Logger.debug('Model data:', model.data);
    }
    
    updateModelVisuals(selectedKey) {
        const models = this.elements.modelsGroup.querySelectorAll('.model');
        
        models.forEach(model => {
            const key = model.getAttribute('data-key');
            const circle = model.querySelector('circle');
            
            if (key === selectedKey) {
                circle.setAttribute('r', MOBILE_CONFIG.RADIUS.SELECTED);
                circle.setAttribute('stroke-width', '2');
                model.classList.add('selected');
            } else {
                circle.setAttribute('r', MOBILE_CONFIG.RADIUS.UNSELECTED);
                circle.setAttribute('stroke-width', '1');
                model.classList.remove('selected');
            }
        });
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
        let parentItem;
        let parentLevel;
        if (itemLevel === 'cylinder') {
            // For cylinders, get the manufacturer from the active path
            parentItem = {
                market: item.market,
                country: item.country,
                manufacturer: this.activePath[2] // manufacturer is at index 2 in [market, country, manufacturer, ...]
            };
            parentLevel = 'manufacturer';
        } else {
            parentLevel = this.getPreviousHierarchyLevel(itemLevel);
            parentItem = this.buildParentItemFromChild(item, parentLevel);
        }
        const allSiblings = this.getChildItemsForLevel(parentItem, itemLevel);

        this.currentFocusItems = allSiblings;
        this.allFocusItems = allSiblings;

        // 3. Clear current Child Pyramid immediately to remove cylinder nodes
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

        // 8. If a model was selected, expand the blue circle to create the Detail Sector
        if (itemLevel === 'model') {
            this.expandDetailSector();
        } else {
            this.collapseDetailSector();
        }

        // 6. Update Parent Button to show the parent level
        const parentName = this.getParentNameForLevel(item, parentLevel);
        this.updateParentButton(parentName);

        // 7. Get children for the next level and show in Child Pyramid
        // Skip this for models since they show the Detail Sector instead
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
                        Logger.warn(`🔺 No ${nextLevel}s found for ${itemLevel}:`, item.name);
                    }
                }, 300);
            }
        } else {
            // For models, hide the Child Pyramid since Detail Sector is shown
            setTimeout(() => {
                this.elements.childRingGroup.innerHTML = '';
                this.elements.childRingGroup.classList.add('hidden');
                Logger.debug('🔺 Detail Sector shown - Child Pyramid hidden for model:', item.name);
            }, 300);
        }

        Logger.debug(`🔺 ${itemLevel} nzone migration complete`);
    }

    /**
     * Get the display name for a parent level
     */
    getParentNameForLevel(item, parentLevel) {
        switch (parentLevel) {
            case 'market':
                return item.market;
            case 'country':
                return item.country;
            case 'manufacturer':
                return item.manufacturer || item.name;
            case 'cylinder':
                // Models have 'cylinder' (string), cylinders have 'cylinderCount' (number)
                if (item.cylinder !== undefined) {
                    return `${item.cylinder} Cylinders`;
                } else if (item.cylinderCount !== undefined) {
                    return `${item.cylinderCount} Cylinders`;
                }
                return 'Cylinders';
            case 'family':
                return item.familyCode;
            default:
                return parentLevel;
        }
    }

    /**
     * Build a parent item from a child item for navigation purposes
     */
    buildParentItemFromChild(childItem, parentLevel) {
        const parentItem = {};

        // Copy all properties up to the parent level
        const levelNames = this.getHierarchyLevelNames();
        const parentIndex = levelNames.indexOf(parentLevel);

        for (let i = 0; i <= parentIndex; i++) {
            const levelName = levelNames[i];
            switch (levelName) {
                case 'market':
                    parentItem.market = childItem.market;
                    break;
                case 'country':
                    parentItem.country = childItem.country;
                    break;
                case 'manufacturer':
                    parentItem.manufacturer = childItem.manufacturer || childItem.name;
                    break;
                case 'cylinder':
                    // Models have 'cylinder' (string), cylinders have 'cylinderCount' (number)
                    if (childItem.cylinder !== undefined) {
                        parentItem.cylinderCount = parseInt(childItem.cylinder);
                    } else if (childItem.cylinderCount !== undefined) {
                        parentItem.cylinderCount = childItem.cylinderCount;
                    }
                    break;
                case 'family':
                    parentItem.familyCode = childItem.familyCode;
                    break;
            }
        }

        return parentItem;
    }

    /**
     * Find the index of an item in an array based on level-specific matching
     */
    findItemIndexInArray(item, array, level) {
        return array.findIndex(sibling => {
            switch (level) {
                case 'market':
                    return sibling.market === item.market;
                case 'country':
                    return sibling.country === item.country;
                case 'manufacturer':
                    return sibling.manufacturer === item.manufacturer || sibling.name === item.name;
                case 'cylinder':
                    return sibling.cylinderCount === item.cylinderCount;
                case 'family':
                    return sibling.familyCode === item.familyCode;
                case 'model':
                    // Models are matched by their name (which is the engine_model)
                    return sibling.name === item.name;
                default:
                    return false;
            }
        });
    }

    /**
     * Expand the blue circle to create the Detail Sector when a model is selected
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
     * Collapse the Detail Sector when navigating away from model level
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