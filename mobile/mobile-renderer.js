/**
 * Mobile Catalog Renderer
 * Efficient renderer that minimizes DOM manipulation for mobile performance
 * 
 * This is part of the modular mobile catalog system.
 * Edit this file directly - no bundling required.
 */

import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';

/**
 * Efficient renderer that minimizes DOM manipulation
 */
class MobileRenderer {
    constructor(viewportManager, dataManager) {
        this.viewport = viewportManager;
        this.dataManager = dataManager;
        
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
        // Reposition magnifier for new viewport
        this.positionMagnifier();
        
        // Update focus ring positions if they're currently shown
        if (this.currentFocusItems.length > 0) {
            this.updateFocusRingPositions(0); // Use current rotation offset
        }
    }
    
    async initializeElements() {
        const elementIds = [
            'catalogSvg', 'mainGroup', 'centralGroup', 'markets', 
            'pathLines', 'focusRing', 'childRing', 'models'
        ];
        
        const missing = [];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const key = id === 'catalogSvg' ? 'svg' : 
                           id === 'mainGroup' ? 'mainGroup' :
                           id === 'centralGroup' ? 'centralGroup' :
                           id + 'Group';
                this.elements[key] = element;
            } else {
                missing.push(id);
            }
        });
        
        if (missing.length > 0) {
            throw new Error(`Required DOM elements not found: ${missing.join(', ')}`);
        }
        
        Logger.debug('DOM elements initialized:', Object.keys(this.elements));
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
        this.positionMagnifier();
        
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
                this.showChildRing(this.selectedFocusItem.market, this.selectedFocusItem.country, this.selectedFocusItem.name, angle);
            }
        }
    }
    
    positionMagnifier() {
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
        
        // Market text (replacing images for mobile)
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        text.setAttribute('class', 'marketText');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dy', '0.35em');
        text.textContent = market.toUpperCase();
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
        
        // Get focus items for this market
        this.currentFocusItems = this.dataManager.getManufacturers(market);
        
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
        
        // Calculate initial rotation to center nearest focus item
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
        const focusItems = this.currentFocusItems;
        
        if (!focusItems.length) return;
        
        // Validate rotationOffset
        if (isNaN(rotationOffset)) {
            Logger.error(`Invalid rotationOffset: ${rotationOffset}`);
            rotationOffset = 0; // Safe fallback
        }
        
        // Clear if this is the first render  
        if (focusRingGroup.children.length === 0) {
            this.focusElements.clear();
            this.positionCache.clear();
        }
        
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const centerAngle = this.viewport.getCenterAngle();
        
        // Validate centerAngle
        if (isNaN(centerAngle)) {
            Logger.error(`Invalid centerAngle: ${centerAngle}`);
            return;
        }
        
        const adjustedCenterAngle = centerAngle + rotationOffset;
        
        // Calculate arc parameters
        const arcParams = this.viewport.getArcParameters();
        let centerMostIndex = -1;
        let minAngleDifference = Infinity;
        const targetAngle = this.viewport.getCenterAngle();
        
        focusItems.forEach((focusItem, index) => {
            const angle = adjustedCenterAngle + (index - (focusItems.length - 1) / 2) * angleStep;
            
            // Validate calculated angle
            if (isNaN(angle)) {
                Logger.error(`Invalid angle calculation: adjustedCenterAngle=${adjustedCenterAngle}, index=${index}, focusItems.length=${focusItems.length}, angleStep=${angleStep}`);
                return; // Skip this focus item
            }
            
            const position = this.calculateFocusPosition(angle, arcParams);
            
            // Track centermost manufacturer
            const angleDiff = Math.abs(angle - targetAngle);
            if (angleDiff < minAngleDifference) {
                minAngleDifference = angleDiff;
                centerMostIndex = index;
            }
            
            // Get or create focus element
            let element = this.focusElements.get(focusItem.key);
            if (!element) {
                element = this.createFocusElement(focusItem, position, angle, false);
                focusRingGroup.appendChild(element);
                this.focusElements.set(focusItem.key, element);
            }
        });
        
        // Find selected focus item first
        const selectedIndex = this.getSelectedFocusIndex(rotationOffset, focusItems.length);
        
        // Update all focus item positions and scaling
        focusItems.forEach((focusItem, index) => {
            const element = this.focusElements.get(focusItem.key);
            if (element) {
                const angle = adjustedCenterAngle + (index - (focusItems.length - 1) / 2) * angleStep;
                
                // Validate calculated angle
                if (isNaN(angle)) {
                    Logger.error(`Invalid angle in update loop: adjustedCenterAngle=${adjustedCenterAngle}, index=${index}, focusItems.length=${focusItems.length}, angleStep=${angleStep}`);
                    return; // Skip this focus item
                }
                
                const position = this.calculateFocusPosition(angle, arcParams);
                const isSelected = (index === selectedIndex);
                this.updateFocusElement(element, position, angle, isSelected);
            }
        });
        
        // Position magnifying ring at the calculated center angle
        this.positionMagnifyingRing();
        
        // Update active path with selected focus item
        if (selectedIndex >= 0 && selectedIndex < focusItems.length) {
            const selectedFocusItem = focusItems[selectedIndex];
            this.activePath = [selectedFocusItem.market, selectedFocusItem.country, selectedFocusItem.name];
            
            // Mark as rotating and defer cylinder display
            this.isRotating = true;
            this.selectedManufacturer = selectedFocusItem;
            
            // Update parent button
            this.updateParentButton(selectedFocusItem);
            
            // Clear any existing settle timeout
            if (this.settleTimeout) {
                clearTimeout(this.settleTimeout);
            }
            
            // Hide child ring immediately during rotation to prevent strobing
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.modelsGroup.classList.add('hidden');
            this.clearFanLines();
            
            // Set timeout to show cylinders after settling
            this.settleTimeout = setTimeout(() => {
                this.isRotating = false;
                if (this.selectedManufacturer && this.selectedManufacturer.key === selectedFocusItem.key) {
                    const angle = this.viewport.getCenterAngle() + rotationOffset + (selectedIndex - (focusItems.length - 1) / 2) * angleStep;
                    Logger.debug('Focus item settled:', selectedFocusItem.name, 'showing child ring');
                    this.showCylinderRing(selectedFocusItem.market, selectedFocusItem.country, selectedFocusItem.name, angle);
                }
            }, MOBILE_CONFIG.TIMING.CYLINDER_SETTLE_DELAY);
            
        } else if (this.selectedManufacturer) {
            // Hide child ring when no focus item is selected
            this.elements.childRingGroup.classList.add('hidden');
            this.elements.modelsGroup.classList.add('hidden');
            this.clearFanLines();
            this.selectedManufacturer = null;
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
        circle.setAttribute('r', isSelected ? MOBILE_CONFIG.RADIUS.SELECTED : MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', this.getColor('manufacturer', manufacturer.name));
        
        if (isSelected) {
            circle.setAttribute('stroke', 'black');
            circle.setAttribute('stroke-width', '2');
            g.classList.add('selected');
        }
        
        g.appendChild(circle);
        
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        this.updateManufacturerText(text, angle, manufacturer.name, false);
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
        
        const radius = MOBILE_CONFIG.RADIUS.UNSELECTED;
        let offset = -(radius + 5);
        
        // For selected manufacturers, shift text much further away from center (to the right)
        if (isSelected) {
            offset = -(radius + 40); // Move text much further outward from the node
        }
        
        const textX = offset * Math.cos(angle);
        const textY = offset * Math.sin(angle);
        let rotation = angle * 180 / Math.PI;
        
        // For selected manufacturers, use 'end' anchor so text block ends near the node
        let textAnchor;
        if (isSelected) {
            textAnchor = 'end';
        } else {
            textAnchor = Math.cos(angle) >= 0 ? 'start' : 'end';
        }
        
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
        
        textElement.textContent = content;
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
        // Simple color mapping - could be enhanced
        switch (type) {
            case 'manufacturer':
                return '#f1b800';
            case 'cylinder':
                return '#f1b800';
            case 'model':
                return '#f1b800';
            default:
                return '#f1b800';
        }
    }
    
    getColorForType(type) {
        return this.getColor(type, '');
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
        
        // Clear existing child ring items
        this.elements.childRingGroup.innerHTML = '';
        this.elements.childRingGroup.classList.remove('hidden');
        Logger.debug('Child ring group visible, classList:', this.elements.childRingGroup.classList.toString());
        
        // Log the arc parameters for debugging
        const arcParams = this.viewport.getArcParameters();
        Logger.debug('Arc parameters for cylinder positioning:', arcParams);
        Logger.debug('Cylinder ring will be at radius:', arcParams.radius * 0.5, 'centered at:', arcParams.centerX, arcParams.centerY);
        
        // Check SVG viewport dimensions
        const svg = this.elements.svg;
        Logger.debug('SVG dimensions - width:', svg.getAttribute('width'), 'height:', svg.getAttribute('height'));
        Logger.debug('SVG viewBox:', svg.getAttribute('viewBox'));
        
        // Calculate child ring positions around the focus item angle
        const angleStep = MOBILE_CONFIG.ANGLES.CHILD_SPREAD;
        const startAngle = manufacturerAngle - (cylinders.length - 1) * angleStep / 2;
        Logger.debug('Child ring positioning - angleStep:', angleStep * 180 / Math.PI, '° startAngle:', startAngle * 180 / Math.PI, '°');
        
        cylinders.forEach((cylinder, index) => {
            const angle = startAngle + index * angleStep;
            Logger.debug('Creating cylinder', cylinder.name, 'at angle:', angle * 180 / Math.PI, '°');
            const cylinderElement = this.createCylinderElement(cylinder, angle);
            this.elements.childRingGroup.appendChild(cylinderElement);
            Logger.debug('Cylinder element created and appended:', cylinderElement);
        });
        
        // Draw fan lines from magnifier to children (fanning outward from magnifier)
        this.renderFanLines(manufacturerAngle, startAngle, cylinders.length, angleStep);
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
    
    updateParentButton(manufacturer) {
        const parentButton = document.getElementById('parentButton');
        const parentText = document.getElementById('parentText');
        
        if (manufacturer && manufacturer.country) {
            // Show button and set text to parent country
            parentText.textContent = manufacturer.country;
            parentButton.classList.remove('hidden');
        } else {
            // Hide button if no manufacturer selected
            parentButton.classList.add('hidden');
        }
    }
    
    hideParentButton() {
        const parentButton = document.getElementById('parentButton');
        parentButton.classList.add('hidden');
    }
}

export { MobileRenderer };