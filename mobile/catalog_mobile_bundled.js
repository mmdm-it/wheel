/**
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
        MODEL_RING: 180
    },
    
    // Animation constants
    ROTATION: {
        SENSITIVITY: 0.003,
        DECELERATION: 0.95,
        MIN_VELOCITY: 0.001,
        SNAP_THRESHOLD: 0.05
    },
    
    // Angle constants - mobile arc-based system
    ANGLES: {
        MANUFACTURER_SPREAD: Math.PI / 42, // 4.3°
        CYLINDER_SPREAD: Math.PI / 18,     // 10°
        MODEL_SPREAD: Math.PI / 18,        // 10°
        CENTER_ANGLE: Math.PI * 0.75       // 135° (Southwest) - for arc system
    },
    
    // Viewport constants
    VIEWPORT: {
        MARKET_OFFSET: {
            HORIZONTAL: 0.30,
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

        // Touch events for mobile
        hitArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleMarketSelection(market, g);
        });
        
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
                element = this.createManufacturerElement(manufacturer, position, angle);
                manufacturersGroup.appendChild(element);
                this.manufacturerElements.set(manufacturer.key, element);
            } else {
                this.updateManufacturerElement(element, position, angle);
            }
        });
        
        // Update active path with centermost manufacturer
        if (centerMostIndex >= 0) {
            const centerManufacturer = manufacturers[centerMostIndex];
            this.activePath = [centerManufacturer.market, centerManufacturer.country, centerManufacturer.name];
            Logger.debug('Centermost manufacturer:', centerManufacturer.name);
        }
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
    
    createManufacturerElement(manufacturer, position, angle) {
        const g = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'g');
        g.classList.add('manufacturer');
        g.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        
        const circle = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'circle');
        circle.setAttribute('class', 'node');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', MOBILE_CONFIG.RADIUS.UNSELECTED);
        circle.setAttribute('fill', this.getColor('manufacturer', manufacturer.name));
        g.appendChild(circle);
        
        const text = document.createElementNS(MOBILE_CONFIG.SVG_NS, 'text');
        this.updateManufacturerText(text, angle, manufacturer.name);
        g.appendChild(text);
        
        return g;
    }
    
    updateManufacturerElement(element, position, angle) {
        element.setAttribute('transform', `translate(${position.x}, ${position.y})`);
        
        const text = element.querySelector('text');
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
        
        // Rotation limits to center first and last manufacturers
        const maxOffset = -(0 - middleIndex) * angleStep;
        const minOffset = -((manufacturers.length - 1) - middleIndex) * angleStep;
        
        Logger.debug(`Rotation limits: min=${minOffset * 180 / Math.PI}°, max=${maxOffset * 180 / Math.PI}°`);
        
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