/**
 * ⚠️  RETIRED BACKUP FILE - DO NOT USE ⚠️
 * 
 * This file is a backup of the old bundled system (retired October 29, 2025)
 * 
 * ACTIVE SYSTEM: Native ES6 modules in mobile-*.js files
 * ENTRY POINT: catalog_mobile_modular.js
 * 
 * This bundled version is kept for historical reference only.
 * All development should be done in the individual module files.
 * 
 * Original description:
 * Mobile Catalog - Bundled Version
 * All modules combined for browser compatibility without module system
 */

/**
 * Mobile Catalog Configuration
 * Centralized configuration constants for the mobile catalog system
 */
const MOBILE_CONFIG = {
    // SVG namespace
    SVG_NS: "http://www.w3.org/2000/svg",
    
    // Visual constants
    HIT_PADDING: 5,
    RADIUS: {
        UNSELECTED: 10,
        SELECTED: 18,
        MANUFACTURER_RING: 375,
        CYLINDER_RING: 280,
        MODEL_RING: 180,
        CYLINDER_NODE: 10,  // Same as UNSELECTED
        MODEL_NODE: 10     // Same as UNSELECTED
    },
    
    // Animation constants
    ROTATION: {
        SENSITIVITY: 0.003,
        DECELERATION: 0.95,
        MIN_VELOCITY: 0.001,
        SNAP_THRESHOLD: 0.05,
        DETENT_VELOCITY: 0.005  // Higher threshold for detent snapping
    },
    
    // Angle constants - mobile arc-based system
    ANGLES: {
        MANUFACTURER_SPREAD: Math.PI / 42, // 4.3°
        CYLINDER_SPREAD: Math.PI / 18,     // 10°
        MODEL_SPREAD: Math.PI / 18         // 10°
    },
    
    // Viewport constants
    VIEWPORT: {
        MARKET_OFFSET: {
            HORIZONTAL: 0.20,
            VERTICAL: 0.35
        }
    }
};

/**
 * Mobile Catalog Logger
 * Conditional logging utility for debugging and error handling
 */
class Logger {
    static debug(...args) {
        // Enable debug logging by setting: localStorage.setItem('debugMobile', 'true') 
        // or adding ?debug=1 to URL or setting window.DEBUG_MOBILE = true
        if (window.DEBUG_MOBILE || 
            localStorage.getItem('debugMobile') === 'true' ||
            new URLSearchParams(window.location.search).get('debug') === '1') {
            console.log('[MobileCatalog]', ...args);
        }
    }
    
    static error(...args) {
        console.error('[MobileCatalog ERROR]', ...args);
    }
    
    static warn(...args) {
        console.warn('[MobileCatalog WARN]', ...args);
    }
}

/**
 * Manages viewport calculations and responsive behavior
 */
class ViewportManager {
    constructor() {
        this.cache = new Map();
        this.lastViewport = { width: 0, height: 0 };
    }
    
    getViewportInfo() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Return cached if viewport hasn't changed
        if (this.lastViewport.width === width && this.lastViewport.height === height) {
            return this.cache.get('viewportInfo');
        }
        
        const info = {
            width,
            height,
            isPortrait: height > width,
            center: { x: width / 2, y: height / 2 },
            LSd: Math.max(width, height),
            SSd: Math.min(width, height)
        };
        
        this.cache.set('viewportInfo', info);
        this.lastViewport = { width, height };
        Logger.debug('Viewport updated:', info);
        
        return info;
    }
    
    getCenterAngle() {
        // Calculate the angle from ring center that points toward screen center (0,0)
        // Calculate ring center directly to avoid circular dependency
        const viewport = this.getViewportInfo();
        
        let ringCenterX, ringCenterY;
        
        // Ring center position based on orientation (same logic as getArcParameters)
        if (viewport.isPortrait) {
            // Portrait: x = LSd - SSd/2, y = -(LSd/2)
            ringCenterX = viewport.LSd - viewport.SSd / 2;
            ringCenterY = -(viewport.LSd / 2);
        } else {
            // Landscape: x = LSd/2, y = -(LSd - SSd/2)
            ringCenterX = viewport.LSd / 2;
            ringCenterY = -(viewport.LSd - viewport.SSd / 2);
        }
        
        // Vector from ring center to screen center (0,0)
        const vectorX = 0 - ringCenterX;  // Screen center is at (0,0)
        const vectorY = 0 - ringCenterY;
        
        // Calculate angle using atan2 (returns angle in radians from -π to π)
        const angle = Math.atan2(vectorY, vectorX);
        
        Logger.debug(`Dynamic center angle calculated: ${angle * 180 / Math.PI}° (ring center: ${ringCenterX}, ${ringCenterY})`);
        return angle;
    }
    
    getArcParameters() {
        const viewport = this.getViewportInfo();
        const cacheKey = `arc_${viewport.width}_${viewport.height}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Universal arc parameters formula for any device aspect ratio
        // LSd = Long Side, SSd = Short Side
        const LSd = viewport.LSd;
        const SSd = viewport.SSd;
        
        // Ring radius is always LSd
        const radius = LSd;
        
        // Ring center position based on orientation
        let centerX, centerY;
        
        if (viewport.isPortrait) {
            // Portrait: x = LSd - SSd/2, y = -(LSd/2)
            centerX = LSd - SSd / 2;
            centerY = -(LSd / 2);
        } else {
            // Landscape: x = LSd/2, y = -(LSd - SSd/2)
            centerX = LSd / 2;
            centerY = -(LSd - SSd / 2);
        }
        
        const params = { centerX, centerY, radius, viewport };
        this.cache.set(cacheKey, params);
        
        Logger.debug('Arc parameters calculated for', viewport.width, 'x', viewport.height + ':', {
            centerX, centerY, radius,
            'Expected for iPhone SE': 'center=(480, 333.5), radius=667'
        });
        return params;
    }
    
    getMarketPositions() {
        const viewport = this.getViewportInfo();
        const { HORIZONTAL, VERTICAL } = MOBILE_CONFIG.VIEWPORT.MARKET_OFFSET;
        
        return [
            {
                x: viewport.width * HORIZONTAL,
                y: -viewport.height * VERTICAL
            },
            {
                x: -viewport.width * HORIZONTAL,
                y: viewport.height * VERTICAL
            }
        ];
    }
    
    adjustSVGForMobile(svg, mainGroup) {
        const viewport = this.getViewportInfo();
        
        svg.setAttribute('width', viewport.width);
        svg.setAttribute('height', viewport.height);
        mainGroup.setAttribute('transform', `translate(${viewport.center.x}, ${viewport.center.y})`);
        
        Logger.debug('SVG adjusted for mobile viewport');
    }
}

/**
 * Handles touch rotation with momentum and snapping
 */
class TouchRotationHandler {
    constructor(onRotationChange, onRotationEnd) {
        this.onRotationChange = onRotationChange;
        this.onRotationEnd = onRotationEnd;
        
        // Rotation state
        this.rotationOffset = 0;
        this.isDragging = false;
        this.velocity = 0;
        this.lastTouch = { x: 0, y: 0 };
        this.animationId = null;
        
        // Bound handlers for cleanup
        this.boundHandlers = {
            touchStart: this.handleTouchStart.bind(this),
            touchMove: this.handleTouchMove.bind(this),
            touchEnd: this.handleTouchEnd.bind(this)
        };
        
        this.isActive = false;
        this.rotationLimits = { min: -Infinity, max: Infinity };
    }
    
    activate() {
        if (this.isActive) return;
        
        Logger.debug('Activating touch rotation controls');
        Object.entries(this.boundHandlers).forEach(([event, handler]) => {
            const eventName = event.replace(/([A-Z])/g, c => c.toLowerCase());
            document.addEventListener(eventName, handler, { passive: false });
        });
        
        this.isActive = true;
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        Logger.debug('Deactivating touch rotation controls');
        Object.entries(this.boundHandlers).forEach(([event, handler]) => {
            const eventName = event.replace(/([A-Z])/g, c => c.toLowerCase());
            document.removeEventListener(eventName, handler);
        });
        
        this.stopAnimation();
        this.isActive = false;
    }
    
    setRotationLimits(min, max) {
        this.rotationLimits = { min, max };
        Logger.debug('Rotation limits set:', this.rotationLimits);
    }
    
    handleTouchStart(e) {
        if (!this.shouldHandleTouch(e)) return;
        
        e.preventDefault();
        this.isDragging = true;
        this.velocity = 0;
        
        const touch = e.touches[0];
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
        
        this.stopAnimation();
        Logger.debug('Touch rotation started');
    }
    
    handleTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.lastTouch.x;
        const deltaY = touch.clientY - this.lastTouch.y;
        
        // Convert movement to rotation
        const rotationDelta = -(deltaX + deltaY) * MOBILE_CONFIG.ROTATION.SENSITIVITY;
        const newOffset = this.constrainRotation(this.rotationOffset + rotationDelta);
        
        if (newOffset !== this.rotationOffset) {
            this.rotationOffset = newOffset;
            this.velocity = rotationDelta; // Store for momentum
            Logger.debug('Touch rotation - offset:', this.rotationOffset, 'delta:', rotationDelta);
            this.onRotationChange(this.rotationOffset);
        }
        
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
    }
    
    handleTouchEnd(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        this.isDragging = false;
        
        Logger.debug('Touch rotation ended, velocity:', this.velocity);
        
        if (Math.abs(this.velocity) > MOBILE_CONFIG.ROTATION.MIN_VELOCITY) {
            this.startMomentumAnimation();
        } else {
            this.snapToNearest();
        }
    }
    
    shouldHandleTouch(e) {
        if (e.touches.length !== 1) return false;
        
        // Check if touch is on a market button
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        return !(element && (element.classList.contains('marketHitArea') || element.closest('.marketGroup')));
    }
    
    constrainRotation(offset) {
        return Math.max(this.rotationLimits.min, Math.min(this.rotationLimits.max, offset));
    }
    
    startMomentumAnimation() {
        const animate = () => {
            this.velocity *= MOBILE_CONFIG.ROTATION.DECELERATION;
            
            // Check for detent snapping when velocity is low but not yet stopped
            if (Math.abs(this.velocity) < MOBILE_CONFIG.ROTATION.DETENT_VELOCITY) {
                this.stopAnimation();
                this.snapToNearest();
                return;
            }
            
            if (Math.abs(this.velocity) < MOBILE_CONFIG.ROTATION.MIN_VELOCITY) {
                this.stopAnimation();
                this.snapToNearest();
                return;
            }
            
            const newOffset = this.constrainRotation(this.rotationOffset + this.velocity);
            if (newOffset !== this.rotationOffset) {
                this.rotationOffset = newOffset;
                this.onRotationChange(this.rotationOffset);
            } else {
                // Hit a limit, stop momentum
                this.velocity = 0;
                this.stopAnimation();
                return;
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    snapToNearest() {
        if (this.onRotationEnd) {
            this.onRotationEnd(this.rotationOffset);
        }
    }
    
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    reset() {
        this.rotationOffset = 0;
        this.isDragging = false;
        this.velocity = 0;
        this.stopAnimation();
    }
}

/**
 * Manages data loading with error handling and caching
 */
class DataManager {
    constructor() {
        this.data = null;
        this.loading = false;
        this.loadPromise = null;
    }
    
    async load() {
        if (this.data) return this.data;
        if (this.loadPromise) return this.loadPromise;
        
        this.loadPromise = this.performLoad();
        return this.loadPromise;
    }
    
    async performLoad() {
        if (this.loading) return this.data;
        
        this.loading = true;
        Logger.debug('Loading catalog data...');
        
        try {
            const response = await fetch('./catalog.json');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.data = await response.json();
            
            if (!this.validateData(this.data)) {
                throw new Error('Invalid data structure received');
            }
            
            Logger.debug('Data loaded successfully', this.data);
            return this.data;
            
        } catch (error) {
            Logger.error('Failed to load data:', error);
            this.data = null;
            throw new Error(`Unable to load catalog data: ${error.message}`);
        } finally {
            this.loading = false;
        }
    }
    
    validateData(data) {
        return data && 
               data.MMdM && 
               data.MMdM.markets && 
               typeof data.MMdM.markets === 'object';
    }
    
    getData() {
        return this.data;
    }
    
    getMarkets() {
        return this.data ? Object.keys(this.data.MMdM.markets) : [];
    }
    
    getManufacturers(market) {
        if (!this.data || !this.data.MMdM.markets[market]) return [];
        
        const countries = this.data.MMdM.markets[market].countries;
        const manufacturers = [];
        
        Object.keys(countries).forEach(country => {
            Object.keys(countries[country].manufacturers).forEach(manufacturer => {
                manufacturers.push({ 
                    name: manufacturer, 
                    country: country, 
                    market: market,
                    key: `${market}/${country}/${manufacturer}`
                });
            });
        });
        
        return manufacturers.sort((a, b) => b.name.localeCompare(a.name));
    }
    
    getCylinders(market, country, manufacturer) {
        Logger.debug('Getting cylinders for:', market, country, manufacturer);
        
        if (!this.data || !this.data.MMdM.markets[market] || 
            !this.data.MMdM.markets[market].countries[country] ||
            !this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer]) {
            Logger.warn('Data path not found for cylinders');
            return [];
        }
        
        const cylinders = this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders;
        if (!cylinders) {
            Logger.warn('No cylinders found in data structure');
            return [];
        }
        
        const cylinderKeys = Object.keys(cylinders);
        Logger.debug('Found cylinder keys:', cylinderKeys);
        
        return cylinderKeys
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(cylinder => ({
                name: cylinder,
                market: market,
                country: country,
                manufacturer: manufacturer,
                key: `${market}/${country}/${manufacturer}/${cylinder}`,
                data: cylinders[cylinder]
            }));
    }
    
    getModels(market, country, manufacturer, cylinder) {
        if (!this.data || !this.data.MMdM.markets[market] || 
            !this.data.MMdM.markets[market].countries[country] ||
            !this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer] ||
            !this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders[cylinder]) {
            return [];
        }
        
        const models = this.data.MMdM.markets[market].countries[country].manufacturers[manufacturer].cylinders[cylinder];
        if (!Array.isArray(models)) return [];
        
        return models.map((model, index) => ({
            name: model.engine_model,
            market: market,
            country: country,
            manufacturer: manufacturer,
            cylinder: cylinder,
            key: `${market}/${country}/${manufacturer}/${cylinder}/${model.engine_model}`,
            data: model,
            index: index
        }));
    }
}

// Mock add to cart function
window.addToCart = function(model) {
    Logger.debug('Add to cart requested:', model);
    // Mobile-friendly alert or modal would go here
    if (confirm(`Add ${model} to cart?`)) {
        alert(`Added ${model} to cart!`);
    }
};

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
        this.selectedManufacturer = null;
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
        g.setAttribute('data-market', market);

        // Create multi-line Italian text for markets
        const textGroup = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        textGroup.setAttribute('class', 'marketText');
        textGroup.style.cursor = 'pointer';
        
        // Define Italian text for each market
        let textLines = [];
        if (market === 'eurasia') {
            textLines = ['MOTORI', "DELL'EURASIA"];
        } else if (market === 'americhe') {
            textLines = ['MOTORI', 'DELLE', 'AMERICHE'];
        } else {
            textLines = [market.toUpperCase()]; // fallback
        }
        
        // Create each line of text
        const lineHeight = 52;
        const startY = -(textLines.length - 1) * lineHeight / 2;
        
        textLines.forEach((line, index) => {
            const textElement = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
            textElement.setAttribute('x', 0);
            textElement.setAttribute('y', startY + (index * lineHeight));
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'central');
            textElement.setAttribute('font-family', 'Montserrat, sans-serif');
            textElement.setAttribute('font-size', '48px');
            textElement.setAttribute('font-weight', '700');
            textElement.setAttribute('fill', 'black');
            textElement.textContent = line;
            textGroup.appendChild(textElement);
        });
        
        g.appendChild(textGroup);

        // Hit area around multi-line text for touch
        const hitArea = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'rect');
        hitArea.setAttribute('class', 'marketHitArea');
        hitArea.setAttribute('x', -100);
        hitArea.setAttribute('y', market === 'americhe' ? -50 : -35);
        hitArea.setAttribute('width', 200);
        hitArea.setAttribute('height', market === 'americhe' ? 100 : 70);
        hitArea.setAttribute('fill', 'transparent');
        hitArea.style.cursor = 'pointer';
        g.appendChild(hitArea);

        // Touch events for mobile - use passive listener for better performance
        hitArea.addEventListener('touchstart', (e) => {
            // Let touch events be passive for better performance
            this.handleMarketSelection(market, g);
        }, { passive: true });
        
        hitArea.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleMarketSelection(market, g);
        });

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
        
        // Set up touch rotation via the app
        if (window.mobileCatalogApp) {
            window.mobileCatalogApp.setupTouchRotation(this.currentManufacturers);
        }
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
        const centerAngle = this.viewport.getCenterAngle();
        const adjustedCenterAngle = centerAngle + rotationOffset;
        
        // Calculate arc parameters
        const arcParams = this.viewport.getArcParameters();
        let centerMostIndex = -1;
        let minAngleDifference = Infinity;
        const targetAngle = this.viewport.getCenterAngle();
        
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
        Logger.debug('updateManufacturerPositions called, selectedIndex:', selectedIndex, 'total manufacturers:', manufacturers.length);
        
        manufacturers.forEach((manufacturer, index) => {
            const element = this.manufacturerElements.get(manufacturer.key);
            if (element) {
                const isSelected = (index === selectedIndex);
                const angle = adjustedCenterAngle + (index - (manufacturers.length - 1) / 2) * angleStep;
                const position = this.calculateManufacturerPosition(angle, arcParams);
                this.updateManufacturerElement(element, position, angle, isSelected);
                
                // Show cylinders when this manufacturer is selected
                if (isSelected) {
                    Logger.debug('Manufacturer selected:', manufacturer.name, 'at angle:', angle * 180 / Math.PI, '°');
                    this.showCylinderRing(manufacturer.market, manufacturer.country, manufacturer.name, angle);
                    this.selectedManufacturer = manufacturer;
                } else if (this.selectedManufacturer && this.selectedManufacturer.key === manufacturer.key) {
                    // Hide cylinders when manufacturer is deselected
                    this.elements.cylindersGroup.classList.add('hidden');
                    this.elements.modelsGroup.classList.add('hidden');
                    this.selectedManufacturer = null;
                }
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
        const detentThreshold = 0.5; // Increased threshold for easier selection
        const deviation = Math.abs(exactIndex - roundedIndex);
        Logger.debug('Selection check - exactIndex:', exactIndex, 'roundedIndex:', roundedIndex, 'deviation:', deviation, 'threshold:', detentThreshold);
        
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
            circle.setAttribute('stroke-width', '1');
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
            circle.setAttribute('stroke-width', '1');
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
    
    getColorForType(type) {
        return this.getColor(type, '');
    }
    
    reset() {
        this.selectedMarket = null;
        this.selectedManufacturer = null;
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
    
    showCylinderRing(market, country, manufacturer, manufacturerAngle) {
        Logger.debug('Showing cylinder ring for', manufacturer);
        
        // Get cylinders for this manufacturer
        const cylinders = this.dataManager.getCylinders(market, country, manufacturer);
        
        if (cylinders.length === 0) {
            Logger.warn('No cylinders found for', manufacturer);
            return;
        }
        
        // Clear existing cylinders
        this.elements.cylindersGroup.innerHTML = '';
        this.elements.cylindersGroup.classList.remove('hidden');
        Logger.debug('Cylinder group visible, classList:', this.elements.cylindersGroup.classList.toString());
        
        // Log the arc parameters for debugging
        const arcParams = this.viewport.getArcParameters();
        Logger.debug('Arc parameters for cylinder positioning:', arcParams);
        Logger.debug('Cylinder ring will be at radius:', arcParams.radius * 0.5, 'centered at:', arcParams.centerX, arcParams.centerY);
        
        // Check SVG viewport dimensions
        const svg = this.elements.svg;
        Logger.debug('SVG dimensions - width:', svg.getAttribute('width'), 'height:', svg.getAttribute('height'));
        Logger.debug('SVG viewBox:', svg.getAttribute('viewBox'));
        
        // Calculate cylinder positions around the manufacturer angle
        const angleStep = MOBILE_CONFIG.ANGLES.CYLINDER_SPREAD;
        const startAngle = manufacturerAngle - (cylinders.length - 1) * angleStep / 2;
        Logger.debug('Cylinder positioning - angleStep:', angleStep * 180 / Math.PI, '° startAngle:', startAngle * 180 / Math.PI, '°');
        
        cylinders.forEach((cylinder, index) => {
            const angle = startAngle + index * angleStep;
            Logger.debug('Creating cylinder', cylinder.name, 'at angle:', angle * 180 / Math.PI, '°');
            const cylinderElement = this.createCylinderElement(cylinder, angle);
            this.elements.cylindersGroup.appendChild(cylinderElement);
            Logger.debug('Cylinder element created and appended:', cylinderElement);
        });
    }
    
    createCylinderElement(cylinder, angle) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.setAttribute('class', 'cylinder');
        g.setAttribute('data-cylinder', cylinder.name);
        g.setAttribute('data-key', cylinder.key);
        
        // Calculate position on cylinder ring (50% of manufacturer ring radius - well within viewport)
        const arcParams = this.viewport.getArcParameters();
        const manufacturerRadius = arcParams.radius;
        const radius = manufacturerRadius * 0.5;  // Half the manufacturer ring radius to stay within viewport
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
        textElement.setAttribute('font-size', '12px');
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
        const cylinders = this.elements.cylindersGroup.querySelectorAll('.cylinder');
        
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
        
        // Draw lines from manufacturer to cylinders
        if (this.activePath.length >= 4 && prevX !== undefined && prevY !== undefined) {
            const cylinders = this.elements.cylindersGroup.querySelectorAll('.cylinder');
            
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
        
        // Draw lines from selected cylinder to its models
        if (this.activePath.length >= 5) {
            const selectedCylinder = this.elements.cylindersGroup.querySelector('.cylinder.selected');
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
        
        // Find the selected cylinder's angle
        const selectedCylinder = this.elements.cylindersGroup.querySelector('.cylinder.selected');
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
        textElement.setAttribute('font-size', '10px');
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
}

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
    }
    
    async init() {
        try {
            Logger.debug('Starting mobile catalog initialization...');
            
            // Load data first
            await this.dataManager.load();
            
            // Initialize renderer (includes DOM element setup)
            await this.renderer.initialize();
            
            // Render initial state
            this.renderer.renderMarkets();
            
            // Set up resize handling
            this.setupResizeHandling();
            
            this.initialized = true;
            Logger.debug('Mobile catalog initialized successfully');
            console.log('[MobileCatalog FORCE] === DEBUG MODE TEST - This should always show ===');
            console.log('[MobileCatalog FORCE] Debug enabled:', window.DEBUG_MOBILE || localStorage.getItem('debugMobile') === 'true');
            
            // Force enable debugging for testing
            window.DEBUG_MOBILE = true;
            console.log('[MobileCatalog FORCE] Debug mode force-enabled for testing');
            
        } catch (error) {
            this.handleInitError(error);
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
            <p>Unable to load the catalog. Please refresh the page.</p>
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
            
            // Re-render markets with new positions
            this.renderer.renderMarkets();
            
            // If we have manufacturers showing, update their positions
            if (this.renderer.currentManufacturers.length > 0) {
                this.renderer.updateManufacturerPositions(
                    this.touchHandler ? this.touchHandler.rotationOffset : 0
                );
            }
            
        } catch (error) {
            Logger.error('Error handling resize:', error);
        }
    }
    
    setupTouchRotation(manufacturers) {
        // Clean up existing touch handler
        if (this.touchHandler) {
            this.touchHandler.deactivate();
        }
        
        // Create new touch handler
        this.touchHandler = new TouchRotationHandler(
            (offset) => this.renderer.updateManufacturerPositions(offset),
            (offset) => this.handleRotationEnd(offset)
        );
        
        // Calculate rotation limits
        const limits = this.calculateRotationLimits(manufacturers);
        this.touchHandler.setRotationLimits(limits.min, limits.max);
        
        // Activate touch handling
        this.touchHandler.activate();
        
        Logger.debug('Touch rotation setup complete');
    }
    
    calculateRotationLimits(manufacturers) {
        if (!manufacturers.length) {
            return { min: -Infinity, max: Infinity };
        }
        
        const angleStep = MOBILE_CONFIG.ANGLES.MANUFACTURER_SPREAD;
        const middleIndex = (manufacturers.length - 1) / 2;
        const centerAngle = this.viewport.getCenterAngle(); // 135° (Southwest)
        
        // Calculate rotation limits so first/last manufacturers stop at CENTER_ANGLE (135°)
        // When rotationOffset = 0, middle manufacturer is at centerAngle
        // For first manufacturer (index 0) to be at centerAngle:
        // centerAngle + offset + (0 - middleIndex) * angleStep = centerAngle
        // Therefore: offset = -(0 - middleIndex) * angleStep = middleIndex * angleStep
        const maxOffset = middleIndex * angleStep;
        
        // For last manufacturer (index length-1) to be at centerAngle:
        // centerAngle + offset + ((length-1) - middleIndex) * angleStep = centerAngle  
        // Therefore: offset = -((length-1) - middleIndex) * angleStep = -middleIndex * angleStep
        const minOffset = -middleIndex * angleStep;
        
        Logger.debug(`Rotation limits for ${manufacturers.length} manufacturers:`);
        Logger.debug(`maxOffset (first manufacturer at 135°): ${maxOffset * 180 / Math.PI}°`);
        Logger.debug(`minOffset (last manufacturer at 135°): ${minOffset * 180 / Math.PI}°`);
        
        return { min: minOffset, max: maxOffset };
    }
    
    handleRotationEnd(offset) {
        // Snap to nearest manufacturer
        if (!this.renderer.currentManufacturers.length) return;
        
        const manufacturers = this.renderer.currentManufacturers;
        const angleStep = MOBILE_CONFIG.ANGLES.MANUFACTURER_SPREAD;
        const middleIndex = (manufacturers.length - 1) / 2;
        
        // Find the manufacturer that should be centered with this offset
        const targetIndex = Math.round(-offset / angleStep + middleIndex);
        const clampedIndex = Math.max(0, Math.min(manufacturers.length - 1, targetIndex));
        
        // Calculate the exact offset needed to center this manufacturer
        const targetOffset = -(clampedIndex - middleIndex) * angleStep;
        
        // Animate to the target offset
        this.animateRotationTo(targetOffset);
        
        Logger.debug(`Snapping to manufacturer ${clampedIndex}: ${manufacturers[clampedIndex].name}`);
    }
    
    animateRotationTo(targetOffset) {
        if (!this.touchHandler) return;
        
        const startOffset = this.touchHandler.rotationOffset;
        const deltaOffset = targetOffset - startOffset;
        const duration = 300;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out animation
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentOffset = startOffset + deltaOffset * easedProgress;
            
            this.touchHandler.rotationOffset = currentOffset;
            this.renderer.updateManufacturerPositions(currentOffset);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    reset() {
        Logger.debug('Resetting mobile catalog');
        
        // Deactivate touch handling
        if (this.touchHandler) {
            this.touchHandler.deactivate();
            this.touchHandler = null;
        }
        
        // Reset renderer
        this.renderer.reset();
    }
}

/**
 * Initialize the mobile catalog application
 */
async function initMobileCatalog() {
    try {
        Logger.debug('Starting mobile catalog initialization...');
        
        window.mobileCatalogApp = new MobileCatalogApp();
        await window.mobileCatalogApp.init();
        
        // Set up global error handling
        window.addEventListener('error', (event) => {
            Logger.error('Global error:', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            Logger.error('Unhandled promise rejection:', event.reason);
        });
        
    } catch (error) {
        Logger.error('Failed to initialize mobile catalog:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileCatalog);
} else {
    // DOM is already loaded
    initMobileCatalog();
}