/**
 * Mobile Catalog Application
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
    }
    
    async init() {
        try {
            Logger.debug('Starting mobile catalog initialization...');
            
            // Load data first
            await this.dataManager.load();
            
            // Initialize renderer (includes DOM element setup)
            await this.renderer.initialize();
            
            // Skip market selection - directly show all manufacturers
            this.showAllFocusItems();
            
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
            
            // Handle viewport changes (repositions magnifying ring and updates manufacturers)
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
        
        // Create new touch handler
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
        // Hide market selection interface
        const marketsGroup = this.renderer.elements.marketsGroup;
        if (marketsGroup) {
            marketsGroup.classList.add('hidden');
        }
        
        // Get all manufacturers from all markets (currently the focus items are manufacturers)
        const allFocusItems = this.dataManager.getAllManufacturers();
        Logger.debug(`Loaded ${allFocusItems.length} focus items from all markets`);
        
        if (allFocusItems.length === 0) {
            Logger.warn('No focus items found in any market');
            return;
        }
        
        // Set current focus items and show them
        this.renderer.currentFocusItems = allFocusItems;
        this.renderer.showFocusRing();
        
        // Set up touch rotation
        this.setupTouchRotation(allFocusItems);
    }
    
    calculateRotationLimits(focusItems) {
        if (!focusItems.length) {
            return { min: -Infinity, max: Infinity };
        }
        
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (focusItems.length - 1) / 2;
        const centerAngle = this.viewport.getCenterAngle(); // Dynamic angle pointing to screen center
        
        // Validate inputs
        if (isNaN(angleStep)) {
            Logger.error(`Invalid angleStep in rotation limits: ${angleStep}`);
            return { min: -Infinity, max: Infinity };
        }
        if (isNaN(centerAngle)) {
            Logger.error(`Invalid centerAngle in rotation limits: ${centerAngle}`);
            return { min: -Infinity, max: Infinity };
        }
        
        // Calculate rotation limits so first/last manufacturers stop at the dynamic center angle
        // When rotationOffset = 0, middle manufacturer is at centerAngle
        // For first manufacturer (index 0) to be at centerAngle:
        // centerAngle + offset + (0 - middleIndex) * angleStep = centerAngle
        // Therefore: offset = -(0 - middleIndex) * angleStep = middleIndex * angleStep
        const maxOffset = middleIndex * angleStep;
        
        // For last manufacturer (index length-1) to be at centerAngle:
        // centerAngle + offset + ((length-1) - middleIndex) * angleStep = centerAngle  
        // Therefore: offset = -((length-1) - middleIndex) * angleStep = -middleIndex * angleStep
        const minOffset = -middleIndex * angleStep;
        
        // Validate calculated limits
        if (isNaN(maxOffset) || isNaN(minOffset)) {
            Logger.error(`Invalid rotation limits calculated: min=${minOffset}, max=${maxOffset}, middleIndex=${middleIndex}, angleStep=${angleStep}`);
            return { min: -Infinity, max: Infinity };
        }
        
        Logger.debug(`Rotation limits for ${focusItems.length} focus items:`);
        Logger.debug(`maxOffset (first focus item at center): ${maxOffset * 180 / Math.PI}°`);
        Logger.debug(`minOffset (last focus item at center): ${minOffset * 180 / Math.PI}°`);
        
        return { min: minOffset, max: maxOffset };
    }
    
    handleRotationEnd(offset) {
        // Notify renderer that rotation has ended - triggers cylinder display
        this.renderer.onRotationEnd();
        
        // Validate input offset
        if (isNaN(offset)) {
            Logger.error(`Invalid offset in handleRotationEnd: ${offset}`);
            return;
        }
        
        // Snap to nearest focus item
        if (!this.renderer.currentFocusItems.length) return;
        
        const focusItems = this.renderer.currentFocusItems;
        const angleStep = MOBILE_CONFIG.ANGLES.FOCUS_SPREAD;
        const middleIndex = (focusItems.length - 1) / 2;
        
        // Validate angleStep
        if (isNaN(angleStep)) {
            Logger.error(`Invalid angleStep: ${angleStep}`);
            return;
        }
        
        // Find the focus item that should be centered with this offset
        const targetIndex = Math.round(middleIndex - (offset / angleStep));
        const clampedIndex = Math.max(0, Math.min(focusItems.length - 1, targetIndex));
        
        // Calculate the exact offset needed to center this manufacturer
        const targetOffset = -(clampedIndex - middleIndex) * angleStep;
        
        // Validate calculated targetOffset
        if (isNaN(targetOffset)) {
            Logger.error(`Invalid targetOffset calculation: clampedIndex=${clampedIndex}, middleIndex=${middleIndex}, angleStep=${angleStep}`);
            return;
        }
        
        // Animate to the target offset
        this.animateRotationTo(targetOffset);
        
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

// Global app instance
let mobileCatalogApp = null;

/**
 * Initialize the mobile catalog application
 */
async function initMobileCatalog() {
    try {
        Logger.debug('Starting mobile catalog initialization...');
        
        mobileCatalogApp = new MobileCatalogApp();
        await mobileCatalogApp.init();
        
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

// Enhanced renderer extensions for Italian multi-line text support
function extendMobileRenderer() {
    // Enhanced market creation with multi-line Italian text support
    MobileRenderer.prototype.createMarketElement = function(market, position) {
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
    };

    // Enhanced market selection with touch rotation setup
    MobileRenderer.prototype.handleMarketSelection = function(market, marketElement) {
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
        if (mobileCatalogApp) {
            mobileCatalogApp.setupTouchRotation(this.currentFocusItems);
        }
    };
}

export { MobileCatalogApp, initMobileCatalog, extendMobileRenderer, mobileCatalogApp };