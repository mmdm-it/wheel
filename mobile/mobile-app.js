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
        const centerAngle = MOBILE_CONFIG.ANGLES.CENTER_ANGLE; // 135° (Southwest)
        
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
            mobileCatalogApp.setupTouchRotation(this.currentManufacturers);
        }
    };
}

export { MobileCatalogApp, initMobileCatalog, extendMobileRenderer, mobileCatalogApp };