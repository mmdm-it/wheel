/**
 * Mobile Catalog Renderer
 * Efficient renderer that minimizes DOM manipulation for mobile performance
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
        this.manufacturerElements = new Map();
        this.positionCache = new Map();
        
        // State
        this.selectedMarket = null;
        this.currentManufacturers = [];
        this.activePath = [];
        this.activeType = null;
    }
    
    async initialize() {
        await this.initializeElements();
        this.viewport.adjustSVGForMobile(this.elements.svg, this.elements.mainGroup);
        return true;
    }
    
    async initializeElements() {
        const elementIds = [
            'catalogSvg', 'mainGroup', 'centralGroup', 'markets', 
            'pathLines', 'manufacturers', 'cylinders', 'models'
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
        
        // Get manufacturers for this market
        this.currentManufacturers = this.dataManager.getManufacturers(market);
        
        if (this.currentManufacturers.length === 0) {
            Logger.warn('No manufacturers found for market:', market);
            return;
        }
        
        // Show manufacturer ring and set up rotation
        this.showManufacturerRing();
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
    
    showManufacturerRing() {
        const manufacturersGroup = this.elements.manufacturersGroup;
        manufacturersGroup.classList.remove('hidden');
        manufacturersGroup.innerHTML = '';
        
        // Calculate initial rotation to center middle manufacturer
        const middleIndex = Math.floor((this.currentManufacturers.length - 1) / 2);
        Logger.debug(`Centering manufacturer at index ${middleIndex} of ${this.currentManufacturers.length}`);
        
        this.updateManufacturerPositions(0);
    }
    
    updateManufacturerPositions(rotationOffset) {
        const manufacturersGroup = this.elements.manufacturersGroup;
        const manufacturers = this.currentManufacturers;
        
        if (!manufacturers.length) return;
        
        // Clear if this is the first render  
        if (manufacturersGroup.children.length === 0) {
            this.manufacturerElements.clear();
            this.positionCache.clear();
        }
        
        const angleStep = MOBILE_CONFIG.ANGLES.MANUFACTURER_SPREAD;
        const centerAngle = MOBILE_CONFIG.ANGLES.CENTER_ANGLE;
        const adjustedCenterAngle = centerAngle + rotationOffset;
        
        // Calculate arc parameters
        const arcParams = this.viewport.getArcParameters();
        let centerMostIndex = -1;
        let minAngleDifference = Infinity;
        const targetAngle = MOBILE_CONFIG.ANGLES.CENTER_ANGLE;
        
        manufacturers.forEach((manufacturer, index) => {
            const angle = adjustedCenterAngle + (index - (manufacturers.length - 1) / 2) * angleStep;
            const position = this.calculateManufacturerPosition(angle, arcParams);
            
            // Track centermost manufacturer
            const angleDiff = Math.abs(angle - targetAngle);
            if (angleDiff < minAngleDifference) {
                minAngleDifference = angleDiff;
                centerMostIndex = index;
            }
            
            // Get or create manufacturer element
            let element = this.manufacturerElements.get(manufacturer.key);
            if (!element) {
                element = this.createManufacturerElement(manufacturer, position, angle, false);
                manufacturersGroup.appendChild(element);
                this.manufacturerElements.set(manufacturer.key, element);
            }
        });
        
        // Update selection state for all manufacturers
        // Only select manufacturer that is exactly at the CENTER_ANGLE position
        const selectedIndex = this.getSelectedManufacturerIndex(rotationOffset, manufacturers.length);
        
        manufacturers.forEach((manufacturer, index) => {
            const element = this.manufacturerElements.get(manufacturer.key);
            if (element) {
                const isSelected = (index === selectedIndex);
                const angle = adjustedCenterAngle + (index - (manufacturers.length - 1) / 2) * angleStep;
                const position = this.calculateManufacturerPosition(angle, arcParams);
                this.updateManufacturerElement(element, position, angle, isSelected);
            }
        });
        
        // Update active path with selected manufacturer
        if (selectedIndex >= 0 && selectedIndex < manufacturers.length) {
            const selectedManufacturer = manufacturers[selectedIndex];
            this.activePath = [selectedManufacturer.market, selectedManufacturer.country, selectedManufacturer.name];
            Logger.debug('Selected manufacturer:', selectedManufacturer.name);
        }
    }
    
    getSelectedManufacturerIndex(rotationOffset, manufacturerCount) {
        if (manufacturerCount === 0) return -1;
        
        const angleStep = MOBILE_CONFIG.ANGLES.MANUFACTURER_SPREAD;
        const middleIndex = (manufacturerCount - 1) / 2;
        
        // Calculate which manufacturer index should be at the CENTER_ANGLE position
        // For a manufacturer at index i to be at CENTER_ANGLE:
        // CENTER_ANGLE + rotationOffset + (i - middleIndex) * angleStep = CENTER_ANGLE
        // Therefore: i = middleIndex - (rotationOffset / angleStep)
        const exactIndex = middleIndex - (rotationOffset / angleStep);
        const roundedIndex = Math.round(exactIndex);
        
        // Only select if the manufacturer is very close to the exact position (detent threshold)
        const detentThreshold = 0.15; // Allow small deviation for selection
        const deviation = Math.abs(exactIndex - roundedIndex);
        
        if (deviation <= detentThreshold && roundedIndex >= 0 && roundedIndex < manufacturerCount) {
            return roundedIndex;
        }
        
        return -1; // No manufacturer selected if not close enough to detent position
    }
    
    calculateManufacturerPosition(angle, arcParams) {
        const key = `${angle}_${arcParams.centerX}_${arcParams.centerY}_${arcParams.radius}`;
        
        if (this.positionCache.has(key)) {
            return this.positionCache.get(key);
        }
        
        // Arc-based positioning with off-screen center
        const x = arcParams.centerX + arcParams.radius * Math.cos(angle);
        const y = arcParams.centerY + arcParams.radius * Math.sin(angle);
        
        const position = { x, y, angle };
        this.positionCache.set(key, position);
        
        return position;
    }
    
    createManufacturerElement(manufacturer, position, angle, isSelected = false) {
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
        this.updateManufacturerText(text, angle, manufacturer.name);
        g.appendChild(text);
        
        return g;
    }
    
    updateManufacturerElement(element, position, angle, isSelected = false) {
        element.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        
        const circle = element.querySelector('circle');
        const text = element.querySelector('text');
        
        // Update selection state
        if (isSelected) {
            circle.setAttribute('r', MOBILE_CONFIG.RADIUS.SELECTED);
            circle.setAttribute('stroke', 'black');
            circle.setAttribute('stroke-width', '2');
            element.classList.add('selected');
        } else {
            circle.setAttribute('r', MOBILE_CONFIG.RADIUS.UNSELECTED);
            circle.removeAttribute('stroke');
            circle.removeAttribute('stroke-width');
            element.classList.remove('selected');
        }
        
        if (text) {
            this.updateManufacturerText(text, angle, text.textContent);
        }
    }
    
    updateManufacturerText(textElement, angle, content) {
        const radius = MOBILE_CONFIG.RADIUS.UNSELECTED;
        const offset = -(radius + 5);
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
    
    reset() {
        this.selectedMarket = null;
        this.currentManufacturers = [];
        this.activePath = [];
        this.activeType = null;
        this.manufacturerElements.clear();
        this.positionCache.clear();
        
        // Hide rings
        this.elements.manufacturersGroup.classList.add('hidden');
        this.elements.cylindersGroup.classList.add('hidden');
        this.elements.modelsGroup.classList.add('hidden');
        
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
}

export { MobileRenderer };