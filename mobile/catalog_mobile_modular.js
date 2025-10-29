/**
 * Mobile Catalog - Main Entry Point
 * Modular architecture for better maintainability
 */

// Import all modules
import { MOBILE_CONFIG } from './mobile-config.js';
import { Logger } from './mobile-logger.js';
import { ViewportManager } from './mobile-viewport.js';
import { TouchRotationHandler } from './mobile-touch.js';
import { DataManager } from './mobile-data.js';
import { MobileRenderer } from './mobile-renderer.js';
import { MobileCatalogApp, initMobileCatalog, extendMobileRenderer } from './mobile-app.js';

// Apply renderer extensions for enhanced functionality
extendMobileRenderer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileCatalog);
} else {
    // DOM is already loaded
    initMobileCatalog();
}

// Export for potential external use
export {
    MOBILE_CONFIG,
    Logger,
    ViewportManager,
    TouchRotationHandler,
    DataManager,
    MobileRenderer,
    MobileCatalogApp,
    initMobileCatalog
};